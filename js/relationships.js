// Emotion Axes editor — Attachment/Desire, per dDd's own naming (2026-08-24:
// "you can have the Emotion Axes, which are Attachment/Desire"). Used to be
// its own full Relationships Pillar/Panel (2026-08-21) with its own Glyph
// Gallery duplicating Information's; retired 2026-08-24 when the 3 Pillars
// got redesigned into one Glyph-list-driven Personality Panel
// (js/personality.js) — this module is now just the reusable Axis-editor
// piece that panel's bottom-quarter Glyph detail renders, per dDd's own
// Notebook: "Attachment is how fond they are of a piece of Information...
// Desire is how intently they are pursuing a piece of Information" — both
// live directly on the Mindeye entry itself, not the Character.

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
  // Read-only while inspecting someone else's Character (2026-08-22, per
  // dDd — "to see what is going on," not to edit it from here) — buttons
  // still show the real state, they just don't respond to clicks.
  if(!readOnly){
    el.querySelectorAll('.rel-pole-btn').forEach(btn => {
      btn.addEventListener('click', () => setAxisValue(entry.id, field, Number(btn.dataset.val)));
    });
  }
  return el;
}
