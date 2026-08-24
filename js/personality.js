// Personality Pillar — first real foothold, mirroring Information's own
// build (2026-08-20). Heart/Stomach/Head are the three domains per the
// Personality prototype (prototypes/personality-pillar.html), but First Era
// Beings only need Head (per dDd, dialogue-system.md's "next session" entry
// — Heart/Stomach are Second/Third Era concerns). Head is the only one with
// real content; Heart/Stomach render too now (2026-08-23, per dDd: "they
// should still be visible, just greyed out") — visible-but-inert, same
// `opacity:.4` convention js/techniques.js's `.tech-denied` already uses,
// not a functional gate on any Character. The prototype itself never had
// real Axis content for either domain ("empty for now; which Axes belong
// where is still open") — there's nothing being hidden or restored here,
// just a placeholder made visible instead of omitted.
//
// Intelligence is the first real Axis (2026-08-21, per dDd's Notebook): "it's
// going to relate to how many Expressions a Character can remember." The
// actual capacity enforcement lives in utils.js's deliverMindeyeEntry/
// getIntelligence, shared with information.js's Mindeye — this panel is just
// the Character-facing view/editor onto that same number.

import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { getIntelligence, mindeyeCapacity, INTELLIGENCE_DEFAULT, escapeHtml, resolveEntityRef } from './utils.js';
import { computeBehaviors, sortedBehaviors, BEHAVIOR_CATEGORIES } from './behaviors.js';
import { compositionCardHtml } from './information.js';

// Inspect mode (2026-08-22, per dDd) — the viewing Player's own Character by
// default, or whichever Character AppState.inspectTargetId points at (set
// from a new NPC Panel row button, js/dm.js's renderNpcList) — read-only in
// that case, "to see what is going on," not to edit someone else's sheet.
function myCharacter(){
  const id = AppState.inspectTargetId || AppState.playerId;
  return resolveEntityRef(AppState.table, id);
}
function inspecting(){
  return !!AppState.inspectTargetId;
}

// Plan (2026-08-23, per dDd) — sits between Head and Behaviors: Suppress
// Subconscious (a hard per-Character freeze on Behaviors rolling at all —
// see js/noncombat.js's resolveBehavior()) and a read-only readout of
// whatever Scripts are currently active on this Character. The mechanism
// already exists (js/scripts.js's assignScript()/activeScripts, advanced by
// the Teach Behavior) — this is purely the missing visibility, per dDd:
// "You already seem to have that behavior going, just need a way to verify
// it." Real assignment still happens from the separate Scripts Panel;
// Suppress Subconscious is left editable even while inspecting an NPC
// (unlike Intelligence below) since freezing an NPC's own Behaviors before
// TATA manually directs it is exactly the DM-side case this exists for.
// Up to 3 concurrent Scripts (2026-08-23, per dDd — "the Character can only
// have one Script for Plan. Can we make it 3?"), same cap the Row builder
// itself already used per-Script.
async function toggleSuppressSubconscious(){
  const me = myCharacter();
  if(!me) return;
  const id = AppState.inspectTargetId || AppState.playerId;
  await mutateTable(t => {
    const actor = resolveEntityRef(t, id);
    if(actor) actor.suppressSubconscious = !actor.suppressSubconscious;
  });
}

// Teach mode toggle (2026-08-23, per dDd — the arrow-button 3-way concept:
// "To the right does approach you just made [sequential] / Down for the
// throughput approach [parallel] / Both directions, so dynamically going
// through (which is harder to do)"). Only cycles the two built modes —
// dynamic needs a not-yet-designed priority Stat, so it's left out of the
// click cycle entirely rather than wired to a mode that silently does
// nothing.
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

function planHtml(me){
  const suppressed = !!me.suppressSubconscious;
  const teachMode = me.teachMode === 'parallel' ? 'parallel' : 'sequential';
  const scripts = me.activeScripts || [];
  // Same card component Scripts Panel's own Active Scripts readout uses
  // (2026-08-23, per dDd: "Personality... should use the same formatting
  // you decide on for the Scripts in Scripts") — js/information.js's
  // compositionCardHtml(rows, {nextRowIndex}), not a separate plain-text
  // layout.
  const scriptsHtml = scripts.length
    ? scripts.map(script =>
        '<div class="script-slot">' +
          '<div class="script-status-line">Target: ' + escapeHtml(script.targetName || '?') + '</div>' +
          '<div class="script-status-line">Progress: Expression ' + (script.nextRow + 1) + ' / ' + script.rows.length + '</div>' +
          compositionCardHtml(script.rows, { nextRowIndex: script.nextRow }) +
        '</div>'
      ).join('')
    : '<div class="log-empty">No active Scripts.</div>';

  return '<div class="stat-header">Plan</div>' +
    '<div class="personality-axis">' +
      '<div class="personality-axis-name">Suppress Subconscious</div>' +
      '<div class="personality-axis-desc">Freezes Behaviors from rolling/executing at all — prevents conflicts with a Move/Order you\'re staging by hand yourself.</div>' +
      '<button class="btn-ghost btn-small' + (suppressed ? ' active' : '') + '" id="personality-suppress-toggle">' + (suppressed ? 'Suppressed' : 'Active') + '</button>' +
    '</div>' +
    '<div class="personality-axis" style="margin-top:10px;">' +
      '<div class="personality-axis-name">Teach Mode</div>' +
      '<div class="personality-axis-desc">' + (teachMode === 'parallel'
        ? 'Parallel — every active Script advances a Row the same Round (real multiplayer throughput).'
        : 'Sequential — one Row total per Round, from the first Script queued.') + '</div>' +
      '<button class="btn-ghost btn-small' + (teachMode === 'parallel' ? ' active' : '') + '" id="personality-teach-mode-toggle" title="Click to switch modes">' +
        (teachMode === 'parallel' ? '↓ Parallel' : '→ Sequential') +
      '</button>' +
    '</div>' +
    '<div class="personality-axis" style="margin-top:10px;">' +
      '<div class="personality-axis-name">Active Scripts (' + scripts.length + ' / 3)</div>' +
      scriptsHtml +
    '</div>';
}

// Heart/Stomach (2026-08-23) — greyed-out placeholders, Second/Third Era
// domains with no real Axis content designed yet. `note` names which Era
// unlocks it; kept as one small shared helper rather than two near-copies.
function domainPlaceholderHtml(label, note){
  return '<div class="personality-domain-locked">' +
    '<div class="stat-header">' + label + '</div>' +
    '<div class="personality-axis-desc">' + note + '</div>' +
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
    // Lowering capacity below what's already remembered forgets the oldest
    // Expressions immediately, same rule deliverMindeyeEntry enforces on
    // arrival — capacity is the raw stat × 10 (2026-08-22), not a 1:1 count.
    if(me.mindeye){
      const capacity = mindeyeCapacity(me);
      while(me.mindeye.length > capacity) me.mindeye.shift();
    }
  });
}

// Behaviors (2026-08-22, per dDd; split into 3 independent columns same day
// after playtesting — "Characters should have 3 separate Behaviors. This is
// for moving, selecting, acting basically... it's basically the same
// layout, just 3 times in the same area... 3 columns would be best.") —
// tracks Information (remembered Glyphs) and the Character's Relationship
// to it; a Behavior is the result. Only the math/display live here for
// Actions/Targeting (Crafter-initiated, not yet auto-executed) — Movement
// really does play out on the Map (js/noncombat.js's resolveNonCombatRound()).
function behaviorsHtml(me){
  const categories = computeBehaviors(me);

  const columns = BEHAVIOR_CATEGORIES.map(cat => {
    const { distribution, perGlyph } = categories[cat.key];
    const ranked = sortedBehaviors(distribution);
    const likely = ranked[0];
    const runnerUp = ranked[1];

    const glyphRows = perGlyph.length
      ? perGlyph.map(g =>
          '<div class="behavior-glyph-row">' +
            '<span class="behavior-glyph-id">' + escapeHtml(g.glyphId) + '</span>' +
            '<span class="behavior-glyph-assoc">' + escapeHtml(g.behaviorName) +
              ' <span class="behavior-glyph-longing">(Longing ' + g.longing + ')</span>' +
            '</span>' +
            '<span class="behavior-glyph-pct">' + g.impactPct + '%</span>' +
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

  return '<div class="stat-header">Behaviors</div><div class="behavior-columns">' + columns + '</div>';
}

export function renderPersonalityPanel(){
  const container = document.getElementById('personality-head-list');
  if(!container) return;

  const me = myCharacter();
  if(!me){
    container.innerHTML = '<div class="log-empty">No Character yet.</div>';
    return;
  }

  const intelligence = getIntelligence(me);
  const capacity = mindeyeCapacity(me);
  const remembered = (me.mindeye || []).length;
  const readOnly = inspecting();

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `
    ${readOnly ? '<div class="inspect-banner">Inspecting ' + escapeHtml(me.name || 'Unnamed') + ' — read-only</div>' : ''}
    <div class="stat-header">Head</div>
    <div class="personality-axis">
      <div class="personality-axis-name">Intelligence</div>
      <div class="personality-axis-desc">How many Expressions this Character can remember at once — 10 Memories per Intelligence point. The Mindeye forgets its oldest arrival past this limit.</div>
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
  const planSheet = document.createElement('div');
  planSheet.className = 'sheet';
  planSheet.innerHTML = planHtml(me);

  const behaviorSheet = document.createElement('div');
  behaviorSheet.className = 'sheet';
  behaviorSheet.innerHTML = behaviorsHtml(me);

  container.innerHTML = '';
  container.appendChild(sheet);
  container.appendChild(planSheet);
  container.appendChild(behaviorSheet);

  container.querySelector('#personality-suppress-toggle').addEventListener('click', toggleSuppressSubconscious);
  container.querySelector('#personality-teach-mode-toggle').addEventListener('click', toggleTeachMode);

  if(!readOnly){
    container.querySelector('#personality-intelligence-minus').addEventListener('click', () => adjustIntelligence(-1));
    container.querySelector('#personality-intelligence-plus').addEventListener('click', () => adjustIntelligence(1));
  }
}
