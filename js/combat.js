import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml, timeNow, targetShorthand, computeEntryTick, computeCounterMax, apCostForControl, describeAction, powerToDamage, DEATH_WOUNDS_DEFAULT, isDown, isDeathWounded, resolveEntityRef, ownerTypeOf, possessedEnemyIds } from './utils.js';
import { removeEnemy } from './dm.js';
import { TECHNIQUES } from './techniques.js';
import { MAX_MINI_PARTY } from './possession.js';
import { addChunksAt } from './map.js';
import { freezeSequencerReveal } from './sequencer.js';

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
  const possessed = possessedEnemyIds(AppState.table);
  const list = Object.entries(enemies).filter(([id]) => !possessed.has(id));
  if(!list.length){ el.innerHTML = '<div class="log-empty">No enemies in the encounter.</div>'; return; }

  el.innerHTML = list.map(([id, e]) => {
    const defeated = isDeathWounded(e);
    let cls = 'target-chip';
    if(id === AppState.selectedTargetId && AppState.selectedTargetSide === 'enemy') cls += ' selected';
    if(defeated) cls += ' defeated';
    const removeX = defeated ? '<span class="chip-remove-x" data-id="' + id + '">✕</span>' : '';
    return '<div class="' + cls + '" data-id="' + id + '">' +
      escapeHtml(e.name) + ' &mdash; ' + Math.max(0, e.wounds) + '/' + e.woundsMax + removeX + '</div>';
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

// Ally Targeting (2026-08-16): the Player, every other Player at the table,
// and their statted Mini-Party members are all valid targets, same as
// Enemies — for Techniques like Embolden/Anchor eventually, but per dDd
// "the same way Enemy Characters can be targeted" applies generally, so
// Attack/Block/Essence can target an ally too (anybody-can-target-anybody,
// same testing-scope precedent as Techniques). Un-statted Mini-Party stubs
// (added with no base build) have no wounds to track and are skipped — they
// aren't a legitimate combat target yet.
export function renderAllyRange(){
  const el = document.getElementById('ally-range');
  if(!el) return;
  const table = AppState.table;
  if(!table){ el.innerHTML = ''; return; }

  const rows = [];
  Object.entries(table.players || {}).forEach(([pid, p]) => {
    rows.push({ id: pid, name: p.name || 'Unnamed', dead: isDeathWounded(p), sub: pid === AppState.playerId ? '(You)' : '' });
    (p.miniParty || []).forEach((mp, idx) => {
      if(mp.sourceEnemyId){
        const src = table.enemies && table.enemies[mp.sourceEnemyId];
        if(src) rows.push({ id: mp.sourceEnemyId, name: src.name, dead: isDeathWounded(src), sub: '(' + (p.name || '?') + '’s Mini-Party)' });
      }else if(mp.woundsMax != null){
        rows.push({ id: 'mp:' + pid + ':' + idx, name: mp.name || 'Follower', dead: isDeathWounded(mp), sub: '(' + (p.name || '?') + '’s Mini-Party)' });
      }
    });
  });

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
// plain Attack/Block (apCost/focusCost only) or a Technique (which can also
// carry flowCost/lightningCost/lavaCost); restoring all five uniformly means
// neither function needs to know which kind of entry it's reversing.
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

// Companion to undoAction above — Undo only ever pops the most recent staged
// entry; this lets the staged-actions list remove any one of them directly,
// by splicing it out instead of popping from the end.
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

// "N Wounds (XX% Dmg)" \u2014 the percentage is against the target's personal
// Down threshold, so a hit's real weight reads at a glance instead of needing
// the threshold looked up.
function woundLine(woundDmg, target){
  const pct = target.woundsMax ? Math.round((woundDmg / target.woundsMax) * 100) : 0;
  return woundDmg + (woundDmg === 1 ? ' Wound' : ' Wounds') + ' (' + pct + '% Dmg)';
}

// Resilience (2026-08-16, one of its three jobs per roadmap Stats item G):
// negates a flat slice of incoming Wound damage per hit. This is also what
// governs "how far x can climb past a character's personal y" (item G's
// third job / item A's buffer) \u2014 there's no separate number for that, it's
// just the emergent effect of every hit landing lighter. Divisor is a rough
// placeholder like Shadow Possession's thresholds \u2014 tune freely.
const RESILIENCE_DAMAGE_DIVISOR = 5;
function negateByResilience(woundDmg, target){
  return Math.max(0, woundDmg - Math.floor((target.resilience || 0) / RESILIENCE_DAMAGE_DIVISOR));
}

// Applies a Wound hit: Resilience shaves it first, then x climbs (clamped at
// the target's own Death Wounds threshold \u2014 species-fixed, see character.js's
// SPECIES/DEATH_WOUNDS_DEFAULT \u2014 never past it). Returns the actually-applied
// amount (post-Resilience), the status suffix for the log line, and whether
// this specific hit is what just crossed into Death \u2014 the caller
// (resolveRound) uses that last flag to credit Chunks to the right Tile,
// since this function only knows the target, not its position. (Chunks are
// credited on Death as the current best proxy \u2014 true Obliteration is a
// separate, not-yet-built check on every Body Part being false; see
// reference/style-guide.md and ROADMAP.md's Chunk Mechanic notes.)
function applyWound(target, rawWoundDmg){
  const ceiling = target.deathWounds ?? DEATH_WOUNDS_DEFAULT;
  const wasDeathWounded = (target.wounds || 0) >= ceiling;
  const dmg = negateByResilience(rawWoundDmg, target);
  target.wounds = Math.min(ceiling, (target.wounds || 0) + dmg);
  const nowDeathWounded = target.wounds >= ceiling;
  const suffix = nowDeathWounded ? ' \u2014 Dead!' : isDown(target) ? ' \u2014 Down!' : '';
  return { dmg, suffix, justDeathWounded: nowDeathWounded && !wasDeathWounded };
}

// Execution (2026-08-16, Stats item A): once a target is already Down, a
// normal Attack stops grinding through the Wounds climb and goes straight for
// Life instead \u2014 trivial, guaranteed, no Block/Flow check, since a downed
// target is defenseless. x still climbs (+1, clamped at the target's own
// Death Wounds threshold) so Death is still reachable; Life is what actually drops.
function applyExecution(target){
  const ceiling = target.deathWounds ?? DEATH_WOUNDS_DEFAULT;
  const wasDeathWounded = (target.wounds || 0) >= ceiling;
  target.wounds = Math.min(ceiling, (target.wounds || 0) + 1);
  const nowDeathWounded = target.wounds >= ceiling;
  const life = Math.max(0, (target.life ?? 1) - 1);
  target.life = life;
  let text = 'Already Down \u2014 Execution lands: +1 Wound, Life ' + life;
  if(nowDeathWounded) text += ' \u2014 Dead!';
  if(life <= 0) text += ' (no longer self-sustaining)';
  return { text, justDeathWounded: nowDeathWounded && !wasDeathWounded };
}

function resolveFocusBypass(actor, target){
  const defenderRemaining = (target.focus || 0) - (target.focusSpent || 0);
  if(defenderRemaining >= 1){
    target.focusSpent = (target.focusSpent || 0) + 1;
    return { text: (target.name || 'target') + ' spends a Focus point \u2014 Blocked, no wound', justDeathWounded: false };
  }
  const { dmg, suffix, justDeathWounded } = applyWound(target, powerToDamage(actor.power));
  return { text: 'Bypasses everything \u2014 ' + woundLine(dmg, target) + suffix, justDeathWounded };
}

// Overwhelm: when a single hit's damage badly outclasses the target's *current*
// Flow, it can skip the shield entirely and land straight on Wounds. Below 1.2x
// it never triggers — Flow absorbs the hit as normal. This is a step function
// on purpose (per design discussion, not a smooth curve) — 1.7x and 2x are
// hard thresholds. Tune the brackets here as playtesting demands.
function computeOverwhelmChance(dmg, flow){
  if(flow <= 0) return 0; // already-depleted Flow is the exposure system's job, below
  const ratio = dmg / flow;
  if(ratio >= 2.0) return 100;
  if(ratio >= 1.7) return 99;
  if(ratio >= 1.4) return Math.min(99, 1 + Math.max(0, dmg - flow));
  if(ratio >= 1.2) return 1;
  return 0;
}

// Power reduces Flow 1-to-1. The hit that brings Flow down to (or through) 0 never
// touches Hit% no matter how much it overkills by — overflow simply doesn't carry
// anywhere. Hit% only exists for hits landing against a target already at 0 Flow
// *before* that specific hit: the first such hit is a flat 1%, and every hit after
// that (landed or not) escalates the running Hit% by its own damage amount, capping
// out at 100% once the running total crosses 99.
// hitPercent lives on the target record itself (not a per-resolve local), so it
// persists round to round now \u2014 applyRecoveryTick below is the only way it comes
// back down. flowDmg (raw Power, uncapped) only ever touches Flow; woundDmg (the
// bracketed Power\u2192Damage value) is the only thing that ever touches Wounds or
// escalates Hit% \u2014 keeping a 0-50 stat from one-shotting a 3-8 Wounds pool.
//
// Shadow Possession / "Plot Armor" (2026-08-15): every Character has to witness
// a Shield Fragment early on, which per dDd creates a latent, never-felt
// possession link to Kulkrow. When a player's exposure gets really bad, Kulkrow
// quietly leans on that link to cut the odds against them \u2014 the displayed
// hitPercent in the log is untouched (still the real number), only the actual
// roll threshold is secretly reduced, so it reads as ordinary good luck, never
// as a revealed mechanic. Enemies don't get this \u2014 it's the party's Plot
// Armor, not a general rule. Threshold/reduction are rough placeholders ("50%
// or whatever" \u2014 dDd's own words); tune freely once there's real playtesting.
const SHADOW_POSSESSION_THRESHOLD = 70;
const SHADOW_POSSESSION_REDUCTION = 0.5;

function applyDamage(target, flowDmg, woundDmg, isPlayerTarget){
  if(target.flow > 0){
    const overwhelmChance = computeOverwhelmChance(flowDmg, target.flow);
    if(overwhelmChance > 0 && Math.random() * 100 < overwhelmChance){
      const { dmg, suffix, justDeathWounded } = applyWound(target, woundDmg);
      return { text: 'Overwhelms Flow entirely! ' + overwhelmChance.toFixed(0) + '% chance to hit \u2014 Lands \u2014 ' + woundLine(dmg, target) + suffix, justDeathWounded };
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
    text = current.toFixed(0) + '% chance to hit \u2014 Lands \u2014 ' + woundLine(r.dmg, target) + r.suffix;
    justDeathWounded = r.justDeathWounded;
  }else{
    text = current.toFixed(0) + '% chance to hit \u2014 Holds \u2014 no wound';
  }
  target.hitPercent = Math.min(100, current + woundDmg);
  return { text, justDeathWounded };
}

// How much an actor's end-of-round Recovery tick is worth this round: 1x by
// default, scaling up to 2x the more of this round's AP they committed to a
// 'rest' entry instead of acting (see stageRest). Reads the sequence, so must
// run before the end-of-round cleanup clears it.
function computeRestMultiplier(actor){
  const restAP = (actor.sequence || []).filter(e => e.kind === 'rest').reduce((s, e) => s + (e.apCost || 0), 0);
  const totalAP = actor.ap || 0;
  if(totalAP <= 0 || restAP <= 0) return 1;
  return 1 + Math.min(1, restAP / totalAP);
}

// Recovery does one of two things at end of round, never both: if hitPercent is
// already back at the 1% floor (Flow-broken but composed), it rebuilds Flow like
// before. Otherwise the target is still actively exposed, and Recovery instead
// claws hitPercent back down (at double rate) \u2014 Flow itself stays at 0 and
// can't start rebuilding until hitPercent finishes bottoming out.
function applyRecoveryTick(actor){
  const recovery = (actor.recovery || 0) * computeRestMultiplier(actor);
  const hitPercent = actor.hitPercent ?? 1;
  if(hitPercent <= 1){
    actor.flow = Math.min(actor.flowMax ?? actor.flow, (actor.flow || 0) + recovery);
  }else{
    actor.hitPercent = Math.max(1, hitPercent - recovery * 2);
  }
}

// Attunement (2026-08-16, dDd): refills Lightning, Lava, and Focus at end of
// round the same way Recovery refills Flow — not a per-round allowance that
// resets to full regardless, but a persistent pool only Attunement brings
// back. Full Attunement value applies to *each* of the three, not split
// between them (Attunement 3 means +3 Lightning AND +3 Lava AND +3 Focus,
// not +1 each). Most current Builds sit at Attunement 0, so this is a real
// behavior change — Focus in particular no longer freely resets every round.
function applyAttunementTick(actor){
  const attunement = actor.attunement || 0;
  if(!attunement) return;
  actor.focusSpent = Math.max(0, (actor.focusSpent || 0) - attunement);
  actor.lightningSpent = Math.max(0, (actor.lightningSpent || 0) - attunement);
  actor.lavaSpent = Math.max(0, (actor.lavaSpent || 0) - attunement);
}

// Commits some or all of this round's remaining AP to resting instead of acting.
// The AP spent here only matters as an end-of-round multiplier (see
// computeRestMultiplier) \u2014 resting doesn't do anything on its own mid-round.
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

// Finds an unconsumed Block belonging to (ownerType, ownerId) that would intercept
// an attack from attackerId landing at attackResolveTick. General Block is checked
// first (timing-window match, sized by the owner's Resilience), then Target Block
// (identity match against the specific attacker, no timing constraint).
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
  // Statted Mini-Party members (added with a base build) can stage and act
  // on their own now too — same machinery as a real Player, keyed by their
  // composite 'mp:<playerId>:<index>' id (see utils.js's resolveEntityRef).
  // Possessed Mini-Party members are already real table.enemies entries,
  // gathered normally above — not duplicated here.
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
    // Possess (2026-08-16): a Possessed Enemy joins the Mini-Party "until the
    // next Sequence ends" \u2014 implemented as one-shot: it survives the rest of
    // *this* resolve (the possess action itself may still be about to run
    // below), then gets swept out right here at the start of the *next* one.
    Object.values(t.players || {}).forEach(p => {
      if(p.miniParty) p.miniParty = p.miniParty.filter(m => !m.possessedExpiring);
    });

    t.log.push({ type: 'system', text: '\u2014 resolving the round \u2014', time: timeNow() });

    blockRegistry.forEach(b => {
      const label = b.kind === 'general' ? 'General Block' : 'Target Block';
      t.log.push({ type: 'system', text: (b.owner.name || 'Someone') + ' sets a ' + label + (b.counter ? ' with Counter' : ''), time: timeNow() });
    });

    // Chunks (2026-08-16): fires once, right when a hit is what actually
    // crosses a target's Death Wounds threshold — see applyWound/
    // applyExecution's justDeathWounded flag. Those functions only ever see
    // the target object, not its Tile, so the credit happens here where
    // positions are in scope.
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

      // Techniques (2026-08-16): effects are text-only for now, not
      // mechanically resolved — logged so it's obvious what *should* happen,
      // per dDd's "hold off on testing them, just verify they commit and
      // it's obvious how they work." Separation is the one exception: its
      // Map Obstacle is simple/deterministic enough to actually implement.
      if(entry.kind === 'technique'){
        const def = TECHNIQUES[entry.techniqueKey];
        const target = resolveEntityRef(t, entry.targetId);
        const targetName = (target && target.name) || entry.targetName || '(target)';
        if(entry.techniqueKey === 'separation'){
          const pos = t.positions && t.positions[item.actorId];
          let result = def ? def.effect : 'Effect not yet implemented';
          if(pos && t.map && pos.x + 1 < t.map.width){
            t.map.tiles[pos.y * t.map.width + (pos.x + 1)] = 0;
          }else{
            result += ' (no room to the right — no Tile changed)';
          }
          logCombat(targetName, result);
          return;
        }
        // Possess (2026-08-16): converts the target Enemy into a real Mini-
        // Party member of the possessing Player — the Enemy stays exactly
        // where it is on the Map and stays targetable (a fresh Possess later
        // in the same Sequence just transfers it, see the dedup below), it
        // just also now shows up in the possessor's Mini-Party. Only Players
        // can possess for now. Reverts automatically at the top of the *next*
        // resolveRound via the sweep above.
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
          // A target already possessed by someone else this Sequence gets
          // transferred, not duplicated.
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
          logCombat((target && target.name) || '(no target)', 'No target \u2014 already Dead');
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
          logCombat((target && target.name) || '(no target)', 'No target \u2014 already Dead');
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
          let result = 'Stopped by ' + (target.name || 'target') + '\u2019s ' + blockLabel;
          if(blocked.counter){
            const counterDmg = blocked.owner.power || 1;
            actor.flow = Math.max(0, (actor.flow || 0) - counterDmg);
            result += ' \u2014 Countered, ' + actorName + '\u2019s Flow drops to ' + actor.flow + '/' + (actor.flowMax || 0);
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

    // Statted Mini-Party members go through the exact same end-of-round
    // upkeep as a real Player/Enemy — collected once here since it's needed
    // for both the Recovery/Attunement tick and the sequence/apSpent reset
    // below. Possessed members are real table.enemies entries, handled by
    // the plain enemy loops already.
    const miniPartyStubs = [];
    Object.values(t.players || {}).forEach(p => {
      (p.miniParty || []).forEach(mp => { if(!mp.sourceEnemyId && mp.woundsMax != null) miniPartyStubs.push(mp); });
    });

    // Rest multiplier reads each actor's sequence, so this has to run before it's cleared.
    // "Alive" now means not-yet-Dead, not wounds>0 — a merely-Down
    // character (still x<10) keeps recovering same as anyone else.
    Object.values(t.players || {}).forEach(p => { if(!isDeathWounded(p)){ applyRecoveryTick(p); applyAttunementTick(p); } });
    Object.values(t.enemies || {}).forEach(e => { if(!isDeathWounded(e)){ applyRecoveryTick(e); applyAttunementTick(e); } });
    miniPartyStubs.forEach(mp => { if(!isDeathWounded(mp)){ applyRecoveryTick(mp); applyAttunementTick(mp); } });

    // AP is still a flat per-round allowance — sequence/apSpent always clear.
    // Focus/Lightning/Lava are NOT reset here anymore (2026-08-16) — like
    // Flow, they only come back via the tick above (Attunement), not for free.
    Object.values(t.players || {}).forEach(p => { p.sequence = []; p.apSpent = 0; });
    Object.values(t.enemies || {}).forEach(e => { e.sequence = []; e.apSpent = 0; });
    miniPartyStubs.forEach(mp => { mp.sequence = []; mp.apSpent = 0; });
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
