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
import { computeBehaviors, sortedBehaviors, tickLonging } from './behaviors.js';

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
          deliverMindeyeEntry(t, order.targetId, actor.name || 'Someone', order.glyph);
        }else if(order.kind === 'channel'){
          // Channel (2026-08-21) — "Crafter recovers 1 Lightning Point,"
          // Crafter meaning whoever staged it, per dDd. Cost (Focus) was
          // already charged at staging time in js/techniques.js; the
          // recovery itself lands here, at Resolve, same as everything else.
          actor.lightningSpent = Math.max(0, (actor.lightningSpent || 0) - 1);
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

    // Behaviors — the foundation (2026-08-21/22, per dDd). "Likely Behavior
    // is what Behavior they are most likely to do when a Non-Combat Round
    // occurs (like auto-staging)." Deliberately NOT executed — Move Forward/
    // Stand Around don't actually happen on the Map this pass, per dDd's own
    // scope call; a Ledger line is "enough verification" that the
    // Information -> Relationship -> Behavior pipeline is really running
    // every Round. js/personality.js's Behaviors section shows the same
    // computeBehaviors()/sortedBehaviors() live, on demand.
    //
    // Longing ticks first (2026-08-22) — Separated builds it, Connected
    // drains it, both per remembered Glyph — so the same Round's Behavior
    // log reflects this Round's own accumulation, not last Round's.
    function tickAndLogBehavior(actor){
      (actor.mindeye || []).forEach(tickLonging);
      if(isDeathWounded(actor)) return;
      const ranked = sortedBehaviors(computeBehaviors(actor).distribution);
      const likely = ranked[0];
      t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' is likely to ' + likely.name + ' (' + likely.pct + '%).', time: timeNow() });
    }
    Object.values(t.players || {}).forEach(tickAndLogBehavior);
    Object.values(t.enemies || {}).forEach(tickAndLogBehavior);

    t.log.push({ type: 'system', text: 'A moment passes.', time: timeNow() });
  });
}
