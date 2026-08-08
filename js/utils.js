export function genCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let s = '';
  for(let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function genId(){
  return 'p_' + Math.random().toString(36).slice(2, 10);
}

export function timeNow(){
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function initials(name){
  return (name || '').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase();
}

export function targetShorthand(enemy){
  // Prefer the enemy's actual name over its Role/archetype text — Role can be an
  // arbitrary long description ("Temporary Extension of Kulkrow..."), while name
  // is always short and is what's shown everywhere else (Target range, DM picker).
  const base = (enemy.name || enemy.archetype || '').replace(/\s*#\d+$/, '');
  return initials(base) + (enemy.num || '');
}

export function playerShorthand(player){
  return initials(player.name || 'P') || 'P';
}

export function computeEntryTick(quickness, counterMax){
  const delay = Math.max(0, 10 - (quickness || 0));
  return Math.max(0, counterMax - delay);
}

export function computeCounterMax(table){
  const playerAp = Object.values(table.players || {}).map(p => p.ap || 0);
  const enemyAp = Object.values(table.enemies || {}).map(e => e.ap || 0);
  return Math.max(1, Math.max(0, ...playerAp), Math.max(0, ...enemyAp));
}
