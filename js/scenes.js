import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { defaultMap, FACING_DEFAULT, centerMapView } from './map.js';
import { BUILDS, loadBuild, makeActiveCharacter } from './character.js';
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
      // mindeye (2026-08-22, per dDd — "My Gom still spawns not having any
      // Information in his Mindeye") — knownGlyphs is just a curriculum
      // list ("what he could ever say"), not Memory; Behaviors are driven
      // entirely by the Mindeye (js/behaviors.js's computeBehaviors()), so
      // without a real starting entry Gom had nothing to weigh Teach
      // against at all. Left at default Attachment/Desire (Mid/Mid, omitted
      // here) on purpose — the Desire weighting (Middle worth real Pursuit
      // weight) means a plain, never-tuned default already gives Teach a
      // real, non-zero chance to roll, no manual Give Memory tuning needed.
      { build: 'gom', x: 2, y: 3, facing: 'E', mindeye: [{ glyph: 'WIM' }] }
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
    playerSpawns: [
      { build: 'gom', x: 10, y: 12 }
    ],
    // 5 Living Stones, lower-right of Gom's own spawn and within the same
    // VIEWPORT_TILES window loadScene() centers on him below — visible
    // immediately with no panning needed, per dDd: "we just need 5 Living
    // Stone in visual Range of where Gom Spawns. I'd go with lower right,
    // to verify the Map Mechanics."
    npcSpawns: [
      { build: 'living-stone', x: 11, y: 13 },
      { build: 'living-stone', x: 12, y: 13 },
      { build: 'living-stone', x: 13, y: 13 },
      { build: 'living-stone', x: 11, y: 14 },
      { build: 'living-stone', x: 12, y: 14 },
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

// Shared Enemy-spawn literal (2026-08-22, per dDd's Lists-consolidation
// go-ahead) — both the older single-enemyBuild path and the newer Spawn
// List path build an Enemy the exact same way; this was duplicated between
// them until now. Mutates t directly, matching every other in-callback
// helper's own shape in this codebase (js/scripts.js's dispatchScript, etc.).
function spawnNpc(t, enemyId, build, num, facing, mindeye){
  const eb = BUILDS[build];
  if(!eb) return;
  t.enemies[enemyId] = {
    archetype: eb.archetype, name: eb.archetype + ' #' + num, num,
    wounds: 0, woundsMax: eb.woundsMax, ap: eb.ap, flow: eb.flowMax, flowMax: eb.flowMax,
    recovery: eb.recovery, power: eb.power, quickness: eb.quickness, resilience: eb.resilience,
    lightning: eb.lightning, lava: eb.lava, focus: eb.focus, control: eb.control ?? 0,
    attunement: eb.attunement ?? 0, life: eb.life ?? 1, species: eb.species, deathWounds: eb.deathWounds,
    body: eb.body ? [...eb.body] : undefined, techniqueAccess: eb.techniqueAccess,
    personality: eb.personality ? JSON.parse(JSON.stringify(eb.personality)) : undefined,
    passiveSpill: eb.passiveSpill,
    apSpent: 0, focusSpent: 0, sequence: [], possessedBy: null,
    facing: facing || FACING_DEFAULT
  };
  // Innate Glyph knowledge (2026-08-23, per dDd's knownGlyphs/mindeye merge)
  // — the Build's own startingMindeye delivers first, as real Mindeye
  // entries ("knowing" a Glyph just means having one now), then any
  // Scene-specific extras (the `mindeye` param — e.g. Era 1: Tutorial's
  // enemyMindeye) layer on top the same way they always did.
  (eb.startingMindeye || []).forEach(g => deliverMindeyeEntry(t, enemyId, 'Star Father', g, true));
  (mindeye || []).forEach(m => {
    deliverMindeyeEntry(t, enemyId, 'Yom', m.glyph); // was 'TATA' — renamed 2026-08-23 alongside TATA's own retirement, see js/activeCharacter.js
    const entry = t.enemies[enemyId].mindeye[t.enemies[enemyId].mindeye.length - 1];
    if(m.attachment !== undefined) entry.attachment = m.attachment;
    if(m.desire !== undefined) entry.desire = m.desire;
    entry.seen = true;
  });
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
    t.log.push({ type: 'system', text: 'Scene loaded: ' + scene.name, time: timeNow() });
  });
  await seedScene();
  centerMapView();
  showLoading(false);
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

  if(npcsMissing){
    await mutateTable(t => {
      if(!t.enemies) t.enemies = {};
      if(!t.positions) t.positions = {};
      const counts = {};
      scene.npcSpawns.forEach(spawn => {
        counts[spawn.build] = (counts[spawn.build] || 0) + 1;
        const enemyId = 'e_' + Math.random().toString(36).slice(2, 8);
        spawnNpc(t, enemyId, spawn.build, counts[spawn.build], spawn.facing, spawn.mindeye);
        t.positions[enemyId] = { x: spawn.x, y: spawn.y };
      });
    });
  }

  if(mySpawn){
    await mutateTable(t => {
      if(!t.positions) t.positions = {};
      t.positions[myId] = { x: mySpawn.x, y: mySpawn.y };
    });
    if(mySpawn.build){
      // loadBuild()/makeActiveCharacter() (js/character.js) drive the
      // Character sheet's own form + commit flow — the only way a Player's
      // own t.players[id] gets its real Stats, same as every other spawn
      // path in this codebase.
      loadBuild(mySpawn.build);
      await makeActiveCharacter();
      // Innate Glyph knowledge + Personality (2026-08-23) — makeActiveCharacter()
      // has to run first (it's what actually creates t.players[id] for a
      // brand new Character); only then does the Build's own startingMindeye/
      // personality have a real record to land on. Same gap js/dm.js's
      // addEnemy() and this file's own spawnNpc() (above) already had fixed
      // for Enemies/NPCs — Players were the one spawn path missing both
      // entirely (readStatsFromSheet() only ever returns sheet-editable
      // stats; personality/mindeye have no sheet field at all).
      const build = BUILDS[mySpawn.build];
      if(build && ((build.startingMindeye && build.startingMindeye.length) || build.personality)){
        await mutateTable(t => {
          const p = t.players[myId];
          if(build.personality && p) p.personality = JSON.parse(JSON.stringify(build.personality));
          (build.startingMindeye || []).forEach(g => deliverMindeyeEntry(t, myId, 'Star Father', g, true));
        });
      }
      if(mySpawn.facing){
        await mutateTable(t => {
          const me = t.players[myId];
          if(me) me.facing = mySpawn.facing;
        });
      }
    }
  }

  await mutateTable(t => {
    t.log.push({ type: 'system', text: 'Yom casts Seed — the World takes shape.', time: timeNow() });
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
