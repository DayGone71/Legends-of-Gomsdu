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

// Shared error banner (2026-08-22, per dDd's Lists-consolidation go-ahead —
// this was the same "redundant, not the same as the important one" pattern
// he flagged, just for a UI helper rather than a Character list: an
// identical byte-for-byte copy independently defined in js/combat.js,
// js/dm.js, js/map.js, and js/techniques.js). One shared version here now.
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
  return (table.players && table.players[targetId]) || (table.enemies && table.enemies[targetId]) ||
    (table.characters && table.characters[targetId]) || null;
}

// Personality/Head's first Axis (2026-08-21, per dDd's Notebook) — for now,
// Intelligence just governs how many Expressions (Mindeye entries) a
// Character can remember at once. Lives here, not personality.js, so
// deliverMindeyeEntry (below) can enforce it without importing the panel.
// Rescaled 2026-08-22, per dDd: "1 Intelligence point granted 10 Memories,
// Gom having 10 Intelligence and the Living Stone 1" — Mindeye capacity is
// now the raw stat times 10, not a 1:1 count. Default dropped 3 → 1 to
// match "1 Intelligence for everything except Gom and Kulkrow is default"
// for First Era.
export const INTELLIGENCE_DEFAULT = 1;
export const MINDEYE_CAPACITY_PER_POINT = 10;
export function getIntelligence(actor){
  return (actor && actor.personality && actor.personality.head && actor.personality.head.intelligence) ?? INTELLIGENCE_DEFAULT;
}
export function mindeyeCapacity(actor){
  return getIntelligence(actor) * MINDEYE_CAPACITY_PER_POINT;
}

// The 4-stage Category lifecycle (2026-08-24, per dDd's full spec — see
// reference/dialogue-system.md's 2026-08-23 section, "The 4-stage Memory
// lifecycle"). A single continuous 0-100 Retention stat per Mindeye entry —
// Category is just which band it currently falls in, not a separate stored
// flag. Scoped strictly to Memory/Mindeye, per dDd: "the 100 is only for
// memory" — not reused for Personality Axes, Relationships, or anything else.
export const MINDEYE_RETENTION_PERFECTED = 100;
// `born`/innate deliveries (the seen=true case below) start Perfected
// outright — per dDd: "born being Born with it, learned in the Womb, pure
// instinct," converging to the same protected end state a climbed-to-100
// entry reaches. A real arrival starts inside the Retained band, not
// Fleeting — per dDd: "2 (Retained) should be most common," and nothing
// yet exists to actually climb a fresh entry out of Fleeting (decay and
// KA-reinforcement are both still unbuilt — see the ROADMAP.md item this
// closes part of), so starting there would just strand it.
const MINDEYE_RETENTION_BORN = 100;
const MINDEYE_RETENTION_DEFAULT = 40;
// Perfected (100) is a one-way door — per dDd: "Imprinting should only be
// able to be removed by advanced means (like a Technique designed for it).
// It wouldn't be subject to getting forgotten or downgraded in the
// Hierarchy." No Technique does that yet; this is the rule waiting for one.
export function mindeyeCategory(retention){
  const r = retention ?? MINDEYE_RETENTION_DEFAULT;
  if(r >= MINDEYE_RETENTION_PERFECTED) return 'Perfected';
  if(r >= 76) return 'Known';
  if(r >= 26) return 'Retained';
  return 'Fleeting';
}

// A Build's own startingMindeye, turned into real entries directly (2026-08-24)
// — js/character.js's spawnCharacter() uses this so every spawn path builds
// a Character's innate Mindeye the same way, in one pass, rather than each
// spawn function looping its own deliverMindeyeEntry() calls afterward.
// Detached from any table — the caller is the one assembling a fresh
// Character record, not mutating one that's already in table.players/
// table.enemies/table.characters yet.
export function bornMindeyeEntries(glyphIds){
  return (glyphIds || []).map(g => ({
    id: genId(), from: 'Star Father', glyph: g || null, seen: true,
    retention: MINDEYE_RETENTION_BORN, receivedAt: timeNow()
  }));
}

// Mindeye (2026-08-20) — where a Character's received Glyphs show up, per
// dDd. Called from inside a mutateTable draft, both from the Player-side
// Technique engine (techniques.js) and the DM's own Craft staging (dm.js),
// so Message works identically staged by either side. Just a single GI per
// arrival for now — Message has no content-authoring UI yet.
// `seen` (2026-08-23) — defaults false (a real arrival, triggers the
// Information panel's Spotlight reveal), but Innate knowledge delivered at
// spawn time (startingMindeye, js/scenes.js/js/dm.js) passes true: per dDd,
// "he shouldn't be getting every single Glyph he knows as new Information.
// It should all be there already, good to go" — no reveal moment for
// something a Character has simply always known, straight to the Gallery.
// Deliberately separate from `retention` (2026-08-24) above — `seen` gates
// the one-time reveal *animation*, `retention` gates the Category the
// Information Panel displays; they both happen to start "already settled"
// for the same born entries, but they're not the same concept.
export function deliverMindeyeEntry(table, targetId, fromName, glyphId, seen = false){
  const target = resolveEntityRef(table, targetId);
  if(!target) return;
  if(!target.mindeye) target.mindeye = [];
  const retention = seen ? MINDEYE_RETENTION_BORN : MINDEYE_RETENTION_DEFAULT;
  target.mindeye.push({ id: genId(), from: fromName, glyph: glyphId || null, seen, retention, receivedAt: timeNow() });
  // Capacity is Intelligence-gated. Forgetting-priority is the inverse of
  // Retention, not a separate mechanism (2026-08-24, per dDd — answers the
  // "tiered forgetting" question flagged in ROADMAP.md): the weakest-held
  // (lowest-Retention) entry goes first, ties broken oldest-first, rather
  // than a flat FIFO that treated everything as equally forgettable.
  // Perfected entries are exempt — per dDd, above, they "wouldn't be
  // subject to getting forgotten... in the Hierarchy" at all.
  const capacity = mindeyeCapacity(target);
  while(target.mindeye.length > capacity){
    const forgettable = target.mindeye.filter(e => (e.retention ?? MINDEYE_RETENTION_DEFAULT) < MINDEYE_RETENTION_PERFECTED);
    if(!forgettable.length) break; // everything left is Perfected — protected, stays over capacity.
    // Oldest-first tiebreak comes for free from scanning in array order
    // (push()-appended, so index order IS arrival order) and only replacing
    // on a strictly lower Retention — receivedAt is a locale time-of-day
    // string ("01:27 PM"), not chronologically sortable on its own, so this
    // avoids relying on it at all.
    let weakest = forgettable[0];
    forgettable.forEach(e => {
      if((e.retention ?? MINDEYE_RETENTION_DEFAULT) < (weakest.retention ?? MINDEYE_RETENTION_DEFAULT)) weakest = e;
    });
    target.mindeye.splice(target.mindeye.indexOf(weakest), 1);
  }
}

// Which Glyph IDs an actor actually knows (2026-08-23, per dDd — the
// knownGlyphs/mindeye merge: "There is no reason to keep them separate
// anymore... the important part is each Character knowing Glyphs."
// "Knowing" a Glyph now just means having a Mindeye entry for it — the
// separate knownGlyphs curriculum array is gone entirely. Anywhere that used
// to read actor.knownGlyphs directly (Face's direction-gating, Scripts'
// not-yet-enforced dispatch gate) reads this instead.
export function knownGlyphIds(actor){
  return [...new Set(((actor && actor.mindeye) || []).map(e => e.glyph).filter(Boolean))];
}

// Every Glyph currently staged (Message Orders on any Player/Enemy, or the
// DM's own Enemy-sequence staging) but not yet delivered to a given target —
// the "Information a Character is going to know" half of Influence's own
// targeting (2026-08-22, per dDd: "That way, Information can be delivered
// already preloaded with bias"). De-duplicated (a Set) since the same Glyph
// could be staged by more than one pending Message.
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

// Roster consolidation (2026-08-22, per dDd — "Lists that have vital Data
// but are redundant and not the same as the important one"). Before this,
// every list-building UI (Combat's Ally Range, the DM's Target Range, the
// NPC Panel, the DM's Enemy/Acting-As picker, the Script Panel's Actor/
// Target pickers) independently walked table.players/table.enemies/
// miniParty with its own near-identical filtering — the exact drift that
// left renderDMTargetRange() silently Player-only forever (see
// ROADMAP.md/CHANGELOG.md 2026-08-22). These three are now the ONE place
// that walk lives; everything else either calls one of these directly or
// derives its own id-only view from one. Each row carries `entity` (the
// live Character object itself), so a consumer can still pull whatever
// extra display fields it needs (wounds, archetype, ...) without this
// function having to anticipate every caller's own display shape.

// Every Player, plus their statted Mini-Party members (a Possessed one
// resolves to the real Enemy's own record; an un-statted stub — no base
// build, no wounds to track — is skipped, not a legitimate actor/target
// yet) — the "ally" side of a table, as {id, entity, name, dead, sub?} rows.
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

// Every real Enemy at the table, as {id, entity, name, dead} rows.
export function enemyRoster(table){
  return Object.entries((table && table.enemies) || {}).map(([id, e]) => ({
    id, entity: e, name: e.name || 'Enemy', dead: isDeathWounded(e)
  }));
}

// Every real Character living in the new Universal Characters Table
// (2026-08-24) — currently just Yom, its first tenant (see js/scenes.js's
// spawnYom()). table.players/table.enemies deliberately stay right where
// they are for now, per dDd's own "merge feature by feature, not a
// rewrite" call (reference/dialogue-system.md, 2026-08-22) — this is
// additive, not a replacement for either roster below.
export function charactersRoster(table){
  return Object.entries((table && table.characters) || {}).map(([id, c]) => ({
    id, entity: c, name: c.name || 'Character', dead: isDeathWounded(c)
  }));
}

// Every real Character at the table, all three buckets at once — the
// canonical "everybody" list (NPC Panel's inspect targets, Script Panel's
// Actor/Target pickers, DM Target Range now that targetSide no longer
// restricts it) — allied side first, then the Universal Table, then Enemies.
export function allCharacterRoster(table){
  return [...alliedRoster(table), ...charactersRoster(table), ...enemyRoster(table)];
}

// Id-only views over the same rosters, for callers that never needed the
// full row (crafterTargetPoolIds below, mainly).
export function alliedActorIds(table){
  return alliedRoster(table).map(r => r.id);
}
export function allCharacterIds(table){
  return allCharacterRoster(table).map(r => r.id);
}

// Crafter-relative targeting (2026-08-22, per dDd). Used to branch on
// targetSide/Combat-relative Ally-Enemy sides; simplified to a flat "every
// Character is targetable" per dDd's own call: "targetSide should not even
// exist really, all Characters have to be able to be targeted by all Crafts
// and Powers. selfTarget is the only exception we need to think about" — that
// exception is handled separately, by each Technique's own `selfOnly` flag
// (js/craftPopup.js), not by narrowing this pool. `casterId`/`targetSide`
// kept as accepted (unused) params so existing call sites don't need
// updating if a real self/other distinction ever comes back.
export function crafterTargetPoolIds(table, casterId, targetSide){
  return allCharacterIds(table);
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
