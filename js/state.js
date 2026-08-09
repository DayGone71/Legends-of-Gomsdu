// Central, shared in-memory state for the running app.
// `table` mirrors the synced session blob from Supabase (players, enemies, log, map, inEncounter).
export const AppState = {
  currentCode: null,
  playerId: null,
  table: null,
  unsubscribe: null,

  // Player combat staging
  selectedTargetId: null,
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
  mapEditMode: false
};

// This browser's "which table was I in" memory — purely local, not shared game state,
// so localStorage is the right tool here (unlike the old Claude-artifact prototype).
const REMEMBER_KEY = 'gomsdu-active-session';

export function rememberMe(code, playerId, name){
  try{
    localStorage.setItem(REMEMBER_KEY, JSON.stringify({ code, playerId, name }));
  }catch(e){ /* ignore */ }
}

export function forgetMe(){
  try{ localStorage.removeItem(REMEMBER_KEY); }catch(e){ /* ignore */ }
}

export function recallMe(){
  try{
    const raw = localStorage.getItem(REMEMBER_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}
