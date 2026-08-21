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

  // DM combat staging
  actingEnemyId: null,
  dmSelectedTargetId: null,
  dmPendingType: null,
  dmPendingAttackKind: null,
  dmPendingCraftKey: null,
  dmPendingBlockKind: null,
  dmPendingCounter: false,

  // UI-only, never synced
  activePanel: null,
  mapEditMode: false,
  // TATA toggle (2026-08-20, per dDd) — switches Movement's Tile-click
  // handling from Player/Party to Non-Player. First pass only wires this
  // into Movement's own click-detection branch — the fuller "Party becomes
  // Enemy Tiles" swap is its own separate, not-yet-built scope.
  tataActive: false,
  // Movement (2026-08-20) — which Tile currently has its occupancy popup(s)
  // showing ({x,y} or null), and which actor (if any) is mid tile-pick
  // ({ actorId } or null) after confirming "Move?".
  moveClickTile: null,
  moveSelectMode: null,
  // New Game Process (2026-08-20) — which Build keys, if any, the current
  // Scene restricts Character-panel loading to; recomputed every renderAll()
  // from AppState.table.scene, see js/scenes.js's SCENES and js/main.js.
  sceneBuildRestriction: null,
  // Veil Vision (2026-08-16) — a personal, local-only "see through the fog"
  // toggle, deliberately not synced to the table: it's meant to feel like
  // your own vision changing, not a shared DM broadcast, so one player
  // turning it on must not reveal anything to anyone else connected.
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
