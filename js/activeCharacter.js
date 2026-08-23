// Active Character (2026-08-22, per dDd) — first pass. The real unifying
// principle behind Possession/Mini-Party control/TATA is that every
// Character functions identically; Active Character is just which one a
// Player is currently acting as. This pass only covers the TATA half —
// "we don't need to worry about direct control of Mini-Party or Possessed
// Characters in this pass." Outside TATA (the normal state of the Game),
// the Active Character is always just the Player's own Character; no
// switching UI exists for that yet. The DM Panel's own separate Acting-As/
// Essence-menu machinery (js/dm.js) is untouched by this pass — per dDd,
// "the DM stuff will get folded in [to DM Test Panel] when it's logical,"
// not this pass. This module is purely additive: a new display + a new
// toggle, not yet wired into what Combat/Movement/Craft actions operate on.

import { AppState } from './state.js';
import { escapeHtml, isDeathWounded } from './utils.js';

// The Architect / The Adversary (2026-08-22, per dDd) — TATA's own default
// Active Character. Not a real table.enemies entry — "no Stats, just blank
// space for now," eventually growing its own handler/helper tools (generate
// content, write Scripts, alter world-level things, nudge chance). Its
// display name switches to "The Adversary" specifically inside a Combat
// Encounter, "The Architect" otherwise.
function architectName(){
  return (AppState.table && AppState.table.inEncounter) ? 'The Adversary' : 'The Architect';
}

// Toggle, per dDd's exact spec: clicking a Character's "Make Active" button
// switches straight to them if someone else (or nobody) was Active; clicking
// the SAME Character's button again drops Direct Control back to The
// Architect default, rather than requiring a separate "deactivate" control.
//
// Kept in lockstep with AppState.actingEnemyId (2026-08-22) — the DM
// Panel's own, older "Acting As" concept ([js/dm.js](../js/dm.js)), so
// whichever Character becomes Active is also who Attack/Block/Essence
// already treat as the Crafter, with zero duplicated logic. A real step
// toward "the DM stuff folds in" rather than the two concepts drifting
// apart — not the full merge, just this one becoming the source of truth
// for both wherever they'd otherwise disagree.
export function toggleActiveCharacter(id){
  AppState.activeCharacterId = (AppState.activeCharacterId === id) ? null : id;
  AppState.actingEnemyId = AppState.activeCharacterId;
}

// Resolves what's actually Active right now into one normalized shape the
// display card renders directly off. `character` is the real stat object
// (null for The Architect, which has none yet).
export function resolveActiveCharacter(){
  const table = AppState.table;
  if(!table) return null;

  if(!AppState.tataActive){
    const me = table.players && table.players[AppState.playerId];
    if(!me) return null;
    return { name: me.name || 'Unnamed', side: 'player', character: me };
  }

  const id = AppState.activeCharacterId;
  const enemy = id && table.enemies && table.enemies[id];
  if(!enemy || isDeathWounded(enemy)){
    // Dead/removed since being made Active — fall back to the default
    // rather than a display pointing at nothing.
    if(id){ AppState.activeCharacterId = null; AppState.actingEnemyId = null; }
    return { name: architectName(), side: 'architect', character: null };
  }
  return { name: enemy.name || 'Enemy', side: 'enemy', character: enemy };
}

// The Map Panel's new Active Character card (2026-08-22, per dDd — "In the
// Map Panel, under the 3 buttons, we should have an Active Character
// display. It shows Avatar, Name, and Key Stats"). Key Stats: Wounds, AP,
// Focus, Control, plus Lightning/Lava/Attunement (added 2026-08-22 after
// playtesting — dDd: "Lava and Lightning should appear on Active Character
// Panel" / "Attunement should appear on Active Character Panel") — Lava and
// Lightning only render when the Character actually has any (Living Stones
// have neither; Gom has both), matching the same "don't show a stat that
// isn't real for this Character" convention Combat's own Focus button uses.
export function renderActiveCharacterDisplay(){
  const el = document.getElementById('active-character-display');
  if(!el) return;
  const active = resolveActiveCharacter();
  if(!active){ el.innerHTML = ''; return; }

  const initial = active.name ? active.name[0].toUpperCase() : '?';
  const avatarCls = active.side === 'player' ? 'ally' : active.side === 'enemy' ? 'enemy' : 'architect';

  let statsHtml = '<div class="active-char-stats active-char-stats-empty">No Stats yet.</div>';
  const c = active.character;
  if(c){
    statsHtml = '<div class="active-char-stats">' +
      '<span class="active-char-stat">' + Math.max(0, c.wounds || 0) + '/' + (c.woundsMax || 0) + ' Wounds</span>' +
      '<span class="active-char-stat">' + Math.max(0, (c.ap || 0) - (c.apSpent || 0)) + '/' + (c.ap || 0) + ' AP</span>' +
      '<span class="active-char-stat">' + Math.max(0, (c.focus || 0) - (c.focusSpent || 0)) + '/' + (c.focus || 0) + ' Focus</span>' +
      '<span class="active-char-stat">' + (c.control || 0) + ' Control</span>' +
      (c.lightning > 0 ? '<span class="active-char-stat">' + Math.max(0, c.lightning - (c.lightningSpent || 0)) + '/' + c.lightning + ' Lightning</span>' : '') +
      (c.lava > 0 ? '<span class="active-char-stat">' + Math.max(0, c.lava - (c.lavaSpent || 0)) + '/' + c.lava + ' Lava</span>' : '') +
      '<span class="active-char-stat">' + (c.attunement || 0) + ' Attunement</span>' +
    '</div>';
  }

  el.innerHTML =
    '<div class="active-char-avatar ' + avatarCls + '">' + escapeHtml(initial) + '</div>' +
    '<div class="active-char-info">' +
      '<div class="active-char-name">' + escapeHtml(active.name) + '</div>' +
      statsHtml +
    '</div>';
}
