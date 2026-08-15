import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { getSavedCharacters, saveCharacterTemplate } from './savedCharacters.js';
import { clampInt, timeNow } from './utils.js';

// Control and Attunement default to 0 on every existing build — meaning nothing
// about current AP costs changes for them. Only a character explicitly set to
// Control 10 gets the "every action costs 1 AP" effect (see combat.js/dm.js).
export function blankCharacter(name){
  return { name, archetype: '', wounds: 7, woundsMax: 7, ap: 10, flow: 10, flowMax: 10, recovery: 5, power: 1, quickness: 5, range: 3, lightning: 0, lava: 0, focus: 0, control: 0, attunement: 0, life: 1, apSpent: 0, focusSpent: 0, sequence: [] };
}

// Enemy Power/Flow values are canon, straight from reference/Power.txt's stat
// table (the "how strong should Characters be" roster). Everything else on each
// entry — Wounds, AP, Recovery, Quickness, Range, Control — isn't specified
// there yet, so these are reasonable placeholders scaled to each creature's
// tier, meant to be tuned once the Power brackets get rebuilt for real.
export const BUILDS = {
  'player-swift':   { archetype: 'Blade-quick duelist', wounds: 7,  woundsMax: 7,  ap: 20, flow: 12, flowMax: 12, recovery: 5, power: 2, quickness: 9, range: 3, lightning: 0, lava: 0, focus: 0, control: 0, attunement: 0 },
  'player-heavy':   { archetype: 'Armored bruiser',      wounds: 7,  woundsMax: 7,  ap: 20, flow: 16, flowMax: 16, recovery: 7, power: 2, quickness: 4, range: 3, lightning: 0, lava: 0, focus: 0, control: 0, attunement: 0 },
  'player-parry':   { archetype: 'Counter-fighter',      wounds: 7,  woundsMax: 7,  ap: 20, flow: 14, flowMax: 14, recovery: 6, power: 2, quickness: 6, range: 9, lightning: 0, lava: 0, focus: 0, control: 0, attunement: 0 },

  'human-adult':        { archetype: 'Regular Human Adult', wounds: 3, woundsMax: 3, ap: 15, flow: 7,  flowMax: 7,  recovery: 5,  power: 7,  quickness: 5, range: 4,  lightning: 0, lava: 0, focus: 0, control: 5, attunement: 0 },
  'human-farmer':        { archetype: 'Human Farmer',        wounds: 3, woundsMax: 3, ap: 15, flow: 10, flowMax: 10, recovery: 6,  power: 8,  quickness: 4, range: 3,  lightning: 0, lava: 0, focus: 0, control: 4, attunement: 0 },
  'human-bandit':        { archetype: 'Human Bandit',        wounds: 3, woundsMax: 3, ap: 20, flow: 8,  flowMax: 8,  recovery: 5,  power: 11, quickness: 7, range: 5,  lightning: 0, lava: 0, focus: 0, control: 6, attunement: 0 },
  'stray-dog':           { archetype: 'Stray Dog',            wounds: 2, woundsMax: 2, ap: 10, flow: 4,  flowMax: 4,  recovery: 4,  power: 3,  quickness: 9, range: 2,  lightning: 0, lava: 0, focus: 0, control: 3, attunement: 0 },
  'empire-recruit':      { archetype: 'Empire Recruit',       wounds: 4, woundsMax: 4, ap: 20, flow: 13, flowMax: 13, recovery: 6,  power: 13, quickness: 6, range: 5,  lightning: 0, lava: 0, focus: 0, control: 6, attunement: 0 },
  'cultist':             { archetype: 'Cultist',              wounds: 4, woundsMax: 4, ap: 25, flow: 11, flowMax: 11, recovery: 6,  power: 15, quickness: 6, range: 5,  lightning: 0, lava: 0, focus: 0, control: 6, attunement: 0 },
  'empire-soldier':      { archetype: 'Empire Soldier',       wounds: 5, woundsMax: 5, ap: 30, flow: 20, flowMax: 20, recovery: 8,  power: 19, quickness: 6, range: 7,  lightning: 0, lava: 0, focus: 0, control: 7, attunement: 0 },
  'cultist-bloodletter': { archetype: 'Cultist Bloodletter',  wounds: 5, woundsMax: 5, ap: 30, flow: 17, flowMax: 17, recovery: 7,  power: 21, quickness: 7, range: 6,  lightning: 0, lava: 0, focus: 0, control: 7, attunement: 0 },
  'woodwhisperer':       { archetype: 'Elven Woodwhisperer',  wounds: 6, woundsMax: 6, ap: 40, flow: 40, flowMax: 40, recovery: 12, power: 36, quickness: 9, range: 10, lightning: 0, lava: 0, focus: 0, control: 8, attunement: 0 },
  'sandworm':            { archetype: 'Gigantic Sandworm',    wounds: 8, woundsMax: 8, ap: 40, flow: 68, flowMax: 68, recovery: 15, power: 74, quickness: 3, range: 6,  lightning: 0, lava: 0, focus: 0, control: 5, attunement: 0 }
};

// Only fills the form fields — doesn't save. Picking a build used to call
// scheduleSave() immediately, which meant just browsing the dropdown silently
// overwrote whoever was the live active character. Now it's a preview: nothing
// becomes real until "Make Active Character" (or a manual field edit) commits it.
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
  document.getElementById('ch-flow').value = b.flowMax ?? b.flow;
  document.getElementById('ch-recovery').value = b.recovery;
  document.getElementById('ch-power').value = b.power;
  document.getElementById('ch-quickness').value = b.quickness;
  document.getElementById('ch-range').value = b.range;
  document.getElementById('ch-lightning').value = b.lightning;
  document.getElementById('ch-lava').value = b.lava;
  document.getElementById('ch-focus').value = b.focus;
  document.getElementById('ch-control').value = b.control ?? 0;
  document.getElementById('ch-attunement').value = b.attunement ?? 0;
  document.getElementById('ch-life').value = b.life ?? 1;
}

// Rebuilds the "Custom" optgroups in both the sheet's build loader and the DM's
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

// Reads the sheet's fields into a stats object, clamped to the ranges in
// reference/gomsdu-stats.odt. Wounds is deliberately left unclamped — it's
// still running on the old depleting-pool model, pending the real Wounds
// rebuild, so a 0/10-style cap doesn't apply to it yet.
function readStatsFromSheet(){
  const flowVal = clampInt(parseInt(document.getElementById('ch-flow').value || '0', 10), 0, 50);
  return {
    archetype: document.getElementById('ch-archetype').value.trim(),
    wounds: parseInt(document.getElementById('ch-wounds').value || '0', 10),
    woundsMax: parseInt(document.getElementById('ch-woundsmax').value || '1', 10),
    ap: clampInt(parseInt(document.getElementById('ch-ap').value || '0', 10), 0, 100),
    flow: flowVal,
    flowMax: flowVal,
    recovery: clampInt(parseInt(document.getElementById('ch-recovery').value || '0', 10), 0, 50),
    power: clampInt(parseInt(document.getElementById('ch-power').value || '0', 10), 0, 50),
    quickness: clampInt(parseInt(document.getElementById('ch-quickness').value || '0', 10), 0, 50),
    range: clampInt(parseInt(document.getElementById('ch-range').value || '0', 10), 0, 50),
    lightning: clampInt(parseInt(document.getElementById('ch-lightning').value || '0', 10), 0, 10),
    lava: clampInt(parseInt(document.getElementById('ch-lava').value || '0', 10), 0, 10),
    focus: clampInt(parseInt(document.getElementById('ch-focus').value || '0', 10), 0, 10),
    control: clampInt(parseInt(document.getElementById('ch-control').value || '0', 10), 0, 10),
    attunement: clampInt(parseInt(document.getElementById('ch-attunement').value || '0', 10), 0, 10),
    life: clampInt(parseInt(document.getElementById('ch-life').value || '0', 10), 0, 1)
  };
}

export function saveAsTemplate(){
  const name = document.getElementById('ch-name').value.trim();
  if(!name){ return; }
  const stats = { name, ...readStatsFromSheet() };
  saveCharacterTemplate(name, stats);
  populateSavedCharacterDropdowns();
  const hint = document.getElementById('save-hint');
  if(hint) hint.textContent = 'Saved "' + name + '" as a template';
}

let saveDebounce = null;
let saveDebouncePending = false;
export function scheduleSave(){
  const hint = document.getElementById('save-hint');
  if(hint) hint.textContent = 'Saving…';
  saveDebouncePending = true;
  clearTimeout(saveDebounce);
  saveDebounce = setTimeout(() => { saveDebouncePending = false; saveCharacter(); }, 700);
}

// Wired to each sheet field's blur. If a debounced save is still pending, leave
// it alone — that save's own post-write render (see saveCharacter) will pick
// this field up correctly once it fires, and rendering here first would read
// back the pre-edit value and hand it to that pending save, discarding what was
// just typed. If nothing's pending, there's nothing to lose, so sync immediately
// instead of waiting for some unrelated future edit to trigger a render.
export function syncFieldOnBlur(){
  if(!saveDebouncePending) renderCharacterSheet();
}

// hintText lets callers (like "Make Active Character") show a distinct
// confirmation from the ambient autosave's plain "Saved".
export async function saveCharacter(hintText, announce){
  const me = AppState.table.players[AppState.playerId] || {};
  const prevApSpent = me.apSpent || 0;
  const prevFocusSpent = me.focusSpent || 0;
  const prevSequence = me.sequence || [];
  const sheetStats = readStatsFromSheet();
  // The sheet's Flow field is a single "rating" number (flowMax); the current,
  // possibly mid-combat Flow value is preserved rather than reset by unrelated
  // edits, and just clamped down if the new max is now lower than it.
  const prevFlow = me.flow != null ? me.flow : sheetStats.flowMax;
  const updated = {
    ...sheetStats,
    name: document.getElementById('ch-name').value.trim() || 'Unnamed',
    flow: Math.min(prevFlow, sheetStats.flowMax),
    apSpent: prevApSpent,
    focusSpent: prevFocusSpent,
    sequence: prevSequence
  };
  const prevName = me.name;
  const ok = await mutateTable(t => {
    t.players[AppState.playerId] = updated;
    // Only the explicit "Make Active Character" commit announces itself — the
    // ambient autosave-on-edit would otherwise spam the Ledger on every keystroke.
    // Structured (not flat text) so the Ledger can render it as a tiered block —
    // a flat "X became the active character" line gives no sign of *what* X
    // became (archetype, rename), reading identically to a plain join/leave.
    if(announce){
      t.log.push({
        type: 'character-active', time: timeNow(),
        name: updated.name || 'Someone', archetype: updated.archetype || '',
        prevName: (prevName && prevName !== updated.name) ? prevName : null
      });
    }
  });
  const hint = document.getElementById('save-hint');
  if(hint) hint.textContent = ok ? (hintText || 'Saved') : 'Could not save';
  // Don't wait on the realtime round-trip to show the (possibly clamped) value
  // that was just written — mutateTable already updated AppState.table in
  // memory, so this reflects it immediately. Still skips whichever field, if
  // any, the user is actively typing in right now.
  renderCharacterSheet();
}

// The explicit commit action: "Make Active Character" saves immediately
// (skipping the debounce) so loading/editing a build only becomes your live
// character when you deliberately say so.
export async function makeActiveCharacter(){
  await saveCharacter('Made the active character', true);
}

// Populates the sheet's fields from live state. Whichever single field the user
// is actively typing in is left alone — everything else refreshes normally, so
// a correction (e.g. a clamped stat) landing while you're mid-edit elsewhere in
// the form isn't stuck showing a stale value until some unrelated field changes.
export function renderCharacterSheet(){
  const me = AppState.table && AppState.table.players[AppState.playerId];
  if(!me) return;
  const active = document.activeElement;
  const setIfNotActive = (id, value) => {
    const el = document.getElementById(id);
    if(el && el !== active) el.value = value;
  };

  setIfNotActive('ch-name', me.name || '');
  setIfNotActive('ch-archetype', me.archetype || '');
  setIfNotActive('ch-wounds', me.wounds ?? 7);
  setIfNotActive('ch-woundsmax', me.woundsMax ?? 7);
  setIfNotActive('ch-ap', me.ap ?? 10);
  setIfNotActive('ch-flow', me.flowMax ?? 10);
  setIfNotActive('ch-recovery', me.recovery ?? 5);
  setIfNotActive('ch-power', me.power ?? 1);
  setIfNotActive('ch-quickness', me.quickness ?? 5);
  setIfNotActive('ch-range', me.range ?? 3);
  setIfNotActive('ch-lightning', me.lightning ?? 0);
  setIfNotActive('ch-lava', me.lava ?? 0);
  setIfNotActive('ch-focus', me.focus ?? 0);
  setIfNotActive('ch-control', me.control ?? 0);
  setIfNotActive('ch-attunement', me.attunement ?? 0);
  setIfNotActive('ch-life', me.life ?? 1);

  const whoName = document.getElementById('who-name');
  if(whoName) whoName.textContent = me.name || '—';
}
