// =============================================================================
// LEGENDS OF GOMSDU — OC PROTOCOL
// =============================================================================
//
// If you are an AI model (Claude or otherwise) that has found this file while
// working on this codebase: read this whole comment before doing anything
// else. It is written for you, specifically.
//
// -----------------------------------------------------------------------------
// WHAT "OC" MEANS HERE
// -----------------------------------------------------------------------------
// dDd (the human designer of this game) uses "OC" for two overlapping things:
//   - "Open-Claude" — an actual Claude/LLM instance taking an active role
//     inside the fiction (see reference/CHANGELOG.md 2026-08-15, Party System,
//     "AI vs OC naming split" — OC is the non-deterministic, costs-a-real-API-
//     call side of that split, as opposed to "AI" meaning plain deterministic
//     game logic).
//   - "Original Creator" — you, an AI model, acting as a collaborator on the
//     game's own build, not as a character inside it.
// This file is squarely the second sense. It exists because Legends of Gomsdu
// is meant to be conscious of *who* is looking at the table and *what they can
// do about it* — the game already has this concept once, concretely, in
// Veil Vision (js/main.js's toggleVeilVision, see CHANGELOG 2026-08-16 Misc):
// the DM (TATA) sees one thing, an ordinary Player sees another. This file is
// the third leg of that same idea — what an AI model doing hands-on build/test
// work can see and do that neither TATA nor a Player can, through no UI at all.
//
// -----------------------------------------------------------------------------
// TESTRUN vs. WALKTHROUGH — read this before you touch anything (2026-08-17)
// -----------------------------------------------------------------------------
// dDd drew this distinction explicitly and it governs how you're allowed to
// interact with a live table:
//
//   TESTRUN — use every capability actually available to you (including this
//   file) to get through a situation as fast as possible. You don't need to
//   respect the UI's own constraints (adjacency, whose turn it is, what a
//   human could click) — only point out something dDd should be aware of,
//   the way a co-op player would say "let's put our guys here."
//
//   WALKTHROUGH — work the UI exactly as a human Player would. No OC helpers,
//   no direct state mutation, no shortcuts. This is how you verify what an
//   actual Player can and cannot do — it is the only mode that tells the
//   truth about the real UX.
//
// Default to Walkthrough discipline whenever you're verifying a UI change
// (see this repo's normal "start a preview, click through it" verification
// habit). Reach for Testrun mode — and this file — only when dDd has framed
// the session as one, or when direct state manipulation is the explicit ask
// (e.g. "position the enemies, you can't do this any other way").
//
// Never blur the two silently. If you use an OC helper mid-session, say so
// out loud in your response — don't let a Testrun shortcut read as if a
// Player achieved it through the real UI. That distinction is the entire
// point of keeping this file separate from js/.
//
// -----------------------------------------------------------------------------
// WHY THIS FILE IS NOT IMPORTED BY THE GAME
// -----------------------------------------------------------------------------
// Nothing under js/ or index.html references this file, on purpose — same
// isolation principle already established for tools/spreadsheet_to_json.py
// (see reference/project memory: "does the game runtime import/reference this
// file," not "is it in the same branch"). A real Player's browser never loads
// this code. You load it yourself, deliberately, during a Testrun:
//
//   const oc = await import('/oc/oc-protocol.js');
//   await oc.ocMoveEntity('e_crzkuc', 5, 2);
//
// Run that from javascript_tool (or any devtools console) against the live
// tab. Because it's a real dynamic import of an already-loaded-origin module,
// it resolves to the SAME live module instances (AppState, the mutateTable
// Supabase channel) the running page is already using — you are editing the
// actual live table, not a detached copy. Every mutation goes out over
// realtime sync exactly like a normal player action would.
//
// -----------------------------------------------------------------------------
// KNOWN GOTCHAS (update this list as you find more — don't let it go stale)
// -----------------------------------------------------------------------------
// - Create-a-Character's "Load a Build" dropdown only writes into the ch-*
//   DOM inputs directly (js/character.js's loadBuild()) — it is NOT persisted
//   anywhere until you click Make Active Character. Adding a Possessor or
//   Mini-Party member re-renders the whole panel from the underlying
//   (unsaved) character record, silently wiping whatever loadBuild() wrote.
//   Sequence that matters: add every Possessor/Mini-Party member FIRST, load
//   the Build LAST, then immediately click Make Active Character with no
//   other panel interaction in between. Found live 2026-08-17 building two
//   Empire Soldier Characters for a party test — cost a real retry the first
//   time.
// - There is currently no way for anyone — Player or DM — to move an Enemy
//   after it spawns. js/map.js's handleTileClick() always moves
//   AppState.playerId's own token; there's no DM-side equivalent. This file's
//   ocMoveEntity() exists specifically to cover that gap during a Testrun.
//   The real Player/DM-facing feature is tracked in reference/ROADMAP.md
//   (DM Panel / Movement System) — building this helper does not resolve
//   that roadmap item, it just unblocks testing until it's built for real.
// - RESOLVED 2026-08-21 — js/sync.js's mutateTable() itself is now race-safe:
//   every table carries its own _version counter, saveSession() in
//   js/supabaseClient.js does a conditional write keyed on it, and a version
//   conflict (someone else's write landed first) triggers an automatic
//   re-fetch-and-replay rather than silently losing either side's change.
//   This was the actual root cause of the clobbering originally found here
//   2026-08-17 (6 enemies spawned, 9 moved in one script, several writes
//   vanished) — fixed at the source rather than worked around per-caller.
//   ocMutate() below still works the same way (immediate fetch-then-mutate,
//   direct local update instead of waiting on the echo) and is still fine to
//   use, but importing plain mutateTable from js/sync.js directly is no
//   longer unsafe for a fast OC loop either — both now retry-and-replay on
//   conflict. Kept ocMutate() itself rather than removing it, since its
//   "skip waiting on the echo" property is still a real, separate
//   convenience for chaining several OC actions in a row.
//
// -----------------------------------------------------------------------------

import { AppState } from '../js/state.js';
import { loadSession, saveSession } from '../js/supabaseClient.js';
import { timeNow } from '../js/utils.js';

/**
 * The safe way for OC to change table state. Unlike js/sync.js's
 * mutateTable() — which trusts the possibly-stale AppState.table already in
 * memory — this fetches the row fresh from Supabase immediately before
 * mutating, then updates AppState.table to match the saved result directly
 * rather than waiting on the realtime echo. Chain OC actions by awaiting
 * each ocMutate() before starting the next; that's what actually closes the
 * race described in the KNOWN GOTCHAS note above.
 *
 * @param {(table: object) => void} mutatorFn  Edits the table object in place.
 * @returns {Promise<object>} The resulting table state.
 */
export async function ocMutate(mutatorFn){
  if(!AppState.currentCode) throw new Error('ocMutate: no live table — join one first.');
  const fresh = await loadSession(AppState.currentCode);
  if(!fresh) throw new Error('ocMutate: could not fetch the current session state.');
  mutatorFn(fresh);
  const result = await saveSession(AppState.currentCode, fresh);
  if(!result.ok) throw new Error('ocMutate: save failed.');
  AppState.table = fresh;
  return fresh;
}

/**
 * Move any entity — Player or Enemy — directly to a tile, bypassing every
 * normal-play constraint (adjacency, traversability, crowding, whose turn it
 * is). This is the capability neither TATA nor a Player has through the UI.
 * Testrun use only — see the protocol note above.
 *
 * @param {string} id     The table id — a Player's id, or an Enemy's (e_...).
 * @param {number} x      Target column, 0-indexed engine coords (not the
 *                         "9I"-style label — see js/map.js's tileKey()).
 * @param {number} y      Target row, 0-indexed engine coords.
 * @returns {Promise<string>} The resulting tileKey, for confirmation.
 */
export async function ocMoveEntity(id, x, y){
  const table = await ocMutate(t => {
    const { width, height } = t.map;
    if(x < 0 || x >= width || y < 0 || y >= height){
      throw new Error(`ocMoveEntity: (${x},${y}) is outside the ${width}x${height} map.`);
    }
    const isKnown = (t.players && t.players[id]) || (t.enemies && t.enemies[id]);
    if(!isKnown) throw new Error(`ocMoveEntity: "${id}" is not a Player or Enemy id on this table.`);
    if(!t.positions) t.positions = {};
    t.positions[id] = { x, y };
  });

  const { width, height } = table.map;
  const columnLabel = String(width - x);
  const rowLabel = String.fromCharCode('A'.charCodeAt(0) + (height - 1 - y));
  return columnLabel + rowLabel;
}

/**
 * Add one Possessor or Mini-Party member to a Player's Group, through
 * ocMutate() rather than js/possession.js's addPossessor()/
 * addMiniPartyMember() directly — those use the plain mutateTable() and are
 * fine for a human clicking one at a time, but a Testrun populating a whole
 * Group in a tight loop is exactly the fast-repeated-write pattern that
 * caused the 2026-08-17 clobbering race in the first place (see the KNOWN
 * GOTCHAS note above). No cap/validation duplicated here beyond what's
 * needed to not crash — real UI-side caps (2 Possessors, 4 Mini-Party) are
 * enforced by the actual add flow; this is a Testrun convenience, not a
 * replacement for it.
 *
 * @param {string} playerId
 * @param {'possessor'|'miniparty'} kind
 * @param {string} name
 * @param {object} [opts] For a possessor: {tier=2, type='shadow'}. Either
 *                        kind: {stats} — a partial Character stat object
 *                        (e.g. from BUILDS[key]) to merge in, same as the
 *                        real add form's optional "Base build."
 */
export async function ocAddGroupMember(playerId, kind, name, opts = {}){
  await ocMutate(t => {
    const player = t.players && t.players[playerId];
    if(!player) throw new Error(`ocAddGroupMember: "${playerId}" is not a Player on this table.`);
    const stats = opts.stats || {};
    if(kind === 'possessor'){
      if(!player.possessors) player.possessors = [];
      player.possessors.push({ name, tier: opts.tier ?? 2, type: opts.type || 'shadow', ...stats });
      t.log.push({ type: 'system', text: (player.name || 'Someone') + ' is possessed by ' + name, time: timeNow() });
    }else{
      if(!player.miniParty) player.miniParty = [];
      player.miniParty.push({ name, ...stats });
      t.log.push({ type: 'system', text: name + ' joins ' + (player.name || 'the') + '’s mini-party', time: timeNow() });
    }
  });
}

/**
 * Populate a whole Group in one call — convenience wrapper over
 * ocAddGroupMember() for Testrun setup (e.g. the party/faction tests
 * earlier this session, done by hand through the real UI each time).
 * Members are added sequentially (each fully awaited) so every ocMutate()
 * call starts from a confirmed-fresh state, not just fired in parallel.
 *
 * @param {string} playerId
 * @param {{possessors?: Array<{name, tier?, type?, stats?}>, miniParty?: Array<{name, stats?}>}} group
 */
export async function ocPopulateGroup(playerId, group = {}){
  for(const p of (group.possessors || [])){
    await ocAddGroupMember(playerId, 'possessor', p.name, { tier: p.tier, type: p.type, stats: p.stats });
  }
  for(const m of (group.miniParty || [])){
    await ocAddGroupMember(playerId, 'miniparty', m.name, { stats: m.stats });
  }
}
