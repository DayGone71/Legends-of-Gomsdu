// Central, shared in-memory state for the running app.
// `table` mirrors the synced session blob from Supabase (players, enemies, log, map, inEncounter).
export const AppState = {
  currentCode: null,
  playerId: null,
  table: null,
  unsubscribe: null,

  // Player combat staging
  selectedTargetId: null,
  selectedTargetSide: 'enemy', // 'enemy' | 'ally' — which range the current selectedTargetId came from
  pendingType: null,
  pendingAttackKind: null,
  pendingEssenceSchool: null,
  pendingBlockKind: null, // 'general' | 'target'
  pendingCounter: false,

  // Attack/Block/Essence staging for whoever's currently Active — js/dm.js,
  // merged 2026-08-30 onto activeCharacterId below instead of its own
  // separate actingEnemyId (the two were always kept numerically identical
  // by js/activeCharacter.js's toggleActiveCharacter, just via two fields).
  // Names kept "dm"-prefixed for now — this engine used to be DM Panel-only,
  // isn't anymore, but the file/panel haven't been renamed yet. Essence's
  // own staging (dmPendingCraftKey picked) hands off to techniques.js's
  // quickStageTechnique rather than duplicating its cost/order logic here.
  dmSelectedTargetId: null,
  dmPendingType: null,
  dmPendingCraftKey: null,
  dmPendingBlockKind: null,
  dmPendingCounter: false,

  // UI-only, never synced
  activePanel: null,
  mapEditMode: false,
  // TATA toggle — switches Movement's Tile-click handling from Player/Party
  // to Non-Player.
  tataActive: false,
  // Which real table.enemies id, if any, TATA has explicitly made Active;
  // null means the default, The Architect (see js/activeCharacter.js). Only
  // meaningful while tataActive is true.
  activeCharacterId: null,
  // Which Character id, if any, the Information/Personality/Relationships
  // panels are currently showing instead of the viewing Player's own. Set
  // from an NPC Panel row button, cleared the moment any of those 3 panels
  // is opened normally — read-only while set, since this is for inspecting,
  // not editing someone else's Character.
  inspectTargetId: null,
  // Which Tile currently has its occupancy popup(s) showing ({x,y} or
  // null), and which actor (if any) is mid tile-pick ({ actorId } or null)
  // after confirming "Move?".
  moveClickTile: null,
  moveSelectMode: null,
  // A fixed VIEWPORT_TILES x VIEWPORT_TILES window that pans over a bigger
  // table.map via tile-clicker buttons. {x,y} of the window's own top-left
  // corner, in real map coordinates; clamped to the map's bounds on every
  // render (js/map.js's renderMap). Local-only, like tataActive — each
  // viewer pans their own window independently. mapViewHistory is a small
  // undo stack of previous offsets, popped by the "back" pan-history
  // button.
  mapViewOffset: { x: 0, y: 0 },
  mapViewHistory: [],
  // Which Build keys, if any, the current Scene restricts Character-panel
  // loading to; recomputed every renderAll() from AppState.table.scene, see
  // js/scenes.js's SCENES and js/main.js.
  sceneBuildRestriction: null,
  // A personal, local-only "see through the fog" toggle, deliberately not
  // synced to the table: it's meant to feel like your own vision changing,
  // not a shared DM broadcast, so one player turning it on must not reveal
  // anything to anyone else connected.
  veilVision: false,

  // DM Test panel — per-actor auto-battle config and run state, all local/UI-only
  dmTestConfig: { enemies: {}, players: {} },
  dmTestRunning: false,
  dmTestLastResult: null
};

// This tab's "which table was I in" memory. Deliberately sessionStorage, not
// localStorage: localStorage is shared by every tab in the browser profile, so
// two tabs open to the same table would constantly stomp each other's
// remembered identity — exactly the "everyone keeps turning into everyone else"
// bug this app hit repeatedly during multi-tab testing. sessionStorage is scoped
// per tab, which is what "which browser window am I" actually needs.
const REMEMBER_KEY = 'gomsdu-active-session';

export function rememberMe(code, playerId, name){
  try{
    sessionStorage.setItem(REMEMBER_KEY, JSON.stringify({ code, playerId, name }));
  }catch(e){ /* ignore */ }
}

export function forgetMe(){
  try{ sessionStorage.removeItem(REMEMBER_KEY); }catch(e){ /* ignore */ }
}

export function recallMe(){
  try{
    const raw = sessionStorage.getItem(REMEMBER_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}
