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
// note), flagged as needing a rename since 2026-08-15 — this finally
// resolves that flag, not just cosmetically: the old placeholder had "no
// Stats, just blank space for now," where Yom is a real Build (data/
// characters.json) with real Stats and a real (limited) Crafts/Powers kit.
// Still not a real table.enemies entry, same as the old placeholder — Yom
// has no Map position and is never targetable/interactable there; he acts
// only through Seed (his one Master Technique, see js/scenes.js's
// seedScene()), never through the normal per-Tile Craft popup. Built fresh
// off BUILDS.yom every call rather than cached, same reasoning `wounds`/
// `apSpent`-style fields would need if he ever gained persisted state later
// — right now he never takes damage or spends a resource that needs to
// survive between renders, so there's nothing to persist yet.
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
  if(!enemy || isDeathWounded(enemy)){
    // Dead/removed since being made Active — fall back to the default
    // rather than a display pointing at nothing.
    if(id){ AppState.activeCharacterId = null; AppState.actingEnemyId = null; }
    return { name: 'Yom', side: 'yom', character: yomDisplayCharacter() };
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
