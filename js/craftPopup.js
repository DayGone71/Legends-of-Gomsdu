// The Map's "Craft" Tile popup (2026-08-21, per dDd's spec, followed close):
// clicking Craft on an occupied Tile shows only the Crafts actually relevant
// there. Crafter Target Crafts (self-only, e.g. Channel) only show up when
// the Tile is the Player's own; Crafts targeting another Character (Message,
// Heart Attack, ...) only show up on someone else's Tile. Combat/Non-Combat
// filtering applies too — outside an Encounter, only NONCOMBAT_TECHNIQUES
// are offered.
//
// Deliberately its own module, never imported by js/map.js — techniques.js
// already imports js/map.js (getDistance/hasLineOfSight), so map.js
// importing anything that needs techniques.js's own data would cycle
// straight back to itself. Wired from js/main.js's render loop instead, the
// same way other cross-cutting concerns (renderView2Mode, updateEncounterUI)
// already are.

import { AppState } from './state.js';
import { TECHNIQUES, hasCategoryAccess, openTechniqueUse, NONCOMBAT_TECHNIQUES } from './techniques.js';

function closeCraftPopup(){
  const popup = document.getElementById('craft-list-popup');
  if(popup) popup.classList.add('hidden');
}

function openCraftPopup(targetId, anchorEl){
  const table = AppState.table;
  const me = table.players && table.players[AppState.playerId];
  if(!me) return;
  const isSelf = targetId === AppState.playerId;
  const inEncounter = !!table.inEncounter;

  const options = Object.entries(TECHNIQUES).filter(([key, def]) => {
    if(def.group !== 'Craft') return false;
    if(!hasCategoryAccess(me, def)) return false;
    if(!!def.selfOnly !== isSelf) return false;
    if(!inEncounter && !NONCOMBAT_TECHNIQUES.includes(key)) return false;
    return true;
  });

  const popup = document.getElementById('craft-list-popup');
  if(!popup) return;
  popup.innerHTML = options.length
    ? options.map(([key, def]) => '<button class="craft-list-item" data-craft-key="' + key + '">' + def.name + '</button>').join('')
    : '<div class="log-empty">No Crafts available here.</div>';

  const rect = anchorEl.getBoundingClientRect();
  popup.style.left = rect.left + 'px';
  popup.style.top = (rect.bottom + 4) + 'px';
  popup.classList.remove('hidden');

  popup.querySelectorAll('.craft-list-item').forEach(btn => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      openTechniqueUse(btn.dataset.craftKey);
      const targetSelect = document.getElementById('tu-target');
      if(targetSelect) targetSelect.value = targetId;
      closeCraftPopup();
    };
  });
}

// One-time delegated listener, not per-Tile rewiring — js/map.js's own
// renderMap() runs from several local-only paths (a plain Tile click just
// re-rendering the popup state, not always the full renderAll()), so a
// per-render "find every .tile-popup.craft and attach onclick" pass would
// silently miss those and leave the button dead. Delegation on the one
// stable #map-grid container survives every rebuild automatically.
export function initCraftPopup(){
  const grid = document.getElementById('map-grid');
  if(grid){
    grid.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.tile-popup.craft[data-craft-target]');
      if(!btn) return;
      ev.stopPropagation();
      openCraftPopup(btn.dataset.craftTarget, btn);
    });
  }

  // Closes the Craft list on any click outside it (and outside the Craft
  // button that opened it) — same dismiss behavior #party-add-popup uses.
  document.addEventListener('click', (ev) => {
    const popup = document.getElementById('craft-list-popup');
    if(!popup || popup.classList.contains('hidden')) return;
    if(!popup.contains(ev.target) && !ev.target.closest('.tile-popup.craft')) closeCraftPopup();
  });
}
