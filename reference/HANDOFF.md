# Handoff

Written 2026-08-24, at dDd's own request, for whichever Claude session picks
this up next. Read this first; it's a map of the other docs, not a
replacement for them. Nothing here is canon on its own — where it repeats
something, the source doc (cited inline) wins on any conflict. Updated
later the same day, at the actual end of the session ("do a 3 part wind
down: Finalize Documentation, Recap, open feedback") — the "Where things
stand" and "Open threads" sections below reflect the session's real final
state, not the mid-session snapshot the first version of this file caught.

---

## The docs, and what each one is actually for

-   **[ROADMAP.md](ROADMAP.md)** — live planning only. Every `[Ready]`/
    `[Discuss]` item currently open. Check this fresh every session; it's
    edited constantly.
-   **[CHANGELOG.md](CHANGELOG.md)** — the historical record, newest date
    first. If you want to know *how* something already works, this is more
    reliable than reading the code cold — it carries the reasoning and the
    live-verification evidence, not just the diff. Today's date
    (2026-08-24) is a genuinely huge one — 9 dated entries, read them in
    order (oldest at the bottom of that date's block).
-   **[ISSUES.md](ISSUES.md)** — bugs/glitches found in testing, distinct
    from ROADMAP's design questions. **Not empty right now** — 4 Open items,
    all pre-existing (none from today). Don't assume "empty" like the last
    Handoff said; that was true 2026-08-22, not anymore.
-   **[VISION.md](VISION.md)** — the other altitude, big-picture build
    order, meant to stay stable across sessions.
-   **[style-guide.md](style-guide.md)** — the tiebreaker for any color/
    design fact.
-   **[scenes.md](scenes.md)** — a running "Script Place" for Scene ideas.
-   **[dialogue-system.md](dialogue-system.md)** — the fuller Wimbis design
    history. Dense; skim dated section headers. Has a new 2026-08-24
    follow-up closing the loop on 2026-08-22's Universal Characters Table
    section — read that pairing if you touch `table.characters`.
-   **`language/gomsdu-glyphic-system.json`** — the actual Glyph/Primitive
    data, a living document dDd edits directly. Do not assume it's stable
    between sessions.

---

## Where things stand, in one paragraph

This was a very long, single-session arc that closed the gap between "the
tactical engine" and "the Language track" further than any session before
it, and ended exactly where it was always headed: a real, working piece of
Scripts-and-Behavior-with-Glyphs, the session's own stated goal from its
opening message. The **Universal Characters Table** (`table.characters`)
went from a design doc to something real, with Yom as its first tenant.
That forced a real spawn consolidation: one `spawnCharacter()`
([js/character.js](../js/character.js)) replacing 4 hand-copied literals,
the Build roster cut to 5 real archetypes, `techniqueAccess` per-Technique
instead of per-category. Mindeye gained a real 4-stage Retention/Category
lifecycle. The 3 old Information/Personality/Relationships Pillars merged
**twice** — first into 3 equal columns, then rethought entirely into one
Glyph-list-driven Personality Panel. `S` became the first real Glyph wired
through to a mechanical effect (starting a Combat Encounter). And the
session's real capstone: **Plan and the Behavior Queue are both real now.**
A Character's Plan is 3 genuine Expression slots (`WIM KROW`-style, 2-3
Glyphs, built on a real port of the actual Glyph Arranger's popup mechanic,
not a copy of Write Script's), Committing one flags its Behavior Glyph for
a real **+25 Plan weight**, and the full formula — **Desire + Longing +
Plan + Repeat = Pursuit** — genuinely drives a working `fillBehaviorQueue()`
that autofills up to 9 slots (or the Character's own AP, whichever's
smaller) with a real weighted-random draw across every remembered Glyph at
once, live-verified filling a 9-Character's Queue with a real mix, a
Committed Behavior visibly dominating without total domination (thanks to
the Repeat penalty). Full detail for all of it: CHANGELOG.md's 2026-08-24
date, 9 entries, oldest-to-newest at the bottom of that date's block.

---

## Open threads, in the order they'll probably come up

1.  **AP actually draining as the Behavior Queue resolves is now THE next
    real piece — everything upstream of it is done.** The Queue is real,
    capped, and autofills for real via `fillBehaviorQueue()`
    ([js/behaviors.js](../js/behaviors.js)) — what's still missing is
    Round resolution actually consuming it. Right now `resolveBehavior()`
    ([js/noncombat.js](../js/noncombat.js)) still only rolls the old
    single-pick-per-Category path and never looks at `actor.behaviorQueue`
    at all. dDd's own guidance for costs, still standing: **1 AP for
    almost everything in First Era** — validate True/False first, scale
    numbers later.
2.  **Actor-vs-Target disambiguation inside a 3-Glyph Plan Expression is a
    known simplification, not solved.** When a Targets-variety Glyph
    appears twice in one committed row (`KROW WIM KROW`), `committedPlanInfo()`
    ([js/behaviors.js](../js/behaviors.js)) just takes whichever ref that
    row resolved *last* — fine for the common 2-Glyph case, not a real
    read of which position means Actor vs. Target. Flagged in
    [ROADMAP.md](ROADMAP.md).
3.  **The literacy/misunderstanding layer is still just a stated design
    goal, nothing built.** dDd, on what Plan actually is: "more like a
    literacy test and an order to fulfill combined... The Game needs to
    understand the way the Language works well enough to stimulate various
    levels of understanding (and misunderstanding) it." Nothing about a
    Character's own comprehension (Intelligence, known-Glyph coverage)
    currently affects how a Plan gets read.
4.  **`BA` (Avoid) and both senses of `KA`-as-Target-interaction are
    designed but not built.** BA is a standing Movement-category modifier
    (bias away from a Target), not a one-shot dispatch like `S`. KA's base
    sense (interact = read what's Engraved, pulling the *Target's* Mindeye
    into the *Actor's* own — confirmed this also works on Totems) and its
    advanced sense (an `[Target/Idea, KA, Target/Idea]` Expression
    triggering Contemplation, which raises Retention) are both spec'd in
    this conversation's own history, not yet in `js/noncombat.js`.
5.  **Inert Stone was deleted and nobody said what replaces it.** Still
    genuinely unanswered — Separation's Technique effect (`js/combat.js`,
    `js/noncombat.js`) still calls `spawnBuildAt(t, 'inert-stone', ...)`,
    which now silently no-ops. Don't guess; ask before touching Separation.
6.  **`KULOG`/`KALAG` are confirmed swapped and still not fixed in code.**
    dDd, live: "they were supposed to be swapped for what the face says."
    The Glyph data says `KULOG`="Find/Hunt", `KALAG`="Explore/Wander"; the
    code (`js/behaviors.js`'s `GLYPH_BEHAVIOR`) has `KULOG`→wander,
    `KALAG`→face — backwards. Confirmed wrong, not yet swapped. Easy,
    contained fix whenever picked up.
7.  **Locality-based Combat is load-bearing, not a someday item.** `S`/Attack
    currently flips `table.inEncounter` table-wide (the coarse version,
    dDd's own explicit choice for a first pass). The real Locality-scoped
    version (ROADMAP.md, Combat item K) is what lets a fight happen in one
    corner of the Map while everyone else keeps resolving Non-Combat
    Behaviors normally, same Round — dDd's own "Global Time" framing
    (every Round, Combat or Non-Combat, is 7 seconds) makes this the real
    target.
8.  **`GLYPH_VARIETY`** ([js/information.js](../js/information.js)) is a
    real, working first pass (all 39 Glyphs categorized, confirmed good by
    dDd) but explicitly flagged uncertain in its own comment: `BE` (exists
    only because the Glyph Designer has no delete button dDd could find),
    `W`/`M` (Facing Marks, not obviously any of the 4), the 4 diagonal
    Directions (grouped by meaning-text alone).
9.  **The 7 placeholder buttons on the Active Character Display
    ([js/activeCharacter.js](../js/activeCharacter.js)) have real intended
    functions for at least the first 2**, per dDd, not yet wired: button 1
    = `KALAG`, click to change Facing; button 2 = `KULOG`, click to open
    "the Movement Interface." Ties to the "7 Movement Commands" framing
    (4 Directions + `KALAG` + `KULOG` + `SUU`, all confirmed real Glyphs now).
10. **Personal Relationship Axes don't exist yet.** The Personality Panel's
    "Relationship Details" section is a real, honest placeholder — per
    dDd, these are Character-personal Axes that "influenc[e] how they
    react to stuff they receive," distinct from the per-Glyph Emotion Axes
    (Attachment/Desire), which are built. Not designed beyond one sentence.
11. **Crafts Known has no home right now.** Retired from the Personality
    Panel (per dDd, it belongs on the Character Sheet) but the Character
    Sheet itself is on hold until Second Era — not reachable in the UI.
12. **The Glyphic System's own taxonomy gaps, flagged by dDd, not started**:
    Marks vs. Glyphs vs. Diglyphs/Triglyphs vs. Grammar Lines aren't really
    reflected as distinct structured data anywhere; alternative
    pronunciations per Glyph/Letter are a considered-but-unbuilt data point.

---

## Practical notes for whoever picks this up

-   **Preview server caching bit this session hard, repeatedly — restart,
    don't just reload.** `npx serve .` (or the browser, or both) served
    stale JS/CSS across plain `location.reload()` several times today,
    producing confusing false-mismatch readings (wrong grid-column counts,
    CSS that looked unapplied). The fix that worked every time: actually
    `preview_stop` + `preview_start` the server fresh, not just reload the
    page. If a live check looks wrong in a way that makes no sense given
    the code you just wrote, restart the server before assuming the code is
    wrong.
-   **A live `mutateTable()` test doesn't prove a feature is reachable in
    real play — dDd caught this directly.** Verifying `resolveBehavior()`'s
    `S`→Attack dispatch by manually setting a test NPC's Mindeye to `[S]`
    only proved the dispatch code works *given* the precondition; it didn't
    prove any real Build could ever reach that precondition (none had `S`
    in `startingMindeye`). "You Manually gave it to him, which means the
    Feature doesn't work. It can't be tested." Always check whether the
    setup you're using to verify something is itself reachable through real
    gameplay, not just whether the mechanism fires once you force it.
-   **dDd actively minimizes codebase bloat specifically to keep Claude's
    own reasoning correct** — his own words, 2026-08-24: "I'm trying to
    help remove bloat and complication so that thinking is easier for you.
    Something like that is just one more line to trip over now." Saved as
    a standing memory
    ([feedback_minimize_bloat_for_reasoning.md](../../.claude) — see
    Claude's own memory system, not this repo). When a leftover workaround,
    a redundant second mechanism, or dead code turns up — even
    incidentally — flag and fix it rather than building around it.
-   **`mindeyeCategory()`/Retention is scoped strictly to Memory** — per
    dDd: "the 100 is only for memory." Don't reuse the 0-100 scale for
    Personality Axes, Relationships, or anything else.
-   **Verification habit that keeps paying off**: don't trust a single read
    taken within ~100ms of a write — realtime echo lag is real and looks
    like a bug when it's actually just timing.
-   **Testing convention**: the disclosed-test-mutation pattern (direct
    `mutateTable()` calls from `javascript_tool` to set up a scenario,
    always cleaned up after, always disclosed) is well-established and safe
    — see almost any CHANGELOG "Verified live" paragraph.
-   **dDd reads thinking logs live**, not just the final message — visible
    reasoning and flagged tradeoffs shape his own thinking mid-session.
-   **A comment claiming "X is a port of Y" isn't proof — read Y directly
    before reusing X as its stand-in.** Write Script's own header comment
    claimed to be a port of `language/gomsdu-glyph-arranger.html`; building
    Plan's Glyph slots on Write Script's actual code (permanently-visible
    selects) instead of the real Arranger (blank, click-to-open popups) was
    the direct cause of a real bug (the "always defaults to RO" false
    default) and a redo dDd had to catch live. When a comment says something
    already matches a spec/reference file, open that file before trusting it.
