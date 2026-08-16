import { AppState } from './state.js';

const PANEL_IDS = ['character', 'combat', 'sequencer', 'dm', 'dmtest', 'character-view', 'stats', 'techniques', 'party', 'technique-use'];

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

// Gate Combat/Sequencer availability on encounter state — DM stays reachable always,
// since starting an encounter is itself a DM action.
export function updateToolbarAvailability(){
  const inEncounter = !!(AppState.table && AppState.table.inEncounter);
  ['combat', 'sequencer'].forEach(id => {
    const btn = document.getElementById('toolbar-' + id);
    if(!btn) return;
    btn.disabled = !inEncounter;
    btn.classList.toggle('disabled', !inEncounter);
  });
  // If an in-progress panel just became unavailable (encounter ended), close it.
  if(!inEncounter && (AppState.activePanel === 'combat' || AppState.activePanel === 'sequencer')){
    closePanel();
  }
}

// Backdrop click closes whatever's open.
export function initPanelBackdrop(){
  const backdrop = document.getElementById('panel-backdrop');
  if(backdrop) backdrop.addEventListener('click', closePanel);
}
