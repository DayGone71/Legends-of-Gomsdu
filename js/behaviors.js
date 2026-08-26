// Behavior math only — no execution. A Character's remembered Glyphs
// (Mindeye) and their Attachment/Desire toward each feed Pursuit; actual
// dispatch happens in noncombat.js's resolveBehavior().
export const DESIRE_SCORE_UNIT = 15; // unit Desire swings by per Axis step
export const LONGING_INCREMENT = 5;
export const LONGING_CAP = 100; // far past Desire's own swing, so sustained Longing can outweigh even a disliked Glyph
export const STAND_AROUND_BASELINE = 2; // low on purpose — shouldn't dominate once real Movement Glyphs are known

// Not hardcoded exceptions: Gom/Kulkrow follow the same Glyph-gated rules as
// any Character. A Character who doesn't know a Movement Glyph can't roll it.

// kind: which execution path resolveBehavior() (noncombat.js) dispatches to.
// turn (Move family only): clockwise steps from current Facing — 0 Forward,
// 1 Right, 2 Backward, 3 Left. Stand Around has neither; it's a true no-op.
export const BEHAVIORS = {
  standAround: { name: 'Stand Around' },
  moveForward: { name: 'Move Forward', kind: 'move', turn: 0 },
  moveRight: { name: 'Move Right', kind: 'move', turn: 1 },
  moveBackward: { name: 'Move Backward', kind: 'move', turn: 2 },
  moveLeft: { name: 'Move Left', kind: 'move', turn: 3 },
  wander: { name: 'Wander', kind: 'wander' }, // random direction; rolls like any other Behavior once KULOG is known
  face: { name: 'Face', kind: 'face' }, // turns to a random known Cardinal — sets Facing directly, not a relative turn
  teach: { name: 'Teach', kind: 'teach' }, // advances one active Script one Row (scripts.js); no-op with nothing queued
  maintainEmpower: { name: 'Maintain Empower' }, // no-op: Empower is Crafter-initiated (techniques.js), this just surfaces the inclination
  current: { name: 'Current' }, // no-op: same reasoning as Maintain Empower, Current is Crafter-initiated
  // Attack just flips the table into Combat (coarse, table-wide) — real staged
  // Fast Attack resolution waits on Locality-based Combat.
  attack: { name: 'Attack', kind: 'attack' }
};

// Each Category rolls independently every Round — a Character can Move AND
// take an Action in the same Round. All 3 are available from the start (not
// an Intelligence gate). Targeting has no Behaviors mapped yet.
export const BEHAVIOR_CATEGORY = {
  standAround: 'movement',
  moveForward: 'movement', moveRight: 'movement', moveBackward: 'movement', moveLeft: 'movement',
  wander: 'movement', face: 'movement',
  teach: 'actions', maintainEmpower: 'actions', current: 'actions', attack: 'actions'
};
export const BEHAVIOR_CATEGORIES = [
  { key: 'movement', label: 'Movement' },
  { key: 'actions', label: 'Actions' },
  { key: 'targeting', label: 'Targeting' }
];

// Which Behavior a remembered Glyph nudges toward. Not strictly 1:1 — a Glyph
// can plausibly suggest more than one Behavior later without breaking this shape.
export const GLYPH_BEHAVIOR = {
  'RO / OR': 'moveForward',
  'OP / PO': 'moveBackward',
  'OK': 'moveLeft',
  'KO': 'moveRight',
  'KULOG': 'wander',
  'KALAG': 'face',
  'SUU': 'standAround',
  'WIM': 'teach',
  'KA': 'maintainEmpower',
  'OG': 'current',
  'S': 'attack'
};

// Favorable/Middle/Disliked -> 2/1/0 units, so a never-tuned Mid/Mid memory
// still contributes something (a flat 0 let Stand Around's baseline always win).
const DESIRE_WEIGHT = [2, 1, 0];
function desireScore(entry){
  const desire = entry.desire ?? 1;
  return DESIRE_WEIGHT[desire] * DESIRE_SCORE_UNIT;
}

// Flat bonus on any remembered Glyph that's also the Behavior half of a
// Committed Plan Expression (personality.js's Plan section).
export const PLAN_WEIGHT = 25;

function pursuitScore(entry, planBonus){
  return Math.max(0, desireScore(entry) + (entry.longing || 0) + (planBonus || 0));
}

// Every Behavior Glyph flagged by a Committed Plan Expression, paired with
// whichever Target ref that row resolved. Known simplification: a row with
// more than one Targets-variety Glyph just takes whichever ref resolved last
// (fine for the common single-ref case; a real Actor/Target read isn't built).
function committedPlanInfo(actor){
  const plan = actor && actor.plan;
  const glyphs = new Set();
  const refByGlyph = {};
  if(plan && plan.committed && plan.rows){
    plan.committed.forEach((isCommitted, r) => {
      if(!isCommitted) return;
      const row = plan.rows[r] || [];
      let rowRef = null;
      row.forEach((g, s) => {
        const ref = plan.refs && plan.refs[r + '-' + s];
        if(ref != null) rowRef = ref;
      });
      row.forEach(g => {
        if(g && GLYPH_BEHAVIOR[g]){
          glyphs.add(g);
          if(rowRef && !(g in refByGlyph)) refByGlyph[g] = rowRef;
        }
      });
    });
  }
  return { glyphs, refByGlyph };
}

// Call once per remembered entry, once per Non-Combat Round. Separated builds
// Longing up, Connected drains it, Mid holds flat.
export function tickLonging(entry){
  const attachment = entry.attachment ?? 1;
  const current = entry.longing || 0;
  if(attachment === 2) entry.longing = Math.min(LONGING_CAP, current + LONGING_INCREMENT);
  else if(attachment === 0) entry.longing = Math.max(0, current - LONGING_INCREMENT);
}

// One { distribution, perGlyph } per Category — Glyphs only compete within
// their own Category. Movement keeps the Stand Around baseline so it always
// sums to 100; Actions/Targeting have no forced default and can come back empty.
export function computeBehaviors(actor){
  const mindeye = (actor && actor.mindeye) || [];
  const { glyphs: committedGlyphs, refByGlyph } = committedPlanInfo(actor);
  const result = {};

  BEHAVIOR_CATEGORIES.forEach(cat => {
    const behaviorPursuit = cat.key === 'movement' ? { standAround: STAND_AROUND_BASELINE } : {};
    const perGlyph = [];
    mindeye.forEach(entry => {
      const behaviorKey = entry.glyph && GLYPH_BEHAVIOR[entry.glyph];
      if(!behaviorKey || BEHAVIOR_CATEGORY[behaviorKey] !== cat.key) return;
      const planBonus = committedGlyphs.has(entry.glyph) ? PLAN_WEIGHT : 0;
      const pursuit = pursuitScore(entry, planBonus);
      behaviorPursuit[behaviorKey] = (behaviorPursuit[behaviorKey] || 0) + pursuit;
      perGlyph.push({
        entryId: entry.id, glyphId: entry.glyph, behaviorKey,
        behaviorName: BEHAVIORS[behaviorKey].name, pursuit, desire: desireScore(entry), longing: entry.longing || 0,
        plan: planBonus, ref: planBonus ? (refByGlyph[entry.glyph] || null) : null
      });
    });

    const hasAnyWeight = Object.keys(behaviorPursuit).length > 0;
    const total = Object.values(behaviorPursuit).reduce((a, b) => a + b, 0) || 1;
    const distribution = {};
    Object.entries(behaviorPursuit).forEach(([key, p]) => { distribution[key] = Math.round(p / total * 100); });
    if(hasAnyWeight && cat.key === 'movement'){
      const roundedSum = Object.values(distribution).reduce((a, b) => a + b, 0);
      if(roundedSum !== 100) distribution.standAround = (distribution.standAround || 0) + (100 - roundedSum);
    }
    perGlyph.forEach(g => { g.impactPct = Math.round(g.pursuit / total * 100); });

    result[cat.key] = { distribution, perGlyph };
  });

  return result;
}

// index 0 is Likely, index 1 (if present) is Runner Up.
export function sortedBehaviors(distribution){
  return Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .map(([key, pct]) => ({ key, name: BEHAVIORS[key].name, pct }));
}

// Real weighted random draw across the whole distribution — NOT always the
// highest-%. Returns null on an empty distribution (Actions/Targeting have no
// default to fall back to; resolveBehavior() decides what an empty roll means).
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

// Capped at 9 (3 Expressions x 3 Glyphs) or the Character's own AP, whichever
// is smaller.
export const BEHAVIOR_QUEUE_CAP = 9;

// Fills the whole Queue with one weighted draw per slot, from every Glyph
// across all 3 Categories at once. Repeat stacks a -1 penalty per prior draw
// this fill so one Behavior can't eat every slot — except Plan-flagged
// candidates, which are immune, so a Committed Expression can actually dominate.
export function fillBehaviorQueue(actor){
  const cap = Math.min(BEHAVIOR_QUEUE_CAP, (actor && actor.ap) || 0);
  if(cap <= 0) return [];
  const categories = computeBehaviors(actor);
  const pool = [];
  BEHAVIOR_CATEGORIES.forEach(cat => {
    categories[cat.key].perGlyph.forEach(g => {
      if(g.pursuit > 0) pool.push(g);
    });
  });
  if(!pool.length) return [];

  const repeatCount = {};
  const queue = [];
  for(let i = 0; i < cap; i++){
    const weighted = pool.map(c => {
      const repeats = repeatCount[c.glyphId] || 0;
      const penalty = c.plan ? 0 : repeats;
      return { c, weight: Math.max(0, c.pursuit - penalty) };
    }).filter(w => w.weight > 0);
    if(!weighted.length) break;
    const total = weighted.reduce((sum, w) => sum + w.weight, 0);
    let r = Math.random() * total;
    let picked = weighted[weighted.length - 1].c;
    for(const w of weighted){
      if(r < w.weight){ picked = w.c; break; }
      r -= w.weight;
    }
    repeatCount[picked.glyphId] = (repeatCount[picked.glyphId] || 0) + 1;
    queue.push({ glyph: picked.glyphId, ref: picked.ref || null });
  }
  return queue;
}
