import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { getSavedCharacters, saveCharacterTemplate } from './savedCharacters.js';
import { clampInt, timeNow, flashHint, isDown, escapeHtml, bornMindeyeEntries } from './utils.js';
import { addPossessor, addMiniPartyMember } from './possession.js';
import { possessorGridHtml, miniPartyGridHtml, wirePossessorMiniPartyClicks } from './possessionView.js';
import { showCharacterView } from './characterView.js';
import { FACING_DEFAULT } from './map.js';

// Species: the immutable structural defaults a Character starts from — Death
// Wounds (z, the wound count that kills — NOT Obliteration, which is every
// Body Part going false), Body Part count, which Tier 5 entity(ies) occupy
// the sandwich model's top row and on which side, and the stat Caps
// readStatsFromSheet clamps to.
export const SPECIES = {
  humanoid: {
    name: 'Humanoid', // General Humanoids: Human, Dwarf, Elf, Ork
    deathWounds: 10, bodyParts: 6,
    tier5: { left: 'gom', right: 'kulkrow' },
    caps: { ap: [0, 100], flow: [0, 50], recovery: [0, 50], power: [0, 50], quickness: [0, 50], resilience: [0, 50], lightning: [0, 10], lava: [0, 10], focus: [0, 10], control: [0, 10], attunement: [0, 10] }
  },
  sandman: {
    name: 'Sandman',
    deathWounds: 10, bodyParts: 6,
    tier5: { left: null, right: 'planet' }, // the Planet, not Gom/Kulkrow — Sandmen connect straight to Tier 6
    caps: { ap: [0, 100], flow: [0, 50], recovery: [0, 50], power: [0, 50], quickness: [0, 50], resilience: [0, 50], lightning: [0, 10], lava: [0, 10], focus: [0, 10], control: [0, 10], attunement: [0, 10] }
  },
  crystalBeing: {
    name: 'Crystal Being',
    deathWounds: 15, bodyParts: 8, // additional Torso + Skull
    tier5: { left: 'gom', right: null },
    caps: { ap: [0, 120], flow: [0, 65], recovery: [0, 60], power: [0, 65], quickness: [0, 50], resilience: [0, 65], lightning: [0, 10], lava: [0, 10], focus: [0, 12], control: [0, 10], attunement: [0, 12] }
  },
  desertAbomination: {
    name: 'Desert Abomination',
    deathWounds: 20, bodyParts: 10, // 4 Arms, Tails, 3 Torsos combined to 1 base part
    tier5: { left: null, right: 'kulkrow' },
    caps: { ap: [0, 150], flow: [0, 85], recovery: [0, 70], power: [0, 85], quickness: [0, 50], resilience: [0, 85], lightning: [0, 10], lava: [0, 10], focus: [0, 10], control: [0, 10], attunement: [0, 10] }
  },
  rock: {
    name: 'Rock', // the Living Stone's actual Species — "Living Stone" is the archetype/flavor name
    deathWounds: 10, bodyParts: 1,
    tier5: { left: 'gom', right: null }, // recognize only Gom as their Creator — no Kulkrow connection
    caps: { ap: [0, 100], flow: [0, 50], recovery: [0, 50], power: [0, 50], quickness: [0, 50], resilience: [0, 50], lightning: [0, 10], lava: [0, 10], focus: [0, 10], control: [0, 10], attunement: [0, 10] }
  },
  microSingularity: {
    name: 'Micro-Singularity', // Gom's (and Kulkrow's) own Species
    deathWounds: 10, bodyParts: 1,
    tier5: { left: null, right: null }, // doesn't apply to Gom/Kulkrow themselves
    caps: { ap: [0, 100], flow: [0, 50], recovery: [0, 50], power: [0, 50], quickness: [0, 50], resilience: [0, 50], lightning: [0, 10], lava: [0, 10], focus: [0, 10], control: [0, 10], attunement: [0, 100] } // Attunement uncapped-ish — Gom's own sheet runs 100
  }
};

// #ch-species is a hidden input carrying the real key; this syncs the visible
// display span alongside it. Call any time the value is set programmatically.
function updateSpeciesDisplay(){
  const key = document.getElementById('ch-species').value || 'humanoid';
  const display = document.getElementById('ch-species-display');
  if(display) display.textContent = (SPECIES[key] || SPECIES.humanoid).name;
}

// Bakes a species' deathWounds/body defaults into a Character's own literal
// (full denormalization — every Character carries its own copy of every
// stat). speciesKey may be null/unrecognized (Stray Dog, Sandworm) — those
// skip species/deathWounds/body and fall back to DEATH_WOUNDS_DEFAULT at combat time.
function withSpecies(speciesKey, stats){
  const sp = SPECIES[speciesKey];
  if(!sp) return { ...stats };
  return { species: speciesKey, deathWounds: sp.deathWounds, body: new Array(sp.bodyParts).fill(true), ...stats };
}

// Wounds (x) starts at 0 — counts UP toward woundsMax (y), not down from a
// depleting pool. Every new Character defaults to a real, fully-statted
// Living Stone (not a blank Humanoid) — a joining Player doesn't get a say in
// the table's Scene, so this makes "join mid-Scene" simple. archetype stays
// blank on purpose — that's what gates Create-a-Character's auto-open (see
// enterTable() in main.js).
export function blankCharacter(name){
  const b = BUILDS['living-stone'];
  if(b){
    return withSpecies(b.species || 'rock', {
      name, archetype: '', wounds: 0, woundsMax: b.woundsMax, ap: b.ap, flow: b.flowMax, flowMax: b.flowMax,
      recovery: b.recovery, power: b.power, quickness: b.quickness, resilience: b.resilience,
      lightning: b.lightning, lava: b.lava, focus: b.focus, control: b.control ?? 0, attunement: b.attunement ?? 0,
      life: b.life ?? 1, apSpent: 0, focusSpent: 0, sequence: [], possessors: [], miniParty: [], facing: FACING_DEFAULT
    });
  }
  // Defensive fallback only — BUILDS finishes loading (top-level await)
  // before this module is importable, so 'living-stone' is always real by call time.
  return withSpecies('rock', { name, archetype: '', wounds: 0, woundsMax: 1, ap: 0, flow: 0, flowMax: 0, recovery: 0, power: 0, quickness: 0, resilience: 1, lightning: 1, lava: 0, focus: 0, control: 0, attunement: 1, life: 1, apSpent: 0, focusSpent: 0, sequence: [], possessors: [], miniParty: [], facing: FACING_DEFAULT });
}

// BUILDS loads from data/characters.json (authored in bulk via a spreadsheet
// — see tools/) instead of a hardcoded literal. Each JSON row only carries
// what actually varies; wounds/flow/apSpent/focusSpent/sequence get filled in
// here. Top-level await: this module (and anything importing it) won't
// finish evaluating until the fetch resolves — nothing should render a Build
// picker before BUILDS is real.
const CHARACTERS_DATA = await fetch('/data/characters.json').then(r => r.json());
export const BUILDS = Object.fromEntries(
  Object.entries(CHARACTERS_DATA).map(([key, row]) => {
    const { species, ...rest } = row;
    return [key, withSpecies(species, { wounds: 0, flow: rest.flowMax, ...rest })];
  })
);

// The one shared way any Character (NPC, Enemy, Yom) gets built from a Build
// template. Doesn't touch table.positions or naming/counting — those depend
// on what's already on the table, which this function has no business knowing.
export function spawnCharacter(build, overrides = {}){
  if(!build) return null;
  return {
    archetype: build.archetype, name: overrides.name || build.archetype, num: overrides.num,
    wounds: 0, woundsMax: build.woundsMax, ap: build.ap, flow: build.flowMax, flowMax: build.flowMax,
    recovery: build.recovery, power: build.power, quickness: build.quickness, resilience: build.resilience,
    lightning: build.lightning, lava: build.lava, focus: build.focus, control: build.control ?? 0,
    attunement: build.attunement ?? 0, life: build.life ?? 1, species: build.species, deathWounds: build.deathWounds,
    body: build.body ? [...build.body] : undefined, techniqueAccess: build.techniqueAccess,
    personality: build.personality ? JSON.parse(JSON.stringify(build.personality)) : undefined,
    passiveSpill: build.passiveSpill,
    apSpent: 0, focusSpent: 0, sequence: [], possessedBy: null,
    facing: overrides.facing || FACING_DEFAULT,
    mindeye: bornMindeyeEntries(build.startingMindeye)
  };
}

// Only fills the form fields — doesn't save. A preview: nothing becomes real
// until "Make Active Character" (or a manual field edit) commits it.
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
  document.getElementById('ch-species').value = b.species || 'humanoid';
  updateSpeciesDisplay();
  document.getElementById('ch-archetype').value = b.archetype;
  document.getElementById('ch-wounds').value = b.wounds;
  document.getElementById('ch-woundsmax').value = b.woundsMax;
  document.getElementById('ch-ap').value = b.ap;
  document.getElementById('ch-flow').value = b.flowMax ?? b.flow;
  document.getElementById('ch-recovery').value = b.recovery;
  document.getElementById('ch-power').value = b.power;
  document.getElementById('ch-quickness').value = b.quickness;
  document.getElementById('ch-resilience').value = b.resilience;
  document.getElementById('ch-lightning').value = b.lightning;
  document.getElementById('ch-lava').value = b.lava;
  document.getElementById('ch-focus').value = b.focus;
  document.getElementById('ch-control').value = b.control ?? 0;
  document.getElementById('ch-attunement').value = b.attunement ?? 0;
  document.getElementById('ch-life').value = b.life ?? 1;
}

// Populates the Player/Custom-bracketing optgroups of both build pickers from
// BUILDS itself. Call once at startup, before populateSavedCharacterDropdowns.
//
// Category is free text — every distinct Category value present in BUILDS
// gets its own dynamically-labeled optgroup (rebuilt each call so the list
// never drifts from BUILDS). "player" stays special-cased as Create-a-
// Character's own optgroup; the DM spawn picker never shows it.
function labelForCategory(category){
  return category.charAt(0).toUpperCase() + category.slice(1);
}
function rebuildDynamicCategoryGroups(select, anchor, categories){
  if(!select || !anchor) return;
  select.querySelectorAll('optgroup[data-dynamic-category]').forEach(g => g.remove());
  categories.forEach(cat => {
    const group = document.createElement('optgroup');
    group.label = labelForCategory(cat);
    group.dataset.dynamicCategory = 'true';
    group.innerHTML = Object.entries(BUILDS)
      .filter(([, b]) => (b.category || 'enemy') === cat)
      .map(([key, b]) => '<option value="' + key + '">' + escapeHtml(b.archetype || key) + '</option>').join('');
    select.insertBefore(group, anchor);
  });
}
export function populateBuildDropdowns(){
  const chLoader = document.getElementById('ch-build-loader');
  const chPlayer = document.getElementById('ch-build-player-group');
  if(chLoader) chLoader.querySelectorAll('[data-dynamic-category], [data-scene-restricted]').forEach(el => el.remove());
  if(chPlayer) chPlayer.innerHTML = '';

  // Scene restriction (e.g. Era 1: only Gom/Living Stone) — flat options, no
  // optgroup. Only the Character panel's own loader is restricted; the DM's
  // spawn picker always shows everything.
  const restriction = AppState.sceneBuildRestriction;
  if(restriction){
    const anchor = document.getElementById('ch-build-saved-group');
    restriction.forEach(key => {
      const b = BUILDS[key];
      if(!b || !chLoader) return;
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = b.archetype || key;
      opt.dataset.sceneRestricted = 'true';
      chLoader.insertBefore(opt, anchor);
    });
    rebuildDynamicCategoryGroups(document.getElementById('dm-enemy-build-picker'), document.getElementById('dm-build-saved-group'),
      [...new Set(Object.values(BUILDS).map(b => (b.category || 'enemy').trim() || 'enemy'))].filter(c => c !== 'player').sort());
    return;
  }

  const allCategories = [...new Set(Object.values(BUILDS).map(b => (b.category || 'enemy').trim() || 'enemy'))].sort();
  const nonPlayerCategories = allCategories.filter(c => c !== 'player');

  if(chPlayer) chPlayer.innerHTML = Object.entries(BUILDS)
    .filter(([, b]) => (b.category || 'enemy') === 'player')
    .map(([key, b]) => '<option value="' + key + '">' + escapeHtml(b.archetype || key) + '</option>').join('');

  rebuildDynamicCategoryGroups(chLoader, document.getElementById('ch-build-saved-group'), nonPlayerCategories);
  rebuildDynamicCategoryGroups(document.getElementById('dm-enemy-build-picker'), document.getElementById('dm-build-saved-group'), nonPlayerCategories);
}

// Rebuilds the "Custom" optgroups in both the sheet's build loader and the DM's
// spawn picker. Called on entering a table and right after a new save, since
// localStorage has no live-update event to hook into.
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

// Per-Character access at the category level (Flow Powers/Focus Powers/
// Lightning Crafts/Lava Crafts). Keys double as the `ch-tech-<key>` checkbox id suffix.
export const TECHNIQUE_CATEGORIES = ['flowPowers', 'focusPowers', 'lightningCrafts', 'lavaCrafts'];

// Reads the sheet's fields into a stats object, clamped to each stat's real
// Species Cap. Wounds (x) clamps 0-deathWounds; deathWounds (z) and Body come
// straight from the chosen Species (not independently sheet-editable).
function readStatsFromSheet(){
  const speciesKey = document.getElementById('ch-species').value || 'humanoid';
  const sp = SPECIES[speciesKey] || SPECIES.humanoid;
  const flowVal = clampInt(parseInt(document.getElementById('ch-flow').value || '0', 10), sp.caps.flow[0], sp.caps.flow[1]);
  // techniqueAccess deliberately NOT read here — the sheet's checkboxes are
  // the old 4-category model, which no longer matches per-Technique access.
  // Omitting the key leaves the real object (set at spawn time) alone rather
  // than overwriting it with a stale one that would deny every real Technique.
  return {
    archetype: document.getElementById('ch-archetype').value.trim(),
    species: speciesKey,
    deathWounds: sp.deathWounds,
    body: new Array(sp.bodyParts).fill(true),
    wounds: clampInt(parseInt(document.getElementById('ch-wounds').value || '0', 10), 0, sp.deathWounds),
    woundsMax: parseInt(document.getElementById('ch-woundsmax').value || '1', 10),
    ap: clampInt(parseInt(document.getElementById('ch-ap').value || '0', 10), sp.caps.ap[0], sp.caps.ap[1]),
    flow: flowVal,
    flowMax: flowVal,
    recovery: clampInt(parseInt(document.getElementById('ch-recovery').value || '0', 10), sp.caps.recovery[0], sp.caps.recovery[1]),
    power: clampInt(parseInt(document.getElementById('ch-power').value || '0', 10), sp.caps.power[0], sp.caps.power[1]),
    quickness: clampInt(parseInt(document.getElementById('ch-quickness').value || '0', 10), sp.caps.quickness[0], sp.caps.quickness[1]),
    resilience: clampInt(parseInt(document.getElementById('ch-resilience').value || '0', 10), sp.caps.resilience[0], sp.caps.resilience[1]),
    lightning: clampInt(parseInt(document.getElementById('ch-lightning').value || '0', 10), sp.caps.lightning[0], sp.caps.lightning[1]),
    lava: clampInt(parseInt(document.getElementById('ch-lava').value || '0', 10), sp.caps.lava[0], sp.caps.lava[1]),
    focus: clampInt(parseInt(document.getElementById('ch-focus').value || '0', 10), sp.caps.focus[0], sp.caps.focus[1]),
    control: clampInt(parseInt(document.getElementById('ch-control').value || '0', 10), sp.caps.control[0], sp.caps.control[1]),
    attunement: clampInt(parseInt(document.getElementById('ch-attunement').value || '0', 10), sp.caps.attunement[0], sp.caps.attunement[1]),
    life: clampInt(parseInt(document.getElementById('ch-life').value || '0', 10), 0, 1)
  };
}

export function saveAsTemplate(){
  const name = document.getElementById('ch-name').value.trim();
  if(!name){ return; }
  const stats = { name, ...readStatsFromSheet() };
  saveCharacterTemplate(name, stats);
  populateSavedCharacterDropdowns();
  flashHint('save-hint', 'Saved "' + name + '" as a template');
}

let saveDebounce = null;
let saveDebouncePending = false;
export function scheduleSave(){
  saveDebouncePending = true;
  clearTimeout(saveDebounce);
  saveDebounce = setTimeout(() => { saveDebouncePending = false; saveCharacter(); }, 700);
}

// Wired to each sheet field's blur. If a debounced save is still pending,
// leave it alone — rendering here first would read back the pre-edit value
// and hand it to that pending save. If nothing's pending, sync immediately.
export function syncFieldOnBlur(){
  if(!saveDebouncePending) renderCharacterSheet();
}

// hintText lets callers (like "Make Active Character") show a distinct
// confirmation from the ambient autosave's plain "Saved".
export async function saveCharacter(hintText, announce){
  const me = AppState.table.players[AppState.playerId] || {};
  const sheetStats = readStatsFromSheet();
  // The sheet's Flow field is a single "rating" (flowMax); the current,
  // possibly mid-combat Flow value is preserved, just clamped if the new max is lower.
  const prevFlow = me.flow != null ? me.flow : sheetStats.flowMax;
  // Spreading `me` first and layering the sheet's own fields on top means
  // every runtime field the sheet doesn't own (mindeye, personality,
  // shadowLinks, facing, etc.) survives by construction — a future new field
  // doesn't need its own hand-added exception here.
  const updated = {
    ...me,
    ...sheetStats,
    name: document.getElementById('ch-name').value.trim() || 'Unnamed',
    flow: Math.min(prevFlow, sheetStats.flowMax)
  };
  const prevName = me.name;
  const ok = await mutateTable(t => {
    t.players[AppState.playerId] = updated;
    // Only the explicit "Make Active Character" commit announces itself — the
    // ambient autosave would otherwise spam the Ledger on every keystroke.
    if(announce){
      t.log.push({
        type: 'character-active', time: timeNow(),
        name: updated.name || 'Someone', archetype: updated.archetype || '',
        prevName: (prevName && prevName !== updated.name) ? prevName : null
      });
    }
  });
  if(ok) flashHint('save-hint', hintText || 'Saved'); else flashHint('save-hint', 'Could not save', true);
  // Don't wait on the realtime round-trip — mutateTable already updated
  // AppState.table in memory. Still skips whichever field the user is actively typing in.
  renderCharacterSheet();
}

// The explicit commit action: saves immediately (skipping the debounce) so
// loading/editing a build only becomes your live character when you deliberately say so.
export async function makeActiveCharacter(){
  await saveCharacter('Made the active character', true);
}

// Populates the sheet's fields from live state. Whichever field the user is
// actively typing in is left alone.
export function renderCharacterSheet(){
  const me = AppState.table && AppState.table.players[AppState.playerId];
  if(!me) return;
  const active = document.activeElement;
  const setIfNotActive = (id, value) => {
    const el = document.getElementById(id);
    if(el && el !== active) el.value = value;
  };

  setIfNotActive('ch-name', me.name || '');
  setIfNotActive('ch-species', me.species || 'humanoid');
  updateSpeciesDisplay();
  setIfNotActive('ch-archetype', me.archetype || '');
  setIfNotActive('ch-wounds', me.wounds ?? 0);
  setIfNotActive('ch-woundsmax', me.woundsMax ?? 7);
  setIfNotActive('ch-ap', me.ap ?? 10);
  setIfNotActive('ch-flow', me.flowMax ?? 10);
  setIfNotActive('ch-recovery', me.recovery ?? 5);
  setIfNotActive('ch-power', me.power ?? 1);
  setIfNotActive('ch-quickness', me.quickness ?? 5);
  setIfNotActive('ch-resilience', me.resilience ?? 3);
  setIfNotActive('ch-lightning', me.lightning ?? 0);
  setIfNotActive('ch-lava', me.lava ?? 0);
  setIfNotActive('ch-focus', me.focus ?? 0);
  setIfNotActive('ch-control', me.control ?? 0);
  setIfNotActive('ch-attunement', me.attunement ?? 0);
  setIfNotActive('ch-life', me.life ?? 1);

  // Category-level checkboxes only — techniqueAccess moved to per-Technique
  // granularity. This sheet UI is dormant along with the rest of
  // Create-a-Character (on hold until Second Era).
  TECHNIQUE_CATEGORIES.forEach(key => {
    const el = document.getElementById('ch-tech-' + key);
    if(el && el !== active) el.checked = me.techniqueAccess ? (me.techniqueAccess[key] ?? true) : true;
  });

  const downEl = document.getElementById('ch-down-display');
  if(downEl) downEl.textContent = isDown(me) ? 'Y' : 'N';
  const bodyEl = document.getElementById('ch-body-display');
  if(bodyEl) bodyEl.textContent = me.body ? (me.body.filter(Boolean).length + '/' + me.body.length) : '—';

  const whoName = document.getElementById('who-name');
  if(whoName) whoName.textContent = me.name || '—';
}

// Same engine as the Roster's addPossessor/addMiniPartyMember, just always
// targeting the current Player's own record, so Create-a-Character can
// generate a whole family in one sitting. DM-side equivalent doesn't exist yet.
let chAddPartyKind = null; // 'possessor' | 'miniparty'

function chShowAddPartyFields(kind){
  chAddPartyKind = kind;
  document.getElementById('ch-add-party-fields').classList.remove('hidden');
  document.getElementById('ch-add-party-tier-field').classList.toggle('hidden', kind !== 'possessor');
  document.getElementById('ch-add-party-type-field').classList.toggle('hidden', kind !== 'possessor');
  document.getElementById('ch-add-party-name').value = '';
  document.getElementById('ch-add-party-build').value = '';
}

async function chConfirmAddPartyMember(){
  if(!chAddPartyKind || !AppState.playerId) return;
  const name = document.getElementById('ch-add-party-name').value.trim();
  if(!name) return;
  const buildKey = document.getElementById('ch-add-party-build').value;
  const stats = buildKey ? { ...BUILDS[buildKey] } : {};
  if(chAddPartyKind === 'possessor'){
    const tier = parseInt(document.getElementById('ch-add-party-tier').value, 10);
    const type = document.getElementById('ch-add-party-type').value;
    await addPossessor(AppState.playerId, name, tier, type, stats);
  }else{
    await addMiniPartyMember(AppState.playerId, name, stats);
  }
  document.getElementById('ch-add-party-fields').classList.add('hidden');
  chAddPartyKind = null;
}

// Wires Create-a-Character's own Add-Party instance — separate element ids
// from the Roster's shared fields, so the two don't fight over hidden/shown state.
export function initCreateCharacterPartyUI(){
  const buildOptions = Object.entries(BUILDS).map(([key, b]) => '<option value="' + key + '">' + b.archetype + '</option>').join('');
  document.getElementById('ch-add-party-build').innerHTML = '<option value="">&mdash; blank &mdash;</option>' + buildOptions;
  document.getElementById('ch-add-party-kind-possessor').addEventListener('click', () => chShowAddPartyFields('possessor'));
  document.getElementById('ch-add-party-kind-miniparty').addEventListener('click', () => chShowAddPartyFields('miniparty'));
  document.getElementById('btn-ch-confirm-add-party-member').addEventListener('click', chConfirmAddPartyMember);
}

// Renders the current Player's own Possessor/Mini-Party grids inside
// Create-a-Character — same shared renderer the Roster and read-only
// Character Sheet use, just always scoped to AppState.playerId.
export function renderCreateCharacterParty(){
  const me = AppState.table && AppState.table.players[AppState.playerId];
  const possessorEl = document.getElementById('ch-possessor-grid');
  const miniPartyEl = document.getElementById('ch-miniparty-grid');
  if(!me || !possessorEl || !miniPartyEl) return;
  possessorEl.innerHTML = possessorGridHtml(me, AppState.playerId);
  miniPartyEl.innerHTML = miniPartyGridHtml(me, AppState.playerId);
  wirePossessorMiniPartyClicks(document.getElementById('panel-character'), showCharacterView);
}
