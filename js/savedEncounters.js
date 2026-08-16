const STORAGE_KEY = 'gomsdu-saved-encounters';

// Personal, browser-local library of whole-encounter enemy rosters — same
// reasoning as savedCharacters.js: per-user data with no shared/session
// meaning, so localStorage rather than something synced through Supabase.

export function getSavedEncounters(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(e){
    return {};
  }
}

export function saveEncounterTemplate(name, enemies){
  const all = getSavedEncounters();
  all[name] = enemies;
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); }catch(e){ /* ignore */ }
}
