import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml, timeNow } from './utils.js';

export function renderLedger(){
  const el = document.getElementById('ledger');
  if(!el) return;
  const log = (AppState.table && AppState.table.log) || [];
  if(!log.length){ el.innerHTML = '<div class="log-empty">Nothing recorded yet.</div>'; return; }

  const recent = log.slice(-100);
  el.innerHTML = recent.map(entry => {
    if(entry.type === 'roll'){
      return '<div class="log-entry roll">' +
        '<span class="time">' + entry.time + '</span>' +
        '<span class="name">' + escapeHtml(entry.name) + '</span>' +
        '<span>rolled d' + entry.sides + (entry.modifier ? (entry.modifier > 0 ? '+' : '') + entry.modifier : '') +
        ' &rarr; <span class="stamp">' + entry.total + '</span></span></div>';
    }
    if(entry.type === 'chat'){
      return '<div class="log-entry chat">' +
        '<span class="time">' + entry.time + '</span>' +
        '<span class="name">' + escapeHtml(entry.name) + ':</span>' +
        '<span>' + escapeHtml(entry.text) + '</span></div>';
    }
    return '<div class="log-entry system"><span class="time">' + entry.time + '</span><span>' +
      escapeHtml(entry.text) + '</span></div>';
  }).join('');
}

export async function sendMessage(){
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if(!text) return;
  const me = AppState.table.players[AppState.playerId];
  await mutateTable(t => {
    t.log.push({ type: 'chat', name: (me && me.name) || 'Someone', text, time: timeNow() });
  });
  input.value = '';
}

export function renderRoster(){
  const el = document.getElementById('roster');
  if(!el) return;
  const players = (AppState.table && AppState.table.players) || {};
  const list = Object.values(players);
  if(!list.length){ el.innerHTML = '<div class="log-empty">No one here yet.</div>'; return; }

  el.innerHTML = list.map(p => {
    const wounds = p.wounds ?? 0, woundsMax = p.woundsMax || 1;
    const pct = Math.max(0, Math.min(100, Math.round((wounds / woundsMax) * 100)));
    const low = pct <= 30;
    const initial = (p.name || '?').trim().charAt(0).toUpperCase() || '?';
    return '<div class="roster-item">' +
      '<div class="avatar">' + initial + '</div>' +
      '<div class="roster-info">' +
      '<div class="r-name">' + escapeHtml(p.name || 'Unnamed') + '</div>' +
      '<div class="r-arch">' + escapeHtml(p.archetype || 'No archetype set') + '</div>' +
      '</div>' +
      '<div class="hp-bar-wrap"><div class="hp-bar ' + (low ? 'low' : '') + '" style="width:' + pct + '%"></div></div>' +
      '<div class="hp-text">' + wounds + '/' + woundsMax + '</div>' +
      '<div class="ap-text">' + (p.ap ?? 0) + ' AP</div>' +
      '</div>';
  }).join('');
}
