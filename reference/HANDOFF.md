# Handoff

Written 2026-08-22, at dDd's own request, for whichever Claude session
picks this up next — this one is close to its context limit. Read this
first; it's a map of the other docs, not a replacement for them. Nothing
here is canon on its own — where it repeats something, the source doc
(cited inline) wins on any conflict.

---

## The docs, and what each one is actually for

-   **[ROADMAP.md](ROADMAP.md)** — live planning only. Every `[Ready]`/
    `[Discuss]` item currently open. Check this fresh every session; it's
    edited constantly and reflects the *current* state of every open thread,
    including all five items from today's handoff request (see below).
-   **[CHANGELOG.md](CHANGELOG.md)** — the historical record, newest date
    first. Everything built and verified, in detail, dated. If you want to
    know *how* something already works, this is more reliable than reading
    the code cold — it carries the reasoning and the live-verification
    evidence, not just the diff.
-   **[ISSUES.md](ISSUES.md)** — bugs/glitches found in testing, distinct
    from ROADMAP's design questions. Currently empty under Open — everything
    found this stretch got root-caused and fixed same-session.
-   **[VISION.md](VISION.md)** — the other altitude. Big-picture build order
    (currently: Personality → Composition-to-Behavior → Mechanical Fixes),
    meant to stay stable, not edited every session. Has a 2026-08-21
    addendum on the Non-Combat Round specifically worth reading — it argues
    that build turned out to be connective tissue between the tactical
    engine and the Information/Language track, not just a Movement feature.
-   **[style-guide.md](style-guide.md)** — the tiebreaker for any color/
    design fact. If another doc disagrees with it, style-guide.md wins,
    full stop (the one exception: a conversation explicitly about updating
    style-guide.md itself).
-   **[scenes.md](scenes.md)** — a running "Script Place" for Scene ideas,
    not settled canon. Has a new 2026-08-22 entry (First Era Legend map
    vision) directly relevant to where this project is headed next.
-   **[dialogue-system.md](dialogue-system.md)** — the fuller Wimbis/
    Dialogue Engine design history. Dense; skim its dated section headers
    before diving in rather than reading start to end.
-   **`language/gomsdu-glyphic-system.json`** — the actual Glyph/Primitive
    data, a living document dDd edits directly (via
    `language/gomsdu-glyph-designer.html`) as much as any session does.
    **Do not assume it's stable between sessions** — dDd said he's actively
    working on it in-game right now (see Glyphs-to-Behavior below).

---

## Where things stand, in one paragraph

The tactical engine (Combat, Movement, Party) and the Information/Language
track (Wimbis, Mindeye, Personality) used to be two separate systems sharing
a database row. That changed this session: the **Non-Combat Round**
(`js/noncombat.js`) is now the shared resolution mechanism both tracks run
through — Move Orders, Message delivery, and the brand-new **Behaviors**
system (Personality → Relationships → Pursuit/Longing → a Likely/Runner-Up
Behavior, logged to the Ledger every Round) all resolve through it. The
Sync Race (the old whole-row-overwrite clobbering bug) is fixed for real,
with automatic conflict detection and retry. Four real Panels exist now:
Character, Information, Personality, Relationships — all following the same
build pattern, all genuinely playable. Full detail, all dated, all
verified live (not just reasoned about): CHANGELOG.md's 2026-08-21 and
2026-08-22 sections.

---

## The five open threads from today's handoff request

All five are dDd's own words, captured in full in ROADMAP.md at the
sections cited — this is just the map to find them, not the whole spec.

1.  **The Map Evolution** — huge in scope, deliberately not started.
    "The good news is that the shift is the intended final design, not a
    placeholder." See ROADMAP.md's Movement System section, top item.
2.  **Facing** — the direction a Character is actually facing. Characters
    switch from a plain initial-letter Map label to a **Triangle**, base
    indicating Facing; set from a new Party Menu control ("Party Facing"),
    which also sets the Character's Mini-Party's Facing. Well-specified,
    not yet built. See ROADMAP.md's Movement System section, second item.
    **This is the piece dDd wants picked up first**, ahead of the rest of
    the Map Evolution.
3.  **Active Character** — "pretty much essential," per dDd. The real
    unifying principle: every Character (Player, Mini-Party, Enemy, NPC)
    functions identically; Active Character is just which one a Player is
    currently acting as. Possession and Mini-Party control are both just
    "temporarily make another Character Active," not separate mechanics.
    **Confirmed as the real mechanism behind TATA/DM control too** — even
    TATA's "direct control" of an NPC is Possession via Shadow Gom, not a
    separate control mode. This is the concrete argument for tearing down
    the DM Panel's own bespoke Acting-As/Essence-menu UI in favor of the
    same Active-Character-switching a Player already uses. See ROADMAP.md's
    Party System section, top item.
4.  **Glyphs to Behavior, real Map execution** — blocked on Facing... with a
    shortcut. The 4 Direction Glyphs (RO/OR, OP/PO, OK, KO) also carry
    Cardinal-Direction meanings independent of a Character's own Facing, so
    a first real "Glyph nudges an actual Map action" pass could use those
    instead of waiting on Facing. **Also: Stand Around's own Glyph is
    coming but not handed over yet** — dDd is still refining it in-game;
    don't guess at a `GLYPH_BEHAVIOR` entry for it. See ROADMAP.md's new
    Personality / Behaviors section.
5.  **Teaching** — deliberately held until Facing/Active Character/the Map
    Evolution land, so the actual First Era Tutorial Scenes get built
    against real scaffolding instead of "struggling against outdated
    scaffold mechanics." The content vision for this (5 Living-Stone
    Personality clusters — Standers, Learners, Fighters, Watchers, Elites —
    plus Gom and Kulkrow roaming the Map on their own) is captured in full
    in scenes.md's new First Era Legend entry. dDd's own read: "the crazy
    part is that we have the infrastructure for all of that like 70%
    complete."

---

## Practical notes for whoever picks this up

-   **Preview server**: `.claude/launch.json` has a `gomsdu-table` config
    (`npx serve .`). Keep it running for the whole session rather than
    stopping/restarting between checks — port auto-increments if 3000 is
    taken, which is normal and fine, just re-navigate to whatever port it
    reports.
-   **Verification habit that paid off repeatedly this session**: don't
    trust a single `mutateTable()` read taken within ~100ms of a write —
    the realtime echo has real latency, and reading too early looks like a
    bug (stale data) when it's actually just timing. Wait longer (300-500ms)
    or re-check before concluding something's broken — this cost real time
    more than once this session before being recognized as the known,
    already-documented sync lag, not a regression.
-   **Testing convention**: this codebase's disclosed-test-mutation pattern
    (direct `mutateTable`/`deliverMindeyeEntry` calls from `javascript_tool`
    to set up a scenario, always cleaned up after) is well-established and
    safe to keep using — see almost any CHANGELOG entry's "Verified live"
    paragraph for the pattern in action.
-   **dDd reads thinking logs live** while Claude works, not just the final
    message — reasoning quality and flagged tradeoffs are visible to him in
    real time. Worth keeping in mind when working through something messy;
    he's already seeing the mess unfold, not just the clean conclusion.
