import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml, timeNow } from './utils.js';
import { addPossessor, addMiniPartyMember, removePossessor, removeMiniPartyMember } from './possession.js';
import { BUILDS } from './character.js';
import { showCharacterView } from './characterView.js';
import { possessorGridHtml, miniPartyGridHtml, wirePossessorMiniPartyClicks } from './possessionView.js';

export function renderLedger(){
  const el = document.getElementById('ledger');
  if(!el) return;
  const log = (AppState.table && AppState.table.log) || [];
  if(!log.length){ el.innerHTML = '<div class="log-empty">Nothing recorded yet.</div>'; return; }

  const recent = log.slice(-100);
  el.innerHTML = recent.map(entry => {
    if(entry.type === 'roll'){
      return '<div class="log-entry roll">' +
        '<span class="time">' + entry.time + '</span>' +
        '<span class="name">' + escapeHtml(entry.name) + '</span>' +
        '<span>rolled d' + entry.sides + (entry.modifier ? (entry.modifier > 0 ? '+' : '') + entry.modifier : '') +
        ' &rarr; <span class="stamp">' + entry.total + '</span></span></div>';
    }
    if(entry.type === 'chat'){
      return '<div class="log-entry chat">' +
        '<span class="time">' + entry.time + '</span>' +
        '<span class="name">' + escapeHtml(entry.name) + ':</span>' +
        '<span>' + escapeHtml(entry.text) + '</span></div>';
    }
    // Combat resolution entries get a tiered, spelled-out layout instead of one
    // flat line — attacker/defender, then the action, then what happened —
    // since a single dense sentence per hit is what made the Ledger hard to
    // read as a human during a real fight.
    if(entry.type === 'combat'){
      return '<div class="log-entry combat">' +
        '<div class="log-meta"><span class="time">' + entry.time + '</span>' +
          (entry.tick != null ? '<span class="tick">Tick ' + entry.tick + '</span>' : '') +
        '</div>' +
        '<div class="log-header">' + escapeHtml(entry.attacker) + ' &rarr; ' + escapeHtml(entry.defender) + '</div>' +
        '<div class="log-action">' + escapeHtml(entry.action) + '</div>' +
        '<div class="log-result">' + escapeHtml(entry.result) + '</div>' +
      '</div>';
    }
    if(entry.type === 'character-active'){
      const header = entry.prevName ? (entry.prevName + ' → ' + entry.name) : entry.name;
      const sub = 'Active character' + (entry.archetype ? ' — ' + entry.archetype : '');
      return '<div class="log-entry combat">' +
        '<div class="log-meta"><span class="time">' + entry.time + '</span></div>' +
        '<div class="log-header">' + escapeHtml(header) + '</div>' +
        '<div class="log-result">' + escapeHtml(sub) + '</div>' +
      '</div>';
    }
    return '<div class="log-entry system"><span class="time">' + entry.time + '</span><span>' +
      escapeHtml(entry.text) + '</span></div>';
  }).join('');
  // #ledger is flex-direction:column-reverse (newest renders at top), which also
  // reverses what scrollTop:0 means — manual scrollTop math fights the browser.
  // scrollIntoView on the newest entry resolves correctly regardless of axis.
  // Two guards on top of that, both earned the hard way: block:'nearest' (not
  // 'end') keeps the scroll contained to #ledger's own overflow-y:auto box
  // rather than planting the entry at the bottom of the whole viewport: but
  // 'nearest' alone still isn't enough when #ledger itself is off-screen
  // (e.g. the user's scrolled up to watch the Sequencer divider) — the
  // browser still has to scroll *something* to bring an invisible element
  // into view, and during resolveRound() (many Ledger entries pushed in
  // quick succession) that was yanking the whole page down and off the
  // divider every time, so you'd never actually see the sweep play out. The
  // real fix: only auto-scroll if #ledger is already at least partly visible
  // — never hijack the page to reveal a panel the user isn't currently
  // looking at.
  if(el.lastElementChild){
    const rect = el.getBoundingClientRect();
    const ledgerVisible = rect.top < window.innerHeight && rect.bottom > 0;
    if(ledgerVisible) el.lastElementChild.scrollIntoView({ block: 'nearest' });
  }
}

export async function sendMessage(){
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if(!text) return;
  const me = AppState.table.players[AppState.playerId];
  await mutateTable(t => {
    t.log.push({ type: 'chat', name: (me && me.name) || 'Someone', text, time: timeNow() });
  });
  input.value = '';
}

// Which player's Group the Add popup (#party-add-popup) currently targets,
// and which kind of slot was clicked. Module-level since the popup itself
// is a single shared instance repositioned per-target, not duplicated per
// player — see openAddPartyPopup() below.
let addPartyTargetId = null;
let addPartyKind = null; // 'possessor' | 'miniparty'

export function renderRoster(){
  const el = document.getElementById('roster');
  if(!el) return;
  const players = (AppState.table && AppState.table.players) || {};
  // Sorted by joinOrder (2026-08-17, dDd's "Player Order in Party is
  // scuffed" note) rather than trusting Object.entries()' own insertion
  // order — see joinOrder's own comment in js/main.js for why. Missing
  // joinOrder (pre-existing records from before this field existed) sorts
  // first rather than erroring.
  const list = Object.entries(players).sort((a, b) => (a[1].joinOrder || 0) - (b[1].joinOrder || 0));
  // Re-rendering innerHTML resets scrollTop to 0 by default — every table
  // update (including someone just moving on the Map) was snapping the Party
  // Panel back to the top, per dDd's 2026-08-17 playthrough note ("Moving
  // changes the Camera in a bad way" — this was the actual culprit, not a
  // real camera). Preserve/restore it across the re-render, same fix shape
  // as the Ledger's own scroll guard above.
  const prevScrollTop = el.scrollTop;
  if(!list.length){ el.innerHTML = '<div class="log-empty">No one here yet.</div>'; return; }

  // The "sandwich" model (see reference/ROADMAP.md, Party System item C):
  // Possessors render above a player's row, Mini-Party members below.
  // Gom/Kulkrow's ambient Tier-5 default always renders as the topmost row
  // for every player — it isn't tracked as data, only manually-added Tier
  // 2-5 possessors and mini-party members are.
  el.innerHTML = list.map(([id, p]) => {
    // Wounds (x) counts UP toward woundsMax (y, the Down threshold) now, not
    // down from it — so the bar has to show *remaining* health (100% at
    // x=0, empty once Down), the inverse of the raw x/y ratio.
    const wounds = p.wounds ?? 0, woundsMax = p.woundsMax || 1;
    const pct = Math.max(0, Math.min(100, Math.round((1 - wounds / woundsMax) * 100)));
    const low = pct <= 30;
    const initial = (p.name || '?').trim().charAt(0).toUpperCase() || '?';
    // Self (2026-08-17, dDd's "obvious this-is-you effect" note) — the
    // reserved Green from the Enemy/Ally/Self palette pass (style-guide.md),
    // its first real UI use. Departed (same date, "grey them out instead of
    // removing") — leaveTable() in main.js now flags departed instead of
    // deleting, so the row (and its history) stays, just dimmed and inert.
    const isSelf = id === AppState.playerId;
    const itemCls = 'roster-item' + (isSelf ? ' self' : '') + (p.departed ? ' departed' : '');

    // Empty Possessor/Mini-Party slots render as their own "+Add" buttons
    // (showAddButtons, last arg) — 2026-08-17 redesign, refined same day:
    // a Player can only build their OWN Group (isSelf) — the buttons
    // simply don't exist on anyone else's — unless Veil Vision is on, which
    // unlocks adding to every connected Player's Group (dDd's own framing:
    // Veil Vision is already the "see/do more than an ordinary Player
    // normally could" toggle). A departed Player's Group is frozen either
    // way, never recruitable.
    const canAddToThisGroup = !p.departed && (isSelf || AppState.veilVision);
    return '<div class="roster-stack' + (p.departed ? ' departed' : '') + '" data-player-id="' + id + '">' +
      possessorGridHtml(p, id, !AppState.veilVision, canAddToThisGroup) +
      '<div class="' + itemCls + '" data-player-id="' + id + '">' +
      '<div class="avatar">' + initial + '</div>' +
      '<div class="roster-info">' +
      '<div class="r-name">' + escapeHtml(p.name || 'Unnamed') + (p.departed ? ' <span class="chip-sub">(left)</span>' : '') + '</div>' +
      '<div class="r-arch">' + escapeHtml(p.archetype || 'No archetype set') + '</div>' +
      '</div>' +
      '<div class="hp-bar-wrap"><div class="hp-bar ' + (low ? 'low' : '') + '" style="width:' + pct + '%"></div></div>' +
      '<div class="hp-text">' + wounds + '/' + woundsMax + '</div>' +
      '<div class="ap-text">' + (p.ap ?? 0) + ' AP</div>' +
      '</div>' +
      miniPartyGridHtml(p, id, canAddToThisGroup) +
      '</div>';
  }).join('');

  el.querySelectorAll('.roster-add-slot').forEach(btn => {
    btn.onclick = (ev) => { ev.stopPropagation(); openAddPartyPopup(btn.dataset.playerId, btn.dataset.kind); };
  });

  // Hover-reveals-an-X removal (2026-08-17) — same pattern as the defeated
  // Enemy chip's .chip-remove-x in combat.js/dm.js, applied here to real
  // (manually-added) Possessors/Mini-Party members. stopPropagation so it
  // doesn't also trigger the parent's click-to-view.
  el.querySelectorAll('.roster-remove-x').forEach(x => {
    x.onclick = (ev) => {
      ev.stopPropagation();
      const { playerId, kind, index } = x.dataset;
      if(kind === 'possessor') removePossessor(playerId, parseInt(index, 10));
      else removeMiniPartyMember(playerId, parseInt(index, 10));
    };
  });

  // Click any name/avatar in the roster — the player themselves, a Possessor,
  // or a Mini-Party member — for the same universal read-only stats snapshot.
  el.querySelectorAll('.roster-item[data-player-id]').forEach(item => {
    item.onclick = () => {
      const player = AppState.table.players[item.dataset.playerId];
      if(player) showCharacterView(player, item.dataset.playerId);
    };
  });
  wirePossessorMiniPartyClicks(el, showCharacterView);
  el.scrollTop = prevScrollTop;
}

// Party Add popup (2026-08-17 redesign) — replaces the old shared inline
// form that lived at the bottom of the Roster. Clicking an empty grid
// slot's "+" button (wired in renderRoster) now opens a small popup
// positioned over that specific Player's Group (their whole .roster-stack
// — Possessors + the Player row + Mini-Party, dDd's own term for the unit)
// instead of a single form shared by the whole Roster. Kind (possessor vs.
// mini-party) is already known from which button was clicked — no separate
// kind-choice step needed anymore.
function openAddPartyPopup(targetPlayerId, kind){
  const stack = document.querySelector('.roster-stack[data-player-id="' + targetPlayerId + '"]');
  const popup = document.getElementById('party-add-popup');
  if(!stack || !popup) return;
  addPartyTargetId = targetPlayerId;
  addPartyKind = kind;

  const rect = stack.getBoundingClientRect();
  // .party-add-popup is `position:fixed` (viewport-relative), so rect.top/
  // right — already viewport-relative via getBoundingClientRect() — are
  // used directly, with NO scrollY/scrollX addition. That addition is only
  // correct for position:absolute (document-relative); adding it here was
  // the actual bug — it placed the popup further down/right by exactly the
  // page's current scroll offset, off in space the first time this ran.
  popup.style.top = Math.round(rect.top) + 'px';
  popup.style.minHeight = Math.round(rect.height) + 'px';
  // Keep it on-screen if the Player's Group is near the right edge —
  // flip to the left side of the Group instead of running off-window.
  const preferredLeft = rect.right + 10;
  popup.style.left = Math.round(preferredLeft + 250 > window.innerWidth ? rect.left - 250 : preferredLeft) + 'px';

  document.getElementById('party-add-popup-title').textContent =
    'Add ' + (kind === 'possessor' ? 'Possessor' : 'Mini-Party Character');
  document.getElementById('add-party-tier-field').classList.toggle('hidden', kind !== 'possessor');
  document.getElementById('add-party-type-field').classList.toggle('hidden', kind !== 'possessor');
  document.getElementById('add-party-name').value = '';
  document.getElementById('add-party-build').value = '';
  popup.classList.remove('hidden');
  document.getElementById('add-party-name').focus();
}

function closeAddPartyPopup(){
  document.getElementById('party-add-popup').classList.add('hidden');
  addPartyKind = null;
  addPartyTargetId = null;
}

async function confirmAddPartyMember(){
  if(!addPartyTargetId || !addPartyKind) return;
  const name = document.getElementById('add-party-name').value.trim();
  if(!name) return;
  const buildKey = document.getElementById('add-party-build').value;
  const stats = buildKey ? { ...BUILDS[buildKey] } : {};
  if(addPartyKind === 'possessor'){
    const tier = parseInt(document.getElementById('add-party-tier').value, 10);
    const type = document.getElementById('add-party-type').value;
    await addPossessor(addPartyTargetId, name, tier, type, stats);
  }else{
    await addMiniPartyMember(addPartyTargetId, name, stats);
  }
  closeAddPartyPopup();
}

// Wires the shared (single-instance) parts of the Add popup — called once
// at startup. The per-slot trigger buttons are wired inside renderRoster
// itself, since they're recreated on every render.
export function initAddPartyMemberUI(){
  const buildOptions = Object.entries(BUILDS).map(([key, b]) => '<option value="' + key + '">' + b.archetype + '</option>').join('');
  document.getElementById('add-party-build').innerHTML = '<option value="">&mdash; blank &mdash;</option>' + buildOptions;
  document.getElementById('party-add-popup-close').addEventListener('click', closeAddPartyPopup);
  document.getElementById('btn-confirm-add-party-member').addEventListener('click', confirmAddPartyMember);
}
