import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { escapeHtml, timeNow } from './utils.js';
import { addPossessor, addMiniPartyMember } from './possession.js';
import { BUILDS } from './character.js';
import { showCharacterView } from './characterView.js';

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
  if(el.lastElementChild) el.lastElementChild.scrollIntoView({ block: 'end' });
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

// Which player's "+ Add AI Party Member" is currently open, and which of
// the two kinds (Possessor / Mini-Party Character) was chosen. Module-level
// since the trigger buttons are per-player and re-rendered every table
// update, but the actual add form (#add-party-fields) is a single shared
// instance below the whole roster, not duplicated per player.
let addPartyTargetId = null;
let addPartyKind = null; // 'possessor' | 'miniparty'

export function renderRoster(){
  const el = document.getElementById('roster');
  if(!el) return;
  const players = (AppState.table && AppState.table.players) || {};
  const list = Object.entries(players);
  if(!list.length){ el.innerHTML = '<div class="log-empty">No one here yet.</div>'; return; }

  // The "sandwich" model (see reference/ROADMAP.md, Party System item C):
  // Possessors render above a player's row, Mini-Party members below.
  // Gom/Kulkrow's ambient Tier-5 default always renders as the topmost row
  // for every player — it isn't tracked as data, only manually-added Tier
  // 2-5 possessors and mini-party members are.
  el.innerHTML = list.map(([id, p]) => {
    const wounds = p.wounds ?? 0, woundsMax = p.woundsMax || 1;
    const pct = Math.max(0, Math.min(100, Math.round((wounds / woundsMax) * 100)));
    const low = pct <= 30;
    const initial = (p.name || '?').trim().charAt(0).toUpperCase() || '?';

    // Shadow Possession uses a filled circle (dimmed); Active Possession uses
    // a hollow circle (full brightness); Mini-Party uses a dotted circle.
    // Gom/Kulkrow's own rows are always Shadow. The possessor grid always
    // reserves 2 default + 2 optional slots (empty ones padded, invisible)
    // so every player's stack is the same height regardless of how many
    // possessors they actually have.
    const defaultPossessorHtml =
      '<div class="roster-possessor shadow"><span class="roster-icon">●</span> Gom (Tier 5)</div>' +
      '<div class="roster-possessor shadow"><span class="roster-icon">●</span> Kulkrow (Tier 5)</div>';
    const possessorEntries = p.possessors || [];
    // Lower-tier (2/3, "Possessor") always renders in the left column, higher-
    // tier (4/5, "Higher Power"/"Supreme Force") in the right — sort by tier
    // ascending before laying out the grid, but keep each entry's *original*
    // array index for data-possessor-index (click-to-view still needs the
    // real position in player.possessors, not its sorted display position).
    const possessorSorted = possessorEntries.map((pos, i) => ({ pos, i })).sort((a, b) => a.pos.tier - b.pos.tier);
    const possessorHtml = possessorSorted.map(({ pos, i }) => {
      const isShadow = pos.type === 'shadow';
      return '<div class="roster-possessor' + (isShadow ? ' shadow' : '') + '" data-player-id="' + id + '" data-possessor-index="' + i + '">' +
        '<span class="roster-icon">' + (isShadow ? '●' : '○') + '</span> ' + escapeHtml(pos.name) + ' (Tier ' + pos.tier + ')</div>';
    }).join('') + '<div class="roster-possessor empty">&nbsp;</div>'.repeat(Math.max(0, 2 - possessorEntries.length));
    // A Possessed member (from the Possess Technique) reflects a *real* Enemy
    // still living in table.enemies — hexagon icon, distinct color, and its
    // current live name (not the frozen name from the moment it was possessed).
    const miniPartyEntries = p.miniParty || [];
    const miniPartyHtml = miniPartyEntries.map((mp, i) => {
      const sourceEnemy = mp.sourceEnemyId && AppState.table.enemies && AppState.table.enemies[mp.sourceEnemyId];
      const isPossessed = !!mp.possessed;
      const displayName = sourceEnemy ? sourceEnemy.name : mp.name;
      return '<div class="roster-miniparty-member' + (isPossessed ? ' possessed' : '') + '" data-player-id="' + id + '" data-miniparty-index="' + i + '">' +
        '<span class="roster-icon">' + (isPossessed ? '⬢' : '⊙') + '</span> ' + escapeHtml(displayName) + '</div>';
    }).join('');

    return '<div class="roster-stack">' +
      '<div class="roster-possessor-grid">' + defaultPossessorHtml + possessorHtml + '</div>' +
      '<div class="roster-item" data-player-id="' + id + '">' +
      '<div class="avatar">' + initial + '</div>' +
      '<div class="roster-info">' +
      '<div class="r-name">' + escapeHtml(p.name || 'Unnamed') + '</div>' +
      '<div class="r-arch">' + escapeHtml(p.archetype || 'No archetype set') + '</div>' +
      '</div>' +
      '<div class="hp-bar-wrap"><div class="hp-bar ' + (low ? 'low' : '') + '" style="width:' + pct + '%"></div></div>' +
      '<div class="hp-text">' + wounds + '/' + woundsMax + '</div>' +
      '<div class="ap-text">' + (p.ap ?? 0) + ' AP</div>' +
      '</div>' +
      (miniPartyHtml ? '<div class="roster-miniparty-grid">' + miniPartyHtml + '</div>' : '') +
      '<button class="btn-ghost btn-small btn-block add-party-member-btn" data-player-id="' + id + '" style="margin-top:6px;">+ Add AI Party Member for ' + escapeHtml(p.name || 'this Character') + '</button>' +
      '</div>';
  }).join('');

  el.querySelectorAll('.add-party-member-btn').forEach(btn => {
    btn.onclick = () => toggleAddPartyFlow(btn.dataset.playerId);
  });

  // Click any name/avatar in the roster — the player themselves, a Possessor,
  // or a Mini-Party member — for the same universal read-only stats snapshot.
  el.querySelectorAll('.roster-item[data-player-id]').forEach(item => {
    item.onclick = () => {
      const player = AppState.table.players[item.dataset.playerId];
      if(player) showCharacterView(player);
    };
  });
  el.querySelectorAll('.roster-possessor[data-possessor-index]').forEach(item => {
    item.onclick = () => {
      const player = AppState.table.players[item.dataset.playerId];
      const pos = player && player.possessors && player.possessors[item.dataset.possessorIndex];
      if(pos) showCharacterView(pos);
    };
  });
  el.querySelectorAll('.roster-miniparty-member[data-miniparty-index]').forEach(item => {
    item.onclick = () => {
      const player = AppState.table.players[item.dataset.playerId];
      const mp = player && player.miniParty && player.miniParty[item.dataset.minipartyIndex];
      if(!mp) return;
      // A Possessed entry reflects a real, still-live Enemy — show its actual
      // current stats, not the frozen stub captured at possession time.
      const sourceEnemy = mp.sourceEnemyId && AppState.table.enemies && AppState.table.enemies[mp.sourceEnemyId];
      showCharacterView(sourceEnemy || mp);
    };
  });
}

function toggleAddPartyFlow(targetPlayerId){
  const kindRow = document.getElementById('add-party-kind-row');
  const fields = document.getElementById('add-party-fields');
  const isOpen = !kindRow.classList.contains('hidden') || !fields.classList.contains('hidden');
  if(isOpen && addPartyTargetId === targetPlayerId){
    kindRow.classList.add('hidden');
    fields.classList.add('hidden');
    addPartyTargetId = null;
    addPartyKind = null;
    return;
  }
  addPartyTargetId = targetPlayerId;
  kindRow.classList.remove('hidden');
  fields.classList.add('hidden');
}

function showAddPartyFields(kind){
  addPartyKind = kind;
  document.getElementById('add-party-fields').classList.remove('hidden');
  document.getElementById('add-party-tier-field').classList.toggle('hidden', kind !== 'possessor');
  document.getElementById('add-party-type-field').classList.toggle('hidden', kind !== 'possessor');
  document.getElementById('add-party-name').value = '';
  document.getElementById('add-party-build').value = '';
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
  document.getElementById('add-party-fields').classList.add('hidden');
  document.getElementById('add-party-kind-row').classList.add('hidden');
  addPartyKind = null;
  addPartyTargetId = null;
}

// Wires the shared (single-instance) parts of the Add form — called once at
// startup. The per-player trigger buttons are wired inside renderRoster
// itself, since they're recreated on every render.
export function initAddPartyMemberUI(){
  const buildOptions = Object.entries(BUILDS).map(([key, b]) => '<option value="' + key + '">' + b.archetype + '</option>').join('');
  document.getElementById('add-party-build').innerHTML = '<option value="">&mdash; blank &mdash;</option>' + buildOptions;
  document.getElementById('add-party-kind-possessor').addEventListener('click', () => showAddPartyFields('possessor'));
  document.getElementById('add-party-kind-miniparty').addEventListener('click', () => showAddPartyFields('miniparty'));
  document.getElementById('btn-confirm-add-party-member').addEventListener('click', confirmAddPartyMember);
}
