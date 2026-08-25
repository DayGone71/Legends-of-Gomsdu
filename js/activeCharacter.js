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
import { BUILDS } from './character.js';

// Yom replaces the old placeholder (2026-08-23, per dDd — "TATA is kind of
// wack... we could have Yom be the default Active Character, instead of
// using the Architect Adversary placeholder"). TATA itself stood for "The
// Architect and The Adversary" (see reference/dialogue-system.md's Naming
// note), flagged as needing a rename since 2026-08-15.
//
// As of 2026-08-24, Yom is a real Character in the new Universal Characters
// Table (table.characters — see js/scenes.js's spawnYom()), not just a
// display template — resolveActiveCharacter() below reads his real,
// persisted record. He appears on the Map alone the instant a Scene loads
// (spawnYom()/loadScene()), then vanishes once a real Player actually
// arrives (seedScene()) — never targetable/interactable there in between,
// but a genuine Character the rest of the time, listable/inspectable from
// the NPC Panel same as anyone else. yomDisplayCharacter() below only ever
// fires now as a last-resort fallback, for the rare case nothing has
// created him yet (no Scene ever loaded this Table).
function yomDisplayCharacter(){
  const b = BUILDS.yom;
  if(!b) return null;
  return {
    wounds: 0, woundsMax: b.woundsMax, ap: b.ap, apSpent: 0,
    focus: b.focus, focusSpent: 0, control: b.control,
    lightning: b.lightning, lightningSpent: 0, lava: b.lava, lavaSpent: 0,
    attunement: b.attunement
  };
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
// display card renders directly off. `character` is the real stat object —
// Yom's own (see yomDisplayCharacter above) when nobody's been made Active.
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
  // Universal Characters Table (2026-08-24) — Yom (and whoever else lands
  // there later) checked separately from Enemies, not merged into the same
  // lookup: he was never meant to become a Combat participant just by
  // being Active-able.
  const universal = id && !enemy && table.characters && table.characters[id];
  const found = enemy || universal;
  if(!found || isDeathWounded(found)){
    // Dead/removed since being made Active — fall back to the default
    // rather than a display pointing at nothing. The default is now Yom's
    // own real, persisted record (table.characters.yom) — yomDisplayCharacter()
    // survives only as a last-resort fallback for the (now rare) case where
    // no Scene has ever been loaded, so he doesn't exist yet at all.
    if(id){ AppState.activeCharacterId = null; AppState.actingEnemyId = null; }
    const realYom = table.characters && table.characters.yom;
    return { name: 'Yom', side: 'yom', character: realYom || yomDisplayCharacter() };
  }
  return { name: found.name || (enemy ? 'Enemy' : 'Character'), side: enemy ? 'enemy' : 'yom', character: found };
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

  // Placeholder row (2026-08-24, per dDd — "add another Row... 7 square
  // Placeholder buttons"). No spec yet for what they'll actually do —
  // inert squares, same "reserve the space now, wire it up later" pattern
  // as the Map Grid's own buffer-track work earlier this session.
  const placeholderRow = '<div class="active-char-placeholder-row">' +
    '<div class="active-char-placeholder-btn"></div>'.repeat(7) +
  '</div>';

  el.innerHTML =
    '<div class="active-character-display-row1">' +
      '<div class="active-char-avatar ' + avatarCls + '">' + escapeHtml(initial) + '</div>' +
      '<div class="active-char-info">' +
        '<div class="active-char-name">' + escapeHtml(active.name) + '</div>' +
        statsHtml +
      '</div>' +
    '</div>' +
    placeholderRow;

  // Width scaled to the Map Grid, minus its first and last column
  // (2026-08-24, per dDd) — read live off the real rendered grid rather
  // than hardcoding today's HALF_TILE value, so this keeps matching if the
  // Grid's own edge-column sizing ever changes again. renderMap() always
  // runs immediately before this in renderAll() (js/main.js), so #map-grid
  // is already laid out with real geometry by the time this reads it.
  const mapGrid = document.getElementById('map-grid');
  if(mapGrid){
    const colWidths = getComputedStyle(mapGrid).gridTemplateColumns.split(' ').map(parseFloat);
    if(colWidths.length >= 2){
      const inset = colWidths[0] + colWidths[colWidths.length - 1];
      el.style.width = (mapGrid.getBoundingClientRect().width - inset) + 'px';
    }
  }
}
