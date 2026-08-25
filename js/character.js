import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { getSavedCharacters, saveCharacterTemplate } from './savedCharacters.js';
import { clampInt, timeNow, flashHint, isDown, escapeHtml, bornMindeyeEntries } from './utils.js';
import { addPossessor, addMiniPartyMember } from './possession.js';
import { possessorGridHtml, miniPartyGridHtml, wirePossessorMiniPartyClicks } from './possessionView.js';
import { showCharacterView } from './characterView.js';
import { FACING_DEFAULT } from './map.js';

// Species (2026-08-16): the immutable structural defaults a Character starts
// from — Death Wounds (z, the wound count that kills — NOT the same thing as
// Obliteration, which is reserved for every Body Part going false, see
// utils.js), Body Part count, which Tier 5 entity(ies) occupy the sandwich
// model's top row and on which side (see Party System item C in the
// roadmap), and the stat Caps readStatsFromSheet clamps to. Every existing
// BUILDS entry/Cap was already tuned toward General Humanoids without saying
// so — this makes that explicit instead of assumed. Caps for the three new
// species are rough placeholders scaled off their Death Wounds/Body numbers,
// dDd's own call ("I don't have concrete numbers for that yet either") —
// tune freely, same treatment as Shadow Possession's thresholds.
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
    name: 'Rock', // The Living Stone's actual Species — see gomsdu-codex.md's "Making the Living Stone"; "Living Stone" itself is the archetype/flavor name, per creator
    deathWounds: 10, bodyParts: 1, // corrected, per creator — not the Humanoid-standard 6
    tier5: { left: 'gom', right: null }, // "recognize only Gom as their Creator" — no Kulkrow connection at all
    caps: { ap: [0, 100], flow: [0, 50], recovery: [0, 50], power: [0, 50], quickness: [0, 50], resilience: [0, 50], lightning: [0, 10], lava: [0, 10], focus: [0, 10], control: [0, 10], attunement: [0, 10] } // per creator, "can stay for now"
  },
  microSingularity: {
    name: 'Micro-Singularity', // Gom's (and Kulkrow's) own Species — see gomsdu-codex.md Cosmology, "a tiny White Orb"
    deathWounds: 10, bodyParts: 1, // corrected 2026-08-23, per creator — same treatment as Rock: "Gom should also only have 1 Body Part, cause of his Species," not the Humanoid-standard 6
    tier5: { left: null, right: null }, // doesn't apply to Gom/Kulkrow themselves
    // attunement corrected 2026-08-23, per creator — Gom's real sheet runs Attunement 100; the old
    // [0,10] cap (copied from Humanoid) silently clamped it down to 10 on any sheet save.
    caps: { ap: [0, 100], flow: [0, 50], recovery: [0, 50], power: [0, 50], quickness: [0, 50], resilience: [0, 50], lightning: [0, 10], lava: [0, 10], focus: [0, 10], control: [0, 10], attunement: [0, 100] }
  }
};

// Species is no longer Player-selectable (2026-08-20, per dDd — "should just
// be a very small flavor text item"): #ch-species is a hidden input, still
// carrying the real key everything else here reads, with a plain <span>
// alongside it showing the human-readable name. Call this any time
// #ch-species's own value gets set programmatically (loadBuild,
// renderCharacterSheet) so the two never drift apart.
function updateSpeciesDisplay(){
  const key = document.getElementById('ch-species').value || 'humanoid';
  const display = document.getElementById('ch-species-display');
  if(display) display.textContent = (SPECIES[key] || SPECIES.humanoid).name;
}

// Bakes a species' deathWounds/body defaults into a Character's own literal
// (this codebase's established pattern is full denormalization — every
// Character carries its own copy of every stat, nothing is looked up live
// off a shared template at runtime) rather than repeating them by hand on
// every entry. `speciesKey` may be null/unrecognized (Stray Dog, Sandworm —
// see BUILDS below) — those entries just skip species/deathWounds/body
// entirely and fall back to utils.js's DEATH_WOUNDS_DEFAULT at combat time.
function withSpecies(speciesKey, stats){
  const sp = SPECIES[speciesKey];
  if(!sp) return { ...stats };
  return { species: speciesKey, deathWounds: sp.deathWounds, body: new Array(sp.bodyParts).fill(true), ...stats };
}

// Control and Attunement default to 0 on every existing build — meaning nothing
// about current AP costs changes for them. Only a character explicitly set to
// Control 10 gets the "every action costs 1 AP" effect (see combat.js/dm.js).
// Wounds (x) starts at 0 — the real x/y model counts UP from uninjured toward
// woundsMax (y, the personal Down threshold), not down from a depleting pool.
// Defaults to a Living Stone (2026-08-20, per dDd) rather than a generic
// Humanoid — every new Character, table-creator or later joiner alike,
// starts as a real, fully-statted Living Stone matching the "living-stone"
// Build exactly, not just a Species tag on old placeholder numbers. Per
// dDd: a joining Player doesn't get a say in the table's Scene (only
// whoever created it does — see js/scenes.js), so giving them a real
// default identity outright, rather than a blank Humanoid, is what makes
// that "join mid-Scene" edge case simple instead of needing its own
// Scene-aware join logic. archetype stays blank on purpose — the existing
// "genuinely new Character" auto-open of Create-a-Character (see
// enterTable() in main.js) keys off that, so a joiner still gets the
// familiar prompt to personalize their Role text even though their stats
// already work.
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
  // before this module is even importable, so 'living-stone' is always
  // real by the time blankCharacter() is actually called.
  return withSpecies('rock', { name, archetype: '', wounds: 0, woundsMax: 1, ap: 0, flow: 0, flowMax: 0, recovery: 0, power: 0, quickness: 0, resilience: 1, lightning: 1, lava: 0, focus: 0, control: 0, attunement: 1, life: 1, apSpent: 0, focusSpent: 0, sequence: [], possessors: [], miniParty: [], facing: FACING_DEFAULT });
}

// Character Templates (2026-08-16) — BUILDS now loads from data/characters.json
// instead of a hardcoded literal, specifically so it can be authored in bulk
// via a spreadsheet (reference/README or ROADMAP has the pipeline) instead of
// hand-edited JS. Enemy Power/Flow values are canon, straight from
// reference/Power.txt's stat table; everything else on each entry isn't
// specified there yet, so these are reasonable placeholders scaled to each
// creature's tier, meant to be tuned once the Power brackets get rebuilt for
// real. Each JSON row only needs to carry what actually varies — `wounds`
// (always starts 0, a fresh Build is uninjured), `flow` (mirrors flowMax),
// `apSpent`/`focusSpent`/`sequence` (always empty/0 for a fresh Build) all
// get filled in here rather than repeated in every row. A row's `species`
// (null for Stray Dog/Sandworm, which don't fit any of the four defined
// species yet — a "Beast" species or similar is still open) drives
// `deathWounds`/`body` via withSpecies, same as blankCharacter above.
// Top-level await: this module (and anything importing it — dm.js, ledger.js,
// main.js) won't finish evaluating until the fetch resolves, which is exactly
// what's wanted — nothing should render a Build picker before BUILDS is real.
const CHARACTERS_DATA = await fetch('/data/characters.json').then(r => r.json());
export const BUILDS = Object.fromEntries(
  Object.entries(CHARACTERS_DATA).map(([key, row]) => {
    const { species, ...rest } = row;
    return [key, withSpecies(species, { wounds: 0, flow: rest.flowMax, ...rest })];
  })
);

// spawnCharacter() (2026-08-24, per dDd) — the one shared way any Character
// (NPC, Enemy, Yom, and eventually the Player too) gets built from a Build
// template, replacing 4 near-identical hand-copied literals (js/combat.js's
// spawnBuildAt, js/dm.js's addEnemy, js/scenes.js's spawnNpc and spawnYom).
// Those had already silently dropped a new BUILDS field on spawn 3 separate
// times before today (species/personality, then mindeye, then passiveSpill —
// spawnBuildAt specifically was still missing personality AND mindeye
// entirely) — one function now means one place to update, not three-going-
// on-four. Doesn't touch table.positions or the naming/counting logic
// ("Gom #1", etc.) — those stay the caller's job, since they depend on
// what's already on the table, which this function has no business knowing.
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

// Populates the Player/Custom-bracketing optgroups of both build pickers
// from BUILDS itself (2026-08-16) — now that BUILDS loads from
// data/characters.json instead of a hardcoded literal, a static HTML option
// list would silently miss anything a spreadsheet edit adds. Call once at
// startup, before populateSavedCharacterDropdowns (below) fills in the
// separate "Custom" optgroup.
//
// Category is free text (2026-08-16, generalized) — dDd's spreadsheet isn't
// limited to "player"/"enemy", he tags Characters however he wants
// (civilian, rogue, animal, imperial, ...) to organize the list. "player" is
// still special-cased as its own optgroup (Create-a-Character only — the DM
// spawn picker never shows it, same as before), but every other distinct
// Category value present in BUILDS gets its own dynamically-labeled optgroup
// in both pickers, inserted right before the "Custom" (saved-character)
// group. Old dynamic groups are removed and rebuilt each call so the list
// never drifts from whatever's actually in BUILDS.
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

  // Scene restriction (2026-08-20, per dDd — Era 1: "the only Character
  // Sheets available should be Gom and Living Stone... they don't need a
  // Header Category"). Flat options, no optgroup, inserted right before the
  // "Custom" anchor same as the dynamic category groups below would be.
  // Only the Character panel's own loader is restricted — the DM's spawn
  // picker stays showing everything regardless of Scene.
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

// Technique Lists (2026-08-16) — per-Character access at the category level
// (Flow Powers/Focus Powers/Lightning Crafts/Lava Crafts), matching
// techniques.js's TECHNIQUES entries' existing group/column pairing. Keys
// double as the `ch-tech-<key>` checkbox id suffix.
export const TECHNIQUE_CATEGORIES = ['flowPowers', 'focusPowers', 'lightningCrafts', 'lavaCrafts'];

// Reads the sheet's fields into a stats object, clamped to each stat's real
// Species Cap now (character.js's SPECIES — every Cap used to be a flat
// number, quietly tuned toward General Humanoids; now genuinely per-Species).
// Wounds (x) is clamped 0-deathWounds, deathWounds (z) itself and the Body
// array both come straight from the chosen Species — deathWounds is
// species-fixed by design (not independently sheet-editable), and Body has
// no per-part mechanics yet so it's simplest to just regenerate a fresh
// all-true array on every save rather than track edits to it.
function readStatsFromSheet(){
  const speciesKey = document.getElementById('ch-species').value || 'humanoid';
  const sp = SPECIES[speciesKey] || SPECIES.humanoid;
  const flowVal = clampInt(parseInt(document.getElementById('ch-flow').value || '0', 10), sp.caps.flow[0], sp.caps.flow[1]);
  // techniqueAccess deliberately NOT read from the sheet's own checkboxes
  // here (2026-08-24) — those still reflect the old 4-category model
  // (TECHNIQUE_CATEGORIES below), which no longer matches how access is
  // actually checked (js/techniques.js's hasTechniqueAccess(), per-Technique
  // now). Omitting the key entirely means saveCharacter()'s {...me,
  // ...sheetStats} spread leaves the real per-Technique object (set by
  // js/character.js's own spawnCharacter() at spawn time) alone, same as
  // mindeye/personality already survive a sheet save today — writing a
  // stale 4-key object here would silently zero out every real Technique's
  // access instead (hasTechniqueAccess() would find the object present but
  // none of its keys matching a real Technique, denying everything).
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
  const sheetStats = readStatsFromSheet();
  // The sheet's Flow field is a single "rating" number (flowMax); the current,
  // possibly mid-combat Flow value is preserved rather than reset by unrelated
  // edits, and just clamped down if the new max is now lower than it.
  const prevFlow = me.flow != null ? me.flow : sheetStats.flowMax;
  // Rewritten 2026-08-23 — found live while fixing the Glyph Memory merge:
  // this used to replace t.players[id] wholesale from *only* sheetStats plus
  // a hand-picked list of exceptions (apSpent/focusSpent/sequence/hitPercent/
  // possessors/miniParty/joinOrder/departed), each added reactively after
  // being "found live" losing a field on save. mindeye, personality,
  // shadowLinks, maintainingEmpower, facing, orders, lightningSpent, and
  // lavaSpent were never added to that list — every one of them was silently
  // wiped by any sheet save, autosave included. Spreading `me` first and
  // layering the sheet's own fields on top means every runtime field the
  // sheet doesn't own survives by construction — a *future* new one doesn't
  // need its own hand-added exception here.
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
  if(ok) flashHint('save-hint', hintText || 'Saved'); else flashHint('save-hint', 'Could not save', true);
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

  // Category-level checkboxes only — techniqueAccess itself moved to
  // per-Technique granularity 2026-08-24 (js/techniques.js's
  // hasTechniqueAccess()). This sheet UI is dormant along with the rest of
  // Create-a-Character (per dDd: on hold until Second Era) rather than
  // updated to match; left as-is, not actively relied on right now.
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

// Duplicated Add-Possessor/Add-Mini-Party flow (2026-08-16) — same engine as
// the Roster's (possession.js's addPossessor/addMiniPartyMember, unchanged),
// just always targeting the current Player's own record rather than an
// arbitrary one, so Create-a-Character can generate a whole family —
// Character + Mini-Party + Possessors — in one sitting. Per dDd: this is
// what actually makes populating a Tile with 5 Characters practical, since
// Characters are meant to cluster together anyway. DM-side (an Enemy
// generated with its own Possessors/Mini-Party) is explicitly out of scope
// for this pass — dm.js's addEnemy has no equivalent yet.
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

// Wires the Create-a-Character panel's own Add-Party instance — a separate
// set of element ids from the Roster's shared add-party-fields, so the two
// don't fight over the same hidden/shown state.
export function initCreateCharacterPartyUI(){
  const buildOptions = Object.entries(BUILDS).map(([key, b]) => '<option value="' + key + '">' + b.archetype + '</option>').join('');
  document.getElementById('ch-add-party-build').innerHTML = '<option value="">&mdash; blank &mdash;</option>' + buildOptions;
  document.getElementById('ch-add-party-kind-possessor').addEventListener('click', () => chShowAddPartyFields('possessor'));
  document.getElementById('ch-add-party-kind-miniparty').addEventListener('click', () => chShowAddPartyFields('miniparty'));
  document.getElementById('btn-ch-confirm-add-party-member').addEventListener('click', chConfirmAddPartyMember);
}

// Renders the current Player's own Possessor/Mini-Party grids inside
// Create-a-Character — same shared renderer the Roster and the read-only
// Character Sheet use (possessionView.js), just always scoped to
// AppState.playerId.
export function renderCreateCharacterParty(){
  const me = AppState.table && AppState.table.players[AppState.playerId];
  const possessorEl = document.getElementById('ch-possessor-grid');
  const miniPartyEl = document.getElementById('ch-miniparty-grid');
  if(!me || !possessorEl || !miniPartyEl) return;
  possessorEl.innerHTML = possessorGridHtml(me, AppState.playerId);
  miniPartyEl.innerHTML = miniPartyGridHtml(me, AppState.playerId);
  wirePossessorMiniPartyClicks(document.getElementById('panel-character'), showCharacterView);
}
