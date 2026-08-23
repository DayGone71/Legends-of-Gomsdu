import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { defaultMap, FACING_DEFAULT, VIEWPORT_TILES } from './map.js';
import { BUILDS, loadBuild, makeActiveCharacter } from './character.js';
import { timeNow, deliverMindeyeEntry, showBannerError } from './utils.js';

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
    playerBuild: 'living-stone', playerTile: 'D2', playerFacing: 'W',
    enemyBuild: 'gom', enemyTile: 'D5', enemyFacing: 'E',
    // enemyMindeye (2026-08-22, per dDd — "My Gom still spawns not having
    // any Information in his Mindeye") — knownGlyphs is just a curriculum
    // list ("what he could ever say"), not Memory; Behaviors are driven
    // entirely by the Mindeye (js/behaviors.js's computeBehaviors()), so
    // without a real starting entry Gom had nothing to weigh Teach against
    // at all. Left at default Attachment/Desire (Mid/Mid, omitted here) on
    // purpose — the new Desire weighting (Middle now worth real Pursuit
    // weight, not zero) means a plain, never-tuned default already gives
    // Teach a real, non-zero chance to roll, no manual Give Memory tuning
    // required just to get started.
    enemyMindeye: [{ glyph: 'WIM' }],
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
  // Uses the new Spawn List (playerSpawns/npcSpawns below), not the older
  // single playerBuild/enemyBuild fields Era 1: Tutorial still uses — see
  // loadScene()'s own branch for why both forms coexist. Plain {x,y}
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
      { build: 'living-stone', x: 12, y: 14 }
    ],
    restrictBuilds: ['gom', 'living-stone']
  }
};

// Tile-key -> {x,y}. NOTE: this is NOT the inverse of map.js's own
// tileKey() (which concatenates columnLabel+rowLabel, e.g. "5D" — number
// first, letter last). dDd's Era scene spec ("D2", "D5") uses the opposite,
// row-letter-first order instead, so this parses that format specifically.
// Row letters count down from the top ('A' + (height-1-y)); column counts
// down width..1 left-to-right. Not exported from map.js, so re-derived here
// rather than reaching into that module's internals for a two-call-site inverse.
// Only used by the older single-spawn Scenes (Era 1: Tutorial) — the newer
// Spawn List (era1gom and on) authors positions as plain {x,y} instead, see
// SCENES.era1gom's own comment for why.
function tileXY(width, height, key){
  const row = key.slice(0, 1);
  const col = key.slice(1);
  return {
    x: width - parseInt(col, 10),
    y: (height - 1) - (row.charCodeAt(0) - 65)
  };
}

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
    knownGlyphs: eb.knownGlyphs ? [...eb.knownGlyphs] : undefined,
    personality: eb.personality ? JSON.parse(JSON.stringify(eb.personality)) : undefined,
    apSpent: 0, focusSpent: 0, sequence: [], possessedBy: null,
    facing: facing || FACING_DEFAULT
  };
  (mindeye || []).forEach(m => {
    deliverMindeyeEntry(t, enemyId, 'TATA', m.glyph);
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

  const width = scene.mapWidth, height = scene.mapHeight;

  // Spawn List (2026-08-22, per dDd) — up to 5 Player spawns (index 0 is
  // always whoever's actually loading the Scene right now; slots 1-4 are
  // reserved data for other Players joining this same Scene later — not yet
  // wired to a real multi-join flow, since only one real Player exists to
  // test with today) and open-ended NPC spawns, each its own Build/
  // position/Facing/Mindeye. The older single playerBuild/enemyBuild fields
  // (Era 1: Tutorial) keep working exactly as before via the branch below.
  if(scene.npcSpawns || scene.playerSpawns){
    const mySpawn = (scene.playerSpawns || [])[0];
    await mutateTable(t => {
      t.scene = key;
      t.map = defaultMap(width, height);
      t.enemies = {};
      t.positions = {};
      const counts = {};
      (scene.npcSpawns || []).forEach(spawn => {
        counts[spawn.build] = (counts[spawn.build] || 0) + 1;
        const enemyId = 'e_' + Math.random().toString(36).slice(2, 8);
        spawnNpc(t, enemyId, spawn.build, counts[spawn.build], spawn.facing, spawn.mindeye);
        t.positions[enemyId] = { x: spawn.x, y: spawn.y };
      });
      if(mySpawn) t.positions[AppState.playerId] = { x: mySpawn.x, y: mySpawn.y };
      t.log.push({ type: 'system', text: 'Scene loaded: ' + scene.name, time: timeNow() });
    });

    if(mySpawn && mySpawn.build){
      loadBuild(mySpawn.build);
      await makeActiveCharacter();
      if(mySpawn.facing){
        await mutateTable(t => {
          const me = t.players[AppState.playerId];
          if(me) me.facing = mySpawn.facing;
        });
      }
    }

    // Center the Map viewport on the spawn (2026-08-22) — without this, a
    // Scene bigger than VIEWPORT_TILES would load showing the map's own
    // {0,0} corner by default, not wherever anyone actually spawned. Local
    // view-only state (js/state.js) — also clears the pan-history stack
    // left over from whatever Scene was loaded before this one.
    if(mySpawn){
      const viewW = Math.min(VIEWPORT_TILES, width), viewH = Math.min(VIEWPORT_TILES, height);
      AppState.mapViewOffset = { x: mySpawn.x - Math.floor(viewW / 2), y: mySpawn.y - Math.floor(viewH / 2) };
      AppState.mapViewHistory = [];
    }
    return;
  }

  // --- Older single-spawn path (Era 1: Tutorial) ---
  await mutateTable(t => {
    t.scene = key;
    t.map = defaultMap(width, height);
    t.enemies = {};
    t.positions = {};
    if(scene.enemyBuild){
      const enemyId = 'e_' + Math.random().toString(36).slice(2, 8);
      spawnNpc(t, enemyId, scene.enemyBuild, 1, scene.enemyFacing, scene.enemyMindeye);
      t.positions[enemyId] = tileXY(width, height, scene.enemyTile);
    }
    t.positions[AppState.playerId] = tileXY(width, height, scene.playerTile);
    t.log.push({ type: 'system', text: 'Scene loaded: ' + scene.name, time: timeNow() });
  });

  // Player Character is spawned in directly, per dDd ("Player Character is
  // Living Stone in D2") — loadBuild() only touches the Character panel's
  // own form fields, makeActiveCharacter() is what actually commits them.
  if(scene.playerBuild){
    loadBuild(scene.playerBuild);
    await makeActiveCharacter();
    // Facing has no field on the Character sheet's own form (loadBuild/
    // makeActiveCharacter don't touch it) — set directly as a small
    // follow-up write, same Scene-authored value the enemy above already got.
    if(scene.playerFacing){
      await mutateTable(t => {
        const me = t.players[AppState.playerId];
        if(me) me.facing = scene.playerFacing;
      });
    }
  }

  // Same viewport-centering as the Spawn List path above — Era 1: Tutorial
  // is 7x7 (equal to VIEWPORT_TILES) so this is a no-op offset {0,0} there,
  // but keeps both paths consistent for any future single-spawn Scene bigger
  // than the viewport.
  const pw = tileXY(width, height, scene.playerTile);
  const pViewW = Math.min(VIEWPORT_TILES, width), pViewH = Math.min(VIEWPORT_TILES, height);
  AppState.mapViewOffset = { x: pw.x - Math.floor(pViewW / 2), y: pw.y - Math.floor(pViewH / 2) };
  AppState.mapViewHistory = [];
}

export function toggleSceneMenu(){
  const menu = document.getElementById('scene-menu');
  if(menu) menu.classList.toggle('hidden');
}

function closeSceneMenu(){
  const menu = document.getElementById('scene-menu');
  if(menu) menu.classList.add('hidden');
}
