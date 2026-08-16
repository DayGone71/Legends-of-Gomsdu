import { openPanel } from './panels.js';

// Universal read-only "quick snapshot of stats" — same panel for a real
// player, an enemy, or a lightweight Possessor/Mini-Party stub (which may
// only have a name and no stats at all yet). Equipment and Buffs are pure
// placeholders for now — no equipment system or Buffs data exists yet, this
// just accounts for the layout so it doesn't need to be reworked later.
export function showCharacterView(charLike){
  if(!charLike) return;
  document.getElementById('cv-name').textContent = charLike.name || 'Unnamed';
  document.getElementById('cv-archetype').textContent = charLike.archetype || 'No archetype set';

  const set = (id, value) => {
    const el = document.getElementById(id);
    if(el) el.value = (value === undefined || value === null) ? '—' : value;
  };
  set('cv-wounds', charLike.wounds);
  set('cv-woundsmax', charLike.woundsMax);
  set('cv-flow', charLike.flowMax ?? charLike.flow);
  set('cv-ap', charLike.ap);
  set('cv-recovery', charLike.recovery);
  set('cv-power', charLike.power);
  set('cv-quickness', charLike.quickness);
  set('cv-range', charLike.range);
  set('cv-lightning', charLike.lightning);
  set('cv-lava', charLike.lava);
  set('cv-focus', charLike.focus);
  set('cv-control', charLike.control);
  set('cv-attunement', charLike.attunement);
  set('cv-life', charLike.life);

  openPanel('character-view');
}
