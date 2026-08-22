// Personality Pillar — first real foothold, mirroring Information's own
// build (2026-08-20). Heart/Stomach/Head are the three domains per the
// Personality prototype (prototypes/personality-pillar.html), but First Era
// Beings only need Head (per dDd, dialogue-system.md's "next session" entry
// — Heart/Stomach are Second/Third Era concerns) — so only Head renders for
// now, not a placeholder for the other two.
//
// Intelligence is the first real Axis (2026-08-21, per dDd's Notebook): "it's
// going to relate to how many Expressions a Character can remember." The
// actual capacity enforcement lives in utils.js's deliverMindeyeEntry/
// getIntelligence, shared with information.js's Mindeye — this panel is just
// the Character-facing view/editor onto that same number.

import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { getIntelligence, INTELLIGENCE_DEFAULT, escapeHtml } from './utils.js';
import { computeBehaviors, sortedBehaviors } from './behaviors.js';

function myCharacter(){
  return AppState.table && AppState.table.players[AppState.playerId];
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
    // Expressions immediately, same rule deliverMindeyeEntry enforces on arrival.
    if(me.mindeye){
      while(me.mindeye.length > next) me.mindeye.shift();
    }
  });
}

// Behaviors (2026-08-22, per dDd) — tracks Information (remembered Glyphs)
// and the Character's Relationship to it; a Behavior is the result. Only the
// math/display live here — nothing actually plays out on the Map yet (see
// js/noncombat.js's resolveNonCombatRound(), which logs the computed Likely
// Behavior to the Ledger instead of executing it, per dDd's explicit scope).
function behaviorsHtml(me){
  const { distribution, perGlyph } = computeBehaviors(me);
  const ranked = sortedBehaviors(distribution);
  const likely = ranked[0];
  const runnerUp = ranked[1];

  const glyphRows = perGlyph.length
    ? perGlyph.map(g =>
        '<div class="behavior-glyph-row">' +
          '<span class="behavior-glyph-id">' + escapeHtml(g.glyphId) + '</span>' +
          '<span class="behavior-glyph-assoc">' + escapeHtml(g.behaviorName || 'No associated Behavior') +
            (g.behaviorKey ? ' <span class="behavior-glyph-longing">(Longing ' + g.longing + ')</span>' : '') +
          '</span>' +
          '<span class="behavior-glyph-pct">' + g.impactPct + '%</span>' +
        '</div>'
      ).join('')
    : '<div class="log-empty">No Glyphs remembered yet.</div>';

  return `
    <div class="stat-header">Behaviors</div>
    <div class="behavior-summary">
      <div class="behavior-summary-col">
        <div class="behavior-summary-label">Likely Behavior</div>
        <div class="behavior-summary-value">${escapeHtml(likely.name)}</div>
        <div class="behavior-summary-pct">${likely.pct}%</div>
      </div>
      <div class="behavior-summary-col">
        <div class="behavior-summary-label">Runner Up</div>
        <div class="behavior-summary-value">${runnerUp ? escapeHtml(runnerUp.name) : '—'}</div>
        <div class="behavior-summary-pct">${runnerUp ? runnerUp.pct + '%' : ''}</div>
      </div>
    </div>
    <div class="behavior-glyph-list">${glyphRows}</div>
  `;
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
  const remembered = (me.mindeye || []).length;

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `
    <div class="stat-header">Head</div>
    <div class="personality-axis">
      <div class="personality-axis-name">Intelligence</div>
      <div class="personality-axis-desc">How many Expressions this Character can remember at once — the Mindeye forgets its oldest arrival past this limit.</div>
      <div class="personality-stepper">
        <button class="btn-ghost btn-small" id="personality-intelligence-minus">−</button>
        <span class="personality-value">${intelligence}</span>
        <button class="btn-ghost btn-small" id="personality-intelligence-plus">+</button>
      </div>
      <div class="personality-capacity">Remembering ${remembered} / ${intelligence} Expression${intelligence === 1 ? '' : 's'}</div>
    </div>
  `;
  const behaviorSheet = document.createElement('div');
  behaviorSheet.className = 'sheet';
  behaviorSheet.innerHTML = behaviorsHtml(me);

  container.innerHTML = '';
  container.appendChild(sheet);
  container.appendChild(behaviorSheet);

  container.querySelector('#personality-intelligence-minus').addEventListener('click', () => adjustIntelligence(-1));
  container.querySelector('#personality-intelligence-plus').addEventListener('click', () => adjustIntelligence(1));
}
