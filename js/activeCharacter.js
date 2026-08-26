// Every Character functions identically; Active Character is just which one
// a Player is currently acting as. Outside TATA, the Active Character is
// always just the Player's own Character — no switching UI exists for that.
// The DM Panel's own separate Acting-As/Essence-menu machinery (js/dm.js) is
// a distinct concept for now.

import { AppState } from './state.js';
import { escapeHtml, isDeathWounded } from './utils.js';
import { BUILDS } from './character.js';

// Yom is the TATA default (was a placeholder, now a real Character in the
// Universal Characters Table — table.characters, see js/scenes.js's
// spawnYom()). resolveActiveCharacter() below reads his real, persisted
// record. He appears on the Map alone the instant a Scene loads, then
// vanishes once a real Player arrives — never targetable/interactable there
// in between, but a genuine Character the rest of the time, listable/
// inspectable from the NPC Panel same as anyone else. yomDisplayCharacter()
// below only fires as a last-resort fallback, for the rare case nothing has
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

// Clicking a Character's "Make Active" button switches straight to them if
// someone else (or nobody) was Active; clicking the SAME Character's button
// again drops back to the default, rather than needing a separate
// "deactivate" control. Kept in lockstep with AppState.actingEnemyId (the DM
// Panel's own "Acting As" concept, js/dm.js) so whichever Character becomes
// Active is also who Attack/Block/Essence treat as the Crafter.
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
  // Yom (and whoever else lands in table.characters) is checked separately
  // from Enemies, not merged into the same lookup — he was never meant to
  // become a Combat participant just by being Active-able.
  const universal = id && !enemy && table.characters && table.characters[id];
  const found = enemy || universal;
  if(!found || isDeathWounded(found)){
    // Dead/removed since being made Active — fall back to Yom's real,
    // persisted record rather than a display pointing at nothing.
    if(id){ AppState.activeCharacterId = null; AppState.actingEnemyId = null; }
    const realYom = table.characters && table.characters.yom;
    return { name: 'Yom', side: 'yom', character: realYom || yomDisplayCharacter() };
  }
  return { name: found.name || (enemy ? 'Enemy' : 'Character'), side: enemy ? 'enemy' : 'yom', character: found };
}

// The Map Panel's Active Character card: Avatar, Name, and Key Stats
// (Wounds, AP, Focus, Control, plus Lightning/Lava/Attunement). Lightning
// and Lava only render when the Character actually has any (Living Stones
// have neither; Gom has both) — same "don't show a stat that isn't real for
// this Character" convention Combat's own Focus button uses.
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

  // 7 inert placeholder squares — no spec yet for what they'll do, reserving
  // the space now.
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

  // Width scaled to the Map Grid, minus its first and last column — read
  // live off the rendered grid rather than a hardcoded value, so this stays
  // correct if the Grid's edge-column sizing changes. renderMap() always
  // runs immediately before this in renderAll(), so #map-grid is already
  // laid out by the time this reads it.
  const mapGrid = document.getElementById('map-grid');
  if(mapGrid){
    const colWidths = getComputedStyle(mapGrid).gridTemplateColumns.split(' ').map(parseFloat);
    if(colWidths.length >= 2){
      const inset = colWidths[0] + colWidths[colWidths.length - 1];
      el.style.width = (mapGrid.getBoundingClientRect().width - inset) + 'px';
    }
  }
}
