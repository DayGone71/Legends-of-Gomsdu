// DM Test panel — auto-stages a full AP's worth of attacks for each configured
// actor and resolves the round, using the same resolveRound() the Sequencer's
// "Resolve round" button calls. Exists purely to skip the manual click-through
// (select actor, select target, select attack, commit, repeat) when what you
// actually want is to watch a fight play out.
import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml, timeNow, targetShorthand, playerShorthand, apCostForControl } from './utils.js';
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

function countAlive(collection){
  return Object.values(collection || {}).filter(a => (a.wounds ?? 0) > 0).length;
}

export function renderDMTestPanel(){
  const el = document.getElementById('dmtest-actors');
  if(!el) return;
  const table = AppState.table;
  if(!table){ el.innerHTML = ''; return; }

  if(!AppState.dmTestConfig) AppState.dmTestConfig = { enemies: {}, players: {} };
  const cfg = AppState.dmTestConfig;

  const enemyList = Object.entries(table.enemies || {});
  const playerList = Object.entries(table.players || {});

  // Drop config for actors that no longer exist (defeated + cleared, or left the table).
  Object.keys(cfg.enemies).forEach(id => { if(!table.enemies || !table.enemies[id]) delete cfg.enemies[id]; });
  Object.keys(cfg.players).forEach(id => { if(!table.players || !table.players[id]) delete cfg.players[id]; });

  const aliveEnemyIds = enemyList.filter(([, e]) => e.wounds > 0).map(([id]) => id);
  const alivePlayerIds = playerList.filter(([, p]) => (p.wounds ?? 0) > 0).map(([id]) => id);

  function rowHtml(id, actor, side){
    const targetIds = side === 'enemies' ? alivePlayerIds : aliveEnemyIds;
    const targetCollection = side === 'enemies' ? table.players : table.enemies;
    if(!cfg[side][id]) cfg[side][id] = { targetId: targetIds[0] || '', kind: 'fast' };
    const c = cfg[side][id];
    if(!targetIds.includes(c.targetId)) c.targetId = targetIds[0] || '';

    const defeated = (actor.wounds ?? 0) <= 0;
    const optionsHtml = targetIds.length
      ? targetIds.map(tid => '<option value="' + tid + '"' + (tid === c.targetId ? ' selected' : '') + '>' +
          escapeHtml(targetCollection[tid].name || 'Target') + '</option>').join('')
      : '<option value="">No target</option>';

    return '<div class="dmtest-row' + (defeated ? ' defeated' : '') + '" data-id="' + id + '" data-side="' + side + '">' +
      '<div class="dmtest-name">' + escapeHtml(actor.name || 'Actor') + (defeated ? ' (down)' : '') + '</div>' +
      '<select class="dmtest-target" ' + (defeated || !targetIds.length ? 'disabled' : '') + '>' + optionsHtml + '</select>' +
      '<select class="dmtest-kind" ' + (defeated ? 'disabled' : '') + '>' +
        '<option value="off"' + (c.kind === 'off' ? ' selected' : '') + '>Hold</option>' +
        '<option value="fast"' + (c.kind === 'fast' ? ' selected' : '') + '>Fast</option>' +
        '<option value="strong"' + (c.kind === 'strong' ? ' selected' : '') + '>Strong</option>' +
      '</select>' +
    '</div>';
  }

  let html = '';
  if(!enemyList.length && !playerList.length){
    html = '<div class="log-empty">No one in the encounter yet.</div>';
  }else{
    if(enemyList.length){
      html += '<div class="dmtest-side-label">Enemies</div>' + enemyList.map(([id, e]) => rowHtml(id, e, 'enemies')).join('');
    }
    if(playerList.length){
      html += '<div class="dmtest-side-label">Players</div>' + playerList.map(([id, p]) => rowHtml(id, p, 'players')).join('');
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
    Object.entries(t.enemies || {}).forEach(([id, enemy]) => {
      if(enemy.wounds <= 0) return;
      const c = cfg.enemies[id];
      if(!c || c.kind === 'off' || !c.targetId) return;
      const target = t.players[c.targetId];
      if(!target || (target.wounds ?? 0) <= 0) return;
      const entries = buildFullRoundEntries(enemy, c.kind, c.targetId, playerShorthand(target));
      if(!entries.length) return;
      enemy.sequence = (enemy.sequence || []).concat(entries);
      enemy.apSpent = (enemy.apSpent || 0) + entries.reduce((s, e) => s + e.apCost, 0);
      t.log.push({ type: 'system', text: enemy.name + ' auto-stages ' + entries.length + '× ' + (c.kind === 'strong' ? 'SA' : 'FA') + ' on ' + playerShorthand(target), time: timeNow() });
    });
    Object.entries(t.players || {}).forEach(([id, player]) => {
      if((player.wounds ?? 0) <= 0) return;
      const c = cfg.players[id];
      if(!c || c.kind === 'off' || !c.targetId) return;
      const target = t.enemies[c.targetId];
      if(!target || target.wounds <= 0) return;
      const entries = buildFullRoundEntries(player, c.kind, c.targetId, targetShorthand(target));
      if(!entries.length) return;
      player.sequence = (player.sequence || []).concat(entries);
      player.apSpent = (player.apSpent || 0) + entries.reduce((s, e) => s + e.apCost, 0);
      t.log.push({ type: 'system', text: player.name + ' auto-stages ' + entries.length + '× ' + (c.kind === 'strong' ? 'SA' : 'FA') + ' on ' + targetShorthand(target), time: timeNow() });
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

export async function runDMTestUntilDefeat(){
  if(AppState.dmTestRunning) return;
  const input = document.getElementById('dmtest-max-rounds');
  const maxRounds = Math.max(1, Math.min(100, parseInt(input && input.value, 10) || 25));
  AppState.dmTestRunning = true;
  renderDMTestPanel();

  let rounds = 0;
  let outcome = 'max_rounds_reached';
  for(let i = 0; i < maxRounds; i++){
    if(!countAlive(AppState.table.players)){ outcome = 'players_defeated'; break; }
    if(!countAlive(AppState.table.enemies)){ outcome = 'enemies_defeated'; break; }
    await runOneRound();
    rounds++;
    if(!countAlive(AppState.table.players)){ outcome = 'players_defeated'; break; }
    if(!countAlive(AppState.table.enemies)){ outcome = 'enemies_defeated'; break; }
  }

  const summary = {
    players_defeated: 'the party was defeated',
    enemies_defeated: 'every enemy was defeated',
    max_rounds_reached: 'no conclusive outcome yet'
  }[outcome];
  AppState.dmTestLastResult = 'Ran ' + rounds + (rounds === 1 ? ' round' : ' rounds') + ' — ' + summary + '.';
  AppState.dmTestRunning = false;
  renderDMTestPanel();
}
