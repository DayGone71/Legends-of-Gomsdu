import { AppState, rememberMe, forgetMe, recallMe } from './state.js';
import { connectToSession, createNewSession, mutateTable, disconnect, registerRenderCallback } from './sync.js';
import { genCode, genId, timeNow } from './utils.js';
import { blankCharacter, loadBuild, scheduleSave, saveCharacter, makeActiveCharacter, renderCharacterSheet, saveAsTemplate, populateSavedCharacterDropdowns, populateBuildDropdowns, syncFieldOnBlur, initCreateCharacterPartyUI, renderCreateCharacterParty } from './character.js';
import { renderLedger, renderRoster, sendMessage, initAddPartyMemberUI } from './ledger.js';
import { renderTargetRange, renderAllyRange, toggleMenu, selectAttackKind, selectEssenceSchool, selectBlockKind, toggleCounter, commitAction, undoAction, resolveRound, renderCombatCounters, renderStagedActions, stageRest } from './combat.js';
import { renderSequencer, initSequencerHover, initSequencerScrub } from './sequencer.js';
import { addEnemy, startEncounter, endEncounter, renderDMEnemyPicker, renderDMCounters, renderDMTargetRange, dmToggleMenu, dmSelectAttackKind, dmSelectBlockKind, dmToggleCounter, dmCommitAction, dmUndoAction, renderDMStagedActions, clearDead, populateSavedEncounterDropdown, saveEncounterAsTemplate, loadEncounterTemplate, renderNpcList } from './dm.js';
import { defaultMap, renderMap, toggleMapEditMode, toggleTata, cancelMoveSelect } from './map.js';
import { SCENES, loadScene, toggleSceneMenu } from './scenes.js';
import { openPanel, closePanel, togglePanel, updateEncounterUI, initPanelBackdrop } from './panels.js';
import { renderDMTestPanel, runDMTestRound, runDMTestNRounds, runDMTestUntilDefeat } from './dmtest.js';
import { initTechniquesUI, renderTechniquesPanel } from './techniques.js';
import { renderInformationPanel, hasUnseenMindeye } from './information.js';

// ---------- Screen helpers ----------
function showLoading(v){ document.getElementById('loading').classList.toggle('hidden', !v); }
function showLandingError(msg){
  const el = document.getElementById('landing-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function clearLandingError(){ document.getElementById('landing-error').classList.add('hidden'); }

// TATA View 2 swap (2026-08-20, dDd's spec) — "Pressing Tata swaps Party
// and the Ledger, essentially." Player mode: Party (left) + Ledger (right,
// headed "Party Ledger"). TATA mode: Ledger moves to the left (headed "Tata
// Ledger", mirrored — see .persistent-grid.tata-active in css/layout.css)
// and Characters (same table.enemies data as the toolbar's NPCs panel, per
// dDd — "Characters and the NPCs Panel are the same thing really") takes
// the right slot, also mirrored. Each of the three panels also gets a slow,
// faint colored glow identifying the current mode — six combinations
// (Player; TATA non-Combat; TATA in-Combat), see the .glow-* classes in
// css/panels.css. Called from renderAll() every render, since it depends on
// both AppState.tataActive and table.inEncounter.
function renderView2Mode(persistentGrid){
  if(!persistentGrid) return;
  const tata = AppState.tataActive;
  const inCombat = !!(AppState.table && AppState.table.inEncounter);
  persistentGrid.classList.toggle('tata-active', tata);

  const partyEl = document.getElementById('party-panel-static');
  const ledgerEl = document.getElementById('ledger-panel-static');
  const charactersEl = document.getElementById('characters-panel-static');
  const glowClasses = ['glow-party', 'glow-party-ledger', 'glow-characters-calm', 'glow-tata-ledger-calm', 'glow-characters-combat', 'glow-tata-ledger-combat'];
  [partyEl, ledgerEl, charactersEl].forEach(el => el && el.classList.remove(...glowClasses));
  if(partyEl) partyEl.classList.add('glow-party');
  if(!tata){
    if(ledgerEl) ledgerEl.classList.add('glow-party-ledger');
  }else if(!inCombat){
    if(ledgerEl) ledgerEl.classList.add('glow-tata-ledger-calm');
    if(charactersEl) charactersEl.classList.add('glow-characters-calm');
  }else{
    if(ledgerEl) ledgerEl.classList.add('glow-tata-ledger-combat');
    if(charactersEl) charactersEl.classList.add('glow-characters-combat');
  }

  const ledgerHeader = document.getElementById('ledger-header');
  if(ledgerHeader) ledgerHeader.textContent = tata ? 'Tata Ledger' : 'Party Ledger';

  renderNpcList('characters-list');
}

// ---------- Central render ----------
function renderAll(){
  if(!AppState.table) return;
  if(AppState.playerId && !AppState.table.players[AppState.playerId]){
    handleRemovedFromTable();
    return;
  }
  // New Game Process (2026-08-20) — nothing below the Sequencer Divider is
  // visible until a Scene is loaded (t.scene set); Load a Scene itself is
  // only usable by whoever created the Table, per dDd.
  const sceneLoaded = !!AppState.table.scene;
  const battleReport = document.querySelector('.battle-report-line');
  const mapRow = document.querySelector('.map-row');
  const persistentGrid = document.querySelector('.persistent-grid');
  if(battleReport) battleReport.classList.toggle('hidden', !sceneLoaded);
  if(mapRow) mapRow.classList.toggle('hidden', !sceneLoaded);
  if(persistentGrid) persistentGrid.classList.toggle('hidden', !sceneLoaded);
  const sceneMenuWrap = document.querySelector('.scene-menu-wrap');
  if(sceneMenuWrap) sceneMenuWrap.classList.toggle('hidden', AppState.table.createdBy !== AppState.playerId);

  renderView2Mode(persistentGrid);

  AppState.sceneBuildRestriction = (SCENES[AppState.table.scene] && SCENES[AppState.table.scene].restrictBuilds) || null;
  populateBuildDropdowns();

  renderCharacterSheet();
  renderCreateCharacterParty();
  renderTechniquesPanel();
  renderInformationPanel();
  const infoBtn = document.getElementById('toolbar-information');
  if(infoBtn) infoBtn.classList.toggle('pulsing-gom', hasUnseenMindeye());
  renderCombatCounters();
  renderTargetRange();
  renderAllyRange();
  renderStagedActions();
  renderSequencer();
  renderDMEnemyPicker();
  renderDMCounters();
  renderDMTargetRange();
  renderDMStagedActions();
  renderNpcList();
  renderDMTestPanel();
  renderLedger();
  renderRoster();
  renderMap();
  updateEncounterUI();
}
registerRenderCallback(renderAll);

// Veil Vision — local-only, see js/state.js. Flips the flag and re-renders
// everything it touches (Sequencer's Enemy-slash staging visibility, the
// Roster's Shadow Possessors) in one pass, same as toggleMapEditMode()'s
// button-class pattern.
function toggleVeilVision(){
  AppState.veilVision = !AppState.veilVision;
  const btn = document.getElementById('veil-vision-toggle');
  if(btn) btn.classList.toggle('toggled', AppState.veilVision);
  renderAll();
}

// ---------- Session lifecycle ----------
async function handleCreate(){
  clearLandingError();
  const name = document.getElementById('create-name').value.trim();
  if(!name){ showLandingError('Enter a name first.'); return; }

  const code = genCode();
  AppState.playerId = genId();
  const initial = {
    code, createdAt: Date.now(),
    createdBy: AppState.playerId, // New Game Process (2026-08-20) — only whoever created the Table can Load a Scene, per dDd; a later joiner never gets that choice.
    log: [{ type: 'system', text: name + ' created the table', time: timeNow() }],
    players: {}, enemies: {},
    inEncounter: false,
    map: defaultMap(),
    positions: {}
  };
  initial.players[AppState.playerId] = blankCharacter(name);
  initial.players[AppState.playerId].joinOrder = Date.now();
  initial.positions[AppState.playerId] = { x: 0, y: 0 };

  showLoading(true);
  const ok = await createNewSession(code, initial);
  showLoading(false);
  if(!ok){ showLandingError("Couldn't create the table. Try again."); return; }
  await rememberMe(code, AppState.playerId, name);
  enterTable(code);
}

async function handleJoin(){
  clearLandingError();
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  const name = document.getElementById('join-name').value.trim();
  if(!code || !name){ showLandingError('Enter both a table code and your name.'); return; }

  showLoading(true);
  AppState.playerId = genId();
  const ok = await connectToSession(code);
  showLoading(false);
  if(!ok){ showLandingError('No table found with that code.'); return; }

  await mutateTable(t => {
    t.players[AppState.playerId] = blankCharacter(name);
    // Explicit join-order timestamp, not reliance on Object key insertion
    // order (2026-08-17, dDd's "Player Order in Party is scuffed" note) —
    // insertion order *should* already be stable, but concurrent writes on
    // this table's whole-row-overwrite persistence (see reference/ROADMAP.md,
    // Networking & Sync) can scramble it. A stamped, sortable field survives
    // that regardless of how the underlying object gets rebuilt on a write.
    t.players[AppState.playerId].joinOrder = Date.now();
    if(!t.positions) t.positions = {};
    // Each new Player starts one Tile down from the previous one, same column.
    const y = Math.min(Object.keys(t.players).length - 1, (t.map.height || 1) - 1);
    t.positions[AppState.playerId] = { x: 0, y };
    t.log.push({ type: 'system', text: name + ' joined the table', time: timeNow() });
  });
  rememberMe(code, AppState.playerId, name);
  enterTable(code);
}

function enterTable(code){
  document.getElementById('screen-landing').classList.add('hidden');
  document.getElementById('screen-table').classList.remove('hidden');
  document.getElementById('table-code-display').textContent = code;
  populateBuildDropdowns();
  populateSavedCharacterDropdowns();
  populateSavedEncounterDropdown();
  renderAll();
  // Only auto-open for a genuinely new Character (no archetype set yet) —
  // was unconditional, which reopened Create-a-Character on every reload of
  // an already-set-up Character too. Found 2026-08-17, see ISSUES.md.
  // Also gated on scene === 'dev' (2026-08-20, per dDd) — a Scene like Era 1
  // already hands the joining Player a fully-statted Living Stone (see
  // js/scenes.js), so there's nothing left to fill in; the sheet popping up
  // uninvited is just noise there. A scene-less freshly-created Table (scene
  // still unset — nothing below the Sequencer Divider is visible yet either,
  // see renderAll()) shouldn't show it either, only Dev's freeform default.
  const me = AppState.table && AppState.table.players[AppState.playerId];
  if(me && !me.archetype && AppState.table.scene === 'dev') openPanel('character');
}

// Fires when this tab's own player record is gone from the synced table — left
// from another tab/window, or removed by the DM. Without this, a stale tab keeps
// showing "You are X" and will keep posting chat/actions under a ghost identity.
function handleRemovedFromTable(){
  forgetMe();
  disconnect();
  document.getElementById('screen-table').classList.add('hidden');
  document.getElementById('screen-landing').classList.remove('hidden');
  showLandingError('This session ended — you left (or were removed) from another tab or window.');
}

async function leaveTable(){
  if(AppState.table && AppState.table.players[AppState.playerId]){
    const name = AppState.table.players[AppState.playerId].name || 'Someone';
    // Departed, not deleted (2026-08-17, dDd's ask) — the record (and their
    // Possessors/Mini-Party) stays, greyed out in the Roster (renderRoster()
    // in ledger.js), rather than vanishing outright.
    await mutateTable(t => {
      t.players[AppState.playerId].departed = true;
      t.log.push({ type: 'system', text: name + ' left the table', time: timeNow() });
    });
  }
  forgetMe();
  disconnect();
  document.getElementById('screen-table').classList.add('hidden');
  document.getElementById('screen-landing').classList.remove('hidden');
}

function copyCode(){
  if(!AppState.currentCode) return;
  const btn = document.getElementById('btn-copy-code');
  function flash(label){
    if(!btn) return;
    if(!btn.dataset.restLabel) btn.dataset.restLabel = btn.textContent;
    btn.textContent = label;
    clearTimeout(btn._copyResetTimer);
    btn._copyResetTimer = setTimeout(() => { btn.textContent = btn.dataset.restLabel; }, 1200);
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(AppState.currentCode).then(() => flash('Copied!')).catch(() => flash('Copy failed'));
  }
}

// ---------- Wiring ----------
// Color Laboratory — a landing-page-only art experiment, no game state
// involved. Two ways to drive the one Experiment patch, kept in sync: the
// slider (one HSL hue at a fixed 65%/55% saturation/lightness, for a quick
// scrub roughly as vivid as the settled bands above it) and a typed hex
// code (exact color, any saturation/lightness — the slider just jumps to
// its nearest hue so both controls always agree on where they landed).
function hslToHex(h, s, l){
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if(h < 60){ r = c; g = x; b = 0; }
  else if(h < 120){ r = x; g = c; b = 0; }
  else if(h < 180){ r = 0; g = c; b = x; }
  else if(h < 240){ r = 0; g = x; b = c; }
  else if(h < 300){ r = x; g = 0; b = c; }
  else{ r = c; g = 0; b = x; }
  const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

function hexToHsl(hex){
  let h = hex.replace('#', '');
  if(h.length === 3) h = h.split('').map(c => c + c).join('');
  if(!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0, s = 0;
  if(max !== min){
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if(max === r) hue = (g - b) / d + (g < b ? 6 : 0);
    else if(max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
  }
  return { h: Math.round(hue), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function initColorLab(){
  const slider = document.getElementById('color-lab-slider');
  const patch = document.getElementById('color-lab-patch');
  const value = document.getElementById('color-lab-value');
  const hexInput = document.getElementById('color-lab-hex');
  const paletteSwatches = document.querySelectorAll('.color-lab-patch-sm');
  if(!slider || !patch || !value || !hexInput) return;

  // Single-select among the palette patches — clicking one clears whichever
  // else was highlighted. The Experiment patch highlights independently of
  // that group. Whenever both are highlighted at once, the palette patch's
  // color is overwritten to the Experiment color, live — see applyIfBoth(),
  // called both from clicks and from every Experiment color change, so it
  // keeps tracking for as long as the pairing holds.
  let selected = null;

  // Keeps a row's Gradient column honest — rebuilt from whatever its own
  // three patches currently show, not the row's original hardcoded stops,
  // so overwriting a Primary/Secondary/Highlight patch actually shows up
  // in the blended (or hard-stopped, for Self/Ally/Enemy) bar next to it.
  function rebuildGradient(patchEl){
    const row = patchEl.closest('.color-lab-row');
    const band = row && row.querySelector('.color-lab-band');
    const swatches = row && row.querySelectorAll('.color-lab-patch-sm');
    if(!band || !swatches || swatches.length !== 3) return;
    const c = Array.from(swatches).map(s => getComputedStyle(s).backgroundColor);
    band.style.background = band.dataset.mode === 'blocks'
      ? 'linear-gradient(to right, ' + c[0] + ' 0%, ' + c[0] + ' 33.33%, ' + c[1] + ' 33.33%, ' + c[1] + ' 66.66%, ' + c[2] + ' 66.66%, ' + c[2] + ' 100%)'
      : 'linear-gradient(to right, ' + c.join(', ') + ')';
  }

  function applyIfBoth(){
    if(selected && patch.classList.contains('highlighted')){
      selected.style.background = hexInput.value;
      rebuildGradient(selected);
    }
  }

  paletteSwatches.forEach(el => {
    el.addEventListener('click', () => {
      if(el.classList.contains('highlighted')){
        el.classList.remove('highlighted');
        selected = null;
      }else{
        paletteSwatches.forEach(o => o.classList.remove('highlighted'));
        el.classList.add('highlighted');
        selected = el;
      }
      applyIfBoth();
    });
  });
  patch.addEventListener('click', () => {
    patch.classList.toggle('highlighted');
    applyIfBoth();
  });

  function fromSlider(){
    const hue = Number(slider.value);
    const hex = hslToHex(hue, 65, 55);
    patch.style.background = hex;
    value.textContent = hue + '°, 65%, 55% — ' + hex;
    hexInput.value = hex;
    applyIfBoth();
  }
  function fromHex(){
    const hsl = hexToHsl(hexInput.value);
    if(!hsl) return;
    const hex = hexInput.value.startsWith('#') ? hexInput.value : '#' + hexInput.value;
    patch.style.background = hex;
    slider.value = hsl.h;
    value.textContent = hsl.h + '°, ' + hsl.s + '%, ' + hsl.l + '% — ' + hex;
    applyIfBoth();
  }

  slider.addEventListener('input', fromSlider);
  hexInput.addEventListener('input', () => {
    if(/^#?[0-9a-fA-F]{6}$/.test(hexInput.value)) fromHex();
  });
  fromSlider();
}

// Lightning box — another landing-page-only art experiment, no game state.
// Recursive midpoint-displacement is the classic way to fake a lightning
// bolt: start with a straight line from A to B, repeatedly bisect each
// segment and nudge the new midpoint sideways by a shrinking random amount.
// Fewer/larger nudges (low depth, high displacement) reads jagged and
// violent; more/smaller nudges reads fine and crackly — randomizing both
// per bolt is most of what makes each one feel distinct.
const SVG_NS = 'http://www.w3.org/2000/svg';

function jaggedPoints(x1, y1, x2, y2, depth, displace, out){
  if(depth <= 0){ out.push([x2, y2]); return; }
  const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * displace;
  const my = (y1 + y2) / 2 + (Math.random() - 0.5) * displace * 0.35;
  jaggedPoints(x1, y1, mx, my, depth - 1, displace * 0.55, out);
  jaggedPoints(mx, my, x2, y2, depth - 1, displace * 0.55, out);
}
function buildJaggedPath(x1, y1, x2, y2, depth, displace){
  const out = [[x1, y1]];
  jaggedPoints(x1, y1, x2, y2, depth, displace, out);
  return out;
}
function pointsToPathD(points){
  return 'M' + points.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L ');
}

function spawnLightningBolt(box, targetX, targetY, intensityFactor){
  if(intensityFactor === undefined) intensityFactor = 0.5; // 0 = calm, 1 = violent
  const w = box.clientWidth, h = box.clientHeight;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'lightning-bolt-svg lightning-flash');
  svg.setAttribute('width', w);
  svg.setAttribute('height', h);
  svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

  // Strikes down onto the click point from somewhere above it — length and
  // starting drift both randomized so bolts vary from short/steep to long/wide.
  const reach = h * (0.35 + Math.random() * 0.55);
  const startX = Math.min(w - 8, Math.max(8, targetX + (Math.random() - 0.5) * w * 0.4));
  const startY = Math.max(0, targetY - reach);

  // The Intensity knob shifts each random range's floor/ceiling rather than
  // fixing a value outright — bolts stay unique at any knob setting, just
  // calmer or more violent on average.
  const intensity = (0.4 + intensityFactor * 1.6) * (0.7 + Math.random() * 0.6); // jaggedness
  const depth = 4 + Math.floor(Math.random() * 3); // 4-6 subdivisions
  const mainPoints = buildJaggedPath(startX, startY, targetX, targetY, depth, 16 * intensity);

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'lightning-bolt');
  g.style.setProperty('--glow-scale', ((0.45 + intensityFactor * 1.25) * (0.8 + Math.random() * 0.4)).toFixed(2));

  const coreWidth = (1.2 + intensityFactor * 1.8) * (0.75 + Math.random() * 0.6);
  const main = document.createElementNS(SVG_NS, 'path');
  main.setAttribute('d', pointsToPathD(mainPoints));
  main.setAttribute('class', 'lightning-core');
  main.setAttribute('stroke-width', coreWidth.toFixed(2));
  g.appendChild(main);

  const maxBranches = 1 + Math.round(intensityFactor * 3); // 1-4
  const branchCount = Math.floor(Math.random() * (maxBranches + 1));
  for(let i = 0; i < branchCount; i++){
    const idx = 1 + Math.floor(Math.random() * (mainPoints.length - 2));
    const [bx, by] = mainPoints[idx];
    const branchLen = reach * (0.15 + Math.random() * 0.35);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const bx2 = bx + dir * branchLen * (0.5 + Math.random() * 0.6);
    const by2 = by + branchLen * (0.5 + Math.random() * 0.7);
    const bPoints = buildJaggedPath(bx, by, bx2, by2, Math.max(2, depth - 2), 12 * intensity);
    const branch = document.createElementNS(SVG_NS, 'path');
    branch.setAttribute('d', pointsToPathD(bPoints));
    branch.setAttribute('class', 'lightning-core lightning-branch');
    branch.setAttribute('stroke-width', Math.max(0.9, coreWidth * 0.5).toFixed(2));
    g.appendChild(branch);
  }

  svg.appendChild(g);
  const dur = 480 + Math.random() * 520; // 480-1000ms, "quick... with varied time"
  svg.style.setProperty('--bolt-dur', dur.toFixed(0) + 'ms');
  box.appendChild(svg);

  svg.addEventListener('animationend', () => svg.remove());
  setTimeout(() => svg.remove(), dur + 500); // safety net if animationend never fires
}

// A software-knob convention: dragging vertically changes the value
// (up = increase), rather than tracking the cursor's angle around the
// knob's center — the usual choice in real audio/lighting-console UIs,
// since it stays controllable even when the drag leaves the knob's own
// small hit area. Pointer Events cover mouse and touch the same way.
function initKnob(el, valueEl, opts){
  const min = opts.min, max = opts.max;
  let value = opts.initial;
  function render(){
    const angle = -135 + (value - min) / (max - min) * 270;
    el.style.setProperty('--angle', angle + 'deg');
    if(valueEl) valueEl.textContent = Math.round((value - min) / (max - min) * 100) + '%';
    if(opts.onChange) opts.onChange(value);
  }
  let dragging = false, startY = 0, startVal = 0;
  el.addEventListener('pointerdown', e => {
    dragging = true; startY = e.clientY; startVal = value;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if(!dragging) return;
    const dy = startY - e.clientY;
    value = Math.min(max, Math.max(min, startVal + (dy / 130) * (max - min)));
    render();
  });
  el.addEventListener('pointerup', () => { dragging = false; });
  el.addEventListener('pointercancel', () => { dragging = false; });
  render();
  return { get: () => value };
}

function initLightningBox(){
  const box = document.getElementById('lightning-box');
  const freqKnob = document.getElementById('knob-frequency');
  const intensityKnob = document.getElementById('knob-intensity');
  const toggleBtn = document.getElementById('btn-lightning-toggle');
  if(!box || !freqKnob || !intensityKnob || !toggleBtn) return;

  const frequency = initKnob(freqKnob, document.getElementById('knob-frequency-value'), { min: 0, max: 100, initial: 50 });
  const intensity = initKnob(intensityKnob, document.getElementById('knob-intensity-value'), { min: 0, max: 100, initial: 50 });

  box.addEventListener('click', e => {
    const rect = box.getBoundingClientRect();
    spawnLightningBolt(box, e.clientX - rect.left, e.clientY - rect.top, intensity.get() / 100);
  });

  // Self-rescheduling setTimeout rather than setInterval so each gap can be
  // jittered around the Frequency knob's base rate — a fixed-interval storm
  // reads mechanical, a jittered one reads like actual weather. Frequency
  // and Intensity are both read fresh on every strike, so dragging a knob
  // mid-storm changes the next bolt immediately, not after a restart.
  let autoTimer = null;
  function scheduleNext(){
    const freqValue = frequency.get();
    const minInterval = 150, maxInterval = 2200;
    const base = maxInterval - (freqValue / 100) * (maxInterval - minInterval);
    const jittered = base * (0.6 + Math.random() * 0.8);
    autoTimer = setTimeout(() => {
      const w = box.clientWidth, h = box.clientHeight;
      const x = 20 + Math.random() * (w - 40);
      const y = h * 0.35 + Math.random() * (h * 0.5);
      spawnLightningBolt(box, x, y, intensity.get() / 100);
      scheduleNext();
    }, jittered);
  }

  let running = false;
  toggleBtn.addEventListener('click', () => {
    running = !running;
    if(running){
      toggleBtn.textContent = 'Stop';
      toggleBtn.classList.replace('btn-brass', 'btn-ghost');
      toggleBtn.classList.add('toggled');
      scheduleNext();
    }else{
      toggleBtn.textContent = 'Start';
      toggleBtn.classList.replace('btn-ghost', 'btn-brass');
      toggleBtn.classList.remove('toggled');
      clearTimeout(autoTimer);
    }
  });
}

// Lava box — a small real-time particle simulation, not scripted animation.
// Four magma stops (Deep/Mid/High/Glow) form one continuous "heat" gradient;
// every blob starts at heat 1 (freshly molten, brightest) and cools toward 0
// over its lifetime, with color interpolated from that same gradient every
// frame — that's what makes a blob visibly drift from yellow through orange
// to deep red as it ages, not a fixed per-blob color. Buoyancy is tied to
// the same heat value (hot rises, faking magma being less dense; as it cools
// buoyancy fades and gravity wins), which is the actual mechanism behind
// "splotches forming and sinking" — nothing scripts that directly, it falls
// out of the physics. Layering ("colors moving over and under each other")
// likewise isn't scripted — blobs are drawn coolest-first each frame, so
// which blob covers which shifts naturally as their heat (and therefore
// draw order) changes over time.
const MAGMA_STOPS = [
  { t: 0, c: [0x8F, 0x15, 0x15] },   // Deep Magma
  { t: 0.33, c: [0xE8, 0x3D, 0x0C] }, // Mid Magma
  { t: 0.66, c: [0xFF, 0x73, 0x00] }, // High Magma
  { t: 1, c: [0xFF, 0xC9, 0x28] }     // Glow Magma
];
function magmaColor(heat){
  const h = Math.max(0, Math.min(1, heat));
  for(let i = 0; i < MAGMA_STOPS.length - 1; i++){
    const a = MAGMA_STOPS[i], b = MAGMA_STOPS[i + 1];
    if(h >= a.t && h <= b.t){
      const lt = (h - a.t) / (b.t - a.t);
      const r = a.c[0] + (b.c[0] - a.c[0]) * lt;
      const g = a.c[1] + (b.c[1] - a.c[1]) * lt;
      const bl = a.c[2] + (b.c[2] - a.c[2]) * lt;
      return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (bl | 0) + ')';
    }
  }
  return 'rgb(255,201,40)';
}

function initLavaBox(){
  const box = document.getElementById('lava-box');
  const canvas = document.getElementById('lava-canvas');
  const toggleBtn = document.getElementById('btn-lava-toggle');
  if(!box || !canvas || !toggleBtn) return;
  const ctx = canvas.getContext('2d');
  canvas.width = box.clientWidth;
  canvas.height = box.clientHeight;

  const vents = [];
  let blobs = [];
  let flowing = false;
  let rafId = null;
  let lastTime = null;
  const VENT_RING_R = 7;
  const POOL_R = VENT_RING_R * 5; // boundary circle = 5x the vent ring's diameter

  function spawnBlob(vent){
    return {
      vent,
      x: vent.x + (Math.random() - 0.5) * 10,
      y: vent.y + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      r: 5 + Math.random() * 8,
      heat: 1,
      age: 0,
      coolAge: 0,
      opacity: 1
    };
  }

  // No up/down at all — a symmetric random walk (vx/vy both jitter the same
  // way) instead of gravity+buoyancy, confined to this blob's own vent's
  // circular pool. Hitting the pool's edge reflects the velocity off the
  // boundary's normal, then adds fresh randomness on top, so the bounce
  // reads as "basically random," not a clean billiard-ball ricochet.
  // Cooling/fading are still two separate timers (see below) — that's what
  // makes a blob visibly sit there, spent and dark, before it fades, rather
  // than cooling and vanishing in the same instant.
  function updateBlob(b, dt){
    b.age += dt;
    b.heat = Math.max(0, 1 - b.age / 420);
    b.vx += (Math.random() - 0.5) * 0.09 * dt;
    b.vy += (Math.random() - 0.5) * 0.09 * dt;
    b.vx *= 0.97;
    b.vy *= 0.97;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    const dx = b.x - b.vent.x, dy = b.y - b.vent.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    const maxDist = POOL_R - b.r * 0.7;
    if(dist > maxDist){
      const nx = dx / dist, ny = dy / dist;
      b.x = b.vent.x + nx * maxDist;
      b.y = b.vent.y + ny * maxDist;
      const dot = b.vx * nx + b.vy * ny;
      b.vx -= 2 * dot * nx;
      b.vy -= 2 * dot * ny;
      b.vx += (Math.random() - 0.5) * 0.35;
      b.vy += (Math.random() - 0.5) * 0.35;
    }

    if(b.heat <= 0){
      b.coolAge += dt;
      b.opacity = Math.max(0, 1 - b.coolAge / 220);
    }
  }

  function drawBlob(b){
    const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    grad.addColorStop(0, magmaColor(b.heat));
    grad.addColorStop(1, 'rgba(26,10,8,0)');
    ctx.globalAlpha = Math.max(0, b.opacity);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function loop(now){
    if(lastTime == null) lastTime = now;
    const dt = Math.min(3, (now - lastTime) / 16.67);
    lastTime = now;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Each vent's Crust pool — the actual gravity/bounce boundary, drawn
    // before the blobs so they render inside it, not the whole box.
    vents.forEach(v => {
      ctx.beginPath();
      ctx.arc(v.x, v.y, POOL_R, 0, Math.PI * 2);
      ctx.fillStyle = '#1A0A08';
      ctx.fill();
    });

    if(flowing){
      vents.forEach(v => {
        if(Math.random() < 0.16 * dt) blobs.push(spawnBlob(v));
      });
    }

    blobs.forEach(b => updateBlob(b, dt));
    blobs = blobs.filter(b => b.opacity > 0);
    blobs.slice().sort((a, b) => a.heat - b.heat).forEach(drawBlob);

    vents.forEach(v => {
      ctx.beginPath();
      ctx.arc(v.x, v.y, VENT_RING_R, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFC928';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.75;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    if(flowing || blobs.length){
      rafId = requestAnimationFrame(loop);
    }else{
      rafId = null;
      lastTime = null;
    }
  }

  box.addEventListener('click', e => {
    const rect = box.getBoundingClientRect();
    vents.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    if(!rafId) rafId = requestAnimationFrame(loop);
  });

  toggleBtn.addEventListener('click', () => {
    flowing = !flowing;
    toggleBtn.textContent = flowing ? 'Stop' : 'Start';
    toggleBtn.classList.toggle('btn-ghost', flowing);
    toggleBtn.classList.toggle('btn-brass', !flowing);
    toggleBtn.classList.toggle('toggled', flowing);
    if(flowing && !rafId) rafId = requestAnimationFrame(loop);
  });

  rafId = requestAnimationFrame(loop);
}

function wireEvents(){
  document.getElementById('btn-create').addEventListener('click', handleCreate);
  document.getElementById('btn-join').addEventListener('click', handleJoin);
  initColorLab();
  initLightningBox();
  initLavaBox();
  initSequencerHover();
  initSequencerScrub();

  document.getElementById('btn-copy-code').addEventListener('click', copyCode);
  document.getElementById('btn-leave').addEventListener('click', leaveTable);

  document.getElementById('chat-input').addEventListener('keydown', e => {
    if(e.key === 'Enter') sendMessage();
  });
  document.getElementById('btn-send-chat').addEventListener('click', sendMessage);

  // Toolbar: panel open/close
  document.getElementById('toolbar-character').addEventListener('click', () => togglePanel('character'));
  document.getElementById('toolbar-load-scene').addEventListener('click', toggleSceneMenu);
  document.querySelectorAll('.scene-menu-item').forEach(btn => {
    btn.addEventListener('click', () => loadScene(btn.dataset.scene));
  });
  document.getElementById('toolbar-combat').addEventListener('click', () => togglePanel('combat'));
  document.getElementById('toolbar-dm').addEventListener('click', () => togglePanel('dm'));
  document.getElementById('toolbar-dmtest').addEventListener('click', () => togglePanel('dmtest'));
  document.getElementById('toolbar-stats').addEventListener('click', () => togglePanel('stats'));
  document.getElementById('toolbar-techniques').addEventListener('click', () => togglePanel('techniques'));
  document.getElementById('toolbar-party').addEventListener('click', () => togglePanel('party'));
  document.getElementById('toolbar-npcs').addEventListener('click', () => togglePanel('npcs'));
  document.getElementById('toolbar-information').addEventListener('click', () => togglePanel('information'));
  document.getElementById('toolbar-help').addEventListener('click', () => togglePanel('help'));
  document.getElementById('panel-close-character').addEventListener('click', closePanel);
  document.getElementById('panel-close-combat').addEventListener('click', closePanel);
  document.getElementById('panel-close-dm').addEventListener('click', closePanel);
  document.getElementById('panel-close-dmtest').addEventListener('click', closePanel);
  document.getElementById('panel-close-character-view').addEventListener('click', closePanel);
  document.getElementById('panel-close-stats').addEventListener('click', closePanel);
  document.getElementById('panel-close-techniques').addEventListener('click', closePanel);
  document.getElementById('panel-close-npcs').addEventListener('click', closePanel);
  document.getElementById('panel-close-party').addEventListener('click', closePanel);
  document.getElementById('panel-close-information').addEventListener('click', closePanel);
  document.getElementById('panel-close-help').addEventListener('click', closePanel);
  document.getElementById('panel-close-technique-use').addEventListener('click', closePanel);

  // Character sheet
  document.getElementById('ch-build-loader').addEventListener('change', e => loadBuild(e.target.value));
  document.getElementById('btn-make-active').addEventListener('click', () => { makeActiveCharacter(); closePanel(); });
  document.getElementById('btn-save-template').addEventListener('click', saveAsTemplate);
  ['ch-name', 'ch-archetype', 'ch-wounds', 'ch-woundsmax', 'ch-ap', 'ch-flow', 'ch-recovery', 'ch-power', 'ch-quickness', 'ch-resilience', 'ch-lightning', 'ch-lava', 'ch-focus', 'ch-control', 'ch-attunement', 'ch-life',
   'ch-tech-flowPowers', 'ch-tech-focusPowers', 'ch-tech-lightningCrafts', 'ch-tech-lavaCrafts']
    .forEach(id => {
      const el = document.getElementById(id);
      el.addEventListener('input', scheduleSave);
      el.addEventListener('blur', syncFieldOnBlur);
    });
  initCreateCharacterPartyUI();

  // Combat
  document.getElementById('btn-attack-menu').addEventListener('click', () => toggleMenu('attack'));
  document.getElementById('btn-block-menu').addEventListener('click', () => toggleMenu('block'));
  document.getElementById('block-general-btn').addEventListener('click', () => selectBlockKind('general'));
  document.getElementById('block-target-btn').addEventListener('click', () => selectBlockKind('target'));
  document.getElementById('block-counter-btn').addEventListener('click', toggleCounter);
  document.getElementById('essence-btn').addEventListener('click', () => toggleMenu('essence'));
  document.getElementById('attack-fast-btn').addEventListener('click', () => selectAttackKind('fast'));
  document.getElementById('attack-strong-btn').addEventListener('click', () => selectAttackKind('strong'));
  document.getElementById('attack-focus-btn').addEventListener('click', () => selectAttackKind('focus'));
  document.getElementById('cast-lightning').addEventListener('click', () => selectEssenceSchool('Lightning'));
  document.getElementById('cast-lava').addEventListener('click', () => selectEssenceSchool('Lava'));
  document.getElementById('btn-commit').addEventListener('click', commitAction);
  document.getElementById('btn-undo').addEventListener('click', undoAction);
  document.getElementById('btn-resolve').addEventListener('click', resolveRound);
  document.getElementById('btn-rest').addEventListener('click', stageRest);

  // DM
  document.getElementById('dm-encounter-loader').addEventListener('change', loadEncounterTemplate);
  document.getElementById('btn-save-encounter').addEventListener('click', saveEncounterAsTemplate);
  document.getElementById('btn-add-enemy').addEventListener('click', addEnemy);
  document.getElementById('btn-start-encounter').addEventListener('click', startEncounter);
  document.getElementById('btn-end-encounter').addEventListener('click', endEncounter);
  document.getElementById('dm-attack-fast-btn').addEventListener('click', () => dmSelectAttackKind('fast'));
  document.getElementById('dm-attack-strong-btn').addEventListener('click', () => dmSelectAttackKind('strong'));
  document.getElementById('dm-attack-focus-btn').addEventListener('click', () => dmSelectAttackKind('focus'));
  document.getElementById('dm-btn-attack-menu').addEventListener('click', () => dmToggleMenu('attack'));
  document.getElementById('dm-btn-block-menu').addEventListener('click', () => dmToggleMenu('block'));
  document.getElementById('dm-block-general-btn').addEventListener('click', () => dmSelectBlockKind('general'));
  document.getElementById('dm-block-target-btn').addEventListener('click', () => dmSelectBlockKind('target'));
  document.getElementById('dm-block-counter-btn').addEventListener('click', dmToggleCounter);
  document.getElementById('dm-essence-btn').addEventListener('click', () => dmToggleMenu('essence'));
  document.getElementById('dm-btn-commit').addEventListener('click', dmCommitAction);
  document.getElementById('dm-btn-undo').addEventListener('click', dmUndoAction);
  document.getElementById('btn-clear-dead').addEventListener('click', clearDead);

  // DM Test panel
  document.getElementById('btn-dmtest-round').addEventListener('click', runDMTestRound);
  document.getElementById('btn-dmtest-n-rounds').addEventListener('click', runDMTestNRounds);
  document.getElementById('btn-dmtest-until-defeat').addEventListener('click', runDMTestUntilDefeat);

  // Map
  document.getElementById('map-edit-toggle').addEventListener('click', toggleMapEditMode);
  document.getElementById('veil-vision-toggle').addEventListener('click', toggleVeilVision);
  document.getElementById('tata-toggle').addEventListener('click', toggleTata);
  document.getElementById('map-select-cancel').addEventListener('click', cancelMoveSelect);

  // Party: Add AI Party Member (Possessor / Mini-Party Character) — see the
  // "sandwich" model in reference/ROADMAP.md, Party System item C. Per-player
  // trigger buttons are wired inside renderRoster itself (they're recreated
  // every render); this just wires the shared one-instance form parts.
  initAddPartyMemberUI();
  initTechniquesUI();
  renderInformationPanel();

  initPanelBackdrop();
}

// ---------- Init ----------
(async function init(){
  wireEvents();
  showLoading(true);
  const remembered = recallMe();
  if(remembered){
    AppState.playerId = remembered.playerId;
    const ok = await connectToSession(remembered.code);
    if(ok && AppState.table.players[remembered.playerId]){
      showLoading(false);
      enterTable(remembered.code);
      return;
    }
  }
  showLoading(false);
})();
