// The Personality Panel — one Glyph-list-driven layout replacing what used
// to be 3 separate Pillars (Information/Personality/Relationships), each
// duplicating its own Glyph Gallery.
//   Left:   a Glyph list (Memory-state Filters above it), grouped by the
//           Variety Categories (Directions/Targets/Actions/Ideas), stacking vertically.
//   Right:  Behavior Information (incl. the Active Plan) / Personality
//           Stats / Relationship details, stacked.
//   Bottom: detail on whichever Glyph is currently highlighted (Emotion
//           Axes, notes on how it affects an Axis, associated Crafts/
//           Powers) — clicking a Glyph on the left highlights it.
// "All the Math should be visible" — the Behavior section shows
// Desire/Longing/Pursuit broken out, not just a rolled percentage.

import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { getIntelligence, mindeyeCapacity, INTELLIGENCE_DEFAULT, escapeHtml, resolveEntityRef, mindeyeCategory, allCharacterRoster } from './utils.js';
import { computeBehaviors, sortedBehaviors, BEHAVIOR_CATEGORIES, BEHAVIOR_QUEUE_CAP, fillBehaviorQueue } from './behaviors.js';
import { compositionCardHtml, renderGlyphColumn, getSelectedGlyphEntryId, myMindeye, entryGlyphMarkup, entryGlyphName, lookupGlyph, varietyOf } from './information.js';
import { renderAxis } from './relationships.js';
import { glyphOptionsHtml } from './techniques.js';

function myCharacterId(){
  return AppState.inspectTargetId || AppState.playerId;
}
function myCharacter(){
  return resolveEntityRef(AppState.table, myCharacterId());
}
function inspecting(){
  return !!AppState.inspectTargetId;
}

// Which single Category (if any) the left Glyph list is narrowed to.
// Local UI state, same pattern as information.js's own originExpanded/selectedGlyphEntryId.
let memoryFilter = null;
const MEMORY_FILTERS = ['Fleeting', 'Retained', 'Known', 'Perfected'];

function filterBarHtml(){
  const all = '<button class="glyph-filter-btn' + (!memoryFilter ? ' active' : '') + '" data-filter="">All</button>';
  const rest = MEMORY_FILTERS.map(f =>
    '<button class="glyph-filter-btn' + (memoryFilter === f ? ' active' : '') + '" data-filter="' + f + '">' + f + '</button>'
  ).join('');
  return '<div class="glyph-filter-bar">' + all + rest + '</div>';
}

async function toggleSuppressSubconscious(){
  const me = myCharacter();
  if(!me) return;
  const id = AppState.inspectTargetId || AppState.playerId;
  await mutateTable(t => {
    const actor = resolveEntityRef(t, id);
    if(actor) actor.suppressSubconscious = !actor.suppressSubconscious;
  });
}

async function toggleWorkTowardsPlan(){
  const me = myCharacter();
  if(!me) return;
  const id = AppState.inspectTargetId || AppState.playerId;
  await mutateTable(t => {
    const actor = resolveEntityRef(t, id);
    if(actor) actor.workTowardsPlan = !actor.workTowardsPlan;
  });
}

async function toggleTeachMode(){
  const me = myCharacter();
  if(!me) return;
  const id = AppState.inspectTargetId || AppState.playerId;
  const next = (me.teachMode === 'parallel') ? 'sequential' : 'parallel';
  await mutateTable(t => {
    const actor = resolveEntityRef(t, id);
    if(actor) actor.teachMode = next;
  });
}

// Plan: 3 Expression slots the Character is actively trying to fulfill —
// e.g. `WIM KROW` ("I Teach them") down to `KROW WIM KROW` ("they Teach
// them"), 2 or 3 Glyphs each. Role isn't fixed by slot position — it's read
// off each Glyph's own Variety (information.js's varietyOf()): an
// Actions-variety Glyph is the Behavior; a Targets-variety Glyph is a
// Character reference, disambiguated inline with a "who does this
// represent?" picker next to it. Deliberately not wired into Behavior
// resolution yet — the AP-draining Behavior loop and the literacy/
// misunderstanding layer are both bigger, separate builds; this just gets Plan real, storable, editable state.
//
// Slot interaction is a real port of language/gomsdu-glyph-arranger.html's
// own popup mechanic, not Write Script's always-visible selects (that's
// where the "always defaults to RO" bug came from: slot 0 there never gets
// an empty option, so an untouched select just shows the browser's own
// first-in-list default while the real stored value stays null). A slot
// starts blank; clicking it (`openPlanSlot`, local-only UI state, same
// pattern as memoryFilter above) swaps it for a real `<select>` — choosing a
// Glyph or the select's own blur (Cancel, no change) both close it back to a plain icon/blank box.
const PLAN_ROWS = 3, PLAN_SLOTS = 3;
let openPlanSlot = null; // { r, s } — which Plan slot currently shows its picker
function emptyPlan(){
  return { rows: [[null, null, null], [null, null, null], [null, null, null]], refs: {}, committed: [false, false, false] };
}
function planOf(me){
  const plan = me.plan || emptyPlan();
  if(!plan.committed) plan.committed = [false, false, false];
  return plan;
}

async function setPlanGlyph(r, s, glyphId){
  const id = AppState.inspectTargetId || AppState.playerId;
  await mutateTable(t => {
    const actor = resolveEntityRef(t, id);
    if(!actor) return;
    if(!actor.plan) actor.plan = emptyPlan();
    actor.plan.rows[r][s] = glyphId || null;
    if(!glyphId) delete actor.plan.refs[r + '-' + s];
  });
}

async function setPlanRef(r, s, refId){
  const id = AppState.inspectTargetId || AppState.playerId;
  await mutateTable(t => {
    const actor = resolveEntityRef(t, id);
    if(!actor) return;
    if(!actor.plan) actor.plan = emptyPlan();
    actor.plan.refs[r + '-' + s] = refId || null;
  });
}

// Live, on demand — same as computeBehaviors()'s Likely/Runner-Up numbers
// below, not stored table state. What resolveBehavior() (noncombat.js) acts
// on each Round is its own fresh computation off the same function; this is
// "what it would look like right now," visible any time, not just the
// instant after a Resolve happens to leave something undrained.
function queueOf(me){
  return fillBehaviorQueue(me);
}

// Commit: a Character's own declaration that a given Expression is real
// intent, not just a draft mid-edit. Toggling it flags (or unflags) that
// Expression's Behavior Glyph(s) for the Plan weight (behaviors.js's
// PLAN_WEIGHT) — the Queue preview above picks this up automatically on its
// own next render, nothing to regenerate/store here.
async function togglePlanCommit(r){
  const id = AppState.inspectTargetId || AppState.playerId;
  await mutateTable(t => {
    const actor = resolveEntityRef(t, id);
    if(!actor) return;
    if(!actor.plan) actor.plan = emptyPlan();
    if(!actor.plan.committed) actor.plan.committed = [false, false, false];
    actor.plan.committed[r] = !actor.plan.committed[r];
  });
}

function planSlotHtml(plan, r, s){
  const glyphId = plan.rows[r][s];
  const isOpen = openPlanSlot && openPlanSlot.r === r && openPlanSlot.s === s;
  if(isOpen){
    return '<select class="write-glyph-select plan-glyph-select" data-row="' + r + '" data-slot="' + s + '">' +
      glyphOptionsHtml(true, glyphId) + '</select>';
  }
  const body = glyphId ? compositionCardHtml([[glyphId]]) : '<div class="plan-slot-empty">—</div>';
  return '<div class="plan-slot" data-row="' + r + '" data-slot="' + s + '">' + body + '</div>';
}

function planExpressionColumnHtml(selfId, plan, r){
  const roster = allCharacterRoster(AppState.table);
  const slotsHtml = Array.from({ length: PLAN_SLOTS }).map((_, s) => {
    const glyphId = plan.rows[r][s];
    const slotHtml = planSlotHtml(plan, r, s);
    if(!glyphId || varietyOf(glyphId) !== 'targets'){
      // Reserved, invisible spacer — the 3 Expression columns are
      // independent flex stacks, so a ref-select appearing in one but not
      // another used to push that column's Commit button out of line with
      // its neighbors. Every slot now always claims the same height whether or not it needs the picker.
      return slotHtml + '<div class="write-ref-select plan-ref-spacer" aria-hidden="true"></div>';
    }
    const refId = plan.refs[r + '-' + s] ?? selfId;
    const refOptions = roster.map(c =>
      '<option value="' + c.id + '"' + (c.id === refId ? ' selected' : '') + '>' + escapeHtml(c.id === selfId ? c.name + ' (self)' : c.name) + '</option>'
    ).join('');
    return slotHtml + '<select class="write-ref-select plan-ref-select" data-row="' + r + '" data-slot="' + s + '">' + refOptions + '</select>';
  }).join('');
  const committed = !!plan.committed[r];
  return '<div class="write-expression-column">' +
    '<div class="write-expression-label">Expression ' + (r + 1) + '</div>' +
    slotsHtml +
    '<button class="btn-ghost btn-small plan-commit-btn' + (committed ? ' active' : '') + '" data-row="' + r + '">' +
      (committed ? 'Committed' : 'Commit') +
    '</button>' +
  '</div>';
}

function planHtml(me){
  const teachMode = me.teachMode === 'parallel' ? 'parallel' : 'sequential';
  const scripts = me.activeScripts || [];
  const scriptsHtml = scripts.length
    ? scripts.map(script =>
        '<div class="script-slot">' +
          '<div class="script-status-line">Target: ' + escapeHtml(script.targetName || '?') + '</div>' +
          '<div class="script-status-line">Progress: Expression ' + (script.nextRow + 1) + ' / ' + script.rows.length + '</div>' +
          compositionCardHtml(script.rows, { nextRowIndex: script.nextRow }) +
        '</div>'
      ).join('')
    : '<div class="log-empty">No active Scripts.</div>';

  const plan = planOf(me);
  const columnsHtml = Array.from({ length: PLAN_ROWS }).map((_, r) => planExpressionColumnHtml(myCharacterId(), plan, r)).join('');

  return '<div class="stat-header">Plan</div>' +
    '<div class="write-expression-grid">' + columnsHtml + '</div>' +
    '<div class="personality-axis">' +
      '<div class="personality-axis-name">Teach Mode</div>' +
      '<button class="btn-ghost btn-small' + (teachMode === 'parallel' ? ' active' : '') + '" id="personality-teach-mode-toggle" title="Click to switch modes">' +
        (teachMode === 'parallel' ? '↓ Parallel' : '→ Sequential') +
      '</button>' +
    '</div>' +
    '<div class="personality-axis">' +
      '<div class="personality-axis-name">Active Scripts (' + scripts.length + ' / 3)</div>' +
      scriptsHtml +
    '</div>';
}

// Behavior Queue display — chips flow like the Active Character Display's
// own Name+Stats line: a compact flow of items, 3 per line by the Queue's
// own 3-Glyphs-per-Expression shape. Always all 3 rows.
function behaviorQueueHtml(me){
  const queue = queueOf(me);
  const slotsHtml = Array.from({ length: BEHAVIOR_QUEUE_CAP }).map((_, i) => {
    const item = queue[i];
    return '<div class="behavior-queue-slot">' + (item ? compositionCardHtml([[item.glyph]]) : '') + '</div>';
  }).join('');
  return '<div class="behavior-queue">' +
    '<div class="behavior-queue-label">Behavior Queue (' + queue.length + ' / ' + BEHAVIOR_QUEUE_CAP + ')</div>' +
    '<div class="behavior-queue-grid">' + slotsHtml + '</div>' +
  '</div>';
}

function behaviorTermHtml(name, value){
  return '<span class="behavior-term"><span class="behavior-term-name">' + name + '</span><span class="behavior-term-value">' + value + '</span></span>';
}

// Each Glyph row shows Desire, Longing, and the Pursuit they combine into,
// not just the final rolled percentage. A second row breaks that math down
// further: Desire + Longing + Plan + Repeat = Pursuit. Plan is real
// (behaviors.js's PLAN_WEIGHT, +25 whenever this Glyph is part of a
// Committed Plan Expression) and folded into Pursuit itself. Repeat stays a
// flat 0 here — it's a -1-per-repeat penalty that only exists mid-fill
// (behaviors.js's fillBehaviorQueue()), nothing to show on this static, pre-fill snapshot.
function behaviorsHtml(me){
  const categories = computeBehaviors(me);

  const columns = BEHAVIOR_CATEGORIES.map(cat => {
    const { distribution, perGlyph } = categories[cat.key];
    const ranked = sortedBehaviors(distribution);
    const likely = ranked[0];
    const runnerUp = ranked[1];

    const glyphRows = perGlyph.length
      ? perGlyph.map(g =>
          '<div class="behavior-glyph-item">' +
            '<div class="behavior-glyph-row">' +
              '<span class="behavior-glyph-id">' + escapeHtml(g.glyphId) + '</span>' +
              '<span class="behavior-glyph-assoc">' + escapeHtml(g.behaviorName) + '</span>' +
              '<span class="behavior-glyph-math" title="Desire + Longing + Plan = Pursuit">' + g.desire + ' + ' + g.longing + (g.plan ? ' + ' + g.plan : '') + ' = ' + g.pursuit + '</span>' +
              '<span class="behavior-glyph-pct">' + g.impactPct + '%</span>' +
            '</div>' +
            '<div class="behavior-glyph-detail-row">' +
              behaviorTermHtml('Desire', g.desire) +
              '<span class="behavior-term-op">+</span>' +
              behaviorTermHtml('Longing', g.longing) +
              '<span class="behavior-term-op">+</span>' +
              behaviorTermHtml('Plan', g.plan) +
              '<span class="behavior-term-op">+</span>' +
              behaviorTermHtml('Repeat', 0) +
              '<span class="behavior-term-op">=</span>' +
              behaviorTermHtml('Pursuit', g.pursuit) +
            '</div>' +
          '</div>'
        ).join('')
      : '<div class="log-empty">Nothing yet.</div>';

    return '<div class="behavior-column">' +
      '<div class="behavior-column-label">' + escapeHtml(cat.label) + '</div>' +
      '<div class="behavior-summary">' +
        '<div class="behavior-summary-col">' +
          '<div class="behavior-summary-label">Likely</div>' +
          '<div class="behavior-summary-value">' + (likely ? escapeHtml(likely.name) : '—') + '</div>' +
          '<div class="behavior-summary-pct">' + (likely ? likely.pct + '%' : '') + '</div>' +
        '</div>' +
        '<div class="behavior-summary-col">' +
          '<div class="behavior-summary-label">Runner Up</div>' +
          '<div class="behavior-summary-value">' + (runnerUp ? escapeHtml(runnerUp.name) : '—') + '</div>' +
          '<div class="behavior-summary-pct">' + (runnerUp ? runnerUp.pct + '%' : '') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="behavior-glyph-list">' + glyphRows + '</div>' +
    '</div>';
  }).join('');

  const suppressed = !!me.suppressSubconscious;
  const workingPlan = !!me.workTowardsPlan;
  return '<div class="stat-header">Behaviors</div><div class="behavior-columns">' + columns + '</div>' +
    '<div class="behavior-toggles-row">' +
      '<div class="behavior-toggles-col">' +
        '<button class="btn-ghost btn-small behavior-toggle-btn' + (suppressed ? ' active' : '') + '" id="personality-suppress-toggle">Suppress Subconscious</button>' +
        '<button class="btn-ghost btn-small behavior-toggle-btn' + (workingPlan ? ' active' : '') + '" id="personality-work-plan-toggle">Work towards Plan</button>' +
      '</div>' +
      behaviorQueueHtml(me) +
    '</div>';
}

async function adjustIntelligence(delta){
  await mutateTable(t => {
    const me = t.players[AppState.playerId];
    if(!me) return;
    if(!me.personality) me.personality = {};
    if(!me.personality.head) me.personality.head = {};
    const current = me.personality.head.intelligence ?? INTELLIGENCE_DEFAULT;
    const next = Math.max(1, current + delta);
    me.personality.head.intelligence = next;
    if(me.mindeye){
      const capacity = mindeyeCapacity(me);
      while(me.mindeye.length > capacity) me.mindeye.shift();
    }
  });
}

function domainPlaceholderHtml(label, note){
  return '<div class="personality-domain-locked">' +
    '<div class="stat-header">' + label + '</div>' +
    '<div class="personality-axis-desc">' + note + '</div>' +
  '</div>';
}

function statsHtml(me, readOnly){
  const intelligence = getIntelligence(me);
  const capacity = mindeyeCapacity(me);
  const remembered = (me.mindeye || []).length;
  return `
    <div class="stat-header">Head</div>
    <div class="personality-axis">
      <div class="personality-axis-name">Intelligence</div>
      <div class="personality-stepper">
        ${readOnly ? '' : '<button class="btn-ghost btn-small" id="personality-intelligence-minus">−</button>'}
        <span class="personality-value">${intelligence}</span>
        ${readOnly ? '' : '<button class="btn-ghost btn-small" id="personality-intelligence-plus">+</button>'}
      </div>
      <div class="personality-capacity">Remembering ${remembered} / ${capacity} Expression${capacity === 1 ? '' : 's'}</div>
    </div>
    ${domainPlaceholderHtml('Heart', 'Second Era — no Axes designed yet.')}
    ${domainPlaceholderHtml('Stomach', 'Third Era — no Axes designed yet.')}
  `;
}

// The Character's own PERSONAL Relationship Axes — real, not-yet-designed
// mechanic, distinct from Attachment/Desire (the Emotion Axes, per-Glyph,
// shown in the bottom detail panel instead) — a real labeled placeholder, not faked content.
function relationshipDetailsHtml(){
  return '<div class="stat-header">Relationship Details</div>' +
    '<div class="log-empty">Not designed yet — these are personal Relationship Axes for the Character itself (distinct from the Emotion Axes below, which are per-Glyph), influencing how they interpret what they receive.</div>';
}

// Bottom-quarter Glyph detail — whichever Glyph is currently selected in the
// left column (information.js's own selection state). Emotion Axes
// (Attachment/Desire) reuse relationships.js's renderAxis() exactly as the
// old Relationships Pillar did; Crafts/Powers association and axis-effect notes are both real fields with nothing behind them yet.
function glyphDetailHtml(container, readOnly){
  const entryId = getSelectedGlyphEntryId();
  const entry = entryId && myMindeye().find(e => e.id === entryId);
  container.innerHTML = '';
  if(!entry){
    container.innerHTML = '<div class="stat-header">Glyph Detail</div><div class="log-empty">Select a Glyph above to see detail on it.</div>';
    return;
  }
  const glyph = lookupGlyph(entry.glyph);
  const head = document.createElement('div');
  head.className = 'glyph-detail-head';
  head.innerHTML =
    '<div class="glyph-detail-icon">' + entryGlyphMarkup(entry) + '</div>' +
    '<div>' +
      '<div class="glyph-detail-name">' + escapeHtml(entryGlyphName(entry)) + '</div>' +
      '<div class="glyph-detail-meaning">' + escapeHtml((glyph && glyph.meaning) || 'No meaning recorded.') + '</div>' +
      '<div class="glyph-detail-category">' + mindeyeCategory(entry.retention) + ' — from ' + escapeHtml(entry.from || 'Someone') + '</div>' +
    '</div>';
  container.appendChild(head);

  const axesWrap = document.createElement('div');
  axesWrap.className = 'glyph-detail-axes';
  axesWrap.appendChild(renderAxis('Attachment', 'Connected', 'Separated', 'attachment', entry, readOnly));
  axesWrap.appendChild(renderAxis('Desire', 'Desirable', 'Undesirable', 'desire', entry, readOnly));
  container.appendChild(axesWrap);

  const notes = document.createElement('div');
  notes.className = 'glyph-detail-notes log-empty';
  notes.textContent = 'No notes yet on how this Glyph affects an Axis.';
  container.appendChild(notes);

  const crafts = document.createElement('div');
  crafts.className = 'glyph-detail-crafts log-empty';
  crafts.textContent = 'Not tied to any Craft or Power yet.';
  container.appendChild(crafts);
}

export function renderPersonalityPanel(){
  const glyphColEl = document.getElementById('personality-glyph-list');
  const filterBarEl = document.getElementById('personality-glyph-filters');
  const behaviorEl = document.getElementById('personality-behavior-section');
  const statsEl = document.getElementById('personality-stats-section');
  const relEl = document.getElementById('personality-relationship-section');
  const detailEl = document.getElementById('personality-glyph-detail');
  if(!glyphColEl) return;

  const me = myCharacter();
  const readOnly = inspecting();

  if(!me){
    glyphColEl.innerHTML = '<div class="log-empty">No Character yet.</div>';
    if(filterBarEl) filterBarEl.innerHTML = '';
    if(behaviorEl) behaviorEl.innerHTML = '';
    if(statsEl) statsEl.innerHTML = '';
    if(relEl) relEl.innerHTML = '';
    if(detailEl) detailEl.innerHTML = '';
    return;
  }

  if(filterBarEl){
    filterBarEl.innerHTML = filterBarHtml();
    filterBarEl.querySelectorAll('.glyph-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => { memoryFilter = btn.dataset.filter || null; renderPersonalityPanel(); });
    });
  }
  renderGlyphColumn(glyphColEl, memoryFilter, renderPersonalityPanel);

  if(behaviorEl) behaviorEl.innerHTML = behaviorsHtml(me) + planHtml(me);
  if(statsEl) statsEl.innerHTML = (readOnly ? '<div class="inspect-banner">Inspecting ' + escapeHtml(me.name || 'Unnamed') + ' — read-only</div>' : '') + statsHtml(me, readOnly);
  if(relEl) relEl.innerHTML = relationshipDetailsHtml();
  if(detailEl) glyphDetailHtml(detailEl, readOnly);

  const suppressBtn = document.getElementById('personality-suppress-toggle');
  if(suppressBtn) suppressBtn.addEventListener('click', toggleSuppressSubconscious);
  const workPlanBtn = document.getElementById('personality-work-plan-toggle');
  if(workPlanBtn) workPlanBtn.addEventListener('click', toggleWorkTowardsPlan);
  const teachBtn = document.getElementById('personality-teach-mode-toggle');
  if(teachBtn) teachBtn.addEventListener('click', toggleTeachMode);
  if(behaviorEl){
    behaviorEl.querySelectorAll('.plan-slot').forEach(el => {
      el.addEventListener('click', () => {
        openPlanSlot = { r: Number(el.dataset.row), s: Number(el.dataset.slot) };
        renderPersonalityPanel();
      });
    });
    behaviorEl.querySelectorAll('.plan-glyph-select').forEach(sel => {
      sel.addEventListener('change', ev => {
        const r = Number(ev.target.dataset.row), s = Number(ev.target.dataset.slot);
        openPlanSlot = null;
        setPlanGlyph(r, s, ev.target.value);
        renderPersonalityPanel();
      });
      sel.addEventListener('click', ev => ev.stopPropagation());
      sel.addEventListener('blur', () => { openPlanSlot = null; renderPersonalityPanel(); });
    });
    behaviorEl.querySelectorAll('.plan-ref-select').forEach(sel => {
      sel.addEventListener('change', ev => setPlanRef(Number(ev.target.dataset.row), Number(ev.target.dataset.slot), ev.target.value));
    });
    behaviorEl.querySelectorAll('.plan-commit-btn').forEach(btn => {
      btn.addEventListener('click', () => togglePlanCommit(Number(btn.dataset.row)));
    });
    // Arranger parity — a freshly-opened slot's select grabs focus and pops
    // its own native picker immediately, same as openSlotMenu() there.
    const openSel = openPlanSlot && behaviorEl.querySelector('.plan-glyph-select[data-row="' + openPlanSlot.r + '"][data-slot="' + openPlanSlot.s + '"]');
    if(openSel){
      openSel.focus();
      try{ openSel.showPicker && openSel.showPicker(); }catch(err){}
    }
  }
  if(!readOnly){
    const minus = document.getElementById('personality-intelligence-minus');
    const plus = document.getElementById('personality-intelligence-plus');
    if(minus) minus.addEventListener('click', () => adjustIntelligence(-1));
    if(plus) plus.addEventListener('click', () => adjustIntelligence(1));
  }
}
