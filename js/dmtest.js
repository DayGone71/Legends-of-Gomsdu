// DM Test panel — auto-stages a full AP's worth of attacks for each configured
// actor and resolves the round, using the same resolveRound() the Sequencer's
// "Resolve round" button calls. Exists purely to skip the manual click-through
// (select actor, select target, select attack, commit, repeat) when what you
// actually want is to watch a fight play out.
import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml, timeNow, targetShorthand, playerShorthand, apCostForControl, isDeathWounded, resolveEntityRef, possessedEnemyIds, alliedActorIds } from './utils.js';
import { resolveRound } from './combat.js';

function buildFullRoundEntries(actor, kind, targetId, targetLabel){
  if(kind === 'off') return [];
  const cost = apCostForControl(actor.control || 0, kind === 'strong' ? 2 : 1);
  const remaining = Math.max(0, (actor.ap || 0) - (actor.apSpent || 0));
  const count = cost > 0 ? Math.floor(remaining / cost) : 0;
  const label = kind === 'strong' ? 'SA' : 'FA';
  const entries = [];
  for(let i = 0; i < count; i++){
    entries.push({ apCost: cost, focusCost: 0, actionLabel: label, targetLabel, kind: 'attack', attackKind: kind, targetId });
  }
  return entries;
}

function countAliveAllies(table){
  return alliedActorIds(table).filter(id => {
    const a = resolveEntityRef(table, id);
    return a && !isDeathWounded(a);
  }).length;
}

function countAliveEnemies(table){
  const possessed = possessedEnemyIds(table);
  return Object.entries((table && table.enemies) || {}).filter(([id, e]) => !possessed.has(id) && !isDeathWounded(e)).length;
}

export function renderDMTestPanel(){
  const el = document.getElementById('dmtest-actors');
  if(!el) return;
  const table = AppState.table;
  if(!table){ el.innerHTML = ''; return; }

  if(!AppState.dmTestConfig) AppState.dmTestConfig = { enemies: {}, players: {} };
  const cfg = AppState.dmTestConfig;

  // Possessed Enemies are allies now — the "Enemies" auto-battle side
  // excludes them (they show up on "Players" below instead, via
  // alliedActorIds), same as the Combat panel's Target/Ally ranges.
  const possessed = possessedEnemyIds(table);
  const enemyList = Object.entries(table.enemies || {}).filter(([id]) => !possessed.has(id));
  const allyIds = alliedActorIds(table);

  // Drop config for actors that no longer exist (defeated + cleared, left the table, or un-possessed).
  Object.keys(cfg.enemies).forEach(id => { if(!table.enemies || !table.enemies[id] || possessed.has(id)) delete cfg.enemies[id]; });
  Object.keys(cfg.players).forEach(id => { if(!resolveEntityRef(table, id)) delete cfg.players[id]; });

  const aliveEnemyIds = enemyList.filter(([, e]) => !isDeathWounded(e)).map(([id]) => id);
  const aliveAllyIds = allyIds.filter(id => { const a = resolveEntityRef(table, id); return a && !isDeathWounded(a); });

  function rowHtml(id, actor, side){
    const targetIds = side === 'enemies' ? aliveAllyIds : aliveEnemyIds;
    if(!cfg[side][id]) cfg[side][id] = { targetId: targetIds[0] || '', kind: 'fast' };
    const c = cfg[side][id];
    if(!targetIds.includes(c.targetId)) c.targetId = targetIds[0] || '';

    const defeated = isDeathWounded(actor);
    const optionsHtml = targetIds.length
      ? targetIds.map(tid => {
          const t = side === 'enemies' ? resolveEntityRef(table, tid) : (table.enemies && table.enemies[tid]);
          return '<option value="' + tid + '"' + (tid === c.targetId ? ' selected' : '') + '>' + escapeHtml((t && t.name) || 'Target') + '</option>';
        }).join('')
      : '<option value="">No target</option>';

    return '<div class="dmtest-row' + (defeated ? ' defeated' : '') + '" data-id="' + id + '" data-side="' + side + '">' +
      '<div class="dmtest-name">' + escapeHtml(actor.name || 'Actor') + (defeated ? ' (dead)' : '') + '</div>' +
      '<select class="dmtest-target" ' + (defeated || !targetIds.length ? 'disabled' : '') + '>' + optionsHtml + '</select>' +
      '<select class="dmtest-kind" ' + (defeated ? 'disabled' : '') + '>' +
        '<option value="off"' + (c.kind === 'off' ? ' selected' : '') + '>Hold</option>' +
        '<option value="fast"' + (c.kind === 'fast' ? ' selected' : '') + '>Fast</option>' +
        '<option value="strong"' + (c.kind === 'strong' ? ' selected' : '') + '>Strong</option>' +
      '</select>' +
    '</div>';
  }

  let html = '';
  if(!enemyList.length && !allyIds.length){
    html = '<div class="log-empty">No one in the encounter yet.</div>';
  }else{
    if(enemyList.length){
      html += '<div class="dmtest-side-label">Enemies</div>' + enemyList.map(([id, e]) => rowHtml(id, e, 'enemies')).join('');
    }
    if(allyIds.length){
      html += '<div class="dmtest-side-label">Players</div>' + allyIds.map(id => rowHtml(id, resolveEntityRef(table, id), 'players')).join('');
    }
  }
  el.innerHTML = html;

  el.querySelectorAll('.dmtest-row').forEach(row => {
    const id = row.dataset.id, side = row.dataset.side;
    const targetSel = row.querySelector('.dmtest-target');
    const kindSel = row.querySelector('.dmtest-kind');
    if(targetSel) targetSel.addEventListener('change', e => { cfg[side][id].targetId = e.target.value; });
    if(kindSel) kindSel.addEventListener('change', e => { cfg[side][id].kind = e.target.value; });
  });

  const resultEl = document.getElementById('dmtest-result');
  if(resultEl) resultEl.textContent = AppState.dmTestLastResult || '';

  const disableRun = !table.inEncounter || !!AppState.dmTestRunning;
  document.querySelectorAll('.dmtest-run-btn').forEach(b => { b.disabled = disableRun; });
}

// Stages one full round for every actor with a live target and a kind other than
// 'off', then resolves it through the real combat engine. Mirrors what Commit x N
// followed by Resolve round does manually, but in a single batched write.
async function runOneRound(){
  const table = AppState.table;
  if(!table || !table.inEncounter) return;
  const cfg = AppState.dmTestConfig || { enemies: {}, players: {} };

  await mutateTable(t => {
    const possessed = possessedEnemyIds(t);
    Object.entries(t.enemies || {}).forEach(([id, enemy]) => {
      if(possessed.has(id) || isDeathWounded(enemy)) return;
      const c = cfg.enemies[id];
      if(!c || c.kind === 'off' || !c.targetId) return;
      const target = resolveEntityRef(t, c.targetId);
      if(!target || isDeathWounded(target)) return;
      const entries = buildFullRoundEntries(enemy, c.kind, c.targetId, playerShorthand(target));
      if(!entries.length) return;
      enemy.sequence = (enemy.sequence || []).concat(entries);
      enemy.apSpent = (enemy.apSpent || 0) + entries.reduce((s, e) => s + e.apCost, 0);
      t.log.push({ type: 'system', text: enemy.name + ' auto-stages ' + entries.length + '× ' + (c.kind === 'strong' ? 'SA' : 'FA') + ' on ' + playerShorthand(target), time: timeNow() });
    });
    alliedActorIds(t).forEach(id => {
      const actor = resolveEntityRef(t, id);
      if(!actor || isDeathWounded(actor)) return;
      const c = cfg.players[id];
      if(!c || c.kind === 'off' || !c.targetId) return;
      const target = t.enemies[c.targetId];
      if(!target || isDeathWounded(target)) return;
      const entries = buildFullRoundEntries(actor, c.kind, c.targetId, targetShorthand(target));
      if(!entries.length) return;
      actor.sequence = (actor.sequence || []).concat(entries);
      actor.apSpent = (actor.apSpent || 0) + entries.reduce((s, e) => s + e.apCost, 0);
      t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' auto-stages ' + entries.length + '× ' + (c.kind === 'strong' ? 'SA' : 'FA') + ' on ' + targetShorthand(target), time: timeNow() });
    });
  });

  await resolveRound();
}

export async function runDMTestRound(){
  if(AppState.dmTestRunning) return;
  AppState.dmTestRunning = true;
  renderDMTestPanel();
  await runOneRound();
  AppState.dmTestLastResult = 'Ran 1 round.';
  AppState.dmTestRunning = false;
  renderDMTestPanel();
}

const OUTCOME_SUMMARY = {
  players_defeated: 'the party was defeated',
  enemies_defeated: 'every enemy was defeated'
};

// Shared by both "Run Rounds" and "Run Until Defeat" below — runs rounds back
// to back, stopping early the moment either side has no one left standing,
// otherwise stopping once capRounds is hit (a deliberate stalemate guard, not
// just a UI convenience — two actors that can never defeat each other would
// otherwise loop forever).
async function runRoundsLoop(capRounds, cappedOutcome){
  let rounds = 0;
  let outcome = cappedOutcome;
  for(let i = 0; i < capRounds; i++){
    if(!countAliveAllies(AppState.table)){ outcome = 'players_defeated'; break; }
    if(!countAliveEnemies(AppState.table)){ outcome = 'enemies_defeated'; break; }
    await runOneRound();
    rounds++;
    if(!countAliveAllies(AppState.table)){ outcome = 'players_defeated'; break; }
    if(!countAliveEnemies(AppState.table)){ outcome = 'enemies_defeated'; break; }
  }
  return { rounds, outcome };
}

// Runs an explicit, user-chosen number of rounds (1-100), stopping early on
// defeat same as Run Until Defeat below — just bounded by what was typed
// instead of running to a stalemate cap.
export async function runDMTestNRounds(){
  if(AppState.dmTestRunning) return;
  const input = document.getElementById('dmtest-n-rounds');
  const n = Math.max(1, Math.min(100, parseInt(input && input.value, 10) || 1));
  AppState.dmTestRunning = true;
  renderDMTestPanel();
  const { rounds, outcome } = await runRoundsLoop(n, 'n_rounds_reached');
  const summary = OUTCOME_SUMMARY[outcome] || 'no conclusive outcome yet';
  AppState.dmTestLastResult = 'Ran ' + rounds + (rounds === 1 ? ' round' : ' rounds') + ' — ' + summary + '.';
  AppState.dmTestRunning = false;
  renderDMTestPanel();
}

// Runs until one side is actually defeated — no user-chosen cap anymore, just
// a hardcoded stalemate safety valve (two Characters that can never defeat
// each other shouldn't be able to loop this indefinitely).
const UNTIL_DEFEAT_SAFETY_CAP = 40;
export async function runDMTestUntilDefeat(){
  if(AppState.dmTestRunning) return;
  AppState.dmTestRunning = true;
  renderDMTestPanel();
  const { rounds, outcome } = await runRoundsLoop(UNTIL_DEFEAT_SAFETY_CAP, 'safety_cap_reached');
  const summary = outcome === 'safety_cap_reached'
    ? 'no conclusive outcome after ' + UNTIL_DEFEAT_SAFETY_CAP + ' rounds — bailed out (possible stalemate)'
    : (OUTCOME_SUMMARY[outcome] || 'no conclusive outcome yet');
  AppState.dmTestLastResult = 'Ran ' + rounds + (rounds === 1 ? ' round' : ' rounds') + ' — ' + summary + '.';
  AppState.dmTestRunning = false;
  renderDMTestPanel();
}
