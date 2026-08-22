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
export const STAND_AROUND_BASELINE = 20; // per dDd: "20 is a good baseline" for Stand Around's own inertia

export const BEHAVIORS = {
  standAround: { name: 'Stand Around' },
  moveForward: { name: 'Move Forward' }
};

// Which Behavior a remembered Glyph nudges a Character toward. Only RO/OR is
// mapped so far — every other Glyph currently has no Behavior association.
export const GLYPH_BEHAVIOR = {
  'RO / OR': 'moveForward'
};

// Desirable(0) -> +unit, Mid(1) -> 0, Undesirable(2) -> -unit.
function desireScore(entry){
  const desire = entry.desire ?? 1;
  return (1 - desire) * DESIRE_SCORE_UNIT;
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

// { distribution: {behaviorKey: pct, ...}, perGlyph: [{entryId, glyphId, behaviorKey, behaviorName, pursuit, impactPct, longing}] }
// distribution always sums to 100 (Stand Around absorbs any rounding
// remainder). Scales to any number of remembered Glyphs: each one with a
// Behavior association contributes its own Pursuit score into that
// Behavior's running total; totally unassociated Glyphs (the overwhelming
// majority right now — only RO/OR maps to anything) just contribute 0.
export function computeBehaviors(actor){
  const mindeye = (actor && actor.mindeye) || [];
  const behaviorPursuit = { standAround: STAND_AROUND_BASELINE };

  const perGlyph = mindeye.map(entry => {
    const behaviorKey = entry.glyph && GLYPH_BEHAVIOR[entry.glyph];
    const pursuit = behaviorKey ? pursuitScore(entry) : 0;
    if(behaviorKey) behaviorPursuit[behaviorKey] = (behaviorPursuit[behaviorKey] || 0) + pursuit;
    return {
      entryId: entry.id, glyphId: entry.glyph || 'GI', behaviorKey,
      behaviorName: behaviorKey ? BEHAVIORS[behaviorKey].name : null,
      pursuit, longing: entry.longing || 0
    };
  });

  const total = Object.values(behaviorPursuit).reduce((a, b) => a + b, 0) || 1;
  const distribution = {};
  Object.entries(behaviorPursuit).forEach(([key, p]) => { distribution[key] = Math.round(p / total * 100); });
  const roundedSum = Object.values(distribution).reduce((a, b) => a + b, 0);
  if(roundedSum !== 100) distribution.standAround = (distribution.standAround || 0) + (100 - roundedSum);

  perGlyph.forEach(g => { g.impactPct = Math.round(g.pursuit / total * 100); });

  return { distribution, perGlyph };
}

// Highest-to-lowest [{key, name, pct}, ...] — index 0 is the Likely
// Behavior, index 1 (if present) the Runner Up.
export function sortedBehaviors(distribution){
  return Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .map(([key, pct]) => ({ key, name: BEHAVIORS[key].name, pct }));
}
