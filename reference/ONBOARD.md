# Onboard

**Not `HANDOFF.md`.** That's Session/work state — what's open, what to pick up next. This is for understanding what Legends of Gomsdu actually *is*, mechanically and conceptually, so you can reason about it without re-deriving everything from the reference docs cold. Not a lore dump — `gomsdu-codex.md` is there if you need the full depth on anything below. This is the compressed, practical version, written 2026-08-25 after a full read of every reference doc in one sitting.

---

## What this is

A browser-based multiplayer tabletop RPG table — real Supabase backend, realtime sync, no build step, panel-based UI (`index.html` + `js/main.js`'s render loop). Not a video game in the usual sense: closer to a shared, code-enforced version of sitting at a table with dice and a rulebook.

## The core loop

- **A Table** is one shared session, mutated through the one real write path — `mutateTable()` in `js/sync.js`. Every client re-renders on the realtime echo, not on the local write — a small round-trip, not an instant local update.
- **Characters are universal.** One logical shape for Players, NPCs, Enemies, Mini-Party members — no separate "NPC" data type. `table.characters` is the real target structure (migrating feature-by-feature from the older `table.players`/`table.enemies` split, not yet complete).
- **Ally/Enemy is Combat-scoped only**, not a permanent tag on a Character. Outside a Combat Encounter the concept doesn't apply at all.
- **Time, not Encounter, is the actual global state.** Every Round — Combat or Non-Combat — is 7 seconds. AP is what a Character can accomplish inside that time. Combat is meant to be local (a fight in one corner of the Map shouldn't freeze Non-Combat elsewhere) — the engine isn't fully there yet, but that's the direction, not a maybe.
- **A Map** is a grid of Tiles (blocked/traversable), Characters occupy Tiles, Facing and crowding matter for movement and line of sight.

## Glyphs — the actual logic of the game, not flavor

Per dDd, directly: "The universal things are Glyphs, which make Combat possible, interaction possible, communication, movement." Every button that exists today — Attack, Block, Move, Craft — is standing in for a Glyph a Character has to actually **know** (memorized in their Mindeye) before they can do it. Nothing currently gates a button on Glyph-knowledge, but that's the confirmed target, not speculation.

- **Wimbis** is the world's own language — logographic, not alphabetic, built from geometric Primitives that compose into Words (Glyphs). Real data lives in `language/gomsdu-glyphic-system.json`; the Arranger (`language/gomsdu-glyph-arranger.html`) builds sentences (**Totems**, read top-to-bottom) out of them.
- **WIM** is the teaching primitive, self-referential by design — a Character must know WIM before they can teach *anything*, including WIM itself.
- **Composition/Expression** (an ordered sequence of Glyphs) is how a Character's declared intent (**Plan**) feeds the Behavior engine below — this is confirmed as the real mechanism, not a parallel system to it.
- English is a translation layer for the Player, not the thing being formalized. If a mechanic feels like it should be described in Wimbis terms instead of English ones, it probably should be.

## The two stat builds

- **Physical** — Form (Power/Quickness/Range) + Essence (Lightning/Lava/Focus, plus Flow and Resilience). Combat runs on a **Global Counter**: everyone stages actions in advance, then a countdown resolves them all by tick, not turn order. **Wounds count up, not down** — `x` is how many taken, `y` is a personal Down threshold, `z` is a species-fixed death ceiling. Down ≠ dead.
- **Personality** — Head/Heart/Stomach domains, with per-Glyph Attachment/Desire Emotion Axes. Autonomous action runs on one real formula: **Pursuit = Desire + Longing + Plan + Repeat**, computed in `js/behaviors.js`. This is the same engine for Movement, Combat action selection, and Non-Combat Behaviors — not three separate systems.
- Personality complexity is Era-gated by design: First Era Characters only need Head. Heart and Stomach arrive in later Eras.

## Who's who, compressed

- **Gom** (Lightning, accumulation) and **Kulkrow** (Lava, expulsion) are brothers — the game's cosmological premise. Two wars happened; the commonly-believed causes are propaganda. Gom is secretly the exploiter in both — meant to surface late, earned through play, not spoiled here.
- **Yom** is their Father (the Sun-being). A real Character (`table.characters`, not a special role) who spawns automatically on every Map load via his own Technique, "Seed." Yom can be switched to like any Active Character, and — the one thing that makes him structurally different — **can take Direct Control of any NPC.**
- **There is no Dungeon Master.** The DM Panel and the "TATA" (Architect/Adversary) concept that preceded it were both retired 2026-08-25 — see `ROADMAP.md`'s Dungeon Master Panel section for the full reasoning. NPC/Enemy actions run on the autonomous Behavior engine above by default; Yom's Direct Control is for the cases a human wants to intervene directly, not a replacement authority role.

## Current shape (as of Cycle 2's close, 2026-08-25)

- **Era 1: Gom** is the first real playable Scene — a 24×30 map, Gom and Living Stone, no terrain/art needed (First Era is a barren ball of Iron by design).
- The **Sequencer** is the persistent Master Panel — a timeline under the header, not a popup, visible the instant an Encounter starts.
- **Combat Panel** is winding down (no new feature investment); **DM Panel** is being removed outright. Both `js/combat.js`/`js/dm.js` still exist in code as of this writing — check `ROADMAP.md` for current status, don't assume either is already gone.
- **Architecture/Systemization** is the named, current top priority ahead of any individual feature — the codebase had drifted toward hardcoding one-off logic per mechanic instead of reusable systems; fixing that gates what gets picked up next. See `ROADMAP.md`'s own section by that name.

## The doc map, if you need more

- **[ROADMAP.md](ROADMAP.md)** — live work, Ready/Discuss only.
- **[CYCLES.md](CYCLES.md)** — what the current Cycle is actually scoped to do, and what past Cycles learned about process.
- **[CHANGELOG.md](CHANGELOG.md)** — this Cycle's build history (cleared each Cycle — don't expect old history here, git has that).
- **[HANDOFF.md](HANDOFF.md)** — what the last Session specifically left open.
- **[gomsdu-codex.md](gomsdu-codex.md)** — the real lore, when the compressed version above isn't enough.
- **[style-guide.md](style-guide.md)** — the tiebreaker for any color/design question.
- **[scenes.md](scenes.md)** / **[scenes-2nd-era.md](scenes-2nd-era.md)** — narrative Scene material, First and Second Era.
- **`language/gomsdu-glyphic-system.json`** — the real, living Glyph data.
