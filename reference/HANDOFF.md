# Handoff

Written 2026-08-30, at dDd's own request, for whichever Claude session picks
this up next. Read this first; it's a map of the other docs, not a
replacement for them. Nothing here is canon on its own — where it repeats
something, the source doc (cited inline) wins on any conflict. **This file
had gone stale** — the previous version was written 2026-08-27 and never
refreshed across all of CC3-3 (2026-08-30, today — a long, dense session).
Everything below reflects real current state, not a mid-Cycle snapshot.

---

## The docs, and what each one is actually for

-   **[ONBOARD.md](ONBOARD.md)** — not Session state, the *game itself* —
    what Legends of Gomsdu actually is, mechanically and conceptually,
    compressed. Read this one first if you're new to the project, before
    HANDOFF or ROADMAP.
-   **[ROADMAP.md](ROADMAP.md)** — live planning only. Every `[Ready]`/
    `[Discuss]` item currently open. Check this fresh every session; it's
    edited constantly. Its own "Architecture / Systemization" section (top
    of the file) is the anchor for Cycle 3 — read that before picking up any
    individual feature below it.
-   **[CHANGELOG.md](CHANGELOG.md)** — the current Cycle's historical
    record, newest date first, cleared at the start of each new Cycle. If
    you want to know *how* something already works, this is more reliable
    than reading the code cold — it carries the reasoning and the
    live-verification evidence, not just the diff. Today's entry
    (2026-08-30) is long — it's one dense session, not several days.
-   **[ISSUES.md](ISSUES.md)** — bugs/glitches found in testing, distinct
    from ROADMAP's design questions. 5 Open items now (1 new today — the
    boot bug), plus one real Sequencer bug found *and* fixed the same
    session — see below.
-   **[VISION.md](VISION.md)** — the other altitude, big-picture build
    order, meant to stay stable across sessions. Rewritten CC3-1
    (2026-08-26) into a 7-Stage structure — read the current version, not
    memory of the old 9-item one.
-   **[CYCLES.md](CYCLES.md)** — one entry per Cycle (several Sessions
    capped by an Assessment), written once, never overwritten — unlike this
    file. Has Cycle 3's own Plan (set at Cycle 2's Assessment) and the
    Assessment checklist. Read it if you want to know what changed about
    *process*, not just what got built.
-   **[style-guide.md](style-guide.md)** — the tiebreaker for any color/
    design fact.
-   **[scenes.md](scenes.md)** — a running "Script Place" for Scene ideas,
    First Era only. Second Era has its own file,
    [scenes-2nd-era.md](scenes-2nd-era.md).
-   **[dialogue-system.md](dialogue-system.md)** — the fuller Wimbis design
    history. Dense; skim dated section headers.
-   **`language/gomsdu-glyphic-system.json`** — the actual Glyph/Primitive
    data, a living document dDd edits directly. Went through a real 39-Glyph
    validity audit CC3-1 (2026-08-26) — don't assume prior-session knowledge
    of any Glyph's meaning is still current without checking.
-   **`data/techniques.json`** — the real Technique data (costs, group,
    column, effect text) `js/techniques.js`'s `TECHNIQUES` loads from at
    runtime. Still the right place to check before concluding a Technique
    "doesn't exist" — but see the sharper practical note below: today's
    Cycle already learned the softer version of this lesson (CC3-2) and then
    over-corrected from it in a *different* way (CC3-3) — both are worth
    reading, they're not the same mistake twice.

---

## Where things stand, in one paragraph

Cycle 3's DM Panel teardown (Plan item 2) finally made real progress today
(CC3-3, 2026-08-30) after being decided 2026-08-25 and only inventoried
CC3-2. Phase A: Add Enemy and the Encounter loader folded into Seed as real,
costed casts (`castSeedLive()`, [js/scenes.js](../js/scenes.js)) — and
testing that surfaced Yom had no way to ever recover the resources Seed
spends, since he was never swept by either Round resolver's end-of-Round
tick. Fixed. Phase B: the DM Panel's own separate `actingEnemyId` merged
into `activeCharacterId` — one real id (`activeActorId()`,
[js/activeCharacter.js](../js/activeCharacter.js)) — and the whole
Attack/Block/Essence staging engine generalized off it, which turned out to
be a real functional fix, not just a rename: it only ever read
`table.enemies` before, so acting as Yom specifically silently didn't work.
Phase C: Attack/Block/Essence got a real home on the Active Character
Display's own S/B/E buttons, redesigned around actual Map interaction
(melee-arc highlighting, click-who-to-Block, Essence's cursor glow) — built
twice, because the first Essence pass reintroduced a real duplicate system
(its own cost/order/Glyph-picker logic in `js/dm.js`, caught by dDd
directly), corrected by generalizing `js/techniques.js`'s own Technique Use
panel instead of building a second one. That fix uncovered a second real Yom
bug in the process: Non-Combat Orders were never swept for `t.characters`
either — fixed alongside. Separately, the Sequencer's Twilight Milk sky
turned out to be a real bug too, not a feel thing — it only ever tracked 13
states total when a real Day/Night cycle needs 26 (13 Day, the Star's own
blotch sweeping right-to-left; 13 Night, flat and dark but never true
black) — fixed after two wrong guesses at the underlying formula, both
caught and corrected live rather than left half-right. Full detail:
[CHANGELOG.md](CHANGELOG.md)'s 2026-08-30 entry, which is long; it's one
session, not several.

---

## Open threads, in the order they'll probably come up

1.  **DM Panel removal itself — Cycle 3 Plan item 2, still not fully done,
    but much closer.** Three things are still keeping `panel-dm` alive:
    Cast Seed's own picker UI (the mechanics moved to Seed, the actual
    `<select>`/button markup never did), Start/End Encounter (blocked on
    item 2 below — the big one), and Clear Dead (still deletes the Enemy
    outright — see item 3). Once those three have real homes, the panel
    shell + toolbar button come out clean. The DM Test panel's own fate
    (`savedCharacters.js`/`savedEncounters.js`/`dmtest.js`) is still an open
    question, unchanged from CC3-2 — confirm at actual removal time.
2.  **Locality-based Encounters — Combat item K, first slice landed (CC3-3,
    same session as this doc's last update), the bigger piece still
    deferred.** Attacking a Character now populates `table.encounterZoneIds`
    (both participants) and flips `table.inEncounter` on automatically —
    the zone's own Tiles (participants + their 8 neighbors) render with a
    dashed crimson border, computed live off current positions every
    render, never stored. What's still missing: Resolve (`main.js`) still
    dispatches Combat-vs-Non-Combat off the single table-wide
    `t.inEncounter` flag — an Attack starting a fight in one corner of the
    Map currently snaps the *entire* table into Combat mode, not just the
    Zone's own participants. Per dDd (2026-08-25), the full per-zone *sync*
    piece is expected to be Cycle 4's heavy focus, not Cycle 3's — but that
    real per-actor Resolve dispatch rewrite is squarely Cycle 3 territory
    whenever it's picked up. Start/End Encounter's buttons and the
    `panel-dm` shell around them are both still there, unmoved.
3.  **Clear Dead still just deletes the Enemy record outright.** Per dDd's
    own read (CC3-3): this should really just clear stale target
    references, not erase the body — the Map's meant to carry visible
    corpses/Chunks (see ROADMAP's Movement System item I, Ruined
    state/per-Character Chunks) — but that system doesn't exist yet either,
    so this can't be built for real until Chunks land.
4.  **Seed's live-cast path is real now, but only for Non-Combat.** Casting
    a Technique as Yom during an active Encounter would push into
    `t.characters.yom.sequence`, which `combat.js`'s `resolveRound()` never
    walks (only `t.players`/`t.enemies`/mini-party) — consistent with the
    standing "Yom was never meant to become a Combat participant" design,
    not a new gap, but worth knowing if this ever comes up.
5.  **Per-Character AP-cost scaling for Seed — still explicitly not built.**
    Same reasoning as before: Non-Combat's own Technique-staging still skips
    AP costs entirely (see item 6), so scaling Seed's own AP now would build
    on top of an unreconciled hole.
6.  **Non-Combat Round still doesn't track AP at all — same real,
    already-flagged, unreconciled gap, untouched again this session.**
    `js/techniques.js`'s `stageTechnique()` still explicitly skips the `ap`
    cost outside an Encounter. Party System's Resonance/Buffs thread already
    named this as needing its own real pass.
7.  **The Active Character Display's 7 placeholder buttons: 3 of 7 are real
    now (Attack/Block/Essence), the 3rd square carries the SUU Glyph as a
    pure icon (no click behavior — dDd only asked for the icon placement),
    3 are still genuinely inert.** No spec yet for what those 3 do, or what
    SUU's own click behavior should be.
8.  **Actor-vs-Target disambiguation inside a 3-Glyph Plan Expression** —
    still a known simplification, not solved. `committedPlanInfo()`
    ([js/behaviors.js](../js/behaviors.js)) takes whichever Target ref a row
    resolved *last*. See [ROADMAP.md](ROADMAP.md).
9.  **The literacy/misunderstanding layer is still just a stated design
    goal, nothing built.**
10. **`BA` (Avoid) and both senses of `KA`-as-Target-interaction are
    designed but not built.**
11. **Inert Stone was deleted and nobody said what replaces it.** Still
    genuinely unanswered — Separation's Technique effect still calls
    `spawnBuildAt(t, 'inert-stone', ...)`, which silently no-ops. Don't
    guess; ask before touching Separation.
12. **Personal Relationship Axes, Crafts Known's missing home, the Glyphic
    System's own taxonomy gaps** — all still genuinely open, unchanged this
    Cycle.

---

## Practical notes for whoever picks this up

-   **For anything genuinely evocative/thematic ("the Orbit of the Star,"
    not "a distance formula"), ask for the concept before touching the
    math.** The Sequencer's Twilight Milk gradient took three real passes
    this session: two were verified-correct-on-their-own-terms formula
    changes that still missed, because "gradient spread over 26" and "2 full
    cycles" were describing a real Day/Night *mechanic* (13 ticks each, the
    Star literally rising and setting) dDd hadn't stated yet, not a tweak to
    the existing color math. The tell in hindsight: dDd's own phrasing kept
    naming real-world things (Orbit, rises, sets) instead of numbers or
    curves — worth treating that as a signal to ask "what's the actual
    mechanic" before reaching for a second formula guess.
-   **"Don't build two systems for the same thing" cuts both ways — read
    what's actually being called a duplicate before touching anything.**
    CC3-3's real lesson, learned live and expensively: dDd's complaint about
    "two different interfaces for Player and Yom" meant the *old DM Panel*
    vs. the real game mechanism specifically — not "never have more than one
    UI entry point." His own framing once it was untangled: RTS games
    routinely have a button menu, hotkeys, *and* a right-click menu for one
    command — multiple doors onto one mechanism is normal, good design. The
    actual anti-pattern is multiple **implementations** underneath, not
    multiple doors. Getting this backwards mid-session led to deleting a
    working feature, then having to rebuild it correctly. If a "consolidate
    this" instruction is even slightly ambiguous, ask which layer it's
    about — the entry point or the logic — before deleting anything.
-   **A circular-import wall between two files doesn't mean the feature
    can't happen — use a registration/callback pattern.** `js/map.js` and
    `js/dm.js` need to call into each other (Map occupant clicks need to
    trigger DM staging; DM staging needs Map's `isMeleeArc`/`renderMap`).
    Direct imports both ways would cycle. Fix: `map.js` exports
    `registerStageOnCharacterHandler(fn)`, and `dm.js` calls it once at
    module load with its own handler — same pattern `sync.js`'s
    `registerRenderCallback` already established. Don't collapse two
    genuinely separate concerns into one file just to dodge a cycle.
-   **A visible layout bug can be silently pre-existing, not a regression
    from the change that surfaced it.** The Active Character Display's
    click-dead-zone was really a `.view1`/`.map-panel` fixed-height overflow
    that's been there since the 7-square placeholder row was first built
    (2026-08-24) — invisible the whole time because nothing in that space
    was ever clickable before. Worth checking "was this box already
    overflowing?" before assuming new CSS caused a new bug.
-   **`t.characters` (Yom, and any future Universal Character) is easy to
    forget in a sweep that already handles `t.players`/`t.enemies`.** Two
    separate real bugs this session were exactly this shape: the end-of-
    Round Recovery/Attunement sweep, and separately the Non-Combat
    Order-processing sweep. Both `combat.js` and `noncombat.js` have more
    than one place that iterates `t.players || {}` and `t.enemies || {}`
    side by side — if a new mechanic needs to reach Yom, grep for that exact
    pattern and check whether `t.characters` is missing from it too.
-   **Before concluding a Technique/mechanic "doesn't exist," check the
    actual data file, not just the hardcoded JS.** Still true, still worth
    repeating — `js/techniques.js`'s `TECHNIQUES` loads from
    `data/techniques.json` at runtime.
-   **Cost data can settle a design question outright — read it before
    guessing at the mechanic's shape.** Seed's own `costs` did this back in
    CC3-2; still a good instinct to check first.
-   **Preview server caching has bitten before — restart, don't just
    reload,** if a live check looks wrong in a way the code doesn't explain.
    A stale ES-module graph from before an edit lands can also produce this
    exact symptom on a tab that's been open a while — a plain page reload
    (not a full server restart) is usually enough to rule that out first.
-   **A live `mutateTable()` test doesn't prove a feature is reachable in
    real play.** Verify through the actual UI/DOM a Player would see —
    real clicks, not just `.click()` calls, where the click target is new
    (see next note).
-   **A programmatic `.click()` can succeed even when a real pointer click
    on the same coordinates wouldn't, if a layout bug is covering the real
    element.** The Active Character Display bug above only ever showed up
    once a real coordinate-based click was tried against a *freshly-built*
    UI element — `.click()` on the element handle bypassed the actual
    hit-testing entirely and looked fine. For any new clickable UI, do at
    least one real coordinate click, not just a programmatic one.
-   **dDd actively minimizes codebase bloat specifically to keep reasoning
    easier** — flag and fix dead code/redundant mechanisms when they turn
    up, even incidentally.
-   **Don't trust a single read taken within ~100ms of a write** — realtime
    echo lag looks like a bug when it's just timing.
-   **Testing convention**: disclosed test-mutation (direct `mutateTable()`
    calls from `javascript_tool`, always cleaned up, always disclosed) is
    established and safe — but prefer driving the real UI/DOM when possible.
-   **dDd reads thinking logs live**, not just the final message — visible
    reasoning shapes his own thinking mid-session.
-   **A comment claiming "X is a port of Y," or that a system "should
    already work," isn't proof on its own** — verify against the actual
    source before reusing it as settled.
-   **The synthetic-click-vs-compositing quirk (ISSUES.md) is still real**
    — calling a button's own `.click()` via `javascript_tool` instead of a
    coordinate-based synthetic click remains the reliable workaround when
    the Browser pane isn't actively composited. (This is about the *testing
    harness's* click reliability — a separate thing from the real
    layout-bug note above about verifying with a real click once something
    genuinely works.)
