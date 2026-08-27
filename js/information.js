// Information Pillar / Mindeye — the place a Character's received Glyphs
// show up. Two screens inside the same panel: a Spotlight (the newest unseen
// Glyph) and a Gallery (every received Glyph) — clicking the Spotlight's
// Glyph marks it seen and returns to the Gallery. The permanent origin
// Expression (GI + KRO + KROW -> yield-line -> Yield: GI) always sits first
// in the Gallery, with its own click-to-expand; anything Message sends is a single bare GI tile.

import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml, resolveEntityRef, mindeyeCategory } from './utils.js';

let GLYPH_DATA = null;
try {
  const res = await fetch('/language/gomsdu-glyphic-system.json');
  GLYPH_DATA = await res.json();
} catch (err) {
  GLYPH_DATA = null;
}

// Exported so scripts.js's Saved Scripts / Scripts to Assign lists can reuse
// these directly to render a Script's actual Glyphs, instead of duplicating this SVG-composition logic a second time.
function lookupPrimitive(id) {
  return GLYPH_DATA && GLYPH_DATA.primitives.find(p => p.id === id);
}
export function lookupGlyph(id) {
  return GLYPH_DATA && GLYPH_DATA.glyphs.find(g => g.id === id);
}

// Variety: which of the 4 kinds a real Glyph is. Not stored in the Glyphic
// System JSON itself (that file's own "category" field means
// composition-complexity — glyph/diglyph/triglyph — a different axis
// entirely) — a first-pass, best-effort static map built from each Glyph's
// authored `meaning`. Confirmed uncertain/worth revisiting: `BE` (only
// exists because the Glyph Designer had no delete button — not necessarily
// real canon), `W`/`M` (Facing Marks, not obviously any of the 4), the
// diagonals (KOR/ROK/POK/KOP, grouped with Directions on the strength of their own meaning text alone, never explicitly confirmed).
export const GLYPH_VARIETY = {
  // Directions — Movement Commands, First Era's 7 (once SUU ships in-game) plus the 4 diagonals.
  'RO / OR': 'directions', 'OP / PO': 'directions', 'KO': 'directions', 'OK': 'directions',
  'SUU': 'directions', 'KULOG': 'directions', 'KALAG': 'directions',
  'KOR': 'directions', 'ROK': 'directions', 'POK': 'directions', 'KOP': 'directions',
  // Targets — Characters/entities a Glyph can refer to.
  'KROW': 'targets', 'KRO': 'targets', 'GOM': 'targets', 'GO': 'targets',
  'KULKROW': 'targets', 'ZON': 'targets', 'ZIN': 'targets', 'YO': 'targets',
  // Actions — verbs, things a Character does. GOM is dual (Target and Idea)
  // but not dual into Actions; kept single-Variety here.
  'WIM': 'actions', 'KA': 'actions', 'OG': 'actions', 'S': 'actions', 'BA': 'actions',
  'OR': 'actions', 'MO': 'actions', 'DU': 'actions', 'KUL': 'actions',
  // Ideas — meta-language (describes WIMBIS itself) and abstract concepts.
  'GI': 'ideas', 'GeKA': 'ideas', 'GeKARAP': 'ideas', 'GeKARI': 'ideas',
  'WIMBIS': 'ideas', 'WIMZIN': 'ideas', 'GOMGOM': 'ideas', 'BIS': 'ideas',
  'W': 'ideas', 'M': 'ideas'
};
export const GLYPH_VARIETIES = [
  { key: 'directions', label: 'Directions' },
  { key: 'targets', label: 'Targets' },
  { key: 'actions', label: 'Actions' },
  { key: 'ideas', label: 'Ideas' }
];
export function varietyOf(glyphId){
  return GLYPH_VARIETY[glyphId] || 'ideas';
}

function primitiveMarkup(prim) {
  const r = prim && prim.render;
  if (!r) return '';
  const strokeAttrs = 'fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="square" stroke-linejoin="miter"';
  if (r.type === 'rect') return `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="${r.rx || 0}" ${strokeAttrs}/>`;
  if (r.type === 'path') return `<path d="${r.d}" ${strokeAttrs}/>`;
  if (r.type === 'multipath') return r.d.map(d => `<path d="${d}" ${strokeAttrs}/>`).join('');
  if (r.type === 'dots') return r.points.map(pt => `<circle cx="${pt.cx}" cy="${pt.cy}" r="${pt.r}" fill="currentColor"/>`).join('');
  return '';
}

export function glyphMarkup(glyph, depth = 0) {
  if (!glyph || !glyph.composition || depth > 6) return '';
  return glyph.composition.map(entry => {
    const pos = entry.position || [0.5, 0.5];
    const scale = entry.scale === undefined ? 1 : entry.scale;
    const rotation = entry.rotation || 0;
    const transform = `translate(${pos[0] * 100},${pos[1] * 100}) rotate(${rotation}) scale(${scale}) translate(-50,-50)`;
    let inner = '';
    if (entry.primitive) inner = primitiveMarkup(lookupPrimitive(entry.primitive));
    else if (entry.glyph) inner = glyphMarkup(lookupGlyph(entry.glyph), depth + 1);
    return `<g transform="${transform}">${inner}</g>`;
  }).join('');
}

export function svgWrap(inner) {
  return `<svg viewBox="0 0 100 100">${inner}</svg>`;
}

// One shared "card" for a Glyph / Expression / Composition — a real port of
// language/gomsdu-glyph-arranger.html's actual structure. What the Arranger
// does: `#expressionGrid` is a CSS Grid, 3 columns, 9 Expression-columns
// auto-wrapping into 3 rows of 3 — that's what "3 rows and 3 columns" means,
// the grid of Expressions, not a single Expression's own Glyphs. Each
// Expression-column is its own vertical stack of up to 3 Glyph slots. So:
// one Script `row` = one Expression = one grid COLUMN, its own Glyphs
// stacked vertically inside that column; multiple `rows` = multiple
// Expressions, laid out as columns SIDE BY SIDE, not stacked underneath each other.
// `opts.nextRowIndex` — optional progress overlay, so this one card also
// serves as the Active Scripts status readout (scripts.js, personality.js's
// Plan section) instead of a separate plain-text list. The Expression before
// it greys out (already delivered), the one at it highlights (next up);
// omitted for a plain preview (Write Script's live preview, Assign Script's
// picker list — nothing has "progress" yet at that point). `rows` is an
// array of Glyph-id arrays, same shape assignScript()/SAVED_SCRIPTS already use.
export function compositionCardHtml(rows, opts) {
  const nextRowIndex = opts && opts.nextRowIndex;
  const real = (rows || []).map(r => (r || []).filter(Boolean)).filter(r => r.length);
  if (!real.length) return '<div class="composition-card composition-card-empty">—</div>';
  const isSingleGlyph = real.length === 1 && real[0].length === 1;
  const columnsHtml = real.map((row, i) => {
    const stateClass = nextRowIndex == null ? '' : i < nextRowIndex ? ' composition-expr-done' : i === nextRowIndex ? ' composition-expr-next' : '';
    return '<div class="composition-expression' + stateClass + '">' +
      row.map(g => {
        const glyph = lookupGlyph(g);
        return '<span class="composition-glyph" title="' + escapeHtml(g) + '">' +
          (glyph ? svgWrap(glyphMarkup(glyph)) : escapeHtml(g)) + '</span>';
      }).join('') +
    '</div>';
  }).join('');
  const sizeClass = isSingleGlyph ? 'composition-card-glyph' : 'composition-card-grid';
  const gridStyle = isSingleGlyph ? '' : ' style="grid-template-columns:repeat(' + real.length + ',1fr);"';
  return '<div class="composition-card ' + sizeClass + '"' + gridStyle + '>' + columnsHtml + '</div>';
}

function giMarkup() {
  return svgWrap(glyphMarkup(lookupGlyph('GI')));
}

// The specific Glyph a Mindeye entry actually carries — falls back to plain
// GI for the permanent origin item and any older entry that predates this field.
export function entryGlyphMarkup(entry) {
  const glyph = entry && entry.glyph && lookupGlyph(entry.glyph);
  return glyph ? svgWrap(glyphMarkup(glyph)) : giMarkup();
}
export function entryGlyphName(entry) {
  const glyph = entry && entry.glyph && lookupGlyph(entry.glyph);
  return glyph ? glyph.id : 'GI';
}

// Inspect mode: the viewing Player's own Character by default, or whichever
// Character AppState.inspectTargetId points at (an NPC Panel row button,
// dm.js's renderNpcList). Read-only, and skips the Spotlight reveal
// animation entirely (see renderGlyphColumn below) — that's the Player's own
// live "a new Glyph just arrived" experience, which doesn't mean anything
// the same way for someone inspecting a different Character's Mindeye after the fact.
function myCharacter(){
  const id = AppState.inspectTargetId || AppState.playerId;
  return resolveEntityRef(AppState.table, id);
}
function inspecting(){
  return !!AppState.inspectTargetId;
}

// Every Mindeye entry currently on the inspected/own Character, newest last.
// Every Character, Gom included, reads its own real mindeye — see
// scenes.js's Spawn List path and dm.js's addEnemy() for where his innate
// Glyphs actually land.
export function myMindeye() {
  const me = myCharacter();
  return (me && me.mindeye) || [];
}

// Crafts Known was retired from here — it belongs on the Character Sheet.
// Not rebuilt there yet (the sheet's own UI is on hold until Second Era) —
// a real gap, not silently dropped, just not owned by the Personality Panel anymore.

async function markSeen(entryId) {
  await mutateTable(t => {
    const me = t.players[AppState.playerId];
    if (!me || !me.mindeye) return;
    const entry = me.mindeye.find(e => e.id === entryId);
    if (entry) entry.seen = true;
  });
}

let originExpanded = false;
// Which unseen entry (if any) THIS browser has clicked into its
// split/Vesica-Piscis/Glyph-box sequence. Local-only, not synced — without
// this the very next unrelated re-render would rebuild the Mindeye stage
// from scratch back in its pre-split state, killing the animation mid-reveal.
let revealingEntryId = null;

// Which remembered Glyph the unified Personality Panel's bottom-quarter
// detail view is currently showing — local UI state, same pattern as
// revealingEntryId/originExpanded above. personality.js reads this via
// getSelectedGlyphEntryId() to render the detail panel; selecting happens
// here since this module owns the Glyph list's own click handlers.
let selectedGlyphEntryId = null;
export function getSelectedGlyphEntryId(){ return selectedGlyphEntryId; }

// The Glyph list — grouped by Variety (Directions/Targets/Actions/Ideas)
// instead of one flat wrapping grid, optionally filtered to one Memory
// Category at a time. Renders into whatever container the caller hands it
// (the Personality Panel's left column). The Mindeye reveal (an unseen
// arrival) still takes over the whole column when there is one — a new Glyph is always the first thing shown, filter or no filter.
export function renderGlyphColumn(container, memoryFilter, onChange) {
  if (!container) return;
  if (!GLYPH_DATA) {
    container.innerHTML = '<div class="log-empty">Could not load the Glyphic System.</div>';
    return;
  }

  const unseen = inspecting() ? [] : myMindeye().filter(e => !e.seen);

  // The Mindeye Interface — a real animated reveal (smoke → split → Vesica
  // Piscis → Glyph box) instead of a text caption.
  //  1. Resting: one small GI point with a compact, hazy smoke halo.
  //  2. Split (revealingEntryId === this entry, set on click): the GI
  //     becomes two, each towing its own smoke halo sized so its radius
  //     equals the distance between the two centers (a real Vesica Piscis),
  //     with a Glyph box fading in between. Clicking that box marks the entry seen and returns to the normal Glyph list.
  if (unseen.length) {
    const newest = unseen[unseen.length - 1];
    const revealing = revealingEntryId === newest.id;
    const stage = document.createElement('div');
    stage.className = 'mindeye-stage' + (revealing ? ' split' : '');
    stage.innerHTML = `
      <div class="mindeye-smoke mindeye-smoke-a"></div>
      <div class="mindeye-smoke mindeye-smoke-b"></div>
      <div class="mindeye-glyph-box">${entryGlyphMarkup(newest)}</div>
      <div class="mindeye-gi mindeye-gi-a">${giMarkup()}</div>
      <div class="mindeye-gi mindeye-gi-b">${giMarkup()}</div>
      <div class="mindeye-caption">${revealing ? escapeHtml(newest.from || 'Someone') + ' sent a Message' : 'Click to open Mindeye'}</div>
    `;
    container.innerHTML = '';
    container.appendChild(stage);
    stage.querySelector('.mindeye-gi-a').addEventListener('click', () => {
      if (revealingEntryId) return;
      revealingEntryId = newest.id;
      stage.classList.add('split');
      stage.querySelector('.mindeye-caption').textContent = (newest.from || 'Someone') + ' sent a Message';
    });
    stage.querySelector('.mindeye-glyph-box').addEventListener('click', () => {
      revealingEntryId = null;
      markSeen(newest.id);
    });
    return;
  }

  container.innerHTML = '';
  const me = myCharacter();
  if (inspecting()) {
    const banner = document.createElement('div');
    banner.className = 'inspect-banner';
    banner.textContent = 'Inspecting ' + escapeHtml((me && me.name) || 'Unnamed') + ' — read-only';
    container.appendChild(banner);
  }

  // Permanent origin Expression (GI + KRO + KROW -> yield-line -> Yield: GI)
  // — its own click-to-expand tile, pinned above the filtered/grouped list
  // rather than folded into any one Variety (it isn't a real remembered
  // Glyph, it's the Language's own origin story).
  const origin = document.createElement('div');
  origin.className = 'glyph-tile glyph-tile-origin' + (originExpanded ? ' open' : '');
  origin.title = originExpanded ? 'Click to collapse' : 'Click to reveal';
  if (!originExpanded) {
    origin.innerHTML = `<div class="glyph-tile-icon">${giMarkup()}</div>`;
  } else {
    const kro = lookupGlyph('KRO');
    const krow = lookupGlyph('KROW');
    const yieldLine = lookupPrimitive('yield-line');
    origin.innerHTML = `
      <div class="glyph-tile-icon">${giMarkup()}</div><span class="glyph-tile-label">GI</span>
      <div class="glyph-tile-icon">${svgWrap(glyphMarkup(kro))}</div><span class="glyph-tile-label">KRO</span>
      <div class="glyph-tile-icon">${svgWrap(glyphMarkup(krow))}</div><span class="glyph-tile-label">KROW</span>
      <div class="info-line">${svgWrap(primitiveMarkup(yieldLine))}</div>
      <div class="glyph-tile-icon">${giMarkup()}</div><span class="glyph-tile-label">Yield: GI</span>
    `;
  }
  origin.addEventListener('click', () => { originExpanded = !originExpanded; if (onChange) onChange(); });
  container.appendChild(origin);

  // Grouped by Variety, stacking vertically, each optionally narrowed to one
  // Memory Category first — the Filters personality.js renders above this container.
  const mindeye = myMindeye().filter(e => !memoryFilter || mindeyeCategory(e.retention) === memoryFilter);
  const grouped = { directions: [], targets: [], actions: [], ideas: [] };
  mindeye.forEach(entry => grouped[varietyOf(entry.glyph)].push(entry));

  GLYPH_VARIETIES.forEach(variety => {
    const entries = grouped[variety.key];
    if (!entries.length) return;
    const header = document.createElement('div');
    header.className = 'glyph-variety-header';
    header.textContent = variety.label;
    container.appendChild(header);

    const row = document.createElement('div');
    row.className = 'glyph-variety-row';
    entries.forEach(entry => {
      const tile = document.createElement('div');
      tile.className = 'glyph-tile' + (entry.id === selectedGlyphEntryId ? ' selected' : '');
      tile.title = entryGlyphName(entry) + ' — ' + mindeyeCategory(entry.retention);
      tile.innerHTML = `<div class="glyph-tile-icon">${entryGlyphMarkup(entry)}</div><span class="glyph-tile-label">${escapeHtml(entryGlyphName(entry))}</span>`;
      tile.addEventListener('click', () => { selectedGlyphEntryId = entry.id; if (onChange) onChange(); });
      row.appendChild(tile);
    });
    container.appendChild(row);
  });

  if (!mindeye.length) {
    const empty = document.createElement('div');
    empty.className = 'log-empty';
    empty.textContent = memoryFilter ? 'Nothing in ' + memoryFilter + ' yet.' : 'No Glyphs remembered yet.';
    container.appendChild(empty);
  }
}

// Whether the current Player's own Personality toolbar button should be
// pulsing — any unseen Mindeye arrival. Always the viewing Player's real
// Mindeye here, deliberately bypassing inspect mode entirely — otherwise
// inspecting an NPC with its own unseen mail would light up the Player's own toolbar button.
export function hasUnseenMindeye() {
  const me = resolveEntityRef(AppState.table, AppState.playerId);
  return ((me && me.mindeye) || []).some(e => !e.seen);
}
