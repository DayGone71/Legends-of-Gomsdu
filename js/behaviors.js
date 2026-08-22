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
  // no-op for now, same as Stand Around, since Empower's own +1 Control/+1
  // AP effect isn't mechanically built yet (see ROADMAP.md's Techniques
  // Panel section) — nothing real to "maintain" until that lands. Still
  // real and rollable through the normal weighted pipeline, so its %
  // shows up honestly in the distribution even though performing it does
  // nothing observable yet.
  maintainEmpower: { name: 'Maintain Empower' }
};

// Which Behavior a remembered Glyph nudges a Character toward. The 4
// Direction Glyphs (see js/techniques.js's DIRECTION_GLYPHS) match their own
// Up/Forward, Down/Back, Left, Right meanings 1:1 onto the 4 Move
// Behaviors; KULOG/KALAG/WIM/KA (2026-08-22, per dDd) map onto Wander/Face/
// Teach/maintain-Empower. Every other Glyph currently has no association.
export const GLYPH_BEHAVIOR = {
  'RO / OR': 'moveForward',
  'OP / PO': 'moveBackward',
  'OK': 'moveLeft',
  'KO': 'moveRight',
  'KULOG': 'wander',
  'KALAG': 'face',
  'WIM': 'teach',
  'KA': 'maintainEmpower'
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
// `excludeStandAround` (2026-08-22, per dDd's Gom/Kulkrow spec — "they
// don't have Stand Around") — leaves Stand Around's baseline out of the
// seed entirely, so it never dilutes the real competition between whatever
// Behaviors the actor's own Mindeye actually weighs. Used instead of the
// old hardcoded bypass in js/noncombat.js that skipped this function for
// Gom/Kulkrow altogether — that made sense before Wander/Teach/Face/Maintain
// Empower existed as real Behaviors they could roll, but it also meant Gom
// could never actually Teach no matter what was in his Mindeye or
// activeScript. A tiny Stand Around sliver can still surface from rounding
// (see the roundedSum correction below) — resolveBehavior() in
// js/noncombat.js treats a rolled 'standAround' here as "nothing else had
// real weight" and falls back to a guaranteed Wander instead, preserving
// the original "never truly idle" intent without the hard bypass.
export function computeBehaviors(actor, opts){
  const excludeStandAround = !!(opts && opts.excludeStandAround);
  const mindeye = (actor && actor.mindeye) || [];
  const behaviorPursuit = excludeStandAround ? {} : { standAround: STAND_AROUND_BASELINE };

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
export function rollBehavior(distribution){
  const entries = Object.entries(distribution).filter(([, pct]) => pct > 0);
  if(!entries.length) return 'standAround';
  const total = entries.reduce((sum, [, pct]) => sum + pct, 0);
  let r = Math.random() * total;
  for(const [key, pct] of entries){
    if(r < pct) return key;
    r -= pct;
  }
  return entries[entries.length - 1][0];
}
