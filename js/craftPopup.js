// The Map's "Craft" Tile popup: clicking Craft on an occupied Tile shows
// only the Crafts actually relevant there. Self-only Crafts (e.g. Channel)
// only show up when the Tile is the Player's own; Crafts targeting another
// Character (Message, Heart Attack, ...) only show up on someone else's
// Tile. Every Craft/Power is offered regardless of Encounter state.
//
// Deliberately its own module, never imported by js/map.js — techniques.js
// already imports js/map.js (getDistance/hasLineOfSight), so map.js
// importing anything that needs techniques.js's own data would cycle
// straight back to itself. Wired from js/main.js's render loop instead, the
// same way other cross-cutting concerns (renderView2Mode, updateEncounterUI)
// already are.

import { AppState } from './state.js';
import { TECHNIQUES, hasTechniqueAccess, openTechniqueUse } from './techniques.js';
import { resolveEntityRef } from './utils.js';
import { dmSelectCraft, selectDMTarget, dmToggleMenu } from './dm.js';
import { openPanel } from './panels.js';
import { triggerRender } from './sync.js';

function closeCraftPopup(){
  const popup = document.getElementById('craft-list-popup');
  if(popup) popup.classList.add('hidden');
}

// The Crafter is the Player outside TATA, or the real Active Character
// inside it. js/map.js's buildTilePopups only emits the Craft button at all
// when this would resolve to someone real (never The Architect, who has no
// Stats to Craft with).
function currentCrafterId(){
  return AppState.tataActive ? AppState.activeCharacterId : AppState.playerId;
}

function openCraftPopup(targetId, anchorEl){
  const table = AppState.table;
  const casterId = currentCrafterId();
  const me = resolveEntityRef(table, casterId);
  if(!me) return;
  const isSelf = targetId === casterId;

  const options = Object.entries(TECHNIQUES).filter(([key, def]) => {
    if(def.group !== 'Craft' && def.group !== 'Powers') return false;
    if(!hasTechniqueAccess(me, def)) return false;
    if(!!def.selfOnly !== isSelf) return false;
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
      if(AppState.tataActive){
        // TATA hands off to the DM's existing Essence-menu casting
        // machinery (dmCommitAction etc., js/dm.js) rather than duplicating
        // its cost/range/sequence logic here; the Player-only Technique Use
        // panel below assumes AppState.playerId as the Crafter throughout,
        // which an Active Character isn't. AppState.actingEnemyId is kept
        // in lockstep with activeCharacterId (js/activeCharacter.js's
        // toggleActiveCharacter), so the DM Panel opens already showing the
        // right Character's real Crafts/costs. openPanel('dm') collapses
        // every DM action submenu by design (panels.js's openPanel) — has
        // to run before re-expanding Essence, or the pre-selection below
        // gets immediately hidden again.
        openPanel('dm');
        dmToggleMenu('essence');
        selectDMTarget(targetId);
        dmSelectCraft(btn.dataset.craftKey);
        triggerRender();
      }else{
        openTechniqueUse(btn.dataset.craftKey, targetId);
      }
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
