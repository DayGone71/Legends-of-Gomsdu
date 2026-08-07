import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml, timeNow, targetShorthand, computeEntryTick, computeCounterMax } from './utils.js';

function showBannerError(msg){
  const el = document.getElementById('banner-error');
  if(!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

export function renderTargetRange(){
  const el = document.getElementById('target-range');
  if(!el) return;
  const enemies = (AppState.table && AppState.table.enemies) || {};
  const list = Object.entries(enemies);
  if(!list.length){ el.innerHTML = '<div class="log-empty">No enemies in the encounter.</div>'; return; }

  el.innerHTML = list.map(([id, e]) => {
    const defeated = e.wounds <= 0;
    let cls = 'target-chip';
    if(id === AppState.selectedTargetId) cls += ' selected';
    if(defeated) cls += ' defeated';
    return '<div class="' + cls + '" data-id="' + id + '">' +
      escapeHtml(e.name) + ' &mdash; ' + Math.max(0, e.wounds) + '/' + e.woundsMax + '</div>';
  }).join('');

  el.querySelectorAll('.target-chip').forEach(chip => {
    chip.onclick = () => selectTarget(chip.dataset.id);
  });
}

export function selectTarget(id){
  const enemy = AppState.table && AppState.table.enemies && AppState.table.enemies[id];
  if(!enemy || enemy.wounds <= 0) return;
  AppState.selectedTargetId = id;
  renderTargetRange();
}

export function toggleMenu(name){
  const target = document.getElementById('menu-' + name);
  const wasHidden = target ? target.classList.contains('hidden') : true;
  ['attack', 'block', 'essence'].forEach(m => {
    const el = document.getElementById('menu-' + m);
    if(!el) return;
    if(m === name) el.classList.toggle('hidden', !wasHidden);
    else el.classList.add('hidden');
  });
}

export function selectAttackKind(kind){
  AppState.pendingType = 'attack';
  AppState.pendingAttackKind = kind;
  renderToggleStates();
}

export function selectEssenceSchool(school){
  AppState.pendingType = 'essence';
  AppState.pendingEssenceSchool = school;
  renderToggleStates();
}

export function renderToggleStates(){
  const fastBtn = document.getElementById('attack-fast-btn');
  const strongBtn = document.getElementById('attack-strong-btn');
  if(fastBtn) fastBtn.classList.toggle('toggled', AppState.pendingType === 'attack' && AppState.pendingAttackKind === 'fast');
  if(strongBtn) strongBtn.classList.toggle('toggled', AppState.pendingType === 'attack' && AppState.pendingAttackKind === 'strong');
  const ltBtn = document.getElementById('cast-lightning');
  const lvBtn = document.getElementById('cast-lava');
  if(ltBtn) ltBtn.classList.toggle('toggled', AppState.pendingType === 'essence' && AppState.pendingEssenceSchool === 'Lightning');
  if(lvBtn) lvBtn.classList.toggle('toggled', AppState.pendingType === 'essence' && AppState.pendingEssenceSchool === 'Lava');
}

export async function commitAction(){
  const me = AppState.table.players[AppState.playerId];
  if(!me) return;
  const spent = me.apSpent || 0;
  let entry = null;

  if(AppState.pendingType === 'attack'){
    if(!AppState.pendingAttackKind){ showBannerError('Choose Fast or Strong first.'); return; }
    const target = AppState.table.enemies && AppState.table.enemies[AppState.selectedTargetId];
    if(!target){ showBannerError('Pick a target first.'); return; }
    const cost = AppState.pendingAttackKind === 'strong' ? 10 : 5;
    if(spent + cost > (me.ap || 0)){ showBannerError('Not enough AP left this round.'); return; }
    entry = { apCost: cost, actionLabel: AppState.pendingAttackKind === 'strong' ? 'SA' : 'FA', targetLabel: targetShorthand(target), kind: 'attack', attackKind: AppState.pendingAttackKind, targetId: AppState.selectedTargetId };
  }else if(AppState.pendingType === 'block'){
    const base = document.getElementById('block-base').checked;
    const maintain = document.getElementById('block-maintain').checked;
    const counter = document.getElementById('block-counter').checked;
    const cost = (base ? 5 : 0) + (maintain ? 5 : 0) + (counter ? 5 : 0);
    if(cost === 0){ showBannerError('Check at least Block.'); return; }
    if(spent + cost > (me.ap || 0)){ showBannerError('Not enough AP left this round.'); return; }
    entry = { apCost: cost, actionLabel: (base ? 'B' : '') + (maintain ? 'M' : '') + (counter ? 'C' : ''), targetLabel: '', kind: 'block', maintain, counter };
  }else if(AppState.pendingType === 'essence'){
    if(!AppState.pendingEssenceSchool){ showBannerError('Choose Lightning or Lava first.'); return; }
    const target = AppState.table.enemies && AppState.table.enemies[AppState.selectedTargetId];
    if(!target){ showBannerError('Pick a target first.'); return; }
    const cost = 8;
    if(spent + cost > (me.ap || 0)){ showBannerError('Not enough AP left this round.'); return; }
    entry = { apCost: cost, actionLabel: AppState.pendingEssenceSchool === 'Lava' ? 'LV' : 'LN', targetLabel: targetShorthand(target), kind: 'essence', school: AppState.pendingEssenceSchool, targetId: AppState.selectedTargetId };
  }else{
    showBannerError('Open Attack, Block, or Essence and choose something first.');
    return;
  }

  await mutateTable(t => {
    const actor = t.players[AppState.playerId];
    if(!actor.sequence) actor.sequence = [];
    actor.sequence.push(entry);
    actor.apSpent = spent + entry.apCost;
    t.log.push({ type: 'system', text: actor.name + ' stages ' + entry.actionLabel + (entry.targetLabel ? (' on ' + entry.targetLabel) : ''), time: timeNow() });
  });
}

export async function undoAction(){
  const me = AppState.table.players[AppState.playerId];
  if(!me || !me.sequence || !me.sequence.length) return;
  await mutateTable(t => {
    const actor = t.players[AppState.playerId];
    const removed = actor.sequence.pop();
    actor.apSpent = Math.max(0, (actor.apSpent || 0) - removed.apCost);
    t.log.push({ type: 'system', text: actor.name + ' undoes ' + removed.actionLabel + (removed.targetLabel ? (' on ' + removed.targetLabel) : ''), time: timeNow() });
  });
}

export async function resetAP(){
  await mutateTable(t => {
    const me = t.players[AppState.playerId];
    if(!me) return;
    me.apSpent = 0;
    me.sequence = [];
  });
  AppState.pendingType = null;
  AppState.pendingAttackKind = null;
  AppState.pendingEssenceSchool = null;
}

export async function resolveRound(){
  const table = AppState.table;
  const counterMax = computeCounterMax(table);
  let allEntries = [];

  Object.entries(table.players || {}).forEach(([id, actor]) => {
    const entryTick = computeEntryTick(actor.quickness, counterMax);
    let runningCost = 0;
    (actor.sequence || []).forEach(entry => {
      runningCost += entry.apCost;
      allEntries.push({ actorType: 'player', actor, entry, resolveTick: Math.max(0, entryTick - runningCost) });
    });
  });
  Object.entries(table.enemies || {}).forEach(([id, actor]) => {
    const entryTick = computeEntryTick(actor.quickness, counterMax);
    let runningCost = 0;
    (actor.sequence || []).forEach(entry => {
      runningCost += entry.apCost;
      allEntries.push({ actorType: 'enemy', actor, entry, resolveTick: Math.max(0, entryTick - runningCost) });
    });
  });

  if(!allEntries.length){ showBannerError('Nothing staged to resolve.'); return; }
  allEntries.sort((a, b) => b.resolveTick - a.resolveTick);

  await mutateTable(t => {
    t.log.push({ type: 'system', text: '\u2014 resolving the round \u2014', time: timeNow() });

    allEntries.forEach(item => {
      const actor = item.actor, entry = item.entry;
      const actorName = actor.name || 'Someone';
      if(entry.kind === 'attack' || entry.kind === 'essence'){
        const targetCollection = item.actorType === 'player' ? t.enemies : t.players;
        const target = targetCollection && targetCollection[entry.targetId];
        if(target && target.wounds > 0){
          const dmg = entry.kind === 'attack'
            ? (actor.power || 1) + (entry.attackKind === 'strong' ? 1 : 0)
            : (actor.focus || 1);
          target.wounds = Math.max(0, target.wounds - dmg);
          let text = actorName + '\u2019s ' + entry.actionLabel + ' resolves on ' + entry.targetLabel + ' for ' + dmg + (dmg === 1 ? ' wound' : ' wounds');
          if(target.wounds <= 0) text += ' \u2014 ' + (target.name || 'target') + ' is down!';
          t.log.push({ type: 'system', text, time: timeNow() });
        }else{
          t.log.push({ type: 'system', text: actorName + '\u2019s ' + entry.actionLabel + ' finds no target \u2014 already down', time: timeNow() });
        }
      }else if(entry.kind === 'block'){
        t.log.push({ type: 'system', text: actorName + '\u2019s ' + entry.actionLabel + ' holds \u2014 doesn\u2019t reduce damage yet, that check is still the next piece', time: timeNow() });
      }
    });

    Object.values(t.players || {}).forEach(p => { p.sequence = []; p.apSpent = 0; });
    Object.values(t.enemies || {}).forEach(e => { e.sequence = []; e.apSpent = 0; });
  });

  AppState.pendingType = null; AppState.pendingAttackKind = null; AppState.pendingEssenceSchool = null;
  AppState.dmPendingType = null; AppState.dmPendingAttackKind = null; AppState.dmPendingEssenceSchool = null;
}

export function renderCombatCounters(){
  const me = AppState.table && AppState.table.players[AppState.playerId];
  const wEl = document.getElementById('cb-wounds-display');
  const aEl = document.getElementById('cb-ap-display');
  if(!me || !wEl || !aEl) return;
  wEl.textContent = (me.wounds ?? 0) + '/' + (me.woundsMax ?? 0);
  aEl.textContent = (me.apSpent || 0) + '/' + (me.ap ?? 0);

  const hasEssence = (me.lightning > 0) || (me.lava > 0);
  const essBtn = document.getElementById('essence-btn');
  if(essBtn) essBtn.classList.toggle('hidden', !hasEssence);
  const lt = document.getElementById('cast-lightning');
  const lv = document.getElementById('cast-lava');
  if(lt) lt.classList.toggle('hidden', !(me.lightning > 0));
  if(lv) lv.classList.toggle('hidden', !(me.lava > 0));
}
