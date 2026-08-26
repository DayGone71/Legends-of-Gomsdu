import { AppState } from './state.js';
import { closeMapPopups } from './map.js';

const PANEL_IDS = ['character', 'combat', 'dm', 'dmtest', 'character-view', 'stats', 'techniques', 'party', 'npcs', 'technique-use', 'help', 'information', 'personality', 'relationships', 'scripts'];

// The 3 Pillars (Information/Personality/Relationships) render as one merged
// Panel, 3 columns wide. Only #panel-information exists in the DOM —
// 'personality'/'relationships' still work as names every existing caller
// can keep passing unchanged, they just resolve to the same real panel. Kept
// as an alias layer rather than touching every call site — the three names
// still mean something different (which column a caller conceptually
// wants), just not which DOM element opens.
const PANEL_ALIASES = { personality: 'information', relationships: 'information' };
function realPanelId(name){ return PANEL_ALIASES[name] || name; }

// #loading is a real full-screen blocking overlay (css/base.css's
// .loading-row) — wrapping a whole async Scene-load sequence in
// showLoading(true)/(false) hides the in-between churn of several
// sequential mutateTable() calls (spawn NPCs, create the Player Character,
// seed Mindeye/Personality, set Facing) each re-rendering as they land,
// before the camera is centered on the final state. Fades out instead of an
// instant cut: .hidden (display:none !important) can't transition — nothing
// to animate once a property goes to none — so .loading-fade-out drives a
// real opacity transition first, and .hidden only lands ~500ms later, once
// the fade has actually finished.
let loadingHideTimer = null;
export function showLoading(v){
  const el = document.getElementById('loading');
  if(!el) return;
  clearTimeout(loadingHideTimer);
  if(v){
    el.classList.remove('hidden', 'loading-fade-out');
    return;
  }
  el.classList.add('loading-fade-out');
  loadingHideTimer = setTimeout(() => el.classList.add('hidden'), 500);
}

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
  // Direct call, not reliant on the click that opened this Panel bubbling to
  // document — several Panel-opening buttons (js/craftPopup.js's
  // craft-list-item, for one) call ev.stopPropagation() first for unrelated
  // reasons, which would otherwise defeat the document-level dismiss
  // listener (js/map.js's initMapPopupDismiss) and leave the Map's own
  // popups (Move/Suggest/Craft, Occupant List) persisting behind the Panel.
  closeMapPopups();
  AppState.activePanel = realPanelId(name);
  if(name === 'combat') collapseActionMenus('');
  if(name === 'dm') collapseActionMenus('dm-');
  render();
}

export function closePanel(){
  AppState.activePanel = null;
  render();
}

export function togglePanel(name){
  if(AppState.activePanel === realPanelId(name)){
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

  // Toolbar buttons reflect which panel (if any) is currently open. All 3
  // Pillar toolbar buttons light up together now (realPanelId) — they open
  // the same merged panel, so there's no single "active" one among them.
  PANEL_IDS.forEach(id => {
    const btn = document.getElementById('toolbar-' + id);
    if(!btn) return;
    btn.classList.toggle('active', AppState.activePanel === realPanelId(id));
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
