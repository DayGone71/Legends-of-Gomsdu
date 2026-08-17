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
  dmPendingEssenceSchool: null,
  dmPendingBlockKind: null,
  dmPendingCounter: false,

  // UI-only, never synced
  activePanel: null,
  mapEditMode: false,
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
