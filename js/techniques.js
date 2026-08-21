import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml, timeNow, isDeathWounded, resolveEntityRef, resolvePositionRef, alliedActorIds, deliverMindeyeEntry } from './utils.js';
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

// Which pool a Technique's target picker draws from — Enemies by default,
// Allies (the Player, every other Player, and their statted Mini-Party) for
// anything carrying `targetSide: 'ally'` (currently just Embolden/Anchor).
// Reuses the exact same resolution the Combat panel's Ally/Target ranges and
// DM Test's actor list run on (see utils.js) — a Mini-Party member is just
// as real a target here as it is everywhere else now.
function targetPoolIds(table, def){
  return def.targetSide === 'ally' ? alliedActorIds(table) : Object.keys((table && table.enemies) || {});
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

  openPanel('technique-use');
}

// Anybody can stage any Technique — no ownership/unlock gating (per dDd:
// "for Testing purposes") — but the resource cost itself still has to be
// affordable, same as every other staged Combat action.
export async function stageTechnique(){
  const def = TECHNIQUES[currentTechniqueKey];
  if(!def) return;
  const me = AppState.table.players[AppState.playerId];
  if(!me) return;
  if(!AppState.table.inEncounter){ showBannerError('Techniques can only be staged during an Encounter.'); return; }
  if(!hasCategoryAccess(me, def)){ showBannerError('Your Character doesn’t have access to this Technique.'); return; }

  const targetId = document.getElementById('tu-target').value;
  const target = resolveEntityRef(AppState.table, targetId);
  if(!target || isDeathWounded(target)){ showBannerError('Pick a target first.'); return; }

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
      flowCost: def.costs.flow || 0, lightningCost: def.costs.lightning || 0, lavaCost: def.costs.lava || 0
    };
    actor.sequence.push(entry);
    actor.apSpent = (actor.apSpent || 0) + entry.apCost;
    actor.focusSpent = (actor.focusSpent || 0) + entry.focusCost;
    actor.lightningSpent = (actor.lightningSpent || 0) + entry.lightningCost;
    actor.lavaSpent = (actor.lavaSpent || 0) + entry.lavaCost;
    if(entry.flowCost) actor.flow = Math.max(0, (actor.flow || 0) - entry.flowCost);
    if(currentTechniqueKey === 'message') deliverMindeyeEntry(t, targetId, actor.name || 'Someone');
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
