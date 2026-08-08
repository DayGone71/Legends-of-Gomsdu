import { AppState } from './state.js';
import { escapeHtml, computeEntryTick, computeCounterMax } from './utils.js';

export function renderSequencer(){
  const el = document.getElementById('sequencer');
  if(!el) return;
  const table = AppState.table;
  if(!table){ el.innerHTML = ''; return; }
  const me = table.players[AppState.playerId];

  const counterMax = computeCounterMax(table);
  function leftPct(tick){
    return Math.max(0, Math.min(100, ((counterMax - tick) / counterMax) * 100));
  }

  let ticksHtml = '';
  for(let t = 0; t <= counterMax; t++){
    const isMajor = (t % 5 === 0) || (t === counterMax);
    if(!isMajor && counterMax > 30 && t % 2 !== 0) continue;
    const pct = leftPct(t);
    ticksHtml += '<div class="seq-tick' + (isMajor ? ' major' : '') + '" style="left:' + pct + '%;"></div>';
    if(isMajor) ticksHtml += '<div class="seq-tick-label" style="left:' + pct + '%;">' + t + '</div>';
  }

  let entryHtml = '';
  if(me){
    const pct = leftPct(computeEntryTick(me.quickness, counterMax));
    entryHtml += '<div class="seq-entry-tick" style="left:' + pct + '%;"></div>' +
      '<div class="seq-entry-label" style="left:' + pct + '%;">You start</div>';
  }
  if(AppState.actingEnemyId && table.enemies && table.enemies[AppState.actingEnemyId]){
    const ae = table.enemies[AppState.actingEnemyId];
    const pct = leftPct(computeEntryTick(ae.quickness, counterMax));
    entryHtml += '<div class="seq-entry-tick dm" style="left:' + pct + '%;"></div>' +
      '<div class="seq-entry-label dm" style="left:' + pct + '%;">' + escapeHtml(ae.name) + ' starts</div>';
  }

  function buildMarkers(actor){
    if(!actor) return '';
    const entryTick = computeEntryTick(actor.quickness, counterMax);
    let runningCost = 0, html = '';
    (actor.sequence || []).forEach(entry => {
      runningCost += entry.apCost;
      const pct = leftPct(Math.max(0, entryTick - runningCost));
      html += '<div class="seq-marker" style="left:' + pct + '%;">' +
        '<div class="seq-marker-box">' + escapeHtml(entry.targetLabel || '\u2014') + '</div>' +
        '<div class="seq-marker-box action">' + escapeHtml(entry.actionLabel) + '</div></div>';
    });
    return html;
  }

  const myMarkers = buildMarkers(me);
  let enemyMarkers = '';
  Object.values(table.enemies || {}).forEach(e => { enemyMarkers += buildMarkers(e); });

  el.innerHTML =
    '<div class="seq-wrap">' +
      '<div class="seq-counter-badge">' + counterMax + '</div>' +
      '<div class="seq-line-row"><div class="seq-line"></div>' + ticksHtml + entryHtml + '</div>' +
      '<div class="seq-lane-label">Your actions</div>' +
      '<div class="seq-lane">' + (myMarkers || '<div class="log-empty" style="padding-top:16px;">Nothing staged yet.</div>') + '</div>' +
      '<div class="seq-lane-label">Enemy actions</div>' +
      '<div class="seq-lane enemy">' + (enemyMarkers || '') + '</div>' +
    '</div>';
}
