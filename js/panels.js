import { AppState } from './state.js';
import { closeMapPopups } from './map.js';

const PANEL_IDS = ['character', 'combat', 'dm', 'dmtest', 'character-view', 'stats', 'techniques', 'party', 'npcs', 'technique-use', 'help', 'information', 'personality', 'relationships', 'scripts'];

// Moved here from js/main.js (2026-08-23) so js/scenes.js can use it too,
// without a circular import (main.js already imports from both this file
// and scenes.js). See its new loadScene() usage — per dDd, watching a real
// Scene load: "it looks like all the Logic happens after the Map loads. The
// Camera adjust, the Characters Spawn. It looks like they are racing and
// winner is random... having a mandatory 1 second 'load' screen? All that
// stuff happens... then presented visually?" — several sequential
// mutateTable() calls (spawn NPCs, create the Player Character, seed
// Mindeye/Personality, set Facing) each re-render as they land, and the
// camera doesn't get centered until after all of them — so the Map visibly
// renders several times at the wrong (default) camera position before ever
// showing the right one. #loading is now a real full-screen blocking
// overlay (css/base.css's .loading-row), not just an inline hint, so
// wrapping a whole async sequence in showLoading(true)/(false) actually
// hides the in-between churn instead of just leaving it visible underneath.
export function showLoading(v){ document.getElementById('loading').classList.toggle('hidden', !v); }

// Attack/Block/Essence submenus otherwise remember whatever open/closed state
// they were left in — force them collapsed every time the panel opens instead.
function collapseActionMenus(prefix){
  ['attack', 'block', 'essence'].forEach(m => {
    const el = document.getElementById(prefix + 'menu-' + m);
    if(el) el.classList.add('hidden');
  });
}

export function openPanel(name){
  if(!PANEL_IDS.includes(name)) return;
  // Fixed 2026-08-22, per dDd — the Map's own popups (Move/Suggest/Craft and
  // the Occupant List) were persisting behind whichever Panel just opened.
  // A direct call here, not reliant on the click that opened this Panel
  // actually bubbling to document — several Panel-opening buttons
  // (js/craftPopup.js's craft-list-item, for one) call ev.stopPropagation()
  // first for unrelated reasons, which silently defeated the document-level
  // dismiss listener (js/map.js's initMapPopupDismiss) for exactly this case.
  closeMapPopups();
  AppState.activePanel = name;
  if(name === 'combat') collapseActionMenus('');
  if(name === 'dm') collapseActionMenus('dm-');
  render();
}

export function closePanel(){
  AppState.activePanel = null;
  render();
}

export function togglePanel(name){
  if(AppState.activePanel === name){
    closePanel();
  }else{
    openPanel(name);
  }
}

function render(){
  const backdrop = document.getElementById('panel-backdrop');
  if(backdrop) backdrop.classList.toggle('hidden', !AppState.activePanel);

  PANEL_IDS.forEach(id => {
    const el = document.getElementById('panel-' + id);
    if(!el) return;
    el.classList.toggle('hidden', AppState.activePanel !== id);
  });

  // Toolbar buttons reflect which panel (if any) is currently open.
  PANEL_IDS.forEach(id => {
    const btn = document.getElementById('toolbar-' + id);
    if(!btn) return;
    btn.classList.toggle('active', AppState.activePanel === id);
  });
}

// Gate Combat availability on encounter state — DM stays reachable always, since
// starting an encounter is itself a DM action.
export function updateEncounterUI(){
  const table = AppState.table;
  const inEncounter = !!(table && table.inEncounter);
  const hasEnemies = !!(table && table.enemies && Object.keys(table.enemies).length > 0);

  const combatBtn = document.getElementById('toolbar-combat');
  if(combatBtn){
    combatBtn.disabled = !inEncounter;
    combatBtn.classList.toggle('disabled', !inEncounter);
  }
  // If Combat was open and the encounter just ended, close it.
  if(!inEncounter && AppState.activePanel === 'combat'){
    closePanel();
  }

  // Start requires at least one Enemy on the Map and no encounter already
  // running; End requires one currently be running.
  const startBtn = document.getElementById('btn-start-encounter');
  const endBtn = document.getElementById('btn-end-encounter');
  const resolveBtn = document.getElementById('btn-resolve');
  if(startBtn) startBtn.disabled = inEncounter || !hasEnemies;
  if(endBtn) endBtn.disabled = !inEncounter;
  // Resolve stays visible always now (2026-08-21) — the Non-Combat Round is
  // the default state of the Game, not a special mode, so there's always
  // something for it to do. Combat Round vs Non-Combat Round changes what it
  // actually resolves (see the click wiring in main.js), just the label here.
  if(resolveBtn) resolveBtn.textContent = inEncounter ? 'Resolve round' : 'Resolve';
}

// Backdrop click closes whatever's open.
export function initPanelBackdrop(){
  const backdrop = document.getElementById('panel-backdrop');
  if(backdrop) backdrop.addEventListener('click', closePanel);
}
