// Scripts — "a series of instructions to send to an NPC." Two real, distinct
// mechanisms live here:
//
// 1. `dispatchScript()` — an immediate, uncapped, one-shot send: every Glyph
//    in the list delivered right now, in order.
// 2. `assignScript()` / `actor.activeScripts` — real tracked state: an
//    ordered list of Rows (each Row up to 3 Glyphs, matching Message's own
//    cap — a Row delivers in one Message), a Target, and how far delivery
//    has gotten. This is what the Teach Behavior (WIM — behaviors.js,
//    resolved in noncombat.js) actually advances, one Row per roll, only
//    moving to the next Row once the current one's Outcome has landed. Up
//    to 3 Scripts can be active at once per Actor, each its own slot/Target
//    — a single Teach roll still only advances one Row total, from the
//    first not-yet-complete slot. Assigning a Script is still a manual,
//    orchestrated act — Behavior only ever *advances* a Script that's already been assigned, it never creates one for itself.

import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { deliverMindeyeEntry, timeNow, escapeHtml, genId, resolveEntityRef, allCharacterRoster, knownGlyphIds, showBannerError } from './utils.js';
import { glyphOptionsHtml } from './techniques.js';
import { compositionCardHtml } from './information.js';

// Whether a Character actually knows a given Glyph — the gate a real
// Script/Behavior dispatch will eventually need to respect. Not enforced
// anywhere yet. "Knowing" means having a real Mindeye entry for it.
export function knowsGlyph(actor, glyphId){
  return knownGlyphIds(actor).includes(glyphId);
}

// Delivers every Glyph in a Script, in order, as that many separate Mindeye
// entries — same mechanism a multi-Glyph Message already uses, just
// uncapped. Mutates the table directly and logs one combined Ledger line —
// call from inside a mutateTable() callback.
export function dispatchScript(table, script){
  const { senderName, targetId, targetName, glyphs } = script;
  (glyphs || []).forEach(g => deliverMindeyeEntry(table, targetId, senderName || 'Someone', g));
  if(table && table.log){
    table.log.push({
      type: 'system',
      text: (senderName || 'Someone') + ' sends a Script to ' + (targetName || 'someone') + ' (' + (glyphs || []).length + ' Glyph' + ((glyphs || []).length === 1 ? '' : 's') + ').',
      time: timeNow()
    });
  }
}

// Saved Scripts — named presets, pre-authored the same plain-object-literal
// convention character.js's BUILDS and techniques.js's TECHNIQUES already
// use, folded into Assign Script's own picker list.
//
// `gomTeachesMovement` is dDd's own 9-Expression Composition: Expressions 1
// and 3 are empty by design (skipped, not sent as blank Messages); each
// remaining Expression's up-to-3 Glyphs becomes one Row/Message here, in
// dDd's own strict delivery order. One simplification, flagged rather than
// hidden: dDd's own spec bundles Expressions 4+6 together into one Round and
// 7+8+9 into a further one, each Round's Messages sent together — the
// current Teach Behavior only ever delivers one Row per successful roll, so
// this preset instead sends all 6 Messages strictly in the same order, just
// not necessarily landing in the same Round together. Real Round-bundling is a genuinely bigger mechanical change, not guessed at here.
export const SAVED_SCRIPTS = {
  gomTeachesMovement: {
    name: 'Gom — 9-Expression Composition (Movement + Face)',
    rows: [
      ['WIM', 'KROW', 'RO / OR'],
      ['WIM', 'KROW', 'OK'],
      ['WIM', 'KROW', 'KO'],
      ['WIM', 'KROW', 'KALAG'],
      ['WIM', 'KROW', 'OP / PO'],
      ['WIM', 'KROW', 'KULOG']
    ]
  },
  // A second Composition, same format/simplification as gomTeachesMovement
  // above. Ties directly into the Intelligence-gain mechanic (contemplating
  // KA+KRO+M together in one Round) — see ROADMAP.md's Personality/Behaviors section, not yet built.
  gomTeachesFocus: {
    name: 'Gom — 9-Expression Composition (Focus: KA/KRO/M)',
    rows: [
      ['WIM', 'KROW', 'KA'],
      ['WIM', 'KROW', 'KRO'],
      ['WIM', 'KROW', 'M']
    ]
  }
};

// Assigns a real, tracked, multi-Round Script onto one of the actor's up to
// 3 concurrent activeScripts slots — the Teach Behavior is what actually
// delivers it, one Row per roll, from whichever slot isn't complete yet.
// `rows` is an array of Glyph-id arrays, each up to 3; `targetId`/
// `targetName` is who receives every Row. Adds a new slot rather than
// overwriting — up to 3 different Scripts (different Targets, even) can run
// at once. Returns false (caller's job to surface it) if all 3 slots are
// already full. Call from inside a mutateTable() callback, same as dispatchScript above.
export function assignScript(actor, { targetId, targetName, rows }){
  if(!actor || !targetId || !rows || !rows.length) return false;
  if(!actor.activeScripts) actor.activeScripts = [];
  if(actor.activeScripts.length >= 3) return false;
  actor.activeScripts.push({ targetId, targetName, rows, nextRow: 0 });
  return true;
}

// --- Script Panel --------------------------------------------------------
// Two sheets:
// - Write Script — the Expression builder (reusing techniques.js's own
//   glyphOptionsHtml() rather than duplicating it), all 3 Expressions always
//   visible. Each Expression's up-to-3 Glyphs stack vertically, with a live
//   preview (information.js's compositionCardHtml()) so what's being built
//   reads the same way it will everywhere else. No Character/Target of its
//   own — a Script's content doesn't belong to anyone until it's actually
//   assigned. Saves onto t.writtenScripts, a shared, table-persisted pool so every connected Player sees the same list.
// - Assign Script — Character (who acts) + Target (who receives) + one
//   merged picker list combining SAVED_SCRIPTS (pre-authored) and
//   t.writtenScripts (Player-authored) into a single list. Every picker card
//   renders via the same shared compositionCardHtml() component, reused
//   again for the Active Scripts status readout below (with its own progress overlay).
// Local-only form state throughout, same pattern every other panel's
// transient picker state already uses (information.js's revealingEntryId, relationships.js's selectedEntryId).
let builderActorId = null;
let builderTargetId = null;
// Write Script's own local state — 3 fixed Expression slots, no Add/Remove.
let writeBuilderRows = [[null, null, null], [null, null, null], [null, null, null]];
let writeBuilderName = '';
// Which entry in the merged picker list (preset or written) is currently
// selected in Assign Script — `'preset:<key>'` or a written Script's own id.
let assignSelectedId = null;

// Deep-compares two Row lists (arrays of Glyph-id arrays) — used to tell
// whether a candidate Target already has *this* Script (not just any
// Script) actively assigned.
function rowsEqual(a, b){
  if(!a || !b || a.length !== b.length) return false;
  return a.every((row, i) => row.length === (b[i] || []).length && row.every((g, j) => g === b[i][j]));
}

// Whether charId is *already the recipient* of an in-progress instance of
// any of the given candidate Row lists — read literally as *this* Script,
// not "has any Script at all," so a Character can still receive a different
// one. `activeScripts` lives on whoever is TEACHING it, not on the
// recipient — a Living Stone being taught has no field of its own recording
// that; the only way to know is to check every real Actor's own slots for one whose targetId is charId.
function targetAlreadyHasScript(table, charId, candidateRowsList){
  const actors = [...Object.values(table.players || {}), ...Object.values(table.enemies || {})];
  return actors.some(a => (a.activeScripts || []).some(s => s.targetId === charId &&
    candidateRowsList.some(rows => rows && rows.length && rowsEqual(s.rows, rows))));
}

// Every pickable Script — Saved (pre-authored) first, then whatever's been
// Written this session, one merged list. `rows` arrays are shared references
// into SAVED_SCRIPTS/t.writtenScripts, never mutated here.
function allAssignableScripts(table){
  const presets = Object.entries(SAVED_SCRIPTS).map(([key, s]) => ({ id: 'preset:' + key, name: s.name, rows: s.rows }));
  const written = table.writtenScripts || [];
  return [...presets, ...written];
}

function writeScriptSheet(){
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  // Expression columns, side by side — a real port of
  // language/gomsdu-glyph-arranger.html's own #expressionGrid: up to 3
  // Expressions as grid COLUMNS, each column's own up-to-3 Glyphs stacked vertically inside it.
  const columnsHtml = writeBuilderRows.map((row, r) =>
    '<div class="write-expression-column">' +
      '<div class="write-expression-label">Expression ' + (r + 1) + '</div>' +
      '<select class="write-glyph-select" data-row="' + r + '" data-slot="0">' + glyphOptionsHtml(false, row[0]) + '</select>' +
      '<select class="write-glyph-select" data-row="' + r + '" data-slot="1">' + glyphOptionsHtml(true, row[1]) + '</select>' +
      '<select class="write-glyph-select" data-row="' + r + '" data-slot="2">' + glyphOptionsHtml(true, row[2]) + '</select>' +
    '</div>'
  ).join('');
  sheet.innerHTML =
    '<div class="stat-header">Write Script</div>' +
    '<div class="field"><label>Name (optional)</label>' +
      '<input type="text" id="write-script-name" placeholder="Leave blank to auto-name" value="' + escapeHtml(writeBuilderName) + '" /></div>' +
    '<div class="field"><label>Preview</label>' + compositionCardHtml(writeBuilderRows) + '</div>' +
    '<div class="write-expression-grid">' + columnsHtml + '</div>' +
    '<button class="btn-brass btn-block" id="write-script-save-btn" style="margin-top:10px;">Save Script</button>';

  sheet.querySelector('#write-script-name').addEventListener('input', ev => { writeBuilderName = ev.target.value; });
  sheet.querySelectorAll('.write-glyph-select').forEach(sel => {
    sel.addEventListener('change', ev => {
      const r = Number(ev.target.dataset.row), s = Number(ev.target.dataset.slot);
      writeBuilderRows[r][s] = ev.target.value || null;
      renderScriptsPanel();
    });
  });
  sheet.querySelector('#write-script-save-btn').addEventListener('click', saveWrittenScript);
  return sheet;
}

async function saveWrittenScript(){
  const rows = writeBuilderRows.map(row => row.filter(Boolean)).filter(row => row.length);
  if(!rows.length){ showBannerError('Add at least one Glyph to an Expression first.'); return; }
  const name = writeBuilderName.trim() || rows.map(r => r.join('+')).join(' / ');
  await mutateTable(t => {
    if(!t.writtenScripts) t.writtenScripts = [];
    t.writtenScripts.push({ id: genId(), name, rows });
  });
  writeBuilderRows = [[null, null, null], [null, null, null], [null, null, null]];
  writeBuilderName = '';
  renderScriptsPanel();
}

function assignScriptSheet(allScripts, selected, optionsHtml, targetOptionsHtml){
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML =
    '<div class="stat-header">Assign Script</div>' +
    '<div class="field"><label>Character (who acts)</label>' +
    '<select id="script-actor-select">' + optionsHtml(builderActorId) + '</select></div>' +
    '<div class="field"><label>Target (who receives)</label>' +
    '<select id="script-target-select">' + targetOptionsHtml(builderTargetId) + '</select></div>' +
    '<div class="field"><label>Script to Assign</label>' +
    (allScripts.length
      ? '<div class="script-picker-list">' + allScripts.map(s =>
          '<button type="button" class="script-picker-item' + (selected && s.id === selected.id ? ' selected' : '') + '" data-script-id="' + s.id + '">' +
            '<div class="script-picker-name">' + escapeHtml(s.name) + '</div>' +
            compositionCardHtml(s.rows) +
          '</button>'
        ).join('') + '</div>'
      : '<div class="log-empty">Nothing to assign yet — use Write Script above.</div>') +
    '</div>' +
    '<button class="btn-brass btn-block" id="script-assign-btn" style="margin-top:10px;"' + (!selected ? ' disabled' : '') + '>Assign Script</button>';

  sheet.querySelector('#script-actor-select').addEventListener('change', ev => { builderActorId = ev.target.value; renderScriptsPanel(); });
  sheet.querySelector('#script-target-select').addEventListener('change', ev => { builderTargetId = ev.target.value; });
  sheet.querySelectorAll('.script-picker-item').forEach(btn => {
    btn.addEventListener('click', () => { assignSelectedId = btn.dataset.scriptId; renderScriptsPanel(); });
  });
  const assignBtn = sheet.querySelector('#script-assign-btn');
  if(assignBtn) assignBtn.addEventListener('click', assignSelectedScript);
  return sheet;
}

async function assignSelectedScript(){
  if(!builderActorId || !builderTargetId || !assignSelectedId) return;
  const table = AppState.table;
  const entry = allAssignableScripts(table).find(s => s.id === assignSelectedId);
  if(!entry) return;
  const targetChar = resolveEntityRef(table, builderTargetId);
  if(!targetChar) return;
  const targetName = targetChar.name;
  let ok = false;
  await mutateTable(t => {
    const actor = resolveEntityRef(t, builderActorId);
    if(!actor) return;
    ok = assignScript(actor, { targetId: builderTargetId, targetName, rows: entry.rows.map(row => row.slice()) });
  });
  if(!ok){ showBannerError('This Character already has 3 active Scripts — clear one first.'); return; }
  advanceTargetPastAssigned([entry.rows]);
  renderScriptsPanel();
}

// Advances builderTargetId to the next Character who doesn't already have
// *this* Script — the just-assigned Target now matches itself, so it's
// naturally skipped without needing special-casing. Leaves the selection
// alone if everyone already has it.
function advanceTargetPastAssigned(candidateRowsList){
  const table = AppState.table;
  const next = allCharacterRoster(table).find(c => c.id !== builderActorId && !targetAlreadyHasScript(table, c.id, candidateRowsList));
  if(next) builderTargetId = next.id;
}

export function renderScriptsPanel(){
  const container = document.getElementById('scripts-content');
  if(!container) return;
  const table = AppState.table;
  container.innerHTML = '';
  if(!table) return;

  const chars = allCharacterRoster(table);
  if(!chars.some(c => c.id === builderActorId)) builderActorId = chars.length ? chars[0].id : null;
  if(!chars.some(c => c.id === builderTargetId)) builderTargetId = chars.length ? chars[0].id : null;
  const actor = builderActorId ? resolveEntityRef(table, builderActorId) : null;

  const optionsHtml = (selectedId) => chars.map(c =>
    '<option value="' + c.id + '"' + (c.id === selectedId ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>'
  ).join('');

  const allScripts = allAssignableScripts(table);
  if(!allScripts.some(s => s.id === assignSelectedId)) assignSelectedId = allScripts.length ? allScripts[0].id : null;
  const selected = allScripts.find(s => s.id === assignSelectedId) || null;

  // Target-greying — a Character already holding *this exact* Script
  // (whichever's currently selected above) shows labeled and dimmed, so
  // it's obvious at a glance who still needs it. Deliberately NOT
  // `disabled` — a visual cue only, one click to re-assign on purpose.
  const candidateRowsList = [selected ? selected.rows : null];
  const targetOptionsHtml = (selectedId) => chars.map(c => {
    const already = targetAlreadyHasScript(table, c.id, candidateRowsList);
    return '<option value="' + c.id + '"' + (c.id === selectedId ? ' selected' : '') + (already ? ' class="script-target-taken"' : '') + '>' +
      escapeHtml(c.name) + (already ? ' (already has this Script)' : '') + '</option>';
  }).join('');

  container.appendChild(writeScriptSheet());
  container.appendChild(assignScriptSheet(allScripts, selected, optionsHtml, targetOptionsHtml));
  container.appendChild(memorySheet(actor));

  const statusSheet = document.createElement('div');
  statusSheet.className = 'sheet';
  const activeScripts = (actor && actor.activeScripts) || [];
  statusSheet.innerHTML = '<div class="stat-header">' + (actor ? escapeHtml(actor.name || 'Character') : 'No Character') +
    '’s Active Scripts (' + activeScripts.length + ' / 3)</div>' +
    (activeScripts.length
      ? activeScripts.map((s, idx) =>
          '<div class="script-slot">' +
            '<div class="script-status-line">Target: ' + escapeHtml(s.targetName || '?') + '</div>' +
            '<div class="script-status-line">Progress: Expression ' + (s.nextRow + 1) + ' / ' + s.rows.length + '</div>' +
            compositionCardHtml(s.rows, { nextRowIndex: s.nextRow }) +
            '<button class="btn-ghost btn-small script-clear-btn" data-slot-index="' + idx + '" style="margin-top:8px;">Clear Script</button>' +
          '</div>'
        ).join('')
      : '<div class="log-empty">No active Scripts.</div>');
  container.appendChild(statusSheet);

  container.querySelectorAll('.script-clear-btn').forEach(btn => {
    btn.addEventListener('click', () => clearActiveScript(Number(btn.dataset.slotIndex)));
  });
}

// Give Memory — a real, separate gap from assignScript() above. Behaviors
// (behaviors.js's computeBehaviors()) are driven entirely by an Actor's OWN
// remembered Glyphs (actor.mindeye), not by activeScripts — Teach only has
// real weight to roll once WIM itself is in the Actor's own Memory with
// genuine Desire/Longing behind it. Assigning a Script only decides what
// gets taught once Teach actually fires; this is the missing "get the Actor
// into a state where it fires at all" half. Reuses the same Actor picker as
// the builder above. Delivered `from: 'TATA'` (not the Actor's own name)
// since this is an out-of-fiction authoring action, not a Message the Actor
// sent themselves; marked seen immediately — this isn't a live "just arrived" moment.
const ATTACHMENT_LABELS = ['Connected', 'Mid', 'Separated'];
const DESIRE_LABELS = ['Desirable', 'Mid', 'Undesirable'];

function memorySheet(actor){
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  if(!actor){
    sheet.innerHTML = '<div class="stat-header">Give Memory</div><div class="log-empty">Pick an Actor above first.</div>';
    return sheet;
  }
  const mindeye = actor.mindeye || [];
  sheet.innerHTML =
    '<div class="stat-header">Give ' + escapeHtml(actor.name || 'Actor') + ' a Memory</div>' +
    '<div class="script-status-line">Behaviors are driven by the Actor’s own remembered Glyphs — Gom needs WIM in his own Memory (with real Desire/Longing) before Teach has any weight to actually roll. Assigning a Script above only decides what he teaches once it does.</div>' +
    '<div class="field"><label>Glyph</label><select id="memory-glyph-select">' + glyphOptionsHtml(false) + '</select></div>' +
    '<div class="field"><label>Attachment</label><select id="memory-attachment-select">' +
      '<option value="0">Connected</option><option value="1" selected>Mid</option><option value="2">Separated</option>' +
    '</select></div>' +
    '<div class="field"><label>Desire</label><select id="memory-desire-select">' +
      '<option value="0">Desirable</option><option value="1" selected>Mid</option><option value="2">Undesirable</option>' +
    '</select></div>' +
    '<button class="btn-brass btn-block" id="memory-add-btn">Add to Memory</button>' +
    (mindeye.length
      ? '<div class="script-rows-readout" style="margin-top:10px;">' + mindeye.map(e =>
          '<div class="script-row-readout">' + escapeHtml(e.glyph || 'GI') + ' — Attachment ' + ATTACHMENT_LABELS[e.attachment ?? 1] + ', Desire ' + DESIRE_LABELS[e.desire ?? 1] + (e.longing ? ', Longing ' + e.longing : '') + '</div>'
        ).join('') + '</div>'
      : '<div class="log-empty" style="margin-top:10px;">No Glyphs remembered yet.</div>');

  const actorId = builderActorId;
  sheet.querySelector('#memory-add-btn').addEventListener('click', () => addMemory(actorId, sheet));
  return sheet;
}

async function addMemory(actorId, sheet){
  if(!actorId) return;
  const glyphSel = sheet.querySelector('#memory-glyph-select');
  const attachSel = sheet.querySelector('#memory-attachment-select');
  const desireSel = sheet.querySelector('#memory-desire-select');
  const glyphId = glyphSel ? glyphSel.value : '';
  if(!glyphId) return;
  const attachment = attachSel ? Number(attachSel.value) : 1;
  const desire = desireSel ? Number(desireSel.value) : 1;
  await mutateTable(t => {
    const actor = resolveEntityRef(t, actorId);
    if(!actor) return;
    deliverMindeyeEntry(t, actorId, 'TATA', glyphId);
    const entry = actor.mindeye[actor.mindeye.length - 1];
    entry.attachment = attachment;
    entry.desire = desire;
    entry.seen = true;
  });
  renderScriptsPanel();
}

// `slotIndex` — which of the actor's up to 3 activeScripts to clear; each
// slot gets its own Clear button instead of one global one.
async function clearActiveScript(slotIndex){
  if(!builderActorId || slotIndex == null) return;
  await mutateTable(t => {
    const actor = resolveEntityRef(t, builderActorId);
    if(actor && actor.activeScripts) actor.activeScripts.splice(slotIndex, 1);
  });
  renderScriptsPanel();
}
