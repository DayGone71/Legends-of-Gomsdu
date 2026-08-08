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
  AppState.pendingAttackKind = kind; // 'fast' | 'strong' | 'focus'
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
  const focusBtn = document.getElementById('attack-focus-btn');
  if(fastBtn) fastBtn.classList.toggle('toggled', AppState.pendingType === 'attack' && AppState.pendingAttackKind === 'fast');
  if(strongBtn) strongBtn.classList.toggle('toggled', AppState.pendingType === 'attack' && AppState.pendingAttackKind === 'strong');
  if(focusBtn) focusBtn.classList.toggle('toggled', AppState.pendingType === 'attack' && AppState.pendingAttackKind === 'focus');
  const ltBtn = document.getElementById('cast-lightning');
  const lvBtn = document.getElementById('cast-lava');
  if(ltBtn) ltBtn.classList.toggle('toggled', AppState.pendingType === 'essence' && AppState.pendingEssenceSchool === 'Lightning');
  if(lvBtn) lvBtn.classList.toggle('toggled', AppState.pendingType === 'essence' && AppState.pendingEssenceSchool === 'Lava');
}

// AP cost for each attack kind, before Control is applied.
const ATTACK_AP_COST = { fast: 5, strong: 10, focus: 10 };

// Control 10 means every Action costs 1 AP, full stop — no partial scaling yet,
// that's an explicitly deferred future system. Anything below 10 costs the normal
// base amount, unchanged.
function applyControl(actor, baseCost){
  return (actor.control || 0) >= 10 ? 1 : baseCost;
}

export async function commitAction(){
  const me = AppState.table.players[AppState.playerId];
  if(!me) return;
  const spent = me.apSpent || 0;
  const focusSpent = me.focusSpent || 0;
  let entry = null;

  if(AppState.pendingType === 'attack'){
    if(!AppState.pendingAttackKind){ showBannerError('Choose Fast, Strong, or Focus first.'); return; }
    const target = AppState.table.enemies && AppState.table.enemies[AppState.selectedTargetId];
    if(!target){ showBannerError('Pick a target first.'); return; }
    const cost = applyControl(me, ATTACK_AP_COST[AppState.pendingAttackKind]);
    if(spent + cost > (me.ap || 0)){ showBannerError('Not enough AP left this round.'); return; }
    if(AppState.pendingAttackKind === 'focus' && focusSpent + 1 > (me.focus || 0)){
      showBannerError('Not enough Focus left this round.'); return;
    }
    const label = AppState.pendingAttackKind === 'strong' ? 'SA' : AppState.pendingAttackKind === 'focus' ? 'FCA' : 'FA';
    entry = { apCost: cost, focusCost: AppState.pendingAttackKind === 'focus' ? 1 : 0, actionLabel: label, targetLabel: targetShorthand(target), kind: 'attack', attackKind: AppState.pendingAttackKind, targetId: AppState.selectedTargetId };
  }else if(AppState.pendingType === 'block'){
    const base = document.getElementById('block-base').checked;
    const maintain = document.getElementById('block-maintain').checked;
    const counter = document.getElementById('block-counter').checked;
    const rawCost = (base ? 5 : 0) + (maintain ? 5 : 0) + (counter ? 5 : 0);
    if(rawCost === 0){ showBannerError('Check at least Block.'); return; }
    const cost = applyControl(me, rawCost);
    if(spent + cost > (me.ap || 0)){ showBannerError('Not enough AP left this round.'); return; }
    entry = { apCost: cost, focusCost: 0, actionLabel: (base ? 'B' : '') + (maintain ? 'M' : '') + (counter ? 'C' : ''), targetLabel: '', kind: 'block', maintain, counter };
  }else if(AppState.pendingType === 'essence'){
    if(!AppState.pendingEssenceSchool){ showBannerError('Choose Lightning or Lava first.'); return; }
    const target = AppState.table.enemies && AppState.table.enemies[AppState.selectedTargetId];
    if(!target){ showBannerError('Pick a target first.'); return; }
    const cost = applyControl(me, 8);
    if(spent + cost > (me.ap || 0)){ showBannerError('Not enough AP left this round.'); return; }
    entry = { apCost: cost, focusCost: 0, actionLabel: AppState.pendingEssenceSchool === 'Lava' ? 'LV' : 'LN', targetLabel: targetShorthand(target), kind: 'essence', school: AppState.pendingEssenceSchool, targetId: AppState.selectedTargetId };
  }else{
    showBannerError('Open Attack, Block, or Essence and choose something first.');
    return;
  }

  await mutateTable(t => {
    const actor = t.players[AppState.playerId];
    if(!actor.sequence) actor.sequence = [];
    actor.sequence.push(entry);
    actor.apSpent = spent + entry.apCost;
    actor.focusSpent = focusSpent + (entry.focusCost || 0);
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
    actor.focusSpent = Math.max(0, (actor.focusSpent || 0) - (removed.focusCost || 0));
    t.log.push({ type: 'system', text: actor.name + ' undoes ' + removed.actionLabel + (removed.targetLabel ? (' on ' + removed.targetLabel) : ''), time: timeNow() });
  });
}

export async function resetAP(){
  await mutateTable(t => {
    const me = t.players[AppState.playerId];
    if(!me) return;
    me.apSpent = 0;
    me.focusSpent = 0;
    me.sequence = [];
  });
  AppState.pendingType = null;
  AppState.pendingAttackKind = null;
  AppState.pendingEssenceSchool = null;
}

// Flow absorbs damage first, with overflow carrying directly into Wounds — like armor
// that breaks. Once Flow is already at 0 going into a hit, damage stops being
// deterministic: the categorical model is 0% (Flow > 0, fully shielded), 1% (the
// first hit taken while exposed this Resolve pass — a near-miss), or 100%
// (any further hit against the same exposed target in the same pass).
function resolveHit(actorName, entry, target, targetId, dmg, exposureCounts){
  let text = actorName + '\u2019s ' + entry.actionLabel + ' resolves on ' + entry.targetLabel;
  let wounded = false;

  if(target.flow > 0){
    const overflow = Math.max(0, dmg - target.flow);
    target.flow = Math.max(0, target.flow - dmg);
    if(overflow > 0){
      target.wounds = Math.max(0, target.wounds - overflow);
      wounded = true;
      text += ' \u2014 shatters through Flow, ' + overflow + (overflow === 1 ? ' wound' : ' wounds') + ' overkill';
    }else{
      text += ' \u2014 absorbed by Flow (' + target.flow + '/' + target.flowMax + ' left)';
    }
  }else{
    const count = (exposureCounts[targetId] || 0) + 1;
    exposureCounts[targetId] = count;
    const chancePercent = count === 1 ? 1 : 100;
    const roll = Math.random() * 100;
    if(roll < chancePercent){
      target.wounds = Math.max(0, target.wounds - dmg);
      wounded = true;
      text += count === 1
        ? ' \u2014 the 1% chance lands, ' + dmg + (dmg === 1 ? ' wound' : ' wounds')
        : ' \u2014 fully exposed, ' + dmg + (dmg === 1 ? ' wound' : ' wounds');
    }else{
      text += ' \u2014 exposed, but the 1% holds \u2014 no wound';
    }
  }

  if(wounded && target.wounds <= 0) text += ' \u2014 ' + (target.name || 'target') + ' is down!';
  return text;
}

// A Focus Attack skips Flow and Wounds-chance entirely — it either lands full
// damage straight to Wounds, or fails outright if the defender has any Focus left,
// costing the defender one Focus point to hold it off.
function resolveFocusBypass(actorName, actor, target){
  const defenderRemaining = (target.focus || 0) - (target.focusSpent || 0);
  if(defenderRemaining >= 1){
    target.focusSpent = (target.focusSpent || 0) + 1;
    return actorName + '\u2019s Focus Attack is blocked \u2014 ' + (target.name || 'target') + ' spends a Focus point to hold';
  }
  const dmg = actor.power || 1;
  target.wounds = Math.max(0, target.wounds - dmg);
  let text = actorName + '\u2019s Focus Attack bypasses everything \u2014 ' + dmg + (dmg === 1 ? ' wound' : ' wounds') + ' straight through';
  if(target.wounds <= 0) text += ' \u2014 ' + (target.name || 'target') + ' is down!';
  return text;
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

  // Tracks how many exposed (0-Flow) hits each target has taken so far in this
  // single Resolve pass — resets every round, per how "the Sequencer keeps track."
  const exposureCounts = {};

  await mutateTable(t => {
    t.log.push({ type: 'system', text: '\u2014 resolving the round \u2014', time: timeNow() });

    allEntries.forEach(item => {
      const actor = item.actor, entry = item.entry;
      const actorName = actor.name || 'Someone';

      if(entry.kind === 'attack' && entry.attackKind === 'focus'){
        const targetCollection = item.actorType === 'player' ? t.enemies : t.players;
        const target = targetCollection && targetCollection[entry.targetId];
        if(target && target.wounds > 0){
          t.log.push({ type: 'system', text: resolveFocusBypass(actorName, actor, target), time: timeNow() });
        }else{
          t.log.push({ type: 'system', text: actorName + '\u2019s Focus Attack finds no target \u2014 already down', time: timeNow() });
        }
      }else if(entry.kind === 'attack' || entry.kind === 'essence'){
        const targetCollection = item.actorType === 'player' ? t.enemies : t.players;
        const target = targetCollection && targetCollection[entry.targetId];
        if(target && target.wounds > 0){
          const dmg = entry.kind === 'attack'
            ? (actor.power || 1) + (entry.attackKind === 'strong' ? 1 : 0)
            : (actor.focus || 1);
          t.log.push({ type: 'system', text: resolveHit(actorName, entry, target, entry.targetId, dmg, exposureCounts), time: timeNow() });
        }else{
          t.log.push({ type: 'system', text: actorName + '\u2019s ' + entry.actionLabel + ' finds no target \u2014 already down', time: timeNow() });
        }
      }else if(entry.kind === 'block'){
        t.log.push({ type: 'system', text: actorName + '\u2019s ' + entry.actionLabel + ' holds \u2014 doesn\u2019t reduce damage yet, that check is still the next piece', time: timeNow() });
      }
    });

    // Flow regenerates every round by each character's own Recovery stat.
    Object.values(t.players || {}).forEach(p => {
      p.sequence = []; p.apSpent = 0; p.focusSpent = 0;
      p.flow = Math.min(p.flowMax ?? p.flow, (p.flow || 0) + (p.recovery || 0));
    });
    Object.values(t.enemies || {}).forEach(e => {
      e.sequence = []; e.apSpent = 0; e.focusSpent = 0;
      e.flow = Math.min(e.flowMax ?? e.flow, (e.flow || 0) + (e.recovery || 0));
    });
  });

  AppState.pendingType = null; AppState.pendingAttackKind = null; AppState.pendingEssenceSchool = null;
  AppState.dmPendingType = null; AppState.dmPendingAttackKind = null; AppState.dmPendingEssenceSchool = null;
}

export function renderCombatCounters(){
  const me = AppState.table && AppState.table.players[AppState.playerId];
  const wEl = document.getElementById('cb-wounds-display');
  const aEl = document.getElementById('cb-ap-display');
  const fEl = document.getElementById('cb-flow-display');
  const fcEl = document.getElementById('cb-focus-display');
  if(!me || !wEl || !aEl) return;
  wEl.textContent = (me.wounds ?? 0) + '/' + (me.woundsMax ?? 0);
  aEl.textContent = (me.apSpent || 0) + '/' + (me.ap ?? 0);
  if(fEl) fEl.textContent = (me.flow ?? 0) + '/' + (me.flowMax ?? 0);
  if(fcEl) fcEl.textContent = ((me.focus || 0) - (me.focusSpent || 0)) + '/' + (me.focus ?? 0);
  const ctrlEl = document.getElementById('cb-control-display');
  if(ctrlEl) ctrlEl.textContent = (me.control ?? 0) + (((me.control || 0) >= 10) ? ' (1 AP actions active)' : '');

  const fastBtn = document.getElementById('attack-fast-btn');
  const strongBtn = document.getElementById('attack-strong-btn');
  const focusBtn = document.getElementById('attack-focus-btn');
  if(fastBtn) fastBtn.textContent = 'Fast \u2014 ' + applyControl(me, 5) + ' AP';
  if(strongBtn) strongBtn.textContent = 'Strong \u2014 ' + applyControl(me, 10) + ' AP';
  if(focusBtn) focusBtn.textContent = 'Focus Attack \u2014 ' + applyControl(me, 10) + ' AP + 1 Focus';
  const ltBtn = document.getElementById('cast-lightning');
  const lvBtn = document.getElementById('cast-lava');
  if(ltBtn) ltBtn.textContent = 'Lightning \u2014 ' + applyControl(me, 8) + ' AP';
  if(lvBtn) lvBtn.textContent = 'Lava \u2014 ' + applyControl(me, 8) + ' AP';

  if(focusBtn) focusBtn.classList.toggle('hidden', !((me.focus || 0) > 0));

  const hasEssence = (me.lightning > 0) || (me.lava > 0);
  const essBtn = document.getElementById('essence-btn');
  if(essBtn) essBtn.classList.toggle('hidden', !hasEssence);
  const lt = document.getElementById('cast-lightning');
  const lv = document.getElementById('cast-lava');
  if(lt) lt.classList.toggle('hidden', !(me.lightning > 0));
  if(lv) lv.classList.toggle('hidden', !(me.lava > 0));
}
