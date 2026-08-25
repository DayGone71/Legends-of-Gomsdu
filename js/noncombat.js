// The Non-Combat Round (2026-08-21, per dDd) — "the default state of the
// Game" whenever no Combat Encounter is running, not a special mode you opt
// into. Same underlying concept as Combat: Players and NPCs stack Orders,
// then a Resolve step processes them — see js/combat.js's resolveRound()
// for the Combat-side original. The real difference is scale: this doesn't
// tick against AP or tick-position math, it just processes whatever's
// staged and applies the same end-of-round Recovery/Attunement tick Combat
// already uses (js/combat.js's applyRecoveryTick/applyAttunementTick,
// reused verbatim). Two Order kinds — Move (staged from js/map.js's
// stageMoveOrder) and Message (staged from js/techniques.js's stageTechnique).
//
// Move Orders (2026-08-21) — every Tile costs 1 AP to move into, per dDd, so
// a Move Order carries a full multi-Tile path (js/map.js's stageMoveOrder
// already validated/built it), and a Round only consumes up to the actor's
// own AP worth of it. A path longer than that survives, trimmed, for the
// next Round to keep consuming — same pattern computeReachable/
// moveExtraRounds in js/map.js already model for the range preview.

import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { isDeathWounded, deliverMindeyeEntry, timeNow, resolveEntityRef, knownGlyphIds } from './utils.js';
import { applyRecoveryTick, applyAttunementTick, tickEmpowerUpkeep, canMaintainAnotherEmpower, spawnBuildAt } from './combat.js';
import { computeBehaviors, tickLonging, rollBehavior, BEHAVIORS, BEHAVIOR_CATEGORIES } from './behaviors.js';
import { behaviorStep, turnFacing, tileKey, FACING_DEFAULT, applyFacing, DIRECTION_GLYPH_CARDINAL, applySpillAt, tickLavaTiles } from './map.js';
import { TECHNIQUES } from './techniques.js';
const CARDINALS = ['N', 'E', 'S', 'W'];

export async function resolveNonCombatRound(){
  const table = AppState.table;
  if(!table || table.inEncounter) return;

  await mutateTable(t => {
    if(!t.positions) t.positions = {};

    // Influence Orders (2026-08-22, per dDd) — collected here, resolved in
    // one pass at the very end of this Round (below, after both the Order
    // sweep AND the DM's own sequence walk) so a Glyph picked from "Pending
    // (staged Message)" reliably finds the real Mindeye entry a Message
    // elsewhere this same Round just created, regardless of which staging
    // path (Player Order or DM sequence) either action came through.
    const pendingInfluences = [];

    function processOrders(id, actor){
      const remainingOrders = [];
      (actor.orders || []).forEach(order => {
        if(order.kind === 'move'){
          const ap = actor.ap || 0;
          const consumed = ap > 0 ? order.path.splice(0, ap) : [];
          if(consumed.length){
            const last = consumed[consumed.length - 1];
            t.positions[id] = { x: last.x, y: last.y };
            // Resolve-time confirmation (2026-08-23, per dDd — found live:
            // "I managed to Craft some stuff, Attune Stone and get them
            // move around, but none of that was in the Ledger"). Staging
            // already logs "orders a move to X"; every Order kind below
            // gets this same treatment now — nothing confirmed the effect
            // actually landing before.
            t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' moves to ' + tileKey(t.map, last.x, last.y) + '.', time: timeNow() });
          }
          if(order.path.length > 0) remainingOrders.push(order); // more Rounds still needed
        }else if(order.kind === 'message'){
          // Up to 3 Glyphs per Message (2026-08-22, per dDd) — delivered as
          // that many separate Mindeye entries, in order, same as if they'd
          // arrived one at a time.
          (order.glyphs || (order.glyph ? [order.glyph] : [])).forEach(g => deliverMindeyeEntry(t, order.targetId, actor.name || 'Someone', g));
          t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' delivers a Message to ' + (order.targetName || 'someone') + '.', time: timeNow() });
        }else if(order.kind === 'channel'){
          // Channel (2026-08-21) — "Crafter recovers 1 Lightning Point,"
          // Crafter meaning whoever staged it, per dDd. Cost (Focus) was
          // already charged at staging time in js/techniques.js; the
          // recovery itself lands here, at Resolve, same as everything else.
          actor.lightningSpent = Math.max(0, (actor.lightningSpent || 0) - 1);
          t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' channels, recovering 1 Lightning.', time: timeNow() });
        }else if(order.kind === 'facing'){
          // Facing (2026-08-22, per dDd: "Facing shouldn't change until the
          // Resolve occurs") — staged by js/map.js's stageFacingOrder,
          // applied here via the same mutation Behavior's own Face kind uses.
          applyFacing(t, id, order.direction);
          t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' turns to face ' + order.direction + '.', time: timeNow() });
        }else if(order.kind === 'empower'){
          // Empower (2026-08-22) — the Player's own staged Order path
          // (js/techniques.js's stageTechnique, generic Non-Combat branch).
          // Same real effect as js/combat.js's resolveRound() Empower case
          // and the DM sequence-walker just above — kept in sync by hand,
          // no shared helper, since the three staging paths (Player order,
          // DM sequence, Combat sequence) don't share a common entry shape.
          const target = resolveEntityRef(t, order.targetId);
          if(target){
            if(!target.empoweredBy) target.empoweredBy = [];
            if(!actor.maintainingEmpower) actor.maintainingEmpower = [];
            if(!target.empoweredBy.includes(id) && canMaintainAnotherEmpower(actor)){
              target.empoweredBy.push(id);
              actor.maintainingEmpower.push(order.targetId);
              target.control = (target.control || 0) + 1;
              target.ap = (target.ap || 0) + 1;
              t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' empowers ' + (target.name || 'someone') + '.', time: timeNow() });
            }
          }
        }else if(order.kind === 'influence'){
          pendingInfluences.push({ ...order, actorName: actor.name });
        }else if(order.kind === 'current'){
          // Current (2026-08-23) — same toggle/upkeep logic as js/combat.js's
          // resolveRound() 'current' case, mirrored here since Non-Combat is
          // usually where Gom actually reaches Living Stones. Kept in sync by
          // hand, same convention as Empower just above.
          const target = resolveEntityRef(t, order.targetId);
          if(target){
            if(!actor.shadowLinks) actor.shadowLinks = [];
            if(!target.shadowLinkedBy) target.shadowLinkedBy = [];
            const alreadyLinked = target.shadowLinkedBy.includes(id);
            if(alreadyLinked){
              target.shadowLinkedBy = target.shadowLinkedBy.filter(pid => pid !== id);
              actor.shadowLinks = actor.shadowLinks.filter(tid => tid !== order.targetId);
              target.life = 0;
              target.lightning = 0;
              t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' releases the Shadow Possession Link with ' + (target.name || 'someone') + '.', time: timeNow() });
            }else if(canMaintainAnotherEmpower(actor)){
              target.shadowLinkedBy.push(id);
              actor.shadowLinks.push(order.targetId);
              target.life = 1;
              target.lightning = 1;
              t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' forms a Shadow Possession Link with ' + (target.name || 'someone') + '.', time: timeNow() });
            }
          }
        }else if(order.kind === 'separation' || order.kind === 'infuse'){
          // Kulkrow's Map Crafts — same Molten-Lava-Tile requirement and
          // effect as js/combat.js's resolveRound(), mirrored here since
          // Non-Combat is where Kulkrow mostly reaches Tiles.
          const pos = t.positions && t.positions[id];
          const tIdx = pos && t.map && pos.x + 1 < t.map.width ? pos.y * t.map.width + (pos.x + 1) : null;
          if(tIdx !== null && t.map.lava && t.map.lava[tIdx] === 2){
            if(order.kind === 'separation'){
              t.map.lava[tIdx] = 0;
              t.map.tiles[tIdx] = 1;
              spawnBuildAt(t, 'inert-stone', pos.x + 1, pos.y);
              t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' Separates the Molten Lava ahead into Inert Stone.', time: timeNow() });
            }else{
              // Infuse: Molten Ones have no Stat block yet — see combat.js's
              // resolveRound() note. Nothing to spawn until that exists —
              // logged explicitly rather than silently doing nothing, same
              // "flag the known gap" convention the generic TECHNIQUES
              // fallback below already uses.
              t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' Infuses the Molten Lava ahead — Molten Ones aren’t built yet, no effect.', time: timeNow() });
            }
          }
        }else if(TECHNIQUES[order.kind]){
          // Any other real Technique (2026-08-23, per dDd — closing the
          // Combat/Non-Combat Technique distinction: "it doesn't do
          // anything on the front-end... it would be complicating things").
          // Staging no longer blocks these outside Combat; this is the same
          // "not yet mechanically resolved" placeholder js/combat.js's
          // resolveRound() already falls back to, so behavior reads the
          // same regardless of which context it was staged in.
          const def = TECHNIQUES[order.kind];
          t.log.push({ type: 'system', text: (actor.name || 'Someone') + '’s ' + def.name + ' on ' + (order.targetName || 'someone') + ' — ' + def.effect + ' (not yet mechanically resolved)', time: timeNow() });
        }
      });
      actor.orders = remainingOrders;
    }

    Object.entries(t.players || {}).forEach(([id, p]) => processOrders(id, p));
    Object.entries(t.enemies || {}).forEach(([id, e]) => processOrders(id, e));

    // Statted Mini-Party members get the same end-of-round upkeep as a real
    // Player/Enemy — same collection resolveRound() uses. They have no
    // position of their own yet (ROADMAP's Movement System item H), so they
    // never carry a 'move' Order in practice — only the tick below applies.
    const miniPartyStubs = [];
    Object.values(t.players || {}).forEach(p => {
      (p.miniParty || []).forEach(mp => { if(!mp.sourceEnemyId && mp.woundsMax != null) miniPartyStubs.push(mp); });
    });

    Object.entries(t.players || {}).forEach(([id, p]) => { if(!isDeathWounded(p)){ applyRecoveryTick(p); applyAttunementTick(p); tickEmpowerUpkeep(t, id, p); } });
    Object.entries(t.enemies || {}).forEach(([id, e]) => { if(!isDeathWounded(e)){ applyRecoveryTick(e); applyAttunementTick(e); tickEmpowerUpkeep(t, id, e); } });
    miniPartyStubs.forEach(mp => { if(!isDeathWounded(mp)){ applyRecoveryTick(mp); applyAttunementTick(mp); } });

    // Kulkrow's Spill + Lava Tile-State tick — same mechanism as
    // js/combat.js's resolveRound(), mirrored here since Non-Combat is the
    // default state of the Game.
    Object.entries(t.players || {}).forEach(([id, p]) => { if(p.passiveSpill && !isDeathWounded(p) && t.positions && t.positions[id]) applySpillAt(t, t.positions[id].x, t.positions[id].y); });
    Object.entries(t.enemies || {}).forEach(([id, e]) => { if(e.passiveSpill && !isDeathWounded(e) && t.positions && t.positions[id]) applySpillAt(t, t.positions[id].x, t.positions[id].y); });
    tickLavaTiles(t);

    // DM Acting-As Message/Channel, staged via dmCommitAction into an
    // Enemy's own `sequence` (2026-08-22, per dDd: "Every Action should
    // resolve on turns. Nothing should happen immediately in Game...
    // Combat or Non-Combat, same thing"). That staging tool has no
    // Encounter gate at all, so this is its only Non-Combat resolution
    // path — Combat's own resolveRound() (js/combat.js) handles the
    // identical entries when an Encounter IS running. Has to run before
    // sequence gets cleared below, same "stage now, resolve at Round's
    // end" shape as everything else here.
    const HANDLED_NONCOMBAT_DM_KEYS = ['message', 'channel', 'empower', 'current', 'separation', 'infuse'];
    Object.entries(t.enemies || {}).forEach(([id, e]) => {
      (e.sequence || []).forEach(entry => {
        if(entry.kind !== 'technique') return;
        if(entry.techniqueKey === 'message'){
          (entry.glyphs || []).forEach(g => deliverMindeyeEntry(t, entry.targetId, e.name || 'Someone', g));
          t.log.push({ type: 'system', text: (e.name || 'Someone') + ' delivers a Message to ' + (entry.targetName || 'someone') + '.', time: timeNow() });
        }
        if(entry.techniqueKey === 'channel'){
          e.lightningSpent = Math.max(0, (e.lightningSpent || 0) - 1);
          t.log.push({ type: 'system', text: (e.name || 'Someone') + ' channels, recovering 1 Lightning.', time: timeNow() });
        }
        // Empower (2026-08-22) — same real effect as js/combat.js's
        // resolveRound() Empower case, mirrored here for the DM's own
        // Acting-As staging path (no Encounter gate, so this is its only
        // Non-Combat resolution route).
        if(entry.techniqueKey === 'empower'){
          const target = resolveEntityRef(t, entry.targetId);
          if(target){
            if(!target.empoweredBy) target.empoweredBy = [];
            if(!e.maintainingEmpower) e.maintainingEmpower = [];
            if(!target.empoweredBy.includes(id) && canMaintainAnotherEmpower(e)){
              target.empoweredBy.push(id);
              e.maintainingEmpower.push(entry.targetId);
              target.control = (target.control || 0) + 1;
              target.ap = (target.ap || 0) + 1;
              t.log.push({ type: 'system', text: (e.name || 'Someone') + ' empowers ' + (target.name || 'someone') + '.', time: timeNow() });
            }
          }
        }
        // Current, mirrored for the DM's own Acting-As staging path — same
        // toggle logic as the Player Order case above and js/combat.js's
        // resolveRound().
        if(entry.techniqueKey === 'current'){
          const target = resolveEntityRef(t, entry.targetId);
          if(target){
            if(!e.shadowLinks) e.shadowLinks = [];
            if(!target.shadowLinkedBy) target.shadowLinkedBy = [];
            const alreadyLinked = target.shadowLinkedBy.includes(id);
            if(alreadyLinked){
              target.shadowLinkedBy = target.shadowLinkedBy.filter(pid => pid !== id);
              e.shadowLinks = e.shadowLinks.filter(tid => tid !== entry.targetId);
              target.life = 0;
              target.lightning = 0;
              t.log.push({ type: 'system', text: (e.name || 'Someone') + ' releases the Shadow Possession Link with ' + (target.name || 'someone') + '.', time: timeNow() });
            }else if(canMaintainAnotherEmpower(e)){
              target.shadowLinkedBy.push(id);
              e.shadowLinks.push(entry.targetId);
              target.life = 1;
              target.lightning = 1;
              t.log.push({ type: 'system', text: (e.name || 'Someone') + ' forms a Shadow Possession Link with ' + (target.name || 'someone') + '.', time: timeNow() });
            }
          }
        }
        if(entry.techniqueKey === 'separation' || entry.techniqueKey === 'infuse'){
          const pos = t.positions && t.positions[id];
          const tIdx = pos && t.map && pos.x + 1 < t.map.width ? pos.y * t.map.width + (pos.x + 1) : null;
          if(tIdx !== null && t.map.lava && t.map.lava[tIdx] === 2){
            if(entry.techniqueKey === 'separation'){
              t.map.lava[tIdx] = 0;
              t.map.tiles[tIdx] = 1;
              spawnBuildAt(t, 'inert-stone', pos.x + 1, pos.y);
              t.log.push({ type: 'system', text: (e.name || 'Someone') + ' Separates the Molten Lava ahead into Inert Stone.', time: timeNow() });
            }else{
              t.log.push({ type: 'system', text: (e.name || 'Someone') + ' Infuses the Molten Lava ahead — Molten Ones aren’t built yet, no effect.', time: timeNow() });
            }
          }
        }
        if(!HANDLED_NONCOMBAT_DM_KEYS.includes(entry.techniqueKey) && TECHNIQUES[entry.techniqueKey]){
          // Any other real Technique (2026-08-23) — same "not yet
          // mechanically resolved" fallback the Player Order path above and
          // js/combat.js's resolveRound() both use, closing the Combat/
          // Non-Combat Technique distinction for the DM's own Acting-As path too.
          const def = TECHNIQUES[entry.techniqueKey];
          t.log.push({ type: 'system', text: (e.name || 'Someone') + '’s ' + def.name + ' on ' + (entry.targetName || 'someone') + ' — ' + def.effect + ' (not yet mechanically resolved)', time: timeNow() });
        }
      });
    });

    // Influence, resolved last (2026-08-22, per dDd) — "Information can be
    // delivered already preloaded with bias." Deliberately after both the
    // Order sweep and the DM sequence walk above, so any Message delivered
    // this same Round (by either staging path) has already landed before
    // this looks for it. Adjusts the most recently remembered entry for the
    // picked Glyph — favors a just-delivered arrival over an older instance
    // of the same Glyph, matching "preloaded bias" onto the new one
    // specifically. Axis values are stored 0=Favorable/1=Mid/2=Disliked
    // (js/relationships.js's renderAxis) — "+1" (More Favorable) moves the
    // stored number down, "-1" (More Disliked) moves it up; clamped to the
    // real 0-2 range. Silently no-ops if the Glyph never actually arrived
    // (e.g. a referenced Message got cancelled) rather than erroring.
    pendingInfluences.forEach(order => {
      const target = resolveEntityRef(t, order.targetId);
      if(!target || !target.mindeye) return;
      for(let i = target.mindeye.length - 1; i >= 0; i--){
        if(target.mindeye[i].glyph === order.glyph){
          const cur = target.mindeye[i][order.axis] ?? 1;
          const delta = order.direction === '+1' ? -1 : 1;
          target.mindeye[i][order.axis] = Math.max(0, Math.min(2, cur + delta));
          t.log.push({ type: 'system', text: (order.actorName || 'Someone') + ' influences ' + (order.targetName || 'someone') + '’s ' + order.glyph + ' (' + order.axis + ' ' + order.direction + ').', time: timeNow() });
          break;
        }
      }
    });

    // Bug fix (2026-08-22, per dDd — "I never have enough AP no matter
    // what" trying to use Message Acting As Gom outside Combat). AP is a
    // flat per-Round allowance, same as Combat's resolveRound() already
    // treats it ("sequence/apSpent always clear," js/combat.js) — but the
    // DM's own Essence-menu staging (dmCommitAction, js/dm.js) pushes into
    // actor.sequence/apSpent regardless of Combat state, and nothing was
    // ever clearing that outside a real Combat Round. Gom's own tiny AP (1)
    // meant a single DM-staged Craft permanently maxed it out with no way
    // back. Minimal fix, not a DM Panel rework — per dDd, the DM Panel
    // itself is getting torn down/moved to the Map over time (same
    // direction Character's own actions already went); this just needs to
    // hold until the first Behavior build is done.
    Object.values(t.players || {}).forEach(p => { p.sequence = []; p.apSpent = 0; });
    Object.values(t.enemies || {}).forEach(e => { e.sequence = []; e.apSpent = 0; });
    miniPartyStubs.forEach(mp => { mp.sequence = []; mp.apSpent = 0; });

    // Twilight Milk — the Time Mechanic (2026-08-21, per dDd): every
    // Non-Combat Round moves the Sequencer Bar's Tick counter over by one.
    // 13 positions total (6 per Wing, the Orb as the 7th/center — see
    // js/sequencer.js's renderTwilightSky for the actual rendering); default
    // 6 (the Orb/center) matches that file's own TWILIGHT_CENTER_TICK,
    // duplicated as a literal here rather than imported to avoid a needless
    // cross-file coupling for one constant.
    t.timeTick = ((t.timeTick ?? 6) + 1) % 13;

    // Behaviors — real Map execution (2026-08-22, per dDd, upgrading the
    // 2026-08-21 foundation). What actually happens is a genuine weighted
    // random roll across the whole distribution (rollBehavior in
    // js/behaviors.js), not just always the Likely/highest-% one — see that
    // function's own comment for why the old deterministic top-pick read as
    // "always Stand Around." A rolled Move* Behavior steps the actor one
    // Tile via behaviorStep() (js/map.js), relative to their current Facing
    // (turnFacing) — Move Forward steps the way they're already facing,
    // Move Backward the opposite, etc. A blocked/off-map step just fails
    // quietly (behaviorStep returns false) and still logs what was
    // attempted, same as any other failed action in this codebase.
    //
    // Longing ticks first (2026-08-22) — Separated builds it, Connected
    // drains it, both per remembered Glyph — so this Round's roll reflects
    // this Round's own accumulation, not last Round's.
    // Three independent categories now (2026-08-22, per dDd's 3-Behaviors
    // redesign — see behaviors.js's BEHAVIOR_CATEGORIES) — Movement/Actions/
    // Targeting each roll separately, so a Character can Move AND take an
    // Action in the same Round, since the categories never compete with
    // each other. Each category that actually has something to roll gets
    // its own Ledger line; a category with nothing relevant in the Mindeye
    // (Actions/Targeting, most Characters right now) just stays silent that
    // Round rather than logging a fake no-op.
    function resolveBehavior(id, actor){
      (actor.mindeye || []).forEach(tickLonging);
      if(isDeathWounded(actor)) return;
      // Suppress Subconscious (2026-08-23, per dDd) — a per-Character freeze
      // on Behaviors rolling/executing at all, toggled from the Personality
      // Panel's new Plan section: "prevent conflicts with movement and
      // stuff" — lets a Player stage their own Moves/Orders for a Character
      // without a Behavior independently rolling a conflicting one. Hard
      // freeze, no exceptions, per dDd's own scoping for this pass. Longing
      // still ticks above regardless — that's Relationship state building
      // in the background, not an executed Behavior.
      if(actor.suppressSubconscious) return;

      const categories = computeBehaviors(actor);

      BEHAVIOR_CATEGORIES.forEach(cat => {
        const { distribution } = categories[cat.key];
        const rolled = rollBehavior(distribution);
        // Movement always has at least the Stand Around baseline now (every
        // Character, no exceptions — see behaviors.js's STAND_AROUND_BASELINE
        // comment) so this only ever fires for Actions/Targeting, meaning
        // genuinely nothing to do yet.
        if(rolled === null) return;
        const meta = BEHAVIORS[rolled];
        const pct = distribution[rolled] || 0;
        let outcome = '';

        if(meta.kind === 'move'){
          const dir = turnFacing(actor.facing || FACING_DEFAULT, meta.turn);
          const moved = behaviorStep(t, id, dir);
          outcome = moved ? (' — steps to ' + tileKey(t.map, t.positions[id].x, t.positions[id].y)) : ' (blocked)';
        }else if(meta.kind === 'wander'){
          // Wander (2026-08-22, per dDd — KULOG: "Character will go in a
          // random direction"). Unconstrained across all 4 Cardinals, same
          // as the Gom/Kulkrow special case above — unlike Face below, dDd's
          // own wording doesn't gate this by knownGlyphs specifically.
          const dir = CARDINALS[Math.floor(Math.random() * CARDINALS.length)];
          const moved = behaviorStep(t, id, dir);
          outcome = moved ? (' — wanders to ' + tileKey(t.map, t.positions[id].x, t.positions[id].y)) : ' (blocked)';
        }else if(meta.kind === 'face'){
          // Face (2026-08-22, per dDd — KALAG: "Character can face any
          // direction they know"). Picks among the Cardinals the actor's own
          // known Glyphs actually cover (DIRECTION_GLYPH_CARDINAL, js/map.js).
          // "Known" (2026-08-23) now reads real Mindeye entries via
          // knownGlyphIds() — the separate knownGlyphs curriculum array is
          // gone (see js/utils.js). Falls back to all 4 if nothing in
          // Mindeye maps to a direction.
          const known = knownGlyphIds(actor).map(g => DIRECTION_GLYPH_CARDINAL[g]).filter(Boolean);
          const dirs = known.length ? known : CARDINALS;
          const dir = dirs[Math.floor(Math.random() * dirs.length)];
          applyFacing(t, id, dir);
          outcome = ' — turns to face ' + dir;
        }else if(meta.kind === 'teach'){
          // Teach (2026-08-22, per dDd — WIM), advances the actor's own
          // active Scripts (actor.activeScripts, up to 3 — js/scripts.js)
          // one Row at a time each: "Actor action WIM, Target Outcome XXX...
          // once Player has received XXX, Gom could move onto other Rows."
          // A Row's Glyphs all land in one Message (up to 3, per dDd's own
          // Composition math). A completed Script is dropped from the
          // array, freeing its slot for a new one.
          //
          // Two Teach modes (2026-08-23, per dDd — "1 Script to Empower, 1
          // Script to Teach. 10 Scripts a Round for 5 Players... Throughput
          // is good to have too though"), toggled per-Actor via
          // actor.teachMode ('sequential', the default, or 'parallel'):
          // sequential advances exactly one Row total, from the first
          // not-yet-complete slot — pacing stays identical whether 1 or 3
          // Scripts are queued. Parallel advances one Row on *every*
          // not-yet-complete slot the same Round — true multiplayer
          // throughput (Gom teaching several Players/topics at once). A
          // third "dynamic" mode (blending the two by Script priority) is
          // deliberately not built yet — per dDd, it "requires another Stat
          // for prioritizing the Scripts," not yet designed.
          const scripts = actor.activeScripts || [];
          const incomplete = scripts.filter(s => s.nextRow < s.rows.length);
          if(!incomplete.length){
            outcome = ' (nothing to Teach)';
          }else if(actor.teachMode === 'parallel'){
            const taught = incomplete.map(script => {
              const row = script.rows[script.nextRow];
              row.forEach(g => deliverMindeyeEntry(t, script.targetId, actor.name || 'Someone', g));
              script.nextRow++;
              const done = script.nextRow >= script.rows.length;
              return (script.targetName || 'someone') + ' (' + row.join(', ') + ')' + (done ? ' [complete]' : '');
            });
            actor.activeScripts = scripts.filter(s => s.nextRow < s.rows.length);
            outcome = ' — teaches ' + taught.length + ' at once: ' + taught.join('; ');
          }else{
            const script = incomplete[0];
            const row = script.rows[script.nextRow];
            row.forEach(g => deliverMindeyeEntry(t, script.targetId, actor.name || 'Someone', g));
            script.nextRow++;
            const done = script.nextRow >= script.rows.length;
            outcome = ' — teaches ' + (script.targetName || 'someone') + ' (' + row.join(', ') + ')' + (done ? '; Script complete' : '');
            if(done) actor.activeScripts = scripts.filter(s => s !== script);
          }
        }else if(meta.kind === 'attack'){
          // Attack (2026-08-24, per dDd — S), first pass. Deliberately
          // minimal: no staged Fast Attack, no roll, nothing that touches
          // combat.js's own resolution — this Round just starts the
          // Encounter (per dDd: "simply Start Encounter, instead of making
          // it [do] something in Combat... would simplify the work"). Real
          // Combat resolution takes over from the next Resolve, once
          // table.inEncounter routes through combat.js's resolveRound()
          // instead of this file. Target defaults to a Living Stone, per
          // dDd — real Targeting (who to attack) has no mechanism yet;
          // KRO/KROW (Glyphs for "a Living Stone" as a Target) are the
          // eventual real source, not built this pass.
          const target = Object.entries(t.players || {}).find(([tid, p]) => tid !== id && p.archetype === 'Living Stone')
            || Object.entries(t.enemies || {}).find(([tid, e]) => tid !== id && e.archetype === 'Living Stone');
          if(target){
            t.inEncounter = true;
            outcome = ' — attacks ' + (target[1].name || 'a Living Stone') + '. The Encounter begins';
          }else{
            outcome = ' (no Living Stone to attack)';
          }
        }

        t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' does ' + meta.name + ' (' + pct + '%)' + outcome + '.', time: timeNow() });
      });
    }
    Object.entries(t.players || {}).forEach(([id, p]) => resolveBehavior(id, p));
    Object.entries(t.enemies || {}).forEach(([id, e]) => resolveBehavior(id, e));

    t.log.push({ type: 'system', text: 'A moment passes.', time: timeNow() });
  });
}
