import { AppState } from './state.js';
import { mutateTable, triggerRender } from './sync.js';
import { escapeHtml, timeNow, playerShorthand, apCostForControl, describeAction, flashHint, isDeathWounded, resolveEntityRef, resolvePositionRef, enemyRoster, allCharacterRoster, showBannerError, deliverMindeyeEntry } from './utils.js';
import { BUILDS } from './character.js';
import { getSavedCharacters } from './savedCharacters.js';
import { getSavedEncounters, saveEncounterTemplate } from './savedEncounters.js';
import { updateEncounterUI, openPanel } from './panels.js';
import { TECHNIQUES, hasCategoryAccess, remaining, costText, glyphOptionsHtml } from './techniques.js';
import { getDistance, hasLineOfSight, FACING_DEFAULT } from './map.js';
import { showCharacterView } from './characterView.js';
import { toggleActiveCharacter } from './activeCharacter.js';

// Spawned enemies stack on the upper-right-most Tile until there are 5, then
// additional ones spawn on the Tile below that — straight down the rightmost
// column, never sideways. Based on how many enemies are currently present
// (not a lifetime count), so clearing the dead frees the top tile back up.
function nextEnemyPosition(t){
  const map = t.map;
  const count = Object.keys(t.enemies || {}).length;
  const row = Math.min(Math.floor(count / 5), (map.height || 1) - 1);
  return { x: (map.width || 1) - 1, y: row };
}

export async function startEncounter(){
  await mutateTable(t => {
    t.inEncounter = true;
    t.log.push({ type: 'system', text: 'The DM starts an encounter', time: timeNow() });
  });
  updateEncounterUI();
}

export async function endEncounter(){
  await mutateTable(t => {
    t.inEncounter = false;
    t.log.push({ type: 'system', text: 'The encounter ends', time: timeNow() });
  });
  updateEncounterUI();
}

export async function addEnemy(){
  const key = document.getElementById('dm-enemy-build-picker').value;
  if(!key) return;
  const isSaved = key.startsWith('saved:');
  const b = isSaved ? getSavedCharacters()[key.slice(6)] : BUILDS[key];
  if(!b) return;
  const displayBase = isSaved ? key.slice(6) : b.archetype;
  await mutateTable(t => {
    if(!t.enemies) t.enemies = {};
    if(!t.positions) t.positions = {};
    const id = 'e_' + Math.random().toString(36).slice(2, 8);
    const count = Object.values(t.enemies).filter(e => e.archetype === b.archetype && e.name.indexOf(displayBase) === 0).length + 1;
    const pos = nextEnemyPosition(t);
    t.enemies[id] = {
      archetype: b.archetype, name: displayBase + ' #' + count, num: count,
      wounds: b.wounds, woundsMax: b.woundsMax, ap: b.ap, flow: b.flow, flowMax: b.flowMax, recovery: b.recovery, power: b.power,
      quickness: b.quickness, resilience: b.resilience, lightning: b.lightning, lava: b.lava, focus: b.focus,
      control: b.control ?? 0, attunement: b.attunement ?? 0, life: b.life ?? 1,
      species: b.species, deathWounds: b.deathWounds, body: b.body ? [...b.body] : undefined,
      techniqueAccess: b.techniqueAccess,
      // Found 2026-08-22 while wiring Gom's own Intelligence — this literal
      // never copied Personality from BUILDS at all, so a spawned Enemy
      // silently lost it even though the Build template (js/character.js's
      // BUILDS) had it right there.
      personality: b.personality ? JSON.parse(JSON.stringify(b.personality)) : undefined,
      // passiveSpill (2026-08-23, found live — "I don't see any Lava
      // Crafts, or Tiles getting effected") — same recurring bug class as
      // species/personality above and mindeye before that: a new BUILDS
      // field (Kulkrow's own) added without threading it through this
      // literal too. This is the 3rd time; see ROADMAP.md for the real fix.
      passiveSpill: b.passiveSpill,
      apSpent: 0, focusSpent: 0, sequence: [], possessedBy: null, facing: FACING_DEFAULT
    };
    t.positions[id] = pos;
    // Innate Glyph knowledge, delivered as real Mindeye entries (2026-08-23,
    // per dDd's knownGlyphs/mindeye merge) — "knowing" a Glyph now just
    // means having a Mindeye entry for it, not a separate curriculum field.
    (b.startingMindeye || []).forEach(g => deliverMindeyeEntry(t, id, 'Star Father', g, true));
    t.log.push({ type: 'system', text: 'An enemy joined the fight: ' + t.enemies[id].name, time: timeNow() });
  });
}

// Per-enemy version of clearDead below — lets a hover-revealed X on a single
// chip remove just that one enemy, instead of waiting to bulk-clear everyone.
export async function removeEnemy(id){
  const enemy = AppState.table && AppState.table.enemies && AppState.table.enemies[id];
  if(!enemy) return;
  await mutateTable(t => {
    delete t.enemies[id];
    t.log.push({ type: 'system', text: enemy.name + ' is removed from the field', time: timeNow() });
  });
  if(AppState.actingEnemyId === id) AppState.actingEnemyId = null;
  if(AppState.selectedTargetId === id) AppState.selectedTargetId = null;
}

// Populates the "Custom" optgroup in the encounter loader dropdown. Called
// on entering a table and right after a new save, mirroring
// populateSavedCharacterDropdowns in character.js.
export function populateSavedEncounterDropdown(){
  const el = document.getElementById('dm-encounter-saved-group');
  if(!el) return;
  const names = Object.keys(getSavedEncounters()).sort();
  el.innerHTML = names.length
    ? names.map(n => '<option value="' + escapeHtml(n) + '">' + escapeHtml(n) + '</option>').join('')
    : '<option value="" disabled>No saved encounters yet</option>';
}

// Snapshots the current field's enemies (full health, no live combat state)
// as a reusable roster template — distinct from the per-character Saved
// Characters system, which saves one build at a time.
export async function saveEncounterAsTemplate(){
  const nameInput = document.getElementById('dm-encounter-name');
  const name = nameInput ? nameInput.value.trim() : '';
  if(!name){ showBannerError('Name the encounter before saving it.'); return; }
  const list = Object.values((AppState.table && AppState.table.enemies) || {});
  if(!list.length){ showBannerError('No enemies on the field to save.'); return; }

  const snapshot = list.map(e => ({
    archetype: e.archetype, wounds: 0, woundsMax: e.woundsMax, ap: e.ap, flow: e.flowMax, flowMax: e.flowMax,
    recovery: e.recovery, power: e.power, quickness: e.quickness, resilience: e.resilience, lightning: e.lightning, lava: e.lava,
    focus: e.focus, control: e.control ?? 0, attunement: e.attunement ?? 0, life: e.life ?? 1,
    species: e.species, deathWounds: e.deathWounds, body: e.body ? [...e.body] : undefined
  }));
  saveEncounterTemplate(name, snapshot);
  populateSavedEncounterDropdown();
  flashHint('dm-encounter-hint', 'Saved "' + name + '" (' + snapshot.length + (snapshot.length === 1 ? ' enemy' : ' enemies') + ')');
}

// Spawns a saved roster's full set of enemies onto the field at once — additive,
// so a DM can layer multiple saved templates together instead of it being all-or-nothing.
export async function loadEncounterTemplate(){
  const select = document.getElementById('dm-encounter-loader');
  const name = select && select.value;
  if(!name) return;
  const roster = getSavedEncounters()[name];
  if(!roster || !roster.length){ if(select) select.value = ''; return; }

  await mutateTable(t => {
    if(!t.enemies) t.enemies = {};
    if(!t.positions) t.positions = {};
    roster.forEach(b => {
      const id = 'e_' + Math.random().toString(36).slice(2, 8);
      const count = Object.values(t.enemies).filter(e => e.archetype === b.archetype && e.name.indexOf(b.archetype) === 0).length + 1;
      const pos = nextEnemyPosition(t);
      t.enemies[id] = { ...b, name: b.archetype + ' #' + count, num: count, apSpent: 0, focusSpent: 0, sequence: [], possessedBy: null };
      t.positions[id] = pos;
    });
    t.log.push({ type: 'system', text: 'The DM loads the "' + name + '" encounter (' + roster.length + (roster.length === 1 ? ' enemy' : ' enemies') + ')', time: timeNow() });
  });
  if(select) select.value = '';
}

export function renderDMEnemyPicker(){
  const el = document.getElementById('dm-enemy-picker');
  if(!el) return;
  const enemies = (AppState.table && AppState.table.enemies) || {};
  const rows = enemyRoster(AppState.table);
  if(AppState.actingEnemyId && !enemies[AppState.actingEnemyId]) AppState.actingEnemyId = null;
  if(!rows.length){ el.innerHTML = '<div class="log-empty">No enemies to control yet.</div>'; return; }

  el.innerHTML = rows.map(r => {
    const e = r.entity;
    let cls = 'target-chip';
    if(r.id === AppState.actingEnemyId) cls += ' selected';
    if(r.id === AppState.dmSelectedTargetId) cls += ' self-targeted';
    if(r.dead) cls += ' defeated';
    const removeX = r.dead ? '<span class="chip-remove-x" data-id="' + r.id + '">✕</span>' : '';
    return '<div class="' + cls + '" data-id="' + r.id + '">' + escapeHtml(r.name) + ' &mdash; ' + Math.max(0, e.wounds) + '/' + e.woundsMax + removeX + '</div>';
  }).join('');

  el.querySelectorAll('.target-chip').forEach(chip => {
    chip.onclick = () => selectActingEnemy(chip.dataset.id);
    chip.ondblclick = () => toggleActingSelfTarget(chip.dataset.id);
  });
  el.querySelectorAll('.chip-remove-x').forEach(x => {
    x.onclick = (ev) => { ev.stopPropagation(); removeEnemy(x.dataset.id); };
  });
}

// NPC list (2026-08-20, per dDd — "a way of seeing all the Character Sheets
// of all the NPCs at the Table"). Every live table.enemies entry, each row
// opening the same read-only showCharacterView() popup the Roster's own
// avatars already use — no new viewer, just a new way to reach the existing
// one for entities that don't otherwise have a clickable avatar anywhere.
// Distinct from the DM's own "Acting As" picker just above: that one selects
// who the DM stages actions as; this one is pure lookup, open to anyone at
// the Table, not DM-gated.
// containerId defaults to the toolbar's own NPCs panel, but the same data +
// markup also drives View 2's TATA-mode "Characters" pane (2026-08-20, per
// dDd — "Characters and the NPCs Panel are the same thing really... Tata
// sees it all") — same list, same click-to-view-sheet either way, just
// mounted in a second place. See renderView2Mode() in js/main.js.
export function renderNpcList(containerId){
  const el = document.getElementById(containerId || 'npc-list');
  if(!el) return;
  const rows = enemyRoster(AppState.table);
  if(!rows.length){ el.innerHTML = '<div class="log-empty">No NPCs at the Table yet.</div>'; return; }

  // Active Character (2026-08-22, per dDd) — "A Character has to be made
  // Active directly, via the NPC Panel or TATA Ledger." Both surfaces
  // already share this one render function (the toolbar NPC Panel and View
  // 2's TATA-mode Characters list, see js/main.js's renderView2Mode), so
  // adding the button here covers both at once. TATA-only — outside TATA
  // the Active Character is always just the Player's own Character, no
  // button needed.
  el.innerHTML = rows.map(r => {
    const e = r.entity;
    const id = r.id;
    const isActive = AppState.tataActive && id === AppState.activeCharacterId;
    const activeBtn = AppState.tataActive
      ? '<button class="npc-active-btn' + (isActive ? ' active' : '') + '" data-active-id="' + id + '">' + (isActive ? 'Active' : 'Make Active') + '</button>'
      : '';
    // Inspect buttons (2026-08-22, per dDd — "clicked by either Player or
    // Tata to see what is going on with the NPCs") — always present,
    // unlike Make Active above; opens Information/Personality/Relationships
    // scoped to this NPC instead of the viewing Player's own Character
    // (AppState.inspectTargetId, read below by all three panels).
    const inspectBtns = ['information', 'personality', 'relationships'].map(panel =>
      '<button class="npc-inspect-btn" data-inspect-panel="' + panel + '" data-inspect-id="' + id + '">' + panel[0].toUpperCase() + panel.slice(1) + '</button>'
    ).join('');
    // Shadow Possession Link badge (2026-08-23, per dDd — "Gom just needs a
    // list of NPCs he is possessing," repurposing this same NPC List rather
    // than building a separate panel). Shows whenever the viewing Player
    // holds a Link with this NPC, regardless of TATA state.
    const myLink = e.shadowLinkedBy && e.shadowLinkedBy.includes(AppState.playerId);
    const linkBadge = myLink ? '<span class="npc-link-badge" title="Shadow Possession Link active">&#128279; Linked</span>' : '';
    return '<div class="npc-list-item' + (r.dead ? ' defeated' : '') + '" data-id="' + id + '">' +
      '<span class="npc-list-name">' + escapeHtml(r.name) + '</span>' +
      '<span class="npc-list-meta">' + escapeHtml(e.archetype || '') + ' &mdash; ' + Math.max(0, e.wounds) + '/' + e.woundsMax + '</span>' +
      '<span class="npc-row-actions">' + linkBadge + inspectBtns + activeBtn + '</span>' +
    '</div>';
  }).join('');

  el.querySelectorAll('.npc-list-item').forEach(row => {
    row.onclick = (ev) => {
      if(ev.target.closest('.npc-active-btn') || ev.target.closest('.npc-inspect-btn')) return;
      showCharacterView(AppState.table.enemies[row.dataset.id]);
    };
  });
  el.querySelectorAll('.npc-active-btn').forEach(btn => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      toggleActiveCharacter(btn.dataset.activeId);
      triggerRender();
    };
  });
  el.querySelectorAll('.npc-inspect-btn').forEach(btn => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      AppState.inspectTargetId = btn.dataset.inspectId;
      openPanel(btn.dataset.inspectPanel);
      // openPanel() only toggles which panel is visible — it doesn't re-run
      // the Information/Personality/Relationships render functions (those
      // only fire from main.js's renderAll(), on a real table mutation).
      // Without this, the panel would open showing whatever it last
      // rendered (the Player's own data) instead of the NPC just set above.
      triggerRender();
    };
  });
}

export function selectActingEnemy(id){
  const enemy = AppState.table && AppState.table.enemies && AppState.table.enemies[id];
  if(!enemy || isDeathWounded(enemy)) return;
  // A self-target only makes sense pinned to the Enemy that had it — moving
  // to act as someone else drops it rather than carrying it along silently.
  if(AppState.dmSelectedTargetId === AppState.actingEnemyId && AppState.actingEnemyId !== id){
    AppState.dmSelectedTargetId = null;
  }
  AppState.actingEnemyId = id;
  renderDMEnemyPicker();
  renderDMCounters();
  renderDMTargetRange();
}

// Double-click the Acting As chip to toggle it as its own target (e.g. to
// test Execution/self-effects) — added alongside the Player-side Ally
// Targeting work, 2026-08-16. A second double-click clears it.
export function toggleActingSelfTarget(id){
  const enemy = AppState.table && AppState.table.enemies && AppState.table.enemies[id];
  if(!enemy || isDeathWounded(enemy)) return;
  AppState.actingEnemyId = id;
  AppState.dmSelectedTargetId = (AppState.dmSelectedTargetId === id) ? null : id;
  renderDMEnemyPicker();
  renderDMCounters();
  renderDMTargetRange();
}

export function renderDMCounters(){
  const enemy = AppState.actingEnemyId && AppState.table.enemies[AppState.actingEnemyId];
  const wEl = document.getElementById('dm-wounds-display');
  const aEl = document.getElementById('dm-ap-display');
  const fEl = document.getElementById('dm-flow-display');
  const fcEl = document.getElementById('dm-focus-display');
  const ctrlEl = document.getElementById('dm-control-display');
  const hpEl = document.getElementById('dm-hitpercent-display');
  if(!wEl || !aEl) return;
  if(!enemy){
    wEl.textContent = '\u2014'; aEl.textContent = '\u2014';
    if(fEl) fEl.textContent = '\u2014';
    if(fcEl) fcEl.textContent = '\u2014';
    if(ctrlEl) ctrlEl.textContent = '\u2014';
    if(hpEl) hpEl.textContent = '\u2014';
  }else{
    wEl.textContent = (enemy.wounds ?? 0) + '/' + (enemy.woundsMax ?? 0);
    aEl.textContent = (enemy.apSpent || 0) + '/' + (enemy.ap ?? 0);
    if(fEl) fEl.textContent = (enemy.flow ?? 0) + '/' + (enemy.flowMax ?? 0);
    if(fcEl) fcEl.textContent = ((enemy.focus || 0) - (enemy.focusSpent || 0)) + '/' + (enemy.focus ?? 0);
    if(ctrlEl) ctrlEl.textContent = (enemy.control ?? 0) + ' (base action: ' + apCostForControl(enemy.control || 0, 1) + ' AP)';
    if(hpEl) hpEl.textContent = (enemy.flow > 0) ? '\u2014' : (enemy.hitPercent ?? 1).toFixed(0) + '%';
  }

  const fastBtn = document.getElementById('dm-attack-fast-btn');
  const strongBtn = document.getElementById('dm-attack-strong-btn');
  const focusBtn = document.getElementById('dm-attack-focus-btn');
  const control = enemy ? (enemy.control || 0) : 0;
  if(enemy){
    if(fastBtn) fastBtn.textContent = 'Fast \u2014 ' + apCostForControl(control, 1) + ' AP';
    if(strongBtn) strongBtn.textContent = 'Strong \u2014 ' + apCostForControl(control, 2) + ' AP';
    if(focusBtn) focusBtn.textContent = 'Focus Attack \u2014 ' + apCostForControl(control, 2) + ' AP + 1 Focus';
  }
  if(focusBtn) focusBtn.classList.toggle('hidden', !(enemy && (enemy.focus || 0) > 0));

  const crafts = enemy ? craftsKnownBy(enemy) : [];
  const essBtn = document.getElementById('dm-essence-btn');
  if(essBtn) essBtn.classList.toggle('hidden', !crafts.length);
  renderDMEssenceMenu(crafts);

  dmRenderToggleStates();
}

// Which Crafts AND Powers (any column, per dDd \u2014 Gom needs Focus Powers
// reachable here specifically so he can cast Empower) the acting Enemy
// actually knows \u2014 gated by category access (defaults to granted, same as
// the Player-side Techniques Panel) and by actually having the resource
// stat above 0, same visibility rule the old flat Lightning/Lava buttons
// used. Found 2026-08-22, per dDd (\"why can't he use Focus Powers?\"): this
// only ever looked at group:\"Craft\" \u2014 Empower's own group is \"Powers\",
// so it (and every other Powers-group Technique \u2014 Wound, Possess,
// Resonance) was structurally unreachable from this menu for ANY Enemy,
// techniqueAccess notwithstanding. dmCommitAction() below already handles
// any TECHNIQUES entry generically (cost/range/LOS by key, not by group),
// so broadening this is a real fix, not a narrow Empower-only patch.
function craftsKnownBy(actor){
  return Object.entries(TECHNIQUES).filter(([, def]) => {
    if(def.group !== 'Craft' && def.group !== 'Powers') return false;
    if(def.column === 'Lightning' && !(actor.lightning > 0)) return false;
    if(def.column === 'Lava' && !(actor.lava > 0)) return false;
    if(def.column === 'Focus' && !(actor.focus > 0)) return false;
    if(def.column === 'Flow' && !(actor.flow > 0)) return false;
    return hasCategoryAccess(actor, def);
  });
}

// The DM Panel's Essence menu, per dDd: "when clicked it, should show all
// the Crafts a Character knows" \u2014 replaces the old flat Lightning/Lava
// 8-AP placeholder buttons with the acting Enemy's real named Crafts,
// reusing the same TECHNIQUES data and cost/target/range plumbing the
// Player-side Techniques Panel already uses (see techniques.js).
function renderDMEssenceMenu(crafts){
  const el = document.getElementById('dm-menu-essence');
  if(!el) return;
  if(!crafts.length){ el.innerHTML = ''; return; }
  el.innerHTML = crafts.map(([key, def]) =>
    '<button class="btn-ghost btn-small' + (AppState.dmPendingCraftKey === key ? ' toggled' : '') +
    '" data-craft="' + key + '">' + escapeHtml(def.name) + ' \u2014 ' + costText(def.costs) + '</button>'
  ).join('');
  // Message's Glyph picker (2026-08-21, per dDd \u2014 picking what Message to
  // send as an Enemy was "pretty awkward," always defaulting to RO/OR). Same
  // Directions/Other picker the Player-facing Technique Use panel uses,
  // reused directly (js/techniques.js's glyphOptionsHtml()) rather than
  // rebuilt \u2014 so Acting As Gom gets exactly the same real choice Moving him
  // already has, not a cruder DM-only version of it.
  if(AppState.dmPendingCraftKey === 'message'){
    el.innerHTML += '<div class="field"><label>Glyphs (up to 3, sent together)</label>' +
      '<select id="dm-glyph-select-1">' + glyphOptionsHtml(false) + '</select>' +
      '<select id="dm-glyph-select-2">' + glyphOptionsHtml(true) + '</select>' +
      '<select id="dm-glyph-select-3">' + glyphOptionsHtml(true) + '</select></div>';
  }
  el.querySelectorAll('[data-craft]').forEach(btn => {
    btn.onclick = () => dmSelectCraft(btn.dataset.craft);
  });
}

// Now the canonical "everybody" roster (2026-08-22, per dDd's Lists
// consolidation) — every Player, their Mini-Party, AND every Enemy, not
// just the Player side. Real fix, not cosmetic: this was Player-only ever
// since it was written (flagged in ROADMAP.md's Techniques Panel section),
// silently inconsistent with today's own "targetSide should not even exist
// really, all Characters have to be able to be targeted" call — an Enemy
// acting via the DM Panel can now actually target another Enemy here, same
// as everywhere else.
export function renderDMTargetRange(){
  const el = document.getElementById('dm-target-range');
  if(!el) return;
  const table = AppState.table;
  if(!table){ el.innerHTML = ''; return; }

  const rows = allCharacterRoster(table);

  if(!rows.length){ el.innerHTML = '<div class="log-empty">No Characters to target.</div>'; return; }

  el.innerHTML = rows.map(r => {
    let cls = 'target-chip';
    if(r.id === AppState.dmSelectedTargetId) cls += ' selected';
    if(r.dead) cls += ' defeated';
    return '<div class="' + cls + '" data-id="' + r.id + '">' + escapeHtml(r.name) +
      (r.sub ? ' <span class="chip-sub">' + escapeHtml(r.sub) + '</span>' : '') + '</div>';
  }).join('');

  el.querySelectorAll('.target-chip').forEach(chip => {
    chip.onclick = () => selectDMTarget(chip.dataset.id);
  });
}

export function selectDMTarget(id){
  const target = resolveEntityRef(AppState.table, id);
  if(!target || isDeathWounded(target)) return;
  AppState.dmSelectedTargetId = id;
  renderDMTargetRange();
  renderDMEnemyPicker(); // clears any self-targeted highlight on the Acting As chip
}

export function dmToggleMenu(name){
  const target = document.getElementById('dm-menu-' + name);
  const wasHidden = target ? target.classList.contains('hidden') : true;
  ['attack', 'block', 'essence'].forEach(m => {
    const el = document.getElementById('dm-menu-' + m);
    if(!el) return;
    if(m === name) el.classList.toggle('hidden', !wasHidden);
    else el.classList.add('hidden');
  });
}

export function dmSelectAttackKind(kind){
  AppState.dmPendingType = 'attack';
  AppState.dmPendingAttackKind = kind;
  dmRenderToggleStates();
}

export function dmSelectCraft(key){
  AppState.dmPendingType = 'essence';
  AppState.dmPendingCraftKey = key;
  dmRenderToggleStates();
}

export function dmSelectBlockKind(kind){
  AppState.dmPendingType = 'block';
  AppState.dmPendingBlockKind = (AppState.dmPendingBlockKind === kind) ? null : kind;
  dmRenderToggleStates();
}

export function dmToggleCounter(){
  if(!AppState.dmPendingBlockKind) return;
  AppState.dmPendingCounter = !AppState.dmPendingCounter;
  dmRenderToggleStates();
}

export function dmRenderToggleStates(){
  const enemy = AppState.actingEnemyId && AppState.table && AppState.table.enemies[AppState.actingEnemyId];
  const control = enemy ? (enemy.control || 0) : 0;

  const fastBtn = document.getElementById('dm-attack-fast-btn');
  const strongBtn = document.getElementById('dm-attack-strong-btn');
  const focusBtn = document.getElementById('dm-attack-focus-btn');
  if(fastBtn) fastBtn.classList.toggle('toggled', AppState.dmPendingType === 'attack' && AppState.dmPendingAttackKind === 'fast');
  if(strongBtn) strongBtn.classList.toggle('toggled', AppState.dmPendingType === 'attack' && AppState.dmPendingAttackKind === 'strong');
  if(focusBtn) focusBtn.classList.toggle('toggled', AppState.dmPendingType === 'attack' && AppState.dmPendingAttackKind === 'focus');
  renderDMEssenceMenu(enemy ? craftsKnownBy(enemy) : []);

  const generalBtn = document.getElementById('dm-block-general-btn');
  const targetBtn = document.getElementById('dm-block-target-btn');
  const counterBtn = document.getElementById('dm-block-counter-btn');
  const baseCost = apCostForControl(control, 1);
  if(generalBtn){
    generalBtn.textContent = 'General Block \u2014 ' + baseCost + ' AP';
    generalBtn.classList.toggle('toggled', AppState.dmPendingBlockKind === 'general');
  }
  if(targetBtn){
    targetBtn.textContent = 'Target Block \u2014 ' + baseCost + ' AP';
    targetBtn.classList.toggle('toggled', AppState.dmPendingBlockKind === 'target');
  }
  if(counterBtn){
    counterBtn.textContent = 'Counter \u2014 +' + baseCost + ' AP';
    counterBtn.classList.toggle('toggled', AppState.dmPendingCounter);
    counterBtn.disabled = !AppState.dmPendingBlockKind;
    counterBtn.classList.toggle('disabled', !AppState.dmPendingBlockKind);
  }
}

export async function dmCommitAction(){
  if(!AppState.actingEnemyId){ showBannerError('Pick an enemy to act as first.'); return; }
  const actor = AppState.table.enemies[AppState.actingEnemyId];
  if(!actor) return;
  const spent = actor.apSpent || 0;
  const focusSpent = actor.focusSpent || 0;
  let entry = null;

  const control = actor.control || 0;

  if(AppState.dmPendingType === 'attack'){
    if(!AppState.dmPendingAttackKind){ showBannerError('Choose Fast, Strong, or Focus first.'); return; }
    const target = resolveEntityRef(AppState.table, AppState.dmSelectedTargetId);
    if(!target){ showBannerError('Pick a target first.'); return; }
    const cost = apCostForControl(control, AppState.dmPendingAttackKind === 'fast' ? 1 : 2);
    if(spent + cost > (actor.ap || 0)){ showBannerError('Not enough AP left this round.'); return; }
    if(AppState.dmPendingAttackKind === 'focus' && focusSpent + 1 > (actor.focus || 0)){
      showBannerError('Not enough Focus left this round.'); return;
    }
    const label = AppState.dmPendingAttackKind === 'strong' ? 'SA' : AppState.dmPendingAttackKind === 'focus' ? 'FCA' : 'FA';
    entry = { apCost: cost, focusCost: AppState.dmPendingAttackKind === 'focus' ? 1 : 0, actionLabel: label, targetLabel: playerShorthand(target), targetName: target.name, kind: 'attack', attackKind: AppState.dmPendingAttackKind, targetId: AppState.dmSelectedTargetId };
  }else if(AppState.dmPendingType === 'block'){
    if(!AppState.dmPendingBlockKind){ showBannerError('Choose General Block or Target Block first.'); return; }
    let targetId = null, targetLabel = '', targetName = '';
    if(AppState.dmPendingBlockKind === 'target'){
      const target = resolveEntityRef(AppState.table, AppState.dmSelectedTargetId);
      if(!target){ showBannerError('Pick a target first for Target Block.'); return; }
      targetId = AppState.dmSelectedTargetId;
      targetLabel = playerShorthand(target);
      targetName = target.name;
    }
    const unit = apCostForControl(control, 1);
    const cost = unit + (AppState.dmPendingCounter ? unit : 0);
    if(spent + cost > (actor.ap || 0)){ showBannerError('Not enough AP left this round.'); return; }
    const label = (AppState.dmPendingBlockKind === 'general' ? 'GB' : 'TB') + (AppState.dmPendingCounter ? '+C' : '');
    entry = { apCost: cost, focusCost: 0, actionLabel: label, targetLabel, targetName, kind: 'block', blockKind: AppState.dmPendingBlockKind, counter: AppState.dmPendingCounter, targetId };
  }else if(AppState.dmPendingType === 'essence'){
    if(!AppState.dmPendingCraftKey){ showBannerError('Choose a Craft first.'); return; }
    const def = TECHNIQUES[AppState.dmPendingCraftKey];
    if(!def){ showBannerError('That Craft no longer exists.'); return; }
    const target = resolveEntityRef(AppState.table, AppState.dmSelectedTargetId);
    if(!target){ showBannerError('Pick a target first.'); return; }

    const myPos = resolvePositionRef(AppState.table, AppState.actingEnemyId);
    const targetPos = resolvePositionRef(AppState.table, AppState.dmSelectedTargetId);
    if(myPos && targetPos){
      // Shadow Possession Link bypasses Range (2026-08-23) — same rule as
      // the Player's own Technique Use panel, js/techniques.js.
      const linked = target.shadowLinkedBy && target.shadowLinkedBy.includes(AppState.actingEnemyId);
      const dist = getDistance(myPos, targetPos);
      if(!linked && dist > def.range){ showBannerError('Target is out of Range (' + dist + ' > ' + def.range + ').'); return; }
      if(!hasLineOfSight(AppState.table, myPos, targetPos)){ showBannerError('No line of sight to target.'); return; }
    }
    for(const [resource, amount] of Object.entries(def.costs)){
      if(remaining(actor, resource) < amount){ showBannerError('Not enough ' + resource + ' left.'); return; }
    }

    const glyphIds = AppState.dmPendingCraftKey === 'message'
      ? [1, 2, 3].map(n => document.getElementById('dm-glyph-select-' + n)).filter(Boolean).map(el => el.value).filter(Boolean)
      : undefined;
    entry = {
      apCost: def.costs.ap || 0, focusCost: def.costs.focus || 0, flowCost: def.costs.flow || 0,
      lightningCost: def.costs.lightning || 0, lavaCost: def.costs.lava || 0,
      actionLabel: def.name, targetLabel: playerShorthand(target), targetName: target.name,
      kind: 'technique', techniqueKey: AppState.dmPendingCraftKey, targetId: AppState.dmSelectedTargetId,
      glyphs: glyphIds
    };
  }else{
    showBannerError('Open Attack, Block, or Essence and choose something first.');
    return;
  }

  await mutateTable(t => {
    const a = t.enemies[AppState.actingEnemyId];
    if(!a.sequence) a.sequence = [];
    a.sequence.push(entry);
    a.apSpent = spent + entry.apCost;
    a.focusSpent = focusSpent + (entry.focusCost || 0);
    a.lightningSpent = (a.lightningSpent || 0) + (entry.lightningCost || 0);
    a.lavaSpent = (a.lavaSpent || 0) + (entry.lavaCost || 0);
    if(entry.flowCost) a.flow = Math.max(0, (a.flow || 0) - entry.flowCost);
    // Message/Channel's actual effects DON'T land here anymore (2026-08-22,
    // per dDd: "Every Action should resolve on turns... Combat or
    // Non-Combat, same thing") — this only stages the entry now, same as
    // every other technique. Resolution happens in js/combat.js's
    // resolveRound() (when an Encounter is running) or js/noncombat.js's
    // resolveNonCombatRound() (when it isn't, since this staging tool has
    // no Encounter gate at all) — both walk this same `sequence` array.
    t.log.push({ type: 'system', text: a.name + ' stages ' + describeAction(entry) + (entry.targetName ? (' on ' + entry.targetName) : ''), time: timeNow() });
  });
}

export async function dmUndoAction(){
  if(!AppState.actingEnemyId) return;
  const actor = AppState.table.enemies[AppState.actingEnemyId];
  if(!actor || !actor.sequence || !actor.sequence.length) return;
  await mutateTable(t => {
    const a = t.enemies[AppState.actingEnemyId];
    const removed = a.sequence.pop();
    a.apSpent = Math.max(0, (a.apSpent || 0) - removed.apCost);
    a.focusSpent = Math.max(0, (a.focusSpent || 0) - (removed.focusCost || 0));
    a.lightningSpent = Math.max(0, (a.lightningSpent || 0) - (removed.lightningCost || 0));
    a.lavaSpent = Math.max(0, (a.lavaSpent || 0) - (removed.lavaCost || 0));
    t.log.push({ type: 'system', text: a.name + ' undoes ' + describeAction(removed) + (removed.targetName ? (' on ' + removed.targetName) : ''), time: timeNow() });
  });
}

// Companion to dmUndoAction above, mirroring removeStagedAction in combat.js —
// lets the DM staged-actions list remove any one entry directly, not just the
// most recently staged one.
export async function dmRemoveStagedAction(index){
  if(!AppState.actingEnemyId) return;
  const actor = AppState.table.enemies[AppState.actingEnemyId];
  if(!actor || !actor.sequence || !actor.sequence[index]) return;
  await mutateTable(t => {
    const a = t.enemies[AppState.actingEnemyId];
    const removed = a.sequence.splice(index, 1)[0];
    a.apSpent = Math.max(0, (a.apSpent || 0) - removed.apCost);
    a.focusSpent = Math.max(0, (a.focusSpent || 0) - (removed.focusCost || 0));
    a.lightningSpent = Math.max(0, (a.lightningSpent || 0) - (removed.lightningCost || 0));
    a.lavaSpent = Math.max(0, (a.lavaSpent || 0) - (removed.lavaCost || 0));
    t.log.push({ type: 'system', text: a.name + ' removes ' + describeAction(removed) + (removed.targetName ? (' on ' + removed.targetName) : ''), time: timeNow() });
  });
}

export function renderDMStagedActions(){
  const actor = AppState.actingEnemyId && AppState.table && AppState.table.enemies[AppState.actingEnemyId];
  const el = document.getElementById('dm-staged-list');
  if(!el) return;
  const seq = (actor && actor.sequence) || [];
  if(!seq.length){ el.innerHTML = ''; return; }
  el.innerHTML = seq.map((entry, i) =>
    '<div class="staged-row"><span>' + escapeHtml(describeAction(entry)) +
    (entry.targetName ? ' on ' + escapeHtml(entry.targetName) : '') + '</span>' +
    '<span class="staged-remove-x" data-index="' + i + '">✕</span></div>'
  ).join('');
  el.querySelectorAll('.staged-remove-x').forEach(x => {
    x.onclick = () => dmRemoveStagedAction(parseInt(x.dataset.index, 10));
  });
}

export async function clearDead(){
  const enemies = (AppState.table && AppState.table.enemies) || {};
  const deadIds = Object.keys(enemies).filter(id => isDeathWounded(enemies[id]));
  if(!deadIds.length){ showBannerError('Nothing to clear.'); return; }

  await mutateTable(t => {
    deadIds.forEach(id => { delete t.enemies[id]; });
    t.log.push({ type: 'system', text: 'Cleared ' + deadIds.length + ' defeated ' + (deadIds.length === 1 ? 'enemy' : 'enemies') + ' from the field', time: timeNow() });
  });
  if(deadIds.includes(AppState.actingEnemyId)) AppState.actingEnemyId = null;
}
