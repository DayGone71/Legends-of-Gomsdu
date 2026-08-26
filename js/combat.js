import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml, timeNow, targetShorthand, computeEntryTick, computeCounterMax, apCostForControl, describeAction, powerToDamage, DEATH_WOUNDS_DEFAULT, isDown, isDeathWounded, resolveEntityRef, ownerTypeOf, possessedEnemyIds, deliverMindeyeEntry, enemyRoster, alliedRoster, showBannerError } from './utils.js';
import { removeEnemy } from './dm.js';
import { TECHNIQUES } from './techniques.js';
import { MAX_MINI_PARTY } from './possession.js';
import { addChunksAt, applySpillAt, tickLavaTiles } from './map.js';
import { BUILDS, spawnCharacter } from './character.js';
import { freezeSequencerReveal } from './sequencer.js';

export function renderTargetRange(){
  const el = document.getElementById('target-range');
  if(!el) return;
  const possessed = possessedEnemyIds(AppState.table);
  const rows = enemyRoster(AppState.table).filter(r => !possessed.has(r.id));
  if(!rows.length){ el.innerHTML = '<div class="log-empty">No enemies in the encounter.</div>'; return; }

  el.innerHTML = rows.map(r => {
    const e = r.entity;
    let cls = 'target-chip';
    if(r.id === AppState.selectedTargetId && AppState.selectedTargetSide === 'enemy') cls += ' selected';
    if(r.dead) cls += ' defeated';
    const removeX = r.dead ? '<span class="chip-remove-x" data-id="' + r.id + '">✕</span>' : '';
    return '<div class="' + cls + '" data-id="' + r.id + '">' +
      escapeHtml(r.name) + ' &mdash; ' + Math.max(0, e.wounds) + '/' + e.woundsMax + removeX + '</div>';
  }).join('');

  el.querySelectorAll('.target-chip').forEach(chip => {
    chip.onclick = () => selectTarget(chip.dataset.id);
  });
  el.querySelectorAll('.chip-remove-x').forEach(x => {
    x.onclick = (ev) => { ev.stopPropagation(); removeEnemy(x.dataset.id); };
  });
}

export function selectTarget(id){
  const enemy = AppState.table && AppState.table.enemies && AppState.table.enemies[id];
  if(!enemy || isDeathWounded(enemy)) return;
  AppState.selectedTargetId = id;
  AppState.selectedTargetSide = 'enemy';
  renderTargetRange();
  renderAllyRange();
}

// Ally Targeting: the Player, every other Player, and their statted
// Mini-Party members are all valid targets, same as Enemies — anybody can
// target anybody. Un-statted Mini-Party stubs are skipped — no wounds to
// track, not a legitimate combat target yet.
export function renderAllyRange(){
  const el = document.getElementById('ally-range');
  if(!el) return;
  const table = AppState.table;
  if(!table){ el.innerHTML = ''; return; }

  // "(You)" is this render's own overlay on the shared roster row — stays
  // local to Combat's own Ally Range rather than baked into the canonical helper.
  const rows = alliedRoster(table).map(r => r.id === AppState.playerId ? { ...r, sub: '(You)' } : r);

  if(!rows.length){ el.innerHTML = '<div class="log-empty">No Allies to target.</div>'; return; }

  el.innerHTML = rows.map(r => {
    let cls = 'target-chip';
    if(r.id === AppState.selectedTargetId && AppState.selectedTargetSide === 'ally') cls += ' selected';
    if(r.dead) cls += ' defeated';
    return '<div class="' + cls + '" data-id="' + r.id + '">' + escapeHtml(r.name) +
      (r.sub ? ' <span class="chip-sub">' + escapeHtml(r.sub) + '</span>' : '') + '</div>';
  }).join('');

  el.querySelectorAll('.target-chip').forEach(chip => {
    chip.onclick = () => selectAllyTarget(chip.dataset.id);
  });
}

export function selectAllyTarget(id){
  const target = resolveEntityRef(AppState.table, id);
  if(!target || isDeathWounded(target)) return;
  AppState.selectedTargetId = id;
  AppState.selectedTargetSide = 'ally';
  renderTargetRange();
  renderAllyRange();
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
    fastBtn.textContent = 'Fast — ' + apCostForControl(control, 1) + ' AP';
    fastBtn.classList.toggle('toggled', AppState.pendingType === 'attack' && AppState.pendingAttackKind === 'fast');
  }
  if(strongBtn){
    strongBtn.textContent = 'Strong — ' + apCostForControl(control, 2) + ' AP';
    strongBtn.classList.toggle('toggled', AppState.pendingType === 'attack' && AppState.pendingAttackKind === 'strong');
  }
  if(focusBtn){
    focusBtn.textContent = 'Focus Attack — ' + apCostForControl(control, 2) + ' AP + 1 Focus';
    focusBtn.classList.toggle('toggled', AppState.pendingType === 'attack' && AppState.pendingAttackKind === 'focus');
  }

  const ltBtn = document.getElementById('cast-lightning');
  const lvBtn = document.getElementById('cast-lava');
  if(ltBtn){
    ltBtn.textContent = 'Lightning — 8 AP';
    ltBtn.classList.toggle('toggled', AppState.pendingType === 'essence' && AppState.pendingEssenceSchool === 'Lightning');
  }
  if(lvBtn){
    lvBtn.textContent = 'Lava — 8 AP';
    lvBtn.classList.toggle('toggled', AppState.pendingType === 'essence' && AppState.pendingEssenceSchool === 'Lava');
  }

  const generalBtn = document.getElementById('block-general-btn');
  const targetBtn = document.getElementById('block-target-btn');
  const counterBtn = document.getElementById('block-counter-btn');
  const baseCost = apCostForControl(control, 1);
  if(generalBtn){
    generalBtn.textContent = 'General Block — ' + baseCost + ' AP';
    generalBtn.classList.toggle('toggled', AppState.pendingBlockKind === 'general');
  }
  if(targetBtn){
    targetBtn.textContent = 'Target Block — ' + baseCost + ' AP';
    targetBtn.classList.toggle('toggled', AppState.pendingBlockKind === 'target');
  }
  if(counterBtn){
    counterBtn.textContent = 'Counter — +' + baseCost + ' AP';
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
    const target = resolveEntityRef(AppState.table, AppState.selectedTargetId);
    if(!target){ showBannerError('Pick a target first.'); return; }
    const cost = apCostForControl(control, AppState.pendingAttackKind === 'fast' ? 1 : 2);
    if(spent + cost > (me.ap || 0)){ showBannerError('Not enough AP left this round.'); return; }
    if(AppState.pendingAttackKind === 'focus' && focusSpent + 1 > (me.focus || 0)){
      showBannerError('Not enough Focus left this round.'); return;
    }
    const label = AppState.pendingAttackKind === 'strong' ? 'SA' : AppState.pendingAttackKind === 'focus' ? 'FCA' : 'FA';
    entry = { apCost: cost, focusCost: AppState.pendingAttackKind === 'focus' ? 1 : 0, actionLabel: label, targetLabel: targetShorthand(target), targetName: target.name, kind: 'attack', attackKind: AppState.pendingAttackKind, targetId: AppState.selectedTargetId };
  }else if(AppState.pendingType === 'block'){
    if(!AppState.pendingBlockKind){ showBannerError('Choose General Block or Target Block first.'); return; }
    let targetId = null, targetLabel = '', targetName = '';
    if(AppState.pendingBlockKind === 'target'){
      const target = resolveEntityRef(AppState.table, AppState.selectedTargetId);
      if(!target){ showBannerError('Pick a target first for Target Block.'); return; }
      targetId = AppState.selectedTargetId;
      targetLabel = targetShorthand(target);
      targetName = target.name;
    }
    const unit = apCostForControl(control, 1);
    const cost = unit + (AppState.pendingCounter ? unit : 0);
    if(spent + cost > (me.ap || 0)){ showBannerError('Not enough AP left this round.'); return; }
    const label = (AppState.pendingBlockKind === 'general' ? 'GB' : 'TB') + (AppState.pendingCounter ? '+C' : '');
    entry = { apCost: cost, focusCost: 0, actionLabel: label, targetLabel, targetName, kind: 'block', blockKind: AppState.pendingBlockKind, counter: AppState.pendingCounter, targetId };
  }else if(AppState.pendingType === 'essence'){
    if(!AppState.pendingEssenceSchool){ showBannerError('Choose Lightning or Lava first.'); return; }
    const target = resolveEntityRef(AppState.table, AppState.selectedTargetId);
    if(!target){ showBannerError('Pick a target first.'); return; }
    const cost = 8; // flat for now — Essence is slated for Attunement, not Control
    if(spent + cost > (me.ap || 0)){ showBannerError('Not enough AP left this round.'); return; }
    entry = { apCost: cost, focusCost: 0, actionLabel: AppState.pendingEssenceSchool === 'Lava' ? 'LV' : 'LN', targetLabel: targetShorthand(target), targetName: target.name, kind: 'essence', school: AppState.pendingEssenceSchool, targetId: AppState.selectedTargetId };
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
    t.log.push({ type: 'system', text: actor.name + ' stages ' + describeAction(entry) + (entry.targetName ? (' on ' + entry.targetName) : ''), time: timeNow() });
  });
}

// Shared by undoAction/removeStagedAction below — a removed entry might be a
// plain Attack/Block or a Technique (also carrying flow/lightning/lava
// cost); restoring all five uniformly means neither function needs to know
// which kind of entry it's reversing.
function restoreEntryCosts(actor, removed){
  actor.apSpent = Math.max(0, (actor.apSpent || 0) - (removed.apCost || 0));
  actor.focusSpent = Math.max(0, (actor.focusSpent || 0) - (removed.focusCost || 0));
  actor.lightningSpent = Math.max(0, (actor.lightningSpent || 0) - (removed.lightningCost || 0));
  actor.lavaSpent = Math.max(0, (actor.lavaSpent || 0) - (removed.lavaCost || 0));
  if(removed.flowCost) actor.flow = Math.min(actor.flowMax ?? actor.flow, (actor.flow || 0) + removed.flowCost);
}

export async function undoAction(){
  const me = AppState.table.players[AppState.playerId];
  if(!me || !me.sequence || !me.sequence.length) return;
  await mutateTable(t => {
    const actor = t.players[AppState.playerId];
    const removed = actor.sequence.pop();
    restoreEntryCosts(actor, removed);
    t.log.push({ type: 'system', text: actor.name + ' undoes ' + describeAction(removed) + (removed.targetName ? (' on ' + removed.targetName) : ''), time: timeNow() });
  });
}

// Companion to undoAction above — Undo only pops the most recent staged
// entry; this removes any one of them directly, by splicing it out.
export async function removeStagedAction(index){
  const me = AppState.table.players[AppState.playerId];
  if(!me || !me.sequence || !me.sequence[index]) return;
  await mutateTable(t => {
    const actor = t.players[AppState.playerId];
    const removed = actor.sequence.splice(index, 1)[0];
    restoreEntryCosts(actor, removed);
    t.log.push({ type: 'system', text: actor.name + ' removes ' + describeAction(removed) + (removed.targetName ? (' on ' + removed.targetName) : ''), time: timeNow() });
  });
}

export function renderStagedActions(){
  const me = AppState.table && AppState.table.players[AppState.playerId];
  const el = document.getElementById('cb-staged-list');
  if(!el) return;
  const seq = (me && me.sequence) || [];
  if(!seq.length){ el.innerHTML = ''; return; }
  el.innerHTML = seq.map((entry, i) =>
    '<div class="staged-row"><span>' + escapeHtml(describeAction(entry)) +
    (entry.targetName ? ' on ' + escapeHtml(entry.targetName) : '') + '</span>' +
    '<span class="staged-remove-x" data-index="' + i + '">✕</span></div>'
  ).join('');
  el.querySelectorAll('.staged-remove-x').forEach(x => {
    x.onclick = () => removeStagedAction(parseInt(x.dataset.index, 10));
  });
}

// "N Wounds (XX% Dmg)" — the percentage is against the target's personal
// Down threshold, so a hit's real weight reads at a glance.
function woundLine(woundDmg, target){
  const pct = target.woundsMax ? Math.round((woundDmg / target.woundsMax) * 100) : 0;
  return woundDmg + (woundDmg === 1 ? ' Wound' : ' Wounds') + ' (' + pct + '% Dmg)';
}

// Resilience negates a flat slice of incoming Wound damage per hit — also
// what governs how far x can climb past a character's personal y, as the
// emergent effect of every hit landing lighter. Divisor is a rough placeholder — tune freely.
const RESILIENCE_DAMAGE_DIVISOR = 5;
function negateByResilience(woundDmg, target){
  return Math.max(0, woundDmg - Math.floor((target.resilience || 0) / RESILIENCE_DAMAGE_DIVISOR));
}

// Applies a Wound hit: Resilience shaves it first, then x climbs (clamped at
// the species-fixed Death Wounds threshold). Returns the actually-applied
// amount, the log-line status suffix, and whether this hit is what just
// crossed into Death — the caller (resolveRound) uses that to credit Chunks
// to the right Tile, since this function only knows the target, not its position.
function applyWound(target, rawWoundDmg){
  const ceiling = target.deathWounds ?? DEATH_WOUNDS_DEFAULT;
  const wasDeathWounded = (target.wounds || 0) >= ceiling;
  const dmg = negateByResilience(rawWoundDmg, target);
  target.wounds = Math.min(ceiling, (target.wounds || 0) + dmg);
  const nowDeathWounded = target.wounds >= ceiling;
  const suffix = nowDeathWounded ? ' — Dead!' : isDown(target) ? ' — Down!' : '';
  return { dmg, suffix, justDeathWounded: nowDeathWounded && !wasDeathWounded };
}

// Execution: once a target is already Down, a normal Attack skips the Wounds
// climb and goes straight for Life instead — trivial, guaranteed, no
// Block/Flow check. x still climbs (+1, clamped) so Death is still reachable; Life is what actually drops.
function applyExecution(target){
  const ceiling = target.deathWounds ?? DEATH_WOUNDS_DEFAULT;
  const wasDeathWounded = (target.wounds || 0) >= ceiling;
  target.wounds = Math.min(ceiling, (target.wounds || 0) + 1);
  const nowDeathWounded = target.wounds >= ceiling;
  const life = Math.max(0, (target.life ?? 1) - 1);
  target.life = life;
  let text = 'Already Down — Execution lands: +1 Wound, Life ' + life;
  if(nowDeathWounded) text += ' — Dead!';
  if(life <= 0) text += ' (no longer self-sustaining)';
  return { text, justDeathWounded: nowDeathWounded && !wasDeathWounded };
}

function resolveFocusBypass(actor, target){
  const defenderRemaining = (target.focus || 0) - (target.focusSpent || 0);
  if(defenderRemaining >= 1){
    target.focusSpent = (target.focusSpent || 0) + 1;
    return { text: (target.name || 'target') + ' spends a Focus point — Blocked, no wound', justDeathWounded: false };
  }
  const { dmg, suffix, justDeathWounded } = applyWound(target, powerToDamage(actor.power));
  return { text: 'Bypasses everything — ' + woundLine(dmg, target) + suffix, justDeathWounded };
}

// Overwhelm: when a single hit's damage badly outclasses the target's
// *current* Flow, it can skip the shield entirely and land straight on
// Wounds. Below 1.2x it never triggers. A step function on purpose, not a
// smooth curve — 1.7x and 2x are hard thresholds. Tune the brackets as playtesting demands.
function computeOverwhelmChance(dmg, flow){
  if(flow <= 0) return 0; // already-depleted Flow is the exposure system's job, below
  const ratio = dmg / flow;
  if(ratio >= 2.0) return 100;
  if(ratio >= 1.7) return 99;
  if(ratio >= 1.4) return Math.min(99, 1 + Math.max(0, dmg - flow));
  if(ratio >= 1.2) return 1;
  return 0;
}

// Power reduces Flow 1-to-1. The hit that brings Flow down to (or through) 0
// never touches Hit% no matter how much it overkills by. Hit% only exists
// for hits landing against a target already at 0 Flow *before* that hit: the
// first such hit is a flat 1%, every hit after (landed or not) escalates the
// running Hit% by its own damage amount, capping at 100%.
// hitPercent lives on the target record (not a per-resolve local), so it
// persists round to round — applyRecoveryTick below is the only way it comes
// back down. flowDmg (raw Power) only touches Flow; woundDmg (bracketed
// Power->Damage) is the only thing that touches Wounds or escalates Hit%.
//
// Shadow Possession / "Plot Armor": every Character witnesses a Shield
// Fragment early on, creating a latent, never-felt possession link to
// Kulkrow. When a player's exposure gets really bad, Kulkrow quietly leans
// on that link to cut the odds against them — the displayed hitPercent stays
// the real number, only the actual roll threshold is secretly reduced, so it
// reads as ordinary good luck. Enemies don't get this — party-only Plot
// Armor. Threshold/reduction are rough placeholders, tune freely.
const SHADOW_POSSESSION_THRESHOLD = 70;
const SHADOW_POSSESSION_REDUCTION = 0.5;

function applyDamage(target, flowDmg, woundDmg, isPlayerTarget){
  if(target.flow > 0){
    const overwhelmChance = computeOverwhelmChance(flowDmg, target.flow);
    if(overwhelmChance > 0 && Math.random() * 100 < overwhelmChance){
      const { dmg, suffix, justDeathWounded } = applyWound(target, woundDmg);
      return { text: 'Overwhelms Flow entirely! ' + overwhelmChance.toFixed(0) + '% chance to hit — Lands — ' + woundLine(dmg, target) + suffix, justDeathWounded };
    }
    target.flow = Math.max(0, target.flow - flowDmg);
    return { text: 'Flow drops to ' + target.flow + '/' + target.flowMax, justDeathWounded: false };
  }

  const current = target.hitPercent ?? 1;
  const effectiveChance = (isPlayerTarget && current >= SHADOW_POSSESSION_THRESHOLD)
    ? current * SHADOW_POSSESSION_REDUCTION : current;
  const roll = Math.random() * 100;
  const wounded = roll < effectiveChance;
  let text, justDeathWounded = false;
  if(wounded){
    const r = applyWound(target, woundDmg);
    text = current.toFixed(0) + '% chance to hit — Lands — ' + woundLine(r.dmg, target) + r.suffix;
    justDeathWounded = r.justDeathWounded;
  }else{
    text = current.toFixed(0) + '% chance to hit — Holds — no wound';
  }
  target.hitPercent = Math.min(100, current + woundDmg);
  return { text, justDeathWounded };
}

// How much an actor's end-of-round Recovery tick is worth: 1x by default,
// scaling up to 2x the more of this round's AP was committed to a 'rest'
// entry instead of acting. Reads the sequence, so must run before the
// end-of-round cleanup clears it.
function computeRestMultiplier(actor){
  const restAP = (actor.sequence || []).filter(e => e.kind === 'rest').reduce((s, e) => s + (e.apCost || 0), 0);
  const totalAP = actor.ap || 0;
  if(totalAP <= 0 || restAP <= 0) return 1;
  return 1 + Math.min(1, restAP / totalAP);
}

// Recovery does one of two things, never both: if hitPercent is already back
// at the 1% floor (Flow-broken but composed), it rebuilds Flow. Otherwise the
// target is still actively exposed, and Recovery instead claws hitPercent
// back down (double rate) — Flow stays at 0 until hitPercent bottoms out.
// Exported — the Non-Combat Round reuses these two verbatim, so
// Lightning/Lava/Focus/Flow recharge the same way in or out of Combat.
export function applyRecoveryTick(actor){
  const recovery = (actor.recovery || 0) * computeRestMultiplier(actor);
  const hitPercent = actor.hitPercent ?? 1;
  if(hitPercent <= 1){
    actor.flow = Math.min(actor.flowMax ?? actor.flow, (actor.flow || 0) + recovery);
  }else{
    actor.hitPercent = Math.max(1, hitPercent - recovery * 2);
  }
}

// Attunement refills Lightning, Lava, and Focus at end of round the same way
// Recovery refills Flow — a persistent pool, not a per-round allowance that
// resets to full regardless. Full Attunement value applies to *each* of the
// three (Attunement 3 = +3 Lightning AND +3 Lava AND +3 Focus, not +1 each).
// Not a per-Round drain — Attunement never depletes on its own. The real
// cost is a live debuff sized by how many upkeep relationships (Empower,
// Shadow Possession Links) are CURRENTLY active at once — breadth, not
// duration — applied only where Attunement's own effect is read; the base
// stat itself is never mutated. Both upkeep sources bill against the exact
// same pool — totalUpkeepCount() is the one place that sum lives.
function totalUpkeepCount(actor){
  return (actor.maintainingEmpower || []).length + (actor.shadowLinks || []).length;
}

export function effectiveAttunement(actor){
  return Math.max(0, (actor.attunement || 0) - totalUpkeepCount(actor));
}

export function applyAttunementTick(actor){
  const attunement = effectiveAttunement(actor);
  if(!attunement) return;
  actor.focusSpent = Math.max(0, (actor.focusSpent || 0) - attunement);
  actor.lightningSpent = Math.max(0, (actor.lightningSpent || 0) - attunement);
  actor.lavaSpent = Math.max(0, (actor.lavaSpent || 0) - attunement);
}

// Cleanup pass only — drops a maintained Empower relationship or Shadow
// Possession Link whose Target no longer resolves (dead/removed), so a stale
// entry doesn't keep counting against effectiveAttunement forever.
export function tickEmpowerUpkeep(t, actorId, actor){
  if(actor.maintainingEmpower && actor.maintainingEmpower.length){
    actor.maintainingEmpower = actor.maintainingEmpower.filter(targetId => !!resolveEntityRef(t, targetId));
  }
  if(actor.shadowLinks && actor.shadowLinks.length){
    actor.shadowLinks = actor.shadowLinks.filter(targetId => !!resolveEntityRef(t, targetId));
  }
}

// Whether actor can take on one more simultaneous upkeep relationship —
// Empower and Shadow Possession Links share this check. Capped at the
// actor's own base Attunement, checked once at the moment a NEW relationship
// would start — existing relationships are never force-cancelled by this.
export function canMaintainAnotherEmpower(actor){
  return totalUpkeepCount(actor) < (actor.attunement || 0);
}

// Spawns a real Enemy Character from a BUILDS template at a specific Tile —
// same field set as dm.js's addEnemy(), just placed at (x,y). Used by
// Separation/Infuse to turn a Molten Lava Tile into Inert Stone / a Molten
// One, matching the "Objects are just Characters with almost no Stats" precedent.
export function spawnBuildAt(t, buildKey, x, y){
  const b = BUILDS[buildKey];
  if(!b) return null;
  if(!t.enemies) t.enemies = {};
  if(!t.positions) t.positions = {};
  const id = 'e_' + Math.random().toString(36).slice(2, 8);
  const count = Object.values(t.enemies).filter(e => e.archetype === b.archetype).length + 1;
  t.enemies[id] = spawnCharacter(b, { name: b.archetype + ' #' + count, num: count });
  t.positions[id] = { x, y };
  return t.enemies[id];
}

// Commits some or all of this round's remaining AP to resting instead of
// acting. Only matters as an end-of-round multiplier (see
// computeRestMultiplier) — resting doesn't do anything on its own mid-round.
export async function stageRest(){
  const me = AppState.table.players[AppState.playerId];
  if(!me) return;
  const spent = me.apSpent || 0;
  const remaining = Math.max(0, (me.ap || 0) - spent);
  const input = document.getElementById('rest-ap-input');
  const amount = Math.max(0, Math.min(remaining, parseInt(input && input.value, 10) || 0));
  if(amount <= 0){ showBannerError('Enter how much AP to spend resting first.'); return; }

  await mutateTable(t => {
    const actor = t.players[AppState.playerId];
    if(!actor.sequence) actor.sequence = [];
    actor.sequence.push({ apCost: amount, focusCost: 0, actionLabel: 'Rest', targetLabel: '', kind: 'rest' });
    actor.apSpent = spent + amount;
    t.log.push({ type: 'system', text: actor.name + ' commits ' + amount + ' AP to resting', time: timeNow() });
  });
}

// Finds an unconsumed Block belonging to (ownerType, ownerId) that would
// intercept an attack from attackerId landing at attackResolveTick. General
// Block is checked first (timing-window match, sized by the owner's
// Resilience), then Target Block (identity match, no timing constraint).
function findAndConsumeBlock(registry, ownerType, ownerId, attackerId, attackResolveTick){
  const general = registry.find(b =>
    !b.consumed && b.ownerType === ownerType && b.ownerId === ownerId && b.kind === 'general' &&
    Math.abs(attackResolveTick - b.resolveTick) <= (b.owner.resilience || 0)
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

  function gatherFrom(entries, actorType){
    entries.forEach(([id, actor]) => {
      const entryTick = computeEntryTick(actor.quickness, counterMax);
      let runningCost = 0;
      (actor.sequence || []).forEach(entry => {
        runningCost += entry.apCost;
        allEntries.push({ actorType, actorId: id, actor, entry, resolveTick: Math.max(0, entryTick - runningCost) });
      });
    });
  }
  gatherFrom(Object.entries(table.players || {}), 'player');
  gatherFrom(Object.entries(table.enemies || {}), 'enemy');
  // Statted Mini-Party members can stage and act on their own too — same
  // machinery as a real Player, keyed by composite 'mp:<playerId>:<index>'
  // ids. Possessed members are already real table.enemies entries, gathered above.
  const miniPartyActors = [];
  Object.entries(table.players || {}).forEach(([pid, p]) => {
    (p.miniParty || []).forEach((mp, idx) => {
      if(mp.sourceEnemyId || mp.woundsMax == null) return;
      miniPartyActors.push(['mp:' + pid + ':' + idx, mp]);
    });
  });
  gatherFrom(miniPartyActors, 'player');

  if(!allEntries.length){ showBannerError('Nothing staged to resolve.'); return; }
  freezeSequencerReveal(table, counterMax);
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

  await mutateTable(t => {
    // Possess: a Possessed Enemy joins the Mini-Party "until the next
    // Sequence ends" — one-shot: it survives the rest of this resolve, then
    // gets swept out right here at the start of the next one.
    Object.values(t.players || {}).forEach(p => {
      if(p.miniParty) p.miniParty = p.miniParty.filter(m => !m.possessedExpiring);
    });

    t.log.push({ type: 'system', text: '— resolving the round —', time: timeNow() });

    // Collected during the actionEntries pass below, resolved right after it
    // finishes, so a Glyph picked from a pending Message reliably finds the
    // entry that Message just created.
    const pendingInfluences = [];

    blockRegistry.forEach(b => {
      const label = b.kind === 'general' ? 'General Block' : 'Target Block';
      t.log.push({ type: 'system', text: (b.owner.name || 'Someone') + ' sets a ' + label + (b.counter ? ' with Counter' : ''), time: timeNow() });
    });

    // Fires once, right when a hit actually crosses a target's Death Wounds
    // threshold — see applyWound/applyExecution's justDeathWounded flag.
    // Those functions only see the target, not its Tile, so credit happens here.
    const creditChunksFor = (targetId) => {
      const pos = t.positions && t.positions[targetId];
      if(pos) addChunksAt(t, pos.x, pos.y, 3);
    };

    actionEntries.forEach(item => {
      const actor = item.actor, entry = item.entry, actorName = actor.name || 'Someone';
      const action = describeAction(entry);
      const logCombat = (defenderName, result) => t.log.push({
        type: 'combat', time: timeNow(), tick: item.resolveTick,
        attacker: actorName, defender: defenderName, action, result
      });

      // Technique effects are text-only for now, not mechanically resolved —
      // logged so it's obvious what *should* happen. Separation is the one
      // exception: simple/deterministic enough to actually implement.
      if(entry.kind === 'technique'){
        const def = TECHNIQUES[entry.techniqueKey];
        const target = resolveEntityRef(t, entry.targetId);
        const targetName = (target && target.name) || entry.targetName || '(target)';
        // Message: doesn't arrive as Information until Resolve — delivers
        // every staged Glyph, in order, as that many separate Mindeye entries.
        if(entry.techniqueKey === 'message'){
          (entry.glyphs || []).forEach(g => deliverMindeyeEntry(t, entry.targetId, actorName, g));
          logCombat(targetName, (entry.glyphs || []).length + ' Glyph' + ((entry.glyphs || []).length === 1 ? '' : 's') + ' delivered.');
          return;
        }
        // Channel — the Crafter recovers 1 Lightning Point.
        if(entry.techniqueKey === 'channel'){
          actor.lightningSpent = Math.max(0, (actor.lightningSpent || 0) - 1);
          logCombat(actorName, 'Recovers 1 Lightning Point.');
          return;
        }
        // Empower: +1 Control/+1 AP, once per Crafter-Target relationship (a
        // repeat Empower on an already-active Target is a no-op, not a
        // stack). Tracks who's maintaining it on both ends —
        // target.empoweredBy (read by map.js for the Ally-color Triangle)
        // and actor.maintainingEmpower (read by the Attunement drain below).
        // Ends automatically once the Crafter's Attunement can't sustain it.
        if(entry.techniqueKey === 'empower'){
          if(!target) return;
          if(!target.empoweredBy) target.empoweredBy = [];
          if(!actor.maintainingEmpower) actor.maintainingEmpower = [];
          if(!target.empoweredBy.includes(item.actorId)){
            if(!canMaintainAnotherEmpower(actor)){
              logCombat(targetName, 'Not enough Attunement to Empower another target — already maintaining ' + actor.maintainingEmpower.length + '.');
            }else{
              target.empoweredBy.push(item.actorId);
              actor.maintainingEmpower.push(entry.targetId);
              target.control = (target.control || 0) + 1;
              target.ap = (target.ap || 0) + 1;
              logCombat(targetName, 'Empowered — +1 Control, +1 AP.');
            }
          }
          return;
        }
        // Current — Gom's LiC, toggles the Shadow Possession Link. An
        // unlinked Target (Inert Stone, Life 0) ignites — Life 0->1,
        // Lightning 0->1, Link forms in the same action. A Target already
        // linked to this actor extinguishes instead — Life/Lightning drop
        // back to 0, Link removed. Costs one shared upkeep slot with Empower.
        if(entry.techniqueKey === 'current'){
          if(!target) return;
          if(!actor.shadowLinks) actor.shadowLinks = [];
          if(!target.shadowLinkedBy) target.shadowLinkedBy = [];
          const alreadyLinked = target.shadowLinkedBy.includes(item.actorId);
          if(alreadyLinked){
            target.shadowLinkedBy = target.shadowLinkedBy.filter(id => id !== item.actorId);
            actor.shadowLinks = actor.shadowLinks.filter(id => id !== entry.targetId);
            target.life = 0;
            target.lightning = 0;
            logCombat(targetName, 'Current withdrawn — Life and Lightning drop to 0. Shadow Possession Link ended.');
          }else{
            if(!canMaintainAnotherEmpower(actor)){
              logCombat(targetName, 'Not enough Attunement to hold another Link — already maintaining ' + totalUpkeepCount(actor) + '.');
            }else{
              target.shadowLinkedBy.push(item.actorId);
              actor.shadowLinks.push(entry.targetId);
              target.life = 1;
              target.lightning = 1;
              logCombat(targetName, 'Given a Current — Life and Lightning rise to 1. Shadow Possession Link established.');
            }
          }
          return;
        }
        if(entry.techniqueKey === 'influence'){
          pendingInfluences.push({ targetId: entry.targetId, glyph: entry.influenceGlyph, axis: entry.influenceAxis, direction: entry.influenceDirection });
          logCombat(targetName, 'Influence staged — resolves after this Round’s Messages land.');
          return;
        }
        // Separation, First Era behavior: only works on a Molten Lava Tile,
        // converts it to Inert Stone. The any-Tile-to-Obstacle version is
        // Third Era, not built.
        if(entry.techniqueKey === 'separation'){
          const pos = t.positions && t.positions[item.actorId];
          const idx = pos && t.map && pos.x + 1 < t.map.width ? pos.y * t.map.width + (pos.x + 1) : null;
          if(idx === null){
            logCombat(targetName, 'No room to the right — no Tile changed.');
          }else if(!t.map.lava || t.map.lava[idx] !== 2){
            logCombat(targetName, 'Nothing to Separate — that Tile isn’t Molten Lava.');
          }else{
            t.map.lava[idx] = 0;
            const nx = pos.x + 1, ny = pos.y;
            t.map.tiles[idx] = 1;
            const spawned = spawnBuildAt(t, 'inert-stone', nx, ny);
            logCombat(targetName, spawned ? 'Molten Lava cools into ' + spawned.name + '.' : 'Separation fails — no Inert Stone template found.');
          }
          return;
        }
        // Infuse — Kulkrow's version of active possession: converts a Molten
        // Lava Tile into a Molten One. Molten Ones have no real stat block
        // yet, so this stages/costs/logs correctly but doesn't create anything.
        if(entry.techniqueKey === 'infuse'){
          const pos = t.positions && t.positions[item.actorId];
          const idx = pos && t.map && pos.x + 1 < t.map.width ? pos.y * t.map.width + (pos.x + 1) : null;
          if(idx === null){
            logCombat(targetName, 'No room to the right — no Tile changed.');
          }else if(!t.map.lava || t.map.lava[idx] !== 2){
            logCombat(targetName, 'Nothing to Infuse — that Tile isn’t Molten Lava.');
          }else{
            logCombat(targetName, 'Molten Lava is ready to Infuse — Molten Ones aren’t mechanically resolved yet (no Stat block exists for them).');
          }
          return;
        }
        // Possess: converts the target Enemy into a real Mini-Party member —
        // stays exactly where it is on the Map and stays targetable, just
        // also shows up in the possessor's Mini-Party. Players only. Reverts
        // automatically at the top of the next resolveRound via the sweep above.
        if(entry.techniqueKey === 'possess'){
          if(item.actorType !== 'player' || !target){
            logCombat(targetName, 'No valid target — Possession fails.');
            return;
          }
          if(!actor.miniParty) actor.miniParty = [];
          if(actor.miniParty.length >= MAX_MINI_PARTY){
            logCombat(targetName, actorName + '’s Mini-Party is already full — Possession fails.');
            return;
          }
          // A target already possessed by someone else this Sequence gets transferred, not duplicated.
          Object.values(t.players || {}).forEach(p => {
            if(p.miniParty) p.miniParty = p.miniParty.filter(m => m.sourceEnemyId !== entry.targetId);
          });
          actor.miniParty.push({ name: target.name, sourceEnemyId: entry.targetId, possessed: true, possessedExpiring: true });
          logCombat(targetName, target.name + ' joins ' + actorName + '’s Mini-Party until the Sequence ends.');
          return;
        }
        logCombat(targetName, (def ? def.effect : 'Effect not yet implemented') + ' (not yet mechanically resolved)');
        return;
      }

      if(entry.kind === 'attack' && entry.attackKind === 'focus'){
        const target = resolveEntityRef(t, entry.targetId);
        if(!target || isDeathWounded(target)){
          logCombat((target && target.name) || '(no target)', 'No target — already Dead');
          return;
        }
        if(isDown(target)){
          const r = applyExecution(target);
          logCombat(target.name || 'target', r.text);
          if(r.justDeathWounded) creditChunksFor(entry.targetId);
          return;
        }
        const bypassResult = resolveFocusBypass(actor, target);
        logCombat(target.name || 'target', bypassResult.text);
        if(bypassResult.justDeathWounded) creditChunksFor(entry.targetId);
        return;
      }

      if(entry.kind === 'attack' || entry.kind === 'essence'){
        const target = resolveEntityRef(t, entry.targetId);
        if(!target || isDeathWounded(target)){
          logCombat((target && target.name) || '(no target)', 'No target — already Dead');
          return;
        }
        if(entry.kind === 'attack' && isDown(target)){
          const r = applyExecution(target);
          logCombat(target.name || 'target', r.text);
          if(r.justDeathWounded) creditChunksFor(entry.targetId);
          return;
        }

        const targetOwnerType = ownerTypeOf(t, entry.targetId);
        const blocked = findAndConsumeBlock(blockRegistry, targetOwnerType, entry.targetId, item.actorId, item.resolveTick);
        if(blocked){
          const blockLabel = blocked.kind === 'general' ? 'General Block' : 'Target Block';
          let result = 'Stopped by ' + (target.name || 'target') + '’s ' + blockLabel;
          if(blocked.counter){
            const counterDmg = blocked.owner.power || 1;
            actor.flow = Math.max(0, (actor.flow || 0) - counterDmg);
            result += ' — Countered, ' + actorName + '’s Flow drops to ' + actor.flow + '/' + (actor.flowMax || 0);
          }
          logCombat(target.name || 'target', result);
          return;
        }

        const isAttack = entry.kind === 'attack';
        const flowDmg = isAttack
          ? (actor.power || 1) + (entry.attackKind === 'strong' ? 1 : 0)
          : (actor.focus || 1);
        const woundDmg = isAttack
          ? powerToDamage(actor.power) + (entry.attackKind === 'strong' ? 1 : 0)
          : (actor.focus || 1);
        const dmgResult = applyDamage(target, flowDmg, woundDmg, targetOwnerType === 'player');
        logCombat(target.name || 'target', dmgResult.text);
        if(dmgResult.justDeathWounded) creditChunksFor(entry.targetId);
      }
    });

    // Resolved last — see the matching noncombat.js pass for the full
    // reasoning (axis-value semantics, "most recent matching entry," silent
    // no-op if the Glyph never arrived). Same logic, Combat side.
    pendingInfluences.forEach(order => {
      const target = resolveEntityRef(t, order.targetId);
      if(!target || !target.mindeye) return;
      for(let i = target.mindeye.length - 1; i >= 0; i--){
        if(target.mindeye[i].glyph === order.glyph){
          const cur = target.mindeye[i][order.axis] ?? 1;
          const delta = order.direction === '+1' ? -1 : 1;
          target.mindeye[i][order.axis] = Math.max(0, Math.min(2, cur + delta));
          break;
        }
      }
    });

    // Statted Mini-Party members go through the exact same end-of-round
    // upkeep as a real Player/Enemy — collected once here for both the
    // Recovery/Attunement tick and the sequence/apSpent reset below.
    const miniPartyStubs = [];
    Object.values(t.players || {}).forEach(p => {
      (p.miniParty || []).forEach(mp => { if(!mp.sourceEnemyId && mp.woundsMax != null) miniPartyStubs.push(mp); });
    });

    // Rest multiplier reads each actor's sequence, so this has to run before
    // it's cleared. "Alive" means not-yet-Dead, not wounds>0 — a merely-Down
    // character still recovers same as anyone else.
    Object.entries(t.players || {}).forEach(([id, p]) => { if(!isDeathWounded(p)){ applyRecoveryTick(p); applyAttunementTick(p); tickEmpowerUpkeep(t, id, p); } });
    Object.entries(t.enemies || {}).forEach(([id, e]) => { if(!isDeathWounded(e)){ applyRecoveryTick(e); applyAttunementTick(e); tickEmpowerUpkeep(t, id, e); } });
    miniPartyStubs.forEach(mp => { if(!isDeathWounded(mp)){ applyRecoveryTick(mp); applyAttunementTick(mp); } });

    // Kulkrow's Spill — passive, always-on, runs for any living actor
    // flagged passiveSpill regardless of AP/Attunement. Tile-State advances
    // one stage right after, same place the other end-of-round ticks live.
    Object.entries(t.players || {}).forEach(([id, p]) => { if(p.passiveSpill && !isDeathWounded(p) && t.positions && t.positions[id]) applySpillAt(t, t.positions[id].x, t.positions[id].y); });
    Object.entries(t.enemies || {}).forEach(([id, e]) => { if(e.passiveSpill && !isDeathWounded(e) && t.positions && t.positions[id]) applySpillAt(t, t.positions[id].x, t.positions[id].y); });
    tickLavaTiles(t);

    // AP is still a flat per-round allowance — sequence/apSpent always
    // clear. Focus/Lightning/Lava are NOT reset here — like Flow, they only
    // come back via the Attunement tick above, not for free.
    Object.values(t.players || {}).forEach(p => { p.sequence = []; p.apSpent = 0; });
    Object.values(t.enemies || {}).forEach(e => { e.sequence = []; e.apSpent = 0; });
    miniPartyStubs.forEach(mp => { mp.sequence = []; mp.apSpent = 0; });
  });

  AppState.pendingType = null; AppState.pendingAttackKind = null; AppState.pendingEssenceSchool = null;
  AppState.pendingBlockKind = null; AppState.pendingCounter = false;
  AppState.dmPendingType = null; AppState.dmPendingAttackKind = null; AppState.dmPendingCraftKey = null;
  AppState.dmPendingBlockKind = null; AppState.dmPendingCounter = false;
}

export function renderCombatCounters(){
  const me = AppState.table && AppState.table.players[AppState.playerId];
  const wEl = document.getElementById('cb-wounds-display');
  const aEl = document.getElementById('cb-ap-display');
  const fEl = document.getElementById('cb-flow-display');
  const fcEl = document.getElementById('cb-focus-display');
  const ctrlEl = document.getElementById('cb-control-display');
  const hpEl = document.getElementById('cb-hitpercent-display');
  if(!me || !wEl || !aEl) return;
  wEl.textContent = (me.wounds ?? 0) + '/' + (me.woundsMax ?? 0);
  aEl.textContent = (me.apSpent || 0) + '/' + (me.ap ?? 0);
  if(fEl) fEl.textContent = (me.flow ?? 0) + '/' + (me.flowMax ?? 0);
  if(fcEl) fcEl.textContent = ((me.focus || 0) - (me.focusSpent || 0)) + '/' + (me.focus ?? 0);
  if(hpEl) hpEl.textContent = (me.flow > 0) ? '—' : (me.hitPercent ?? 1).toFixed(0) + '%';
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
