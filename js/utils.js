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

// The base (1x) AP cost for a given Control value: 11 - Control, clamped so
// Control <= 1 costs 10 AP and Control >= 10 costs 1 AP. Strong Attack and any
// other "heavy" action pass multiplier 2 to double it at the same Control.
export function apCostForControl(control, multiplier = 1){
  const c = Math.max(1, Math.min(10, control || 0));
  return (11 - c) * multiplier;
}

export function clampInt(value, min, max){
  return Math.max(min, Math.min(max, value));
}

// Full, unabbreviated action name for Ledger display — the sequence entry's own
// actionLabel ('FA', 'GB', etc.) stays short for the Sequencer ruler, which needs
// the room; the Ledger reads better spelled out.
export function describeAction(entry){
  if(!entry) return 'Action';
  if(entry.kind === 'attack'){
    return entry.attackKind === 'strong' ? 'Strong Attack' : entry.attackKind === 'focus' ? 'Focus Attack' : 'Fast Attack';
  }
  if(entry.kind === 'block'){
    return (entry.blockKind === 'general' ? 'General Block' : 'Target Block') + (entry.counter ? ' + Counter' : '');
  }
  if(entry.kind === 'essence') return entry.school === 'Lava' ? 'Lava' : 'Lightning';
  if(entry.kind === 'rest') return 'Rest';
  return entry.actionLabel || 'Action';
}

// Power buckets into a small Damage value once it's actually inflicting Wounds —
// dumping a raw 0-50 Power stat straight into a 3-8 Wounds pool one/two-shots
// everything, which is the opposite of what a Hit%-based exposure system is for.
// ~10 Power per Damage tier; exact bracket width is a tuning knob, not fixed lore.
// Power vs Flow is unaffected by this — that interaction stays on raw Power.
export function powerToDamage(power){
  return Math.max(0, Math.ceil((power || 0) / 10));
}
