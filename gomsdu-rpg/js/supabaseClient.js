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
    if(error || !data) return null;
    return data.state;
  }catch(e){
    console.error('loadSession failed', e);
    return null;
  }
}

// Creates or overwrites the state blob for a session code.
export async function saveSession(code, state){
  try{
    const { error } = await getClient()
      .from('sessions')
      .upsert({ code, state }, { onConflict: 'code' });
    return !error;
  }catch(e){
    console.error('saveSession failed', e);
    return false;
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
    .subscribe();

  return function unsubscribe(){
    getClient().removeChannel(channel);
  };
}
