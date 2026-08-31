import { AppState } from './state.js';
import { mutateTable, triggerRender } from './sync.js';
import { escapeHtml, timeNow, playerShorthand, apCostForControl, describeAction, flashHint, isDeathWounded, resolveEntityRef, resolvePositionRef, enemyRoster, charactersRoster, allCharacterRoster, showBannerError } from './utils.js';
import { getSavedCharacters } from './savedCharacters.js';
import { getSavedEncounters, saveEncounterTemplate } from './savedEncounters.js';
import { castSeedLive } from './scenes.js';
import { updateEncounterUI, openPanel } from './panels.js';
import { isMeleeArc, FACING_DEFAULT, renderMap, registerStageOnCharacterHandler } from './map.js';
import { showCharacterView } from './characterView.js';
import { toggleActiveCharacter, activeActorId } from './activeCharacter.js';
import { craftsAndPowersFor, quickStageTechnique, costText } from './techniques.js';

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
    t.encounterZoneIds = {};
    t.log.push({ type: 'system', text: 'The encounter ends', time: timeNow() });
  });
  updateEncounterUI();
}

// Folded into Seed, 2026-08-30 — used to write t.enemies directly, free of
// any cost or Character behind it. Now a real cast of Yom's own Seed
// Technique (js/scenes.js's castSeedLive), same cost/resolution Genesis
// itself already goes through. The picker (a Build, or a Saved Character) is unchanged.
export async function castSeedAddEnemy(){
  const key = document.getElementById('dm-enemy-build-picker').value;
  if(!key) return;
  const isSaved = key.startsWith('saved:');
  const build = isSaved ? getSavedCharacters()[key.slice(6)] : key;
  if(!build) return;
  await castSeedLive([build]);
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
  if(AppState.activeCharacterId === id) AppState.activeCharacterId = null;
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

// Folded into Seed the same way, 2026-08-30 — spawns a saved roster's full
// set of enemies as one Seed cast (Seed's own cost is flat regardless of
// batch size, same as Genesis spawning a whole Scene's worth at once). Each
// snapshot now goes through the real spawnCharacter() pipeline (via
// castSeed/spawnNpc in scenes.js) instead of being spread onto the table
// verbatim — the old version skipped techniqueAccess/personality/Mindeye/
// Behavior-Queue setup entirely, a real gap this closes as a side effect.
export async function castSeedLoadEncounter(){
  const select = document.getElementById('dm-encounter-loader');
  const name = select && select.value;
  if(!name) return;
  const roster = getSavedEncounters()[name];
  if(!roster || !roster.length){ if(select) select.value = ''; return; }
  await castSeedLive(roster);
  if(select) select.value = '';
}

// NPC list — every live table.enemies entry, each row opening the same
// read-only showCharacterView() popup the Roster's own avatars use. Also
// where "who am I acting as" actually gets picked now (the Make Active
// button below) — the DM Panel used to have its own separate "Acting As"
// picker for that; removed 2026-08-30 once activeCharacterId became the one
// id both Movement and Attack/Block/Essence staging read (js/activeCharacter.js's
// activeActorId()). containerId defaults to the toolbar's own NPCs panel,
// but the same data + markup also drives View 2's TATA-mode "Characters"
// pane — same list, same click-to-view-sheet either way, just mounted in a
// second place (see renderView2Mode() in main.js).
export function renderNpcList(containerId){
  const el = document.getElementById(containerId || 'npc-list');
  if(!el) return;
  // Yom first — the Universal Characters Table's own roster, ahead of the
  // ordinary Enemy roster. enemyRoster() itself stays untouched (Combat's
  // resolveRound() reads table.enemies directly; Yom was never meant to
  // become a Combat participant just by being listable).
  const rows = [...charactersRoster(AppState.table), ...enemyRoster(AppState.table)];
  if(!rows.length){ el.innerHTML = '<div class="log-empty">No NPCs at the Table yet.</div>'; return; }

  // Both surfaces (toolbar NPC Panel and View 2's TATA-mode Characters list)
  // share this one render function, so adding the Make-Active button here
  // covers both at once. TATA-only — outside TATA the Active Character is
  // always just the Player's own Character, no button needed.
  el.innerHTML = rows.map(r => {
    const e = r.entity;
    const id = r.id;
    const isActive = AppState.tataActive && id === AppState.activeCharacterId;
    const activeBtn = AppState.tataActive
      ? '<button class="npc-active-btn' + (isActive ? ' active' : '') + '" data-active-id="' + id + '">' + (isActive ? 'Active' : 'Make Active') + '</button>'
      : '';
    // Inspect buttons — always present, unlike Make Active above; opens
    // Information/Personality/Relationships scoped to this NPC instead of
    // the viewing Player's own Character (AppState.inspectTargetId, read below by all three panels).
    const inspectBtns = ['information', 'personality', 'relationships'].map(panel =>
      '<button class="npc-inspect-btn" data-inspect-panel="' + panel + '" data-inspect-id="' + id + '">' + panel[0].toUpperCase() + panel.slice(1) + '</button>'
    ).join('');
    // Shadow Possession Link badge — shows whenever the viewing Player holds
    // a Link with this NPC, regardless of TATA state.
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
      // resolveEntityRef, not a raw table.enemies lookup — this row can now
      // be Yom, who lives in table.characters.
      showCharacterView(resolveEntityRef(AppState.table, row.dataset.id));
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
      // openPanel() only toggles which panel is visible — it doesn't
      // re-render the Information/Personality/Relationships content (that
      // only happens from main.js's renderAll(), on a real table mutation).
      // Without this, the panel would open showing whatever it last
      // rendered instead of the NPC just set above.
      triggerRender();
    };
  });
}

export function renderDMCounters(){
  const actor = resolveEntityRef(AppState.table, activeActorId());
  const wEl = document.getElementById('dm-wounds-display');
  const aEl = document.getElementById('dm-ap-display');
  const fEl = document.getElementById('dm-flow-display');
  const fcEl = document.getElementById('dm-focus-display');
  const ctrlEl = document.getElementById('dm-control-display');
  const hpEl = document.getElementById('dm-hitpercent-display');
  if(!wEl || !aEl) return;
  if(!actor){
    wEl.textContent = '—'; aEl.textContent = '—';
    if(fEl) fEl.textContent = '—';
    if(fcEl) fcEl.textContent = '—';
    if(ctrlEl) ctrlEl.textContent = '—';
    if(hpEl) hpEl.textContent = '—';
  }else{
    wEl.textContent = (actor.wounds ?? 0) + '/' + (actor.woundsMax ?? 0);
    aEl.textContent = (actor.apSpent || 0) + '/' + (actor.ap ?? 0);
    if(fEl) fEl.textContent = (actor.flow ?? 0) + '/' + (actor.flowMax ?? 0);
    if(fcEl) fcEl.textContent = ((actor.focus || 0) - (actor.focusSpent || 0)) + '/' + (actor.focus ?? 0);
    if(ctrlEl) ctrlEl.textContent = (actor.control ?? 0) + ' (base action: ' + apCostForControl(actor.control || 0, 1) + ' AP)';
    if(hpEl) hpEl.textContent = (actor.flow > 0) ? '—' : (actor.hitPercent ?? 1).toFixed(0) + '%';
  }

  dmRenderToggleStates();
}

// The canonical "everybody" roster — every Player, their Mini-Party, AND
// every Enemy — EXCEPT while Attack is the pending action, where the list
// narrows to real melee reach: same Tile always (no Mini-Tiles yet to need
// Facing there), an adjacent Tile only within the front 5 of its 8
// neighbors (js/map.js's isMeleeArc — front, both front-diagonals, both
// flanks; the 3 directly-behind neighbors are excluded regardless of
// range). Essence casting no longer lives here at all (moved to
// techniques.js's own Technique Use panel, now actor-generic — see
// dmCommitAction's own note below) — this range is Attack/Block only now.
export function renderDMTargetRange(){
  const el = document.getElementById('dm-target-range');
  if(!el) return;
  const table = AppState.table;
  if(!table){ el.innerHTML = ''; return; }

  const isAttack = AppState.dmPendingType === 'attack';
  const id = activeActorId();
  const actor = isAttack && resolveEntityRef(table, id);
  const actorPos = isAttack && resolvePositionRef(table, id);

  let rows = allCharacterRoster(table);
  if(isAttack && actor && actorPos){
    rows = rows.filter(r => r.id !== id && isMeleeArc(actorPos, actor.facing || FACING_DEFAULT, resolvePositionRef(table, r.id)));
  }

  if(!rows.length){ el.innerHTML = '<div class="log-empty">' + (isAttack ? 'No one in melee reach.' : 'No Characters to target.') + '</div>'; return; }

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
}

// Legacy panel-dm submenu toggle — Block's old in-panel controls still
// exist (dormant, only reachable via the "Dungeon Master" toolbar button)
// but the real entry point now is the Map-driven trio below. Essence's own
// legacy copy (dm-menu-essence) is gone outright, not just dormant — its
// craft-picking now reuses techniques.js's own actor-generic access check
// (craftsAndPowersFor) instead of a second copy of that logic.
export function dmToggleMenu(name){
  const target = document.getElementById('dm-menu-' + name);
  const wasHidden = target ? target.classList.contains('hidden') : true;
  const el = document.getElementById('dm-menu-block');
  if(el) el.classList.toggle('hidden', name === 'block' ? !wasHidden : true);
}

// --- Map-driven targeting, 2026-08-30 per dDd — the Active Character
// Display's own S/B/E buttons, a second door onto the same mechanisms the
// Map's own Tile-click popups already reach (dDd's framing: RTS games
// routinely have both a button menu and a right-click menu for one
// command — two doors are fine, two *implementations* underneath aren't).
// Each is a plain toggle (click again to cancel); WHERE you then click
// actually stages the action, via dmStageOnCharacter below (js/map.js's
// occupant popup calls it through registerStageOnCharacterHandler — a direct
// import would cycle, js/dm.js already imports js/map.js for isMeleeArc). ---

// Attack: single basic melee action (Strong/Focus dropped outright, not
// deferred — Ranged Attack is First-Era Technique territory). No submenu —
// toggle on, then click a Character standing on a highlighted Tile.
export function dmSelectAttack(){
  AppState.dmPendingType = AppState.dmPendingType === 'attack' ? null : 'attack';
  closeEssencePopover();
  dmRenderToggleStates();
  renderMap();
}

// Block: also no submenu now — WHO you click decides the kind. Clicking
// the acting Character themselves stages General Block (Resilience's own
// timing window, no target); clicking anyone else stages Target Block
// against exactly them (see dmStageOnCharacter).
export function dmToggleBlockMode(){
  AppState.dmPendingType = AppState.dmPendingType === 'block' ? null : 'block';
  AppState.dmPendingBlockKind = null;
  closeEssencePopover();
  dmRenderToggleStates();
  renderMap();
}

// Essence: opens a small Craft popover anchored to the E button — picking a
// Craft arms the Map's cursor glow (any Character anywhere is a valid
// target, unlike Attack's fixed arc); clicking one then stages it through
// quickStageTechnique (techniques.js) — the exact same cost/range/order
// logic the Player's own Technique Use panel uses, just a second door onto
// it. Message/Influence still open that real panel (dmStageOnCharacter
// below hands off to quickStageTechnique either way), since those two
// genuinely need their own Glyph/Axis/Direction fields.
export function dmToggleEssenceMode(){
  const turningOn = AppState.dmPendingType !== 'essence';
  AppState.dmPendingType = turningOn ? 'essence' : null;
  AppState.dmPendingCraftKey = null;
  if(turningOn) openEssencePopover(); else closeEssencePopover();
  dmRenderToggleStates();
  renderMap();
}

export function dmSelectCraft(key){
  AppState.dmPendingType = 'essence';
  AppState.dmPendingCraftKey = key;
  closeEssencePopover();
  dmRenderToggleStates();
  renderMap();
}

function openEssencePopover(){
  const btn = document.querySelector('.active-char-action-btn[data-action-kind="essence"]');
  const popup = document.getElementById('essence-craft-popup');
  if(!btn || !popup) return;
  const actor = resolveEntityRef(AppState.table, activeActorId());
  const crafts = actor ? craftsAndPowersFor(actor) : [];
  if(!crafts.length){ showBannerError('No known Crafts to cast.'); AppState.dmPendingType = null; return; }
  popup.innerHTML = crafts.map(([key, def]) =>
    '<button class="essence-popover-item" data-craft="' + key + '">' + escapeHtml(def.name) + ' — ' + costText(def.costs) + '</button>'
  ).join('');
  const rect = btn.getBoundingClientRect();
  popup.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
  popup.style.right = (window.innerWidth - rect.right) + 'px';
  popup.classList.remove('hidden');
  popup.querySelectorAll('[data-craft]').forEach(b => {
    b.onclick = (ev) => { ev.stopPropagation(); dmSelectCraft(b.dataset.craft); };
  });
}

function closeEssencePopover(){
  const popup = document.getElementById('essence-craft-popup');
  if(popup) popup.classList.add('hidden');
}

// Click-away dismiss, same idea/pattern as map.js's initMapPopupDismiss —
// called once from main.js's wireEvents(), not a bare top-level side effect.
export function initEssencePopoverDismiss(){
  document.addEventListener('click', (ev) => {
    if(ev.target.closest('#essence-craft-popup') || ev.target.closest('.active-char-action-btn[data-action-kind="essence"]')) return;
    closeEssencePopover();
  });
}

export function dmSelectBlockKind(kind){
  AppState.dmPendingType = 'block';
  AppState.dmPendingBlockKind = (AppState.dmPendingBlockKind === kind) ? null : kind;
  dmRenderToggleStates();
  renderDMTargetRange();
}

export function dmToggleCounter(){
  if(!AppState.dmPendingBlockKind) return;
  AppState.dmPendingCounter = !AppState.dmPendingCounter;
  dmRenderToggleStates();
}

// The actual Map-click target handler, registered with map.js via
// registerStageOnCharacterHandler (see the bottom of this file) so map.js
// never has to import this file directly. Collapses the old two-step (pick
// from a panel list, then hit Commit) into one click — reuses
// dmCommitAction's own cost/range/arc validation entirely; this only
// decides WHAT to stage based on WHO got clicked and the current mode.
export async function dmStageOnCharacter(id){
  if(!AppState.dmPendingType) return false;
  const actorId = activeActorId();
  if(AppState.dmPendingType === 'block'){
    AppState.dmPendingBlockKind = (id === actorId) ? 'general' : 'target';
    AppState.dmSelectedTargetId = (id === actorId) ? null : id;
    await dmCommitAction();
  }else if(AppState.dmPendingType === 'essence'){
    if(!AppState.dmPendingCraftKey) return true; // toggled on, no Craft chosen yet — swallow the click
    await quickStageTechnique(AppState.dmPendingCraftKey, id);
  }else{
    AppState.dmSelectedTargetId = id;
    await dmCommitAction();
  }
  return true;
}

export function dmRenderToggleStates(){
  const actor = resolveEntityRef(AppState.table, activeActorId());
  const control = actor ? (actor.control || 0) : 0;

  const attackBtn = document.getElementById('dm-btn-attack-menu');
  if(attackBtn){
    attackBtn.textContent = 'Attack — ' + apCostForControl(control, 1) + ' AP';
    attackBtn.classList.toggle('active', AppState.dmPendingType === 'attack');
  }

  // The real visible surface now — the Active Character Display's own S/B/E
  // buttons, not panel-dm's (dormant, legacy-only). Active whenever that
  // mode is the current dmPendingType, regardless of Craft-picked sub-state.
  document.querySelectorAll('.active-char-action-btn').forEach(btn => {
    btn.classList.toggle('active', AppState.dmPendingType === btn.dataset.actionKind);
  });

  const generalBtn = document.getElementById('dm-block-general-btn');
  const targetBtn = document.getElementById('dm-block-target-btn');
  const counterBtn = document.getElementById('dm-block-counter-btn');
  const baseCost = apCostForControl(control, 1);
  if(generalBtn){
    generalBtn.textContent = 'General Block — ' + baseCost + ' AP';
    generalBtn.classList.toggle('toggled', AppState.dmPendingBlockKind === 'general');
  }
  if(targetBtn){
    targetBtn.textContent = 'Target Block — ' + baseCost + ' AP';
    targetBtn.classList.toggle('toggled', AppState.dmPendingBlockKind === 'target');
  }
  if(counterBtn){
    counterBtn.textContent = 'Counter — +' + baseCost + ' AP';
    counterBtn.classList.toggle('toggled', AppState.dmPendingCounter);
    counterBtn.disabled = !AppState.dmPendingBlockKind;
    counterBtn.classList.toggle('disabled', !AppState.dmPendingBlockKind);
  }
}

export async function dmCommitAction(){
  const id = activeActorId();
  if(!id){ showBannerError('No Active Character to act as yet.'); return; }
  const actor = resolveEntityRef(AppState.table, id);
  if(!actor) return;
  const spent = actor.apSpent || 0;
  const focusSpent = actor.focusSpent || 0;
  let entry = null;

  const control = actor.control || 0;

  if(AppState.dmPendingType === 'attack'){
    const target = resolveEntityRef(AppState.table, AppState.dmSelectedTargetId);
    if(!target){ showBannerError('Pick a target first.'); return; }
    // Defensive re-check, not just the render-time filter (renderDMTargetRange
    // above) — a Facing change or a stale selection could otherwise slip an
    // out-of-arc target through to here.
    const myPos = resolvePositionRef(AppState.table, id);
    const targetPos = resolvePositionRef(AppState.table, AppState.dmSelectedTargetId);
    if(!isMeleeArc(myPos, actor.facing || FACING_DEFAULT, targetPos)){
      showBannerError('Out of melee reach.'); return;
    }
    const cost = apCostForControl(control, 1);
    if(spent + cost > (actor.ap || 0)){ showBannerError('Not enough AP left this round.'); return; }
    entry = { apCost: cost, focusCost: 0, actionLabel: 'FA', targetLabel: playerShorthand(target), targetName: target.name, kind: 'attack', attackKind: 'fast', targetId: AppState.dmSelectedTargetId };
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
  }else{
    // Essence isn't staged through here anymore — techniques.js's own
    // stageTechnique() owns Craft/Power casting entirely now.
    showBannerError('Open Attack or Block and choose something first.');
    return;
  }

  await mutateTable(t => {
    const a = resolveEntityRef(t, id);
    if(!a.sequence) a.sequence = [];
    a.sequence.push(entry);
    a.apSpent = spent + entry.apCost;
    a.focusSpent = focusSpent + (entry.focusCost || 0);
    a.lightningSpent = (a.lightningSpent || 0) + (entry.lightningCost || 0);
    a.lavaSpent = (a.lavaSpent || 0) + (entry.lavaCost || 0);
    if(entry.flowCost) a.flow = Math.max(0, (a.flow || 0) - entry.flowCost);
    // Locality-based Encounters (Combat item K), first pass — staging an
    // Attack pulls both the attacker and the target into the Encounter
    // Zone (tracked in its own membership map, rendered on the Map via
    // encounterZoneKeys in map.js) AND flips the table-wide t.inEncounter
    // on, same as manually pressing Start Encounter — Resolve (main.js)
    // dispatches Combat vs Non-Combat purely off that flag, so without this
    // a staged Attack would silently vanish into resolveNonCombatRound()
    // instead of actually landing. Matches dDd's own framing: "Attacking a
    // Character will cause both to enter into an Encounter."
    if(entry.kind === 'attack' && entry.targetId){
      if(!t.encounterZoneIds) t.encounterZoneIds = {};
      t.encounterZoneIds[id] = true;
      t.encounterZoneIds[entry.targetId] = true;
      if(!t.inEncounter){
        t.inEncounter = true;
        t.log.push({ type: 'system', text: 'An Encounter begins', time: timeNow() });
      }
    }
    // Message/Channel's actual effects don't land here — this only stages
    // the entry, same as every other technique. Resolution happens in
    // combat.js's resolveRound() (Encounter running) or noncombat.js's
    // resolveNonCombatRound() (Block/Essence can still be staged with no
    // Encounter running — an Attack now always starts one, above) — both
    // walk this same `sequence` array.
    t.log.push({ type: 'system', text: a.name + ' stages ' + describeAction(entry) + (entry.targetName ? (' on ' + entry.targetName) : ''), time: timeNow() });
  });
  updateEncounterUI();
}

export async function dmUndoAction(){
  const id = activeActorId();
  if(!id) return;
  const actor = resolveEntityRef(AppState.table, id);
  if(!actor || !actor.sequence || !actor.sequence.length) return;
  await mutateTable(t => {
    const a = resolveEntityRef(t, id);
    const removed = a.sequence.pop();
    a.apSpent = Math.max(0, (a.apSpent || 0) - removed.apCost);
    a.focusSpent = Math.max(0, (a.focusSpent || 0) - (removed.focusCost || 0));
    a.lightningSpent = Math.max(0, (a.lightningSpent || 0) - (removed.lightningCost || 0));
    a.lavaSpent = Math.max(0, (a.lavaSpent || 0) - (removed.lavaCost || 0));
    t.log.push({ type: 'system', text: a.name + ' undoes ' + describeAction(removed) + (removed.targetName ? (' on ' + removed.targetName) : ''), time: timeNow() });
  });
}

// Companion to dmUndoAction above, mirroring removeStagedAction in combat.js —
// lets the staged-actions list remove any one entry directly, not just the
// most recently staged one.
export async function dmRemoveStagedAction(index){
  const id = activeActorId();
  if(!id) return;
  const actor = resolveEntityRef(AppState.table, id);
  if(!actor || !actor.sequence || !actor.sequence[index]) return;
  await mutateTable(t => {
    const a = resolveEntityRef(t, id);
    const removed = a.sequence.splice(index, 1)[0];
    a.apSpent = Math.max(0, (a.apSpent || 0) - removed.apCost);
    a.focusSpent = Math.max(0, (a.focusSpent || 0) - (removed.focusCost || 0));
    a.lightningSpent = Math.max(0, (a.lightningSpent || 0) - (removed.lightningCost || 0));
    a.lavaSpent = Math.max(0, (a.lavaSpent || 0) - (removed.lavaCost || 0));
    t.log.push({ type: 'system', text: a.name + ' removes ' + describeAction(removed) + (removed.targetName ? (' on ' + removed.targetName) : ''), time: timeNow() });
  });
}

export function renderDMStagedActions(){
  const actor = resolveEntityRef(AppState.table, activeActorId());
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
  if(deadIds.includes(AppState.activeCharacterId)) AppState.activeCharacterId = null;
}

// Wires the Map's occupant-popup clicks to dmStageOnCharacter above — a
// registration call rather than map.js importing this file directly, since
// this file already imports map.js (isMeleeArc/renderMap etc.) and a
// straight two-way import would cycle.
registerStageOnCharacterHandler(dmStageOnCharacter);
