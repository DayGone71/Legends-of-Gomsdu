import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml, timeNow } from './utils.js';
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

// Data-driven so adding a new Technique later is just a new entry here — no
// new staging/undo/cost-checking code needed, the engine below is generic
// over whatever `costs` a Technique lists. dDd's spec, 2026-08-16. Effects
// are text-only for now (not mechanically resolved) except Separation's Map
// Obstacle, which is simple/deterministic enough to actually implement.
export const TECHNIQUES = {
  wound: {
    name: 'Wound', group: 'Powers', column: 'Flow', type: 'Physical Attack',
    costs: { ap: 15, flow: 10 }, range: 2,
    effect: 'Bypasses Target Flow entirely. If Flow is already 0, this attack gets +Hit%.'
  },
  possess: {
    name: 'Possess', group: 'Powers', column: 'Focus', type: 'Mystic Influence',
    costs: { ap: 20, focus: 2 }, range: 5,
    effect: 'Target is possessed for the next Sequence.'
  },
  heartAttack: {
    name: 'Heart Attack', group: 'Craft', column: 'Lightning', type: 'Mystic Attack',
    costs: { ap: 20, lightning: 1 }, range: 5,
    effect: "Target's Flow is reduced to 0. If Flow is already 0, a chance to deal 1 Wound at 50% Hit%."
  },
  skullExplosion: {
    name: 'Skull Explosion', group: 'Craft', column: 'Lightning', type: 'Mystic Attack',
    costs: { ap: 20, lightning: 1 }, range: 5,
    effect: 'An attack is made with 10 Power against the Target.'
  },
  separation: {
    name: 'Separation', group: 'Craft', column: 'Lava', type: 'Mystic Transformation',
    costs: { ap: 20, lava: 1 }, range: 5,
    effect: 'Lifts a chunk of Matter from the Planet — becomes a Map Obstacle on the Tile immediately to the right of the user.'
  },
  bloodkindle: {
    name: 'Bloodkindle', group: 'Craft', column: 'Lava', type: 'Mystic Transformation',
    costs: { ap: 20, lava: 1 }, range: 5,
    effect: 'Target gains +10 Power on all attacks made during the Sequence.'
  }
};

const RESOURCE_LABELS = { ap: 'AP', focus: 'Focus', flow: 'Flow', lightning: 'Lightning', lava: 'Lava' };

// Flow isn't a per-round "spent" pool like AP/Focus — it's the actor's real,
// persistent Flow, same value combat damage already drains and Recovery
// rebuilds. Lightning/Lava get a new per-round spent pool, same shape as focusSpent.
function remaining(actor, resource){
  if(resource === 'flow') return actor.flow || 0;
  if(resource === 'ap') return (actor.ap || 0) - (actor.apSpent || 0);
  if(resource === 'focus') return (actor.focus || 0) - (actor.focusSpent || 0);
  if(resource === 'lightning') return (actor.lightning || 0) - (actor.lightningSpent || 0);
  if(resource === 'lava') return (actor.lava || 0) - (actor.lavaSpent || 0);
  return 0;
}

function costText(costs){
  return Object.entries(costs).map(([r, amt]) => amt + ' ' + RESOURCE_LABELS[r]).join(', ');
}

let currentTechniqueKey = null;

export function openTechniqueUse(key){
  const def = TECHNIQUES[key];
  if(!def) return;
  currentTechniqueKey = key;

  document.getElementById('tu-name').textContent = def.name;
  document.getElementById('tu-type').textContent = def.type + ' — ' + def.group + ' / ' + def.column;
  document.getElementById('tu-cost').textContent = costText(def.costs);
  document.getElementById('tu-range').textContent = def.range;
  document.getElementById('tu-effect').textContent = def.effect;

  const myPos = AppState.table.positions && AppState.table.positions[AppState.playerId];
  const map = AppState.table.map;
  const enemies = Object.entries((AppState.table && AppState.table.enemies) || {}).filter(([, e]) => e.wounds > 0);
  const targetSelect = document.getElementById('tu-target');
  targetSelect.innerHTML = enemies.length
    ? enemies.map(([id, e]) => {
        const pos = AppState.table.positions && AppState.table.positions[id];
        let suffix = '', disabled = '';
        if(myPos && pos && map){
          const dist = getDistance(myPos, pos);
          if(dist > def.range){ suffix = ' (out of Range: ' + dist + ')'; disabled = 'disabled'; }
          else if(!hasLineOfSight(map, myPos, pos)){ suffix = ' (no line of sight)'; disabled = 'disabled'; }
        }
        return '<option value="' + id + '" ' + disabled + '>' + escapeHtml(e.name) + suffix + '</option>';
      }).join('')
    : '<option value="">No enemies to target</option>';

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

  const targetId = document.getElementById('tu-target').value;
  const target = AppState.table.enemies && AppState.table.enemies[targetId];
  if(!target || target.wounds <= 0){ showBannerError('Pick a target first.'); return; }

  if(currentTechniqueKey === 'possess' && (me.miniParty || []).length >= MAX_MINI_PARTY){
    showBannerError('Your Mini-Party is already full (' + MAX_MINI_PARTY + ') — Possession would exceed it.');
    return;
  }

  const myPos = AppState.table.positions && AppState.table.positions[AppState.playerId];
  const targetPos = AppState.table.positions && AppState.table.positions[targetId];
  if(myPos && targetPos){
    const dist = getDistance(myPos, targetPos);
    if(dist > def.range){ showBannerError('Target is out of Range (' + dist + ' > ' + def.range + ').'); return; }
    if(!hasLineOfSight(AppState.table.map, myPos, targetPos)){ showBannerError('No line of sight to target.'); return; }
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
