// Shared Possessor/Mini-Party grid rendering — used by the Roster
// (ledger.js), Create-a-Character, and the read-only Character Sheet, so a
// Player (or the DM) can generate a whole family — Character + Mini-Party +
// Possessors — from one place.
//
// Click handling is dependency-injected (onShowView) rather than importing
// characterView.js directly: ledger.js, character.js, and characterView.js
// all need this module, and characterView.js is itself where
// showCharacterView lives, so importing it here would risk a cycle. Keeping
// this module a leaf (only state.js/utils.js) avoids that.
import { AppState } from './state.js';
import { escapeHtml } from './utils.js';
import { MAX_MINI_PARTY } from './possession.js';

// Gom/Kulkrow's ambient Tier-5 default always renders as the topmost row —
// it isn't tracked as data, only manually-added Tier 2-5 possessors are. The
// grid always reserves 2 default + 2 optional slots (empty ones padded,
// invisible) so every Character's stack is the same height regardless of how
// many possessors they actually have. Lower-tier (2/3, "Possessor") always
// renders left, higher-tier (4/5, "Higher Power"/"Supreme Force") right —
// sorted by tier for layout, but data-possessor-index still points at the
// real position in player.possessors for click-to-view.
// hideShadow (Veil Vision): when set, a "shadow"-type Possessor renders as a
// blank slot — same markup shape as the empty-slot filler below, so the
// grid's fixed slot count/height never changes — instead of its real name/
// icon. Only ledger.js's live Roster passes this; Create-a-Character and the
// read-only Character Sheet never do, since you're intentionally inspecting/
// editing that specific Character there, not scanning the Party through the
// fog.
// canManage: only the live Roster passes this, and only for the viewer's own
// Player Group, or anyone's Group once Veil Vision is on — an empty manual
// possessor slot (never the Gom/Kulkrow default) renders as a real
// "+Add Possessor" button instead of an invisible placeholder, and a real
// manually-added entry gets the same hover-reveals-a-red-X removal
// affordance already used for defeated Enemy chips (.chip-remove-x).
// Create-a-Character and the read-only Character Sheet never pass it.
export function possessorGridHtml(player, playerId, hideShadow, canManage){
  const defaultShadowHidden = hideShadow;
  const defaultPossessorHtml = defaultShadowHidden
    ? '<div class="roster-possessor empty">&nbsp;</div><div class="roster-possessor empty">&nbsp;</div>'
    : '<div class="roster-possessor shadow"><span class="roster-icon">●</span> Gom (Tier 5)</div>' +
      '<div class="roster-possessor shadow"><span class="roster-icon">●</span> Kulkrow (Tier 5)</div>';
  const possessorEntries = player.possessors || [];
  const possessorSorted = possessorEntries.map((pos, i) => ({ pos, i })).sort((a, b) => a.pos.tier - b.pos.tier);
  const emptySlotHtml = canManage
    ? '<button class="roster-possessor empty roster-add-slot" data-player-id="' + playerId + '" data-kind="possessor" title="Add Possessor">+ Possessor</button>'
    : '<div class="roster-possessor empty">&nbsp;</div>';
  const possessorHtml = possessorSorted.map(({ pos, i }) => {
    const isShadow = pos.type === 'shadow';
    if(isShadow && hideShadow) return '<div class="roster-possessor empty">&nbsp;</div>';
    const removeX = canManage ? '<span class="chip-remove-x roster-remove-x" data-player-id="' + playerId + '" data-kind="possessor" data-index="' + i + '">✕</span>' : '';
    return '<div class="roster-possessor' + (isShadow ? ' shadow' : '') + '" data-player-id="' + playerId + '" data-possessor-index="' + i + '">' +
      '<span class="roster-icon">' + (isShadow ? '●' : '○') + '</span> ' + escapeHtml(pos.name) + ' (Tier ' + pos.tier + ')' + removeX + '</div>';
  }).join('') + emptySlotHtml.repeat(Math.max(0, 2 - possessorEntries.length));
  return '<div class="roster-possessor-grid">' + defaultPossessorHtml + possessorHtml + '</div>';
}

// A Possessed member (from the Possess Technique) reflects a real Enemy
// still living in table.enemies — hexagon icon, distinct color, and its
// current live name (not the frozen name from the moment it was possessed).
// Always reserves MAX_MINI_PARTY slots (empty ones padded, invisible),
// matching possessorGridHtml's own reserved-slot pattern above — a fixed
// slot count is what makes a Character's whole block the same height
// regardless of how many members it actually has.
export function miniPartyGridHtml(player, playerId, canManage){
  const miniPartyEntries = player.miniParty || [];
  const emptySlotHtml = canManage
    ? '<button class="roster-miniparty-member empty roster-add-slot" data-player-id="' + playerId + '" data-kind="miniparty" title="Add Mini-Party Character">+ Mini-Party</button>'
    : '<div class="roster-miniparty-member empty">&nbsp;</div>';
  const miniPartyHtml = miniPartyEntries.map((mp, i) => {
    const sourceEnemy = mp.sourceEnemyId && AppState.table.enemies && AppState.table.enemies[mp.sourceEnemyId];
    const isPossessed = !!mp.possessed;
    const displayName = sourceEnemy ? sourceEnemy.name : mp.name;
    // A Possessed member is a live Enemy reflected here, not a real entry in
    // this Player's own miniParty array in the removable sense — removing
    // it isn't "delete this Group Character," it's undoing a live Possess
    // Technique effect, a different action entirely. No remove-X for those.
    const removeX = (canManage && !isPossessed) ? '<span class="chip-remove-x roster-remove-x" data-player-id="' + playerId + '" data-kind="miniparty" data-index="' + i + '">✕</span>' : '';
    return '<div class="roster-miniparty-member' + (isPossessed ? ' possessed' : '') + '" data-player-id="' + playerId + '" data-miniparty-index="' + i + '">' +
      '<span class="roster-icon">' + (isPossessed ? '⬢' : '⊙') + '</span> ' + escapeHtml(displayName) + removeX + '</div>';
  }).join('') + emptySlotHtml.repeat(Math.max(0, MAX_MINI_PARTY - miniPartyEntries.length));
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
