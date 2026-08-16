import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml } from './utils.js';

const DEFAULT_WIDTH = 9;
const DEFAULT_HEIGHT = 9;

export function defaultMap(){
  return {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    // 1 = traversable (white), 0 = blocked (black). Flat array, row-major.
    tiles: new Array(DEFAULT_WIDTH * DEFAULT_HEIGHT).fill(1)
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

// Sight-gating (2026-08-16, per dDd's worked example on the live map): a
// Technique's Range isn't just "distance <= N" — a blocked Tile anywhere on
// the straight line between caster and target cuts off everything beyond it,
// even tiles that would otherwise be well within Range. A wall *behind* the
// caster (not on the line to this particular target) has no effect — this is
// a per-target raycast, not "there's a wall somewhere nearby so watch out."
// Bresenham's line algorithm walks the actual Tile path between the two
// points; the caster's own Tile is never checked (you're not blocked by
// standing where you stand), everything after it is.
export function hasLineOfSight(map, from, to){
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
  }
}

function allEntities(table){
  const out = {};
  Object.entries(table.players || {}).forEach(([id, p]) => { out[id] = p.name || 'Unnamed'; });
  Object.entries(table.enemies || {}).forEach(([id, e]) => { if(e.wounds > 0) out[id] = e.name || 'Enemy'; });
  return out;
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

  // Movement: must be traversable and adjacent to your current position.
  const myId = AppState.playerId;
  const positions = table.positions || {};
  const mine = positions[myId] || { x: 0, y: 0 };
  const idx = tileIndex(table.map, x, y);
  if(!table.map.tiles[idx]) return; // blocked
  if(!isAdjacent(mine, { x, y })) return; // not next to you

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
      occupants[idx].push(mp.name || 'Follower');
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
      const cls = 'map-tile' + (blocked ? ' blocked' : '') + (here.length ? ' occupied' : '');
      const label = here.length ? escapeHtml(here.map(n => n[0]).join(',')) : '';
      html += '<div class="' + cls + '" data-x="' + x + '" data-y="' + y + '" title="' +
        tileKey(map, x, y) + (here.length ? ' — ' + escapeHtml(here.join(', ')) : '') + '">' + label + '</div>';
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
