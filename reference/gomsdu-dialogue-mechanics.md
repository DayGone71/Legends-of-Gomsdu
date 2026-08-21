# Legends of Gomsdu — Dialogue Engine: Mechanics

**Companion to:** the Vibe Document (tone/philosophy — check every mechanic here against it) and the Influences doc (touchstones for feel).

**Scope:** structural mechanics only — how an Exchange is actually built and played. Deliberately stops short of literal UI copy, exact point values, or specific Set Piece content. Read the Vibe Doc first; the *why* behind these choices lives there, not repeated here.

---

## The Core Loop: Line & Set Pieces

An **Exchange** (a single conversation, start to finish) is built by assembling **Set Pieces** onto a **Line**. The Player "sets" their Line — same underlying interaction grammar as planning Actions on the Sequencer in Combat, different content.

Set Pieces are **higher-level than literal words** — rhetorical postures and conversational moves ([Present Case], [Make Claim], [Point Out Thing], [Ask Question About Thing], [Mock Surprise], [Deflect Accusation], [Tell a Joke], [Change Subject]), not dialogue-tree lines. A Set Piece's *shape* matters more than its content — [Mock Surprise] doesn't care what you're surprised about.

Set Pieces can be **paired/chained** on one Line as a single composite move — a setup piece followed by a payoff piece.

---

## Set Piece Properties: Axes & Sliders

Some Set Pieces carry one or more **Axes** (singular **Axis** — "Ax" has come up as shorthand; not standard grammar, but worth deciding deliberately if it's meant as real domain terminology). An Axis is the underlying property being expressed — e.g. Gross ↔ Subtle, Witty ↔ Simple.

Every Axis runs between two **Poles**, with a **Mid** point between them (Pole, Mid, Pole). How many discrete steps sit between Mid and either Pole can vary per Axis — it isn't fixed at any particular count.

A **Slider** is one way to deliver an Axis — it lets a Player dial a Set Piece's intensity toward one Pole or the other. **Sliders aren't the only possible delivery method.** Other ways of expressing where a Set Piece sits on an Axis are open for future Set Pieces to use.

Example: **[Tell a Joke]** carries two Axes, both delivered via Slider — **Gross ↔ Subtle** and **Witty ↔ Simple**.

Two tiers of Axes:
- **Standard/Exchange-level** — shared grammar available to any Set Piece, keeping the whole system feeling consistent.
- **Set-Piece-specific** — local exceptions for pieces that need their own flavor.

*Open: full list of standard Exchange-level Axes not yet decided. Open: what delivery methods exist besides Sliders.*

---

## How Personality Reacts to Axes

Personalities read a Set Piece's **position across its Axes as a whole**, not each Axis independently — Witty+Gross can register as *clever* to a Personality that would read Simple+Gross as *crude*, even though Gross is constant. Chosen deliberately as the richer, costlier-to-author model, because it scales better across many Personalities × many Set Pieces than flat per-axis scoring.

*Open: no formal scoring rule defined yet — this is a direction, not a finished formula.*

---

## Ripple Effects

A reaction (e.g. a **humor point**) pushes an underlying **Relationship** value (trust, patience, guard) toward or away from a threshold. Crossing that threshold produces the narrative beat ("you're alright in my book" / "say that again and I'll rip your arms off") — **the number is never shown as the story, the threshold crossing is.** Same principle as the Ledger giving Combat stats meaning through narrative framing, applied to Dialogue.

*Open: exactly which values a given reaction ripples into isn't formalized per Set Piece — established as a pattern, not a full mapping.*

---

## Preparation: Prepared Set Pieces & Rehearsed Lines

A Set Piece can be **prepared ahead of time** — Axes locked in advance, like a Wizard prepping spells or a Warrior dialing in equipment. A prepared piece (a **Rehearsed Line**) trades **reactivity for reliability**:

- Can't read the room — Axes are fixed before the Exchange starts.
- Immune to the Call/Response timer, since it doesn't need to be built live.
- Should hit **harder** when it lands, so preparing one is a real trade-off, not a strictly-better option.

*Open design hook: does repeating the same Rehearsed Line always land the same (sitcom-catchphrase absurdity, played straight) or do familiar Personalities grow wise to it over time? Worth an on-vibe check against Absurdity-as-Satire before deciding.*

---

## The Four Pillars

**Exchange** is the runtime — orchestration only, no data of its own. It's where Information, Personality, and Relationship collide under the Call/Response structure.

### Information
What a Character knows — facts, opinions, vocabulary, local or niche knowledge. Gathered through play (Libraries, exploration) the way gear is gathered for Combat — a **kit** a Personality draws on, not a fixed pool.
- **Local** — situational, in-the-moment ("check that sword out").
- **Global/Retained** — persists and can be recalled later ("I can still recall the Battle of Givik").

### Personality
Where the *logic* lives — Sliders and preferences determining how a Character reacts to a given Set Piece. Deliberately **reasonably sized, not sprawling** — should be enjoyable to build and experiment with, since it most directly shapes how Lines land between Personalities.
- **Current** — short-term state (a bad day, growing excited mid-conversation).
- **Steady** — the baseline that persists talk to talk.

**Personality changes over time — this is the Arc.** Mutability itself is an authorable trait, not a fixed rule:
- **Static** — doesn't shift; has to be deliberately built that way.
- **Sponge** — shifts readily, after nearly every meaningful interaction.
- **Gambler / split-personality** — extreme case; Sliders aren't Player-controlled, each Set Piece is a roll.

*Open, flagged: a Sponge-type Personality shifting mid-Exchange could be a feature (mood curdles in real time) or a balance risk (nothing stable to plan around) depending on tuning. Needs real numbers to judge.*

### Relationships
The score between two Characters.
- **Temporary** — the live value during a single Exchange, fluctuating as ripple effects land.
- **Final** — what Temporary resolves into once the Exchange ends, becoming the new baseline.
- **Here-and-now vs. memory** is this pillar's local/global split.

This Temporary → Final pattern is **the same mechanism as Flow/Focus in Combat**, applied to a different stat. Reuse it; don't build a parallel system.

---

## Call & Response

An Exchange runs in rounds structured as **Call** and **Response**.

- Whoever **initiates** the Exchange is **Caller for its entire duration** — fixed, not alternating per round, even if the Caller ends up asking most of the questions.
- A timer starts the moment someone Calls, ends when the Responder answers, or **forces whatever's on the Line through at zero**, ready or not.
- Deliberately inverts Combat's pacing: Combat gives unlimited planning time; Exchange puts a real clock on the Player. (See Vibe Doc — Structural Instances.)
- Because an unset or half-set Line can be forced through, **Rehearsed Lines have real mechanical teeth**, not just flavor value — prepared pieces are immune to being caught out at zero.

---

## Subject & Topics

**Subject** is a `((Noun))` — the central point an Exchange revolves around. Making it explicit lets the system **shadow-calculate** relevant Personality reactions, Information held, and existing Relationships regarding that Subject.

- A Subject can carry **connected Topics** (Subject: Cave; Topic: Sword) — conversation can dwell on a Topic for a round or two without the Subject formally changing.
- After enough rounds on a Topic, it can **become the new Subject** naturally, or the Exchange can **revert** to the original.
- **`[Change Subject] ((New Subject))`** is the forced version of the same drift — spending effort to redirect deliberately instead of letting it happen organically.

---

## Tags: `{Verb}` and `((Noun))`

Set Pieces stay reusable and high-level by not hard-coding specifics. **Tags** attach the specifics — person, place, thing, action — to an otherwise generic Set Piece, so `[Present Case]` can be about anything without a bespoke Set Piece per topic.

---

## The Three Lines

Every Line a Character (Player or NPC) produces sits on one of three tiers:

- **Conscious** — assembled live under the Call/Response clock (or pulled from a saved/prepared piece).
- **Semi-Conscious** — same as Conscious, but *held in reserve* and freely swappable with what's currently on the Line, right up until sent. Represents "having something to say, waiting for a good opening." Swap is a **simple toggle**, no hidden trigger.
- **Subconscious** — fully automated. Default mode for NPCs; also available as the Player's passive background mode. Runs on the **same engine** as Conscious/Semi-Conscious — an automatic Set-Piece-chooser standing in for manual input — so NPCs and the Player play by identical rules. The Player is distinguished only by *choosing* to operate the controls manually, not by running on different logic.

---

## Intent Selector

**Intent** gives an Exchange direction — changes which Sliders/Knobs/Toggles are relevant, which Set Pieces are available, and can affect ordering.

**Vague** is a special Intent: fully freeform, no steering. Subject, Tags, and Sliders all exist to keep an Exchange coherent without being confusing — Vague is the escape hatch for when a Player wants none of that scaffolding.

---

## Target Scenarios (Coverage Checklist)

The core grammar (Line, Set Pieces, Call/Response, Subject) should flex to cover all of these **without bespoke logic per scenario** — if one needs special-case mechanics to feel right, that's a signal the core grammar has a gap:

1. Nonchalant banter between NPCs
2. Asking NPCs for low-stakes information
3. Tense interactions regarding world-altering events
4. Personal, emotionally charged conversations
5. A Party chatting among itself

Scenarios 1 and 5 lean hardest on **Subconscious Line**. Scenario 5 specifically requires the engine to run NPC-to-NPC, not just Player-to-NPC — confirming Subconscious has to be a first-class mode, not a Player-only convenience.

---

## The Tata Connection

Per the Vibe Doc's TATA section: the Information pillar needs to carry **authorship-asymmetry**, not just content-asymmetry. What a Character knows is Information; *why* they know it, and whether that knowledge was given or withheld by Architect or Adversary, is a separate axis the Information Panel should represent. Not yet designed — flagged here so it isn't lost when Information Panel work starts.

---

## Open Threads

- Full list of standard Exchange-level Axes, and what delivery methods exist besides Sliders.
- Formal Personality reaction model for combined Axis-space (direction set — read the combination, not independent Axes — scoring rule not yet written).
- Full mapping of which values a given ripple effect touches, per Set Piece type.
- Rehearsed Line repetition: always lands the same, or do Personalities grow wise to it?
- Sponge-type Personality drift rate/balance — needs real numbers before it can be judged.

**Redirected, next session, per dDd — see `dialogue-system.md`'s matching
dated section for full detail.** None of the five threads above are
independent design questions anymore: Axes/Axis/Ax attach directly to
Glyphs; the scoring rule, ripple mapping, and Sponge-drift rate are all
"dependent on Personality" — outputs of the Personality build once it
exists, not formulas to derive here in the abstract; Rehearsed Line
repetition is explicitly deferred as Third Era work, not an immediate
concern.
