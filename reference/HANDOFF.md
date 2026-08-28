# Handoff

Written 2026-08-27, at dDd's own request, for whichever Claude session picks
this up next. Read this first; it's a map of the other docs, not a
replacement for them. Nothing here is canon on its own — where it repeats
something, the source doc (cited inline) wins on any conflict. **This file
had gone stale** — the previous version was written 2026-08-24 and never
refreshed across all of CC3-1 (2026-08-26). Everything below reflects real
current state, not a mid-Cycle snapshot.

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
    live-verification evidence, not just the diff.
-   **[ISSUES.md](ISSUES.md)** — bugs/glitches found in testing, distinct
    from ROADMAP's design questions. 4 Open items, priority-ordered, none
    from this Cycle so far.
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
    runtime. **Check this file, not just the JS, before concluding a
    Technique "doesn't exist" or isn't wired up** — see the practical note
    below; this exact mistake happened this Cycle.

---

## Where things stand, in one paragraph

Cycle 3 opened (CC3-1, 2026-08-26) with the Architecture/Systemization
conversation itself — no code, but real direction set: the Glyph/Language
data has concrete gaps (Behavior/Variety belong in the JSON not hand-kept JS
constants, Glyphs need Era-gated roles, Target ID is a 3-tier system First
Era only needs the bottom rung of), and a full 39-Glyph validity audit ran
for real (deleted `BE`, fixed `KALAG`/`KULOG`'s swapped meanings, corrected
Grammar rules). Same session, **AP actually draining via the Behavior
Queue** shipped and was verified live — `resolveBehavior()`
([js/noncombat.js](../js/noncombat.js)) now really drains
`fillBehaviorQueue()`'s output. `VISION.md` was rewritten into a 7-Stage
structure. CC3-2 (2026-08-27, today, a short single-thread session) went in
to start the DM Panel teardown (Cycle 3 Plan item 2) but pivoted after
inventorying the Panel surfaced that Yom's own Seed Technique — assumed
already-working — was actually only ever a bypass. **Seed is now real**:
`castSeed()`/`castSeedAsYom()` ([js/scenes.js](../js/scenes.js)) stage,
cost, and resolve Genesis as Yom's own first real cast instead of a raw
table write, and Scene data's old `npcSpawns`/`playerSpawns` split is gone —
one `spawns` list, `role` just a property on each entry. Full detail:
[CHANGELOG.md](CHANGELOG.md)'s 2026-08-26 and 2026-08-27 entries.

---

## Open threads, in the order they'll probably come up

1.  **DM Panel removal itself — Cycle 3 Plan item 2, still not started.**
    Decided 2026-08-25, inventoried CC3-2 (see CHANGELOG 2026-08-27 for the
    full piece-by-piece read), but the actual teardown hasn't happened. Real
    open question at removal time: does `savedCharacters.js`/
    `savedEncounters.js`/`dmtest.js` survive as separate dev/QA tooling —
    CC3-2's read is DM Test's auto-battle runner is a clean survivor
    regardless (pure QA, no in-fiction presence), Save/Load Encounter
    Templates less certain (worth asking whether Genesis Scripts make it
    redundant). Encounter Start/End's real destination is Combat item K
    (Locality-based Encounters, still unbuilt) — Add Enemy still has no real
    non-DM home at all, deliberately not decided this Cycle (see below).
2.  **Seed has no ad-hoc/mid-session casting path.** It's genesis-only right
    now — no live-cast UI (no `data-technique="seed"` button anywhere), no
    dispatch branch in `combat.js`'s technique switch or `noncombat.js`'s
    Order switch (both would just hit the generic "not yet mechanically
    resolved" fallback if somehow triggered). This is deliberate — building
    it now would be building DM Spawn's replacement before DM Spawn is
    actually gone. Pick up once DM Panel item 1 above is actually resolved.
3.  **Per-Character AP-cost scaling for Seed — a good idea, explicitly not
    built.** dDd's own proposal: AP scales 1-per-Character (up to however
    many, no hardcoded cap needed — Yom's own AP stat is the real ceiling
    via the existing affordability check), Lightning/Lava/Focus stay flat
    regardless of batch size. Not built because Non-Combat's own
    Technique-staging skips AP entirely right now (see next item) — do this
    after that's reconciled, not before.
4.  **Non-Combat Round doesn't track AP at all — a real, already-flagged,
    unreconciled gap**, surfaced again by the Seed work. `js/techniques.js`'s
    `stageTechnique()` explicitly skips the `ap` cost in its Non-Combat
    branch on purpose (its own comment: "Non-Combat doesn't scale to AP").
    Party System's Resonance/Buffs thread already named this as needing its
    own real pass — still true, still not scheduled.
5.  **Actor-vs-Target disambiguation inside a 3-Glyph Plan Expression** —
    still a known simplification, not solved. `committedPlanInfo()`
    ([js/behaviors.js](../js/behaviors.js)) takes whichever Target ref a row
    resolved *last*. See [ROADMAP.md](ROADMAP.md).
6.  **The literacy/misunderstanding layer is still just a stated design
    goal, nothing built.** Nothing about a Character's own comprehension
    currently affects how a Plan gets read.
7.  **`BA` (Avoid) and both senses of `KA`-as-Target-interaction are
    designed but not built.** Spec'd in prior-session history, not yet in
    `js/noncombat.js`.
8.  **Inert Stone was deleted and nobody said what replaces it.** Still
    genuinely unanswered — Separation's Technique effect still calls
    `spawnBuildAt(t, 'inert-stone', ...)`, which now silently no-ops. Don't
    guess; ask before touching Separation.
9.  **Locality-based Combat is load-bearing, not a someday item.** `S`/Attack
    still flips `table.inEncounter` table-wide. The real Locality-scoped
    version (ROADMAP.md, Combat item K) is also where Encounter Start/End's
    real non-DM home lives — ties directly into open thread 1 above.
10. **`GLYPH_VARIETY`** ([js/information.js](../js/information.js)) — real
    and working (all remaining Glyphs categorized after `BE`'s deletion) but
    still flagged uncertain in its own comment: `W`/`M` (Facing Marks), the
    4 diagonal Directions (grouped by meaning-text alone).
11. **The 7 placeholder buttons on the Active Character Display** — real
    intended functions for at least the first 2, per dDd, not yet wired.
12. **Personal Relationship Axes, Crafts Known's missing home, the
    Glyphic System's own taxonomy gaps (Marks vs. Glyphs vs. Diglyphs/
    Triglyphs vs. Grammar Lines as distinct structured data)** — all still
    genuinely open, unchanged this Cycle. See ROADMAP's own
    Personality/Behaviors and Architecture/Systemization sections.

---

## Practical notes for whoever picks this up

-   **Before concluding a Technique/mechanic "doesn't exist," check the
    actual data file, not just the hardcoded JS.** `js/techniques.js`'s
    `TECHNIQUES` loads from `data/techniques.json` at runtime — a plain grep
    of the JS file alone will miss real, defined Techniques. This exact
    mistake happened this Cycle (Seed was assumed unbuilt when it was real
    data, just never wired to real staging/resolution) — dDd caught it
    directly by citing it working repeatedly. Check the data before
    asserting a negative.
-   **Cost data can settle a design question outright — read it before
    guessing at the mechanic's shape.** Seed's own `costs` (exactly Yom's
    full resource pool) proved a batch cast was the only viable shape before
    any design conversation was needed to arrive there — worth checking
    whether the data already answers an open question before spending a
    round of dialogue on it.
-   **Preview server caching has bitten before — restart, don't just
    reload,** if a live check looks wrong in a way the code doesn't explain.
-   **A live `mutateTable()` test doesn't prove a feature is reachable in
    real play.** Verify through the actual UI/DOM a Player would see, not a
    forced state poke — this Cycle's Seed verification (Ledger text, real
    Map tile contents, zero DOM references to a vanished Character) is the
    shape to copy.
-   **dDd actively minimizes codebase bloat specifically to keep reasoning
    easier** — flag and fix dead code/redundant mechanisms when they turn
    up, even incidentally.
-   **`mindeyeCategory()`/Retention is scoped strictly to Memory** — don't
    reuse the 0-100 scale elsewhere.
-   **Don't trust a single read taken within ~100ms of a write** — realtime
    echo lag looks like a bug when it's just timing.
-   **Testing convention**: disclosed test-mutation (direct `mutateTable()`
    calls from `javascript_tool`, always cleaned up, always disclosed) is
    established and safe — but prefer driving the real UI/DOM when possible
    (see the cost-data note above).
-   **dDd reads thinking logs live**, not just the final message — visible
    reasoning shapes his own thinking mid-session.
-   **A comment claiming "X is a port of Y," or that a system "should
    already work," isn't proof on its own** — verify against the actual
    source before reusing it as settled. (Not a contradiction of the note
    above about checking data files first — both point the same way: check
    the primary source, not a comment or a JS-only search, before asserting
    either "it exists" or "it doesn't.")
-   **The DM Test panel's synthetic-click quirk (ISSUES.md) is still real**
    — calling a button's own `.click()` via `javascript_tool` instead of a
    coordinate-based synthetic click remains the reliable workaround when
    the Browser pane isn't actively composited.
