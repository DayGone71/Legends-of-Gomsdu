import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml, timeNow, targetShorthand, computeEntryTick, computeCounterMax, apCostForControl } from './utils.js';

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

// General and Target Block are mutually exclusive — picking one clears the other.
// Clicking the currently-selected one again deselects it entirely.
export function selectBlockKind(kind){
  AppState.pendingType = 'block';
  AppState.pendingBlockKind = (AppState.pendingBlockKind === kind) ? null : kind;
  renderToggleStates();
}

// Counter is disabled until a Block kind is chosen; toggling it off is always allowed.
export function toggleCounter(){
  if(!AppState.pendingBlockKind) return;
  AppState.pendingCounter = !AppState.pendingCounter;
  renderToggleStates();
}

export function renderToggleStates(){
  const me = AppState.table && AppState.table.players[AppState.playerId];
  const control = me ? (me.control || 0) : 0;

  const fastBtn = document.getElementById('attack-fast-btn');
  const strongBtn = document.getElementById('attack-strong-btn');
  const focusBtn = document.getElementById('attack-focus-btn');
  if(fastBtn){
    fastBtn.textContent = 'Fast \u2014 ' + apCostForControl(control, 1) + ' AP';
    fastBtn.classList.toggle('toggled', AppState.pendingType === 'attack' && AppState.pendingAttackKind === 'fast');
  }
  if(strongBtn){
    strongBtn.textContent = 'Strong \u2014 ' + apCostForControl(control, 2) + ' AP';
    strongBtn.classList.toggle('toggled', AppState.pendingType === 'attack' && AppState.pendingAttackKind === 'strong');
  }
  if(focusBtn){
    focusBtn.textContent = 'Focus Attack \u2014 ' + apCostForControl(control, 2) + ' AP + 1 Focus';
    focusBtn.classList.toggle('toggled', AppState.pendingType === 'attack' && AppState.pendingAttackKind === 'focus');
  }

  const ltBtn = document.getElementById('cast-lightning');
  const lvBtn = document.getElementById('cast-lava');
  if(ltBtn){
    ltBtn.textContent = 'Lightning \u2014 8 AP';
    ltBtn.classList.toggle('toggled', AppState.pendingType === 'essence' && AppState.pendingEssenceSchool === 'Lightning');
  }
  if(lvBtn){
    lvBtn.textContent = 'Lava \u2014 8 AP';
    lvBtn.classList.toggle('toggled', AppState.pendingType === 'essence' && AppState.pendingEssenceSchool === 'Lava');
  }

  const generalBtn = document.getElementById('block-general-btn');
  const targetBtn = document.getElementById('block-target-btn');
  const counterBtn = document.getElementById('block-counter-btn');
  const baseCost = apCostForControl(control, 1);
  if(generalBtn){
    generalBtn.textContent = 'General Block \u2014 ' + baseCost + ' AP';
    generalBtn.classList.toggle('toggled', AppState.pendingBlockKind === 'general');
  }
  if(targetBtn){
    targetBtn.textContent = 'Target Block \u2014 ' + baseCost + ' AP';
    targetBtn.classList.toggle('toggled', AppState.pendingBlockKind === 'target');
  }
  if(counterBtn){
    counterBtn.textContent = 'Counter \u2014 +' + baseCost + ' AP';
    counterBtn.classList.toggle('toggled', AppState.pendingCounter);
    counterBtn.disabled = !AppState.pendingBlockKind;
    counterBtn.classList.toggle('disabled', !AppState.pendingBlockKind);
  }
}

export async function commitAction(){
  const me = AppState.table.players[AppState.playerId];
  if(!me) return;
  const spent = me.apSpent || 0;
  const focusSpent = me.focusSpent || 0;
  const control = me.control || 0;
  let entry = null;

  if(AppState.pendingType === 'attack'){
    if(!AppState.pendingAttackKind){ showBannerError('Choose Fast, Strong, or Focus first.'); return; }
    const target = AppState.table.enemies && AppState.table.enemies[AppState.selectedTargetId];
    if(!target){ showBannerError('Pick a target first.'); return; }
    const cost = apCostForControl(control, AppState.pendingAttackKind === 'fast' ? 1 : 2);
    if(spent + cost > (me.ap || 0)){ showBannerError('Not enough AP left this round.'); return; }
    if(AppState.pendingAttackKind === 'focus' && focusSpent + 1 > (me.focus || 0)){
      showBannerError('Not enough Focus left this round.'); return;
    }
    const label = AppState.pendingAttackKind === 'strong' ? 'SA' : AppState.pendingAttackKind === 'focus' ? 'FCA' : 'FA';
    entry = { apCost: cost, focusCost: AppState.pendingAttackKind === 'focus' ? 1 : 0, actionLabel: label, targetLabel: targetShorthand(target), kind: 'attack', attackKind: AppState.pendingAttackKind, targetId: AppState.selectedTargetId };
  }else if(AppState.pendingType === 'block'){
    if(!AppState.pendingBlockKind){ showBannerError('Choose General Block or Target Block first.'); return; }
    let targetId = null, targetLabel = '';
    if(AppState.pendingBlockKind === 'target'){
      const target = AppState.table.enemies && AppState.table.enemies[AppState.selectedTargetId];
      if(!target){ showBannerError('Pick a target first for Target Block.'); return; }
      targetId = AppState.selectedTargetId;
      targetLabel = targetShorthand(target);
    }
    const unit = apCostForControl(control, 1);
    const cost = unit + (AppState.pendingCounter ? unit : 0);
    if(spent + cost > (me.ap || 0)){ showBannerError('Not enough AP left this round.'); return; }
    const label = (AppState.pendingBlockKind === 'general' ? 'GB' : 'TB') + (AppState.pendingCounter ? '+C' : '');
    entry = { apCost: cost, focusCost: 0, actionLabel: label, targetLabel, kind: 'block', blockKind: AppState.pendingBlockKind, counter: AppState.pendingCounter, targetId };
  }else if(AppState.pendingType === 'essence'){
    if(!AppState.pendingEssenceSchool){ showBannerError('Choose Lightning or Lava first.'); return; }
    const target = AppState.table.enemies && AppState.table.enemies[AppState.selectedTargetId];
    if(!target){ showBannerError('Pick a target first.'); return; }
    const cost = 8; // flat for now — Essence is slated for Attunement, not Control
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
  AppState.pendingBlockKind = null;
  AppState.pendingCounter = false;
}

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

// Power reduces Flow 1-to-1. The hit that brings Flow down to (or through) 0 never
// touches Hit% no matter how much it overkills by — overflow simply doesn't carry
// anywhere. Hit% only exists for hits landing against a target already at 0 Flow
// *before* that specific hit: the first such hit is a flat 1%, and every hit after
// that (landed or not) escalates the running Hit% by its own damage amount, capping
// out at 100% once the running total crosses 99.
function applyDamage(actorName, entry, target, targetId, dmg, exposureState){
  let text = actorName + '\u2019s ' + entry.actionLabel + ' resolves on ' + entry.targetLabel;

  if(target.flow > 0){
    target.flow = Math.max(0, target.flow - dmg);
    text += ' \u2014 Flow drops to ' + target.flow + '/' + target.flowMax;
    return text;
  }

  const current = exposureState[targetId] ? exposureState[targetId].hitPercent : 1;
  const roll = Math.random() * 100;
  const wounded = roll < current;
  if(wounded){
    target.wounds = Math.max(0, target.wounds - dmg);
    text += ' \u2014 ' + current.toFixed(0) + '% lands, ' + dmg + (dmg === 1 ? ' wound' : ' wounds');
    if(target.wounds <= 0) text += ' \u2014 ' + (target.name || 'target') + ' is down!';
  }else{
    text += ' \u2014 ' + current.toFixed(0) + '% chance, holds \u2014 no wound';
  }
  exposureState[targetId] = { hitPercent: Math.min(100, current + dmg) };
  return text;
}

// Finds an unconsumed Block belonging to (ownerType, ownerId) that would intercept
// an attack from attackerId landing at attackResolveTick. General Block is checked
// first (timing-window match, sized by the owner's Range), then Target Block
// (identity match against the specific attacker, no timing constraint).
function findAndConsumeBlock(registry, ownerType, ownerId, attackerId, attackResolveTick){
  const general = registry.find(b =>
    !b.consumed && b.ownerType === ownerType && b.ownerId === ownerId && b.kind === 'general' &&
    Math.abs(attackResolveTick - b.resolveTick) <= (b.owner.range || 0)
  );
  if(general){ general.consumed = true; return general; }

  const target = registry.find(b =>
    !b.consumed && b.ownerType === ownerType && b.ownerId === ownerId && b.kind === 'target' &&
    b.targetId === attackerId
  );
  if(target){ target.consumed = true; return target; }

  return null;
}

export async function resolveRound(){
  const table = AppState.table;
  const counterMax = computeCounterMax(table);
  let allEntries = [];

  function gatherFrom(collection, actorType){
    Object.entries(collection || {}).forEach(([id, actor]) => {
      const entryTick = computeEntryTick(actor.quickness, counterMax);
      let runningCost = 0;
      (actor.sequence || []).forEach(entry => {
        runningCost += entry.apCost;
        allEntries.push({ actorType, actorId: id, actor, entry, resolveTick: Math.max(0, entryTick - runningCost) });
      });
    });
  }
  gatherFrom(table.players, 'player');
  gatherFrom(table.enemies, 'enemy');

  if(!allEntries.length){ showBannerError('Nothing staged to resolve.'); return; }
  allEntries.sort((a, b) => b.resolveTick - a.resolveTick);

  const blockRegistry = [];
  const actionEntries = [];
  allEntries.forEach(item => {
    if(item.entry.kind === 'block'){
      blockRegistry.push({
        ownerType: item.actorType, ownerId: item.actorId, owner: item.actor,
        kind: item.entry.blockKind, resolveTick: item.resolveTick,
        targetId: item.entry.targetId || null, counter: !!item.entry.counter,
        consumed: false
      });
    }else{
      actionEntries.push(item);
    }
  });

  const exposureState = {};

  await mutateTable(t => {
    t.log.push({ type: 'system', text: '\u2014 resolving the round \u2014', time: timeNow() });

    blockRegistry.forEach(b => {
      const label = b.kind === 'general' ? 'General Block' : 'Target Block';
      t.log.push({ type: 'system', text: (b.owner.name || 'Someone') + ' sets a ' + label + (b.counter ? ' with Counter' : ''), time: timeNow() });
    });

    actionEntries.forEach(item => {
      const actor = item.actor, entry = item.entry, actorName = actor.name || 'Someone';

      if(entry.kind === 'attack' && entry.attackKind === 'focus'){
        const targetCollection = item.actorType === 'player' ? t.enemies : t.players;
        const target = targetCollection && targetCollection[entry.targetId];
        if(target && target.wounds > 0){
          t.log.push({ type: 'system', text: resolveFocusBypass(actorName, actor, target), time: timeNow() });
        }else{
          t.log.push({ type: 'system', text: actorName + '\u2019s Focus Attack finds no target \u2014 already down', time: timeNow() });
        }
        return;
      }

      if(entry.kind === 'attack' || entry.kind === 'essence'){
        const targetCollection = item.actorType === 'player' ? t.enemies : t.players;
        const target = targetCollection && targetCollection[entry.targetId];
        if(!target || target.wounds <= 0){
          t.log.push({ type: 'system', text: actorName + '\u2019s ' + entry.actionLabel + ' finds no target \u2014 already down', time: timeNow() });
          return;
        }

        const targetOwnerType = item.actorType === 'player' ? 'enemy' : 'player';
        const blocked = findAndConsumeBlock(blockRegistry, targetOwnerType, entry.targetId, item.actorId, item.resolveTick);
        if(blocked){
          const blockLabel = blocked.kind === 'general' ? 'General Block' : 'Target Block';
          t.log.push({ type: 'system', text: actorName + '\u2019s ' + entry.actionLabel + ' is stopped by ' + (target.name || 'target') + '\u2019s ' + blockLabel, time: timeNow() });
          if(blocked.counter){
            const counterDmg = blocked.owner.power || 1;
            actor.flow = Math.max(0, (actor.flow || 0) - counterDmg);
            t.log.push({ type: 'system', text: (target.name || 'target') + ' counters \u2014 ' + actorName + '\u2019s Flow drops to ' + actor.flow + '/' + (actor.flowMax || 0), time: timeNow() });
          }
          return;
        }

        const dmg = entry.kind === 'attack'
          ? (actor.power || 1) + (entry.attackKind === 'strong' ? 1 : 0)
          : (actor.focus || 1);
        t.log.push({ type: 'system', text: applyDamage(actorName, entry, target, entry.targetId, dmg, exposureState), time: timeNow() });
      }
    });

    Object.values(t.players || {}).forEach(p => {
      p.sequence = []; p.apSpent = 0; p.focusSpent = 0;
      if(p.wounds > 0){
        p.flow = Math.min(p.flowMax ?? p.flow, (p.flow || 0) + (p.recovery || 0));
      }
    });
    Object.values(t.enemies || {}).forEach(e => {
      e.sequence = []; e.apSpent = 0; e.focusSpent = 0;
      if(e.wounds > 0){
        e.flow = Math.min(e.flowMax ?? e.flow, (e.flow || 0) + (e.recovery || 0));
      }
    });
  });

  AppState.pendingType = null; AppState.pendingAttackKind = null; AppState.pendingEssenceSchool = null;
  AppState.pendingBlockKind = null; AppState.pendingCounter = false;
  AppState.dmPendingType = null; AppState.dmPendingAttackKind = null; AppState.dmPendingEssenceSchool = null;
  AppState.dmPendingBlockKind = null; AppState.dmPendingCounter = false;
}

export function renderCombatCounters(){
  const me = AppState.table && AppState.table.players[AppState.playerId];
  const wEl = document.getElementById('cb-wounds-display');
  const aEl = document.getElementById('cb-ap-display');
  const fEl = document.getElementById('cb-flow-display');
  const fcEl = document.getElementById('cb-focus-display');
  const ctrlEl = document.getElementById('cb-control-display');
  if(!me || !wEl || !aEl) return;
  wEl.textContent = (me.wounds ?? 0) + '/' + (me.woundsMax ?? 0);
  aEl.textContent = (me.apSpent || 0) + '/' + (me.ap ?? 0);
  if(fEl) fEl.textContent = (me.flow ?? 0) + '/' + (me.flowMax ?? 0);
  if(fcEl) fcEl.textContent = ((me.focus || 0) - (me.focusSpent || 0)) + '/' + (me.focus ?? 0);
  if(ctrlEl) ctrlEl.textContent = (me.control ?? 0) + ' (base action: ' + apCostForControl(me.control || 0, 1) + ' AP)';

  const focusBtn = document.getElementById('attack-focus-btn');
  if(focusBtn) focusBtn.classList.toggle('hidden', !((me.focus || 0) > 0));

  const hasEssence = (me.lightning > 0) || (me.lava > 0);
  const essBtn = document.getElementById('essence-btn');
  if(essBtn) essBtn.classList.toggle('hidden', !hasEssence);
  const lt = document.getElementById('cast-lightning');
  const lv = document.getElementById('cast-lava');
  if(lt) lt.classList.toggle('hidden', !(me.lightning > 0));
  if(lv) lv.classList.toggle('hidden', !(me.lava > 0));

  renderToggleStates();
}
