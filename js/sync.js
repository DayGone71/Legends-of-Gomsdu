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

// Fires the same full render every table mutation's realtime echo triggers —
// for local-only UI toggles (TATA, Veil Vision, Map edit mode) that change
// what should be on screen but never touch table.* at all, so there's no
// mutation and thus no realtime echo to ride along on. Without this, a
// toggle like TATA's View 2 swap (js/main.js's renderView2Mode) would only
// ever visually update on the *next* unrelated table change, not the click
// that actually toggled it.
export function triggerRender(){
  if(onStateChange) onStateChange();
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
  initialState._version = 0; // optimistic concurrency's own counter — see mutateTable below
  const result = await saveSession(code, initialState);
  if(!result.ok) return false;
  return connectToSession(code);
}

function showSyncErrorBanner(msg){
  const el = document.getElementById('banner-error');
  if(!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 6000);
}

// Applies a synchronous mutator to the in-memory table, then persists it.
// The mutator receives the live table object and edits it directly.
//
// Optimistic concurrency (2026-08-21) — the real fix for the whole-row-
// upsert clobbering race flagged in ROADMAP.md's Networking & Sync (a rapid-
// fire OC call sequence was the first thing to actually trigger it; ordinary
// human play mostly avoids it by construction, but it's a real residual
// risk). table._version is embedded right in the state blob itself, no
// schema migration needed — supabaseClient.js's saveSession() does a
// conditional write keyed on it. On a version conflict (someone else's
// write landed first), this re-fetches the real current state and replays
// the SAME mutatorFn on top of it, rather than silently losing either
// side's change — own actions still apply instantly, locally, same as
// before; the retry is invisible unless it actually can't land.
const MUTATE_MAX_RETRIES = 5;
export async function mutateTable(mutatorFn){
  if(!AppState.table) return false;

  for(let attempt = 1; attempt <= MUTATE_MAX_RETRIES; attempt++){
    const expectedVersion = AppState.table._version || 0;
    mutatorFn(AppState.table);
    AppState.table._version = expectedVersion + 1;

    const result = await saveSession(AppState.currentCode, AppState.table, expectedVersion);
    if(result.ok) return true;

    if(!result.conflict){
      // A real save error (network/Supabase), not a version race — retrying
      // won't help, and supabaseClient.js already console.error'd the
      // specifics. The player still needs to know their action didn't land.
      showSyncErrorBanner('Could not save your last action — please try again.');
      return false;
    }

    console.warn('[sync] mutateTable version conflict on attempt ' + attempt + ' of ' + MUTATE_MAX_RETRIES + ' — refetching and retrying the same change.', mutatorFn.toString().slice(0, 300));
    const fresh = await loadSession(AppState.currentCode);
    if(!fresh){
      showSyncErrorBanner('Lost connection while saving — your last change may not have gone through.');
      return false;
    }
    AppState.table = fresh;
  }

  console.error('[sync] mutateTable gave up after ' + MUTATE_MAX_RETRIES + ' version conflicts — this change was NOT saved.', mutatorFn.toString().slice(0, 300));
  showSyncErrorBanner('Your last action kept colliding with someone else’s and was not saved — please try again.');
  return false;
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
