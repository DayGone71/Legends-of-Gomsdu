import { AppState } from './state.js';
import { loadSession, saveSession, subscribeToSession } from './supabaseClient.js';

// Every render happens in response to a realtime update — including our own writes,
// since Supabase's realtime fires for any change to the row, not just ones from
// other clients. That keeps "when do we re-render" consistent for everyone at once,
// rather than needing a separate optimistic-local-update path.
let onStateChange = null;
export function registerRenderCallback(fn){
  onStateChange = fn;
}

export async function connectToSession(code){
  const state = await loadSession(code);
  if(!state) return false;

  AppState.currentCode = code;
  AppState.table = state;

  if(AppState.unsubscribe) AppState.unsubscribe();
  AppState.unsubscribe = subscribeToSession(code, (newState) => {
    AppState.table = newState;
    if(onStateChange) onStateChange();
  });

  return true;
}

export async function createNewSession(code, initialState){
  const ok = await saveSession(code, initialState);
  if(!ok) return false;
  return connectToSession(code);
}

// Applies a synchronous mutator to the in-memory table, then persists it.
// The mutator receives the live table object and edits it directly.
export async function mutateTable(mutatorFn){
  if(!AppState.table) return false;
  mutatorFn(AppState.table);
  const ok = await saveSession(AppState.currentCode, AppState.table);
  return ok;
}

export function disconnect(){
  if(AppState.unsubscribe){
    AppState.unsubscribe();
    AppState.unsubscribe = null;
  }
  AppState.currentCode = null;
  AppState.playerId = null;
  AppState.table = null;
}
