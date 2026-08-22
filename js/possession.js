import { mutateTable } from './sync.js';
import { timeNow } from './utils.js';
import { FACING_DEFAULT } from './map.js';

// The "sandwich" model (see reference/ROADMAP.md, Party System item C):
// every Character sits between Possessors (Above) and a Mini-Party (Below).
// Gom and Kulkrow (Tier 5) are an ambient default, rendered but not tracked
// here — this only holds the *manually added* slots: Tier 2-5 Possessors
// (capped at 2 — slots 3/4 in the sandwich model, since slots 1/2 are the
// Gom/Kulkrow default), and Mini-Party members (capped at 4). All four
// functions take an explicit targetPlayerId — any player can add to any
// other player's record, not just their own.
export const MAX_MINI_PARTY = 4;
const MAX_POSSESSORS = 2;

// type is 'shadow' (dimmed, filled-circle — never felt, like Gom/Kulkrow's
// own ambient default) or 'active' (a real, felt possession relationship).
// Gom/Kulkrow's own rows are hardcoded shadow and not created through here;
// this is for the two manually-addable slots, which can be either kind.
export async function addPossessor(targetPlayerId, name, tier, type, extraStats){
  const trimmed = (name || '').trim();
  if(!trimmed) return;
  await mutateTable(t => {
    const target = t.players[targetPlayerId];
    if(!target) return;
    if(!target.possessors) target.possessors = [];
    if(target.possessors.length >= MAX_POSSESSORS) return;
    target.possessors.push({ name: trimmed, tier: tier || 4, type: type === 'shadow' ? 'shadow' : 'active', ...(extraStats || {}) });
    t.log.push({ type: 'system', text: (target.name || 'Someone') + ' is now possessed by ' + trimmed + ' (Tier ' + (tier || 4) + ')', time: timeNow() });
  });
}

export async function removePossessor(targetPlayerId, index){
  await mutateTable(t => {
    const target = t.players[targetPlayerId];
    if(!target || !target.possessors || !target.possessors[index]) return;
    const removed = target.possessors.splice(index, 1)[0];
    t.log.push({ type: 'system', text: (target.name || 'Someone') + ' is no longer possessed by ' + removed.name, time: timeNow() });
  });
}

export async function addMiniPartyMember(targetPlayerId, name, extraStats){
  const trimmed = (name || '').trim();
  if(!trimmed) return;
  await mutateTable(t => {
    const target = t.players[targetPlayerId];
    if(!target) return;
    if(!target.miniParty) target.miniParty = [];
    if(target.miniParty.length >= MAX_MINI_PARTY) return;
    // Joins facing the same way the Group's own Character currently does
    // (see applyFacing/stageFacingOrder in map.js) — not a hardcoded default, so a
    // member added after a Facing change doesn't start out contradicting it.
    target.miniParty.push({ name: trimmed, facing: target.facing || FACING_DEFAULT, ...(extraStats || {}) });
    t.log.push({ type: 'system', text: trimmed + ' joins ' + (target.name || 'the') + '’s mini-party', time: timeNow() });
  });
}

export async function removeMiniPartyMember(targetPlayerId, index){
  await mutateTable(t => {
    const target = t.players[targetPlayerId];
    if(!target || !target.miniParty || !target.miniParty[index]) return;
    const removed = target.miniParty.splice(index, 1)[0];
    t.log.push({ type: 'system', text: removed.name + ' leaves ' + (target.name || 'the') + '’s mini-party', time: timeNow() });
  });
}
