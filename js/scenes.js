import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { defaultMap, FACING_DEFAULT, centerMapView } from './map.js';
import { BUILDS, loadBuild, makeActiveCharacter, spawnCharacter } from './character.js';
import { timeNow, deliverMindeyeEntry, showBannerError } from './utils.js';
import { showLoading } from './panels.js';

// New Game Process (2026-08-20), per dDd. Pure data — no imports — so
// character.js can read SCENES[...].restrictBuilds for the Character-panel
// dropdown without importing loadScene() below (which needs character.js
// right back; kept one-way instead of circular).
// `playerFacing`/`enemyFacing` (2026-08-22, per dDd: "Facing should actually
// be resolved by Scene Spawn information... in first Scene, Gom is facing
// right and player facing left") — the compass reading of that ("right"/
// "left" on the map's own N-top/W-left/E-right/S-bottom compass) for D2/D5
// facing each other across the Tile grid: Player (D2, the eastern of the
// two) faces West toward Gom; Gom (D5, western) faces East toward the
// Player. Optional per Scene — `loadScene()` below falls back to
// `FACING_DEFAULT` for any Scene that doesn't specify one, same
// backward-compatible default every other new gate in this codebase uses.
export const SCENES = {
  dev: { name: 'Dev' }, // exactly what a fresh Table already looked like — no map/spawn changes, just unlocks the screen below the Sequencer Divider.
  era1: {
    name: 'Era 1: Tutorial', // renamed 2026-08-22, per dDd — same Scene, same key, same everything else; just a clearer name now that a second Era 1 Scene exists alongside it.
    mapWidth: 7, mapHeight: 7,
    // Normalized onto the Spawn List shape (2026-08-23) — this was the last
    // Scene still using the older single playerBuild/enemyBuild/playerTile/
    // enemyTile fields; converting it means seedScene() below (Yom's own
    // Seed, replacing loadScene()'s old direct-spawn code) only needs one
    // shape to read, not two. Coordinates are the same D2/D5 Tiles as
    // before, just pre-converted from the old row-letter-first format via
    // the now-removed tileXY() helper (row 'D' = index 3 counting down from
    // the top of a 7-tall map; column '2'/'5' = width(7) minus the column
    // number): D2 -> {x:5,y:3}, D5 -> {x:2,y:3}.
    playerSpawns: [
      { build: 'living-stone', x: 5, y: 3, facing: 'W' }
    ],
    npcSpawns: [
      // The scripted extra `mindeye: [{ glyph: 'WIM' }]` this used to carry
      // (2026-08-22 workaround for Gom spawning with an empty Mindeye
      // entirely, before he had a real startingMindeye of his own) was
      // removed 2026-08-24 — Gom's own Build now carries all 39 real
      // Glyphs, WIM included, so this had been silently duplicating one of
      // his own innate entries (a redundant Retained-tier copy sitting
      // alongside the real Perfected one) ever since the actual fix landed.
      { build: 'gom', x: 2, y: 3, facing: 'E' }
    ],
    restrictBuilds: ['living-stone', 'gom']
  },
  // Era 1: Gom (2026-08-22, per dDd) — a free-form First Era sandbox, played
  // AS Gom ("you Spawn as Gom"), for hands-on Lightning/Focus Powers testing
  // against a cluster of Living Stones and iterating on Behavior-to-Glyph
  // mappings ("figuring out how to raise the Living Stone through practical
  // hands-on experience"). First playable pass, per dDd's own scoping: "Gom
  // can also start with lots of Living Stone, if we just want to focus on
  // interacting with them" — Inert Stone and Kulkrow (his own Sonic-Mindeye/
  // Body-Parts mechanics aren't designed yet) deliberately left for later.
  //
  // Uses the Spawn List (playerSpawns/npcSpawns below) — every Scene does
  // now, as of the 2026-08-23 Seed/Yom pass (Era 1: Tutorial was the last
  // holdout on the older single playerBuild/enemyBuild shape). Plain {x,y}
  // coordinates rather than tileXY's row-letter string keys: a 30-tall map's
  // row LETTERS already overflow past Z into raw ASCII symbols (map.js's
  // rowLabel, a real but harmless cosmetic-only quirk), so letter keys
  // stopped being a readable way to author spawns at this size.
  era1gom: {
    name: 'Era 1: Gom',
    mapWidth: 24, mapHeight: 30,
    // Re-arranged 2026-08-24, per dDd's own Tile-Code layout (column-number
    // + row-letter, e.g. "14,R" = column 14, row R — matching js/map.js's
    // real tileKey() format, not the older row-letter-first tileXY() one):
    // Gom centered facing South, a Living Stone pair mirrored east/west on
    // either side of him (facing inward, toward each other across Gom) two
    // rows up, and a 5th Living Stone below him facing North.
    playerSpawns: [
      { build: 'gom', x: 10, y: 12, facing: 'S' }
    ],
    npcSpawns: [
      { build: 'living-stone', x: 8, y: 10, facing: 'E' },
      { build: 'living-stone', x: 12, y: 10, facing: 'W' },
      { build: 'living-stone', x: 8, y: 12, facing: 'E' },
      { build: 'living-stone', x: 12, y: 12, facing: 'W' },
      { build: 'living-stone', x: 10, y: 14, facing: 'N' },
      // Kulkrow (2026-08-23, per dDd — "the Gom scene should have Kulkrow
      // in it, where he is [as Player] in the Kulkrow scene. Literally the
      // same scene from different perspectives."). Same position as his own
      // Player spawn in SCENES.era1kulkrow below — the two Scenes are one
      // shared world, just which brother you're playing as differs.
      { build: 'kulkrow', x: 19, y: 24 }
    ],
    restrictBuilds: ['gom', 'living-stone', 'kulkrow']
  },
  // Era 1: Kulkrow (2026-08-23, per dDd) — the mirror of Era 1: Gom above:
  // same 24x30 Map, Kulkrow spawns in the opposite corner from where Gom
  // spawns there, and Gom himself appears as an NPC at that exact position
  // — the same world, seen from the other brother's side. No Living Stones
  // here on purpose: per their own Species definition (SPECIES.rock,
  // js/character.js) they "recognize only Gom as their Creator — no
  // Kulkrow connection at all," so they don't belong in Kulkrow's own
  // roster. Kulkrow's own equivalent flock isn't designed yet (see
  // ROADMAP.md, Dungeon Master Panel section).
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

// Shared Enemy-spawn helper — both the older single-enemyBuild path and the
// newer Spawn List path build an Enemy the exact same way. Record
// construction itself now goes through js/character.js's spawnCharacter()
// (2026-08-24, per dDd's spawn-consolidation call) — this just adds the
// Scene-specific bits spawnCharacter() has no business knowing about: which
// table bucket, and any extra Scene-authored mindeye on top of the Build's
// own innate one.
function spawnNpc(t, enemyId, build, num, facing, mindeye){
  const eb = BUILDS[build];
  if(!eb) return;
  t.enemies[enemyId] = spawnCharacter(eb, { name: eb.archetype + ' #' + num, num, facing });
  // Scene-specific extras (e.g. Era 1: Tutorial's enemyMindeye) layer on top
  // of the Build's own innate Mindeye, which spawnCharacter() already built.
  (mindeye || []).forEach(m => {
    deliverMindeyeEntry(t, enemyId, 'Yom', m.glyph); // was 'TATA' — renamed 2026-08-23 alongside TATA's own retirement, see js/activeCharacter.js
    const entry = t.enemies[enemyId].mindeye[t.enemies[enemyId].mindeye.length - 1];
    if(m.attachment !== undefined) entry.attachment = m.attachment;
    if(m.desire !== undefined) entry.desire = m.desire;
    entry.seen = true;
  });
}

// Yom, the Universal Characters Table's first real tenant (2026-08-24, per
// dDd: "Yom is a Full Character in the Data Model. We scoped that, we
// planned for that." — js/activeCharacter.js's old yomDisplayCharacter()
// rebuilt him fresh off BUILDS.yom every render instead, with no persisted
// record at all; that was the actual gap). Lives in the new t.characters
// bucket, not t.enemies — table.players/table.enemies stay exactly where
// they are for now, per dDd's own "merge feature by feature, not a
// rewrite" call (reference/dialogue-system.md, 2026-08-22). Created once
// per Table and never rebuilt — unlike enemies, loadScene()'s reset doesn't
// wipe him between Scenes, same as a Player's own Character surviving a
// Scene switch.
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

  // Stub Scenes (2026-08-22, per dDd) — no mapWidth means nothing to spawn
  // yet. Refuses cleanly rather than crashing on undefined map dimensions
  // or touching the current table at all.
  if(!scene.mapWidth){
    showBannerError(scene.name + ' isn’t built yet.');
    return;
  }

  // Loading gate (2026-08-23), per dDd's own live diagnosis: "all the Logic
  // happens after the Map loads. The Camera adjust, the Characters Spawn...
  // racing and winner is random." Held open across the reset below AND the
  // Seed cast that follows it (2026-08-23 — genesis itself moved into
  // seedScene(), Yom's own Master Technique, see its own comment below),
  // closed only once the camera is actually centered on the real result.
  showLoading(true);
  // Reveal window (2026-08-24, per dDd's own spec — "Loading Screen is timed
  // to fade away as the Player fades in, followed by NPCS"). #app carries
  // .scene-revealing only for this brief window; css/panels.css scopes the
  // Map token fade-in animation to it specifically, so an ordinary Move/
  // Combat re-render later never replays a fade — only a real Scene-genesis
  // reveal does. Removed on a timer below, well after both the loading
  // overlay and every staggered token fade have actually finished.
  const app = document.getElementById('app');
  if(app) app.classList.add('scene-revealing');
  await mutateTable(t => {
    // Just the reset — clears whatever the previous Scene left behind.
    // Actual spawning is Yom's job now (seedScene(), right below), not
    // this function's — the two used to be tangled into one big mutation
    // with the Player's own Character committed via a *second*, separate
    // system (loadBuild/makeActiveCharacter) partway through, which is
    // exactly the shape that let renders race each other before the load
    // screen existed.
    t.scene = key;
    t.map = defaultMap(scene.mapWidth, scene.mapHeight);
    t.enemies = {};
    t.positions = {};
    // Yom appears on the Map alone (2026-08-24, per dDd) — the World, with
    // only its own Creator standing in it, for the brief moment before a
    // real Player arrives. spawnYom() is idempotent — he's only ever built
    // once per Table, this just (re)claims the Tile every Scene load.
    spawnYom(t);
    t.positions.yom = { x: Math.floor(scene.mapWidth / 2), y: Math.floor(scene.mapHeight / 2) };
    t.log.push({ type: 'system', text: 'Scene loaded: ' + scene.name, time: timeNow() });
  });
  await seedScene();
  centerMapView();
  showLoading(false);
  // Facing can visibly settle after the fade rather than gating it (per
  // dDd) — this timer only ever removes the reveal-animation scope, it
  // doesn't hold anything up. 900ms clears the loading fade (500ms) plus
  // the NPC stagger delay and their own fade duration below.
  setTimeout(() => { if(app) app.classList.remove('scene-revealing'); }, 900);
}

// Seed (2026-08-23, per dDd) — Yom's own Master Technique ("Spawns all
// Characters accordingly", data/techniques.json), and the real mechanism
// behind Scene genesis now, not just a load-screen decoration. loadScene()
// above only clears the board when the DM picks a new Scene; every actual
// spawn — NPCs, and each Player's own Character — happens here instead, in
// one shared code path used by both the DM picking a Scene AND, per dDd,
// "the joining Player... creating the World State of the Game essentially"
// — js/main.js's enterTable() calls this too, for every join and every
// plain rejoin/hard-refresh, not just a fresh Scene pick.
//
// Idempotent by design — never a per-click Technique a Player manually
// casts, so it has to be safe to call far more often than genesis should
// actually happen: it only ever fills in whatever's actually missing for
// *this* client's own Player (their own Spawn List slot) and the Scene's
// NPCs (only if literally none exist yet), and never touches anything
// already spawned. A plain refresh of an already-seeded Scene is a real
// no-op, not a re-genesis — the one thing that would have made "casting a
// Craft re-triggers the race" dangerous instead of just redundant.
//
// Yom's own AP/Lava/Lightning/Focus cost (Seed's `costs`) is flavor, not
// persisted bookkeeping — per js/activeCharacter.js, he's still not a real
// table.enemies entry with an actual resource pool to spend from.
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
  // positioned in this Scene so far, first-come-first-served — clamped to
  // the Scene's last slot if more Players join than it defines (graceful
  // degradation, not a hard block; only one real Player exists to test a
  // genuine multi-join with today).
  let mySpawn = null;
  if(!alreadyPositioned && scene.playerSpawns && scene.playerSpawns.length){
    const claimedCount = Object.keys(table.players || {})
      .filter(id => table.positions && table.positions[id]).length;
    mySpawn = scene.playerSpawns[Math.min(claimedCount, scene.playerSpawns.length - 1)];
  }

  if(!npcsMissing && !mySpawn) return; // Nothing missing — Seed has nothing to do.

  // One Event, not several (2026-08-24, per dDd, after a live version-
  // conflict bug traced directly to this function racing its own sequential
  // writes: "It's one Event; not 4 you know? They are all part of One Thing
  // happening."). Used to be up to 5 separate sequential mutateTable() calls
  // — NPC spawns, my Tile claim, Personality/Mindeye, Facing, the log line —
  // each its own network round-trip racing the others' realtime echoes.
  // Down to 2 real writes now: everything that doesn't need my own
  // t.players[myId] record to already exist lands in this first one — NPC
  // spawns, my Tile claim, Yom's own vanishing act (he only ever stood on
  // the Map alone for the moment before a real Player arrived), and the log
  // line. What's left after this (Personality/Mindeye/Facing) genuinely
  // can't fold in here — it needs makeActiveCharacter() to have committed
  // t.players[myId] first — so it's a second, smaller write below, not
  // three more.
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
      // Yom vanishes from the Map the moment a real Player actually arrives
      // in the World he Seeded — per dDd: "He should also vanish from Map
      // as Player comes in." He stays a real Character in t.characters
      // (see spawnYom above) — just no longer positioned on this Tile.
      if(t.positions.yom) delete t.positions.yom;
    }
    t.log.push({ type: 'system', text: 'Yom casts Seed — the World takes shape.', time: timeNow() });
  });

  if(mySpawn && mySpawn.build){
    // loadBuild()/makeActiveCharacter() (js/character.js) drive the
    // Character sheet's own form + commit flow — the only way a Player's
    // own t.players[id] gets its real Stats, same as every other spawn
    // path in this codebase. Its own write can't fold into the one above:
    // t.players[myId] has to actually exist before Personality/Mindeye/
    // Facing below have anywhere real to land.
    loadBuild(mySpawn.build);
    await makeActiveCharacter();

    const build = BUILDS[mySpawn.build];
    // Second and last write — Personality/Mindeye plus Facing together,
    // instead of the two separate sequential writes that used to collide
    // here (the exact bug this whole pass started from). Facing landing in
    // the same write as everything else doesn't block the visual reveal —
    // per dDd, "Facing can get adjusted after a Fade" is about the Loading
    // Screen's own timing, not about the write itself needing to be split.
    await mutateTable(t => {
      const p = t.players[myId];
      if(build && build.personality && p) p.personality = JSON.parse(JSON.stringify(build.personality));
      // techniqueAccess (2026-08-24) — carried over the same way Personality
      // is, right above. saveCharacter()'s own sheet-save no longer writes
      // this field at all (js/character.js's readStatsFromSheet() — the
      // sheet's checkboxes are the old 4-category model, incompatible with
      // per-Technique access now), so without this a Player would fall back
      // to the permissive "no techniqueAccess object" default and get every
      // Technique, including ones their own Build explicitly denies (Gom's
      // Lava Crafts, Seed itself).
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
