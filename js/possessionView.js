// Shared Possessor/Mini-Party grid rendering (2026-08-16) — originally built
// once for the Roster (ledger.js), now reused by Create-a-Character and the
// read-only Character Sheet too, per dDd's "the Roster should basically be
// duplicated" call: a Player (or the DM) should be able to generate a whole
// family — Character + Mini-Party + Possessors — from one place, not just
// after the fact from the Roster's own add-buttons.
//
// Click handling is dependency-injected (onShowView) rather than importing
// characterView.js directly: ledger.js, character.js, and characterView.js
// all need this module, and characterView.js is itself where showCharacterView
// lives, so importing it here would risk a cycle. Keeping this module a leaf
// (only state.js/utils.js) avoids that entirely.
import { AppState } from './state.js';
import { escapeHtml } from './utils.js';

// Gom/Kulkrow's ambient Tier-5 default always renders as the topmost row —
// it isn't tracked as data, only manually-added Tier 2-5 possessors are. The
// grid always reserves 2 default + 2 optional slots (empty ones padded,
// invisible) so every Character's stack is the same height regardless of how
// many possessors they actually have. Lower-tier (2/3, "Possessor") always
// renders left, higher-tier (4/5, "Higher Power"/"Supreme Force") right —
// sorted by tier for layout, but data-possessor-index still points at the
// real position in player.possessors for click-to-view.
// hideShadow (Veil Vision, 2026-08-16): when set, a "shadow"-type Possessor
// renders as a blank slot — same markup shape as the empty-slot filler
// below, so the grid's own fixed slot count/height never changes — instead
// of its real name/icon. Only ledger.js's live Roster passes this; Create-
// a-Character and the read-only Character Sheet never do, since you're
// intentionally inspecting/editing that specific Character there, not
// scanning the Party at a glance through the fog.
export function possessorGridHtml(player, playerId, hideShadow){
  const defaultShadowHidden = hideShadow;
  const defaultPossessorHtml = defaultShadowHidden
    ? '<div class="roster-possessor empty">&nbsp;</div><div class="roster-possessor empty">&nbsp;</div>'
    : '<div class="roster-possessor shadow"><span class="roster-icon">●</span> Gom (Tier 5)</div>' +
      '<div class="roster-possessor shadow"><span class="roster-icon">●</span> Kulkrow (Tier 5)</div>';
  const possessorEntries = player.possessors || [];
  const possessorSorted = possessorEntries.map((pos, i) => ({ pos, i })).sort((a, b) => a.pos.tier - b.pos.tier);
  const possessorHtml = possessorSorted.map(({ pos, i }) => {
    const isShadow = pos.type === 'shadow';
    if(isShadow && hideShadow) return '<div class="roster-possessor empty">&nbsp;</div>';
    return '<div class="roster-possessor' + (isShadow ? ' shadow' : '') + '" data-player-id="' + playerId + '" data-possessor-index="' + i + '">' +
      '<span class="roster-icon">' + (isShadow ? '●' : '○') + '</span> ' + escapeHtml(pos.name) + ' (Tier ' + pos.tier + ')</div>';
  }).join('') + '<div class="roster-possessor empty">&nbsp;</div>'.repeat(Math.max(0, 2 - possessorEntries.length));
  return '<div class="roster-possessor-grid">' + defaultPossessorHtml + possessorHtml + '</div>';
}

// A Possessed member (from the Possess Technique) reflects a real Enemy
// still living in table.enemies — hexagon icon, distinct color, and its
// current live name (not the frozen name from the moment it was possessed).
// Returns '' when empty — callers that want an explicit empty-state message
// (Create-a-Character/Character Sheet, which always show a "Mini Party"
// header) supply their own via `|| '<div class="log-empty">...</div>'`.
export function miniPartyGridHtml(player, playerId){
  const miniPartyEntries = player.miniParty || [];
  if(!miniPartyEntries.length) return '';
  const miniPartyHtml = miniPartyEntries.map((mp, i) => {
    const sourceEnemy = mp.sourceEnemyId && AppState.table.enemies && AppState.table.enemies[mp.sourceEnemyId];
    const isPossessed = !!mp.possessed;
    const displayName = sourceEnemy ? sourceEnemy.name : mp.name;
    return '<div class="roster-miniparty-member' + (isPossessed ? ' possessed' : '') + '" data-player-id="' + playerId + '" data-miniparty-index="' + i + '">' +
      '<span class="roster-icon">' + (isPossessed ? '⬢' : '⊙') + '</span> ' + escapeHtml(displayName) + '</div>';
  }).join('');
  return '<div class="roster-miniparty-grid">' + miniPartyHtml + '</div>';
}

// Wires click-to-view for both grids within `root` — call after setting
// their innerHTML. `onShowView` is whatever the caller's own showCharacterView
// import is.
export function wirePossessorMiniPartyClicks(root, onShowView){
  if(!root) return;
  root.querySelectorAll('.roster-possessor[data-possessor-index]').forEach(item => {
    item.onclick = () => {
      const player = AppState.table.players[item.dataset.playerId];
      const pos = player && player.possessors && player.possessors[item.dataset.possessorIndex];
      if(pos) onShowView(pos);
    };
  });
  root.querySelectorAll('.roster-miniparty-member[data-miniparty-index]').forEach(item => {
    item.onclick = () => {
      const player = AppState.table.players[item.dataset.playerId];
      const mp = player && player.miniParty && player.miniParty[item.dataset.minipartyIndex];
      if(!mp) return;
      const sourceEnemy = mp.sourceEnemyId && AppState.table.enemies && AppState.table.enemies[mp.sourceEnemyId];
      onShowView(sourceEnemy || mp);
    };
  });
}
