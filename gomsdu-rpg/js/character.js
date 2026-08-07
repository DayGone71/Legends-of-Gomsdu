import { AppState } from './state.js';
import { mutateTable } from './sync.js';

export function blankCharacter(name){
  return { name, archetype: '', wounds: 7, woundsMax: 7, ap: 10, power: 1, quickness: 5, range: 3, lightning: 0, lava: 0, focus: 0, apSpent: 0, sequence: [] };
}

export const BUILDS = {
  'player-swift':   { archetype: 'Blade-quick duelist', wounds: 7,  woundsMax: 7,  ap: 20, power: 2, quickness: 9, range: 3, lightning: 0, lava: 0, focus: 0 },
  'player-heavy':   { archetype: 'Armored bruiser',      wounds: 7,  woundsMax: 7,  ap: 20, power: 2, quickness: 4, range: 3, lightning: 0, lava: 0, focus: 0 },
  'player-parry':   { archetype: 'Counter-fighter',      wounds: 7,  woundsMax: 7,  ap: 20, power: 2, quickness: 6, range: 9, lightning: 0, lava: 0, focus: 0 },
  'enemy-swift':    { archetype: 'Basic Cultist',        wounds: 3,  woundsMax: 3,  ap: 10, power: 1, quickness: 8, range: 2, lightning: 0, lava: 0, focus: 0 },
  'enemy-heavy':    { archetype: 'Cultist brute',        wounds: 5,  woundsMax: 5,  ap: 10, power: 1, quickness: 3, range: 2, lightning: 0, lava: 0, focus: 0 },
  'enemy-sorcerer': { archetype: 'Cultist Sorcerer',     wounds: 12, woundsMax: 12, ap: 50, power: 2, quickness: 5, range: 3, lightning: 0, lava: 6, focus: 6 }
};

export function loadBuild(key){
  const b = BUILDS[key];
  if(!b) return;
  document.getElementById('ch-archetype').value = b.archetype;
  document.getElementById('ch-wounds').value = b.wounds;
  document.getElementById('ch-woundsmax').value = b.woundsMax;
  document.getElementById('ch-ap').value = b.ap;
  document.getElementById('ch-power').value = b.power;
  document.getElementById('ch-quickness').value = b.quickness;
  document.getElementById('ch-range').value = b.range;
  document.getElementById('ch-lightning').value = b.lightning;
  document.getElementById('ch-lava').value = b.lava;
  document.getElementById('ch-focus').value = b.focus;
  scheduleSave();
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
  const prevSequence = me.sequence || [];
  const updated = {
    name: document.getElementById('ch-name').value.trim() || 'Unnamed',
    archetype: document.getElementById('ch-archetype').value.trim(),
    wounds: parseInt(document.getElementById('ch-wounds').value || '0', 10),
    woundsMax: parseInt(document.getElementById('ch-woundsmax').value || '1', 10),
    ap: parseInt(document.getElementById('ch-ap').value || '0', 10),
    power: parseInt(document.getElementById('ch-power').value || '0', 10),
    quickness: parseInt(document.getElementById('ch-quickness').value || '0', 10),
    range: parseInt(document.getElementById('ch-range').value || '0', 10),
    lightning: parseInt(document.getElementById('ch-lightning').value || '0', 10),
    lava: parseInt(document.getElementById('ch-lava').value || '0', 10),
    focus: parseInt(document.getElementById('ch-focus').value || '0', 10),
    apSpent: prevApSpent,
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
  document.getElementById('ch-power').value = me.power ?? 1;
  document.getElementById('ch-quickness').value = me.quickness ?? 5;
  document.getElementById('ch-range').value = me.range ?? 3;
  document.getElementById('ch-lightning').value = me.lightning ?? 0;
  document.getElementById('ch-lava').value = me.lava ?? 0;
  document.getElementById('ch-focus').value = me.focus ?? 0;

  const whoName = document.getElementById('who-name');
  if(whoName) whoName.textContent = me.name || '\u2014';
}
