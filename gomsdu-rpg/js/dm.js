import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml, timeNow, playerShorthand } from './utils.js';
import { BUILDS } from './character.js';
import { updateToolbarAvailability } from './panels.js';

function showBannerError(msg){
  const el = document.getElementById('banner-error');
  if(!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

export async function startEncounter(){
  await mutateTable(t => {
    t.inEncounter = true;
    t.log.push({ type: 'system', text: 'The DM starts an encounter', time: timeNow() });
  });
  updateToolbarAvailability();
}

export async function endEncounter(){
  await mutateTable(t => {
    t.inEncounter = false;
    t.log.push({ type: 'system', text: 'The encounter ends', time: timeNow() });
  });
  updateToolbarAvailability();
}

export async function addEnemy(){
  const key = document.getElementById('dm-enemy-build-picker').value;
  const b = BUILDS[key];
  if(!b) return;
  await mutateTable(t => {
    if(!t.enemies) t.enemies = {};
    const id = 'e_' + Math.random().toString(36).slice(2, 8);
    const count = Object.values(t.enemies).filter(e => e.archetype === b.archetype).length + 1;
    t.enemies[id] = {
      archetype: b.archetype, name: b.archetype + ' #' + count, num: count,
      wounds: b.wounds, woundsMax: b.woundsMax, ap: b.ap, power: b.power,
      quickness: b.quickness, range: b.range, lightning: b.lightning, lava: b.lava, focus: b.focus,
      apSpent: 0, sequence: []
    };
    t.log.push({ type: 'system', text: 'An enemy joined the fight: ' + t.enemies[id].name, time: timeNow() });
  });
}

export function renderDMEnemyPicker(){
  const el = document.getElementById('dm-enemy-picker');
  if(!el) return;
  const enemies = (AppState.table && AppState.table.enemies) || {};
  const list = Object.entries(enemies);
  if(AppState.actingEnemyId && !enemies[AppState.actingEnemyId]) AppState.actingEnemyId = null;
  if(!list.length){ el.innerHTML = '<div class="log-empty">No enemies to control yet.</div>'; return; }

  el.innerHTML = list.map(([id, e]) => {
    const defeated = e.wounds <= 0;
    let cls = 'target-chip';
    if(id === AppState.actingEnemyId) cls += ' selected';
    if(defeated) cls += ' defeated';
    return '<div class="' + cls + '" data-id="' + id + '">' + escapeHtml(e.name) + ' &mdash; ' + Math.max(0, e.wounds) + '/' + e.woundsMax + '</div>';
  }).join('');

  el.querySelectorAll('.target-chip').forEach(chip => {
    chip.onclick = () => selectActingEnemy(chip.dataset.id);
  });
}

export function selectActingEnemy(id){
  const enemy = AppState.table && AppState.table.enemies && AppState.table.enemies[id];
  if(!enemy || enemy.wounds <= 0) return;
  AppState.actingEnemyId = id;
  renderDMEnemyPicker();
  renderDMCounters();
}

export function renderDMCounters(){
  const enemy = AppState.actingEnemyId && AppState.table.enemies[AppState.actingEnemyId];
  const wEl = document.getElementById('dm-wounds-display');
  const aEl = document.getElementById('dm-ap-display');
  if(!wEl || !aEl) return;
  if(!enemy){ wEl.textContent = '\u2014'; aEl.textContent = '\u2014'; }
  else{
    wEl.textContent = (enemy.wounds ?? 0) + '/' + (enemy.woundsMax ?? 0);
    aEl.textContent = (enemy.apSpent || 0) + '/' + (enemy.ap ?? 0);
  }
  const hasEssence = !!(enemy && ((enemy.lightning > 0) || (enemy.lava > 0)));
  const essBtn = document.getElementById('dm-essence-btn');
  if(essBtn) essBtn.classList.toggle('hidden', !hasEssence);
  const lt = document.getElementById('dm-cast-lightning');
  const lv = document.getElementById('dm-cast-lava');
  if(lt) lt.classList.toggle('hidden', !(enemy && enemy.lightning > 0));
  if(lv) lv.classList.toggle('hidden', !(enemy && enemy.lava > 0));
}

export function renderDMTargetRange(){
  const el = document.getElementById('dm-target-range');
  if(!el) return;
  const players = (AppState.table && AppState.table.players) || {};
  const list = Object.entries(players);
  if(!list.length){ el.innerHTML = '<div class="log-empty">No players to target.</div>'; return; }

  el.innerHTML = list.map(([id, p]) => {
    const defeated = (p.wounds ?? 0) <= 0;
    let cls = 'target-chip';
    if(id === AppState.dmSelectedTargetId) cls += ' selected';
    if(defeated) cls += ' defeated';
    return '<div class="' + cls + '" data-id="' + id + '">' + escapeHtml(p.name || 'Player') + ' &mdash; ' + Math.max(0, p.wounds ?? 0) + '/' + (p.woundsMax ?? 0) + '</div>';
  }).join('');

  el.querySelectorAll('.target-chip').forEach(chip => {
    chip.onclick = () => selectDMTarget(chip.dataset.id);
  });
}

export function selectDMTarget(id){
  const p = AppState.table && AppState.table.players && AppState.table.players[id];
  if(!p || (p.wounds ?? 0) <= 0) return;
  AppState.dmSelectedTargetId = id;
  renderDMTargetRange();
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

export function dmSelectEssenceSchool(school){
  AppState.dmPendingType = 'essence';
  AppState.dmPendingEssenceSchool = school;
  dmRenderToggleStates();
}

export function dmRenderToggleStates(){
  const fastBtn = document.getElementById('dm-attack-fast-btn');
  const strongBtn = document.getElementById('dm-attack-strong-btn');
  if(fastBtn) fastBtn.classList.toggle('toggled', AppState.dmPendingType === 'attack' && AppState.dmPendingAttackKind === 'fast');
  if(strongBtn) strongBtn.classList.toggle('toggled', AppState.dmPendingType === 'attack' && AppState.dmPendingAttackKind === 'strong');
  const ltBtn = document.getElementById('dm-cast-lightning');
  const lvBtn = document.getElementById('dm-cast-lava');
  if(ltBtn) ltBtn.classList.toggle('toggled', AppState.dmPendingType === 'essence' && AppState.dmPendingEssenceSchool === 'Lightning');
  if(lvBtn) lvBtn.classList.toggle('toggled', AppState.dmPendingType === 'essence' && AppState.dmPendingEssenceSchool === 'Lava');
}

export async function dmCommitAction(){
  if(!AppState.actingEnemyId){ showBannerError('Pick an enemy to act as first.'); return; }
  const actor = AppState.table.enemies[AppState.actingEnemyId];
  if(!actor) return;
  const spent = actor.apSpent || 0;
  let entry = null;

  if(AppState.dmPendingType === 'attack'){
    if(!AppState.dmPendingAttackKind){ showBannerError('Choose Fast or Strong first.'); return; }
    const target = AppState.table.players && AppState.table.players[AppState.dmSelectedTargetId];
    if(!target){ showBannerError('Pick a target first.'); return; }
    const cost = AppState.dmPendingAttackKind === 'strong' ? 10 : 5;
    if(spent + cost > (actor.ap || 0)){ showBannerError('Not enough AP left this round.'); return; }
    entry = { apCost: cost, actionLabel: AppState.dmPendingAttackKind === 'strong' ? 'SA' : 'FA', targetLabel: playerShorthand(target), kind: 'attack', attackKind: AppState.dmPendingAttackKind, targetId: AppState.dmSelectedTargetId };
  }else if(AppState.dmPendingType === 'block'){
    const base = document.getElementById('dm-block-base').checked;
    const maintain = document.getElementById('dm-block-maintain').checked;
    const counter = document.getElementById('dm-block-counter').checked;
    const cost = (base ? 5 : 0) + (maintain ? 5 : 0) + (counter ? 5 : 0);
    if(cost === 0){ showBannerError('Check at least Block.'); return; }
    if(spent + cost > (actor.ap || 0)){ showBannerError('Not enough AP left this round.'); return; }
    entry = { apCost: cost, actionLabel: (base ? 'B' : '') + (maintain ? 'M' : '') + (counter ? 'C' : ''), targetLabel: '', kind: 'block', maintain, counter };
  }else if(AppState.dmPendingType === 'essence'){
    if(!AppState.dmPendingEssenceSchool){ showBannerError('Choose Lightning or Lava first.'); return; }
    const target = AppState.table.players && AppState.table.players[AppState.dmSelectedTargetId];
    if(!target){ showBannerError('Pick a target first.'); return; }
    const cost = 8;
    if(spent + cost > (actor.ap || 0)){ showBannerError('Not enough AP left this round.'); return; }
    entry = { apCost: cost, actionLabel: AppState.dmPendingEssenceSchool === 'Lava' ? 'LV' : 'LN', targetLabel: playerShorthand(target), kind: 'essence', school: AppState.dmPendingEssenceSchool, targetId: AppState.dmSelectedTargetId };
  }else{
    showBannerError('Open Attack, Block, or Essence and choose something first.');
    return;
  }

  await mutateTable(t => {
    const a = t.enemies[AppState.actingEnemyId];
    if(!a.sequence) a.sequence = [];
    a.sequence.push(entry);
    a.apSpent = spent + entry.apCost;
    t.log.push({ type: 'system', text: a.name + ' stages ' + entry.actionLabel + (entry.targetLabel ? (' on ' + entry.targetLabel) : ''), time: timeNow() });
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
    t.log.push({ type: 'system', text: a.name + ' undoes ' + removed.actionLabel + (removed.targetLabel ? (' on ' + removed.targetLabel) : ''), time: timeNow() });
  });
}

export async function clearDead(){
  const enemies = (AppState.table && AppState.table.enemies) || {};
  const deadIds = Object.keys(enemies).filter(id => enemies[id].wounds <= 0);
  if(!deadIds.length){ showBannerError('Nothing to clear.'); return; }

  await mutateTable(t => {
    deadIds.forEach(id => { delete t.enemies[id]; });
    t.log.push({ type: 'system', text: 'Cleared ' + deadIds.length + ' defeated ' + (deadIds.length === 1 ? 'enemy' : 'enemies') + ' from the field', time: timeNow() });
  });
  if(deadIds.includes(AppState.actingEnemyId)) AppState.actingEnemyId = null;
}
