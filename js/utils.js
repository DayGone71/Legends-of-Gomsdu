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

// Shared error banner — one version, used everywhere instead of copies per file.
export function showBannerError(msg){
  const el = document.getElementById('banner-error');
  if(!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
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
  // Prefer the enemy's actual name over its Role/archetype text, which can be
  // an arbitrary long description — name is always short.
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

// Base (1x) AP cost for a given Control: 11 - Control, from Control 1 (10 AP)
// down to Control 10 (1 AP). multiplier 2 doubles it for "heavy" actions.
// Control 0 costs 0 AP as its own case — a Control-0 character can't act
// unassisted at all, so this is a placeholder for "not really spendable," not a discount.
export function apCostForControl(control, multiplier = 1){
  const c = Math.max(0, Math.min(10, control || 0));
  if(c === 0) return 0;
  return (11 - c) * multiplier;
}

export function clampInt(value, min, max){
  return Math.max(min, Math.min(max, value));
}

// Wounds: `wounds` (x) counts UP from 0. Two thresholds on the same counter:
//   - `woundsMax` (y) — personal, mutable, levelable. The Down threshold:
//     past it a character can't fight unaided, but isn't removed from play.
//   - `deathWounds` (z) — species-fixed (character.js's SPECIES; falls back
//     to DEATH_WOUNDS_DEFAULT). Past it, dead of accumulated Wounds. NOT the
//     same as Obliteration (every Body Part false — not built, Body has no
//     per-part mechanics yet). A Down character is still a valid target; a
//     Death-Wounded one no longer is.
export const DEATH_WOUNDS_DEFAULT = 10;
export function isDown(actor){ return (actor.wounds || 0) >= (actor.woundsMax || 1); }
export function isDeathWounded(actor){ return (actor.wounds || 0) >= (actor.deathWounds ?? DEATH_WOUNDS_DEFAULT); }

// A target's collection has to be resolved from the id itself now that a
// Player can target another Player or a Mini-Party member, not just an
// Enemy. A Mini-Party member with no top-level record uses a composite
// 'mp:<playerId>:<index>' id; everything else is a plain id, safe since
// Player/Enemy ids are prefix-namespaced ('p_'/'e_') and never collide.
export function resolveEntityRef(table, targetId){
  if(!targetId || !table) return null;
  if(targetId.startsWith('mp:')){
    const [, pid, idxStr] = targetId.split(':');
    const p = table.players && table.players[pid];
    return (p && p.miniParty && p.miniParty[parseInt(idxStr, 10)]) || null;
  }
  return (table.players && table.players[targetId]) || (table.enemies && table.enemies[targetId]) ||
    (table.characters && table.characters[targetId]) || null;
}

// Personality/Head's first Axis. Intelligence governs how many Expressions
// (Mindeye entries) a Character can remember at once — lives here, not
// personality.js, so deliverMindeyeEntry (below) can enforce it without
// importing the panel. 1 Intelligence point = 10 Memories (raw stat x 10, not 1:1).
export const INTELLIGENCE_DEFAULT = 1;
export const MINDEYE_CAPACITY_PER_POINT = 10;
export function getIntelligence(actor){
  return (actor && actor.personality && actor.personality.head && actor.personality.head.intelligence) ?? INTELLIGENCE_DEFAULT;
}
export function mindeyeCapacity(actor){
  return getIntelligence(actor) * MINDEYE_CAPACITY_PER_POINT;
}

// The 4-stage Category lifecycle: a single continuous 0-100 Retention stat
// per Mindeye entry — Category is just which band it falls in, not a
// separate flag. Scoped strictly to Memory/Mindeye, not reused for
// Personality Axes or Relationships.
export const MINDEYE_RETENTION_PERFECTED = 100;
// born/innate deliveries (seen=true below) start Perfected outright,
// converging to the same protected end state a climbed-to-100 entry reaches.
// A real arrival starts inside Retained, not Fleeting — nothing yet exists
// to climb a fresh entry out of Fleeting (decay/reinforcement unbuilt).
const MINDEYE_RETENTION_BORN = 100;
const MINDEYE_RETENTION_DEFAULT = 40;
// Perfected (100) is a one-way door — no Technique undoes it yet; this is the rule waiting for one.
export function mindeyeCategory(retention){
  const r = retention ?? MINDEYE_RETENTION_DEFAULT;
  if(r >= MINDEYE_RETENTION_PERFECTED) return 'Perfected';
  if(r >= 76) return 'Known';
  if(r >= 26) return 'Retained';
  return 'Fleeting';
}

// A Build's own startingMindeye, turned into real entries — every spawn path
// builds a Character's innate Mindeye the same way, in one pass. Detached
// from any table — the caller assembles a fresh Character record.
export function bornMindeyeEntries(glyphIds){
  return (glyphIds || []).map(g => ({
    id: genId(), from: 'Star Father', glyph: g || null, seen: true,
    retention: MINDEYE_RETENTION_BORN, receivedAt: timeNow()
  }));
}

// Where a Character's received Glyphs show up. Called from inside a
// mutateTable draft, from both the Player-side Technique engine and the DM's
// own Craft staging, so Message works identically staged by either side.
// `seen` defaults false (triggers the Information panel's Spotlight reveal);
// Innate knowledge delivered at spawn time passes true — no reveal for
// something a Character has simply always known. Separate from `retention`
// above — `seen` gates the one-time reveal animation, `retention` gates the
// displayed Category; they just both start "already settled" for born entries.
export function deliverMindeyeEntry(table, targetId, fromName, glyphId, seen = false){
  const target = resolveEntityRef(table, targetId);
  if(!target) return;
  if(!target.mindeye) target.mindeye = [];
  const retention = seen ? MINDEYE_RETENTION_BORN : MINDEYE_RETENTION_DEFAULT;
  target.mindeye.push({ id: genId(), from: fromName, glyph: glyphId || null, seen, retention, receivedAt: timeNow() });
  // Capacity is Intelligence-gated. Forgetting-priority is the inverse of
  // Retention — weakest-held entry goes first, ties broken oldest-first.
  // Perfected entries are exempt entirely.
  const capacity = mindeyeCapacity(target);
  while(target.mindeye.length > capacity){
    const forgettable = target.mindeye.filter(e => (e.retention ?? MINDEYE_RETENTION_DEFAULT) < MINDEYE_RETENTION_PERFECTED);
    if(!forgettable.length) break; // everything left is Perfected — protected, stays over capacity.
    // Oldest-first tiebreak comes free from scanning in array/arrival order
    // and only replacing on a strictly lower Retention.
    let weakest = forgettable[0];
    forgettable.forEach(e => {
      if((e.retention ?? MINDEYE_RETENTION_DEFAULT) < (weakest.retention ?? MINDEYE_RETENTION_DEFAULT)) weakest = e;
    });
    target.mindeye.splice(target.mindeye.indexOf(weakest), 1);
  }
}

// Which Glyph IDs an actor actually knows — "knowing" a Glyph means having a
// Mindeye entry for it (the separate knownGlyphs curriculum array is gone).
export function knownGlyphIds(actor){
  return [...new Set(((actor && actor.mindeye) || []).map(e => e.glyph).filter(Boolean))];
}

// Every Glyph currently staged (Message Orders, or the DM's own Enemy-
// sequence staging) but not yet delivered to a given target — the
// "Information a Character is going to know" half of Influence's own targeting.
export function pendingMessageGlyphs(table, targetId){
  const glyphs = new Set();
  const scanOrders = (orders) => (orders || []).forEach(o => {
    if(o.kind === 'message' && o.targetId === targetId) (o.glyphs || []).forEach(g => glyphs.add(g));
  });
  const scanSequence = (sequence) => (sequence || []).forEach(entry => {
    if(entry.kind === 'technique' && entry.techniqueKey === 'message' && entry.targetId === targetId) (entry.glyphs || []).forEach(g => glyphs.add(g));
  });
  Object.values((table && table.players) || {}).forEach(p => scanOrders(p.orders));
  Object.values((table && table.enemies) || {}).forEach(e => { scanOrders(e.orders); scanSequence(e.sequence); });
  return [...glyphs];
}

// Every Enemy currently riding along as someone's Possessed Mini-Party
// member — an ally now, so it moves off the Enemy side wherever that matters.
export function possessedEnemyIds(table){
  const ids = new Set();
  Object.values((table && table.players) || {}).forEach(p => {
    (p.miniParty || []).forEach(mp => { if(mp.sourceEnemyId) ids.add(mp.sourceEnemyId); });
  });
  return ids;
}

// The one shared place every list-building UI (Combat's Ally Range, Target
// Range, NPC Panel, Script Panel pickers, etc.) walks players/enemies/
// miniParty from — replaces what used to be several independent,
// near-identical, slowly-drifting reimplementations. Each row carries
// `entity` (the live Character object) so a consumer can pull whatever extra
// display fields it needs.

// Every Player, plus their statted Mini-Party members (a Possessed one
// resolves to the real Enemy's own record; an un-statted stub is skipped).
export function alliedRoster(table){
  const rows = [];
  Object.entries((table && table.players) || {}).forEach(([pid, p]) => {
    rows.push({ id: pid, entity: p, name: p.name || 'Unnamed', dead: isDeathWounded(p) });
    (p.miniParty || []).forEach((mp, idx) => {
      if(mp.sourceEnemyId){
        const src = table && table.enemies && table.enemies[mp.sourceEnemyId];
        if(src) rows.push({ id: mp.sourceEnemyId, entity: src, name: src.name || 'Unnamed', dead: isDeathWounded(src), sub: '(' + (p.name || '?') + '’s Mini-Party)' });
      }else if(mp.woundsMax != null){
        rows.push({ id: 'mp:' + pid + ':' + idx, entity: mp, name: mp.name || 'Follower', dead: isDeathWounded(mp), sub: '(' + (p.name || '?') + '’s Mini-Party)' });
      }
    });
  });
  return rows;
}

export function enemyRoster(table){
  return Object.entries((table && table.enemies) || {}).map(([id, e]) => ({
    id, entity: e, name: e.name || 'Enemy', dead: isDeathWounded(e)
  }));
}

// Every real Character living in the Universal Characters Table — currently
// just Yom. table.players/table.enemies stay where they are; this is
// additive, not a replacement for either roster.
export function charactersRoster(table){
  return Object.entries((table && table.characters) || {}).map(([id, c]) => ({
    id, entity: c, name: c.name || 'Character', dead: isDeathWounded(c)
  }));
}

// Everybody at the table, all three buckets at once — allied side first, then Universal, then Enemies.
export function allCharacterRoster(table){
  return [...alliedRoster(table), ...charactersRoster(table), ...enemyRoster(table)];
}

// Id-only views over the same rosters.
export function alliedActorIds(table){
  return alliedRoster(table).map(r => r.id);
}
export function allCharacterIds(table){
  return allCharacterRoster(table).map(r => r.id);
}

// Every Character is targetable by every Craft/Power — selfTarget is the
// only exception, handled separately by each Technique's own `selfOnly`
// flag. `casterId`/`targetSide` kept as accepted (unused) params so existing
// call sites don't need updating if a real self/other distinction ever comes back.
export function crafterTargetPoolIds(table, casterId, targetSide){
  return allCharacterIds(table);
}

// A Mini-Party member has no position of its own — it rides on its Player's
// Tile — so a composite 'mp:' id falls back to the owning Player's position.
export function resolvePositionRef(table, targetId){
  if(!targetId || !table) return null;
  if(targetId.startsWith('mp:')){
    const [, pid] = targetId.split(':');
    return (table.positions && table.positions[pid]) || null;
  }
  return (table.positions && table.positions[targetId]) || null;
}

// Which side a resolved target actually belongs to — for Block-registry
// matching (a Block is registered under the owner's real side, not the
// attacker's opposite side — matters now that a Player can target another Player).
export function ownerTypeOf(table, targetId){
  if(!targetId) return null;
  if(targetId.startsWith('mp:')) return 'player';
  if(table.players && table.players[targetId]) return 'player';
  if(table.enemies && table.enemies[targetId]) return 'enemy';
  return null;
}

// Generic flash-then-fade status text, for a "Saved"-style confirmation
// without a permanently-visible line. Errors stick around (no fade timer)
// until the next non-error call clears them.
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

// Full, unabbreviated action name for Ledger display — the sequence entry's
// own actionLabel ('FA', 'GB', etc.) stays short for the Sequencer ruler; the
// Ledger reads better spelled out.
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

// Power buckets into a small Damage value once it's inflicting Wounds — a raw
// 0-50 Power stat straight into a 3-8 Wounds pool would one/two-shot
// everything, defeating a Hit%-based exposure system. ~10 Power per Damage
// tier; Power vs Flow is unaffected, this only applies post-Flow-break.
export function powerToDamage(power){
  return Math.max(0, Math.ceil((power || 0) / 10));
}
