// Relationships Pillar — first real foothold (2026-08-21, per dDd), mirroring
// Information/Personality's own build pattern. Remembered Glyphs (the same
// Mindeye data Information shows) sit in a horizontal row at the top;
// selecting one reveals how this Character feels about it — Attachment
// (Connected/Mid/Separated) and Desire (Desirable/Mid/Undesirable), each a
// 3-position Axis. Per dDd's own Notebook, both are per-piece-of-Information,
// not Character-global: "Attachment is how fond they are of a piece of
// Information... Desire is how intently they are pursuing a piece of
// Information" — so both live directly on the Mindeye entry itself, not on
// the Character.
//
// Own independent Glyphic System fetch + render helpers, same convention
// js/information.js and js/techniques.js already each use rather than a
// shared loader module.

import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml } from './utils.js';

let GLYPH_DATA = null;
try {
  const res = await fetch('/language/gomsdu-glyphic-system.json');
  GLYPH_DATA = await res.json();
} catch (err) {
  GLYPH_DATA = null;
}

function lookupPrimitive(id) {
  return GLYPH_DATA && GLYPH_DATA.primitives.find(p => p.id === id);
}
function lookupGlyph(id) {
  return GLYPH_DATA && GLYPH_DATA.glyphs.find(g => g.id === id);
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
function glyphMarkup(glyph, depth = 0) {
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
function svgWrap(inner) {
  return `<svg viewBox="0 0 100 100">${inner}</svg>`;
}
function entryGlyphMarkup(entry) {
  const glyph = entry && entry.glyph && lookupGlyph(entry.glyph);
  return svgWrap(glyphMarkup(glyph || lookupGlyph('GI')));
}
function entryGlyphName(entry) {
  const glyph = entry && entry.glyph && lookupGlyph(entry.glyph);
  return glyph ? glyph.id : 'GI';
}

function myMindeye() {
  const me = AppState.table && AppState.table.players[AppState.playerId];
  return (me && me.mindeye) || [];
}

// Local-only, mirrors information.js's originExpanded/revealingEntryId
// pattern — which remembered Glyph the Axes below are currently showing.
let selectedEntryId = null;

async function setAxisValue(entryId, field, value) {
  await mutateTable(t => {
    const me = t.players[AppState.playerId];
    const entry = me && me.mindeye && me.mindeye.find(e => e.id === entryId);
    if (entry) entry[field] = value;
  });
}

function renderAxis(name, leftLabel, rightLabel, field, entry) {
  const value = entry[field] ?? 1;
  const el = document.createElement('div');
  el.className = 'rel-axis';
  el.innerHTML = `
    <div class="rel-axis-name">${escapeHtml(name)}</div>
    <div class="rel-axis-3way">
      <button class="rel-pole-btn${value === 0 ? ' active' : ''}" data-val="0">${escapeHtml(leftLabel)}</button>
      <button class="rel-pole-btn mid${value === 1 ? ' active' : ''}" data-val="1">Mid</button>
      <button class="rel-pole-btn${value === 2 ? ' active' : ''}" data-val="2">${escapeHtml(rightLabel)}</button>
    </div>
  `;
  el.querySelectorAll('.rel-pole-btn').forEach(btn => {
    btn.addEventListener('click', () => setAxisValue(entry.id, field, Number(btn.dataset.val)));
  });
  return el;
}

export function renderRelationshipsPanel() {
  const container = document.getElementById('relationships-content');
  if (!container) return;

  if (!GLYPH_DATA) {
    container.innerHTML = '<div class="log-empty">Could not load the Glyphic System.</div>';
    return;
  }

  const mindeye = myMindeye();
  if (selectedEntryId && !mindeye.some(e => e.id === selectedEntryId)) selectedEntryId = null;
  if (!selectedEntryId && mindeye.length) selectedEntryId = mindeye[mindeye.length - 1].id;

  container.innerHTML = '';

  const rowSheet = document.createElement('div');
  rowSheet.className = 'sheet';
  rowSheet.innerHTML = '<div class="stat-header">Remembered Glyphs</div>';
  const gallery = document.createElement('div');
  gallery.className = 'info-gallery';
  if (!mindeye.length) {
    gallery.innerHTML = '<div class="log-empty">No Glyphs remembered yet.</div>';
  } else {
    mindeye.forEach(entry => {
      const tile = document.createElement('div');
      tile.className = 'info-tile' + (entry.id === selectedEntryId ? ' selected' : '');
      tile.innerHTML = `<div class="info-glyph">${entryGlyphMarkup(entry)}</div><div class="info-glyph-label">${escapeHtml(entryGlyphName(entry))}</div>`;
      tile.addEventListener('click', () => { selectedEntryId = entry.id; renderRelationshipsPanel(); });
      gallery.appendChild(tile);
    });
  }
  rowSheet.appendChild(gallery);
  container.appendChild(rowSheet);

  const axisSheet = document.createElement('div');
  axisSheet.className = 'sheet';
  const selected = mindeye.find(e => e.id === selectedEntryId);
  if (selected) {
    axisSheet.innerHTML = '<div class="stat-header">Feelings toward ' + escapeHtml(entryGlyphName(selected)) + '</div>';
    axisSheet.appendChild(renderAxis('Attachment', 'Connected', 'Separated', 'attachment', selected));
    axisSheet.appendChild(renderAxis('Desire', 'Desirable', 'Undesirable', 'desire', selected));
  } else {
    axisSheet.innerHTML = '<div class="log-empty">Select a Glyph above to see how this Character feels about it.</div>';
  }
  container.appendChild(axisSheet);
}
