import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml } from './utils.js';

const DEFAULT_WIDTH = 10;
const DEFAULT_HEIGHT = 8;

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

function isAdjacent(a, b){
  const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
  return (dx + dy === 1);
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

  el.style.gridTemplateColumns = 'repeat(' + map.width + ', 1fr)';

  let html = '';
  for(let y = 0; y < map.height; y++){
    for(let x = 0; x < map.width; x++){
      const idx = tileIndex(map, x, y);
      const blocked = !map.tiles[idx];
      const here = occupants[idx] || [];
      const cls = 'map-tile' + (blocked ? ' blocked' : '') + (here.length ? ' occupied' : '');
      const label = here.length ? escapeHtml(here.map(n => n[0]).join(',')) : '';
      html += '<div class="' + cls + '" data-x="' + x + '" data-y="' + y + '" title="' +
        escapeHtml(here.join(', ')) + '">' + label + '</div>';
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
