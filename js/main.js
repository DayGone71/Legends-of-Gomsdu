import { AppState, rememberMe, forgetMe, recallMe } from './state.js';
import { connectToSession, createNewSession, mutateTable, disconnect, registerRenderCallback } from './sync.js';
import { genCode, genId, timeNow } from './utils.js';
import { blankCharacter, loadBuild, scheduleSave, saveCharacter, renderCharacterSheet, saveAsTemplate, populateSavedCharacterDropdowns } from './character.js';
import { renderLedger, renderRoster, sendMessage } from './ledger.js';
import { renderTargetRange, toggleMenu, selectAttackKind, selectEssenceSchool, selectBlockKind, toggleCounter, commitAction, undoAction, resetAP, resolveRound, renderCombatCounters } from './combat.js';
import { renderSequencer } from './sequencer.js';
import { addEnemy, startEncounter, endEncounter, renderDMEnemyPicker, renderDMCounters, renderDMTargetRange, dmToggleMenu, dmSelectAttackKind, dmSelectEssenceSchool, dmSelectBlockKind, dmToggleCounter, dmCommitAction, dmUndoAction, clearDead } from './dm.js';
import { defaultMap, renderMap, toggleMapEditMode } from './map.js';
import { openPanel, closePanel, togglePanel, updateToolbarAvailability, initPanelBackdrop } from './panels.js';

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
  renderCharacterSheet();
  renderCombatCounters();
  renderTargetRange();
  renderSequencer();
  renderDMEnemyPicker();
  renderDMCounters();
  renderDMTargetRange();
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
    t.positions[AppState.playerId] = { x: 0, y: 0 };
    t.log.push({ type: 'system', text: name + ' joined the table', time: timeNow() });
  });
  rememberMe(code, AppState.playerId, name);
  enterTable(code);
}

function enterTable(code){
  document.getElementById('screen-landing').classList.add('hidden');
  document.getElementById('screen-table').classList.remove('hidden');
  document.getElementById('table-code-display').textContent = code;
  populateSavedCharacterDropdowns();
  renderAll();
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
  document.getElementById('panel-close-character').addEventListener('click', closePanel);
  document.getElementById('panel-close-combat').addEventListener('click', closePanel);
  document.getElementById('panel-close-sequencer').addEventListener('click', closePanel);
  document.getElementById('panel-close-dm').addEventListener('click', closePanel);

  // Character sheet
  document.getElementById('ch-build-loader').addEventListener('change', e => loadBuild(e.target.value));
  document.getElementById('btn-save-template').addEventListener('click', saveAsTemplate);
  ['ch-name', 'ch-archetype', 'ch-wounds', 'ch-woundsmax', 'ch-ap', 'ch-power', 'ch-quickness', 'ch-range', 'ch-lightning', 'ch-lava', 'ch-focus']
    .forEach(id => document.getElementById(id).addEventListener('input', scheduleSave));

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
  document.getElementById('btn-discard-round').addEventListener('click', resetAP);
  document.getElementById('btn-resolve').addEventListener('click', resolveRound);

  // DM
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

  // Map
  document.getElementById('map-edit-toggle').addEventListener('click', toggleMapEditMode);

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
