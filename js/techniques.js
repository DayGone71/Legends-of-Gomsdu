import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml, timeNow, genId, isDeathWounded, resolveEntityRef, resolvePositionRef, crafterTargetPoolIds } from './utils.js';
import { openPanel, closePanel } from './panels.js';
import { getDistance, hasLineOfSight } from './map.js';
import { MAX_MINI_PARTY } from './possession.js';

function showBannerError(msg){
  const el = document.getElementById('banner-error');
  if(!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

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

// Techniques stageable outside an Encounter (2026-08-21, per dDd), each
// going through the Non-Combat Order flow (js/noncombat.js's
// resolveNonCombatRound()) instead of the AP-tracked Combat sequence.
export const NONCOMBAT_TECHNIQUES = ['message', 'channel'];

// Technique Lists (2026-08-16) — per-Character access, but at the category
// level dDd asked for (Flow Powers/Focus Powers/Lightning Crafts/Lava
// Crafts), not per-individual-Technique. Reuses each TECHNIQUES entry's
// existing group/column metadata rather than adding a redundant field.
// Missing techniqueAccess (every pre-existing Character) defaults to full
// access — this is the first real gate past "anybody can Technique anybody,
// for Testing purposes," not a retroactive lockout.
const CATEGORY_BY_COLUMN = { Flow: 'flowPowers', Focus: 'focusPowers', Lightning: 'lightningCrafts', Lava: 'lavaCrafts' };
export function hasCategoryAccess(actor, def){
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

// Which pool a Technique's target picker draws from — now resolved relative
// to the actual Crafter (always the Player here — this panel is Player-only)
// via crafterTargetPoolIds() (js/utils.js), not a hardcoded "'ally' always
// means the Player roster" (2026-08-22, per dDd catching this live: "If Gom
// is an NPC than how can the Player be a valid target of that?"). Outside
// Combat, every real Character is reachable — Ally/Enemy is strictly a
// Combat concept — so this widens, harmlessly for now, exactly what an
// 'ally'-Technique's target list shows outside an Encounter; staging one
// there is still separately gated by NONCOMBAT_TECHNIQUES below.
function targetPoolIds(table, def){
  return crafterTargetPoolIds(table, AppState.playerId, def.targetSide);
}

export function openTechniqueUse(key){
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
  const isAlly = def.targetSide === 'ally';
  const targets = targetPoolIds(table, def)
    .map(id => ({ id, entity: resolveEntityRef(table, id) }))
    .filter(t => t.entity && !isDeathWounded(t.entity));

  const targetSelect = document.getElementById('tu-target');
  targetSelect.innerHTML = targets.length
    ? targets.map(({ id, entity }) => {
        const pos = resolvePositionRef(table, id);
        let suffix = '', disabled = '';
        if(myPos && pos && table.map){
          const dist = getDistance(myPos, pos);
          if(dist > def.range){ suffix = ' (out of Range: ' + dist + ')'; disabled = 'disabled'; }
          else if(!hasLineOfSight(table, myPos, pos)){ suffix = ' (no line of sight)'; disabled = 'disabled'; }
        }
        return '<option value="' + id + '" ' + disabled + '>' + escapeHtml(entity.name || 'Unnamed') + suffix + '</option>';
      }).join('')
    : '<option value="">' + (isAlly ? 'No Allies to target' : 'No enemies to target') + '</option>';

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

  openPanel('technique-use');
}

// Shared Directions/Other optgroup markup for Message's Glyph picker — used
// by the Player-facing Technique Use panel above and the DM's own Essence
// menu (js/dm.js), so "Acting As" an Enemy gets the exact same picker
// instead of always sending the RO/OR default.
// `includeEmpty` (2026-08-22, per dDd — Message now sends up to 3 Glyphs at
// once) adds a leading "— none —" option, for the 2nd/3rd optional picker
// slots; the 1st slot stays required, same as before.
export function glyphOptionsHtml(includeEmpty){
  if(!GLYPH_DATA) return '';
  const movementIds = DIRECTION_GLYPHS.map(d => d.id).concat(MOVEMENT_EXTRA_IDS);
  const movementExtras = MOVEMENT_EXTRA_IDS
    .map(id => GLYPH_DATA.glyphs.find(g => g.id === id))
    .filter(Boolean);
  const otherGlyphs = GLYPH_DATA.glyphs.filter(g => !movementIds.includes(g.id));
  const empty = includeEmpty ? '<option value="">— none —</option>' : '';
  return empty + '<optgroup label="Movement">' +
      DIRECTION_GLYPHS.map(d => '<option value="' + escapeHtml(d.id) + '">' + escapeHtml(d.label) + '</option>').join('') +
      movementExtras.map(g => '<option value="' + escapeHtml(g.id) + '">' + escapeHtml(g.id) + '</option>').join('') +
    '</optgroup>' +
    '<optgroup label="Other">' +
      otherGlyphs.map(g => '<option value="' + escapeHtml(g.id) + '">' + escapeHtml(g.id) + '</option>').join('') +
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

  // Non-Combat Round (2026-08-21, per dDd) — Message and Channel ("Crafter
  // recovers 1 Lightning Point") are staged outside an Encounter through the
  // same stage-then-resolve Order flow Move uses (js/noncombat.js's
  // resolveNonCombatRound()), not the AP-tracked Combat sequence below.
  // Non-Combat doesn't scale to AP, per dDd, so AP costs are skipped
  // entirely here; every other resource cost is still charged immediately
  // at staging, same as Combat.
  if(!AppState.table.inEncounter){
    if(!NONCOMBAT_TECHNIQUES.includes(currentTechniqueKey)){ showBannerError('Techniques can only be staged during an Encounter.'); return; }
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
      }else{
        actor.orders.push({ id: genId(), kind: 'channel' });
        t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' orders a Channel', time: timeNow() });
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
    const dist = getDistance(myPos, targetPos);
    if(dist > def.range){ showBannerError('Target is out of Range (' + dist + ' > ' + def.range + ').'); return; }
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
      glyphs: currentTechniqueKey === 'message' ? glyphIds : undefined
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
