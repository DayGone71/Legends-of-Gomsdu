// Information Pillar / Mindeye — the place a Character's received Glyphs
// show up, per dDd. First real foothold in the actual game; only this one
// Pillar is exposed to the Player right now. Two screens inside the same
// panel: a Spotlight (the newest unseen Glyph, "the new Glyph should
// appear") and a Gallery (every received Glyph, "the screen with all
// Glyphs") — clicking the Spotlight's Glyph marks it seen and returns to
// the Gallery. The permanent origin Expression (GI + KRO + KROW ->
// yield-line -> Yield: GI) always sits first in the Gallery, with its own
// click-to-expand; anything Message sends is a single bare GI tile.

import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml, resolveEntityRef } from './utils.js';
import { TECHNIQUES, hasCategoryAccess } from './techniques.js';

let GLYPH_DATA = null;
try {
  const res = await fetch('/language/gomsdu-glyphic-system.json');
  GLYPH_DATA = await res.json();
} catch (err) {
  GLYPH_DATA = null;
}

// lookupGlyph/glyphMarkup/svgWrap exported (2026-08-23) — js/scripts.js's
// Saved Scripts / Scripts to Assign lists reuse these directly to render a
// Script's actual Glyphs ("Saved Scripts should display a rendering of the
// Script alongside some Compositions," per dDd) instead of duplicating this
// SVG-composition logic a second time — same "shared grammar over bespoke
// systems" principle the rest of this codebase already leans on.
function lookupPrimitive(id) {
  return GLYPH_DATA && GLYPH_DATA.primitives.find(p => p.id === id);
}
export function lookupGlyph(id) {
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

// One shared "card" for a Glyph / Expression / Composition (2026-08-23, per
// dDd), REBUILT as an actual port of language/gomsdu-glyph-arranger.html's
// real structure after the first pass got the shape wrong — read that file
// directly rather than guessing again. What the Arranger actually does:
// `#expressionGrid` is a CSS Grid, 3 columns (`grid-template-columns:
// repeat(3, auto)`), 9 Expression-columns auto-wrapping into 3 rows of 3 —
// THAT's what "3 rows and 3 columns" means, the grid of Expressions, not a
// single Expression's own Glyphs. Each Expression-column is its own
// vertical stack (the Arranger's `.expression-column`, `flex-direction:
// column`) of up to 3 Glyph slots (interleaved with Line slots there, which
// Scripts don't have). So: one Script `row` = one Expression = one grid
// COLUMN, its own Glyphs stacked vertically inside that column; multiple
// `rows` = multiple Expressions, laid out as columns SIDE BY SIDE
// (`grid-template-columns: repeat(rows.length, 1fr)`), not stacked
// underneath each other — that was the actual bug in the first version.
// `opts.nextRowIndex` (2026-08-23) — optional progress overlay, so this one
// card also serves as the Active Scripts status readout (js/scripts.js,
// js/personality.js's Plan section) instead of a separate plain-text list,
// per dDd: "a single Rectangular Button they all use." The Expression
// before it greys out (already delivered), the one at it highlights (next
// up); omitted for a plain preview (Write Script's live preview, Assign
// Script's picker list — nothing has "progress" yet at that point). `rows`
// is an array of Glyph-id arrays, same shape assignScript()/SAVED_SCRIPTS
// already use.
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

// The specific Glyph a Mindeye entry actually carries (2026-08-21, per dDd's
// Message Glyph picker) — falls back to plain GI for the permanent origin
// item and any older entry that predates this field.
function entryGlyphMarkup(entry) {
  const glyph = entry && entry.glyph && lookupGlyph(entry.glyph);
  return glyph ? svgWrap(glyphMarkup(glyph)) : giMarkup();
}
function entryGlyphName(entry) {
  const glyph = entry && entry.glyph && lookupGlyph(entry.glyph);
  return glyph ? glyph.id : 'GI';
}

// Inspect mode (2026-08-22, per dDd) — the viewing Player's own Character by
// default, or whichever Character AppState.inspectTargetId points at (a new
// NPC Panel row button, js/dm.js's renderNpcList). Read-only, and skips the
// Spotlight reveal animation entirely (see renderInformationPanel below) —
// that's the Player's own live "a new Glyph just arrived" experience, which
// doesn't mean anything the same way for someone inspecting a different
// Character's Mindeye after the fact.
function myCharacter(){
  const id = AppState.inspectTargetId || AppState.playerId;
  return resolveEntityRef(AppState.table, id);
}
function inspecting(){
  return !!AppState.inspectTargetId;
}

// Every Mindeye entry currently on the inspected/own Character, newest last.
// Gom's archetype special-case (a display-only synthesis of every real
// Glyph, faking "knows everything" without touching his actual mindeye) is
// gone as of 2026-08-23 — per dDd, it only existed because the real fix
// (seeding Gom's actual Mindeye with his innate Glyphs at spawn, so
// Behaviors/Face/etc. see the same knowledge the Information panel shows)
// was never built; keeping the special case after that real fix landed
// would just double up and break things further. Every Character, Gom
// included, reads its own real mindeye now — see js/scenes.js's Spawn List
// path and js/dm.js's addEnemy() for where his innate Glyphs actually land.
function myMindeye() {
  const me = myCharacter();
  return (me && me.mindeye) || [];
}

// Crafts Known (2026-08-21, per dDd) — a standing row on the Information
// panel listing every Craft-group Technique the viewed Character has access
// to, regardless of Mindeye state (reveal stage or Gallery). Visibility, not
// usability — per dDd: "Techniques aren't supposed to be globally available
// for anyone to use, but they should be all available to see by everyone."
function craftsKnownRow() {
  const me = myCharacter();
  const row = document.createElement('div');
  row.className = 'sheet';
  const known = me ? Object.entries(TECHNIQUES).filter(([key, def]) => def.group === 'Craft' && hasCategoryAccess(me, def)) : [];
  row.innerHTML = '<div class="stat-header">Crafts Known</div>' +
    (known.length
      ? '<div class="info-crafts-row">' + known.map(([key, def]) => '<div class="info-craft-chip">' + escapeHtml(def.name) + '</div>').join('') + '</div>'
      : '<div class="log-empty">No Crafts known.</div>');
  return row;
}

async function markSeen(entryId) {
  await mutateTable(t => {
    const me = t.players[AppState.playerId];
    if (!me || !me.mindeye) return;
    const entry = me.mindeye.find(e => e.id === entryId);
    if (entry) entry.seen = true;
  });
}

let originExpanded = false;
// Mindeye reveal (2026-08-20, dDd's spec, close to verbatim) — which unseen
// entry (if any) THIS browser has clicked into its split/Vesica-Piscis/
// Glyph-box sequence. Local-only, not synced — deliberately mirrors
// originExpanded's pattern: renderInformationPanel() re-runs on every table
// mutation (any Player's action, not just this one's), and without this the
// very next unrelated re-render would rebuild the Mindeye stage from
// scratch back in its pre-split state, killing the animation mid-reveal.
let revealingEntryId = null;

export function renderInformationPanel() {
  const container = document.getElementById('info-received-list');
  if (!container) return;

  if (!GLYPH_DATA) {
    container.innerHTML = '<div class="log-empty">Could not load the Glyphic System.</div>';
    return;
  }

  const unseen = inspecting() ? [] : myMindeye().filter(e => !e.seen);

  // The Mindeye Interface (2026-08-20, dDd's spec) — replaces the old plain
  // text spotlight entirely. Renders straight onto the panel's own dark
  // background (not the light .sheet parchment the Gallery below uses) —
  // white smoke needs a dark backdrop to read at all. Two stages:
  //  1. Resting: one small GI point with a compact, hazy smoke halo around
  //     it — "doesn't need to be much larger than the point."
  //  2. Split (revealingEntryId === this entry, set on click): the GI
  //     becomes two, one drifting up and one down, each towing its own
  //     smoke halo. The two halos are sized so each one's radius equals the
  //     distance between their two centers — the actual classic Vesica
  //     Piscis construction, not just a vague overlap — and a dark-purple/
  //     electric-blue box big enough for one Glyph fades into the lens
  //     between them. Clicking that box is what finally marks the entry
  //     seen and returns to the Gallery.
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
    container.appendChild(craftsKnownRow());

    // Both listeners are wired on every render, regardless of `revealing` —
    // not just the one relevant to the current stage. The split itself is
    // deliberately done by hand-toggling a class on the already-rendered
    // stage (below), not by calling renderInformationPanel() again, so the
    // browser has a real "before" state to transition smoothly from — which
    // means the Glyph box's own click listener would never get attached if
    // it only got wired on a fresh render that never actually happens.
    // Pointer-events stays none on the box until .split (see CSS), so
    // wiring it early is inert until the reveal actually gets there.
    stage.querySelector('.mindeye-gi-a').addEventListener('click', () => {
      if (revealingEntryId) return; // already mid-reveal, GI-a isn't clickable again
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

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  const me = myCharacter();
  sheet.innerHTML = (inspecting() ? '<div class="inspect-banner">Inspecting ' + escapeHtml((me && me.name) || 'Unnamed') + ' — read-only</div>' : '') +
    '<div class="stat-header">Received</div>';

  const gallery = document.createElement('div');
  gallery.className = 'info-gallery';

  const origin = document.createElement('div');
  origin.className = 'info-tile info-received-item' + (originExpanded ? ' open' : '');
  origin.title = originExpanded ? 'Click to collapse' : 'Click to reveal';
  if (!originExpanded) {
    origin.innerHTML = `<div class="info-glyph">${giMarkup()}</div>`;
  } else {
    const kro = lookupGlyph('KRO');
    const krow = lookupGlyph('KROW');
    const yieldLine = lookupPrimitive('yield-line');
    origin.innerHTML = `
      <div class="info-glyph">${giMarkup()}</div>
      <div class="info-glyph-label">GI</div>
      <div class="info-glyph">${svgWrap(glyphMarkup(kro))}</div>
      <div class="info-glyph-label">KRO</div>
      <div class="info-glyph">${svgWrap(glyphMarkup(krow))}</div>
      <div class="info-glyph-label">KROW</div>
      <div class="info-line">${svgWrap(primitiveMarkup(yieldLine))}</div>
      <div class="info-glyph">${giMarkup()}</div>
      <div class="info-glyph-label">Yield: GI</div>
    `;
  }
  origin.addEventListener('click', () => { originExpanded = !originExpanded; renderInformationPanel(); });
  gallery.appendChild(origin);

  myMindeye().forEach(entry => {
    const tile = document.createElement('div');
    tile.className = 'info-tile';
    tile.innerHTML = `<div class="info-glyph">${entryGlyphMarkup(entry)}</div><div class="info-glyph-label">${escapeHtml(entryGlyphName(entry))}</div><div class="info-tile-label">${escapeHtml(entry.from || 'Someone')}</div>`;
    gallery.appendChild(tile);
  });

  sheet.appendChild(gallery);
  container.innerHTML = '';
  container.appendChild(sheet);
  container.appendChild(craftsKnownRow());
}

// Whether the current Player's own Information toolbar button should be
// pulsing (Gom Colors, see css/panels.css) — any unseen Mindeye arrival.
// Fixed 2026-08-22, found live during playtesting (dDd: "My Information
// Panel started Glowing even though I shouldn't have any way of receiving
// Information from Living Stone... it shows up when I select the
// Personality Panels from the NPC list"): this called the same inspect-aware
// myMindeye() the rest of the panel uses, so inspecting an NPC with its own
// unseen mail lit up the Player's own toolbar button — always the viewing
// Player's real Mindeye here, deliberately bypassing inspect mode entirely.
export function hasUnseenMindeye() {
  const me = resolveEntityRef(AppState.table, AppState.playerId);
  return ((me && me.mindeye) || []).some(e => !e.seen);
}
