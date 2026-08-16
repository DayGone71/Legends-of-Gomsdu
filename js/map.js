import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml, isDeathWounded, isDown } from './utils.js';

const DEFAULT_WIDTH = 9;
const DEFAULT_HEIGHT = 9;

export function defaultMap(){
  return {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    // 1 = traversable (white), 0 = blocked (black). Flat array, row-major.
    tiles: new Array(DEFAULT_WIDTH * DEFAULT_HEIGHT).fill(1),
    // Cosmetic-only (2026-08-16, see reference/ROADMAP.md's Chunk Mechanic):
    // how many "Chunks" have scattered onto each Tile from Characters that
    // died of Death Wounds there. Capped per addChunksAt below. No gameplay
    // effect yet — purely feeds the pink Tile-coloring gradient in renderMap.
    // (Credited on Death as the current proxy — true Obliteration, every Body
    // Part gone, is a separate not-yet-built check; see utils.js.)
    chunks: new Array(DEFAULT_WIDTH * DEFAULT_HEIGHT).fill(0)
  };
}

function tileIndex(map, x, y){
  return y * map.width + x;
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
// Enemy. Mini-Party members aren't counted — they have no position of their
// own yet (see reference/ROADMAP.md, Movement System item H).
function tileOccupancy(table, x, y){
  let down = 0, activeAllies = 0, activeEnemies = 0;
  Object.entries(table.positions || {}).forEach(([id, pos]) => {
    if(pos.x !== x || pos.y !== y) return;
    const player = table.players && table.players[id];
    const enemy = table.enemies && table.enemies[id];
    if(player){ if(isDown(player)) down++; else activeAllies++; }
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
  Object.entries(table.players || {}).forEach(([id, p]) => { out[id] = { name: p.name || 'Unnamed', dead: isDeathWounded(p) }; });
  Object.entries(table.enemies || {}).forEach(([id, e]) => { out[id] = { name: e.name || 'Enemy', dead: isDeathWounded(e) }; });
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

export async function handleTileClick(x, y){
  const table = AppState.table;
  if(!table || !table.map) return;

  if(AppState.mapEditMode){
    await mutateTable(t => {
      const idx = tileIndex(t.map, x, y);
      t.map.tiles[idx] = t.map.tiles[idx] ? 0 : 1;
    });
    return;
  }

  // Movement: must be traversable, adjacent to your current position, and
  // not too crowded to step into.
  const myId = AppState.playerId;
  const positions = table.positions || {};
  const mine = positions[myId] || { x: 0, y: 0 };
  const idx = tileIndex(table.map, x, y);
  if(!table.map.tiles[idx]) return; // blocked (Obstacle)
  if(!isAdjacent(mine, { x, y })) return; // not next to you
  if(isTileMovementBlocked(table, x, y)){ showBannerError('That Tile is too crowded to move into.'); return; }

  await mutateTable(t => {
    if(!t.positions) t.positions = {};
    t.positions[myId] = { x, y };
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
      occupants[idx].push({ name: mp.name || 'Follower', dead: false });
    });
  });

  // Header row (compass corner + column numbers) and header column (row
  // letters) frame the actual tile grid — one extra row/column overall.
  el.style.gridTemplateColumns = 'auto repeat(' + map.width + ', 1fr)';

  let html = '<div class="map-corner" title="8-directional compass">🧭</div>';
  for(let x = 0; x < map.width; x++){
    html += '<div class="map-col-header">' + columnLabel(map, x) + '</div>';
  }

  for(let y = 0; y < map.height; y++){
    html += '<div class="map-row-header">' + rowLabel(map, y) + '</div>';
    for(let x = 0; x < map.width; x++){
      const idx = tileIndex(map, x, y);
      const blocked = !map.tiles[idx];
      const here = occupants[idx] || [];
      const occ = tileOccupancy(table, x, y);
      const crowdBlocked = isTileMovementBlocked(table, x, y);
      const edgeCls = occ.activeEnemies >= ACTIVE_CROWD_THRESHOLD ? ' edge-enemy'
        : occ.activeAllies >= ACTIVE_CROWD_THRESHOLD ? ' edge-ally' : '';
      const chunkCount = (map.chunks && map.chunks[idx]) || 0;
      const cls = 'map-tile' + (blocked ? ' blocked' : '') + (here.length ? ' occupied' : '') +
        (crowdBlocked ? ' crowd-blocked' : '') + edgeCls + (chunkCount >= 30 ? ' chunk-spill' : '');

      const dTier = downTier(occ.down);
      const cTier = chunkTier(chunkCount);
      const styleParts = [];
      if(dTier){ styleParts.push('--down-color:' + DOWN_GRADIENT[dTier - 1]); styleParts.push('--down-reach:' + DOWN_REACH[dTier - 1] + '%'); }
      if(cTier){ styleParts.push('--chunk-color:' + PINK_GRADIENT[cTier - 1]); styleParts.push('--chunk-reach:' + CHUNK_REACH[cTier - 1] + '%'); }
      const style = styleParts.length ? ' style="' + styleParts.join(';') + '"' : '';

      const label = here.length ? escapeHtml(here.map(n => n.name[0]).join(',')) : '';
      const titleBits = here.map(n => n.name + (n.dead ? ' (dead)' : '')).join(', ');
      const titleMeta = (occ.down ? ' — ' + occ.down + ' Down' : '') + (chunkCount ? ' — ' + chunkCount + ' Chunks' : '');
      html += '<div class="' + cls + '" data-x="' + x + '" data-y="' + y + '"' + style + ' title="' +
        tileKey(map, x, y) + (titleBits ? ' — ' + escapeHtml(titleBits) : '') + escapeHtml(titleMeta) + '">' + label + '</div>';
    }
  }
  el.innerHTML = html;

  // Wire clicks once per render (simple; grid is small enough this is cheap).
  el.querySelectorAll('.map-tile').forEach(tile => {
    tile.onclick = () => handleTileClick(Number(tile.dataset.x), Number(tile.dataset.y));
  });
}

export function toggleMapEditMode(){
  AppState.mapEditMode = !AppState.mapEditMode;
  const btn = document.getElementById('map-edit-toggle');
  if(btn) btn.classList.toggle('toggled', AppState.mapEditMode);
}
