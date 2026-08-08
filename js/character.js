import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { getSavedCharacters, saveCharacterTemplate } from './savedCharacters.js';

// Control and Attunement default to 0 on every existing build — meaning nothing
// about current AP costs changes for them. Only a character explicitly set to
// Control 10 gets the "every action costs 1 AP" effect (see combat.js/dm.js).
export function blankCharacter(name){
  return { name, archetype: '', wounds: 7, woundsMax: 7, ap: 10, flow: 10, flowMax: 10, recovery: 5, power: 1, quickness: 5, range: 3, lightning: 0, lava: 0, focus: 0, control: 0, attunement: 0, apSpent: 0, focusSpent: 0, sequence: [] };
}

export const BUILDS = {
  'player-swift':   { archetype: 'Blade-quick duelist', wounds: 7,  woundsMax: 7,  ap: 20, flow: 12, flowMax: 12, recovery: 5, power: 2, quickness: 9, range: 3, lightning: 0, lava: 0, focus: 0, control: 0, attunement: 0 },
  'player-heavy':   { archetype: 'Armored bruiser',      wounds: 7,  woundsMax: 7,  ap: 20, flow: 16, flowMax: 16, recovery: 7, power: 2, quickness: 4, range: 3, lightning: 0, lava: 0, focus: 0, control: 0, attunement: 0 },
  'player-parry':   { archetype: 'Counter-fighter',      wounds: 7,  woundsMax: 7,  ap: 20, flow: 14, flowMax: 14, recovery: 6, power: 2, quickness: 6, range: 9, lightning: 0, lava: 0, focus: 0, control: 0, attunement: 0 },
  'enemy-swift':    { archetype: 'Basic Cultist',        wounds: 3,  woundsMax: 3,  ap: 10, flow: 6,  flowMax: 6,  recovery: 3, power: 1, quickness: 8, range: 2, lightning: 0, lava: 0, focus: 0, control: 0, attunement: 0 },
  'enemy-heavy':    { archetype: 'Cultist brute',        wounds: 5,  woundsMax: 5,  ap: 10, flow: 10, flowMax: 10, recovery: 5, power: 1, quickness: 3, range: 2, lightning: 0, lava: 0, focus: 0, control: 0, attunement: 0 },
  'enemy-sorcerer': { archetype: 'Cultist Sorcerer',     wounds: 12, woundsMax: 12, ap: 50, flow: 20, flowMax: 20, recovery: 8, power: 2, quickness: 5, range: 3, lightning: 0, lava: 6, focus: 6, control: 0, attunement: 0 }
};

export function loadBuild(key){
  if(!key) return;
  let b;
  if(key.startsWith('saved:')){
    b = getSavedCharacters()[key.slice(6)];
  }else{
    b = BUILDS[key];
  }
  if(!b) return;
  if(b.name) document.getElementById('ch-name').value = b.name;
  document.getElementById('ch-archetype').value = b.archetype;
  document.getElementById('ch-wounds').value = b.wounds;
  document.getElementById('ch-woundsmax').value = b.woundsMax;
  document.getElementById('ch-ap').value = b.ap;
  document.getElementById('ch-flow').value = b.flow;
  document.getElementById('ch-flowmax').value = b.flowMax;
  document.getElementById('ch-recovery').value = b.recovery;
  document.getElementById('ch-power').value = b.power;
  document.getElementById('ch-quickness').value = b.quickness;
  document.getElementById('ch-range').value = b.range;
  document.getElementById('ch-lightning').value = b.lightning;
  document.getElementById('ch-lava').value = b.lava;
  document.getElementById('ch-focus').value = b.focus;
  document.getElementById('ch-control').value = b.control ?? 0;
  document.getElementById('ch-attunement').value = b.attunement ?? 0;
  scheduleSave();
}

// Rebuilds the "Saved" optgroups in both the sheet's build loader and the DM's
// spawn picker. Called on entering a table and right after a new save, since
// localStorage has no live-update event to hook into automatically.
export function populateSavedCharacterDropdowns(){
  const saved = getSavedCharacters();
  const names = Object.keys(saved).sort();
  const optionsHtml = names.length
    ? names.map(n => '<option value="saved:' + n + '">' + n + '</option>').join('')
    : '<option value="" disabled>No saved characters yet</option>';

  const sheetGroup = document.getElementById('ch-build-saved-group');
  if(sheetGroup) sheetGroup.innerHTML = optionsHtml;

  const dmGroup = document.getElementById('dm-build-saved-group');
  if(dmGroup) dmGroup.innerHTML = optionsHtml;
}

export function saveAsTemplate(){
  const name = document.getElementById('ch-name').value.trim();
  if(!name){ return; }
  const stats = {
    name,
    archetype: document.getElementById('ch-archetype').value.trim(),
    wounds: parseInt(document.getElementById('ch-wounds').value || '0', 10),
    woundsMax: parseInt(document.getElementById('ch-woundsmax').value || '1', 10),
    ap: parseInt(document.getElementById('ch-ap').value || '0', 10),
    flow: parseInt(document.getElementById('ch-flow').value || '0', 10),
    flowMax: parseInt(document.getElementById('ch-flowmax').value || '1', 10),
    recovery: parseInt(document.getElementById('ch-recovery').value || '0', 10),
    power: parseInt(document.getElementById('ch-power').value || '0', 10),
    quickness: parseInt(document.getElementById('ch-quickness').value || '0', 10),
    range: parseInt(document.getElementById('ch-range').value || '0', 10),
    lightning: parseInt(document.getElementById('ch-lightning').value || '0', 10),
    lava: parseInt(document.getElementById('ch-lava').value || '0', 10),
    focus: parseInt(document.getElementById('ch-focus').value || '0', 10),
    control: parseInt(document.getElementById('ch-control').value || '0', 10),
    attunement: parseInt(document.getElementById('ch-attunement').value || '0', 10)
  };
  saveCharacterTemplate(name, stats);
  populateSavedCharacterDropdowns();
  const hint = document.getElementById('save-hint');
  if(hint) hint.textContent = 'Saved "' + name + '" as a template';
}

let saveDebounce = null;
export function scheduleSave(){
  const hint = document.getElementById('save-hint');
  if(hint) hint.textContent = 'Saving\u2026';
  clearTimeout(saveDebounce);
  saveDebounce = setTimeout(saveCharacter, 700);
}

export async function saveCharacter(){
  const me = AppState.table.players[AppState.playerId] || {};
  const prevApSpent = me.apSpent || 0;
  const prevFocusSpent = me.focusSpent || 0;
  const prevSequence = me.sequence || [];
  const updated = {
    name: document.getElementById('ch-name').value.trim() || 'Unnamed',
    archetype: document.getElementById('ch-archetype').value.trim(),
    wounds: parseInt(document.getElementById('ch-wounds').value || '0', 10),
    woundsMax: parseInt(document.getElementById('ch-woundsmax').value || '1', 10),
    ap: parseInt(document.getElementById('ch-ap').value || '0', 10),
    flow: parseInt(document.getElementById('ch-flow').value || '0', 10),
    flowMax: parseInt(document.getElementById('ch-flowmax').value || '1', 10),
    recovery: parseInt(document.getElementById('ch-recovery').value || '0', 10),
    power: parseInt(document.getElementById('ch-power').value || '0', 10),
    quickness: parseInt(document.getElementById('ch-quickness').value || '0', 10),
    range: parseInt(document.getElementById('ch-range').value || '0', 10),
    lightning: parseInt(document.getElementById('ch-lightning').value || '0', 10),
    lava: parseInt(document.getElementById('ch-lava').value || '0', 10),
    focus: parseInt(document.getElementById('ch-focus').value || '0', 10),
    control: parseInt(document.getElementById('ch-control').value || '0', 10),
    attunement: parseInt(document.getElementById('ch-attunement').value || '0', 10),
    apSpent: prevApSpent,
    focusSpent: prevFocusSpent,
    sequence: prevSequence
  };
  const ok = await mutateTable(t => { t.players[AppState.playerId] = updated; });
  const hint = document.getElementById('save-hint');
  if(hint) hint.textContent = ok ? 'Saved' : 'Could not save';
}

// Populates the sheet's fields from live state — skipped while the user is actively
// typing in this or any other field, same guard as the original prototype.
export function renderCharacterSheet(){
  const me = AppState.table && AppState.table.players[AppState.playerId];
  if(!me) return;
  const active = document.activeElement;
  if(active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

  document.getElementById('ch-name').value = me.name || '';
  document.getElementById('ch-archetype').value = me.archetype || '';
  document.getElementById('ch-wounds').value = me.wounds ?? 7;
  document.getElementById('ch-woundsmax').value = me.woundsMax ?? 7;
  document.getElementById('ch-ap').value = me.ap ?? 10;
  document.getElementById('ch-flow').value = me.flow ?? 10;
  document.getElementById('ch-flowmax').value = me.flowMax ?? 10;
  document.getElementById('ch-recovery').value = me.recovery ?? 5;
  document.getElementById('ch-power').value = me.power ?? 1;
  document.getElementById('ch-quickness').value = me.quickness ?? 5;
  document.getElementById('ch-range').value = me.range ?? 3;
  document.getElementById('ch-lightning').value = me.lightning ?? 0;
  document.getElementById('ch-lava').value = me.lava ?? 0;
  document.getElementById('ch-focus').value = me.focus ?? 0;
  document.getElementById('ch-control').value = me.control ?? 0;
  document.getElementById('ch-attunement').value = me.attunement ?? 0;

  const whoName = document.getElementById('who-name');
  if(whoName) whoName.textContent = me.name || '\u2014';
}
