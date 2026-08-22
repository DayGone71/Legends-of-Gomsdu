import { AppState } from './state.js';
import { mutateTable, triggerRender } from './sync.js';
import { escapeHtml, isDeathWounded, isDown, alliedActorIds, resolvePositionRef, resolveEntityRef, genId, timeNow } from './utils.js';
import { showCharacterView } from './characterView.js';
import { toggleActiveCharacter } from './activeCharacter.js';

// 14x14 (was 9x9) — 2026-08-17, dDd's View 1 spec: Tiles shrunk and the grid
// deliberately made bigger than fits the visible area without scrolling
// ("it's fine to break the 9x9 we have"). Picked as a reasonable first-pass
// size, not a precisely-derived number — revisit if it reads as too big/small
// once seen live.
const DEFAULT_WIDTH = 14;
const DEFAULT_HEIGHT = 14;

// Fixed Map viewport (2026-08-20, dDd's ask — "it should be designed to
// always have 7x7 as the view, instead of shrinking or expanding"). TILE_SIZE
// is a flat px constant now (see renderMap's gridTemplateColumns), the same
// at every map size and every screen width. VIEWPORT_TILES caps how many
// Tiles are visible before the grid scrolls, regardless of the actual
// map.width/map.height — a 7x7 Era 1 map fits with no scrolling at all, a
// 14x14 Dev map or a 7x10 Era 2/3 map scrolls internally past that.
const TILE_SIZE = 44;
const VIEWPORT_TILES = 7;
const TILE_GAP = 2; // matches #map-grid's own CSS `gap:2px` in css/panels.css

// Real, measured OS/browser scrollbar width — varies (Windows Chrome ~15-17px,
// macOS overlay scrollbars 0px, etc.), so guessing a constant risks either
// wasting space or, worse, actually clipping a Tile column. Measured once via
// the standard offsetWidth-vs-clientWidth trick on a throwaway scrolling div,
// then cached — it can't change mid-session. Used by renderMap() to size
// #map-grid's max-width around its own scrollbar-gutter reservation.
let cachedScrollbarWidth = null;
function scrollbarGutterWidth(){
  if(cachedScrollbarWidth !== null) return cachedScrollbarWidth;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute; visibility:hidden; width:100px; height:100px; overflow:scroll;';
  document.body.appendChild(probe);
  cachedScrollbarWidth = probe.offsetWidth - probe.clientWidth;
  document.body.removeChild(probe);
  return cachedScrollbarWidth;
}

// width/height now optional (2026-08-20, per dDd's New Game Process —
// different Scenes want different Map sizes: Era 1 is 7x7, Era 2/3 default
// to 7x10). Omitting either falls back to the original 14x14 Dev size.
export function defaultMap(width, height){
  const w = width || DEFAULT_WIDTH, h = height || DEFAULT_HEIGHT;
  return {
    width: w,
    height: h,
    // 1 = traversable (white), 0 = blocked (black). Flat array, row-major.
    tiles: new Array(w * h).fill(1),
    // Cosmetic-only (2026-08-16, see reference/ROADMAP.md's Chunk Mechanic):
    // how many "Chunks" have scattered onto each Tile from Characters that
    // died of Death Wounds there. Capped per addChunksAt below. No gameplay
    // effect yet — purely feeds the pink Tile-coloring gradient in renderMap.
    // (Credited on Death as the current proxy — true Obliteration, every Body
    // Part gone, is a separate not-yet-built check; see utils.js.)
    chunks: new Array(w * h).fill(0)
  };
}

function tileIndex(map, x, y){
  return y * map.width + x;
}

// Facing (2026-08-22, per dDd's Movement System spec) — the direction a
// Character is actually facing, independent of Movement. Degrees are
// clockwise from North (0deg) — matches css/panels.css's .facing-triangle,
// which points up (North) unrotated and rotates via the --facing-deg custom
// property. FACING_DEGREES keeps all 8 values even though only 4 are
// exposed below — cheap to keep ready, no reason to throw the diagonals away.
export const FACING_DEGREES = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
// Cardinal-only for now (2026-08-22, per dDd, after seeing it live): diagonal
// Movement is 8-directional, but diagonal *Facing* never existed for the
// Living Stone — real 8-directional Facing waits for Second Era development.
// Swap this back to all 8 keys of FACING_DEGREES when that starts; nothing
// else here needs to change, FACING_DEGREES already has them.
export const FACING_DIRECTIONS = ['N', 'E', 'S', 'W'];
// Faces the viewer ("down" on screen) by default — the usual top-down
// convention for a Character with no Facing chosen yet.
export const FACING_DEFAULT = 'S';

// Player/NPC Triangle colors (2026-08-22) — Ally-Cyan and Enemy-Yellow,
// both already confirmed in reference/style-guide.md's Enemy/Ally/Self
// section; reused here rather than minting new hues, per that doc's own
// rule ("before introducing a new UI color, check it against this whole
// list first"). "NPC" doesn't have its own data bucket yet — table.enemies
// is the same data the NPCs Panel already shows (see js/dm.js's
// renderNpcList) — so NPC Triangles reuse the Enemy hue for now. A real
// hostile-vs-friendly-NPC split, if it's ever needed, should vary border
// style rather than spend a fourth hue, matching the style guide's own
// stated pattern for splitting a category further.
const FACING_COLOR_PLAYER = '#22D3EE'; // Ally-Cyan
const FACING_COLOR_NPC = '#F5C518'; // Enemy-Yellow

// Which absolute Cardinal a Direction Glyph reads as, independent of a
// Character's own current Facing (per dDd, the same "Cardinal-Direction
// meanings independent of Facing" the Movement-Glyphs-to-Map-Actions thread
// already established). Used by the Face Behavior (js/behaviors.js/
// js/noncombat.js — "Character can face any direction they know") to turn a
// Character's knownGlyphs into the real set of directions they can face.
export const DIRECTION_GLYPH_CARDINAL = { 'RO / OR': 'N', 'KO': 'E', 'OP / PO': 'S', 'OK': 'W' };

// The actual mutation — sets actorId's own Facing, and per dDd's spec,
// propagates it to their Mini-Party too ("changing a Character's own Facing
// also updates their Mini-Party's Facing" — matching the existing
// sandwich-model precedent of a Group moving/acting together). A Possessed
// member (sourceEnemyId) is skipped, same exclusion tileOccupancy uses
// above — it's a real Enemy entity with its own independent Facing, not a
// passenger on this Character's. Pure — operates on a draft table already
// inside a mutateTable() callback; callers own the actual mutation/render.
export function applyFacing(t, actorId, direction){
  const actor = resolveEntityRef(t, actorId);
  if(!actor) return;
  actor.facing = direction;
  (actor.miniParty || []).forEach(mp => { if(!mp.sourceEnemyId) mp.facing = direction; });
}

// Staged, not instant (2026-08-22, per dDd: "Every Action should resolve on
// turns. Nothing should happen immediately in Game... Combat or Non-Combat,
// same thing"). Facing used to apply the moment the Party Facing button was
// clicked — now it queues a real Order, same shape as Move/Message/Channel,
// and js/noncombat.js's resolveNonCombatRound() is what actually calls
// applyFacing() above, at Resolve.
export async function stageFacingOrder(actorId, direction){
  if(!FACING_DEGREES.hasOwnProperty(direction)) return;
  await mutateTable(t => {
    const actor = resolveEntityRef(t, actorId);
    if(!actor) return;
    if(!actor.orders) actor.orders = [];
    actor.orders.push({ id: genId(), kind: 'facing', direction });
    t.log.push({ type: 'system', text: (actor.name || 'Someone') + ' orders a turn to face ' + direction + '.', time: timeNow() });
  });
}

// Movement is 8-directional (matches the Map's compass) — orthogonal or
// diagonal, one Tile at a time. Range/sight-gating stays Manhattan-only
// (getDistance below) — dDd wants those to stay two different rulesets,
// not have this change ripple into how Range gets counted.
function isAdjacent(a, b){
  const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) === 1;
}

// Alphanumeric Tile key: columns count down left-to-right (width..1), rows
// count down top-to-bottom (letter for row 0, descending — e.g. a 9-row map
// reads I..A). Purely a reference label for talking about a Tile at the
// table ("they're standing on 9I") — doesn't affect tileIndex/positions math.
function columnLabel(map, x){
  return String(map.width - x);
}
function rowLabel(map, y){
  return String.fromCharCode('A'.charCodeAt(0) + (map.height - 1 - y));
}
export function tileKey(map, x, y){
  return columnLabel(map, x) + rowLabel(map, y);
}

// Manhattan distance between two Tile positions — the "how far apart are
// two Characters" the game needs to know, ahead of attacks eventually being
// distance-based. Matches the same orthogonal-only movement isAdjacent uses,
// and per dDd's own worked example (a pure 2-diagonal step reads as 4, not
// 2) — diagonals aren't a shortcut, they sum like everything else.
// Callers look positions up via table.positions[id] themselves — a Mini-Party
// member has no id of its own here, it's simply its Player's own position.
export function getDistance(posA, posB){
  if(!posA || !posB) return null;
  return Math.abs(posA.x - posB.x) + Math.abs(posA.y - posB.y);
}

// Occupancy at a single Tile, split the way both movement-blocking and
// line-of-sight-blocking below need it: "down" is anyone not Active (Down or
// Dead of Death Wounds, either side — a corpse pile doesn't care whose corpses), and
// living Characters are split by side since blocking is Friend/Foe-aware
// (2026-08-16, per dDd) — only movement always starts from a Player's own
// click, so "ally" always means "another Player," "enemy" always means an
// Enemy. **Corrected 2026-08-17** — Mini-Party members now count too. dDd's
// own clarification, after this being missed twice: the Ally-crowding effect
// ("Shield") and Ally Movement Blocking are the same thing, not two — "3
// Allied Characters" always meant the Player Character, other Party
// Characters sharing the Tile, AND all their Mini-Party Characters, not just
// top-level Players. A statted-or-not Mini-Party member still physically
// occupies the Tile even without combat stats to track, so it counts here
// regardless (an un-statted stub's isDown() naturally reads false — no
// wounds data means "not Down" by construction, so it correctly counts as
// active without special-casing). Possessed Mini-Party members are excluded
// here (sourceEnemyId) — they're a real Enemy entity with their own
// position, already counted once via the main loop below; counting them
// again here would double them up.
function tileOccupancy(table, x, y){
  let down = 0, activeAllies = 0, activeEnemies = 0;
  Object.entries(table.positions || {}).forEach(([id, pos]) => {
    if(pos.x !== x || pos.y !== y) return;
    const player = table.players && table.players[id];
    const enemy = table.enemies && table.enemies[id];
    if(player){
      if(isDown(player)) down++; else activeAllies++;
      (player.miniParty || []).forEach(mp => {
        if(mp.sourceEnemyId) return;
        if(isDown(mp)) down++; else activeAllies++;
      });
    }
    else if(enemy){ if(isDown(enemy)) down++; else activeEnemies++; }
  });
  return { down, activeAllies, activeEnemies };
}

// Sight-gating (2026-08-16, per dDd's worked example on the live map): a
// Technique's Range isn't just "distance <= N" — a blocked Tile anywhere on
// the straight line between caster and target cuts off everything beyond it,
// even tiles that would otherwise be well within Range. A wall *behind* the
// caster (not on the line to this particular target) has no effect — this is
// a per-target raycast, not "there's a wall somewhere nearby so watch out."
// Bresenham's line algorithm walks the actual Tile path between the two
// points; the caster's own Tile is never checked (you're not blocked by
// standing where you stand), everything after it is.
// Extended 2026-08-16: a Tile crammed with 5+ Active Characters blocks sight
// through it too, same as a real Obstacle Tile — "they're taking up so much
// space," per dDd — so this now takes the whole table, not just the map.
const LOS_CROWD_THRESHOLD = 5;
export function hasLineOfSight(table, from, to){
  const map = table.map;
  let x0 = from.x, y0 = from.y;
  const x1 = to.x, y1 = to.y;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while(true){
    if(x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if(e2 >= dy){ err += dy; x0 += sx; }
    if(e2 <= dx){ err += dx; y0 += sy; }
    if(!map.tiles[y0 * map.width + x0]) return false; // blocked before reaching the target
    const occ = tileOccupancy(table, x0, y0);
    if(occ.activeAllies + occ.activeEnemies >= LOS_CROWD_THRESHOLD) return false; // too crowded to see through
  }
}

// Dead enemies (Death Wounds reached) stay in this list (with a `dead` flag)
// rather than disappearing on their own — a corpse doesn't vanish from the Map,
// only the DM's explicit "Clear the dead" (dm.js) actually removes it.
// Players are never deleted from table.players at all, so they already stayed
// visible; this just brings enemies in line with that.
function allEntities(table){
  const out = {};
  Object.entries(table.players || {}).forEach(([id, p]) => { out[id] = { name: p.name || 'Unnamed', dead: isDeathWounded(p), facing: p.facing || FACING_DEFAULT, side: 'player' }; });
  Object.entries(table.enemies || {}).forEach(([id, e]) => { out[id] = { name: e.name || 'Enemy', dead: isDeathWounded(e), facing: e.facing || FACING_DEFAULT, side: 'enemy' }; });
  return out;
}

// Crowding-based movement block (2026-08-16, refined same day per dDd
// watching the Map live — distinct from the black Obstacle tiles below): a
// soft, occupancy-driven obstacle, not a hard one, and unlike a real Obstacle
// Tile it never affects line of sight on its own (occupancy has its own,
// separate LoS effect above at a higher threshold). Two ways in:
//   - 5+ Down Characters on the Tile (either side, corpses and Down alike —
//     a pile is a pile) blocks moving IN. Moving OUT is never blocked by this
//     at all (handleTileClick only ever checks the *destination* Tile) — per
//     dDd, a Character who wipes out the other 4 occupants of a Tile can
//     still walk away afterward.
//   - 3+ living Enemies-of-the-mover blocks moving IN — this one is
//     Friend/Foe-aware. Allies never contribute to this block no matter how
//     many are on the Tile (dDd's own example: "3 Allies and 2 Enemies is
//     possible, or 4 Enemies 1 Ally as well").
const DOWN_BLOCK_THRESHOLD = 5;
const ACTIVE_CROWD_THRESHOLD = 3; // also drives the Ally/Enemy edge coloring below
function isTileMovementBlocked(table, x, y){
  const occ = tileOccupancy(table, x, y);
  return occ.down >= DOWN_BLOCK_THRESHOLD || occ.activeEnemies >= ACTIVE_CROWD_THRESHOLD;
}

// Behaviors, real Map execution (2026-08-22, per dDd) — turns a cardinal
// Facing plus a clockwise turn count (see BEHAVIORS' `turn` field in
// js/behaviors.js: Forward 0, Right 1, Backward 2, Left 3) into the actual
// direction to step. Clockwise order, matches compass rotation.
const FACING_ORDER = ['N', 'E', 'S', 'W'];
export function turnFacing(facing, steps){
  const idx = FACING_ORDER.indexOf(facing);
  if(idx === -1) return facing;
  return FACING_ORDER[(idx + steps + 4) % 4];
}

// One autonomous Tile-step in a cardinal direction — used by
// resolveNonCombatRound() (js/noncombat.js) when a Character's rolled
// Behavior is a Move* one, or (Gom/Kulkrow) every Round unconditionally.
// Deliberately NOT the Move Order/AP path system (stageMoveOrder above) —
// this is autonomous per-Round movement, not a Player command, so it just
// tries the one step and silently does nothing (returns false) if it's
// invalid, rather than erroring. Mutates table.positions directly — callers
// run this from inside their own mutateTable() callback, same as every
// other in-callback mutation in this codebase.
//
// AP-gated (2026-08-22, per dDd, caught live: "a Living Stone shouldn't be
// able to Move, even if they wanted to; they shouldn't have any AP
// Points"). A Living Stone's own Build has `ap:0` — same requirement
// stageMoveOrder already enforces for Player-directed Movement (a 0-AP
// actor's computeReachable comes back empty), just missing here for the
// autonomous Behavior path until now.
const DIRECTION_DELTA = { N: { dx: 0, dy: -1 }, E: { dx: 1, dy: 0 }, S: { dx: 0, dy: 1 }, W: { dx: -1, dy: 0 } };
export function behaviorStep(table, actorId, direction){
  const map = table.map;
  const actor = resolveEntityRef(table, actorId);
  const pos = table.positions && table.positions[actorId];
  const delta = DIRECTION_DELTA[direction];
  if(!map || !actor || !pos || !delta) return false;
  if(!(actor.ap > 0)) return false;
  const nx = pos.x + delta.dx, ny = pos.y + delta.dy;
  if(nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) return false;
  if(!map.tiles[tileIndex(map, nx, ny)]) return false;
  if(isTileMovementBlocked(table, nx, ny)) return false;
  table.positions[actorId] = { x: nx, y: ny };
  return true;
}

// Tile coloring (2026-08-16, dDd's spec): two gradients layered on every
// Tile, driven by inline CSS custom properties (see css/panels.css) rather
// than dozens of discrete tier classes. Burgundy creeps in from the edge as
// Down Characters pile up (1-5, never reaching the center); Pink spreads out
// from the center as Chunks pile up (1-40 in 8 bands of 5, never fully
// covering the Tile). Colors are dDd's own hex values where given — the pink
// 8-band scale interpolates his 4 anchor colors (at Chunk 10/20/30/40) since
// he wanted 5-Chunk granularity but only spec'd 4 stops.
const DOWN_GRADIENT = ['#BF527F', '#A84F76', '#8F3B65', '#7C2856', '#6B1747']; // tier 1 (20%) .. 5 (100%)
const DOWN_REACH = [88, 76, 64, 52, 40]; // % radius the color starts at — lower = reaches further toward center
const PINK_GRADIENT = ['#FFC4E0', '#FF9DCE', '#FF8FC5', '#FF82BC', '#FF78B5', '#FF6FAE', '#F965A6', '#F45A9F']; // tier 1..8
const CHUNK_REACH = [15, 25, 35, 45, 55, 65, 75, 85]; // % radius the bright ring has spread to

function downTier(downCount){ return Math.max(0, Math.min(5, downCount)); }
function chunkTier(chunkCount){ return chunkCount <= 0 ? 0 : Math.min(8, Math.ceil(chunkCount / 5)); }

// Chunks (2026-08-16) — cosmetic-only per-Tile pool, see defaultMap above.
// Capped at 40; callers (combat.js, on a fresh Death) pass the amount to add,
// currently always 3 per dDd's spec.
const CHUNK_CEILING = 40;
export function addChunksAt(table, x, y, amount){
  if(!table.map) return;
  const size = table.map.tiles.length;
  if(!table.map.chunks || table.map.chunks.length !== size) table.map.chunks = new Array(size).fill(0);
  const idx = y * table.map.width + x;
  table.map.chunks[idx] = Math.min(CHUNK_CEILING, (table.map.chunks[idx] || 0) + amount);
}

function showBannerError(msg){
  const el = document.getElementById('banner-error');
  if(!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

// Actually relocates actorId (a Player, or an Enemy/NPC when Tata-driven) to
// (x,y) — must be traversable, adjacent to their current position, and not
// too crowded to step into. Combat-only now (table.inEncounter) — Combat
// doesn't have its own Move action yet (still a separate future Mechanical
// Fix), so this is the original, unchanged single-Tile instant move. Outside
// an Encounter, stageMoveOrder (below) is what handleTileClick uses instead.
async function tryMoveActor(actorId, x, y){
  const table = AppState.table;
  const positions = table.positions || {};
  const mine = positions[actorId] || { x: 0, y: 0 };
  const idx = tileIndex(table.map, x, y);
  if(!table.map.tiles[idx]){ showBannerError('That Tile is blocked.'); return; }
  if(!isAdjacent(mine, { x, y })){ showBannerError('Pick a Tile next to them.'); return; }
  if(isTileMovementBlocked(table, x, y)){ showBannerError('That Tile is too crowded to move into.'); return; }

  await mutateTable(t => {
    if(!t.positions) t.positions = {};
    t.positions[actorId] = { x, y };
  });
}

// Move Orders (2026-08-21, per dDd's spec) — the Non-Combat multi-Tile
// pathing system. Every Tile costs 1 AP to move into; a Character can still
// order a destination further than their own AP covers in one Round — the
// path just takes multiple Rounds to finish, consumed AP-many Tiles at a
// time by resolveNonCombatRound() (js/noncombat.js). dDd's own worked
// example (AP 3): Tiles 1-3 resolve this Round (0 extra Rounds needed),
// 4-6 need 1 more Round, 7-9 need 2, 10-12 need 3 — capped at 3 extra
// Rounds max for now (MOVE_MAX_EXTRA_ROUNDS below), so with AP 3 the
// farthest orderable Tile is distance 12.
const MOVE_MAX_EXTRA_ROUNDS = 3;

// How many extra Rounds (beyond this one) a Tile at `dist` steps away needs,
// given `ap` Tiles covered per Round — null if the Character has no AP to
// move with at all. 0 means "resolves this Round."
function moveExtraRounds(dist, ap){
  if(!ap || ap <= 0) return null;
  return Math.ceil(dist / ap) - 1;
}

// 8-directional BFS from `origin`, respecting only hard Obstacles (map.tiles)
// — crowding is checked separately, only against the final destination (see
// stageMoveOrder), same as the original single-Tile tryMoveActor did. Capped
// at ap*(MOVE_MAX_EXTRA_ROUNDS+1) steps, since nothing farther is orderable
// right now anyway. Returns a Map: tileIndex -> {x, y, dist, extraRounds,
// parentIdx} for every reachable Tile except the origin itself.
function computeReachable(table, origin, ap){
  const reach = new Map();
  if(!ap || ap <= 0) return reach;
  const map = table.map;
  const maxDist = ap * (MOVE_MAX_EXTRA_ROUNDS + 1);
  const originIdx = tileIndex(map, origin.x, origin.y);
  const visited = new Set([originIdx]);
  const queue = [{ x: origin.x, y: origin.y, dist: 0, parentIdx: null }];
  let head = 0;
  while(head < queue.length){
    const cur = queue[head++];
    if(cur.dist > 0){
      reach.set(tileIndex(map, cur.x, cur.y), {
        x: cur.x, y: cur.y, dist: cur.dist, extraRounds: moveExtraRounds(cur.dist, ap), parentIdx: cur.parentIdx
      });
    }
    if(cur.dist >= maxDist) continue;
    const curIdx = tileIndex(map, cur.x, cur.y);
    for(let dx = -1; dx <= 1; dx++){
      for(let dy = -1; dy <= 1; dy++){
        if(dx === 0 && dy === 0) continue;
        const nx = cur.x + dx, ny = cur.y + dy;
        if(nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        const nIdx = tileIndex(map, nx, ny);
        if(visited.has(nIdx) || !map.tiles[nIdx]) continue;
        visited.add(nIdx);
        queue.push({ x: nx, y: ny, dist: cur.dist + 1, parentIdx: curIdx });
      }
    }
  }
  return reach;
}

// Walks a reach Map's parent pointers back from (destX,destY) to just past
// the origin — the actual Trail, in travel order, origin excluded.
function reconstructPath(table, reach, destX, destY){
  const map = table.map;
  const path = [];
  let idx = tileIndex(map, destX, destY);
  let info = reach.get(idx);
  while(info){
    path.unshift({ x: info.x, y: info.y });
    idx = info.parentIdx;
    info = idx === null ? null : reach.get(idx);
  }
  return path;
}

async function stageMoveOrder(actorId, destX, destY){
  const table = AppState.table;
  const actor = resolveEntityRef(table, actorId);
  if(!actor) return;
  const mine = (table.positions || {})[actorId] || { x: 0, y: 0 };
  const reach = computeReachable(table, mine, actor.ap || 0);
  const idx = tileIndex(table.map, destX, destY);
  const info = reach.get(idx);
  if(!info || info.extraRounds === null || info.extraRounds > MOVE_MAX_EXTRA_ROUNDS){
    showBannerError('That Tile is out of Move range.');
    return;
  }
  if(isTileMovementBlocked(table, destX, destY)){ showBannerError('That Tile is too crowded to move into.'); return; }

  const path = reconstructPath(table, reach, destX, destY);
  const roundsNote = info.extraRounds > 0 ? (' (' + (info.extraRounds + 1) + ' Rounds)') : '';

  await mutateTable(t => {
    const a = resolveEntityRef(t, actorId);
    if(!a) return;
    if(!a.orders) a.orders = [];
    a.orders.push({ id: genId(), kind: 'move', path });
    t.log.push({ type: 'system', text: (a.name || 'Someone') + ' orders a move to ' + tileKey(t.map, destX, destY) + roundsNote, time: timeNow() });
  });

  AppState.moveSelectMode = null;
  AppState.moveHoverTile = null;
  renderMap();
}

// Movement (2026-08-20), per dDd's own spec: clicking a Tile no longer moves
// you there directly — it shows "Move?"/"Suggest Move?" popups for whoever's
// actually standing on that Tile (see buildTilePopups below). Confirming
// "Move?" is what switches the Map into Tile-selector mode; the *next*
// click, wherever it lands, is the actual destination.
export async function handleTileClick(x, y){
  const table = AppState.table;
  if(!table || !table.map) return;

  if(AppState.mapEditMode){
    closeOccupantPopup();
    await mutateTable(t => {
      const idx = tileIndex(t.map, x, y);
      t.map.tiles[idx] = t.map.tiles[idx] ? 0 : 1;
    });
    return;
  }

  if(AppState.moveSelectMode){
    closeOccupantPopup();
    const { actorId } = AppState.moveSelectMode;
    if(table.inEncounter){
      AppState.moveSelectMode = null;
      await tryMoveActor(actorId, x, y);
      renderMap();
    }else{
      await stageMoveOrder(actorId, x, y);
    }
    return;
  }

  // A plain Tile click — set (or move) the occupancy-popup target and
  // re-render; buildTilePopups works out what actually shows, including
  // clearing away to nothing if this Tile has nothing relevant on it.
  // The occupant-list popup (2026-08-22) is separate and always considered
  // — opened/repositioned fresh off the just-rendered Tile element, or
  // closed outright if this Tile has nobody on it.
  AppState.moveClickTile = { x, y };
  renderMap();
  const tileEl = document.querySelector('.map-tile[data-x="' + x + '"][data-y="' + y + '"]');
  if(tileEl) openOccupantPopup(table, x, y, tileEl);
  else closeOccupantPopup();
}

export function cancelMoveSelect(){
  AppState.moveSelectMode = null;
  AppState.moveClickTile = null;
  closeOccupantPopup();
  renderMap();
}

export function toggleTata(){
  AppState.tataActive = !AppState.tataActive;
  AppState.moveClickTile = null;
  AppState.moveSelectMode = null;
  closeOccupantPopup();
  // Active Character (2026-08-22, per dDd) — entering TATA always starts
  // fresh at The Architect default, not wherever a previous TATA session
  // left off; leaving TATA doesn't need a reset since resolveActiveCharacter()
  // (js/activeCharacter.js) only ever reads this while tataActive is true.
  if(AppState.tataActive){ AppState.activeCharacterId = null; AppState.actingEnemyId = null; }
  const btn = document.getElementById('tata-toggle');
  if(btn) btn.classList.toggle('toggled', AppState.tataActive);
  // Full renderAll(), not just renderMap() (2026-08-20) — TATA now also
  // swaps View 2 (js/main.js's renderView2Mode), which renderMap() alone
  // never touches. triggerRender() is the same callback a real table
  // mutation's realtime echo would fire; this is a local-only toggle with
  // no mutation of its own to ride along on, so it has to fire it directly.
  triggerRender();
}

// Which popup(s) show for the Tile currently under AppState.moveClickTile.
// Non-Tata: "Move?" for the Player's own Character if they're here, plus a
// separate "Suggest Move?" if any other allied actor (another Player, or a
// Mini-Party member — see alliedActorIds) is here too; both can fire at
// once on a shared Tile. Tata: "Move?" only for the Active Character
// specifically — bug fixed 2026-08-22, per dDd: "When Tata clicks a Tile
// with an Inactive Character, Move appears, even though there should be no
// Character to Move." The original 2026-08-20 spec ("every non-Player
// Character is Move?, Tata can direct anyone") predates Active Character
// existing as a real concept — now that it does, only the one Character
// Tata is actually acting as should be directly movable, same as how a
// Player can only ever Move their own Character, not any ally's.
function buildTilePopups(table, x, y){
  let out = '';
  if(AppState.tataActive){
    const activeId = AppState.activeCharacterId;
    const activePos = activeId && table.positions && table.positions[activeId];
    if(activePos && activePos.x === x && activePos.y === y){
      out += '<div class="tile-popup" data-move-actor="' + activeId + '">Move?</div>';
    }
  }else{
    const myId = AppState.playerId;
    const myPos = table.positions && table.positions[myId];
    if(myPos && myPos.x === x && myPos.y === y){
      out += '<div class="tile-popup" data-move-actor="' + myId + '">Move?</div>';
    }
    const allyHere = alliedActorIds(table).some(id => {
      if(id === myId) return false;
      const pos = resolvePositionRef(table, id);
      return pos && pos.x === x && pos.y === y;
    });
    if(allyHere) out += '<div class="tile-popup suggest" data-suggest="1">Suggest Move?</div>';
  }

  // Craft (2026-08-21, per dDd; extended to Tata 2026-08-22 — "the Tata
  // should be able to target Characters on the Map with the Tile's 'Craft'
  // popup, just like the Player already can"). Gated on there being a real
  // Crafter to act as: the Player outside Tata, or a real Active Character
  // inside it — AppState.activeCharacterId is null both outside Tata and
  // while The Architect (no Stats) is the default, so this naturally covers
  // both "not Tata" and "Tata, nobody made Active yet." What it actually
  // shows once clicked (self-only Crafts here vs. other-targeting Crafts
  // elsewhere, Combat/Non-Combat filtering, and now Tata's own hand-off to
  // the DM's existing casting machinery) lives in js/craftPopup.js,
  // deliberately NOT imported here — techniques.js already imports js/map.js
  // (getDistance/hasLineOfSight), so map.js importing techniques.js's data
  // back would cycle straight to itself.
  const crafterId = AppState.tataActive ? AppState.activeCharacterId : AppState.playerId;
  if(crafterId){
    const craftOccupant = Object.entries(table.positions || {}).find(([id, pos]) =>
      pos.x === x && pos.y === y && ((table.players && table.players[id]) || (table.enemies && table.enemies[id]))
    );
    if(craftOccupant) out += '<div class="tile-popup craft" data-craft-target="' + craftOccupant[0] + '">Craft</div>';
  }
  return out;
}

// Occupant list popup (2026-08-22, per dDd) — "should always exist,"
// separate from the Move/Suggest/Craft popups above rather than appended to
// them. Every real occupant of a Tile (Players, their Mini-Party, Enemies),
// click behavior split by kind: a Player/Mini-Party row always opens their
// read-only Character Sheet; an Enemy row toggles them as Active Character
// while Tata is on ("if they already are the Active Character it should be
// indicated visually"), otherwise also just opens their Character Sheet.
function buildOccupantList(table, x, y){
  const list = [];
  Object.entries(table.positions || {}).forEach(([id, pos]) => {
    if(pos.x !== x || pos.y !== y) return;
    if(table.players && table.players[id]) list.push({ id, kind: 'player', name: table.players[id].name || 'Unnamed' });
    else if(table.enemies && table.enemies[id]) list.push({ id, kind: 'enemy', name: table.enemies[id].name || 'Enemy' });
  });
  // Mini-Party members ride along on their own Player's Tile, same
  // exclusion the Map's own occupant rendering already uses — a Possessed
  // member is a real Enemy already listed above via its own position.
  Object.entries(table.players || {}).forEach(([pid, p]) => {
    const pos = table.positions && table.positions[pid];
    if(!pos || pos.x !== x || pos.y !== y || !p.miniParty) return;
    p.miniParty.forEach((mp, idx) => {
      if(mp.sourceEnemyId) return;
      list.push({ id: 'mp:' + pid + ':' + idx, kind: 'player', name: mp.name || 'Follower' });
    });
  });
  return list;
}

function closeOccupantPopup(){
  const popup = document.getElementById('occupant-list-popup');
  if(popup) popup.classList.add('hidden');
}

// Fixed 2026-08-22, per dDd: "The pop panel for Characters in a Tile
// persists when other Panels pop up, though it should disappear." Root
// cause: initMapPopupDismiss() below only ever sees clicks that actually
// bubble to document — plenty of buttons that open a Panel (the Craft list
// popup's own craft-list-item, for one) call ev.stopPropagation() first for
// unrelated reasons, which silently blocks it from ever seeing that click at
// all. A direct call from panels.js's openPanel() doesn't depend on
// bubbling surviving intact, so it can't be defeated the same way.
export function closeMapPopups(){
  if(AppState.moveClickTile){ AppState.moveClickTile = null; renderMap(); }
  closeOccupantPopup();
}

// Positioned beside the Tile (left or right, never overlapping it) rather
// than centered on top the way Move/Craft are — per dDd's spec, whichever
// side keeps it closer to the center of the map so it's less likely to run
// off the visible edge. Simplification, noted rather than hidden: "center"
// here is the total map's own width, not the actually-scrolled-into-view
// portion of a map bigger than the fixed viewport — close enough for every
// Scene so far, worth revisiting if a wide scrolled map ever makes it read
// wrong in practice.
function openOccupantPopup(table, x, y, anchorEl){
  const popup = document.getElementById('occupant-list-popup');
  if(!popup) return;
  const list = buildOccupantList(table, x, y);
  if(!list.length){ popup.classList.add('hidden'); return; }

  popup.innerHTML = list.map(o => {
    const isActive = AppState.tataActive && o.kind === 'enemy' && o.id === AppState.activeCharacterId;
    return '<button class="occupant-list-item' + (isActive ? ' active' : '') + '" data-occupant-id="' + o.id + '" data-occupant-kind="' + o.kind + '">' +
      escapeHtml(o.name) + (isActive ? ' <span class="occupant-active-tag">Active</span>' : '') + '</button>';
  }).join('');

  const rect = anchorEl.getBoundingClientRect();
  const showRight = x < table.map.width / 2;
  popup.style.top = rect.top + 'px';
  if(showRight){
    popup.style.left = (rect.right + 6) + 'px';
    popup.style.right = 'auto';
  }else{
    popup.style.right = (window.innerWidth - rect.left + 6) + 'px';
    popup.style.left = 'auto';
  }
  popup.classList.remove('hidden');

  popup.querySelectorAll('.occupant-list-item').forEach(btn => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      const id = btn.dataset.occupantId;
      if(AppState.tataActive && btn.dataset.occupantKind === 'enemy'){
        toggleActiveCharacter(id);
        triggerRender();
      }else{
        const entity = resolveEntityRef(AppState.table, id);
        if(entity) showCharacterView(entity);
      }
      closeOccupantPopup();
    };
  });
}

// Click-away dismiss (2026-08-22, per dDd — "clicking anywhere else on the
// Map should cause it to go away"). Clicking a different Tile already
// handles itself (handleTileClick overwrites/repositions both popups); the
// real gap this closes is clicking outside every Tile entirely — elsewhere
// on the Map row, or the page beyond it.
export function initMapPopupDismiss(){
  document.addEventListener('click', (ev) => {
    if(ev.target.closest('.map-tile') || ev.target.closest('#occupant-list-popup')) return;
    if(AppState.moveClickTile){ AppState.moveClickTile = null; renderMap(); }
    closeOccupantPopup();
  });
}

export function renderMap(){
  const el = document.getElementById('map-grid');
  if(!el) return;
  const table = AppState.table;
  if(!table || !table.map){ el.innerHTML = ''; return; }

  const map = table.map;
  const positions = table.positions || {};
  const entities = allEntities(table);
  // Self (2026-08-22) — the one Tile that's specifically the viewing
  // Player's own Character, per style-guide.md's Green "Self" slot (locked
  // since 2026-08-16, unused until now).
  const selfPos = positions[AppState.playerId];

  // Move Orders (2026-08-21) — reachability, computed once per render rather
  // than per-Tile, then looked up O(1) below for each Tile's tier class/badge.
  // Non-Combat only (Combat keeps the plain adjacent-only tryMoveActor, no
  // range preview at all).
  let moveReach = null;
  if(AppState.moveSelectMode && !table.inEncounter){
    const moveActorId = AppState.moveSelectMode.actorId;
    const moveActor = resolveEntityRef(table, moveActorId);
    const moveOrigin = positions[moveActorId] || { x: 0, y: 0 };
    moveReach = computeReachable(table, moveOrigin, (moveActor && moveActor.ap) || 0);
  }

  // Build a lookup: tile index -> array of short labels occupying it.
  const occupants = {};
  Object.entries(positions).forEach(([id, pos]) => {
    if(!entities[id]) return;
    const idx = tileIndex(map, pos.x, pos.y);
    if(!occupants[idx]) occupants[idx] = [];
    occupants[idx].push(entities[id]);
  });

  // Mini-Party members share their Player Character's Tile — no position of
  // their own is tracked, they just ride along with whoever they belong to.
  // Exception: a Possessed member (from the Possess Technique) reflects a
  // real Enemy that's still a live entity in table.enemies/table.positions —
  // it already rendered at its own real Tile via the entities loop above,
  // so folding it into the Player's Tile too would double it up.
  Object.entries(table.players || {}).forEach(([id, p]) => {
    const pos = positions[id];
    if(!pos || !p.miniParty || !p.miniParty.length) return;
    const idx = tileIndex(map, pos.x, pos.y);
    p.miniParty.forEach(mp => {
      if(mp.sourceEnemyId) return; // already placed at its own Tile
      if(!occupants[idx]) occupants[idx] = [];
      occupants[idx].push({ name: mp.name || 'Follower', dead: false, facing: mp.facing || FACING_DEFAULT, side: 'player' });
    });
  });

  // Header row (compass corner + column numbers) and header column (row
  // letters) frame the actual tile grid — one extra row/column overall.
  // Two dedicated leading columns/rows (2026-08-17, dDd's own ASCII layout
  // sketch) for the compass + axis lines/heads, kept fully separate from the
  // actual tile grid's own corner/column-headers/row-headers rather than
  // sharing those cells — everything shifts down-right by one row/column
  // (COL_OFFSET/ROW_OFFSET below) to make room. Still one CSS Grid (dDd:
  // "they can all be part of the Tiles, but set aside somehow") — every
  // cell, including the header-block ones, is explicitly grid-placed rather
  // than relying on source-order auto-flow, since a grid this sparse (most
  // of row 1/column 1 is empty) can't be filled correctly by auto-flow alone.
  const COL_OFFSET = 3; // data tiles start at grid-column 3+1=4; column 3 is the row-letter header
  const ROW_OFFSET = 3; // data tiles start at grid-row 3+1=4; row 3 is the column-number header
  // Fixed pixel Tiles, not minmax(34px,1fr) (2026-08-20, dDd's catch — "it
  // should be designed to always have 7x7 as the view, instead of shrinking
  // or expanding"). The old 1fr sizing stretched every Tile to fill 60% of
  // the row's width regardless of map size, so a 7x7 Era 1 map rendered with
  // huge ~65px Tiles while the 14x14 Dev map rendered tiny ones — the Tile
  // grid was reactive to the *container*, not a fixed viewport. TILE_SIZE is
  // now a flat constant, identical at every map size and every screen width;
  // VIEWPORT_TILES caps how much of the grid is visible at once (see the
  // max-width/max-height block below) — anything beyond that scrolls, same
  // as before, just measured in a fixed Tile count instead of a floor.
  el.style.gridTemplateColumns = 'auto auto auto repeat(' + map.width + ', ' + TILE_SIZE + 'px)';
  // Tile rows stay `auto` (unchanged from the 2026-08-17 fix) — `auto` lets
  // each row size itself to its tallest content, which is exactly TILE_SIZE
  // since every Tile is aspect-ratio:1 against its now-fixed-width column.
  el.style.gridTemplateRows = 'auto auto auto repeat(' + map.height + ', auto)';

  // Compass + axis lines: N/W sit right by the compass (row2/col2), lines
  // run the full length of the tile grid, S/E land at the far edges — see
  // reference/CHANGELOG.md 2026-08-17 for the fix history. Rotation
  // (pressing the compass to cycle N/E/S/W and re-map the grid) is an
  // explicit reach item, not built yet — see reference/ROADMAP.md, Movement
  // System.
  let html =
    '<div class="map-corner" title="8-directional compass" style="grid-column:2; grid-row:2;"><span class="map-compass-icon">🧭</span></div>' +
    '<span class="map-axis-head n" style="grid-column:2; grid-row:1;">N</span>' +
    '<span class="map-axis-head w" style="grid-column:1; grid-row:2;">W</span>' +
    '<span class="map-axis-head e" style="grid-column:' + (COL_OFFSET + map.width) + '; grid-row:2;">E</span>' +
    '<span class="map-axis-head s" style="grid-column:2; grid-row:' + (ROW_OFFSET + map.height) + ';">S</span>' +
    '<div class="map-axis-line horizontal" style="grid-row:2; grid-column:3 / ' + (COL_OFFSET + map.width) + ';"></div>' +
    '<div class="map-axis-line vertical" style="grid-column:2; grid-row:3 / ' + (ROW_OFFSET + map.height) + ';"></div>' +
    // The tile grid's own corner — a bare "0", the placeholder this spot
    // used before the compass existed at all, now that the compass has its
    // own separate cell above.
    '<div class="map-corner map-corner-zero" style="grid-column:' + COL_OFFSET + '; grid-row:' + ROW_OFFSET + ';">0</div>';
  for(let x = 0; x < map.width; x++){
    html += '<div class="map-col-header" style="grid-column:' + (COL_OFFSET + 1 + x) + '; grid-row:' + ROW_OFFSET + ';">' + columnLabel(map, x) + '</div>';
  }

  for(let y = 0; y < map.height; y++){
    html += '<div class="map-row-header" style="grid-column:' + COL_OFFSET + '; grid-row:' + (ROW_OFFSET + 1 + y) + ';">' + rowLabel(map, y) + '</div>';
    for(let x = 0; x < map.width; x++){
      const idx = tileIndex(map, x, y);
      const blocked = !map.tiles[idx];
      const here = occupants[idx] || [];
      const occ = tileOccupancy(table, x, y);
      const crowdBlocked = isTileMovementBlocked(table, x, y);
      const edgeCls = occ.activeEnemies >= ACTIVE_CROWD_THRESHOLD ? ' edge-enemy'
        : occ.activeAllies >= ACTIVE_CROWD_THRESHOLD ? ' edge-ally' : '';
      const chunkCount = (map.chunks && map.chunks[idx]) || 0;
      // Move Orders (2026-08-21) — two shades of one color: dark for
      // reachable-this-Round (extraRounds 0), light for anything beyond that
      // but still within range (1-3). A Tile outside range (or blocked/
      // unreachable) gets neither — "looks the same as it already does," per
      // dDd, so no class/badge at all in that case.
      const moveInfo = moveReach && moveReach.get(idx);
      const moveCls = moveInfo ? (moveInfo.extraRounds === 0 ? ' move-immediate' : ' move-future') : '';
      const moveBadge = moveInfo
        ? (moveInfo.extraRounds === 0
            ? '<span class="move-badge move-badge-orb" title="Reachable this Round"></span>'
            : '<span class="move-badge move-badge-num" title="' + moveInfo.extraRounds + ' more Round' + (moveInfo.extraRounds === 1 ? '' : 's') + ' needed">' + moveInfo.extraRounds + '</span>')
        : '';
      const cls = 'map-tile' + (blocked ? ' blocked' : '') + (here.length ? ' occupied' : '') +
        (crowdBlocked ? ' crowd-blocked' : '') + edgeCls + (chunkCount >= 30 ? ' chunk-spill' : '') + moveCls;

      const dTier = downTier(occ.down);
      const cTier = chunkTier(chunkCount);
      const styleParts = [];
      if(dTier){ styleParts.push('--down-color:' + DOWN_GRADIENT[dTier - 1]); styleParts.push('--down-reach:' + DOWN_REACH[dTier - 1] + '%'); }
      if(cTier){ styleParts.push('--chunk-color:' + PINK_GRADIENT[cTier - 1]); styleParts.push('--chunk-reach:' + CHUNK_REACH[cTier - 1] + '%'); }
      styleParts.push('grid-column:' + (COL_OFFSET + 1 + x), 'grid-row:' + (ROW_OFFSET + 1 + y));
      const style = ' style="' + styleParts.join(';') + '"';

      // Facing (2026-08-22) — a single occupant renders as a rotated Triangle
      // (base indicating Facing) instead of a plain initial letter. A Tile
      // with more than one occupant keeps the old comma-letter-list for now —
      // multiple positioned Triangles on one Tile is the Mini-Tiles/Zoom
      // work (see reference/ROADMAP.md, Movement System's Map Evolution),
      // not yet built.
      const facingColor = here.length === 1 ? (here[0].side === 'enemy' ? FACING_COLOR_NPC : FACING_COLOR_PLAYER) : null;
      const label = here.length === 1
        ? '<span class="facing-marker" style="--facing-deg:' + FACING_DEGREES[here[0].facing || FACING_DEFAULT] + 'deg; --facing-color:' + facingColor + '"></span>'
        : (here.length ? escapeHtml(here.map(n => n.name[0]).join(',')) : '');
      const titleBits = here.map(n => n.name + (n.dead ? ' (dead)' : '')).join(', ');
      const titleMeta = (occ.down ? ' — ' + occ.down + ' Down' : '') + (chunkCount ? ' — ' + chunkCount + ' Chunks' : '');
      const popupHtml = (AppState.moveClickTile && AppState.moveClickTile.x === x && AppState.moveClickTile.y === y)
        ? buildTilePopups(table, x, y) : '';
      const selectableCls = AppState.moveSelectMode ? ' select-target' : '';
      const popupCls = popupHtml ? ' has-popup' : '';
      const selfBadge = (selfPos && selfPos.x === x && selfPos.y === y) ? '<span class="self-overlay" title="You"></span>' : '';
      html += '<div class="' + cls + selectableCls + popupCls + '" data-x="' + x + '" data-y="' + y + '"' + style + ' title="' +
        tileKey(map, x, y) + (titleBits ? ' — ' + escapeHtml(titleBits) : '') + escapeHtml(titleMeta) + '">' + label + moveBadge + selfBadge + popupHtml + '</div>';
    }
  }
  // Move Orders trail (2026-08-21) — a Tile-sized SVG overlay spanning the
  // whole grid, sitting above every Tile (pointer-events:none, so it never
  // steals a click). Its actual line content is filled in by updateMoveTrail
  // below, off AppState.moveHoverTile — geometry only needs TILE_SIZE/
  // TILE_GAP, the same constants the grid's own CSS Grid tracks use, so a
  // Tile's pixel center here always matches its real rendered position.
  const trailW = map.width * TILE_SIZE + (map.width - 1) * TILE_GAP;
  const trailH = map.height * TILE_SIZE + (map.height - 1) * TILE_GAP;
  html += '<svg id="move-trail-svg" style="grid-column:' + (COL_OFFSET + 1) + ' / span ' + map.width +
    '; grid-row:' + (ROW_OFFSET + 1) + ' / span ' + map.height + ';" viewBox="0 0 ' + trailW + ' ' + trailH + '"></svg>';
  el.innerHTML = html;

  // Cap the visible viewport to VIEWPORT_TILES x VIEWPORT_TILES (2026-08-20)
  // — measured off the real rendered header-block size (compass + axis
  // labels + row/column headers, columns/rows 1-3) rather than a hardcoded
  // guess, so this stays correct if that block's own look ever changes.
  // Read AFTER el.innerHTML is set, so `auto` sizing reflects real content.
  // A map smaller than the cap (nothing currently is, in every direction)
  // just renders at its own natural size — max-width/height only ever
  // shrinks-to-fit from above, never stretches a small grid up to it.
  const colTracks = getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat);
  const rowTracks = getComputedStyle(el).gridTemplateRows.split(' ').map(parseFloat);
  const headerW = colTracks.slice(0, COL_OFFSET).reduce((a, b) => a + b, 0) + COL_OFFSET * TILE_GAP;
  const headerH = rowTracks.slice(0, ROW_OFFSET).reduce((a, b) => a + b, 0) + ROW_OFFSET * TILE_GAP;
  // scrollbar-gutter:stable both-edges (css/panels.css) reserves real width
  // for the vertical scrollbar's gutter on BOTH the left and right edge —
  // real space taken out of the content box, on top of the Tiles
  // themselves, even for a map exactly VIEWPORT_TILES wide that never
  // actually needs to scroll. Measured live (scrollbarGutterWidth below)
  // and added on both sides so a 7-wide Scene like Era 1 still shows all 7
  // full Tiles instead of the gutter quietly eating into the last column.
  // The spec only covers the block/vertical axis — there's no equivalent
  // for a horizontal scrollbar's gutter, so maxHeight doesn't need this.
  el.style.maxWidth = (headerW + VIEWPORT_TILES * TILE_SIZE + VIEWPORT_TILES * TILE_GAP + 2 * scrollbarGutterWidth()) + 'px';
  el.style.maxHeight = (headerH + VIEWPORT_TILES * TILE_SIZE + VIEWPORT_TILES * TILE_GAP) + 'px';

  // Wire clicks once per render (simple; grid is small enough this is cheap).
  el.querySelectorAll('.map-tile').forEach(tile => {
    tile.onclick = () => handleTileClick(Number(tile.dataset.x), Number(tile.dataset.y));
  });
  el.querySelectorAll('.tile-popup[data-move-actor]').forEach(popup => {
    popup.onclick = (ev) => {
      ev.stopPropagation();
      AppState.moveSelectMode = { actorId: popup.dataset.moveActor };
      AppState.moveClickTile = null;
      renderMap();
    };
  });
  el.querySelectorAll('.tile-popup[data-suggest]').forEach(popup => {
    popup.onclick = (ev) => {
      ev.stopPropagation();
      AppState.moveClickTile = null;
      renderMap();
    };
  });

  const hint = document.getElementById('map-select-hint');
  const hintText = document.getElementById('map-select-hint-text');
  if(hint){
    hint.classList.toggle('hidden', !AppState.moveSelectMode);
    if(AppState.moveSelectMode && hintText){
      const actor = (table.players && table.players[AppState.moveSelectMode.actorId]) ||
        (table.enemies && table.enemies[AppState.moveSelectMode.actorId]);
      hintText.textContent = 'Choose a Tile to move ' + (actor && actor.name || 'them') + ' to.';
    }
  }

  // Move Orders trail hover (2026-08-21) — one delegated listener on the grid
  // itself rather than one per Tile, so hovering never has to fight a full
  // renderMap() rebuild mid-gesture. Only updates the trail SVG (see
  // updateMoveTrail), never re-renders the grid — cheap enough to run on
  // every mousemove.
  el.onmousemove = (ev) => {
    const tile = ev.target.closest('.map-tile');
    const x = tile ? Number(tile.dataset.x) : null;
    const y = tile ? Number(tile.dataset.y) : null;
    const cur = AppState.moveHoverTile;
    if(x === null || (cur && cur.x === x && cur.y === y)) return;
    AppState.moveHoverTile = tile ? { x, y } : null;
    updateMoveTrail();
  };
  el.onmouseleave = () => {
    if(!AppState.moveHoverTile) return;
    AppState.moveHoverTile = null;
    updateMoveTrail();
  };
  updateMoveTrail();
}

function tileCenterPx(x, y){
  return { cx: x * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2, cy: y * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2 };
}

// Redraws just the Move Orders trail line (see the SVG built in renderMap)
// off AppState.moveHoverTile — the one thing hovering the Map needs to
// update live without rebuilding every Tile.
function updateMoveTrail(){
  const svg = document.getElementById('move-trail-svg');
  if(!svg) return;
  const table = AppState.table;
  const hover = AppState.moveHoverTile;
  if(!hover || !AppState.moveSelectMode || !table || table.inEncounter){ svg.innerHTML = ''; return; }

  const actorId = AppState.moveSelectMode.actorId;
  const actor = resolveEntityRef(table, actorId);
  const mine = (table.positions || {})[actorId] || { x: 0, y: 0 };
  const reach = computeReachable(table, mine, (actor && actor.ap) || 0);
  const idx = tileIndex(table.map, hover.x, hover.y);
  if(!reach.has(idx)){ svg.innerHTML = ''; return; }

  const path = reconstructPath(table, reach, hover.x, hover.y);
  const points = [mine, ...path].map(p => tileCenterPx(p.x, p.y));
  const d = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.cx + ',' + p.cy).join(' ');
  svg.innerHTML = '<path d="' + d + '" class="move-trail-line"/>';
}

export function toggleMapEditMode(){
  AppState.mapEditMode = !AppState.mapEditMode;
  const btn = document.getElementById('map-edit-toggle');
  if(btn) btn.classList.toggle('toggled', AppState.mapEditMode);
}
