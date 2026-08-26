// Emotion Axes editor — Attachment (how fond a Character is of a piece of
// Information) and Desire (how intently they're pursuing it), both living
// directly on the Mindeye entry itself, not the Character. This module is
// the reusable Axis-editor piece the Personality Panel's (js/personality.js)
// bottom-quarter Glyph detail renders — it used to be its own full
// Relationships Pillar/Panel, since folded into the Glyph-list-driven
// Personality Panel.

import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml } from './utils.js';

export async function setAxisValue(entryId, field, value) {
  await mutateTable(t => {
    const me = t.players[AppState.playerId];
    const entry = me && me.mindeye && me.mindeye.find(e => e.id === entryId);
    if (entry) entry[field] = value;
  });
}

export function renderAxis(name, leftLabel, rightLabel, field, entry, readOnly) {
  const value = entry[field] ?? 1;
  const el = document.createElement('div');
  el.className = 'rel-axis';
  el.innerHTML = `
    <div class="rel-axis-name">${escapeHtml(name)}</div>
    <div class="rel-axis-3way">
      <button class="rel-pole-btn${value === 0 ? ' active' : ''}" data-val="0">${escapeHtml(leftLabel)}</button>
      <button class="rel-pole-btn mid${value === 1 ? ' active' : ''}" data-val="1">Mid</button>
      <button class="rel-pole-btn${value === 2 ? ' active' : ''}" data-val="2">${escapeHtml(rightLabel)}</button>
    </div>
  `;
  // Read-only while inspecting someone else's Character — buttons still
  // show the real state, they just don't respond to clicks.
  if(!readOnly){
    el.querySelectorAll('.rel-pole-btn').forEach(btn => {
      btn.addEventListener('click', () => setAxisValue(entry.id, field, Number(btn.dataset.val)));
    });
  }
  return el;
}
