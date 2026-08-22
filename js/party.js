// Party Panel (2026-08-22) — first real content in the previously-empty
// "Party" toolbar panel (see reference/ROADMAP.md, Party Panel section).
// Just Party Facing for now — the panel's other threads (Formations,
// Movement/Combat Behavior, Stats/Techniques/Progression, AI Logic) are
// still open [Discuss] items, not built.

import { AppState } from './state.js';
import { FACING_DIRECTIONS, FACING_DEGREES, stageFacingOrder } from './map.js';

// Compass-rose grid position per direction — 3x3, center cell left empty.
const FACING_POS = { N: '2/1', NE: '3/1', E: '3/2', SE: '3/3', S: '2/3', SW: '1/3', W: '1/2', NW: '1/1' };

function myCharacter(){
  return AppState.table && AppState.table.players[AppState.playerId];
}

export function renderPartyPanel(){
  const container = document.getElementById('party-facing-list');
  if(!container) return;

  const me = myCharacter();
  if(!me){
    container.innerHTML = '<div class="log-empty">No Character yet.</div>';
    return;
  }

  const current = me.facing || 'S';
  // Facing is staged now, not instant (2026-08-22, per dDd) — a queued
  // 'facing' Order (see js/map.js's stageFacingOrder) doesn't take effect
  // until the next Resolve, so it's worth surfacing here rather than
  // leaving the picker looking unchanged after a click.
  const pending = (me.orders || []).find(o => o.kind === 'facing');
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `
    <div class="stat-header">Party Facing</div>
    <div class="party-facing-desc">Which way this Character — and their Mini-Party — is actually facing on the Map. Takes effect at the next Resolve.</div>
    <div class="party-facing-grid">
      ${FACING_DIRECTIONS.map(dir => `
        <button class="party-facing-btn${dir === current ? ' active' : ''}" data-facing="${dir}" title="${dir}" style="grid-column:${FACING_POS[dir].split('/')[0]}; grid-row:${FACING_POS[dir].split('/')[1]};">
          <span class="facing-marker" style="--facing-deg:${FACING_DEGREES[dir]}deg"></span>
        </button>
      `).join('')}
    </div>
    ${pending ? '<div class="party-facing-pending">Pending: turn to face ' + pending.direction + '</div>' : ''}
  `;

  container.innerHTML = '';
  container.appendChild(sheet);
  container.querySelectorAll('.party-facing-btn').forEach(btn => {
    btn.addEventListener('click', () => stageFacingOrder(AppState.playerId, btn.dataset.facing));
  });
}
