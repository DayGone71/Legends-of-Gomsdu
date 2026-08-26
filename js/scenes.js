import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { defaultMap, FACING_DEFAULT, centerMapView } from './map.js';
import { BUILDS, loadBuild, makeActiveCharacter, spawnCharacter } from './character.js';
import { timeNow, deliverMindeyeEntry, showBannerError } from './utils.js';
import { showLoading } from './panels.js';

// Pure data — no imports — so character.js can read SCENES[...].restrictBuilds
// for the Character-panel dropdown without a circular import.
// playerFacing/enemyFacing is the compass reading for two spawns facing each
// other; optional per Scene, falls back to FACING_DEFAULT.
export const SCENES = {
  dev: { name: 'Dev' }, // a fresh Table's default state — no map/spawn changes, just unlocks the screen below the Sequencer Divider.
  era1: {
    name: 'Era 1: Tutorial',
    mapWidth: 7, mapHeight: 7,
    playerSpawns: [
      { build: 'living-stone', x: 5, y: 3, facing: 'W' }
    ],
    npcSpawns: [
      { build: 'gom', x: 2, y: 3, facing: 'E' }
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
    playerSpawns: [
      { build: 'gom', x: 10, y: 12, facing: 'S' }
    ],
    npcSpawns: [
      { build: 'living-stone', x: 8, y: 10, facing: 'E' },
      { build: 'living-stone', x: 12, y: 10, facing: 'W' },
      { build: 'living-stone', x: 8, y: 12, facing: 'E' },
      { build: 'living-stone', x: 12, y: 12, facing: 'W' },
      { build: 'living-stone', x: 10, y: 14, facing: 'N' },
      // Kulkrow — same position as his own Player spawn in era1kulkrow below;
      // the two Scenes are one shared world, seen from different perspectives.
      { build: 'kulkrow', x: 19, y: 24 }
    ],
    restrictBuilds: ['gom', 'living-stone', 'kulkrow']
  },
  // The mirror of Era 1: Gom — same Map, Kulkrow spawns where Gom does there,
  // Gom appears as an NPC at that exact position. No Living Stones here — per
  // their own Species, they recognize only Gom as their Creator.
  era1kulkrow: {
    name: 'Era 1: Kulkrow',
    mapWidth: 24, mapHeight: 30,
    playerSpawns: [
      { build: 'kulkrow', x: 19, y: 24 }
    ],
    npcSpawns: [
      { build: 'gom', x: 10, y: 12 }
    ],
    restrictBuilds: ['kulkrow', 'gom']
  }
};

// Shared Enemy-spawn helper. Record construction goes through
// character.js's spawnCharacter(); this adds the Scene-specific bits it has
// no business knowing about — which table bucket, and any extra Scene-authored mindeye.
function spawnNpc(t, enemyId, build, num, facing, mindeye){
  const eb = BUILDS[build];
  if(!eb) return;
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

// Seed — Yom's own Master Technique, and the real mechanism behind Scene
// genesis. loadScene() above only clears the board; every actual spawn (NPCs,
// each Player's own Character) happens here, in one shared path used by both
// the DM picking a Scene and every join/rejoin (main.js's enterTable()).
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
  const npcsMissing = !!(scene.npcSpawns && scene.npcSpawns.length) &&
    !(table.enemies && Object.keys(table.enemies).length);

  // Which Spawn List slot this Player claims: one slot per Player already
  // positioned so far, first-come-first-served, clamped to the last slot if
  // more Players join than the Scene defines.
  let mySpawn = null;
  if(!alreadyPositioned && scene.playerSpawns && scene.playerSpawns.length){
    const claimedCount = Object.keys(table.players || {})
      .filter(id => table.positions && table.positions[id]).length;
    mySpawn = scene.playerSpawns[Math.min(claimedCount, scene.playerSpawns.length - 1)];
  }

  if(!npcsMissing && !mySpawn) return; // Nothing missing — Seed has nothing to do.

  // One write for everything that doesn't need t.players[myId] to already
  // exist — NPC spawns, my Tile claim, Yom's vanishing act, the log line.
  // What's left (Personality/Mindeye/Facing) needs makeActiveCharacter() to
  // have committed t.players[myId] first, so it's a second write below.
  await mutateTable(t => {
    if(npcsMissing){
      if(!t.enemies) t.enemies = {};
      if(!t.positions) t.positions = {};
      const counts = {};
      scene.npcSpawns.forEach(spawn => {
        counts[spawn.build] = (counts[spawn.build] || 0) + 1;
        const enemyId = 'e_' + Math.random().toString(36).slice(2, 8);
        spawnNpc(t, enemyId, spawn.build, counts[spawn.build], spawn.facing, spawn.mindeye);
        t.positions[enemyId] = { x: spawn.x, y: spawn.y };
      });
    }
    if(mySpawn){
      if(!t.positions) t.positions = {};
      t.positions[myId] = { x: mySpawn.x, y: mySpawn.y };
      // Yom vanishes from the Map the moment a real Player arrives in the
      // World he Seeded — stays a real Character in t.characters, just no
      // longer positioned.
      if(t.positions.yom) delete t.positions.yom;
    }
    t.log.push({ type: 'system', text: 'Yom casts Seed — the World takes shape.', time: timeNow() });
  });

  if(mySpawn && mySpawn.build){
    // loadBuild()/makeActiveCharacter() drive the Character sheet's own
    // form + commit flow — can't fold into the write above since
    // t.players[myId] has to exist before Personality/Mindeye/Facing land.
    loadBuild(mySpawn.build);
    await makeActiveCharacter();

    const build = BUILDS[mySpawn.build];
    await mutateTable(t => {
      const p = t.players[myId];
      if(build && build.personality && p) p.personality = JSON.parse(JSON.stringify(build.personality));
      // techniqueAccess carried over the same way — saveCharacter()'s own
      // sheet-save no longer writes this field (old 4-category checkboxes,
      // incompatible with per-Technique access), so without this a Player
      // would fall back to the permissive default and get every Technique.
      if(build && build.techniqueAccess && p) p.techniqueAccess = JSON.parse(JSON.stringify(build.techniqueAccess));
      if(build) (build.startingMindeye || []).forEach(g => deliverMindeyeEntry(t, myId, 'Star Father', g, true));
      if(mySpawn.facing && p) p.facing = mySpawn.facing;
    });
  }
}

export function toggleSceneMenu(){
  const menu = document.getElementById('scene-menu');
  if(menu) menu.classList.toggle('hidden');
}

function closeSceneMenu(){
  const menu = document.getElementById('scene-menu');
  if(menu) menu.classList.add('hidden');
}
