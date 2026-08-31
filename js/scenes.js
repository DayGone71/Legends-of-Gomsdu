import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { defaultMap, FACING_DEFAULT, centerMapView } from './map.js';
import { BUILDS, spawnCharacter } from './character.js';
import { timeNow, deliverMindeyeEntry, showBannerError } from './utils.js';
import { showLoading } from './panels.js';
import { TECHNIQUES, remaining } from './techniques.js';

// Pure data — no imports — so character.js can read SCENES[...].restrictBuilds
// for the Character-panel dropdown without a circular import.
// playerFacing/enemyFacing is the compass reading for two spawns facing each
// other; optional per Scene, falls back to FACING_DEFAULT.
// One Spawn List per Scene — every entry is a Character first, `role`
// ('player'|'npc') is just a property on it like anything else, not a
// structural fork. `role:'player'` entries are slots claimed in join order as
// humans arrive (see seedScene() below); `role:'npc'` entries all spawn
// together at genesis. This is Seed's own payload (TECHNIQUES.seed,
// data/techniques.json) — what Yom actually casts, not a separate spawn mechanism.
export const SCENES = {
  dev: { name: 'Dev' }, // a fresh Table's default state — no map/spawn changes, just unlocks the screen below the Sequencer Divider.
  era1: {
    name: 'Era 1: Tutorial',
    mapWidth: 7, mapHeight: 7,
    spawns: [
      { role: 'player', build: 'living-stone', x: 5, y: 3, facing: 'W' },
      { role: 'npc', build: 'gom', x: 2, y: 3, facing: 'E' }
    ],
    restrictBuilds: ['living-stone', 'gom']
  },
  // A free-form First Era sandbox, played AS Gom, for hands-on Lightning/
  // Focus Powers testing against a cluster of Living Stones. Inert Stone and
  // Kulkrow's own mechanics deliberately left for later.
  era1gom: {
    name: 'Era 1: Gom',
    mapWidth: 24, mapHeight: 30,
    // Gom centered facing South; a Living Stone pair mirrored east/west two
    // rows up (facing inward toward Gom); a 5th below him facing North.
    spawns: [
      { role: 'player', build: 'gom', x: 10, y: 12, facing: 'S' },
      { role: 'npc', build: 'living-stone', x: 8, y: 10, facing: 'E' },
      { role: 'npc', build: 'living-stone', x: 12, y: 10, facing: 'W' },
      { role: 'npc', build: 'living-stone', x: 8, y: 12, facing: 'E' },
      { role: 'npc', build: 'living-stone', x: 12, y: 12, facing: 'W' },
      { role: 'npc', build: 'living-stone', x: 10, y: 14, facing: 'N' },
      // Kulkrow — same position as his own Player spawn in era1kulkrow below;
      // the two Scenes are one shared world, seen from different perspectives.
      { role: 'npc', build: 'kulkrow', x: 19, y: 24 }
    ],
    restrictBuilds: ['gom', 'living-stone', 'kulkrow']
  },
  // The mirror of Era 1: Gom — same Map, Kulkrow spawns where Gom does there,
  // Gom appears as an NPC at that exact position. No Living Stones here — per
  // their own Species, they recognize only Gom as their Creator.
  era1kulkrow: {
    name: 'Era 1: Kulkrow',
    mapWidth: 24, mapHeight: 30,
    spawns: [
      { role: 'player', build: 'kulkrow', x: 19, y: 24 },
      { role: 'npc', build: 'gom', x: 10, y: 12 }
    ],
    restrictBuilds: ['kulkrow', 'gom']
  }
};

// Shared Enemy-spawn helper. Record construction goes through
// character.js's spawnCharacter(); this adds the Scene-specific bits it has
// no business knowing about — which table bucket, and any extra Scene-authored mindeye.
// `eb` is an already-resolved build object (castSeed below is what resolves
// a job's `build` — a BUILDS key or a raw saved-character/roster snapshot — into this).
function spawnNpc(t, enemyId, eb, num, facing, mindeye){
  t.enemies[enemyId] = spawnCharacter(eb, { name: eb.archetype + ' #' + num, num, facing });
  (mindeye || []).forEach(m => {
    deliverMindeyeEntry(t, enemyId, 'Yom', m.glyph);
    const entry = t.enemies[enemyId].mindeye[t.enemies[enemyId].mindeye.length - 1];
    if(m.attachment !== undefined) entry.attachment = m.attachment;
    if(m.desire !== undefined) entry.desire = m.desire;
    entry.seen = true;
  });
}

// Yom, the Universal Characters Table's first real tenant — lives in
// t.characters, not t.enemies. Created once per Table and never rebuilt;
// loadScene()'s reset doesn't wipe him between Scenes.
function spawnYom(t){
  if(!t.characters) t.characters = {};
  if(t.characters.yom) return;
  const b = BUILDS.yom;
  if(!b) return;
  t.characters.yom = spawnCharacter(b, { name: 'Yom' });
}

export async function loadScene(key){
  const scene = SCENES[key];
  if(!scene) return;
  closeSceneMenu();

  if(key === 'dev'){
    await mutateTable(t => {
      t.scene = 'dev';
      t.log.push({ type: 'system', text: 'Scene loaded: Dev', time: timeNow() });
    });
    return;
  }

  // Stub Scenes: no mapWidth means nothing to spawn yet.
  if(!scene.mapWidth){
    showBannerError(scene.name + ' isn’t built yet.');
    return;
  }

  // Loading gate — held open across the reset below AND the Seed cast that
  // follows it, closed only once the camera is actually centered on the real result.
  showLoading(true);
  // Reveal window: #app carries .scene-revealing only for this brief window
  // so the Map token fade-in only plays for a real Scene-genesis reveal, not
  // an ordinary Move/Combat re-render.
  const app = document.getElementById('app');
  if(app) app.classList.add('scene-revealing');
  await mutateTable(t => {
    // Just the reset — actual spawning is Yom's job now (seedScene() below).
    t.scene = key;
    t.map = defaultMap(scene.mapWidth, scene.mapHeight);
    t.enemies = {};
    t.positions = {};
    // Yom appears on the Map alone — the World, with only its own Creator
    // standing in it, for the brief moment before a real Player arrives.
    // spawnYom() is idempotent, this just (re)claims the Tile every Scene load.
    spawnYom(t);
    t.positions.yom = { x: Math.floor(scene.mapWidth / 2), y: Math.floor(scene.mapHeight / 2) };
    t.log.push({ type: 'system', text: 'Scene loaded: ' + scene.name, time: timeNow() });
  });
  await seedScene();
  centerMapView();
  showLoading(false);
  // Facing settles after the fade rather than gating it — 900ms clears the
  // loading fade plus the NPC stagger delay and fade.
  setTimeout(() => { if(app) app.classList.remove('scene-revealing'); }, 900);
}

// Seed's real mechanical effect (TECHNIQUES.seed: "Spawns all Characters
// accordingly") — one shared resolver so Genesis below and any future live
// cast (a Character with real techniqueAccess.seed, staged through the normal
// Technique system) produce the identical result. jobs:
// [{kind:'npc', build, x, y, facing, mindeye} | {kind:'player', playerId, build, x, y, facing}]
export function castSeed(t, jobs){
  if(!t.enemies) t.enemies = {};
  if(!t.positions) t.positions = {};
  const counts = {};
  jobs.forEach(job => {
    if(job.kind === 'npc'){
      // job.build is either a BUILDS key (Scene-authored spawns, the DM
      // spawn picker) or a raw build object (a Saved Character or a Saved
      // Encounter roster snapshot, neither of which lives in BUILDS).
      const eb = typeof job.build === 'string' ? BUILDS[job.build] : job.build;
      if(!eb) return;
      const buildKey = typeof job.build === 'string' ? job.build : (eb.archetype || 'Custom');
      // Numbering counts every already-live enemy of the same archetype too,
      // not just this batch — otherwise a live cast onto an occupied field
      // could mint a "#1" that collides with one already on the Map.
      if(counts[buildKey] === undefined){
        counts[buildKey] = Object.values(t.enemies).filter(e => e.archetype === eb.archetype).length;
      }
      counts[buildKey] += 1;
      const enemyId = 'e_' + Math.random().toString(36).slice(2, 8);
      spawnNpc(t, enemyId, eb, counts[buildKey], job.facing, job.mindeye);
      t.positions[enemyId] = { x: job.x, y: job.y };
    }else if(job.kind === 'player'){
      const build = BUILDS[job.build];
      if(!build) return;
      // A Player Spawns directly into an already-prebuilt Character here —
      // not a form that gets loaded and submitted. spawnCharacter() (same
      // function every NPC and Yom go through) handles Stats, Personality,
      // techniqueAccess, Mindeye, and the initial Behavior Queue fill in one
      // shot; only the human's own chosen name carries over from whatever
      // t.players[job.playerId] already held from joining the table.
      const existingName = t.players[job.playerId] && t.players[job.playerId].name;
      t.players[job.playerId] = spawnCharacter(build, { name: existingName, facing: job.facing });
      t.positions[job.playerId] = { x: job.x, y: job.y };
    }
  });
}

// Yom actually casting Seed — a real staged-and-charged Technique use, not a
// bypass. Costs come straight off TECHNIQUES.seed (data/techniques.json),
// same accounting every other Technique's cost-check uses. Genesis has no
// live Round loop to catch a staged cast (Yom lives in t.characters, never
// swept by combat.js/noncombat.js's per-Round dispatch — this IS the "first
// Round," happening entirely behind the Loading Screen), so this resolves
// immediately rather than waiting on one.
function castSeedAsYom(t, jobs){
  if(!jobs.length) return;
  const yom = t.characters && t.characters.yom;
  if(!yom) return;
  const def = TECHNIQUES.seed;
  yom.lavaSpent = (yom.lavaSpent || 0) + def.costs.lava;
  yom.lightningSpent = (yom.lightningSpent || 0) + def.costs.lightning;
  yom.focusSpent = (yom.focusSpent || 0) + def.costs.focus;
  yom.apSpent = (yom.apSpent || 0) + def.costs.ap;
  if(!yom.sequence) yom.sequence = [];
  yom.sequence.push({ kind: 'technique', techniqueKey: 'seed', jobs });
  // Vanishes first — the World is what resolves visibly (once the Loading
  // Screen lifts), not Yom himself casting it.
  if(t.positions && t.positions.yom) delete t.positions.yom;
  castSeed(t, jobs);
  t.log.push({ type: 'system', text: 'Yom casts Seed — the World takes shape.', time: timeNow() });
}

// Same stacking rule the old DM spawn picker used (js/dm.js, before it
// folded into Seed) — new arrivals fill the upper-right-most Tile until
// there are 5, then continue straight down the rightmost column. `offset`
// lets castSeedLive below pre-compute a whole batch's positions before any
// of them are actually written to t.enemies.
function nextSpawnPosition(t, offset){
  const map = t.map;
  const count = Object.keys(t.enemies || {}).length + offset;
  const row = Math.min(Math.floor(count / 5), (map.height || 1) - 1);
  return { x: (map.width || 1) - 1, y: row };
}

// Yom casting Seed live, mid-session — the ad-hoc counterpart to Genesis's
// own cast above (castSeedAsYom). Same flat, full-pool cost regardless of
// batch size (data/techniques.json's seed entry), and the same immediate
// resolution — Yom is never swept by a Round resolver (see castSeedAsYom's
// own comment), so there's no staged-then-resolved path to hook into here
// either, live or not. `buildRefs`: BUILDS keys and/or raw build objects
// (Saved Characters, a Saved Encounter roster's snapshots) in one array —
// castSeed already resolves either shape per-job.
export async function castSeedLive(buildRefs){
  if(!buildRefs || !buildRefs.length) return;
  const table = AppState.table;
  const yom = table && table.characters && table.characters.yom;
  if(!yom){ showBannerError('Yom hasn’t Seeded this Table yet.'); return; }
  const def = TECHNIQUES.seed;
  for(const [resource, amount] of Object.entries(def.costs)){
    if(resource === 'ap') continue; // Non-Combat doesn't scale to AP yet — see techniques.js's stageTechnique.
    if(remaining(yom, resource) < amount){
      showBannerError('Yom doesn’t have enough ' + resource[0].toUpperCase() + resource.slice(1) + ' left to cast Seed again this Round.');
      return;
    }
  }
  await mutateTable(t => {
    const jobs = buildRefs.map((build, i) => {
      const pos = nextSpawnPosition(t, i);
      return { kind: 'npc', build, x: pos.x, y: pos.y };
    });
    castSeedAsYom(t, jobs);
  });
}

// The real mechanism behind Scene genesis. loadScene() above only clears the
// board and bootstraps Yom onto it; every actual spawn (NPCs, each Player's
// own Character) happens here, in one shared path used by both the DM
// picking a Scene and every join/rejoin (main.js's enterTable()).
//
// Idempotent by design — safe to call more often than genesis should
// actually happen. Only fills in whatever's missing for this client's own
// Player and the Scene's NPCs (only if literally none exist yet); never
// touches anything already spawned.
export async function seedScene(){
  const table = AppState.table;
  if(!table) return;
  const scene = SCENES[table.scene];
  if(!scene || !scene.mapWidth) return; // Dev/stub/no Scene chosen yet — nothing to Seed.

  const myId = AppState.playerId;
  const alreadyPositioned = !!(table.positions && table.positions[myId]);
  const npcSpawns = (scene.spawns || []).filter(s => s.role === 'npc');
  const playerSlots = (scene.spawns || []).filter(s => s.role === 'player');
  const npcsMissing = !!npcSpawns.length && !(table.enemies && Object.keys(table.enemies).length);

  // Which Spawn List slot this Player claims: one slot per Player already
  // positioned so far, first-come-first-served, clamped to the last slot if
  // more Players join than the Scene defines.
  let mySpawn = null;
  if(!alreadyPositioned && playerSlots.length){
    const claimedCount = Object.keys(table.players || {})
      .filter(id => table.positions && table.positions[id]).length;
    mySpawn = playerSlots[Math.min(claimedCount, playerSlots.length - 1)];
  }

  if(!npcsMissing && !mySpawn) return; // Nothing missing — Seed has nothing to do.

  await mutateTable(t => {
    const jobs = [];
    if(npcsMissing){
      npcSpawns.forEach(spawn => jobs.push({ kind: 'npc', build: spawn.build, x: spawn.x, y: spawn.y, facing: spawn.facing, mindeye: spawn.mindeye }));
    }
    if(mySpawn){
      jobs.push({ kind: 'player', playerId: myId, build: mySpawn.build, x: mySpawn.x, y: mySpawn.y, facing: mySpawn.facing });
    }
    castSeedAsYom(t, jobs);
  });
}

export function toggleSceneMenu(){
  const menu = document.getElementById('scene-menu');
  if(menu) menu.classList.toggle('hidden');
}

function closeSceneMenu(){
  const menu = document.getElementById('scene-menu');
  if(menu) menu.classList.add('hidden');
}
