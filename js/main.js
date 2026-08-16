import { AppState, rememberMe, forgetMe, recallMe } from './state.js';
import { connectToSession, createNewSession, mutateTable, disconnect, registerRenderCallback } from './sync.js';
import { genCode, genId, timeNow } from './utils.js';
import { blankCharacter, loadBuild, scheduleSave, saveCharacter, makeActiveCharacter, renderCharacterSheet, saveAsTemplate, populateSavedCharacterDropdowns, populateBuildDropdowns, syncFieldOnBlur, initCreateCharacterPartyUI, renderCreateCharacterParty } from './character.js';
import { renderLedger, renderRoster, sendMessage, initAddPartyMemberUI } from './ledger.js';
import { renderTargetRange, renderAllyRange, toggleMenu, selectAttackKind, selectEssenceSchool, selectBlockKind, toggleCounter, commitAction, undoAction, resolveRound, renderCombatCounters, renderStagedActions, stageRest } from './combat.js';
import { renderSequencer } from './sequencer.js';
import { addEnemy, startEncounter, endEncounter, renderDMEnemyPicker, renderDMCounters, renderDMTargetRange, dmToggleMenu, dmSelectAttackKind, dmSelectEssenceSchool, dmSelectBlockKind, dmToggleCounter, dmCommitAction, dmUndoAction, renderDMStagedActions, clearDead, populateSavedEncounterDropdown, saveEncounterAsTemplate, loadEncounterTemplate } from './dm.js';
import { defaultMap, renderMap, toggleMapEditMode } from './map.js';
import { openPanel, closePanel, togglePanel, updateToolbarAvailability, initPanelBackdrop } from './panels.js';
import { renderDMTestPanel, runDMTestRound, runDMTestNRounds, runDMTestUntilDefeat } from './dmtest.js';
import { initTechniquesUI, renderTechniquesPanel } from './techniques.js';

// ---------- Screen helpers ----------
function showLoading(v){ document.getElementById('loading').classList.toggle('hidden', !v); }
function showLandingError(msg){
  const el = document.getElementById('landing-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function clearLandingError(){ document.getElementById('landing-error').classList.add('hidden'); }

// ---------- Central render ----------
function renderAll(){
  if(!AppState.table) return;
  if(AppState.playerId && !AppState.table.players[AppState.playerId]){
    handleRemovedFromTable();
    return;
  }
  renderCharacterSheet();
  renderCreateCharacterParty();
  renderTechniquesPanel();
  renderCombatCounters();
  renderTargetRange();
  renderAllyRange();
  renderStagedActions();
  renderSequencer();
  renderDMEnemyPicker();
  renderDMCounters();
  renderDMTargetRange();
  renderDMStagedActions();
  renderDMTestPanel();
  renderLedger();
  renderRoster();
  renderMap();
  updateToolbarAvailability();
}
registerRenderCallback(renderAll);

// ---------- Session lifecycle ----------
async function handleCreate(){
  clearLandingError();
  const name = document.getElementById('create-name').value.trim();
  if(!name){ showLandingError('Enter a name first.'); return; }

  const code = genCode();
  AppState.playerId = genId();
  const initial = {
    code, createdAt: Date.now(),
    log: [{ type: 'system', text: name + ' created the table', time: timeNow() }],
    players: {}, enemies: {},
    inEncounter: false,
    map: defaultMap(),
    positions: {}
  };
  initial.players[AppState.playerId] = blankCharacter(name);
  initial.positions[AppState.playerId] = { x: 0, y: 0 };

  showLoading(true);
  const ok = await createNewSession(code, initial);
  showLoading(false);
  if(!ok){ showLandingError("Couldn't create the table. Try again."); return; }
  await rememberMe(code, AppState.playerId, name);
  enterTable(code);
}

async function handleJoin(){
  clearLandingError();
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  const name = document.getElementById('join-name').value.trim();
  if(!code || !name){ showLandingError('Enter both a table code and your name.'); return; }

  showLoading(true);
  AppState.playerId = genId();
  const ok = await connectToSession(code);
  showLoading(false);
  if(!ok){ showLandingError('No table found with that code.'); return; }

  await mutateTable(t => {
    t.players[AppState.playerId] = blankCharacter(name);
    if(!t.positions) t.positions = {};
    // Each new Player starts one Tile down from the previous one, same column.
    const y = Math.min(Object.keys(t.players).length - 1, (t.map.height || 1) - 1);
    t.positions[AppState.playerId] = { x: 0, y };
    t.log.push({ type: 'system', text: name + ' joined the table', time: timeNow() });
  });
  rememberMe(code, AppState.playerId, name);
  enterTable(code);
}

function enterTable(code){
  document.getElementById('screen-landing').classList.add('hidden');
  document.getElementById('screen-table').classList.remove('hidden');
  document.getElementById('table-code-display').textContent = code;
  populateBuildDropdowns();
  populateSavedCharacterDropdowns();
  populateSavedEncounterDropdown();
  renderAll();
}

// Fires when this tab's own player record is gone from the synced table — left
// from another tab/window, or removed by the DM. Without this, a stale tab keeps
// showing "You are X" and will keep posting chat/actions under a ghost identity.
function handleRemovedFromTable(){
  forgetMe();
  disconnect();
  document.getElementById('screen-table').classList.add('hidden');
  document.getElementById('screen-landing').classList.remove('hidden');
  showLandingError('This session ended — you left (or were removed) from another tab or window.');
}

async function leaveTable(){
  if(AppState.table && AppState.table.players[AppState.playerId]){
    const name = AppState.table.players[AppState.playerId].name || 'Someone';
    await mutateTable(t => {
      delete t.players[AppState.playerId];
      t.log.push({ type: 'system', text: name + ' left the table', time: timeNow() });
    });
  }
  forgetMe();
  disconnect();
  document.getElementById('screen-table').classList.add('hidden');
  document.getElementById('screen-landing').classList.remove('hidden');
}

function copyCode(){
  if(!AppState.currentCode) return;
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(AppState.currentCode).catch(() => {});
  }
}

// ---------- Wiring ----------
function wireEvents(){
  document.getElementById('btn-create').addEventListener('click', handleCreate);
  document.getElementById('btn-join').addEventListener('click', handleJoin);

  document.getElementById('btn-copy-code').addEventListener('click', copyCode);
  document.getElementById('btn-leave').addEventListener('click', leaveTable);

  document.getElementById('chat-input').addEventListener('keydown', e => {
    if(e.key === 'Enter') sendMessage();
  });
  document.getElementById('btn-send-chat').addEventListener('click', sendMessage);

  // Toolbar: panel open/close
  document.getElementById('toolbar-character').addEventListener('click', () => togglePanel('character'));
  document.getElementById('toolbar-combat').addEventListener('click', () => togglePanel('combat'));
  document.getElementById('toolbar-sequencer').addEventListener('click', () => togglePanel('sequencer'));
  document.getElementById('toolbar-dm').addEventListener('click', () => togglePanel('dm'));
  document.getElementById('toolbar-dmtest').addEventListener('click', () => togglePanel('dmtest'));
  document.getElementById('toolbar-stats').addEventListener('click', () => togglePanel('stats'));
  document.getElementById('toolbar-techniques').addEventListener('click', () => togglePanel('techniques'));
  document.getElementById('toolbar-party').addEventListener('click', () => togglePanel('party'));
  document.getElementById('panel-close-character').addEventListener('click', closePanel);
  document.getElementById('panel-close-combat').addEventListener('click', closePanel);
  document.getElementById('panel-close-sequencer').addEventListener('click', closePanel);
  document.getElementById('panel-close-dm').addEventListener('click', closePanel);
  document.getElementById('panel-close-dmtest').addEventListener('click', closePanel);
  document.getElementById('panel-close-character-view').addEventListener('click', closePanel);
  document.getElementById('panel-close-stats').addEventListener('click', closePanel);
  document.getElementById('panel-close-techniques').addEventListener('click', closePanel);
  document.getElementById('panel-close-party').addEventListener('click', closePanel);
  document.getElementById('panel-close-technique-use').addEventListener('click', closePanel);

  // Character sheet
  document.getElementById('ch-build-loader').addEventListener('change', e => loadBuild(e.target.value));
  document.getElementById('btn-make-active').addEventListener('click', makeActiveCharacter);
  document.getElementById('btn-save-template').addEventListener('click', saveAsTemplate);
  ['ch-name', 'ch-species', 'ch-archetype', 'ch-wounds', 'ch-woundsmax', 'ch-ap', 'ch-flow', 'ch-recovery', 'ch-power', 'ch-quickness', 'ch-resilience', 'ch-lightning', 'ch-lava', 'ch-focus', 'ch-control', 'ch-attunement', 'ch-life',
   'ch-tech-flowPowers', 'ch-tech-focusPowers', 'ch-tech-lightningCrafts', 'ch-tech-lavaCrafts']
    .forEach(id => {
      const el = document.getElementById(id);
      el.addEventListener('input', scheduleSave);
      el.addEventListener('blur', syncFieldOnBlur);
    });
  initCreateCharacterPartyUI();

  // Combat
  document.getElementById('btn-attack-menu').addEventListener('click', () => toggleMenu('attack'));
  document.getElementById('btn-block-menu').addEventListener('click', () => toggleMenu('block'));
  document.getElementById('block-general-btn').addEventListener('click', () => selectBlockKind('general'));
  document.getElementById('block-target-btn').addEventListener('click', () => selectBlockKind('target'));
  document.getElementById('block-counter-btn').addEventListener('click', toggleCounter);
  document.getElementById('essence-btn').addEventListener('click', () => toggleMenu('essence'));
  document.getElementById('attack-fast-btn').addEventListener('click', () => selectAttackKind('fast'));
  document.getElementById('attack-strong-btn').addEventListener('click', () => selectAttackKind('strong'));
  document.getElementById('attack-focus-btn').addEventListener('click', () => selectAttackKind('focus'));
  document.getElementById('cast-lightning').addEventListener('click', () => selectEssenceSchool('Lightning'));
  document.getElementById('cast-lava').addEventListener('click', () => selectEssenceSchool('Lava'));
  document.getElementById('btn-commit').addEventListener('click', commitAction);
  document.getElementById('btn-undo').addEventListener('click', undoAction);
  document.getElementById('btn-resolve').addEventListener('click', resolveRound);
  document.getElementById('btn-rest').addEventListener('click', stageRest);

  // DM
  document.getElementById('dm-encounter-loader').addEventListener('change', loadEncounterTemplate);
  document.getElementById('btn-save-encounter').addEventListener('click', saveEncounterAsTemplate);
  document.getElementById('btn-add-enemy').addEventListener('click', addEnemy);
  document.getElementById('btn-start-encounter').addEventListener('click', startEncounter);
  document.getElementById('btn-end-encounter').addEventListener('click', endEncounter);
  document.getElementById('dm-attack-fast-btn').addEventListener('click', () => dmSelectAttackKind('fast'));
  document.getElementById('dm-attack-strong-btn').addEventListener('click', () => dmSelectAttackKind('strong'));
  document.getElementById('dm-attack-focus-btn').addEventListener('click', () => dmSelectAttackKind('focus'));
  document.getElementById('dm-cast-lightning').addEventListener('click', () => dmSelectEssenceSchool('Lightning'));
  document.getElementById('dm-cast-lava').addEventListener('click', () => dmSelectEssenceSchool('Lava'));
  document.getElementById('dm-btn-attack-menu').addEventListener('click', () => dmToggleMenu('attack'));
  document.getElementById('dm-btn-block-menu').addEventListener('click', () => dmToggleMenu('block'));
  document.getElementById('dm-block-general-btn').addEventListener('click', () => dmSelectBlockKind('general'));
  document.getElementById('dm-block-target-btn').addEventListener('click', () => dmSelectBlockKind('target'));
  document.getElementById('dm-block-counter-btn').addEventListener('click', dmToggleCounter);
  document.getElementById('dm-essence-btn').addEventListener('click', () => dmToggleMenu('essence'));
  document.getElementById('dm-btn-commit').addEventListener('click', dmCommitAction);
  document.getElementById('dm-btn-undo').addEventListener('click', dmUndoAction);
  document.getElementById('btn-clear-dead').addEventListener('click', clearDead);

  // DM Test panel
  document.getElementById('btn-dmtest-round').addEventListener('click', runDMTestRound);
  document.getElementById('btn-dmtest-n-rounds').addEventListener('click', runDMTestNRounds);
  document.getElementById('btn-dmtest-until-defeat').addEventListener('click', runDMTestUntilDefeat);

  // Map
  document.getElementById('map-edit-toggle').addEventListener('click', toggleMapEditMode);

  // Party: Add AI Party Member (Possessor / Mini-Party Character) — see the
  // "sandwich" model in reference/ROADMAP.md, Party System item C. Per-player
  // trigger buttons are wired inside renderRoster itself (they're recreated
  // every render); this just wires the shared one-instance form parts.
  initAddPartyMemberUI();
  initTechniquesUI();

  initPanelBackdrop();
}

// ---------- Init ----------
(async function init(){
  wireEvents();
  showLoading(true);
  const remembered = recallMe();
  if(remembered){
    AppState.playerId = remembered.playerId;
    const ok = await connectToSession(remembered.code);
    if(ok && AppState.table.players[remembered.playerId]){
      showLoading(false);
      enterTable(remembered.code);
      return;
    }
  }
  showLoading(false);
})();
