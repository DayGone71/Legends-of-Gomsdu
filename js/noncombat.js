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
import { isDeathWounded, deliverMindeyeEntry, timeNow } from './utils.js';
import { applyRecoveryTick, applyAttunementTick } from './combat.js';
import { computeBehaviors, tickLonging, rollBehavior, BEHAVIORS, NO_STAND_AROUND_ARCHETYPES } from './behaviors.js';
import { behaviorStep, turnFacing, tileKey, FACING_DEFAULT, applyFacing, DIRECTION_GLYPH_CARDINAL } from './map.js';
const CARDINALS = ['N', 'E', 'S', 'W'];

export async function resolveNonCombatRound(){
  const table = AppState.table;
  if(!table || table.inEncounter) return;

  await mutateTable(t => {
    if(!t.positions) t.positions = {};

    function processOrders(id, actor){
      const remainingOrders = [];
      (actor.orders || []).forEach(order => {
        if(order.kind === 'move'){
          const ap = actor.ap || 0;
          const consumed = ap > 0 ? order.path.splice(0, ap) : [];
          if(consumed.length){
            const last = consumed[consumed.length - 1];
            t.positions[id] = { x: last.x, y: last.y };
          }
          if(order.path.length > 0) remainingOrders.push(order); // more Rounds still needed
        }else if(order.kind === 'message'){
          // Up to 3 Glyphs per Message (2026-08-22, per dDd) — delivered as
          // that many separate Mindeye entries, in order, same as if they'd
          // arrived one at a time.
          (order.glyphs || (order.glyph ? [order.glyph] : [])).forEach(g => deliverMindeyeEntry(t, order.targetId, actor.name || 'Someone', g));
        }else if(order.kind === 'channel'){
          // Channel (2026-08-21) — "Crafter recovers 1 Lightning Point,"
          // Crafter meaning whoever staged it, per dDd. Cost (Focus) was
          // already charged at staging time in js/techniques.js; the
          // recovery itself lands here, at Resolve, same as everything else.
          actor.lightningSpent = Math.max(0, (actor.lightningSpent || 0) - 1);
        }else if(order.kind === 'facing'){
          // Facing (2026-08-22, per dDd: "Facing shouldn't change until the
          // Resolve occurs") — staged by js/map.js's stageFacingOrder,
          // applied here via the same mutation Behavior's own Face kind uses.
          applyFacing(t, id, order.direction);
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

    Object.values(t.players || {}).forEach(p => { if(!isDeathWounded(p)){ applyRecoveryTick(p); applyAttunementTick(p); } });
    Object.values(t.enemies || {}).forEach(e => { if(!isDeathWounded(e)){ applyRecoveryTick(e); applyAttunementTick(e); } });
    miniPartyStubs.forEach(mp => { if(!isDeathWounded(mp)){ applyRecoveryTick(mp); applyAttunementTick(mp); } });

    // DM Acting-As Message/Channel, staged via dmCommitAction into an
    // Enemy's own `sequence` (2026-08-22, per dDd: "Every Action should
    // resolve on turns. Nothing should happen immediately in Game...
    // Combat or Non-Combat, same thing"). That staging tool has no
    // Encounter gate at all, so this is its only Non-Combat resolution
    // path — Combat's own resolveRound() (js/combat.js) handles the
    // identical entries when an Encounter IS running. Has to run before
    // sequence gets cleared below, same "stage now, resolve at Round's
    // end" shape as everything else here.
    Object.values(t.enemies || {}).forEach(e => {
      (e.sequence || []).forEach(entry => {
        if(entry.kind !== 'technique') return;
        if(entry.techniqueKey === 'message') (entry.glyphs || []).forEach(g => deliverMindeyeEntry(t, entry.targetId, e.name || 'Someone', g));
        if(entry.techniqueKey === 'channel') e.lightningSpent = Math.max(0, (e.lightningSpent || 0) - 1);
      });
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
    function resolveBehavior(id, actor){
      (actor.mindeye || []).forEach(tickLonging);
      if(isDeathWounded(actor)) return;

      // Gom/Kulkrow: no Stand Around (per dDd), but no longer a hard bypass
      // of the real Behavior pipeline either — fixed 2026-08-22, found live:
      // the old bypass meant Gom could never actually Teach, no matter what
      // was in his Mindeye or activeScript, since he never reached
      // computeBehaviors()/rollBehavior() at all. Now he competes normally
      // (Wander/Teach/Face/Maintain Empower, whatever his own Mindeye
      // actually weighs) with Stand Around excluded from the seed —
      // guaranteed Wander is now only the fallback for "nothing else had
      // real weight," not a permanent lock.
      const noStandAround = NO_STAND_AROUND_ARCHETYPES.includes(actor.archetype);
      const { distribution } = computeBehaviors(actor, { excludeStandAround: noStandAround });
      let rolled = rollBehavior(distribution);
      if(noStandAround && rolled === 'standAround') rolled = 'wander';
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
        // knownGlyphs actually cover (DIRECTION_GLYPH_CARDINAL, js/map.js);
        // falls back to all 4 if knownGlyphs is unset, same backward-compat
        // default every other Glyph gate in this codebase uses.
        const known = actor.knownGlyphs && actor.knownGlyphs.length
          ? actor.knownGlyphs.map(g => DIRECTION_GLYPH_CARDINAL[g]).filter(Boolean)
          : null;
        const dirs = known && known.length ? known : CARDINALS;
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        applyFacing(t, id, dir);
        outcome = ' — turns to face ' + dir;
      }else if(meta.kind === 'teach'){
        // Teach (2026-08-22, per dDd — WIM), advances the actor's own
        // active Script (actor.activeScript, js/scripts.js) one Row at a
        // time: "Actor action WIM, Target Outcome XXX... once Player has
        // received XXX, Gom could move onto other Rows." A Row's Glyphs
        // all land in one Message (up to 3, per dDd's own Composition
        // math). No active Script queued — or already fully delivered —
        // is a no-op, same as Stand Around.
        const script = actor.activeScript;
        if(script && script.nextRow < script.rows.length){
          const row = script.rows[script.nextRow];
          row.forEach(g => deliverMindeyeEntry(t, script.targetId, actor.name || 'Someone', g));
          script.nextRow++;
          const done = script.nextRow >= script.rows.length;
          outcome = ' — teaches ' + (script.targetName || 'someone') + ' (' + row.join(', ') + ')' + (done ? '; Script complete' : '');
          if(done) actor.activeScript = null;
        }else{
          outcome = ' (nothing to Teach)';
        }
      }

      // The forced Wander fallback (above) isn't a real roll — showing a
      // 0%-ish number next to it would read as "won despite being
      // unlikely" instead of "nothing else was competing." Label it plainly.
      const pctLabel = (noStandAround && !distribution[rolled]) ? 'default' : (pct + '%');
      t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' does ' + meta.name + ' (' + pctLabel + ')' + outcome + '.', time: timeNow() });
    }
    Object.entries(t.players || {}).forEach(([id, p]) => resolveBehavior(id, p));
    Object.entries(t.enemies || {}).forEach(([id, e]) => resolveBehavior(id, e));

    t.log.push({ type: 'system', text: 'A moment passes.', time: timeNow() });
  });
}
