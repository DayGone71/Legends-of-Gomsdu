// The Non-Combat Round — the default state of the Game whenever no Combat
// Encounter is running, not a special mode. Players/NPCs stack Orders, then
// Resolve processes them, same shape as combat.js's resolveRound() but with
// no AP/tick-position math — it just applies whatever's staged plus the same
// end-of-round Recovery/Attunement tick Combat uses.
// Order kinds: Move (map.js's stageMoveOrder) and Message (techniques.js's
// stageTechnique).
//
// A Move Order carries a full multi-Tile path (1 AP per Tile); a Round only
// consumes up to the actor's own AP worth of it, and a longer path survives,
// trimmed, for the next Round.

import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { isDeathWounded, deliverMindeyeEntry, timeNow, resolveEntityRef, knownGlyphIds } from './utils.js';
import { applyRecoveryTick, applyAttunementTick, tickEmpowerUpkeep, canMaintainAnotherEmpower, spawnBuildAt } from './combat.js';
import { tickLonging, fillBehaviorQueue, BEHAVIORS } from './behaviors.js';
import { behaviorStep, turnFacing, tileKey, FACING_DEFAULT, applyFacing, DIRECTION_GLYPH_CARDINAL, applySpillAt, tickLavaTiles } from './map.js';
import { TECHNIQUES } from './techniques.js';
import { TWILIGHT_CYCLE_COUNT } from './sequencer.js';
const CARDINALS = ['N', 'E', 'S', 'W'];

export async function resolveNonCombatRound(){
  const table = AppState.table;
  if(!table || table.inEncounter) return;

  await mutateTable(t => {
    if(!t.positions) t.positions = {};

    // Collected here, resolved once at the very end of this Round (after
    // both the Order sweep and the DM sequence walk below) so a Glyph picked
    // from a pending Message reliably finds the entry that Message created,
    // regardless of which staging path it came through.
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
            t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' moves to ' + tileKey(t.map, last.x, last.y) + '.', time: timeNow() });
          }
          if(order.path.length > 0) remainingOrders.push(order); // more Rounds still needed
        }else if(order.kind === 'message'){
          // Up to 3 Glyphs per Message, delivered as separate Mindeye entries in order.
          (order.glyphs || (order.glyph ? [order.glyph] : [])).forEach(g => deliverMindeyeEntry(t, order.targetId, actor.name || 'Someone', g));
          t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' delivers a Message to ' + (order.targetName || 'someone') + '.', time: timeNow() });
        }else if(order.kind === 'channel'){
          // Focus cost was charged at staging; the Lightning recovery lands here, at Resolve.
          actor.lightningSpent = Math.max(0, (actor.lightningSpent || 0) - 1);
          t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' channels, recovering 1 Lightning.', time: timeNow() });
        }else if(order.kind === 'facing'){
          applyFacing(t, id, order.direction);
          t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' turns to face ' + order.direction + '.', time: timeNow() });
        }else if(order.kind === 'empower'){
          // Same effect as combat.js's resolveRound() Empower case — kept in sync by
          // hand, the three staging paths (Player order, DM sequence, Combat sequence)
          // don't share a common entry shape.
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
          // Same toggle/upkeep logic as combat.js's resolveRound() 'current' case.
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
          // Kulkrow's Map Crafts — same Molten-Lava-Tile requirement/effect as combat.js's resolveRound().
          const pos = t.positions && t.positions[id];
          const tIdx = pos && t.map && pos.x + 1 < t.map.width ? pos.y * t.map.width + (pos.x + 1) : null;
          if(tIdx !== null && t.map.lava && t.map.lava[tIdx] === 2){
            if(order.kind === 'separation'){
              t.map.lava[tIdx] = 0;
              t.map.tiles[tIdx] = 1;
              spawnBuildAt(t, 'inert-stone', pos.x + 1, pos.y);
              t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' Separates the Molten Lava ahead into Inert Stone.', time: timeNow() });
            }else{
              // Molten Ones have no Stat block yet — nothing to spawn.
              t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' Infuses the Molten Lava ahead — Molten Ones aren’t built yet, no effect.', time: timeNow() });
            }
          }
        }else if(TECHNIQUES[order.kind]){
          // Fallback for any real Technique not mechanically resolved yet — same
          // placeholder combat.js's resolveRound() falls back to.
          const def = TECHNIQUES[order.kind];
          t.log.push({ type: 'system', text: (actor.name || 'Someone') + '’s ' + def.name + ' on ' + (order.targetName || 'someone') + ' — ' + def.effect + ' (not yet mechanically resolved)', time: timeNow() });
        }
      });
      actor.orders = remainingOrders;
    }

    Object.entries(t.players || {}).forEach(([id, p]) => processOrders(id, p));
    Object.entries(t.enemies || {}).forEach(([id, e]) => processOrders(id, e));
    // Yom (and any future Universal Character) can now stage real Orders too
    // — techniques.js's openTechniqueUse/stageTechnique became actor-generic
    // 2026-08-30, so this has to actually resolve them, not just the
    // Recovery/Attunement/reset sweeps below (already generalized earlier).
    Object.entries(t.characters || {}).forEach(([id, c]) => processOrders(id, c));

    // Statted Mini-Party members get the same end-of-round upkeep as a real
    // Player/Enemy. They have no position of their own yet, so they never
    // carry a 'move' Order — only the tick below applies.
    const miniPartyStubs = [];
    Object.values(t.players || {}).forEach(p => {
      (p.miniParty || []).forEach(mp => { if(!mp.sourceEnemyId && mp.woundsMax != null) miniPartyStubs.push(mp); });
    });

    Object.entries(t.players || {}).forEach(([id, p]) => { if(!isDeathWounded(p)){ applyRecoveryTick(p); applyAttunementTick(p); tickEmpowerUpkeep(t, id, p); } });
    Object.entries(t.enemies || {}).forEach(([id, e]) => { if(!isDeathWounded(e)){ applyRecoveryTick(e); applyAttunementTick(e); tickEmpowerUpkeep(t, id, e); } });
    // Yom (and any future Universal Character in t.characters) — same tick as
    // combat.js's resolveRound(), see the matching note there. Attunement is
    // what actually matters for him: refills the Focus/Lightning/Lava a live
    // Seed cast (js/scenes.js's castSeedLive) spends.
    Object.entries(t.characters || {}).forEach(([id, c]) => { if(!isDeathWounded(c)){ applyRecoveryTick(c); applyAttunementTick(c); tickEmpowerUpkeep(t, id, c); } });
    miniPartyStubs.forEach(mp => { if(!isDeathWounded(mp)){ applyRecoveryTick(mp); applyAttunementTick(mp); } });

    // Kulkrow's Spill + Lava Tile-State tick — same mechanism as combat.js's resolveRound().
    Object.entries(t.players || {}).forEach(([id, p]) => { if(p.passiveSpill && !isDeathWounded(p) && t.positions && t.positions[id]) applySpillAt(t, t.positions[id].x, t.positions[id].y); });
    Object.entries(t.enemies || {}).forEach(([id, e]) => { if(e.passiveSpill && !isDeathWounded(e) && t.positions && t.positions[id]) applySpillAt(t, t.positions[id].x, t.positions[id].y); });
    tickLavaTiles(t);

    // DM Acting-As Message/Channel, staged via dmCommitAction into an Enemy's
    // own `sequence`. That staging tool has no Encounter gate, so this is its
    // only Non-Combat resolution path — combat.js's resolveRound() handles the
    // same entries when an Encounter IS running. Must run before sequence is
    // cleared below.
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
          const def = TECHNIQUES[entry.techniqueKey];
          t.log.push({ type: 'system', text: (e.name || 'Someone') + '’s ' + def.name + ' on ' + (entry.targetName || 'someone') + ' — ' + def.effect + ' (not yet mechanically resolved)', time: timeNow() });
        }
      });
    });

    // Resolved last so any Message delivered this same Round has already
    // landed. Adjusts the most recently remembered entry for the picked
    // Glyph. Axis values are 0=Favorable/1=Mid/2=Disliked — "+1" (More
    // Favorable) moves the stored number down, "-1" moves it up, clamped 0-2.
    // Silently no-ops if the Glyph never actually arrived.
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

    // AP is a flat per-Round allowance, same as Combat treats it, but the DM's
    // own Essence-menu staging pushes into actor.sequence/apSpent regardless of
    // Combat state — this clears it every Non-Combat Round too so it can't get
    // permanently stuck maxed out.
    Object.values(t.players || {}).forEach(p => { p.sequence = []; p.apSpent = 0; });
    Object.values(t.enemies || {}).forEach(e => { e.sequence = []; e.apSpent = 0; });
    Object.values(t.characters || {}).forEach(c => { c.sequence = []; c.apSpent = 0; });
    miniPartyStubs.forEach(mp => { mp.sequence = []; mp.apSpent = 0; });

    // Twilight Milk — the Time Mechanic. Every Non-Combat Round advances the
    // real cycle by one — 26 states now (Day 0-12, Night 13-25), not 13; see
    // sequencer.js's own header comment for the real spec (dDd, 2026-08-30)
    // and TWILIGHT_CYCLE_COUNT, the one place that number lives.
    t.timeTick = ((t.timeTick ?? 6) + 1) % TWILIGHT_CYCLE_COUNT;

    // Real Map execution: the Behavior Queue is what actually gets acted on
    // now, not a fresh roll. fillBehaviorQueue() (behaviors.js) recomputes
    // the whole Queue fresh every Round — every known Glyph across all 3
    // Categories competes in one pool for up to 9 slots (cap tied to the
    // actor's own AP), Repeat-penalized within that single computation only,
    // nothing carried over from last Round. Draining then pops from the
    // front, 1 AP per Behavior, until AP runs out or the Queue does.
    // Longing ticks first, so this Round's Queue reflects this Round's own accumulation.
    function resolveBehavior(id, actor){
      (actor.mindeye || []).forEach(tickLonging);
      if(isDeathWounded(actor)) return;
      // Per-Character freeze, toggled from the Personality Panel's Plan section
      // — lets a Player stage their own Moves/Orders without a Behavior rolling
      // a conflicting one. Longing still ticks above regardless.
      if(actor.suppressSubconscious) return;

      const queue = fillBehaviorQueue(actor);

      actor.apSpent = actor.apSpent || 0;
      while(actor.apSpent < (actor.ap || 0) && queue.length){
        const entry = queue.shift();
        const meta = BEHAVIORS[entry.behaviorKey];
        if(!meta) continue; // stale/unrecognized entry — skip rather than crash the Round
        let outcome = '';

        if(meta.kind === 'move'){
          const dir = turnFacing(actor.facing || FACING_DEFAULT, meta.turn);
          const moved = behaviorStep(t, id, dir);
          outcome = moved ? (' — steps to ' + tileKey(t.map, t.positions[id].x, t.positions[id].y)) : ' (blocked)';
        }else if(meta.kind === 'wander'){
          const dir = CARDINALS[Math.floor(Math.random() * CARDINALS.length)];
          const moved = behaviorStep(t, id, dir);
          outcome = moved ? (' — wanders to ' + tileKey(t.map, t.positions[id].x, t.positions[id].y)) : ' (blocked)';
        }else if(meta.kind === 'face'){
          // Picks among the Cardinals the actor's own known Glyphs actually
          // cover; falls back to all 4 if nothing in Mindeye maps to a direction.
          const known = knownGlyphIds(actor).map(g => DIRECTION_GLYPH_CARDINAL[g]).filter(Boolean);
          const dirs = known.length ? known : CARDINALS;
          const dir = dirs[Math.floor(Math.random() * dirs.length)];
          applyFacing(t, id, dir);
          outcome = ' — turns to face ' + dir;
        }else if(meta.kind === 'teach'){
          // Advances the actor's own active Scripts (up to 3) one Row at a
          // time each. A Row's Glyphs all land in one Message. A completed
          // Script is dropped, freeing its slot.
          // Two Teach modes, per-Actor (actor.teachMode): sequential (default)
          // advances exactly one Row total, from the first incomplete slot —
          // pacing stays identical regardless of how many Scripts are queued.
          // Parallel advances one Row on every incomplete slot the same Round
          // — real multiplayer throughput. A third "dynamic" mode isn't built.
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
          // Deliberately minimal first pass: no staged Fast Attack, no roll —
          // this Round just starts the Encounter (table-wide, coarse). Real
          // Combat resolution takes over from the next Resolve. Target
          // defaults to a Living Stone — real Targeting isn't built yet.
          const target = Object.entries(t.players || {}).find(([tid, p]) => tid !== id && p.archetype === 'Living Stone')
            || Object.entries(t.enemies || {}).find(([tid, e]) => tid !== id && e.archetype === 'Living Stone');
          if(target){
            t.inEncounter = true;
            outcome = ' — attacks ' + (target[1].name || 'a Living Stone') + '. The Encounter begins';
          }else{
            outcome = ' (no Living Stone to attack)';
          }
        }

        actor.apSpent += 1;
        t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' does ' + meta.name + outcome + '.', time: timeNow() });
      }
    }
    Object.entries(t.players || {}).forEach(([id, p]) => resolveBehavior(id, p));
    Object.entries(t.enemies || {}).forEach(([id, e]) => resolveBehavior(id, e));

    t.log.push({ type: 'system', text: 'A moment passes.', time: timeNow() });
  });
}
