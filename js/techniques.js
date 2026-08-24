import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml, timeNow, genId, isDeathWounded, resolveEntityRef, resolvePositionRef, crafterTargetPoolIds, showBannerError, pendingMessageGlyphs } from './utils.js';
import { openPanel, closePanel } from './panels.js';
import { getDistance, hasLineOfSight } from './map.js';
import { MAX_MINI_PARTY } from './possession.js';

// Data-driven so adding a new Technique later is just a new entry — no new
// staging/undo/cost-checking code needed, the engine below is generic over
// whatever `costs` a Technique lists. Engine built 2026-08-16; loads from
// data/techniques.json (2026-08-16, same night, alongside Character
// Templates) instead of a hardcoded literal, so it can be authored in bulk
// via the same spreadsheet pipeline as Characters. Effects are text-only for
// now (not mechanically resolved) except Separation's Map Obstacle, which is
// simple/deterministic enough to actually implement. Top-level await: this
// module won't finish evaluating until the fetch resolves — nothing that
// imports TECHNIQUES can run before it's real data.
export const TECHNIQUES = await fetch('/data/techniques.json').then(r => r.json());

// Message's Glyph picker (2026-08-21, per dDd) — its own independent fetch
// of the Glyphic System, same pattern js/information.js already uses (no
// shared loader module for this yet). Sorted into Category groups; only
// Directions has real content right now, per dDd — "Other" is every
// remaining Glyph in the file, labeled by its own id since most don't have
// a plain-English name yet.
let GLYPH_DATA = null;
try {
  const glyphRes = await fetch('/language/gomsdu-glyphic-system.json');
  GLYPH_DATA = await glyphRes.json();
} catch (err) {
  GLYPH_DATA = null;
}
const DIRECTION_GLYPHS = [
  { id: 'RO / OR', label: 'RO — Up / Forward' },
  { id: 'OP / PO', label: 'OP — Down / Back' },
  { id: 'OK', label: 'OK — Left' },
  { id: 'KO', label: 'KO — Right' }
];

// Movement Category (2026-08-22, per dDd) — SUU (Stop), KULOG (Wander), and
// KALAG (Face) read as Movement Commands the same way the 4 Directions do,
// even though none of them is itself a compass direction — grouped into the
// same "Movement" optgroup below rather than left in the flat "Other"
// catch-all, so a Script/Message author can actually find them.
const MOVEMENT_EXTRA_IDS = ['SUU', 'KULOG', 'KALAG'];

const RESOURCE_LABELS = { ap: 'AP', focus: 'Focus', flow: 'Flow', lightning: 'Lightning', lava: 'Lava' };

// Technique Lists (2026-08-16) — per-Character access, but at the category
// level dDd asked for (Flow Powers/Focus Powers/Lightning Crafts/Lava
// Crafts), not per-individual-Technique. Reuses each TECHNIQUES entry's
// existing group/column metadata rather than adding a redundant field.
// Missing techniqueAccess (every pre-existing Character) defaults to full
// access — this is the first real gate past "anybody can Technique anybody,
// for Testing purposes," not a retroactive lockout.
const CATEGORY_BY_COLUMN = { Flow: 'flowPowers', Focus: 'focusPowers', Lightning: 'lightningCrafts', Lava: 'lavaCrafts' };
export function hasCategoryAccess(actor, def){
  // Mastery (2026-08-23, per dDd — "it's just Yom") — exclusive to Yom's own
  // archetype specifically, not the general techniqueAccess flag system the
  // other columns use, and not gated by category:'deity' either — Gom and
  // Kulkrow are also category:'deity' (see data/characters.json) but have no
  // claim on Master Techniques. Seed itself is never manually cast through
  // this gate in practice (js/scenes.js's seedScene() invokes it directly);
  // this exists so the gate is still correct if anything else ever checks it.
  if(def && def.column === 'Mastery') return !!(actor && actor.archetype === 'Yom');
  const catKey = def && CATEGORY_BY_COLUMN[def.column];
  if(!catKey) return true;
  const access = actor && actor.techniqueAccess;
  return access ? (access[catKey] ?? true) : true;
}

// Flow isn't a per-round "spent" pool like AP/Focus — it's the actor's real,
// persistent Flow, same value combat damage already drains and Recovery
// rebuilds. Lightning/Lava get a new per-round spent pool, same shape as focusSpent.
// Exported — dm.js's own Craft staging (the DM Panel's Essence menu) reuses
// this against an Enemy actor, same field shape as a Player.
export function remaining(actor, resource){
  if(resource === 'flow') return actor.flow || 0;
  if(resource === 'ap') return (actor.ap || 0) - (actor.apSpent || 0);
  if(resource === 'focus') return (actor.focus || 0) - (actor.focusSpent || 0);
  if(resource === 'lightning') return (actor.lightning || 0) - (actor.lightningSpent || 0);
  if(resource === 'lava') return (actor.lava || 0) - (actor.lavaSpent || 0);
  return 0;
}

export function costText(costs){
  return Object.entries(costs).map(([r, amt]) => amt + ' ' + RESOURCE_LABELS[r]).join(', ');
}

let currentTechniqueKey = null;

// Which pool a Technique's target picker draws from — every real Character
// at the table, Player or Enemy (2026-08-22, per dDd: "targetSide should not
// even exist really, all Characters have to be able to be targeted by all
// Crafts and Powers" — crafterTargetPoolIds() in js/utils.js is the one
// place that decision lives; selfOnly-flagged Techniques are the one real
// exception, handled separately in js/craftPopup.js).
function targetPoolIds(table, def){
  return crafterTargetPoolIds(table, AppState.playerId, def.targetSide);
}

// `presetTargetId` (2026-08-22) — js/craftPopup.js's Map hand-off used to
// set tu-target's value *after* this function returned, which silently
// never refreshed anything that reads the Target at open-time (found live
// while building Influence's own picker below, which needs a real Target
// to know whose Mindeye/pending Messages to offer) — assigning .value in
// JS doesn't fire a real 'change' event, so nothing downstream ever knew.
// Setting it in here instead, before anything reads it, fixes that
// structurally rather than patching around it with a synthetic event.
export function openTechniqueUse(key, presetTargetId){
  const def = TECHNIQUES[key];
  if(!def) return;
  const me = AppState.table && AppState.table.players[AppState.playerId];
  if(!hasCategoryAccess(me, def)){ showBannerError('Your Character doesn’t have access to this Technique.'); return; }
  currentTechniqueKey = key;

  document.getElementById('tu-name').textContent = def.name;
  document.getElementById('tu-type').textContent = def.type + ' — ' + def.group + ' / ' + def.column;
  document.getElementById('tu-cost').textContent = costText(def.costs);
  document.getElementById('tu-range').textContent = def.range;
  document.getElementById('tu-effect').textContent = def.effect;

  const table = AppState.table;
  const myPos = table.positions && table.positions[AppState.playerId];
  const targets = targetPoolIds(table, def)
    .map(id => ({ id, entity: resolveEntityRef(table, id) }))
    .filter(t => t.entity && !isDeathWounded(t.entity));

  const targetSelect = document.getElementById('tu-target');
  targetSelect.innerHTML = targets.length
    ? targets.map(({ id, entity }) => {
        const pos = resolvePositionRef(table, id);
        let suffix = '', disabled = '';
        if(myPos && pos && table.map){
          // Shadow Possession Link (2026-08-23, per dDd) — "0 Range works on
          // anything with a Current." A target already linked to this Player
          // ignores Range entirely on every Technique, not just Current
          // itself; only the very first ignition (no Link yet) needs real
          // proximity.
          const linked = entity.shadowLinkedBy && entity.shadowLinkedBy.includes(AppState.playerId);
          const dist = getDistance(myPos, pos);
          if(!linked && dist > def.range){ suffix = ' (out of Range: ' + dist + ')'; disabled = 'disabled'; }
          else if(!hasLineOfSight(table, myPos, pos)){ suffix = ' (no line of sight)'; disabled = 'disabled'; }
        }
        return '<option value="' + id + '" ' + disabled + '>' + escapeHtml(entity.name || 'Unnamed') + suffix + '</option>';
      }).join('')
    : '<option value="">No Characters to target</option>';
  if(presetTargetId && targets.some(t => t.id === presetTargetId)) targetSelect.value = presetTargetId;

  // Message's Glyph picker (2026-08-21, up to 3 at once as of 2026-08-22 per
  // dDd — the first draft of sending a Script's-worth of instructions in one
  // go) — only Message needs it; every other Technique keeps the field
  // hidden. Slot 1 is required (no empty option), slots 2/3 are optional.
  const glyphField = document.getElementById('tu-glyph-field');
  if(key === 'message' && GLYPH_DATA){
    glyphField.classList.remove('hidden');
    document.getElementById('tu-glyph-1').innerHTML = glyphOptionsHtml(false);
    document.getElementById('tu-glyph-2').innerHTML = glyphOptionsHtml(true);
    document.getElementById('tu-glyph-3').innerHTML = glyphOptionsHtml(true);
  }else{
    glyphField.classList.add('hidden');
  }

  // Influence's own picker (2026-08-22, per dDd, after playtesting — "The
  // Influence Craft needs a way to be able to select: Information a
  // Character already knows [or] Information a Character is going to know
  // (via Message Staging)"). Depends on which Target is picked, so it
  // refreshes on tu-target's own change — re-set here (not additive) since
  // openTechniqueUse can run again for a different Technique.
  const influenceField = document.getElementById('tu-influence-field');
  if(key === 'influence'){
    influenceField.classList.remove('hidden');
    const refreshInfluenceGlyphs = () => {
      document.getElementById('tu-influence-glyph').innerHTML = influenceGlyphOptionsHtml(AppState.table, targetSelect.value);
    };
    refreshInfluenceGlyphs();
    targetSelect.onchange = refreshInfluenceGlyphs;
  }else{
    influenceField.classList.add('hidden');
    targetSelect.onchange = null;
  }

  openPanel('technique-use');
}

// Influence's "which Information" picker (2026-08-22, per dDd) — Glyphs the
// Target already has in their real Mindeye, grouped separately from Glyphs
// currently staged-but-undelivered to them via a pending Message
// (js/utils.js's pendingMessageGlyphs) — "Information can be delivered
// already preloaded with bias." Resolution (js/noncombat.js/js/combat.js)
// runs Influence strictly after Message deliveries land the same Round, so
// picking a pending Glyph here reliably finds a real Mindeye entry by then.
function influenceGlyphOptionsHtml(table, targetId){
  const target = resolveEntityRef(table, targetId);
  const known = [...new Set(((target && target.mindeye) || []).map(e => e.glyph).filter(Boolean))];
  const pending = pendingMessageGlyphs(table, targetId).filter(g => !known.includes(g));
  if(!known.length && !pending.length) return '<option value="">No Information to select yet</option>';
  let html = '<option value="">— pick Information —</option>';
  if(known.length) html += '<optgroup label="Already Knows">' + known.map(g => '<option value="' + escapeHtml(g) + '">' + escapeHtml(g) + '</option>').join('') + '</optgroup>';
  if(pending.length) html += '<optgroup label="Pending (staged Message)">' + pending.map(g => '<option value="' + escapeHtml(g) + '">' + escapeHtml(g) + '</option>').join('') + '</optgroup>';
  return html;
}

// Shared Directions/Other optgroup markup for Message's Glyph picker — used
// by the Player-facing Technique Use panel above and the DM's own Essence
// menu (js/dm.js), so "Acting As" an Enemy gets the exact same picker
// instead of always sending the RO/OR default.
// `includeEmpty` (2026-08-22, per dDd — Message now sends up to 3 Glyphs at
// once) adds a leading "— none —" option, for the 2nd/3rd optional picker
// slots; the 1st slot stays required, same as before.
// `selectedValue` (2026-08-23, per dDd — the Script builder shouldn't wipe
// itself on every re-render) lets a caller pre-select an option instead of
// always defaulting to the first one. Optional — every existing caller
// passing just `includeEmpty` behaves exactly as before.
export function glyphOptionsHtml(includeEmpty, selectedValue){
  if(!GLYPH_DATA) return '';
  const sel = (id) => id === selectedValue ? ' selected' : '';
  const movementIds = DIRECTION_GLYPHS.map(d => d.id).concat(MOVEMENT_EXTRA_IDS);
  const movementExtras = MOVEMENT_EXTRA_IDS
    .map(id => GLYPH_DATA.glyphs.find(g => g.id === id))
    .filter(Boolean);
  const otherGlyphs = GLYPH_DATA.glyphs.filter(g => !movementIds.includes(g.id));
  const empty = includeEmpty ? '<option value=""' + sel('') + '>— none —</option>' : '';
  return empty + '<optgroup label="Movement">' +
      DIRECTION_GLYPHS.map(d => '<option value="' + escapeHtml(d.id) + '"' + sel(d.id) + '>' + escapeHtml(d.label) + '</option>').join('') +
      movementExtras.map(g => '<option value="' + escapeHtml(g.id) + '"' + sel(g.id) + '>' + escapeHtml(g.id) + '</option>').join('') +
    '</optgroup>' +
    '<optgroup label="Other">' +
      otherGlyphs.map(g => '<option value="' + escapeHtml(g.id) + '"' + sel(g.id) + '>' + escapeHtml(g.id) + '</option>').join('') +
    '</optgroup>';
}

// Anybody can stage any Technique — no ownership/unlock gating (per dDd:
// "for Testing purposes") — but the resource cost itself still has to be
// affordable, same as every other staged Combat action.
export async function stageTechnique(){
  const def = TECHNIQUES[currentTechniqueKey];
  if(!def) return;
  const me = AppState.table.players[AppState.playerId];
  if(!me) return;
  if(!hasCategoryAccess(me, def)){ showBannerError('Your Character doesn’t have access to this Technique.'); return; }

  const targetId = document.getElementById('tu-target').value;
  const target = resolveEntityRef(AppState.table, targetId);
  if(!target || isDeathWounded(target)){ showBannerError('Pick a target first.'); return; }
  const glyphIds = currentTechniqueKey === 'message'
    ? [1, 2, 3].map(n => document.getElementById('tu-glyph-' + n).value).filter(Boolean)
    : null;
  let influenceGlyph = null, influenceAxis = null, influenceDirection = null;
  if(currentTechniqueKey === 'influence'){
    influenceGlyph = document.getElementById('tu-influence-glyph').value;
    influenceAxis = document.getElementById('tu-influence-axis').value;
    influenceDirection = document.getElementById('tu-influence-direction').value;
    if(!influenceGlyph){ showBannerError('Pick which Information to Influence first.'); return; }
  }

  // Non-Combat Round (2026-08-21, per dDd) — every Technique is stageable
  // outside an Encounter through the same stage-then-resolve Order flow Move
  // uses (js/noncombat.js's resolveNonCombatRound()), not the AP-tracked
  // Combat sequence below. The old NONCOMBAT_TECHNIQUES allow-list (2026-08-23,
  // per dDd: "close the distinction between Combat and Non-Combat Techniques/
  // Powers... it doesn't do anything on the front-end") is gone — a
  // Technique with no real Non-Combat resolution logic just logs the same
  // "not yet mechanically resolved" placeholder Combat already falls back to
  // (js/noncombat.js's processOrders), instead of being blocked outright.
  // Non-Combat doesn't scale to AP, per dDd, so AP costs are skipped
  // entirely here; every other resource cost is still charged immediately
  // at staging, same as Combat.
  if(!AppState.table.inEncounter){
    for(const [resource, amount] of Object.entries(def.costs)){
      if(resource === 'ap') continue;
      if(remaining(me, resource) < amount){ showBannerError('Not enough ' + RESOURCE_LABELS[resource] + ' left.'); return; }
    }
    await mutateTable(t => {
      const actor = t.players[AppState.playerId];
      Object.entries(def.costs).forEach(([resource, amount]) => {
        if(resource === 'ap') return;
        if(resource === 'flow') actor.flow = Math.max(0, (actor.flow || 0) - amount);
        else actor[resource + 'Spent'] = (actor[resource + 'Spent'] || 0) + amount;
      });
      if(!actor.orders) actor.orders = [];
      if(currentTechniqueKey === 'message'){
        actor.orders.push({ id: genId(), kind: 'message', targetId, targetName: target.name, glyphs: glyphIds });
        t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' orders a Message to ' + target.name + ' (' + glyphIds.length + ' Glyph' + (glyphIds.length === 1 ? '' : 's') + ')', time: timeNow() });
      }else if(currentTechniqueKey === 'channel'){
        actor.orders.push({ id: genId(), kind: 'channel' });
        t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' orders a Channel', time: timeNow() });
      }else if(currentTechniqueKey === 'influence'){
        // Influence (2026-08-22, per dDd) — carries which Glyph/Axis/
        // Direction to adjust. Resolved strictly after Message deliveries
        // land the same Round (js/noncombat.js's processOrders), so a Glyph
        // picked from "Pending (staged Message)" reliably finds a real
        // Mindeye entry by the time this runs.
        actor.orders.push({ id: genId(), kind: 'influence', targetId, targetName: target.name, glyph: influenceGlyph, axis: influenceAxis, direction: influenceDirection });
        t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' orders Influence on ' + target.name + ' (' + influenceGlyph + ')', time: timeNow() });
      }else{
        // Generic Non-Combat Order (2026-08-22, per dDd) — every other
        // Technique stages the same way. This used to be a hard if/else
        // between exactly Message and Channel — adding Empower without
        // generalizing it would have silently pushed a wrong-shaped
        // Channel-style order instead.
        actor.orders.push({ id: genId(), kind: currentTechniqueKey, targetId, targetName: target.name });
        t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' orders ' + def.name + ' on ' + target.name, time: timeNow() });
      }
    });
    closePanel();
    return;
  }

  if(currentTechniqueKey === 'possess' && (me.miniParty || []).length >= MAX_MINI_PARTY){
    showBannerError('Your Mini-Party is already full (' + MAX_MINI_PARTY + ') — Possession would exceed it.');
    return;
  }

  const myPos = AppState.table.positions && AppState.table.positions[AppState.playerId];
  const targetPos = resolvePositionRef(AppState.table, targetId);
  if(myPos && targetPos){
    // Shadow Possession Link bypasses Range — see the matching note in
    // openTechniqueUse above.
    const linked = target.shadowLinkedBy && target.shadowLinkedBy.includes(AppState.playerId);
    const dist = getDistance(myPos, targetPos);
    if(!linked && dist > def.range){ showBannerError('Target is out of Range (' + dist + ' > ' + def.range + ').'); return; }
    if(!hasLineOfSight(AppState.table, myPos, targetPos)){ showBannerError('No line of sight to target.'); return; }
  }

  for(const [resource, amount] of Object.entries(def.costs)){
    if(remaining(me, resource) < amount){
      showBannerError('Not enough ' + RESOURCE_LABELS[resource] + ' left.');
      return;
    }
  }

  await mutateTable(t => {
    const actor = t.players[AppState.playerId];
    if(!actor.sequence) actor.sequence = [];
    const entry = {
      kind: 'technique', techniqueKey: currentTechniqueKey, actionLabel: def.name,
      targetId, targetName: target.name, targetLabel: def.name.slice(0, 2).toUpperCase(),
      apCost: def.costs.ap || 0, focusCost: def.costs.focus || 0,
      flowCost: def.costs.flow || 0, lightningCost: def.costs.lightning || 0, lavaCost: def.costs.lava || 0,
      // Message's Glyphs ride along on the entry itself now (2026-08-22, per
      // dDd: "Messages shouldn't arrive as Information until the Resolve")
      // — delivery moved to resolveRound() (js/combat.js), matching how
      // Non-Combat's own Message Order already deferred correctly.
      glyphs: currentTechniqueKey === 'message' ? glyphIds : undefined,
      // Influence's own picked Glyph/Axis/Direction (2026-08-22) — same
      // "resolved after Message lands" deferral, in resolveRound().
      influenceGlyph: currentTechniqueKey === 'influence' ? influenceGlyph : undefined,
      influenceAxis: currentTechniqueKey === 'influence' ? influenceAxis : undefined,
      influenceDirection: currentTechniqueKey === 'influence' ? influenceDirection : undefined
    };
    actor.sequence.push(entry);
    actor.apSpent = (actor.apSpent || 0) + entry.apCost;
    actor.focusSpent = (actor.focusSpent || 0) + entry.focusCost;
    actor.lightningSpent = (actor.lightningSpent || 0) + entry.lightningCost;
    actor.lavaSpent = (actor.lavaSpent || 0) + entry.lavaCost;
    if(entry.flowCost) actor.flow = Math.max(0, (actor.flow || 0) - entry.flowCost);
    t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' stages ' + def.name + ' on ' + target.name, time: timeNow() });
  });

  closePanel();
}

export function initTechniquesUI(){
  document.querySelectorAll('.tech-item[data-technique]').forEach(btn => {
    btn.addEventListener('click', () => openTechniqueUse(btn.dataset.technique));
  });
  document.getElementById('btn-tu-stage').addEventListener('click', stageTechnique);
}

// Greys out + crosses through any Technique whose category the current
// Player's Character doesn't have access to, per dDd's spec — call on every
// render so it stays live as Create-a-Character's toggles change.
export function renderTechniquesPanel(){
  const me = AppState.table && AppState.table.players[AppState.playerId];
  document.querySelectorAll('.tech-item[data-technique]').forEach(btn => {
    const def = TECHNIQUES[btn.dataset.technique];
    const granted = hasCategoryAccess(me, def);
    btn.classList.toggle('tech-denied', !granted);
    btn.disabled = !granted;
  });
}
