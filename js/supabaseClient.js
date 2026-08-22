import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let client = null;
function getClient(){
  if(!client){
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

// Loads the current state blob for a session code. Returns null if not found.
export async function loadSession(code){
  try{
    const { data, error } = await getClient()
      .from('sessions')
      .select('state')
      .eq('code', code)
      .maybeSingle();
    if(error){
      console.error('loadSession error from Supabase:', error.message, error);
      return null;
    }
    return data ? data.state : null;
  }catch(e){
    console.error('loadSession failed (network/client error):', e);
    return null;
  }
}

// Creates or overwrites the state blob for a session code. With no
// expectedVersion, this is a plain upsert (table creation — see
// createNewSession below). With an expectedVersion, it's a CONDITIONAL
// update (2026-08-21, optimistic concurrency — see mutateTable in sync.js):
// only writes if state's own embedded _version still matches what the
// caller last read, using PostgREST's JSON-path filter syntax directly on
// the jsonb column rather than needing a real schema migration for a
// dedicated version column. Returns {ok, conflict} so the caller can tell
// "a real error" (conflict:false) apart from "someone else wrote first,
// please retry" (conflict:true).
export async function saveSession(code, state, expectedVersion){
  try{
    let query = getClient().from('sessions');
    if(expectedVersion === undefined){
      const { error } = await query.upsert({ code, state }, { onConflict: 'code' });
      if(error){
        console.error('saveSession error from Supabase:', error.message, error);
        return { ok: false, conflict: false };
      }
      return { ok: true, conflict: false };
    }

    const { data, error } = await query
      .update({ state })
      .eq('code', code)
      .eq('state->>_version', String(expectedVersion))
      .select('code');
    if(error){
      console.error('saveSession error from Supabase:', error.message, error);
      return { ok: false, conflict: false };
    }
    if(!data || data.length === 0){
      return { ok: false, conflict: true }; // 0 rows matched — version race, not a real error
    }
    return { ok: true, conflict: false };
  }catch(e){
    console.error('saveSession failed (network/client error):', e);
    return { ok: false, conflict: false };
  }
}

// Subscribes to live updates for a session code. Calls onChange(newState) whenever
// another client saves. Returns an unsubscribe function.
export function subscribeToSession(code, onChange){
  const channel = getClient()
    .channel('session:' + code)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sessions', filter: 'code=eq.' + code },
      (payload) => {
        if(payload && payload.new && payload.new.state){
          onChange(payload.new.state);
        }
      }
    )
    .subscribe((status, err) => {
      if(err) console.error('Realtime subscription error:', err);
    });

  return function unsubscribe(){
    getClient().removeChannel(channel);
  };
}
