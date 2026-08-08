const STORAGE_KEY = 'gomsdu-saved-characters';

// Personal, browser-local library of custom character templates — same reasoning as
// "remember my session" in state.js: this is per-user data with no shared/session
// meaning, so localStorage is the right tool rather than something synced through
// Supabase. Known limitation: doesn't follow you across devices or other players.

export function getSavedCharacters(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(e){
    return {};
  }
}

export function saveCharacterTemplate(name, stats){
  const all = getSavedCharacters();
  all[name] = stats;
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); }catch(e){ /* ignore */ }
}

export function deleteSavedCharacter(name){
  const all = getSavedCharacters();
  delete all[name];
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); }catch(e){ /* ignore */ }
}
