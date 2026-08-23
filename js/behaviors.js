// Behaviors — the foundation, per dDd (2026-08-21/22). What a Character
// tracks as Information (remembered Glyphs, the Mindeye) and its
// Relationship to that Information (Attachment/Desire, Relationships Panel)
// is the INPUT; a Behavior is the OUTPUT — "Behaviors are the result of
// that." Deliberately scoped to just the math + display this pass: no
// Behavior actually plays out on the Map yet (see resolveNonCombatRound()
// in js/noncombat.js, which only logs the computed Likely Behavior to the
// Ledger, never executes it).
//
// Two Behaviors exist right now, per dDd's own demonstration pairing:
// Stand Around (the default for almost every Character) and Move Forward
// (nudged in by remembering the RO/OR Glyph specifically).
//
// The real weighting model (2026-08-22, per dDd — "the idea of them is to
// impact the long term and the short term Weight of some Information"):
// Desire is the immediate, short-term pull — a snapshot read off the
// Relationships Panel's Desire Axis. Longing is the long-term half — it
// ACCUMULATES on a remembered Glyph while its Attachment stays Separated
// (per dDd: "all Characters... are longing for a Union... Connection and
// Separation [are] their most primal instinct" — Separation is an unmet
// need that keeps building), and drains back down while Connected. Pursuit
// combines both: `max(0, desireScore + longing)`. Longing's cap (100) is
// deliberately far past Desire's own swing (±15) so sustained Longing CAN
// eventually dominate even a maximally Undesirable Glyph — the mechanic
// dDd's WWI/No-Man's-Land example needed: individual Desire pinned
// negative forever, but Longing (kept climbing by Separation that never
// resolves) still wins out as the Likely Behavior.
export const DESIRE_SCORE_UNIT = 15; // "15 is good!!" — per dDd, a unit that scales cleanly whether an Axis ends up 3-way, 5-way, or wider later
export const LONGING_INCREMENT = 5;
export const LONGING_CAP = 100;
// Lowered 20 -> 2 (2026-08-22, per dDd, after playtesting: "Stand Around is
// weight way too high. There should be like 10% chance it'll be the Likely
// Behavior once Movement is introduced. With 2 directions, it should be even
// more rare.") — with the new Desire weighting (a plain Mid-desire Glyph
// contributing DESIRE_SCORE_UNIT=15), the old baseline of 20 actually beat a
// single known direction outright (20 vs 15, ~57% Stand Around) — 2 gives
// ~12% against one direction, and naturally drops further as more Movement
// weight competes, with no extra formula needed.
export const STAND_AROUND_BASELINE = 2;

// Gom/Kulkrow — the two exceptions to Stand Around entirely (per dDd).
// Lives here, not js/noncombat.js, so js/personality.js's own distribution
// display can be accurate for these two as well, not just the actual
// Round-resolution logic.
export const NO_STAND_AROUND_ARCHETYPES = ['Gom', 'Kulkrow'];

// `kind` (2026-08-22) — which execution path js/noncombat.js's
// resolveBehavior() dispatches to; `turn` (only on the Move family) is
// clockwise steps away from a Character's current Facing (see turnFacing()
// in js/map.js): Forward 0, Right 1, Backward 2, Left 3. Stand Around has
// neither — it's the one Behavior that's a genuine no-op.
export const BEHAVIORS = {
  standAround: { name: 'Stand Around' },
  moveForward: { name: 'Move Forward', kind: 'move', turn: 0 },
  moveRight: { name: 'Move Right', kind: 'move', turn: 1 },
  moveBackward: { name: 'Move Backward', kind: 'move', turn: 2 },
  moveLeft: { name: 'Move Left', kind: 'move', turn: 3 },
  // Wander (2026-08-22, per dDd — KULOG) — a real, general Behavior version
  // of the random-Cardinal movement Gom/Kulkrow already had hardcoded
  // (js/noncombat.js's NO_STAND_AROUND_ARCHETYPES) — that special case is
  // deliberately left untouched (already verified, no reason to risk it on
  // a same-effect refactor); this is what any *other* Character who learns
  // KULOG rolls through the normal weighted pipeline instead.
  wander: { name: 'Wander', kind: 'wander' },
  // Face (2026-08-22, per dDd — KALAG) — "Character can face any direction
  // they know." Turns to a random Cardinal among the Character's own known
  // Direction Glyphs (js/map.js's DIRECTION_GLYPH_CARDINAL), not a relative
  // Move-style turn — this sets Facing directly, absolute compass reading.
  face: { name: 'Face', kind: 'face' },
  // Teach (2026-08-22, per dDd — WIM) — advances the Character's own active
  // Script (actor.activeScript, js/scripts.js) one Row at a time: sends
  // that Row's Outcome Glyph(s) as one Message to the Script's Target, per
  // dDd's own breakdown ("Actor action WIM, Target Outcome XXX... once
  // Player has received XXX, Gom could move onto other Rows"). A no-op,
  // same as Stand Around, when there's no active Script queued.
  teach: { name: 'Teach', kind: 'teach' },
  // Maintain Empower (2026-08-22, per dDd — KA, "wants to maintain Empower
  // with the Living Stone, his dominant behavior, but not exclusive") — a
  // no-op for now, same as Stand Around: Empower is Crafter-initiated
  // (staged through a real Craft, see js/techniques.js), a Behavior roll
  // landing here doesn't auto-cast it, just shows it as the Character's own
  // real inclination. KA also covers a second, Mental Behavior (Thinking/
  // Contemplation, per dDd: "KA works for 2 Behaviors, cause one is Mental
  // and the other is Physical") — not built, waiting on the 3-separate-
  // Behaviors-per-Character redesign (ROADMAP.md's Personality/Behaviors
  // section) that Mental/Physical actually implies; this is the Physical
  // half only.
  maintainEmpower: { name: 'Maintain Empower' },
  // Current (2026-08-22, per dDd — OG). "OG gives them Life via the Current
  // [Lightning Craft]" — animating/deanimating an Inert Stone (its Life and
  // Lightning Stats toggle 0<->1, see data/techniques.json's 'current').
  // No-op for now, same reasoning as Maintain Empower above — Crafter-
  // initiated, a Behavior roll here just surfaces the inclination.
  current: { name: 'Current' }
};

// Three separate Behaviors per Character (2026-08-22, per dDd, after
// playtesting the single-category system live): "Characters should have 3
// separate Behaviors. This is for moving, selecting, acting basically...
// it's basically the same layout, just 3 times in the same area (I was
// thinking 3 columns would be best). Like 1 for Movement, 2 for Actions, 3
// for Targeting." Each rolls independently every Round (js/noncombat.js's
// resolveBehavior()) — a Character can now Move AND take an Action in the
// same Round, since the categories don't compete with each other at all.
// Per dDd, correcting an initial misread: "all 3 behaviors should be
// available from the start, they don't need to level up or anything to get
// 2 and 3" — the 1/2/3 is just column order, not an Intelligence gate; a
// category with nothing relevant in the Mindeye simply has nothing to roll
// that Round (silently skipped, no forced default), except Movement, which
// keeps its own Stand Around baseline so a Character is never simply inert.
// Targeting has no Behaviors mapped into it yet — structurally ready, empty
// until a Glyph/mechanic for "who to act on" gets designed.
export const BEHAVIOR_CATEGORY = {
  standAround: 'movement',
  moveForward: 'movement', moveRight: 'movement', moveBackward: 'movement', moveLeft: 'movement',
  wander: 'movement', face: 'movement',
  teach: 'actions', maintainEmpower: 'actions', current: 'actions'
};
export const BEHAVIOR_CATEGORIES = [
  { key: 'movement', label: 'Movement' },
  { key: 'actions', label: 'Actions' },
  { key: 'targeting', label: 'Targeting' }
];

// Which Behavior a remembered Glyph nudges a Character toward. The 4
// Direction Glyphs (see js/techniques.js's DIRECTION_GLYPHS) match their own
// Up/Forward, Down/Back, Left, Right meanings 1:1 onto the 4 Move Behaviors.
// `maintainEmpower` reverted KA (2026-08-22, per dDd, self-correcting an
// earlier same-day move to OR: "I did screw up, sorry... We changed that
// prematurely. I checked the compositions lol. Cause OG gives them Life via
// the Current LiC, KA sustains them with Empower, and WIM is used to get
// them to develop relative independence.") — KA:maintainEmpower, WIM:teach,
// and OG:current (new, see BEHAVIORS.current above) is the real, checked-
// against-his-own-Compositions mapping. Per dDd, this table doesn't need to
// stay strictly one Glyph -> one Behavior either way: "KA (any Glyph) can
// mean tons of stuff, so Behavioral Overlap, where a couple of Glyphs are
// overlapping a Behavior, or a Glyph suggests several Behaviors, are fine."
export const GLYPH_BEHAVIOR = {
  'RO / OR': 'moveForward',
  'OP / PO': 'moveBackward',
  'OK': 'moveLeft',
  'KO': 'moveRight',
  'KULOG': 'wander',
  'KALAG': 'face',
  'WIM': 'teach',
  'KA': 'maintainEmpower',
  'OG': 'current'
};

// Favorable(0)/Middle(1)/Disliked(2) -> 2/1/0 units (2026-08-22, per dDd:
// "Axis! Middle position is +1, favorable position is +2, and disliked
// position is 0.") — replaces the old symmetric -1/0/+1 scheme, where a
// never-tuned Mid/Mid memory contributed exactly zero Pursuit and Stand
// Around's flat baseline always won by default. Per dDd: "That way defaults
// do something. Right now, standing always wins until manual changed."
const DESIRE_WEIGHT = [2, 1, 0];
function desireScore(entry){
  const desire = entry.desire ?? 1;
  return DESIRE_WEIGHT[desire] * DESIRE_SCORE_UNIT;
}

// Never negative — a Pursuit score below 0 has nothing meaningful left to
// contribute to a percentage distribution.
function pursuitScore(entry){
  return Math.max(0, desireScore(entry) + (entry.longing || 0));
}

// tickLonging (2026-08-22) — call once per remembered entry, once per
// Non-Combat Round (see js/noncombat.js). Separated builds Longing up,
// Connected drains it back down, Mid holds it flat — a simple tank that
// fills on an unmet need and empties once it's met.
export function tickLonging(entry){
  const attachment = entry.attachment ?? 1;
  const current = entry.longing || 0;
  if(attachment === 2) entry.longing = Math.min(LONGING_CAP, current + LONGING_INCREMENT);
  else if(attachment === 0) entry.longing = Math.max(0, current - LONGING_INCREMENT);
}

// Returns one { distribution, perGlyph } PER CATEGORY now (2026-08-22, per
// dDd's 3-Behaviors redesign — see BEHAVIOR_CATEGORIES above): { movement:
// {...}, actions: {...}, targeting: {...} }. Each category's Glyphs/
// Behaviors only compete against others in the SAME category — a Glyph
// mapped to an Actions Behavior contributes nothing to Movement's own
// distribution, and vice versa. Movement keeps the Stand Around baseline
// (so it sums to 100 and a Character is never simply inert); Actions/
// Targeting have no equivalent forced default — a category with nothing
// relevant in the Mindeye just comes back with an empty distribution,
// handled by resolveBehavior() (js/noncombat.js) as "nothing to roll this
// Round," not a fake 0%-labeled entry.
// `excludeStandAround` (2026-08-22, per dDd's Gom/Kulkrow spec — "they
// don't have Stand Around") — leaves Movement's baseline out of the seed
// entirely, so it never dilutes the real competition there. A tiny Stand
// Around sliver can still surface from rounding (the roundedSum correction
// below) — resolveBehavior() treats a rolled 'standAround' as "nothing else
// had real weight" and falls back to a guaranteed Wander instead.
export function computeBehaviors(actor, opts){
  const excludeStandAround = !!(opts && opts.excludeStandAround);
  const mindeye = (actor && actor.mindeye) || [];
  const result = {};

  BEHAVIOR_CATEGORIES.forEach(cat => {
    const behaviorPursuit = (cat.key === 'movement' && !excludeStandAround) ? { standAround: STAND_AROUND_BASELINE } : {};
    const perGlyph = [];
    mindeye.forEach(entry => {
      const behaviorKey = entry.glyph && GLYPH_BEHAVIOR[entry.glyph];
      if(!behaviorKey || BEHAVIOR_CATEGORY[behaviorKey] !== cat.key) return;
      const pursuit = pursuitScore(entry);
      behaviorPursuit[behaviorKey] = (behaviorPursuit[behaviorKey] || 0) + pursuit;
      perGlyph.push({
        entryId: entry.id, glyphId: entry.glyph, behaviorKey,
        behaviorName: BEHAVIORS[behaviorKey].name, pursuit, longing: entry.longing || 0
      });
    });

    const hasAnyWeight = Object.keys(behaviorPursuit).length > 0;
    const total = Object.values(behaviorPursuit).reduce((a, b) => a + b, 0) || 1;
    const distribution = {};
    Object.entries(behaviorPursuit).forEach(([key, p]) => { distribution[key] = Math.round(p / total * 100); });
    if(hasAnyWeight && cat.key === 'movement' && !excludeStandAround){
      const roundedSum = Object.values(distribution).reduce((a, b) => a + b, 0);
      if(roundedSum !== 100) distribution.standAround = (distribution.standAround || 0) + (100 - roundedSum);
    }
    perGlyph.forEach(g => { g.impactPct = Math.round(g.pursuit / total * 100); });

    result[cat.key] = { distribution, perGlyph };
  });

  return result;
}

// Highest-to-lowest [{key, name, pct}, ...] — index 0 is the Likely
// Behavior, index 1 (if present) the Runner Up.
export function sortedBehaviors(distribution){
  return Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .map(([key, pct]) => ({ key, name: BEHAVIORS[key].name, pct }));
}

// Real Map execution (2026-08-22, per dDd) — which Behavior actually
// happens this Round is a genuine weighted random draw across the whole
// distribution, NOT always the Likely (highest-%) one. Per dDd: "There is a
// chance they will actually get performed" — with the deterministic
// top-pick this replaced, a Behavior sitting under Stand Around's flat
// STAND_AROUND_BASELINE would never fire at all until it actually
// overtook 50%+, which (with Pursuit needing sustained Longing to climb
// that high) reads exactly like "my Characters always do Stand Around, no
// matter what" — a real weighted roll gives it its actual %-chance to win
// every single Round instead.
// Returns null on an empty distribution (2026-08-22, changed from a
// hardcoded 'standAround' fallback — Actions/Targeting have no Stand-
// Around-equivalent default, so forcing one there would be meaningless;
// resolveBehavior() in js/noncombat.js is what decides per-category what an
// empty roll actually means).
export function rollBehavior(distribution){
  const entries = Object.entries(distribution).filter(([, pct]) => pct > 0);
  if(!entries.length) return null;
  const total = entries.reduce((sum, [, pct]) => sum + pct, 0);
  let r = Math.random() * total;
  for(const [key, pct] of entries){
    if(r < pct) return key;
    r -= pct;
  }
  return entries[entries.length - 1][0];
}
