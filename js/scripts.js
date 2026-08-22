// Scripts (2026-08-22, per dDd) — "a series of instructions to send to an
// NPC." Two real, distinct mechanisms live here now:
//
// 1. `dispatchScript()` — an immediate, uncapped, one-shot send: every
//    Glyph in the list delivered right now, in order. Useful for direct,
//    manual dispatch (the disclosed-mutation pattern this whole codebase's
//    testing already leans on).
// 2. `assignScript()` / `actor.activeScript` — real tracked state, per
//    dDd's own Actor/Target/Action/Outcome breakdown: an ordered list of
//    Rows (each Row up to 3 Glyphs, matching Message's own cap — a Row
//    delivers in one Message since dDd confirmed "Horizontal can all be
//    done at once"), a Target, and how far delivery has gotten. This is
//    what the Teach Behavior (WIM — js/behaviors.js, resolved in
//    js/noncombat.js) actually advances, one Row per roll, only moving to
//    the next Row once the current one's Outcome has landed ("Vertical has
//    to wait"). Assigning a Script is still a manual, orchestrated act —
//    per dDd: "We are orchestrating that ourselves... Let's keep that
//    approach" — Behavior only ever *advances* a Script that's already been
//    assigned, it never creates one for itself.

import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { deliverMindeyeEntry, timeNow, escapeHtml, resolveEntityRef } from './utils.js';
import { glyphOptionsHtml } from './techniques.js';

// Which Glyphs a Character actually knows — the gate a real Script/Behavior
// dispatch will eventually need to respect (a Character shouldn't be able
// to send a Glyph it doesn't itself know). Not enforced anywhere yet;
// undefined `knownGlyphs` means unrestricted, same backward-compatible
// default every other new gate in this codebase uses for pre-existing
// Characters. Gom is the first real Character with this set — just the 4
// Movement Glyphs (see data/characters.json).
export function knownGlyphs(actor){
  return (actor && actor.knownGlyphs) || null;
}

export function knowsGlyph(actor, glyphId){
  const known = knownGlyphs(actor);
  return !known || known.includes(glyphId);
}

// Delivers every Glyph in a Script, in order, as that many separate Mindeye
// entries — same mechanism a multi-Glyph Message already uses, just
// uncapped. Mutates the table directly and logs one combined Ledger line
// (not one per Glyph, so a multi-instruction Script reads as one event) —
// call from inside a mutateTable() callback, same shape every other
// in-callback helper in this codebase uses.
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

// Assigns a real, tracked, multi-Round Script onto actor.activeScript — the
// Teach Behavior (js/noncombat.js) is what actually delivers it, one Row
// per roll. `rows` is an array of Glyph-id arrays, each up to 3 (Message's
// own cap); `targetId`/`targetName` is who receives every Row. Overwrites
// any Script already in progress on this actor — assigning a new one is a
// deliberate act, not a queue. Call from inside a mutateTable() callback,
// same as dispatchScript above.
export function assignScript(actor, { targetId, targetName, rows }){
  if(!actor || !targetId || !rows || !rows.length) return;
  actor.activeScript = { targetId, targetName, rows, nextRow: 0 };
}

// --- Script Panel (2026-08-22, per dDd) ---------------------------------
// "Add a Script Panel button the right side, so I can set the Scripts up."
// Lets dDd build and assign a Script himself (Actor/Target/Row picker,
// reusing js/techniques.js's own glyphOptionsHtml() rather than duplicating
// it), with a readout of whatever's currently on the selected Actor's
// activeScript — so he can verify Teach's progress from the environment
// alone, no disclosed-mutation hand-holding needed. Local-only form state
// (builderActorId/builderTargetId/builderRowCount), same pattern every other
// panel's transient picker state already uses (js/information.js's
// revealingEntryId, js/relationships.js's selectedEntryId).
let builderActorId = null;
let builderTargetId = null;
let builderRowCount = 1;

function allCharacterOptions(table){
  const opts = [];
  if(table && table.players) Object.entries(table.players).forEach(([id, p]) => opts.push({ id, name: p.name || 'Unnamed' }));
  if(table && table.enemies) Object.entries(table.enemies).forEach(([id, e]) => opts.push({ id, name: e.name || 'Enemy' }));
  return opts;
}

export function renderScriptsPanel(){
  const container = document.getElementById('scripts-content');
  if(!container) return;
  const table = AppState.table;
  container.innerHTML = '';
  if(!table) return;

  const chars = allCharacterOptions(table);
  if(!chars.some(c => c.id === builderActorId)) builderActorId = chars.length ? chars[0].id : null;
  if(!chars.some(c => c.id === builderTargetId)) builderTargetId = chars.length ? chars[0].id : null;
  const actor = builderActorId ? resolveEntityRef(table, builderActorId) : null;

  const optionsHtml = (selectedId) => chars.map(c =>
    '<option value="' + c.id + '"' + (c.id === selectedId ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>'
  ).join('');

  const builderSheet = document.createElement('div');
  builderSheet.className = 'sheet';
  builderSheet.innerHTML =
    '<div class="stat-header">Assign a Script</div>' +
    '<div class="field"><label>Actor (who Teaches)</label>' +
    '<select id="script-actor-select">' + optionsHtml(builderActorId) + '</select></div>' +
    '<div class="field"><label>Target (who receives)</label>' +
    '<select id="script-target-select">' + optionsHtml(builderTargetId) + '</select></div>' +
    '<div id="script-rows-builder"></div>' +
    '<div class="script-row-controls">' +
    '<button class="btn-ghost btn-small" id="script-add-row"' + (builderRowCount >= 3 ? ' disabled' : '') + '>+ Add Row</button>' +
    '<button class="btn-ghost btn-small" id="script-remove-row"' + (builderRowCount <= 1 ? ' disabled' : '') + '>&minus; Remove Row</button>' +
    '</div>' +
    '<button class="btn-brass btn-block" id="script-assign-btn" style="margin-top:10px;">Assign Script</button>';

  const rowsBuilder = builderSheet.querySelector('#script-rows-builder');
  for(let r = 0; r < builderRowCount; r++){
    const rowEl = document.createElement('div');
    rowEl.className = 'field script-row-field';
    rowEl.innerHTML = '<label>Row ' + (r + 1) + ' (up to 3 Glyphs, sent together)</label>' +
      '<select class="script-glyph-select" data-row="' + r + '" data-slot="0">' + glyphOptionsHtml(false) + '</select>' +
      '<select class="script-glyph-select" data-row="' + r + '" data-slot="1">' + glyphOptionsHtml(true) + '</select>' +
      '<select class="script-glyph-select" data-row="' + r + '" data-slot="2">' + glyphOptionsHtml(true) + '</select>';
    rowsBuilder.appendChild(rowEl);
  }
  container.appendChild(builderSheet);
  container.appendChild(memorySheet(actor));

  const statusSheet = document.createElement('div');
  statusSheet.className = 'sheet';
  if(actor && actor.activeScript){
    const s = actor.activeScript;
    statusSheet.innerHTML =
      '<div class="stat-header">' + escapeHtml(actor.name || 'Actor') + '’s Active Script</div>' +
      '<div class="script-status-line">Target: ' + escapeHtml(s.targetName || '?') + '</div>' +
      '<div class="script-status-line">Progress: Row ' + (s.nextRow + 1) + ' / ' + s.rows.length + '</div>' +
      '<div class="script-rows-readout">' + s.rows.map((row, i) =>
        '<div class="script-row-readout' + (i < s.nextRow ? ' done' : '') + (i === s.nextRow ? ' next' : '') + '">Row ' + (i + 1) + ': ' + row.map(escapeHtml).join(', ') + '</div>'
      ).join('') + '</div>' +
      '<button class="btn-ghost btn-small" id="script-clear-btn">Clear Script</button>';
  }else{
    statusSheet.innerHTML = '<div class="stat-header">' + (actor ? escapeHtml(actor.name || 'Actor') : 'No Actor') + '</div><div class="log-empty">No active Script.</div>';
  }
  container.appendChild(statusSheet);

  container.querySelector('#script-actor-select').addEventListener('change', ev => { builderActorId = ev.target.value; renderScriptsPanel(); });
  container.querySelector('#script-target-select').addEventListener('change', ev => { builderTargetId = ev.target.value; });
  container.querySelector('#script-add-row').addEventListener('click', () => { if(builderRowCount < 3){ builderRowCount++; renderScriptsPanel(); } });
  container.querySelector('#script-remove-row').addEventListener('click', () => { if(builderRowCount > 1){ builderRowCount--; renderScriptsPanel(); } });
  container.querySelector('#script-assign-btn').addEventListener('click', assignFromBuilder);
  const clearBtn = container.querySelector('#script-clear-btn');
  if(clearBtn) clearBtn.addEventListener('click', clearActiveScript);
}

// Give Memory (2026-08-22, per dDd — found live: "Gom needs the Glyphs
// already in Memory by the looks of things.") — a real, separate gap from
// assignScript() above. Behaviors (js/behaviors.js's computeBehaviors()) are
// driven entirely by an Actor's OWN remembered Glyphs (actor.mindeye), not
// by activeScript — Teach only has real weight to roll once WIM itself is
// in the Actor's own Memory with genuine Desire/Longing behind it. Assigning
// a Script only decides what gets taught once Teach actually fires; this is
// the missing "get the Actor into a state where it fires at all" half,
// previously only reachable via a disclosed-test mutateTable() call. Reuses
// the same Actor picker as the builder above (js/scripts.js's own
// builderActorId) — same Actor, same workflow. Delivered `from: 'TATA'`
// (not the Actor's own name) since this is an out-of-fiction authoring
// action, not a Message the Actor sent themselves; marked seen immediately,
// same reasoning js/information.js's inspect-mode Spotlight-skip already
// uses — this isn't a live "just arrived" moment.
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

async function assignFromBuilder(){
  if(!builderActorId || !builderTargetId) return;
  const targetChar = resolveEntityRef(AppState.table, builderTargetId);
  if(!targetChar) return;
  const rows = [];
  for(let r = 0; r < builderRowCount; r++){
    const glyphs = [0, 1, 2]
      .map(slot => {
        const sel = document.querySelector('.script-glyph-select[data-row="' + r + '"][data-slot="' + slot + '"]');
        return sel ? sel.value : '';
      })
      .filter(Boolean);
    if(glyphs.length) rows.push(glyphs);
  }
  if(!rows.length) return;
  const targetName = targetChar.name;
  await mutateTable(t => {
    const actor = resolveEntityRef(t, builderActorId);
    if(!actor) return;
    assignScript(actor, { targetId: builderTargetId, targetName, rows });
  });
  renderScriptsPanel();
}

async function clearActiveScript(){
  if(!builderActorId) return;
  await mutateTable(t => {
    const actor = resolveEntityRef(t, builderActorId);
    if(actor) actor.activeScript = null;
  });
  renderScriptsPanel();
}
