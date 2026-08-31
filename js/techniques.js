import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml, timeNow, genId, isDeathWounded, resolveEntityRef, resolvePositionRef, crafterTargetPoolIds, showBannerError, pendingMessageGlyphs } from './utils.js';
import { openPanel, closePanel } from './panels.js';
import { getDistance, hasLineOfSight } from './map.js';
import { MAX_MINI_PARTY } from './possession.js';
import { activeActorId } from './activeCharacter.js';

// Data-driven so adding a new Technique later is just a new entry — no new
// staging/undo/cost-checking code needed, the engine below is generic over
// whatever `costs` a Technique lists. Loads from data/techniques.json instead
// of a hardcoded literal, authored in bulk via the spreadsheet pipeline (see
// tools/). Effects are text-only for now except Separation's Map Obstacle,
// which is simple/deterministic enough to actually implement. Top-level
// await: nothing that imports TECHNIQUES can run before it's real data.
// Each entry gets its own key threaded onto itself so hasTechniqueAccess()
// below can look a Character's techniqueAccess up by the Technique's own id.
const TECHNIQUES_RAW = await fetch('/data/techniques.json').then(r => r.json());
export const TECHNIQUES = Object.fromEntries(
  Object.entries(TECHNIQUES_RAW).map(([key, def]) => [key, { ...def, key }])
);

// Message's Glyph picker — its own independent fetch of the Glyphic System.
// Sorted into Category groups; only Directions has real content right now —
// "Other" is every remaining Glyph, labeled by its own id since most don't have a plain-English name yet.
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

// SUU (Stop), KULOG (Wander), and KALAG (Face) read as Movement Commands the
// same way the 4 Directions do, even though none is itself a compass
// direction — grouped into the same "Movement" optgroup rather than the flat "Other" catch-all.
const MOVEMENT_EXTRA_IDS = ['SUU', 'KULOG', 'KALAG'];

const RESOURCE_LABELS = { ap: 'AP', focus: 'Focus', flow: 'Flow', lightning: 'Lightning', lava: 'Lava' };

// One explicit boolean per real Technique key (data/characters.json), not
// category-level. A Character with NO techniqueAccess object defaults fully
// open (Mini-Party members, saved custom templates); one that HAS an object
// but omits a specific key defaults closed.
export function hasTechniqueAccess(actor, def){
  const access = actor && actor.techniqueAccess;
  if(!access) return true;
  return access[def && def.key] ?? false;
}

// Flow isn't a per-round "spent" pool like AP/Focus — it's the actor's real,
// persistent Flow, same value combat damage drains and Recovery rebuilds.
// Lightning/Lava get a per-round spent pool, same shape as focusSpent.
// Exported — dm.js's own Craft staging reuses this against an Enemy actor.
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

// Every real Character at the table is targetable — crafterTargetPoolIds()
// in utils.js is the one place that decision lives; selfOnly-flagged
// Techniques are the one exception, handled in craftPopup.js.
function targetPoolIds(table, casterId, def){
  return crafterTargetPoolIds(table, casterId, def.targetSide);
}

// `presetTargetId` is set here, before anything reads tu-target — assigning
// .value directly doesn't fire a real 'change' event, so setting it inline
// (rather than after the fact) is what lets Influence's own picker (below)
// know the right Target from the moment this panel opens via craftPopup.js's
// Map hand-off.
//
// Actor-generic since 2026-08-30 — activeActorId() (js/activeCharacter.js)
// resolves to the Player outside Yom Mode same as always, or whoever's
// Active inside it. This one panel is now the real Technique-casting
// surface for anyone, not a Player-only thing with a separate DM-only copy
// duplicating its cost/range/Glyph-picker logic — dDd's own call, after the
// two interfaces drifted and Yom Mode's copy broke first.
export function openTechniqueUse(key, presetTargetId){
  const def = TECHNIQUES[key];
  if(!def) return;
  const casterId = activeActorId();
  const table = AppState.table;
  const me = casterId && resolveEntityRef(table, casterId);
  if(!me){ showBannerError('No Active Character to cast as yet.'); return; }
  if(!hasTechniqueAccess(me, def)){ showBannerError('This Character doesn’t have access to this Technique.'); return; }
  currentTechniqueKey = key;

  document.getElementById('tu-name').textContent = def.name;
  document.getElementById('tu-type').textContent = def.type + ' — ' + def.group + ' / ' + def.column;
  document.getElementById('tu-cost').textContent = costText(def.costs);
  document.getElementById('tu-range').textContent = def.range;
  document.getElementById('tu-effect').textContent = def.effect;

  const myPos = table.positions && table.positions[casterId];
  const targets = targetPoolIds(table, casterId, def)
    .map(id => ({ id, entity: resolveEntityRef(table, id) }))
    .filter(t => t.entity && !isDeathWounded(t.entity));

  const targetSelect = document.getElementById('tu-target');
  targetSelect.innerHTML = targets.length
    ? targets.map(({ id, entity }) => {
        const pos = resolvePositionRef(table, id);
        let suffix = '', disabled = '';
        if(myPos && pos && table.map){
          // Shadow Possession Link: "0 Range works on anything with a
          // Current." A target already linked to this Caster ignores Range
          // on every Technique, not just Current itself — only the very first ignition needs real proximity.
          const linked = entity.shadowLinkedBy && entity.shadowLinkedBy.includes(casterId);
          const dist = getDistance(myPos, pos);
          if(!linked && dist > def.range){ suffix = ' (out of Range: ' + dist + ')'; disabled = 'disabled'; }
          else if(!hasLineOfSight(table, myPos, pos)){ suffix = ' (no line of sight)'; disabled = 'disabled'; }
        }
        return '<option value="' + id + '" ' + disabled + '>' + escapeHtml(entity.name || 'Unnamed') + suffix + '</option>';
      }).join('')
    : '<option value="">No Characters to target</option>';
  if(presetTargetId && targets.some(t => t.id === presetTargetId)) targetSelect.value = presetTargetId;

  // Message's Glyph picker — only Message needs it, up to 3 Glyphs at once.
  // Slot 1 is required, slots 2/3 are optional.
  const glyphField = document.getElementById('tu-glyph-field');
  if(key === 'message' && GLYPH_DATA){
    glyphField.classList.remove('hidden');
    document.getElementById('tu-glyph-1').innerHTML = glyphOptionsHtml(false);
    document.getElementById('tu-glyph-2').innerHTML = glyphOptionsHtml(true);
    document.getElementById('tu-glyph-3').innerHTML = glyphOptionsHtml(true);
  }else{
    glyphField.classList.add('hidden');
  }

  // Influence's own picker depends on which Target is picked, so it
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

// Influence's "which Information" picker — Glyphs the Target already has in
// their real Mindeye, grouped separately from Glyphs currently
// staged-but-undelivered via a pending Message ("Information can be
// delivered already preloaded with bias"). Resolution runs Influence
// strictly after Message deliveries land the same Round, so picking a
// pending Glyph here reliably finds a real Mindeye entry by then.
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
// menu, so "Acting As" an Enemy gets the exact same picker.
// `includeEmpty` adds a leading "— none —" option for the 2nd/3rd optional
// picker slots; the 1st slot stays required.
// `selectedValue` lets a caller pre-select an option instead of always
// defaulting to the first one (the Script builder shouldn't wipe itself on
// every re-render) — optional, every other caller behaves as before.
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

// Anybody can stage any Technique — no ownership/unlock gating (for
// testing purposes) — but the resource cost still has to be affordable, same
// as every other staged Combat action.
//
// `explicitTargetId` lets a second door into this same function skip the
// sidebar's own tu-target dropdown entirely — the Active Character Display's
// Essence button (js/dm.js's quick-cast popover, 2026-08-30) stages directly
// off a Map click instead. Same cost/range/order logic either way, just a
// second way to reach it — dDd's own framing: RTS games routinely have a
// button menu AND a right-click/context menu for the same command.
export async function stageTechnique(explicitTargetId){
  const def = TECHNIQUES[currentTechniqueKey];
  if(!def) return;
  const casterId = activeActorId();
  const me = casterId && resolveEntityRef(AppState.table, casterId);
  if(!me) return;
  if(!hasTechniqueAccess(me, def)){ showBannerError('This Character doesn’t have access to this Technique.'); return; }

  const targetId = explicitTargetId || document.getElementById('tu-target').value;
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

  // Every Technique is stageable outside an Encounter through the same
  // stage-then-resolve Order flow Move uses (noncombat.js's
  // resolveNonCombatRound()), not the AP-tracked Combat sequence below. A
  // Technique with no real Non-Combat resolution logic just logs the same
  // "not yet mechanically resolved" placeholder Combat falls back to.
  // Non-Combat doesn't scale to AP, so AP costs are skipped here; every
  // other resource cost is still charged immediately at staging, same as Combat.
  if(!AppState.table.inEncounter){
    for(const [resource, amount] of Object.entries(def.costs)){
      if(resource === 'ap') continue;
      if(remaining(me, resource) < amount){ showBannerError('Not enough ' + RESOURCE_LABELS[resource] + ' left.'); return; }
    }
    await mutateTable(t => {
      const actor = resolveEntityRef(t, casterId);
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
        // Resolved strictly after Message deliveries land the same Round, so
        // a Glyph picked from "Pending (staged Message)" reliably finds a real Mindeye entry by then.
        actor.orders.push({ id: genId(), kind: 'influence', targetId, targetName: target.name, glyph: influenceGlyph, axis: influenceAxis, direction: influenceDirection });
        t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' orders Influence on ' + target.name + ' (' + influenceGlyph + ')', time: timeNow() });
      }else{
        // Generic Non-Combat Order — every other Technique stages the same way.
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

  const myPos = AppState.table.positions && AppState.table.positions[casterId];
  const targetPos = resolvePositionRef(AppState.table, targetId);
  if(myPos && targetPos){
    // Shadow Possession Link bypasses Range — see the matching note in openTechniqueUse above.
    const linked = target.shadowLinkedBy && target.shadowLinkedBy.includes(casterId);
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
    const actor = resolveEntityRef(t, casterId);
    if(!actor.sequence) actor.sequence = [];
    const entry = {
      kind: 'technique', techniqueKey: currentTechniqueKey, actionLabel: def.name,
      targetId, targetName: target.name, targetLabel: def.name.slice(0, 2).toUpperCase(),
      apCost: def.costs.ap || 0, focusCost: def.costs.focus || 0,
      flowCost: def.costs.flow || 0, lightningCost: def.costs.lightning || 0, lavaCost: def.costs.lava || 0,
      // Message's Glyphs ride along on the entry itself — delivery happens
      // in resolveRound(), matching how Non-Combat's own Message Order
      // already deferred correctly.
      glyphs: currentTechniqueKey === 'message' ? glyphIds : undefined,
      // Influence's own picked Glyph/Axis/Direction — same "resolved after Message lands" deferral, in resolveRound().
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

// The quick-cast door (js/dm.js's Essence popover on the Active Character
// Display) — Message and Influence still need their own real fields
// (Glyphs; Glyph+Axis+Direction), so those two open the full sidebar same as
// the Map's Craft popup does, preset to the Character already clicked.
// Everything else stages directly off the click, no panel needed.
export async function quickStageTechnique(key, targetId){
  if(key === 'message' || key === 'influence'){
    openTechniqueUse(key, targetId);
    return;
  }
  currentTechniqueKey = key;
  await stageTechnique(targetId);
}

// Every real Craft/Power the given actor has access to — shared by the
// Techniques Panel's own greying-out logic and the Essence quick-cast
// popover, so "what can this Character cast" is computed one place.
export function craftsAndPowersFor(actor){
  return Object.entries(TECHNIQUES).filter(([, def]) =>
    (def.group === 'Craft' || def.group === 'Powers') && hasTechniqueAccess(actor, def)
  );
}

export function initTechniquesUI(){
  document.querySelectorAll('.tech-item[data-technique]').forEach(btn => {
    btn.addEventListener('click', () => openTechniqueUse(btn.dataset.technique));
  });
  document.getElementById('btn-tu-stage').addEventListener('click', () => stageTechnique());
}

// Greys out + crosses through any Technique the currently Active Character
// doesn't have access to — call on every render so it stays live as
// Create-a-Character's toggles change, or as Yom Mode switches who's Active.
export function renderTechniquesPanel(){
  const casterId = activeActorId();
  const me = casterId && AppState.table && resolveEntityRef(AppState.table, casterId);
  document.querySelectorAll('.tech-item[data-technique]').forEach(btn => {
    const def = TECHNIQUES[btn.dataset.technique];
    const granted = hasTechniqueAccess(me, def);
    btn.classList.toggle('tech-denied', !granted);
    btn.disabled = !granted;
  });
}
