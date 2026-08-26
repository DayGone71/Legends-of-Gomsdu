import { openPanel } from './panels.js';
import { isDown, escapeHtml } from './utils.js';
import { possessorGridHtml, miniPartyGridHtml, wirePossessorMiniPartyClicks } from './possessionView.js';

// Duplicated (not imported) from character.js's SPECIES/TECHNIQUE_CATEGORIES
// on purpose — pulling those in would mean importing character.js, which
// itself imports showCharacterView from this file for Create-a-Character's
// own grids; keeping these plain display lookups avoids that import cycle.
// Just display names, nothing else needs to stay in sync.
const SPECIES_NAMES = {
  humanoid: 'Humanoid', sandman: 'Sandman', crystalBeing: 'Crystal Being', desertAbomination: 'Desert Abomination'
};
const TECHNIQUE_CATEGORY_LABELS = {
  flowPowers: 'Flow Powers', focusPowers: 'Focus Powers', lightningCrafts: 'Lightning Crafts', lavaCrafts: 'Lava Crafts'
};

// Universal read-only "quick snapshot of stats" — same panel for a real
// player, an enemy, or a lightweight Possessor/Mini-Party stub (which may
// only have a name and no stats at all yet). Two-column layout, the same
// one Create-a-Character mirrors — Right = the hard numbers, Left =
// Species/Possessors/Mini-Party. `ownerId` is only meaningful for a real
// top-level Player (needed so its own Possessor/Mini-Party grids can
// data-player-id correctly) — omitted for Possessor/Mini-Party stub views,
// which have no possessors/miniParty of their own to render beyond the
// ambient Gom/Kulkrow default. Equipment and Buffs stay pure placeholders
// below the columns — no Equipment/Buffs data model exists yet.
export function showCharacterView(charLike, ownerId){
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
  set('cv-resilience', charLike.resilience);
  set('cv-lightning', charLike.lightning);
  set('cv-lava', charLike.lava);
  set('cv-focus', charLike.focus);
  set('cv-control', charLike.control);
  set('cv-attunement', charLike.attunement);
  set('cv-life', charLike.life);
  set('cv-species', charLike.species ? (SPECIES_NAMES[charLike.species] || charLike.species) : undefined);

  const downEl = document.getElementById('cv-down-display');
  if(downEl) downEl.textContent = (charLike.wounds != null && charLike.woundsMax != null) ? (isDown(charLike) ? 'Y' : 'N') : '—';
  const bodyEl = document.getElementById('cv-body-display');
  if(bodyEl) bodyEl.textContent = charLike.body ? (charLike.body.filter(Boolean).length + '/' + charLike.body.length) : '—';

  // Technique Lists — read-only check/cross per category. Still reads the
  // old 4-category shape; techniqueAccess itself moved to per-Technique
  // granularity 2026-08-24 (js/techniques.js's hasTechniqueAccess()).
  const techEl = document.getElementById('cv-tech-access');
  if(techEl){
    const access = charLike.techniqueAccess;
    techEl.innerHTML = Object.entries(TECHNIQUE_CATEGORY_LABELS).map(([key, label]) => {
      const granted = access ? (access[key] ?? true) : true;
      return '<div class="tech-access-item' + (granted ? '' : ' denied') + '">' + (granted ? '✓' : '✕') + ' ' + escapeHtml(label) + '</div>';
    }).join('');
  }

  const possessorEl = document.getElementById('cv-possessor-grid');
  const miniPartyEl = document.getElementById('cv-miniparty-grid');
  if(possessorEl) possessorEl.innerHTML = possessorGridHtml(charLike, ownerId || '');
  if(miniPartyEl) miniPartyEl.innerHTML = miniPartyGridHtml(charLike, ownerId || '');
  // Recursion: clicking a Possessor/Mini-Party member inside this view opens
  // the same view for *them* — reusing showCharacterView itself as the
  // callback, same pattern the Roster uses.
  wirePossessorMiniPartyClicks(document.getElementById('panel-character-view'), showCharacterView);

  openPanel('character-view');
}
