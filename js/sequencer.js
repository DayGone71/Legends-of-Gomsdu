import { AppState } from './state.js';
import { escapeHtml, computeEntryTick, computeCounterMax, alliedActorIds, resolveEntityRef, possessedEnemyIds } from './utils.js';

// Matches the needle's own CSS animation-duration (sequencer-needle-sweep,
// css/layout.css) — kept as a JS constant rather than read from the DOM
// since nothing here needs to be dynamic, just consistent with that value.
const NEEDLE_SWEEP_MS = 6500;

// Twilight Milk — the Time Mechanic (2026-08-21), per dDd. The First/Second
// Era sky is permanent Twilight: Gom (a Black Hole) eats the light Yom/Star
// Father constantly feeds him, which for whatever reason reads as a milky
// haze to the Planet's inhabitants. Repurposes the Sequencer Bar's own 13
// tick positions (6 per Wing, the Orb as the 7th/center) as a literal
// globe-lighting model — table.timeTick (0-12, where the "light" currently
// sits) advances by one every Non-Combat Round (js/noncombat.js's
// resolveNonCombatRound()). Per dDd's own spec, neither a literal tick mark
// nor a needle renders here — the whole Wing background IS the display, and
// moving the (invisible) needle just changes how that background looks.
export const TWILIGHT_TICK_COUNT = 13;
export const TWILIGHT_CENTER_TICK = 6;
const TWILIGHT_DARK = [13, 10, 34];       // #0D0A22 — Gom's own black-hole dark, deeper than the app's usual ink
const TWILIGHT_BRIGHT = [243, 238, 255];  // #F3EEFF — the Milk itself: pale, faintly violet, never plain daylight-white

function mixColor(a, b, t){
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

// dDd's own instruction: "for opposite, use 26, cause globe physics." 13
// ticks is odd, so there's no exact integer opposite in 13-space (6.5 isn't
// a tick). Doubling to a 26-slot circle first fixes that cleanly — every
// tick's doubled coordinate is even, so its true antipode (+13 in 26-space)
// always lands on an odd number, i.e. exactly halfway between two OTHER
// ticks rather than forcing a rounding error onto one side. Brightness then
// falls off with a cosine curve (real sphere lighting: brightest at the
// sub-point, darkest at the antipode, smooth in between) — the same "globe
// physics" idea carried all the way through, not just the opposite-point math.
function twilightColorAt(tick, needleTick){
  const doubledDist = Math.abs(tick * 2 - needleTick * 2);
  const circDist = Math.min(doubledDist, TWILIGHT_TICK_COUNT * 2 - doubledDist); // 0..13
  const brightness = (Math.cos((circDist / TWILIGHT_TICK_COUNT) * Math.PI) + 1) / 2;
  return mixColor(TWILIGHT_DARK, TWILIGHT_BRIGHT, brightness);
}

function renderTwilightSky(){
  const leftWing = document.querySelector('.sequencer-divider-wing.left');
  const rightWing = document.querySelector('.sequencer-divider-wing.right');
  if(!leftWing || !rightWing) return;
  const table = AppState.table;
  const needleTick = (table && table.timeTick) ?? TWILIGHT_CENTER_TICK;

  const leftStops = [0, 1, 2, 3, 4, 5].map(i => twilightColorAt(i, needleTick));
  const rightStops = [7, 8, 9, 10, 11, 12].map(i => twilightColorAt(i, needleTick));
  leftWing.style.background = `linear-gradient(to right, ${leftStops.join(', ')})`;
  rightWing.style.background = `linear-gradient(to right, ${rightStops.join(', ')})`;
}

// Last-rendered events + scale, kept so the hover popover (mousemove-driven,
// not a render pass) can answer "what's near this cursor position" without
// recomputing the whole staged-actions gather on every mouse move.
let lastEvents = [];
let lastCounterMax = 1;

// A frozen snapshot of what just resolved, shown for the duration of the
// needle's sweep even though the real data (sequences, Ledger, Play-by-Play)
// already changed the instant Resolve was clicked — per dDd, the sweep is
// "for Human benefit," not something real state should ever wait on. Without
// this, computeStagedEvents() re-derives live off table.sequence every
// render, which resolveRound() clears synchronously — the sweep ended up
// animating across an already-empty divider. See freezeSequencerReveal().
let frozenEvents = null;
let frozenCounterMax = null;
let unfreezeTimer = null;

// Every staged action across every real actor — allies (Players + statted
// Mini-Party + Possessed Enemies, via alliedActorIds) and Enemies (table.
// enemies minus whichever are currently Possessed, since those already
// moved to the ally side above) — reduced to just what the divider's marks
// need: where it lands on the 0-counterMax scale, whose side it's on, and
// enough detail for the hover popover to describe it. Side is 'self' only
// for AppState.playerId itself; every other ally is 'ally'; the shape
// (\ vs /) only distinguishes friendly from hostile, so Self and Ally both
// render as \, just in different colors — see style-guide.md.
function computeStagedEvents(table, counterMax){
  const events = [];
  function gather(actor, side){
    if(!actor) return;
    const entryTick = computeEntryTick(actor.quickness, counterMax);
    let runningCost = 0;
    (actor.sequence || []).forEach(entry => {
      runningCost += entry.apCost;
      events.push({
        tick: Math.max(0, entryTick - runningCost),
        side,
        actorName: actor.name || 'Someone',
        actionLabel: entry.actionLabel || '',
        targetLabel: entry.targetLabel || ''
      });
    });
  }
  alliedActorIds(table).forEach(id => {
    gather(resolveEntityRef(table, id), id === AppState.playerId ? 'self' : 'ally');
  });
  const possessed = possessedEnemyIds(table);
  Object.entries(table.enemies || {}).forEach(([id, e]) => {
    if(possessed.has(id)) return;
    gather(e, 'enemy');
  });
  return events;
}

// The needle/reveal sweep — a single JS clock (elapsed ms, 0..NEEDLE_SWEEP_MS)
// driven by requestAnimationFrame, rather than a CSS @keyframes animation.
// That's what makes it interactively jumpable: applySweepFrame(t) is a pure
// function of "how far in are we," so jumping is just changing t and
// re-applying — no animation state to fight, and no risk of drift between
// the needle's position and which marks are supposed to be visible yet.
let sweep = null; // { startRef } — elapsed is always (now - startRef)

function computeMoments(){
  const set = new Set();
  document.querySelectorAll('.seq-reveal[data-reveal-at]').forEach(el => {
    set.add(Number(el.dataset.revealAt));
  });
  return Array.from(set).sort((a, b) => a - b);
}

function applySweepFrame(elapsedMs){
  const t = Math.max(0, Math.min(NEEDLE_SWEEP_MS, elapsedMs));
  const frac = t / NEEDLE_SWEEP_MS;
  const needleEl = document.querySelector('.sequencer-needle');
  if(needleEl){
    needleEl.style.left = ((1 - frac) * 100) + '%';
    needleEl.style.opacity = frac >= 0.95 ? String(Math.max(0, 1 - (frac - 0.95) / 0.05)) : '1';
  }
  document.querySelectorAll('.seq-reveal').forEach(el => {
    const at = Number(el.dataset.revealAt || 0);
    el.style.opacity = t >= at ? '1' : '0';
  });
}

function sweepTick(now){
  if(!sweep) return;
  const elapsed = now - sweep.startRef;
  applySweepFrame(elapsed);
  if(elapsed >= NEEDLE_SWEEP_MS){
    sweep = null;
    return;
  }
  requestAnimationFrame(sweepTick);
}

// Called once per Sequence Round (from resolveRound() in combat.js). Hides
// every reveal-tagged element first (they default to visible outside an
// active sweep — see renderSequencerDivider — so this is what gives the
// reveal something to reveal *from*), then starts the clock at 0.
function startSweep(){
  const needleEl = document.querySelector('.sequencer-needle');
  if(needleEl) needleEl.style.opacity = '1';
  applySweepFrame(0);
  sweep = { startRef: performance.now() };
  requestAnimationFrame(sweepTick);
}

// Jumping only ever moves forward (Moment-jump / skip-to-end are both
// forward-only per dDd's spec) — re-basing startRef is what lets the rAF
// loop above just keep going from the new position with no special-casing.
function jumpSweepTo(elapsedMs){
  if(!sweep) return;
  const clamped = Math.max(0, Math.min(NEEDLE_SWEEP_MS, elapsedMs));
  sweep.startRef = performance.now() - clamped;
  applySweepFrame(clamped);
  if(clamped >= NEEDLE_SWEEP_MS) sweep = null;
}

function jumpToNextMoment(){
  if(!sweep) return;
  const elapsed = performance.now() - sweep.startRef;
  const moments = computeMoments();
  const next = moments.find(m => m > elapsed + 10);
  jumpSweepTo(next !== undefined ? next : NEEDLE_SWEEP_MS);
}

function jumpToEnd(){
  jumpSweepTo(NEEDLE_SWEEP_MS);
}

// Click = jump to the next Moment (wherever an Action plays out); click-and-
// hold = jump straight to the end. Attached to the divider/marks/drops, same
// elements the hover popover uses. A no-op outside an active sweep.
function initSequencerScrubEl(el){
  let holdTimer = null;
  let held = false;
  el.addEventListener('mousedown', () => {
    held = false;
    holdTimer = setTimeout(() => { held = true; jumpToEnd(); }, 350);
  });
  el.addEventListener('mouseup', () => {
    clearTimeout(holdTimer);
    if(!held) jumpToNextMoment();
  });
  el.addEventListener('mouseleave', () => clearTimeout(holdTimer));
}

export function initSequencerScrub(){
  ['sequencer-divider', 'sequencer-marks', 'sequencer-blood-drops'].forEach(id => {
    const el = document.getElementById(id);
    if(el) initSequencerScrubEl(el);
  });
}

// Called from resolveRound() in combat.js — BEFORE it clears every actor's
// sequence — with the table/counterMax as they stood right before that
// clear. Snapshots the events, plays the needle+reveal off that snapshot,
// then un-freezes on a real wall-clock timer (not tied to any animation
// callback) so the divider reliably reverts to live state exactly when the
// sweep visually finishes, even if nothing else happens to trigger a
// re-render in the meantime (or if the sweep got skipped to the end early).
export function freezeSequencerReveal(table, counterMax){
  frozenEvents = computeStagedEvents(table, counterMax);
  frozenCounterMax = counterMax;
  clearTimeout(unfreezeTimer);
  unfreezeTimer = setTimeout(() => {
    frozenEvents = null;
    frozenCounterMax = null;
    renderSequencer();
  }, NEEDLE_SWEEP_MS + 400);
  startSweep();
}

// Start-of-Encounter lightning flourish — dDd's spec: a random 0-3 bolts
// coiling out to the left and 0-3 to the right from the AP circle (never
// both zero — one side gets forced if the dice come up empty), each one a
// horizontal midpoint-displacement path biased to jitter vertically rather
// than horizontally, which is what reads as "coiling around the needle"
// rather than a straight strike. Reuses the landing page Lightning box's
// glow/flicker CSS classes (see css/layout.css) for a consistent look, but
// the path-building here is its own small copy rather than importing from
// main.js — main.js's version is explicitly a "no game state" art toy, and
// this one is wired to a real state transition, so keeping them separate
// avoids tangling a sandbox module into game logic.
const SEQ_SVG_NS = 'http://www.w3.org/2000/svg';

function coiledPoints(x1, y1, x2, y2, depth, displace, out){
  if(depth <= 0){ out.push([x2, y2]); return; }
  const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * displace * 0.4;
  const my = (y1 + y2) / 2 + (Math.random() - 0.5) * displace;
  coiledPoints(x1, y1, mx, my, depth - 1, displace * 0.6, out);
  coiledPoints(mx, my, x2, y2, depth - 1, displace * 0.6, out);
}
function buildCoiledPath(x1, y1, x2, y2, depth, displace){
  const out = [[x1, y1]];
  coiledPoints(x1, y1, x2, y2, depth, displace, out);
  return out;
}
function coiledPathD(points){
  return 'M' + points.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L ');
}

function spawnSequencerBolt(container, circleX, circleY, badgeRadius, dir){
  const w = container.clientWidth, h = container.clientHeight;
  if(!w || !h) return;
  const svg = document.createElementNS(SEQ_SVG_NS, 'svg');
  svg.setAttribute('class', 'lightning-bolt-svg lightning-flash');
  svg.setAttribute('width', w);
  svg.setAttribute('height', h);
  svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

  // Start at the circle's own rim on the strand's own side, not its dead
  // center — dDd's catch: starting at center reads as passing *through*
  // the circle rather than emanating from it.
  const originX = circleX + dir * badgeRadius;
  const originY = circleY;
  // Tripled from the original 0.14-0.44 range per dDd ("at least 3 times
  // as long") — clamped against the divider's own edges below either way.
  const travel = (w / 2) * (0.42 + Math.random() * 0.9);
  const endX = Math.min(w - 4, Math.max(4, originX + dir * travel));
  const endY = Math.min(h - 2, Math.max(2, originY + (Math.random() - 0.5) * h * 0.6));
  const displace = 8 + Math.random() * 10;
  const depth = 3 + Math.floor(Math.random() * 2);
  const points = buildCoiledPath(originX, originY, endX, endY, depth, displace);

  const g = document.createElementNS(SEQ_SVG_NS, 'g');
  g.setAttribute('class', 'lightning-bolt');
  g.style.setProperty('--glow-scale', (0.65 + Math.random() * 0.5).toFixed(2));

  const core = document.createElementNS(SEQ_SVG_NS, 'path');
  core.setAttribute('d', coiledPathD(points));
  core.setAttribute('class', 'lightning-core');
  core.setAttribute('stroke-width', (1 + Math.random()).toFixed(2));
  g.appendChild(core);

  if(Math.random() < 0.5 && points.length > 2){
    const idx = 1 + Math.floor(Math.random() * (points.length - 2));
    const [bx, by] = points[idx];
    const branchDir = Math.random() < 0.5 ? -1 : 1;
    const bx2 = bx + dir * travel * 0.2;
    const by2 = by + branchDir * h * 0.3;
    const bPoints = buildCoiledPath(bx, by, bx2, by2, Math.max(2, depth - 1), displace * 0.7);
    const branch = document.createElementNS(SEQ_SVG_NS, 'path');
    branch.setAttribute('d', coiledPathD(bPoints));
    branch.setAttribute('class', 'lightning-core lightning-branch');
    branch.setAttribute('stroke-width', '0.9');
    g.appendChild(branch);
  }

  svg.appendChild(g);
  const dur = 420 + Math.random() * 460;
  svg.style.setProperty('--bolt-dur', dur.toFixed(0) + 'ms');
  container.appendChild(svg);

  svg.addEventListener('animationend', () => svg.remove());
  setTimeout(() => svg.remove(), dur + 400);
}

function flourishEncounterStart(){
  const container = document.getElementById('sequencer-bolts');
  const badge = document.getElementById('sequencer-ap-badge');
  if(!container || !badge) return;
  const cRect = container.getBoundingClientRect();
  const bRect = badge.getBoundingClientRect();
  const circleX = bRect.left + bRect.width / 2 - cRect.left;
  const circleY = bRect.top + bRect.height / 2 - cRect.top;
  const badgeRadius = bRect.width / 2;

  // At least 1 per side every time, per dDd ("that way, there are always at
  // least a few sparks") — up to 3, never 0.
  const leftCount = 1 + Math.floor(Math.random() * 3); // 1-3
  const rightCount = 1 + Math.floor(Math.random() * 3); // 1-3

  const strands = [];
  for(let i = 0; i < leftCount; i++) strands.push(-1);
  for(let i = 0; i < rightCount; i++) strands.push(1);
  strands.forEach(dir => {
    setTimeout(() => spawnSequencerBolt(container, circleX, circleY, badgeRadius, dir), Math.random() * 220);
  });
}

// Fires flourishEncounterStart() exactly once per genuine false->true
// transition of table.inEncounter — not per render, and not on page load
// into an already-live Encounter (wasInEncounter starts null specifically
// so the very first observation never counts as "just started"). Driven
// off the real synced state rather than the Start button's own click
// handler so every connected player sees the flourish, including whoever
// didn't click Start themselves.
let wasInEncounter = null;
function noteEncounterState(nowInEncounter){
  if(wasInEncounter === false && nowInEncounter === true) flourishEncounterStart();
  wasInEncounter = nowInEncounter;
}

function revealAtMs(fracFromRight){
  // fracFromRight: 0 = at the "100" end (right), 1 = at the "0" end (left) —
  // matches how far into the needle's right-to-left sweep this position sits.
  return Math.round(fracFromRight * NEEDLE_SWEEP_MS);
}

// The divider's wedge shape never changes — only the tick density behind it,
// the slashes on top of it, the 5 fixed measurement marks below it, the
// Blood Drops below that, and the moving needle, all scaled to / gated on
// the current Encounter (left edge = 0, right edge = counterMax). All of
// them go blank/hidden outside a live Encounter, same as the badge in the
// divider's own circle.
function renderSequencerDivider(table, counterMax, events, replaying){
  const dividerEl = document.getElementById('sequencer-divider');
  const ticksEl = document.getElementById('sequencer-divider-ticks');
  const slashesEl = document.getElementById('sequencer-divider-slashes');
  const marksEl = document.getElementById('sequencer-marks');
  const dropsEl = document.getElementById('sequencer-blood-drops');
  const needleEl = document.querySelector('.sequencer-needle');
  const inEncounter = !!(table && table.inEncounter);
  if(needleEl) needleEl.classList.toggle('hidden', !inEncounter);
  // Scrub cursor (pointer/crosshair) only when there's actually a live
  // Encounter to scrub — dDd's catch: it was showing all the time, even
  // with nothing on the divider to click through.
  if(dividerEl) dividerEl.classList.toggle('seq-scrubbable', inEncounter);
  if(marksEl) marksEl.classList.toggle('seq-scrubbable', inEncounter);
  if(dropsEl) dropsEl.classList.toggle('seq-scrubbable', inEncounter);

  if(ticksEl){
    if(!inEncounter){
      ticksEl.innerHTML = '';
    }else{
      let html = '';
      for(let t = 0; t <= counterMax; t++){
        const isMajor = (t % 5 === 0) || (t === 0) || (t === counterMax);
        if(!isMajor && counterMax > 30 && t % 2 !== 0) continue;
        const pct = (t / counterMax) * 100;
        html += '<div class="sequencer-divider-tick seq-reveal' + (isMajor ? ' major' : '') +
          '" style="left:' + pct + '%;" data-reveal-at="' + revealAtMs(1 - t / counterMax) + '"></div>';
      }
      ticksEl.innerHTML = html;
    }
  }

  // Slash visibility (2026-08-16, Veil Vision): Player/Ally are always
  // visible — staged, mid-resolve, always. Enemy is fog-of-war by default:
  // hidden entirely while staging (unless Veil Vision is on), then reveals
  // at its own Moment during the resolve sweep — a genuine first appearance,
  // so it gets the normal seq-reveal fade-in treatment. With Veil Vision on,
  // Enemy was already visible during staging, so it gets the same
  // no-vanish, always-visible treatment as Player/Ally instead — dDd's own
  // "the same rule applies to Enemy Slashes" spec. The seq-reveal class
  // (and its data-reveal-at) is only ever attached when a slash actually
  // needs the timed fade-in; everything else renders as a plain always-on
  // .seq-slash with no reveal gating, so applySweepFrame() (which only
  // touches .seq-reveal elements) never touches it.
  if(slashesEl){
    if(!inEncounter){
      slashesEl.innerHTML = '';
    }else{
      let html = '';
      events.forEach(ev => {
        const isEnemy = ev.side === 'enemy';
        if(isEnemy && !replaying && !AppState.veilVision) return; // fog of war while staging
        const timedReveal = replaying && isEnemy && !AppState.veilVision;
        const pct = (ev.tick / counterMax) * 100;
        const angle = isEnemy ? 32 : -32;
        const cls = 'seq-slash ' + ev.side + (timedReveal ? ' seq-reveal' : '');
        const revealAttr = timedReveal ? ' data-reveal-at="' + revealAtMs(1 - ev.tick / counterMax) + '"' : '';
        html += '<div class="' + cls + '" style="left:' + pct + '%; --slash-angle:' + angle + 'deg;"' + revealAttr + '></div>';
      });
      slashesEl.innerHTML = html;
    }
  }

  if(marksEl){
    if(!inEncounter){
      marksEl.innerHTML = '';
    }else{
      let html = '';
      [0, 0.25, 0.5, 0.75, 1].forEach(frac => {
        const val = Math.round(counterMax * frac);
        html += '<div class="sequencer-mark seq-reveal" style="left:' + (frac * 100) + '%;" data-reveal-at="' + revealAtMs(1 - frac) + '">' +
          '<div class="sequencer-mark-tick"></div>' +
          '<div class="sequencer-mark-label">' + val + '</div></div>';
      });
      marksEl.innerHTML = html;
    }
  }

  // Blood Drops are an aftermath layer, not a staging preview — dDd: "not
  // visible in staging," only appearing during the actual resolve sweep,
  // fading in slowly (see .seq-drop.seq-reveal's own transition in
  // css/layout.css) at each one's own Moment. Unaffected by Veil Vision —
  // blood doesn't care whether you could see the intent coming.
  if(dropsEl){
    if(!replaying || !events.length){
      dropsEl.innerHTML = '';
    }else{
      const buckets = new Map();
      events.forEach(ev => {
        const bt = Math.round(ev.tick);
        buckets.set(bt, (buckets.get(bt) || 0) + 1);
      });
      const ticks = Array.from(buckets.keys()).sort((a, b) => a - b);
      let html = '';
      ticks.forEach((t, i) => {
        const count = buckets.get(t);
        const pct = (t / counterMax) * 100;
        const row = i % 3;
        const size = Math.min(18, 6 + count * 2.4);
        const top = row * 12 + 2;
        html += '<div class="seq-drop seq-reveal" style="left:' + pct + '%; top:' + top + 'px; width:' + size +
          'px; height:' + size + 'px;" data-reveal-at="' + revealAtMs(1 - t / counterMax) + '"></div>';
      });
      dropsEl.innerHTML = html;
    }
  }
}

// Hover popover — a plain informational tooltip, not true optical
// magnification (see css/layout.css's comment on .sequencer-hover-popover
// for why that scope call got made). Shared across the divider/marks/drops
// elements since they all use the identical 0-counterMax coordinate space
// at the same width, so one handler works for any of them.
function initSequencerHoverEl(el, popover){
  el.addEventListener('mousemove', e => {
    if(!lastEvents.length) { popover.classList.add('hidden'); return; }
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const hoverTick = frac * lastCounterMax;
    const tolerance = Math.max(1, lastCounterMax * 0.03);
    const nearby = lastEvents.filter(ev => Math.abs(ev.tick - hoverTick) <= tolerance);
    if(!nearby.length){ popover.classList.add('hidden'); return; }
    popover.innerHTML = nearby.slice(0, 12).map(ev =>
      '<div class="sequencer-hover-popover-row ' + ev.side + '">' +
        escapeHtml(ev.actorName) + ' — ' + escapeHtml(ev.actionLabel) +
        (ev.targetLabel ? ' → ' + escapeHtml(ev.targetLabel) : '') +
      '</div>'
    ).join('');
    popover.style.left = (e.clientX + 14) + 'px';
    popover.style.top = (e.clientY + 14) + 'px';
    popover.classList.remove('hidden');
  });
  el.addEventListener('mouseleave', () => popover.classList.add('hidden'));
}

export function initSequencerHover(){
  const popover = document.getElementById('sequencer-hover-popover');
  if(!popover) return;
  ['sequencer-divider', 'sequencer-marks', 'sequencer-blood-drops'].forEach(id => {
    const el = document.getElementById(id);
    if(el) initSequencerHoverEl(el, popover);
  });
}

// The old boxed "Your actions"/"Enemy actions" lane display (#sequencer-shell,
// a placeholder-or-live box between Blood Drops and the Map) is gone —
// removed 2026-08-16 (CC5) as redundant bloat once the divider's own
// slashes + Blood Drops took over showing staged actions, and to condense
// the screen. This function is now just the divider/badge driver.
export function renderSequencer(){
  renderTwilightSky();
  const badge = document.getElementById('sequencer-ap-badge');
  const table = AppState.table;
  if(!table){
    noteEncounterState(false);
    if(badge) badge.textContent = '';
    lastEvents = [];
    lastCounterMax = 1;
    renderSequencerDivider(null, 1, [], false);
    return;
  }
  noteEncounterState(!!table.inEncounter);

  const liveCounterMax = computeCounterMax(table);
  const replaying = !!frozenEvents;
  const counterMax = replaying ? frozenCounterMax : liveCounterMax;
  const events = replaying ? frozenEvents : (table.inEncounter ? computeStagedEvents(table, liveCounterMax) : []);
  if(badge){
    if(table.inEncounter || replaying){
      badge.textContent = String(counterMax);
    }else{
      // Non-Combat Round (2026-08-21) — the Orb still has a job outside
      // Combat: showing how many Orders the viewing Player currently has
      // stacked, waiting on the next Resolve. Inlined rather than importing
      // js/noncombat.js, which itself imports js/combat.js — that would
      // circle straight back to this file (combat.js already imports
      // freezeSequencerReveal from here).
      const me = table.players && table.players[AppState.playerId];
      const orderCount = (me && me.orders && me.orders.length) || 0;
      badge.textContent = orderCount ? String(orderCount) : '';
    }
  }
  // The hover popover has to respect the same fog-of-war rule as the
  // slashes themselves — otherwise hovering blank space where a hidden
  // Enemy slash *would* be still leaks its name/action through the
  // tooltip. Blood Drops (rendered from the full unfiltered `events`
  // below) are unaffected, same as their own visibility rule.
  lastEvents = events.filter(ev => ev.side !== 'enemy' || replaying || AppState.veilVision);
  lastCounterMax = counterMax;
  renderSequencerDivider(table, counterMax, events, replaying);
}
