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

// The base (1x) AP cost for a given Control value: 11 - Control, scaling from
// Control 1 (10 AP) down to Control 10 (1 AP). Strong Attack and any other
// "heavy" action pass multiplier 2 to double it at the same Control.
// Control 0 is its own case, not just the bottom of the 1-10 clamp: it costs
// 0 AP, because a Control-0 character can't act unassisted at all (see the
// foundational Control-substitution / Possession question in the roadmap's
// Stats section) — the number is a placeholder for "not really spendable,"
// not a discount.
export function apCostForControl(control, multiplier = 1){
  const c = Math.max(0, Math.min(10, control || 0));
  if(c === 0) return 0;
  return (11 - c) * multiplier;
}

export function clampInt(value, min, max){
  return Math.max(min, Math.min(max, value));
}

// Wounds model (2026-08-16, replaces the old depleting-pool version, vocabulary
// corrected same night): `wounds` (x) counts UP from 0. Two different
// thresholds on the same counter, previously conflated under one name:
//   - `woundsMax` (y) — personal, mutable, levelable. The Down threshold:
//     past it a character can't fight unaided, but isn't removed from play.
//   - `deathWounds` (z) — species-fixed (see character.js's SPECIES; falls
//     back to DEATH_WOUNDS_DEFAULT for anything not yet given a species).
//     Past it, a character is dead of accumulated Wounds. This is NOT the
//     same thing as Obliteration — Obliteration is reserved for when every
//     Body Part (also character.js) is false, a Chunk-based state with its
//     own separate check, not built yet since Body has no per-part mechanics
//     this pass. A Down character is still a valid target (for continued
//     damage or Execution, see combat.js); a Death-Wounded one no longer is.
export const DEATH_WOUNDS_DEFAULT = 10;
export function isDown(actor){ return (actor.wounds || 0) >= (actor.woundsMax || 1); }
export function isDeathWounded(actor){ return (actor.wounds || 0) >= (actor.deathWounds ?? DEATH_WOUNDS_DEFAULT); }

// Ally Targeting (2026-08-16): before this, a Player could only ever target
// table.enemies and an Enemy could only ever target table.players — the
// collection was always inferable from who was attacking. Now a Player can
// also target another Player, or a statted Mini-Party member, so the
// collection has to be resolved from the targetId itself. A Mini-Party
// member with no top-level record of its own uses a composite
// 'mp:<playerId>:<index>' id; everything else is a plain top-level id, safe
// to disambiguate since Player/Enemy ids are prefix-namespaced ('p_'/'e_',
// see genId()/dm.js's addEnemy) and never collide.
export function resolveEntityRef(table, targetId){
  if(!targetId || !table) return null;
  if(targetId.startsWith('mp:')){
    const [, pid, idxStr] = targetId.split(':');
    const p = table.players && table.players[pid];
    return (p && p.miniParty && p.miniParty[parseInt(idxStr, 10)]) || null;
  }
  return (table.players && table.players[targetId]) || (table.enemies && table.enemies[targetId]) || null;
}

// Personality/Head's first Axis (2026-08-21, per dDd's Notebook) — for now,
// Intelligence just governs how many Expressions (Mindeye entries) a
// Character can remember at once. Lives here, not personality.js, so
// deliverMindeyeEntry (below) can enforce it without importing the panel.
export const INTELLIGENCE_DEFAULT = 3;
export function getIntelligence(actor){
  return (actor && actor.personality && actor.personality.head && actor.personality.head.intelligence) ?? INTELLIGENCE_DEFAULT;
}

// Mindeye (2026-08-20) — where a Character's received Glyphs show up, per
// dDd. Called from inside a mutateTable draft, both from the Player-side
// Technique engine (techniques.js) and the DM's own Craft staging (dm.js),
// so Message works identically staged by either side. Just a single GI per
// arrival for now — Message has no content-authoring UI yet.
export function deliverMindeyeEntry(table, targetId, fromName, glyphId){
  const target = resolveEntityRef(table, targetId);
  if(!target) return;
  if(!target.mindeye) target.mindeye = [];
  target.mindeye.push({ id: genId(), from: fromName, glyph: glyphId || null, seen: false, receivedAt: timeNow() });
  // Capacity is Intelligence-gated — the oldest Expression is forgotten (not
  // just left unseen) once the Character's remembered count exceeds it.
  const capacity = getIntelligence(target);
  while(target.mindeye.length > capacity){
    target.mindeye.shift();
  }
}

// Every Enemy currently riding along as someone's Possessed Mini-Party
// member — an ally now, not a hostile, so it moves off the Enemy side onto
// the ally/Player side wherever that matters (target pickers, DM Test's
// actor lists), instead of showing up as targetable/auto-battling on both.
export function possessedEnemyIds(table){
  const ids = new Set();
  Object.values((table && table.players) || {}).forEach(p => {
    (p.miniParty || []).forEach(mp => { if(mp.sourceEnemyId) ids.add(mp.sourceEnemyId); });
  });
  return ids;
}

// Every id on the "ally" side of a table: every Player, every Player's
// statted Mini-Party member (composite 'mp:<playerId>:<index>' id, see
// resolveEntityRef above), and every Player's Possessed Mini-Party member
// (the real Enemy's own id). Un-statted Mini-Party stubs — added with no
// base build, so no wounds to track — are skipped; they aren't a legitimate
// actor/target yet.
export function alliedActorIds(table){
  const ids = [];
  Object.entries((table && table.players) || {}).forEach(([pid, p]) => {
    ids.push(pid);
    (p.miniParty || []).forEach((mp, idx) => {
      if(mp.sourceEnemyId){ if(table.enemies && table.enemies[mp.sourceEnemyId]) ids.push(mp.sourceEnemyId); }
      else if(mp.woundsMax != null){ ids.push('mp:' + pid + ':' + idx); }
    });
  });
  return ids;
}

// A Mini-Party member has no position of its own (see alliedActorIds above)
// — it rides on its own Player's Tile — so resolving a composite 'mp:' id's
// position falls back to the owning Player's. Everything else is a plain
// top-level lookup, same shape as resolveEntityRef.
export function resolvePositionRef(table, targetId){
  if(!targetId || !table) return null;
  if(targetId.startsWith('mp:')){
    const [, pid] = targetId.split(':');
    return (table.positions && table.positions[pid]) || null;
  }
  return (table.positions && table.positions[targetId]) || null;
}

// Which side a resolved target actually belongs to — used for Block-registry
// matching (a Block is registered under the owner's real side, not the
// attacker's opposite side, which was always true before Ally Targeting but
// isn't anymore: attacking an ally-Player should still respect a Block *they*
// staged, the same way attacking an Enemy respects an Enemy's Block).
export function ownerTypeOf(table, targetId){
  if(!targetId) return null;
  if(targetId.startsWith('mp:')) return 'player';
  if(table.players && table.players[targetId]) return 'player';
  if(table.enemies && table.enemies[targetId]) return 'enemy';
  return null;
}

// Generic flash-then-fade status text, shared by any panel that needs a
// "Saved"-style confirmation without a permanently-visible line (see the
// Character sheet's save-hint, which used to sit statically in the layout
// and force a scroll to reach the button below it). Errors are the one case
// that sticks around — no fade timer — until the next non-error call clears them.
const hintFadeTimeouts = {};
export function flashHint(elId, text, isError){
  const el = document.getElementById(elId);
  if(!el) return;
  clearTimeout(hintFadeTimeouts[elId]);
  el.textContent = text;
  el.classList.toggle('error', !!isError);
  el.classList.add('show');
  if(!isError){
    hintFadeTimeouts[elId] = setTimeout(() => el.classList.remove('show'), 1500);
  }
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
