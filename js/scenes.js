import { AppState } from './state.js';
import { mutateTable } from './sync.js';
import { defaultMap } from './map.js';
import { BUILDS, loadBuild, makeActiveCharacter } from './character.js';
import { timeNow } from './utils.js';

// New Game Process (2026-08-20), per dDd. Pure data — no imports — so
// character.js can read SCENES[...].restrictBuilds for the Character-panel
// dropdown without importing loadScene() below (which needs character.js
// right back; kept one-way instead of circular).
export const SCENES = {
  dev: { name: 'Dev' }, // exactly what a fresh Table already looked like — no map/spawn changes, just unlocks the screen below the Sequencer Divider.
  era1: {
    name: 'Era 1',
    mapWidth: 7, mapHeight: 7,
    playerBuild: 'living-stone', playerTile: 'D2',
    enemyBuild: 'gom', enemyTile: 'D5',
    restrictBuilds: ['living-stone', 'gom']
  }
};

// Tile-key -> {x,y}. NOTE: this is NOT the inverse of map.js's own
// tileKey() (which concatenates columnLabel+rowLabel, e.g. "5D" — number
// first, letter last). dDd's Era scene spec ("D2", "D5") uses the opposite,
// row-letter-first order instead, so this parses that format specifically.
// Row letters count down from the top ('A' + (height-1-y)); column counts
// down width..1 left-to-right. Not exported from map.js, so re-derived here
// rather than reaching into that module's internals for a two-call-site inverse.
function tileXY(width, height, key){
  const row = key.slice(0, 1);
  const col = key.slice(1);
  return {
    x: width - parseInt(col, 10),
    y: (height - 1) - (row.charCodeAt(0) - 65)
  };
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

  const width = scene.mapWidth, height = scene.mapHeight;
  const eb = BUILDS[scene.enemyBuild];

  await mutateTable(t => {
    t.scene = key;
    t.map = defaultMap(width, height);
    t.enemies = {};
    t.positions = {};
    if(eb){
      const enemyId = 'e_' + Math.random().toString(36).slice(2, 8);
      t.enemies[enemyId] = {
        archetype: eb.archetype, name: eb.archetype + ' #1', num: 1,
        wounds: 0, woundsMax: eb.woundsMax, ap: eb.ap, flow: eb.flowMax, flowMax: eb.flowMax,
        recovery: eb.recovery, power: eb.power, quickness: eb.quickness, resilience: eb.resilience,
        lightning: eb.lightning, lava: eb.lava, focus: eb.focus, control: eb.control ?? 0,
        attunement: eb.attunement ?? 0, life: eb.life ?? 1, species: eb.species, deathWounds: eb.deathWounds,
        body: eb.body ? [...eb.body] : undefined, techniqueAccess: eb.techniqueAccess,
        apSpent: 0, focusSpent: 0, sequence: [], possessedBy: null
      };
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
