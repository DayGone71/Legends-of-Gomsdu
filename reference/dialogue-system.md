# Dialogue System — Axes, Pools, and Personality-as-Build

Design notes from a 2026-08-16 exchange dDd ran with ChatGPT, expanding on the
Axes/Pools idea logged in [ROADMAP.md](ROADMAP.md)'s **Interactions &
Dialogue (new)** section. Too large and speculative for the ROADMAP itself —
this is the fuller design space it points to. Nothing here is built or
committed; treat it as raw material to draw from when the Dialogue system
actually gets designed for real.

## The core reframe

Not a "dialogue system" — a **dialogue generator with authored semantic
constraints**. The Axes aren't flavor on top of a normal branching system;
they're the actual inputs to a small social simulation:

> Intent + Subject + Tone + Approach + Social Context + Character Traits
> → candidate utterances → selection

Same underlying intent, wildly different surface expression depending on who's
asking:

- High Respect, Friendly Tone, Direct Approach, Charisma 72 → *"I don't mean
  to pry, but you seem to know this place better than anyone. What
  happened here?"*
- Low Respect, Suspicious Tone, Confrontational Approach, Charisma 35 →
  *"You clearly know something. Start talking."*

Both are the same conversational move (request information). The Axes decide
how it lands, not whether it's available.

## Split the Axes: player-chosen vs. character-determined

Key refinement — not everything should be a menu the Player picks from turn
to turn. Some Axes are the **intent** (what the Player is trying to do);
others are **capability** (how well/in what manner their Character can
actually express it).

- **Player chooses:** Intent (Ask / Threaten / Persuade / Deceive / Flatter /
  Insult / Offer / Refuse / Reveal / Conceal), Approach (Direct / Indirect /
  Humorous / Formal / Aggressive / Cautious / Personal), Tone (Warm / Cold /
  Serious / Playful / Sarcastic / Urgent).
- **Character determines:** Charisma, Vocabulary, Education, Culture,
  Respect, Confidence, Emotional state, Relationship with the NPC, Knowledge,
  personal customs-awareness.

"The player decides what they are trying to do. Their Character determines
how well and in what manner they can express it." — this is the same
intent-vs-execution split combat already has (choosing to attack vs. your
build determining Hit%/Power), just applied to conversation.

## NPCs run the same system

The bigger payoff: this isn't just a Player-input system, it's a **shared
social language** between Player and simulation. Give NPCs the same kind of
Axes-as-state — Respect for Player, Fear, Trust, Cultural Awareness,
Charisma, current emotional state, preferred Approach, current Subject — and
their response space is constrained by who they are, without needing an LLM
to reinvent their personality every turn live. A suspicious, cornered NPC and
a friendly, confident one can express the same underlying reaction
("you're lying") completely differently, deterministically, from their own
stat state.

## Pools as linguistic components, not lines

Avoid thinking of the pools as complete authored sentences only. Better as
**semantic skeletons** with swappable authored pieces:

```
[Opening] + [social qualifier] + [request] + [reason]
```

e.g. Opening: "Excuse me," / "I wonder," / "Look," / "Listen,"
Qualifier: "and I mean no disrespect," / "if you don't mind," / "before this
gets any worse,"
Request: "where did you get that?" / "who gave you the key?"
Reason: "I'm trying to find someone." / "I think we're both in danger."

Mix fully-authored one-off lines alongside compositional pieces where a
single scripted line reads better than an assembled one (a pivotal-moment
line probably wants to be hand-written, not composed).

## Authoring pipeline — AI offline, never live

Confirms and extends the AI/OC split already established: **no LLM call at
runtime, ever.** The LLM (OC) is a *content-generation tool used during
authoring*, not part of the running game.

1. Designer specifies a target combo (Subject / Intent / Tone / Approach /
   Culture / speaker Personality).
2. AI generates a large batch of candidate utterances for that combo, offline.
3. Candidates get tagged (appropriate / too aggressive / too modern /
   culturally inappropriate / too long / humorous / formal / etc.) — by a
   human, or by a second automated pass.
4. Tagged, curated results get stored as static game data.
5. At runtime, plain deterministic client-side logic ("AI" in this project's
   naming) selects from the appropriate pool. No inference, no network call.

## Linguistic fingerprints per NPC archetype

Same semantic content, different surface voice, driven by a speech-style
profile per NPC type — not just personality *stats* but speech *preferences*:

- **Scholar** — long sentences, technical vocabulary, metaphors, high
  formality, rare contractions.
- **Soldier** — short sentences, direct, concrete vocabulary, few metaphors.
- **Noble** — indirect, formal, socially coded, rarely makes explicit
  accusations.
- **Street criminal** — slang, threats, humor, implication, short sentences.

Two NPCs can hit the exact same semantic response and sound like completely
different people saying it.

## Customs Awareness as a real systemic axis

Not cosmetic — a genuine gate. A Player with high Respect/Formal Approach but
low Customs Awareness can still say something that lands wrong, because
politeness and correctness aren't the same axis:

> "You mean well. But don't use that title again."

That's the game teaching the Player something about the culture through the
failure itself. Raising Customs Awareness over time changes future outcomes
of the *same* social situation — **progression expressed through
conversation**, not a flat "+2 Persuasion" stat bump.

## Combinatorial explosion — the real risk, and the fix

10 Tones × 10 Approaches × 10 Subjects × 10 Respect levels × 10 Cultures × 10
Personality types is millions of theoretical combinations. Don't author a
bespoke line for every one of them. Use a **priority/fallback hierarchy**
instead — most-specific match wins, falls back progressively:

```
Intent → Subject → Relationship → Culture → Personality → Tone → Approach → Surface wording
```

A generic fallback line ("That's not something I can discuss.") can get
modified per speaker ("I'm afraid, my friend, that isn't something I can
discuss.") rather than requiring a fully distinct authored line for every
leaf combination.

## The abstraction-level argument

The Player isn't picking a literal sentence — they're picking *"I want my
Character to respectfully ask this person about the ruins,"* and the engine
figures out how that specific Character would actually say it. Same
abstraction level as combat already uses: the Player says "I attack the
goblin with my sword," not "swing at 47 degrees, extend elbow 12cm" — the
engine handles the realization. Dialogue should work the same way.

## Personality as a full parallel Stat System — "Character is the Stat System basically" (dDd)

This is the biggest extension beyond the original Axes/Pools idea: Personality
stops being flavor sitting on top of the RPG and becomes an actual **second
build**, parallel to the physical/supernatural one already in place:

- **What can my Character DO?** — Strength, Flow, Focus, Lava Craft,
  Lightning Craft, etc. (the existing Stats system).
- **Who is my Character?** — Charisma, Confidence, Empathy, Formality,
  Humor, Suspicion, Cultural Awareness, Patience, etc. Not necessarily all
  traditional numeric stats — some could be sliders, traits, learned
  knowledge, or relationships instead.

Both builds ultimately feed the same underlying idea already established by
the Technique engine: a Character accumulating a **repertoire of ways to act
in the world** — not that every social move literally becomes a capital-T
Technique, but the same "build a repertoire, then draw from it" philosophy
applies to both.

Important: **high isn't universally better.** Confidence 19 / Empathy 4 /
Suspicion 17 isn't a "better" conversationalist than Confidence 7 / Empathy
18 / Trust 16 — they're suited to different social situations, not ranked on
one axis. Contradictions read as characterization, not bugs: high Confidence
+ low Social Awareness confidently says the wrong thing; high Empathy + low
Confidence reads people accurately but struggles to speak up.

## Kill "Charisma" as the universal Persuasion stat

Rather than `Persuasion check = Charisma`, resolve social outcomes from the
full combo: what the Player is trying to accomplish, how they're approaching
it, who they're talking to, what their Character knows, and what kind of
person their Character is. Different personality builds should succeed
through genuinely different routes for the same objective — a confident,
terrifying barbarian intimidates; a compassionate character persuades by
understanding; a scholar persuades through expertise; a con artist through
deception; a noble because defying them carries social consequences. Same
goal, different mechanically-distinct paths, all valid.

## Personality as progression, not a level-up number

Traits should be able to shift from what actually happens in play, not just
tick up on level-up: more confident after surviving a war, less trusting
after a betrayal, learns a clan's customs after enough exposure, more patient
after years spent mentoring someone. These shifts **change what dialogue is
actually available going forward** — a lived character, not a stat block with
a name attached.

## 2026-08-17 — The Beat System (in-session brainstorm, dDd + Claude)

Everything above this point is the 2026-08-16 ChatGPT-sourced material. What
follows is a different, later pass — built live in conversation once the
high-level goal ordering was settled (see `VISION.md`) and dDd specifically
wanted Dialogue's own atomic unit worked out before its Stats got designed.
Not built or committed either — same status as everything above, just a
session newer.

### Absurdity as a real design principle, not a mood
dDd's own framing: "almost everything from Lore to Color to Vibe to Mechanics
is based on absurdity, usually functioning as exaggerated parody of what's
already out there." **Gom** — theatrical, excessive, shock value delivered
through goofball naivety. Already present in the Codex without anyone naming
it: the Man of Gom's constant, genuine-reading happiness is Duping Delight —
running the same con Gom ran on Kulkrow for centuries, and enjoying every
second of it. **Kulkrow** — heavy, emotional; dDd's phrase, "the deranged
misunderstanding an exercise in tragic circus with a faceless clown," is
literally accurate, not just a mood — Kulkrow spends the entire Third Era
faceless: a Cloud, a Shield, fragments scattered through everyone's Blood.

**Working principle:** the mundane end of the Dialogue system (personality-
mismatch Beats, Seinfeld-scale scenarios) is where real humor plays broad;
the mythic end (Codex reveals, cult Loyalty, the true histories) keeps the
existing "played straight, no wink" rule from `gomsdu-codex.md`'s own
Player-Facing Reveal section intact. Same absurdist DNA underneath both —
different volume knob depending on stakes.

### The Beat — Dialogue's atomic unit
Named "the Beat" specifically to avoid colliding with "the Sequence"
(Combat's own round unit) while staying in the same one-word register
(Wounds, Flow, Chunks, Sequence). Structurally mirrors a Sequence — a
countdown-and-resolve container — but the pressure model is inverted on
purpose: Combat gives real time to plan and abstracts the chaos away (small
Wounds, generous AP) so the Player feels unstoppable. A Beat gives a real,
unforgiving clock instead — dDd's framing, "60 seconds of talking can be more
intense than fighting 100 goblins... because you have to fight against Time
itself."

**The ladder.** Every Subject (topic) an NPC holds sits at one rung:
**Unknown → Rumored → Partial → Confirmed → Misunderstood.** Misunderstood
isn't a dead end, it's load-bearing — it's `gomsdu-codex.md`'s own
"Player-Facing Reveal: A Process" section running as an actual mechanic
instead of being described in prose. A Subject can be confidently,
plausibly wrong, and dragging it from Misunderstood into Confirmed is a
structurally harder move than Unknown into Rumored, not just "more clicks."

**Resolution.** A Player commits a Move — Intent + Approach + Tone (the
Axes design above) — aimed at one Subject. The target's own stats (Respect,
Suspicion, Customs Awareness, Culture) filter which rung-transitions are
even reachable this attempt; landing inside that set pulls from an authored,
offline-curated Pool for that Intent/Subject/transition. Zero runtime
inference, matching the Authoring Pipeline above exactly.

**Two separate dials, not one.** The Information ladder (what someone
believes, per Subject) and Loyalty (the existing faction-recruitment
concept — how disposed someone is toward you) stay independent. Fully
Trusted by someone who still believes something false; dragged to Confirmed
by someone who never ends up liking you for it — both real, both distinct.

### Timeout, Locality, and the delayed Pulse
**Timeout is a Move, not a failure state.** Hitting zero with nothing
received resolves as Silence — read by the target as evasive, overwhelmed,
guilty, whatever fits them — sliding the Subject toward Misunderstood by
default rather than freezing the ladder in place.

**The Pulse architecture — already designed for Combat's networking layer,
see `ROADMAP.md`'s Networking & Sync section — is the resolution model here
too, just delayed to the Beat's own zero.** Moves queue live during the
Beat; nothing commits until the Pulse fires. Genuine multi-Player contention
(two Party members both trying to speak in the same window) resolves the
same way Tile-contention already does — first-timestamp wins, sent to the
target; the rest don't vanish, they get the same "rejected, briefly
explained" treatment the Pulse design already committed to ("you started to
speak, but X got there first").

**Mercy rule for bad connections.** "First hit on the wire" can't mean
first-*received*-by-the-server, or the mechanic secretly rewards ping
instead of personality — a Character built entirely around being
fastest-to-respond would be gutted by anyone with worse WiFi. Resolution
needs a short server-side verification window before committing to an
order; running the full Beat out untouched is the honest floor everyone's
guaranteed regardless of connection quality. Same "never visible to the
Player as lag" commitment the Pulse design already made for Combat, applied
to its sharpest possible case.

**Locality reuses the Range Restriction work already queued** (`ROADMAP.md`,
minor mechanical fixes, priority item 5) instead of needing its own system.
Whisper (same Tile) / Talk (one Tile) / Shout (two Tiles) — the same
Tile-adjacency gating Attack/Block Range Restriction needs, doing double
duty. Shout is a real tactical choice, not just a bigger radius — reaching
two Tiles out risks pulling in an Enemy or an uninvolved NPC who was never
part of the conversation.

### Techniques: Shout and Talk-Over, free architecture
Both fall directly out of the existing panel-agnostic Technique engine
(`openTechniqueUse`/`stageTechnique`) — no new plumbing, just new Technique
entries once a Beat exists as a stageable context.

- **Shout** — a toggleable ability, not universally free; drains a resource
  tied to shouting *coherently*. A failed/incoherent shout never touches the
  Information ladder — it dents Loyalty/Respect directly instead. You didn't
  fail to persuade, you scared them.
- **Talk-Over** — lets someone in 2nd/3rd place in a Beat-race override the
  leading answer and become the one that lands. Two Players both running it
  against each other loops into a real, mechanically-emergent stalemate —
  and every bystander NPC watching should have their own Patience/Composure
  quietly draining the whole time, up to the point the Beat just ends, spent
  on nobody. Nobody "loses" in the failure-state sense — the moment is just
  gone, which is the actual sting.

### AP as airtime, not a currency
dDd's framing: "your AP is basically your ability to fill the space you are
presented with, timewise." A Beat's real duration is situational —
DM/Scene-set (a burning building vs. a calm negotiation), not stat-derived —
with a Personality Stat providing a small buff on top, same pattern the rest
of the game already uses (context sets the frame, the build modifies within
it). Rough pacing anchor: ~3 AP per real second — distinct from the
Sequencer's existing needle-sweep, which is decorative, fixed-duration
Combat *playback*, not a literal real-time binding. Worth keeping those
conceptually separate even though they'll likely share the visual widget.

**This gives Dialogue its own Swift/Heavy/Parry-equivalent build split.**
Stoic-and-terse is the Heavy analog — expensive per Move, but each one
really lands. The rambler isn't just "worse at talking" — real mechanical
teeth: **a rambler's actual power is denying everyone else airtime**,
burning the Beat's shared clock so nobody else gets a word in, win or lose
the Information ladder entirely beside the point. A real strategic identity,
and — per the absurdity principle above — a genuinely funny one on its own.

### Personality Stats — riffing directly off the existing Character Sheet
dDd's proposal: don't invent a parallel numbering system from scratch — read
what each existing Combat stat is *actually for*, and find its conversational
equivalent directly. Concretely scoped as **a second Page on the existing
Character Sheet**, not a separate system.

**The "receiving" side — what takes damage.** Wounds/Chunks/Life map onto
**Heart / Stomach / Head:**
- **Heart** (parallels Wounds) — emotional damage. Ties directly to two
  things already on the books: the **Heart Attack** Lava Craft (currently a
  Combat instant-KO tied to Flow — worth reconsidering as targeting Heart
  directly instead, a psychological kill rather than a physical one) and
  **Betrayal Attack** (Combat Panel item I — bypasses Flow's normal defenses
  entirely). If Heart Attack retargets to bypass the Information ladder and
  hit Heart directly, it becomes a formalized Betrayal Attack running
  through words instead of a blade — same underlying idea, two weapons.
- **Stomach** (parallels Chunks) — physical/visceral tolerance. "Just too
  much gore" as its own stat is a legitimately funny, legitimately mundane
  parallel to a very grim mechanic — closer to a squick-tolerance/composure-
  under-horror stat than a combat one.
- **Head** (parallels Life) — logical, "like calculating people." The
  deeper threshold, same role Life plays underneath Wounds in Combat.

**The "acting" side — what deals it.** First pass, not settled:
- **Essence's equivalent.** Essence is Lightning (life/death) + Lava
  (matter/form) + Focus (shared potency). Clean mapping, not a stretch —
  it's the Founding Rule itself landing on the Information/Loyalty split
  already locked in above: **Lightning-conversation moves the Information
  ladder** directly (belief, revelation, deception — Gom's domain:
  accumulation, awareness, control). **Lava-conversation moves the Loyalty
  dial instead** (reshaping how someone *feels* without touching what they
  *believe* — Kulkrow's domain: shaping the relationship-vessel rather than
  what gets poured into it). **Focus's equivalent** — working name
  **Composure**: shared potency multiplier for either conversational school.
- **Form's equivalent** — working name **Presence**: the non-magical,
  physically-embodied force of just being a person in a room. Sub-stats
  parallel Power/Quickness/Range almost exactly:
  - Power → raw vocal/physical force — the stat Shout is actually built on.
  - Quickness → who enters a Beat's countdown first — literally reusable,
    the same entry-tick math Combat's Quickness already runs, just applied
    to Beat order instead of the Global Counter.
  - Range → natural talk-radius before spending a Technique — the baseline
    underneath whisper/talk/shout; Shout becomes a Technique that pushes
    past your own Range rather than a separate magic effect.

**Proposed 4 Technique-tree headers, parallel to Flow Powers/Focus
Powers/Lightning Crafts/Lava Crafts — first pass, not settled:**
- **Presence Powers** (Form-parallel, generic) — houses Shout and Talk-Over,
  both raw physical/vocal acts rather than persuasive craft.
- **Composure Powers** (Focus-parallel, generic) — techniques that work
  regardless of school; holding ground, reading a room.
- **Lightning Crafts** (kept as-is) — Information-moving techniques, same
  header Combat already uses, same underlying Stat investment.
- **Lava Crafts** (kept as-is) — Loyalty-moving techniques, same reasoning.

Reusing Lightning Crafts/Lava Crafts verbatim rather than renaming them is
deliberate — a Character's existing Technique-tree investment already reads
as "this Character has a relationship with this school," and letting
conversational Techniques live under the same checkbox is the literal
fulfillment of this doc's own earlier line: *"a Character accumulating a
repertoire of ways to act in the world... the same philosophy applies to
both."*

### Naming note
"TATA" = **The Architect and The Adversary** (or The Adversary and The
Architect — dDd treats the ordering as interchangeable), the working
replacement for "Dungeon Master," flagged as needing a rename in
`ROADMAP.md`'s Misc section since 2026-08-15. Already live in the UI today
(`TATA Veil Vision`) without anyone having spelled out what it stood for
until now.

### Next (superseded — see the following section)
The two-Personalities-then-a-Scenario plan above was the sequencing as of
that pass. It got overtaken the same night by a more primal rework of the
whole Call/Response shape, below — pick up from *that* section's own "Next"
first.

## 2026-08-17, later that night — Call and Response

A second, later pass the same night, after dDd's own gut check: "we've
overcomplicated things." Everything in this section either replaces or
sharpens the "Beat System" section above — the Stats/Heart-Stomach-Head/
Presence-Composure material there still stands as a first pass, genuinely
just not the active thread anymore. What follows is the active thread.

**Call and Response, not a general Beat.** The atomic unit isn't a shared
multiplayer countdown container — it's one Call, one Response. The clock
belongs to the Response side specifically: how long you take to answer. If
the Responder stalls, the Caller's actual tool isn't to keep waiting, it's
to **push — re-issue the Call, harder if they want, and the clock restarts.**
No new machinery needed for this; a restart just costs more airtime out of
the same AP-as-time economy already established. The Locality/multiplayer
work from the section above (whisper/talk/shout, first-timestamp-wins) turns
out not to need reconciling with this at all — it answers *who's in range to
be part of an exchange*, Call/Response answers *what happens between the two
people actually talking*. Different layers, never actually in conflict.

**Two Pools, colliding — not one Pool per exchange.** A Call Pool belongs to
the Asker (their Goal/Approach/Tone). A Response Pool belongs to the Target
(their Composure, what they're protecting). An exchange is just wherever
they happen to hit each other — which means a Response Pool doesn't belong
to one topic. This is the actual fix for the combinatorial-explosion risk
flagged all the way back at the top of this document: write "deflect" once,
it answers any accusation-shaped Call regardless of Subject, not once per
Subject.

**Pools overlap, three real ways, all worth keeping distinct:**
- **Cross-topic reuse** — one Response-strategy Pool (e.g. deflect-via-
  counter-question: "Take what?" / "Does it matter?" / "Around?") answers
  many unrelated Call-topics. This is the main scalability win.
- **Cross-family membership** — the exact same line can sit in two different
  Pools depending only on what Tone rides on it ("Where'd it go, then?" is
  either a genuine follow-up or an accusation, purely by delivery).
- **Position-agnostic lines** — some lines aren't owned by Call or Response
  at all ("Why would I do that?", "Does it matter?") — valid as either half,
  depending only on who says it first.

**The grammar, distilled from a real worked comparison (four call/response
pairs, analyzed word by word):** every Response is one of two families.
**Answer-shaped** — sounds like it's filling the blank, true or not
("No, it's Alice actually" vs. "My Grandma's cookies" as a confident label
over something actually grotesque) — and critically, **the grammar itself
never marks the difference.** A Deceive and a Reveal can be built from the
identical sentence shape; only a hidden truth-flag on the content, not the
words, tells them apart. **Refusal-shaped** — doesn't fill the blank and
doesn't pretend to ("I couldn't tell you," "Does it matter?"), a genuinely
different family regardless of whether the speaker actually knows the
answer.

**Set Pieces — the actual bracket-level Lego units, proven across a dozen+
worked examples to stretch across Personality registers without breaking:**
`[Stakes]` `[Challenge]` `[Condition]` `[Consequence]` `[Address]`
`[The Ask]` `[Stance]` `[Reason]` `[Quote]` `[Contradiction]` `[Offer]`
`[Tag]`. Concretely proven: "There's a monster out there, are you crazy!?"
and "Considering the odds here, my dear, are you sure that is what you want
to do?" are the *same* `[Stakes]+[Challenge]` template — one panicked, one
composed — read together, plausibly the same Caller's push-and-restart pair
in one exchange, gentle attempt first, escalated second. A Set Piece is
Personality-agnostic structurally; only its *rendering* (the actual words)
is Personality-specific — that's the whole mechanism by which one small
piece-vocabulary can sound like a hundred different people.

**Assembly is its own challenge — "the Thinking Process," via Alphabet
Soup.** dDd's image: Set Pieces aren't a static menu, they're floating and
swirling, some easy to reach, some deeper — and low **Composure** makes good
pieces genuinely elusive (harder to catch, plausibly slower to catch too,
spending real Beat-time out of the same airtime economy). This produces
**two separate failure points, not one** — echoing Flow/Hit% on purpose,
not by coincidence: **Composure** governs whether you can *catch* the right
pieces at all; **Presence** governs whether, once caught, you can actually
*carry/deliver* them. Having the right pieces in hand is no guarantee they
land.

**A held, unsent Set decays.** If a Character has something fully assembled
and ready but hasn't found the opening to send it — because the live
exchange keeps forcing fresh Sets to be built just to keep up — the reserved
Set doesn't just sit safe. It **crumbles, piece by piece, back into the
Soup**, on the same Chaos↔Order mechanism that built it, just running
backward — no new system needed, one process pointed two directions. Gives
Talk-Over and push-and-restart a third, more human reason to fight for an
opening: not just winning a race or rescuing airtime, but getting the thing
you actually came to say out before it falls apart. ("Memory" floated as a
possible name for whatever governs decay rate — genuinely a real candidate,
not fully committed, could also just be Composure wearing a different hat.)

**Pedestrian, not competitive — the most important correction of the
night.** Dialogue doesn't default to a Composure-vs-Composure duel. Most
exchanges are just information changing hands cleanly, no drama required —
"What time is it?" was already proof of this earlier in this document,
Call-heavy and Response-flat because nothing was at stake. The dramatic
machinery above (Alphabet Soup, decay, Talk-Over) is the **escalation
layer**, not the baseline texture — it should only really engage when a
conversation is actually charged.

**A worked dry run** (not reproduced in full here — a man searching for a
stolen ring, three NPCs: one just irritable, one guilty and skilled at
Concealing, one a rambling font of unrelated lore) confirmed the pieces
connect: an accidental Misunderstood from pure Silence, a deliberate one
from a successful Deceive, and a real Talk-Over used against an NPC's
rambling rather than another Player. It also exposed two gaps that
predate the Call/Response rework and are worth re-checking under the new
framing rather than assumed still-open as originally worded: how a Subject
gets switched mid-exchange, and whether "target resisted" needs to look
different from "nothing happened" when both currently render identically.

**The prototype.** [`prototypes/dialogue-line.html`](../prototypes/dialogue-line.html)
— standalone, no dependency on the live game, disposable by design. Tests
the pick-and-place interaction only: a Line per side, the 12 Set Pieces
above as plain labeled buttons (structural placeholders, no authored wording
yet — deliberately, per dDd: *"we actually don't even need to translate them
into Words yet"*), click to place onto the Line in order, click a placed
chip to remove it. A second pass added real bookkeeping on top: a
**Snippet** is one Line/Pieces/mirror pair; an **Exchange** is a named,
saved sequence of 1–10 Snippets (the count box, arrows to page between
them), Save/load round-tripping through `localStorage` since the file has
no backend, and Print producing a plain `Call: [...] / Response: [...]`
text block per Snippet via a native `prompt()` dialog, specifically for
easy copy-paste out of the prototype. No difficulty, no stats, no Personality
filtering on which pieces show — all deliberately still absent, next layer
whenever this base interaction is confirmed to feel right.

### Next
Real open questions from tonight's own gut-check, worth picking up in this
order rather than losing track of overnight:
1. **No resolution rule yet connects an assembled Line to an outcome** — the
   biggest real unknown left standing, not solved tonight on purpose (the
   vocabulary had to exist first).
2. **Whether every Set Piece can pair with every other one, or only some
   pairings are actually coherent** — proven that individual templates
   stretch across registers, never tested whether arbitrary Call-piece/
   Response-piece combinations still make sense.
3. **Personality isn't in the prototype at all yet** — both sides currently
   see the identical 12 pieces; the next layer, once base interaction feels
   right.
4. **Whether a Snippet is always strictly binary**, or a group scene is
   several binary Snippets happening near each other — lower stakes, just
   flagged so it doesn't surprise later.

*(Items 1 and 3 above got real, concrete candidates the following day — see
below. Not fully closed, but no longer standing completely open either.)*

## 2026-08-18 — Pillars, Chemistry, and two new source documents

dDd brought two prepared documents into this session, worked out overnight
and at work: `gomsdu-dialogue-mechanics.md` (structural mechanics — Line,
Set Pieces, Axes, the Four Pillars, Call & Response, Subject/Tags, the Three
Lines, Intent) and `gomsdu-vibe-doc.md` (the tone/philosophy those mechanics
have to answer to — Absurdity as Satire, TATA as authorship-asymmetry, the
Guiding Principle of shared grammar over bespoke systems). A third,
`gomsdu-influences.md`, catalogs pure touchstones (the Ark among the
Philistines, Monty Python's Funniest Joke, Paramatman, the Tata-means-Father
resonance). **All three now live in `reference/` alongside this file**
(`gomsdu-dialogue-mechanics.md`, `gomsdu-vibe-doc.md`, `gomsdu-influences.md`)
— brought in 2026-08-18. One caveat on the Vibe doc specifically, per dDd:
it was written in a chat session without Repo access (private repo, so that
session was working from a snapshot roughly two weeks stale relative to
what's actually built) — treat its *tone/philosophy* content as solid, but
don't assume it knows the current state of any specific mechanic by name.
Influences doesn't have this problem — pure touchstones, not tied to
implementation state — and per dDd, the Dialogue Engine's actual design
mostly took shape in that same chat session, for what that's worth.

**This second pass converges heavily with the previous night's work rather
than contradicting it** — Call/Response, Set Pieces as higher-level
rhetorical postures, and reused-not-parallel systems (Relationships as
literally the same Temporary→Final mechanism as Flow/Focus) all confirm
independently. Genuine new material and resolutions, not just overlap:

- **Fog of War extends a level deeper than Set-Piece perception.** Nobody
  ever sees another Character's raw Set Pieces — only their own inference,
  run through their own Personality and Relationship with the sender. This
  is the actual mechanism behind Misunderstood, not just a narrative
  description of it.
- **Subject-switching, resolved.** `((Noun))` Tags, Topics drifting into a
  new Subject naturally after enough rounds, `[Change Subject] ((New
  Subject))` as the deliberate forced version — directly closes the gap the
  Hovel dry-run left open.
- **Silence vs. Speechless** — Silence is a choice; Speechless is a genuine
  failure, nothing ready and no fallback. A half-built Line at zero gets
  forced through as whatever it currently is, not collapsed to flat Silence
  — a real answer to the other loose Hovel-dry-run thread.
- **The Four Pillars, with Chemistry as the process connecting them, not a
  fifth.** Information (a kit — Local/Global-Retained), Personality (Heart/
  Stomach/Head as domains Axes attach to, not stats themselves — Current
  vs. Steady, Arc/mutability as Static/Sponge/Gambler), Relationships
  (Temporary→Final, reusing Flow/Focus directly). Chemistry: a Personality
  reads a Set Piece's — or its own baseline — combined Axis-position as a
  gestalt, never independently; effects can cascade across Heart/Stomach/
  Head rather than staying siloed, and can reach forward into which Set
  Pieces are even available to send next (the Flow/Hit% shape, confirmed
  showing up here too). Composure and Presence live here as Axes on the
  Personality pillar, not a separate system — practically their own Panel
  in dev until the eventual merge, same pattern already on record in
  `ROADMAP.md` for Combat/DM/Sequencer.
- **The confirmed Axis placements so far:** Compassion (Empathy↔Apathy) and
  Wit (the joke-appreciation Axis) — Heart and Head respectively; Reactivity
  (Reactive↔Nonreactive) — Stomach; Transparency (Open↔Secretive) and
  Consideration (Careless↔Considerate) — Head. Courage (Cowardice↔Bravery)
  was never actually placed — flagged open, leaning Stomach if forced (a
  gut-courage read fits Stomach's visceral character better than a
  cognitive one).
- **Rehearsed Lines and Semi-Conscious both decay, confirmed** — Semi-
  Conscious from holding two ideas at once (small, fast); Rehearsed Lines
  slowly, without active rehearsing (the "lad practicing his line by the
  lake before asking his crush out" image, not a Combat-prep metaphor).
  Committing a Line normally sends it immediately; holding past that point
  is the exception case, mainly relevant when interrupting is live.
- **Set-Piece-type ambiguity is a real, emergent mechanism for
  Misunderstood, confirmed live across the Snippet Library exercise below**
  — a `[Condition]` and a `[Command]` can render similar enough surface text
  that a Receiver infers the wrong one, and since the two don't carry the
  same Axes, the same Line produces genuinely different Chemistry depending
  purely on which type the inference lands on. Per dDd: **deliberately left
  emergent, not curated** — the hope is that a meaningful share of the
  Vibe Doc's target "wry acceptance" feeling comes from exactly this kind of
  unforced overlap once the system is built out, not from authored jokes.
  Four separate instances of it surfaced across the first six quotes tried,
  completely unprompted — see [dialogue-snippets.md](dialogue-snippets.md).
- **Mind Reader — the answer to "does the Caller ever find out their Line
  was misread."** By default, no — Fog of War stays intact, same
  hidden-by-default principle as TATA itself. Proposed as a real Technique,
  not new architecture: spend 1 Lightning from Attunement outside Combat to
  see ground truth for one exchange — what was actually sent, what was
  actually received — piercing the fog for whoever invests in it rather
  than leaving it a permanent blind spot for everyone. Reuses Attunement's
  existing non-Combat refill role and Lightning's already-established
  Information-moving domain; no new resource or mechanic required.
- **The Snippet Library launched** — [dialogue-snippets.md](dialogue-snippets.md),
  companion to `gomsdu-influences.md` but scoped to the Dialogue Engine
  specifically: real, well-known lines decomposed into Set Pieces and Tags,
  kept as a running proof the grammar holds up against language nobody
  wrote for this game. Meant to launch alongside the Dialogue Interface
  itself. Two quotes dDd ran independently through the same process still
  need to be added.

### Corrected from the previous pass
The Vibe Doc's Quick Self-Check point 4 is **amused** Surprise → amused
Realization → amused Wonder specifically, not Wonder in general — Surprise's
flavor can vary Player to Player, but Realization should converge on
recognizing the ridiculousness for what it is. Worth re-checking anything
evaluated against the old wording (e.g. the TATA/authorship-ambiguity
scenario from the logic-check pass likely sits in a different, non-amused
emotional register entirely — not a failure, just a different mechanic with
its own honest arc, per dDd's own read).

## 2026-08-19 to 2026-08-20 — The pivot to Wimbis: building the Language for real

Everything above this point is the Dialogue Engine's own design track — Set
Pieces, Call/Response, the Four Pillars. This section is a pivot away from
it, not a continuation of it. dDd's own framing: "Human Personalities and
English is sort of dense and abstract, it was a lot to think about...
instead of doing that, I just went to the start, with Gom and the Living
Stone." Rather than keep forcing English into a game-mechanical grammar,
the new goal is to build **Wimbis** — the world's own Language — as a
real, internally-consistent system first, with English demoted to a
translation layer for the player rather than the thing being formalized.
Also, per dDd: a language he's personally wanted to design for two years,
now folded directly into the game rather than staying a side project.

### The toolchain — `language/`
Four files, self-contained disposable-prototype HTML/JS in the same style
as `prototypes/`, sharing one data file:
- [gomsdu-glyphic-system.json](gomsdu-glyphic-system.json) — the actual
  language data: Primitives (reusable geometric shapes), Words (sound +
  meaning + a Glyph composed from Primitives/other Words via position/
  scale/rotation), grammar rules, and a dated correction log with the full
  reasoning behind every fix — fuller detail than reproduced here.
- [gomsdu-glyph-viewer.html](gomsdu-glyph-viewer.html) — renders every
  Primitive and Word directly from the JSON.
- [gomsdu-glyph-arranger.html](gomsdu-glyph-arranger.html) — click Words
  and Markers to build a stacked Totem (a sentence), Transliteration and
  Translation building live underneath, full linear Undo.
- [gomsdu-glyph-designer.html](gomsdu-glyph-designer.html) — a point-and-
  click grid tool for drawing new Primitives (straight lines only, matching
  the writing system's own in-world constraint — "Gom can only draw
  straight lines"), plus a full Word editor (compose from existing
  Primitives/Words, adjust position/scale/rotation, live preview, manual
  JSON edit). Supports direct local-disk saving via the File System Access
  API (Chrome/Edge) — connect the real file once, Save writes straight
  back to it, no download-and-move step.

### What the Glyphic System turned out to be
- **Logographic, not alphabetic** — a Glyph is a whole concept, composed
  geometrically, not spelled out phonetically. Closer to cuneiform/hanzi/
  hieroglyphs than to an alphabet.
- **The same shape does grammar by rotating.** One `chevron` Primitive: an
  arrowhead on KUL/OG, a presence-marker completing KROW/GOM (empty
  container vs. animated), a relation when two overlap (WIM), a stacked
  pair at different scales (BIS). Rotation/scale/position *are* the
  grammar — the same "shared grammar over bespoke systems" principle the
  Vibe Doc already commits to for the game's mechanical systems, found
  again independently at the language layer.
- **Reading is vertical; horizontal carries no grammar.** A sentence is a
  **Totem** — a stack read top to bottom, markers (`ownership-line`,
  `next-idea-line`) declaring the relation between what's above and below.
  Totems can **branch** (one column forking into two, each still strictly
  ordered), and a **Connector** lets a Totem's bottom link to an adjacent
  Totem's top purely as a physical-space workaround, no grammar attached.
  BIS read backward as SIB is equally valid — horizontal mirroring is
  cosmetic only.
- **The system describes itself, natively.** GI ("a Word," one Glyph),
  GeKA ("a Diglyph," two), GeKARAP ("a Triglyph," three) are real Words
  the language uses to talk about its own units — not English labels
  bolted on. GI sits at the Center of a five-point grid (Center plus four
  outer positions); GeKA/GeKARAP occupy combinations of the four outer
  ones. ZON ("Self") turned out to be the outline connecting those same
  four positions, Center empty; ZIN ("I," Crystal Being secret
  translation "Heart") is the same outline with the Center — GI itself —
  filled in. Same completion-marks-presence rule KRO/KROW and GO/GOM
  already used, rediscovered applying to Self.
  **Retcon, next session, per dDd:** ZON is also, concretely, a Crystal
  *Structure* (built, physical) and ZIN a Crystal *Being* (a person) —
  the same empty/filled grammar read literally at architectural scale,
  not a contradiction of the Self/I reading above. Crystal Beings build
  everything out of ZON, including the structures used to make more ZIN.
  Full write-up, including the worked "GI KA M-/W- CROW" infusion
  construction this came from, now lives in `gomsdu-codex.md`'s
  "Language as the Animating Gate" section.

### Second Era: Crystal Beings, and the shape of their elitism
Per dDd: in the First Era, "I" existed only as GI, a full Word and nothing
more. The Second Era is when GI additionally gains a function as a
Primitive — the exact moment the Crystal Beings connect it to the wider
position-grid pattern and build ZIN/ZON. Most people in this Era were Mud
People (Gom's own creations, mirroring Kulkrow's Molten Ones) without a
Heart; ZIN/ZON were introduced as a genuinely unifying act, teaching
everyone they had more self-awareness than assumed. The Crystal Beings
knew what Language had already done to the First Era's people (see
`gomsdu-codex.md`'s new cosmology section, below) and were trying to make
that erasure impossible to repeat — but folded a second, secret meaning
in underneath the public one anyway, reserved for the only beings who
actually have a Heart (a Rainbow Sliver). Per dDd, plainly: "basically a
form of Elitism." Made literal in **WIMZIN** ("Perfected Language") — the
Crystal Beings' own refinement of **WIMBIS** (Language itself, renamed
from the placeholder id LANGUAGE) with GI ("Soul") added beneath it,
oversized. Ordinary Language, plus the one thing the original was built
to strip out.

### New cosmology, `gomsdu-codex.md`
Two additions this pass, cross-referenced rather than repeated here:
**Yom** ("Star Father") named as the Sun-being, and a new section, "Sound
and Shape, and the Name that never formed" — the missing answer to the
Codex's own long-standing open question about what "flipped" between
Kulkrow waking first and Gom ending up devouring everything. Short
version: Sound and Shape both predate Gom, inherited from Yom; Gom's
Black-Hole nature (his body is whatever falls inside his Event Horizon,
at every scale) is what closes over Kulkrow's true Name the instant
GOMGOM shows him what a Name can do — not a premeditated plan, an
inevitable one.

### Current status
19 Words, 12 Primitives, First and Second Era material both represented.
Vowels not yet worked out. Third Era ("the real goal," per dDd) not yet
started. **Nothing here is wired into actual game mechanics yet** — no
Character field checks which Glyphs someone knows, nothing gates dialogue
on it. The natural hook already exists, unbuilt: WIMBIS/WIMZIN's public/
secret duality is structurally identical to the Information ladder and
Fog of War already designed above for Call/Response (Unknown → Rumored →
Confirmed → Misunderstood) — "who has access to which Glyph" could plug
directly into "what does this Character know" whenever this thread and
the Dialogue Engine thread above it meet back up.

### The Composition format turns out to already be a Call/Response graph
2026-08-19, same day as the pivot above, later still. The Arranger gained
a 9-Expression grid (3 rows of 3) plus `follow-N-line`/`goto-N-line`/
`wildcard-above-line`/`wildcard-below-line`/`yield-line` markers — added
for a creator-requested exercise, not designed with Dialogue in mind. The
first real Composition written in it (three parallel openings converging
through one shared gate, forking into three outcomes, one reversed because
a different subject performs it) turned out to be structurally identical to
a branching dialogue/ritual graph: multiple Call-equivalents funneling
through a shared checkpoint into multiple Response-equivalents, with
`yield-line` marking a terminal outcome per branch. This is the concrete
version of the "natural hook" flagged just above, arrived at from an
entirely different direction — the Composition format doesn't need a
separate branching system layered on top for the Beat/Call-Response work
above; `follow`/`goto`/`wildcard`/`yield` already give the Language itself
a graph shape, unprompted by anything in this document.

**Cross-reference:** `gomsdu-codex.md`'s new "Language as the Animating
Gate" section documents what that specific worked Composition actually
said, narratively (Gom's verbs on Life stay uncompleted until they cross
GI, the Word; Kulkrow's Kill reverses exactly that). This section is about
the graph *shape* the exercise revealed, not its content — genuinely
separate payoffs from the same eleven lines of JSON.

## next session — Wimbis confirmed as Dialogue's real engine; Head/Information/Behavior; naming cleanup

A large batch of answers landed at once, responding to a full synthesis pass
across every reference doc's open threads. Per dDd: today's Notebook is
cleaner than whatever's already documented here and wins on any conflict.
**Attack order for what gets picked up next, per dDd's own instruction:
Personality System, then Composition-to-Behavior, then the Mechanical
Fixes** (see `VISION.md`'s matching addendum for the full context).

**The Big One — Wimbis is confirmed as Dialogue's real engine, not a
parallel discovery sitting near it.** Per dDd: "WIMBIS is the result of all
that [Second Era Crystal Being] experimentation, the answer to it. It'll
have everything to do with Dialogue since it's the only way to Communicate
in World (Actions, Sounds, Thoughts, Writing)." The "Reverse Engineer It to
English" principle stays the standing approach — English is still the
translation layer handed to the Player, not the thing being formalized.
This settles the question the previous "Composition format turns out to
already be a Call/Response graph" section left open: Wimbis's own grammar
*is* the branching-Dialogue mechanism, not a candidate for it.

**Head → Information → Behavior, confirmed, with a concrete downstream use.**
Per dDd: "Head to Information (Expressions or Compositions right now).
That information informs Movement on the Map and choices in Combat
(recklessly attacking for example). Information can be Orders." This
confirms the connection flagged (undocumented) earlier this session —
routing a Character's Behavior through Composition/Expression via the Head
domain is real, not speculative, and it's the second item in the attack
order above ("Composition to Behavior").

**Personality complexity is Era-gated, by design.** "First Era Beings only
need Head; no Heart (Second Era) or Stomach (Third Era), which reduces the
complexity of creating the rest of Personality Sheets with intentional
constraint for that Era." A real, load-bearing scoping tool — First Era
Character work (Living Stone, Molten Ones, Mud People) never needs the
full Heart/Stomach/Head build, only Head.

**Naming cleanup, per dDd's own sidenotes:**
- "Personality" is deliberately used both as the umbrella term for the
  whole build *and* as the name of one of its own Four Pillars
  (Information, Personality, Relationships, Exchange) — accepted
  redundancy, not an error. The old placeholder name for the umbrella
  concept, "Non-Combat Stats," is retired as "a terrible name choice."
- **Character, defined:** anything with a Stat Sheet — of which there are
  two, Physical (essentially done — the existing Combat/Stats system) and
  Personality (the new parallel build). Applies uniformly to Players,
  Mini-Party members, Enemies, and NPCs — there's no separate "NPC" data
  shape, just another Character.
- `personality-pillar.html` being redundant with the unified Personality
  framing is confirmed fine, not a problem to fix — "The 4 Pillars and
  Chemistry are going to be coming up soon" as real near-term work.

**Dialogue Engine open threads, resolved by redirection rather than answered
directly** — per dDd, several of `gomsdu-dialogue-mechanics.md`'s standing
Open Threads aren't independent design questions at all, they're outputs of
the Personality/Language builds once those exist, not separate problems to
solve first:
- Axes/Axis/Ax will be directly associated with Glyphs, not a parallel
  English-side taxonomy.
- The Personality reaction-scoring rule, ripple-effect mapping, and
  Sponge-drift rate are all "dependent on Personality" — they fall out of
  the Personality build, not a separate formula to derive in the abstract.
- Set Piece pairing-coherence is "dependent on Language" — Wimbis's own
  grammar decides what combines, not an independent English-side rule.
- The Line-to-outcome resolution rule is "connected to the Map and
  Personality" — same redirection.
- Rehearsed Line repetition is explicitly deferred — "not an immediate
  concern, Third Era stuff."
- The "whether a Snippet is always strictly binary" open thread is
  dropped per dDd ("we can delete the stuff about Snippets") — no longer
  worth tracking.

**Blocked items, updated:**
- Navigation resolves simply — "a Drop Down Select somewhere on the Main
  Game Screen," no bigger location-graph system needed.
- Axes/Axis/Ax genuinely wait on Personality and Language settling first
  — confirmed, not reopened.
- TATA stays on hold until NPCs exist to work with — confirmed, not
  reopened.
- "Interaction authoring format" wasn't recognized as posed ("I don't know
  what this is about") — needs a concrete example next time it's raised,
  not just the abstract description above.

## 2026-08-22 — The Universal Characters Table, and Glyphs as the game's one true primitive

Surfaced while chasing what looked like a small bug (`targetSide: 'ally'` on
Techniques resolving to an absolute "the Player-controlled roster" instead of
something relative to whoever's actually Crafting — see `ROADMAP.md`'s
Techniques Panel section and `CHANGELOG.md` 2026-08-22 for how it was found).
dDd's own trigger, worth preserving: *"If Gom is an NPC than how can the
Player be a valid target of that? They wouldn't be allies, according to what
is going on with game logic."* Chasing that one question all the way down
produced the fullest architecture statement yet — per dDd, *"Let's take a
second to stand all this up, since it informs all the Gameplay decisions we
are taking going forward."* Nothing below is built yet; this is the
foundation the eventual fix (and a lot else) has to sit on.

**The Universal Characters Table.** Extends "Character, defined" from the
previous session's section above (*"anything with a Stat Sheet... applies
uniformly to Players, Mini-Party members, Enemies, and NPCs — there's no
separate 'NPC' data shape, just another Character"*) from a conceptual
framing into the actual data layer: **one single Characters table, full
stop** — not `table.players` and `table.enemies` as two separate structures
the way the engine currently splits them. Players aren't a separate category
either, per dDd: *"Same thing with Players... that's really just another
Character on a Universal Table."*

**Ally/Enemy is strictly a Combat concept — not a permanent structural
split.** Per dDd: *"Enemies and Allies is strictly Combat."* Outside a Combat
Encounter, "which side" something is on doesn't meaningfully exist as a
category at all — it's not that every Character defaults to neutral, it's
that the concept itself doesn't apply. This is the real answer to the
`targetSide` question: `'ally'`/`'enemy'` were never supposed to be
permanent tags on a Character, they're a Combat-scoped relationship.
**Explicitly left open by dDd, not resolved here**: whether that Combat-scoped
relationship lives as separate connected tables, or as a key/tag on the one
Universal Characters Table — *"Separate connected Tables or a Key in the
Universal Table is an open question."*

**Factions/allegiances are the same kind of fleeting, per dDd**: *"Factions
are temporary. Allegiances and all that are fleeting in the Game. Maybe
permanent for an NPC, but it's just a tag really."* Not a rigid structural
category anywhere in the data model — at most a tag that happens to hold
steady for some NPCs specifically, never a schema-level split.

**Active Character, reconfirmed as a temporary state on a Universal
Character, not a type.** Per dDd: *"Active Characters are a temporary state
that comes and goes round to round while Tata. Always the Player [outside
Tata]. But that's really just another Character on a Universal Table."*
Matches exactly how the 2026-08-22 first pass (see `CHANGELOG.md`) was
already scoped — this just confirms the data-model reasoning underneath it
was the right instinct.

**The big unlock: Characters + Information already explains all of this, and
it's the same engine already running for Movement.** Per dDd: *"All of this
is going to be handled by Characters and Information. Personality and
Behavior works with that. It is going to decide the autonomous Behavior,
which we've already got working for Movement. That'll work in Combat and
Non-Combat the same."* Concretely: **Fast Attack vs. Block are not a
different kind of thing from Move Forward vs. Stand Around** — per dDd,
*"they are both different Glyphs, memorized Information that enables the
Character to perform emergent patterns from constrained data. Personality a
factor in it all."* The exact `computeBehaviors()`/`rollBehavior()` machinery
already built and verified for autonomous Movement (`js/behaviors.js`,
`js/noncombat.js`, see `CHANGELOG.md` 2026-08-22) is the intended engine for
Combat action selection too, not a separate system to build later — this is
the concrete, load-bearing form of the "Composition-to-Behavior" thread
`VISION.md` and this doc's own previous section already flagged as real
("Head to Information... that information informs Movement on the Map and
choices in Combat").

**Glyphs are the one universal primitive — Combat, interaction,
communication, and movement are all the same underlying thing wearing
different clothes.** Per dDd: *"The universal things are Glyphs, which make
Combat possible, interaction possible, communication, movement."* Every
current hardcoded UI button — Fast Attack, Strong Attack, Block, Move,
Craft, all of it — is really standing in for a Glyph a Character has to
actually **know** (have memorized, the same Mindeye mechanism Information
already uses) before they can do it: *"You know how we have buttons right
now? Those all turn into Glyphs, which need to be taught to a Character via
WIM."* Nothing today gates any button on Glyph-knowledge — this is a real,
not-yet-built implication for every existing Technique/Attack/Move control.

**WIM — the teaching primitive, self-referential by design.** Per dDd: *"If
a Character knows WIM, they can use WIM to teach other Characters WIM, and
with WIM teach what they already know (how to move, attack, block)."* WIM is
itself a Glyph/concept — a Character has to know WIM before they can teach
*anything*, including WIM itself to a third Character (the bootstrap case),
and once known, WIM is the general mechanism for propagating any other Glyph
a teaching Character already has (movement, attack, block, ...) to whoever
they're teaching. **This is why the earliest Glyphs skew primitive/Religious
in theme**, per dDd: *"That leads to more advanced concepts, hence why the
Glyphs focused on primitive Religious ideas relevant to what will be
available on the Game Map and in the Lore."* — they're the foundational,
bootstrappable vocabulary the whole civilizational teaching-chain has to
build up from, which lines up directly with scenes.md's First Era Legend
entry (Living-Stone Personality clusters, Gom/Kulkrow roaming and presumably
being the first real teachers).

### Follow-up, same day — WIM's real mechanics, Writing vs. Speaking, and the storage-shape decision

**WIM exists because it's literally what Gom is using.** Per dDd: *"WIM
exists cause that's what GOM is using. He's presenting information directly
with the directions."* Directly ties WIM to the existing 4 Direction
Glyphs/engraving mechanism already live in-game (Move Forward's RO/OR, etc.)
— Gom teaching a Living Stone to move *is* WIM in action, not a separate
future system layered on top of it. **WIM's meaning widens to Speech and
Communication generally**, not just the narrower "names the teacher-pupil
relationship" reading the Glyph data previously flagged as advanced-for-later.

**For Living Stones specifically, WIM is mostly received, not spoken — "a
Laser Engraving Memory."** Per dDd: *"A pair or group of Living Stone can
come together to use WIM physically, but mostly it's a Laser Engraving
Memory to them."* Real, active, physical WIM-use between Living Stones is
possible but rare/secondary — matches the already-established lore that a
Living Stone "can act and 'think' via Gom's engravings but cannot originate
direction, only receive it." Answers last turn's open question (1): First
Era Living Stones don't generally *learn via WIM* the way a fuller
teacher-pupil exchange implies — their baseline capability mostly arrives as
a received engraving, from Gom, not peer instruction.

**A real new mechanical axis: Letter/Mark composability is gated by
Biology, separate from simply "knowing" a Glyph.** Per dDd: *"It's about
their Biology. A Stone might know W, but not M. Even if knows both, they are
very unlikely to be able to do anything with WM together, cause they won't
have I. That's related to Vibration, which the Crystal use to make their
Harmonic Language."* So knowing individual Marks (the Chevron's W/M
orientations) doesn't imply the ability to *combine* them — a Character's
own biology caps which combinations are even physically expressible, and
"I" (GI, Vibration) specifically is Crystal-Being territory, not Living
Stone. This is a second gate on top of "does this Character know this
Glyph" — worth keeping distinct once Glyph-gating gets built for real, not
collapsed into one flat yes/no.

**Mindeye vs. Sonic is the Writing/Speaking split — dDd's own reaction:
"That is huge."** Per dDd, expanding on "Mindeye and Sonic stuff is
slightly different (basically just a reskin, but there is some neat Logic
behind it)": the two aren't just a cosmetic reskin of the same mechanic,
they map onto **Writing vs. Speaking** as the two channels Language actually
travels through. Not fully specified yet — flagged here specifically so
it doesn't get lost before the "neat Logic" behind it gets unpacked for
real in a future session.

**Four new First Era Glyphs adopted**, from dDd's own direct hand-edit of
`language/gomsdu-glyphic-system.json` (now the project's live copy): `SUU`
("Stop"), `KULOG` ("Find / Hunt"), `KALAG` ("Explore / Wander" — composition
currently just the bare `cross-core` primitive with no distinguishing Marks
yet, reads as still in progress, not treated as a bug), `YO` ("Reference to
Star Father"). No lore attached to these in the file itself — worth folding
in whenever dDd has more on them.

**The migration approach, settled: merge feature by feature, not a
rewrite.** Per dDd: *"We will keep both, merging feature by feature... It's
mostly about getting these foundational ideas into a practical working
state."* Concrete worked example, Movement specifically: *"Plotting Moves
works great. Suppose a Character only knew RO? They could only move closer
to the row, but be unable to move to the proper column. That would get
factored into the Line logic."* I.e. a Character's actual pathing options
should eventually be constrained to only the axes their known Glyphs cover
— and that constraint is meant to run through Wimbis's own Line/grammar
machinery (the Arranger's follow/goto/wildcard/yield markers), not a
parallel, Glyph-unaware pathfinding rule bolted on separately. Direct,
concrete next step once Glyph-knowledge gating is real: `behaviorStep()`/
`computeReachable()` (`js/map.js`) would need to know which cardinal
Glyphs an actor actually has, not just resolve every direction as
universally available the way they do today.

**The storage-shape question — delegated to Claude, decided.** Per dDd:
*"You let me know. That's your Domain... whatever is going to cause the
least headache for us both down the line is what makes sense to me."*
**Recommendation: don't migrate the storage layer yet — build the Universal
Character as a logical/virtual layer on top of the existing
`table.players`/`table.enemies` split, not a literal merge.** Reasoning:
`table.players[id]`/`table.enemies[id]` lookups are threaded through roughly
15 files (`combat.js`, `dm.js`, `map.js`, `techniques.js`, `possession.js`,
`noncombat.js`, `utils.js`'s `resolveEntityRef`/`alliedActorIds`, and more)
— collapsing them into one literal structure now would be a sweeping,
high-risk, all-at-once rewrite, which is exactly the opposite of "merge
feature by feature." The conceptual fix (every Character is uniform,
Ally/Enemy is Combat-scoped, targeting is Crafter-relative) doesn't actually
require changing *storage* — it requires new **functions** that treat the
existing split as one logical space: an `allCharacters(table)` that reads
across both buckets, and a Combat-scoped relationship check (only meaningful
while `table.inEncounter`, per "Enemies and Allies is strictly Combat") that
Techniques' `targetPoolIds()` can call relative to the actual Crafter
instead of a hardcoded Player-roster assumption. This becomes the first real
proof point for "merge feature by feature," and a literal storage migration
stays available later if something concrete ever actually needs it — not
committed to now on spec.

## 2026-08-23 — The 4-stage Memory lifecycle, Ideas as Axis-loaded Expressions, and Target identification across Eras

Grew directly out of playtesting the new Personality Panel Plan section (see [ROADMAP.md](ROADMAP.md), Personality/Behaviors section, and [CHANGELOG.md](CHANGELOG.md) 2026-08-23) — dDd noticed the earlier Innate/Received/Known Category proposal from that session was basically re-deriving something already half-designed, then handed over the real spec. Nothing below is built — per dDd, explicitly: "This is mostly to illuminate how it can grow from what we are implementing here," acknowledging scope directly rather than asking for it now.

### The 4-stage Category lifecycle

**Corrected 2026-08-23, same-day questions pass — this is a single continuous 0-100 stat with threshold bands, not four independent boolean-flag combinations.** The first pass at this (immediately below, in the original wording) read as separate flags per Category; dDd's follow-up clarified the real mechanism is simpler and more elegant than that: every piece of Information carries one numeric Retention-style stat, and Category is just which band it currently falls in:

- **1-25 → Fleeting** (= "Received"). Just arrived, nothing reinforcing it yet.
- **26-75 → Retained.**
- **76-99 → Known.**
- **100 → Perfected** (the word dDd actually meant throughout — "naturalized" in his first message was an earlier draft word written before he landed on "perfected," not a second distinct flag; there's no separate `naturalized` concept).

**The stat decays naturally over time** (drifts down on its own, unmodeled rate — not yet specified) **unless reinforced**, and can be **actively attacked** — **by the Character themselves, on their own Memory, not an enemy's** (corrected same day, first pass here mistakenly read it as a hostile PvP action against someone else's Information). Per dDd: "You can attack a Memory (S is for Attacking, which has double feature like KA, for Physical and Mental) which will weaken it." `S` is a Glyph with the same Physical/Mental duality `KA` already has — Physical-S presumably the existing literal combat Attack, Mental-S a Character deliberately weakening *their own* held Information (willful forgetting, making room, shedding something no longer wanted). Not built.

**`born` is real and separate from the climb entirely** — "Born being Born with it, learned in the Womb, pure instinct." Not a value on the 0-100 stat at all; a Character either has something from birth (skips the climb, presumably reads as Perfected/protected from the start) or doesn't and has to climb the stat like everything else.

**Reaching Perfected (100) via the climb is a one-way door, per dDd**: "Imprinting should only be able to be removed by advanced means (like a Technique designed for it). It wouldn't be subject to getting forgotten or downgraded in the Hierarchy." Both paths (born-with-it and climbed-to-100) converge to the same protected end state — natural decay and Mental-S attacks stop applying once something is genuinely Perfected; only a dedicated future Technique could undo it.

**`heard` stays out of scope until Second Era** (Kulkrow's Sonic Glyphs) — per dDd, confirmed, with one caveat: "there may be a really primitive attempt with Kulkrow and Molten Ones, but that is definite stretch territory." Don't build toward it now.

**Real mechanical payoff, confirmed**: "using KA on a Glyph changes it from Fleeting to Retained. If that doesn't get done, it might become forgotten." This is KA's long-flagged Mental half (Contemplation) getting a real definition — and it directly answers the open "tiered forgetting" question from the knownGlyphs/mindeye merge (2026-08-23 earlier the same day, see ROADMAP.md): forgetting-priority is the inverse of the Retention stat, not a separate mechanism. The existing capacity-based `deliverMindeyeEntry()` FIFO (js/utils.js) doesn't read this stat at all yet — today, everything is effectively Fleeting for eviction purposes.

**What actually pushes the stat from Retained toward Known (`studied`) is a genuinely open question, tied to a bigger undesigned thread** — per dDd, directly: "Just a lot of really intense study? Something practical? It's an open question actually. I've wanted there to be a progression system for a Living Stone Player in the First Era. That just hasn't gotten designed yet. We can pick this up together again." Don't guess at this — it's waiting on a real Living-Stone-progression design conversation, not just a missing number.

### Directions/Actions/Targets/Ideas — the Variety axis, refined

- **Directions** confirmed as the rename over "Movement" — dDd's own reasoning: "the Character is conducting Movement, but they are following Directions to reach their Target." Movement is the *Behavior* (the act); Directions is the *Information* (the memory that guides it). Distinct from the Movement Behavior *column* name, which isn't being renamed — same word, two different taxonomies, worth staying deliberate about not conflating.
- **A real composition fact, logged not yet acted on**: "the Arrows are Chevrons and KA" — the 4 Direction Glyphs are structurally composed of a Chevron primitive plus a KA component. Ties into the still-open Diglyph/Triglyph "emergent from components" thread (ROADMAP.md, Personality/Behaviors) — Direction Glyphs may already inherently carry a KA-component as part of their own composition, not something layered on separately.
- **Target and Idea can be interchangeable, KA as the connector** — dDd's own proposed starting point ("I might start there"): KA links two Glyphs "in the Head" (an internal, Personality-side association) *unless* the KA-Action is pointing at an NPC, in which case it's the already-built external Maintain Empower instead. Confirmed this doesn't conflict with anything already built ("it doesn't break any Behavior... Gom can give some Movement first, some KA first, some his own Glyph first").
- **Gom's own Glyph is deliberately dual-typed** — "Gom is Religion and a Character, so a dual Glyph (cause he can be an Idea or a Target, which they can already be either anyway)." Not a special case exclusive to Gom — any Glyph may be ambiguously both Target and Idea; Gom's is just a clean, confirmed example (a Character people can also hold as a *belief*).

### Ideas, confirmed (answers to the 4 questions asked earlier the same session)

1. **Still a Glyph** — but "an Expression or Conditional would be a better way of thinking about it." Example given: Gom's own Life-giving/taking (the Current toggle) *is* a concrete Idea. A second, more exploratory example (a right-arrow vs. left-arrow Emotional preference, tied into an Expression about a "charged" Glyph — dDd's own term for something like a Gom Glyph carrying heavy association) — flagged here as genuinely early brainstorming, not a settled mechanic; don't build toward that specific example without checking in again.
2. **Confirmed exactly**: Ideas are "loaded with Axes" — specifically designed to shift Attachment/Desire and ripple through Personality. Mechanically, this may already be substantially available — `js/scripts.js`'s "Give Memory" tool already lets any Mindeye entry carry `attachment`/`desire`, which the Relationships Panel already reads. Worth checking, when this gets built for real, whether "Ideas" needs new mechanism at all versus just recognizing/naming what already exists (same pattern Received/Known turned out to follow).
3. **Target Glyphs, per-Era**: First Era is deliberately sparse — only Kulkrow, Living Stone, and Gom exist, and Living Stones can't individually identify each other except by physical Marking (a literal Chevron carved into a Stone, on any face — directional variants not yet added to the Glyphic System file). Second Era: Crystal Beings use Numbers. Third Era: real Names (full Expressions), pioneered by Crystal Being royalty specifically — "though they might be considered meaningless by the people who have them, cause of how much more involved Glyphs are in their time." Third Era's richer Idea-propagation comes from Characters finally having Heart and Stomach (not just Head), unlocking new Emotions/Axes.
4. **Confirmed**: not every Category is meant to apply to every Variety (an "Innate Idea" reading strange was the right instinct) — dDd's own words: "that was the design. Silly oversight on my part, good catch."

### Questions-pass answers, same day — Variety's two tables, KA as a discovery roll, and half-remembered Scripts

- **Variety is two separate tables checking each other, not one.** Per dDd: "Glyphs have varieties, which are what they are capable of being expressed as. A Character might not actually know that though, that a Glyph can be used a certain way. Seems like two Tables checking each other; potential Variety for the Glyph, Variety understanding of Character." Table 1 (objective, game-data): which Varieties a given Glyph is *capable* of expressing as — a Glyph can plausibly have more than one. Table 2 (subjective, per-Character): which of those potential Varieties this specific Character actually *understands* — genuinely incomplete, something to grow into, not derived automatically from Table 1. This is the real reason Gom's Glyph reads as "dual" (Idea and Target) without needing a special case — it's just a Glyph with two entries in Table 1, and any Character who's only grasped one of them has a real, meaningful gap versus someone who's grasped both.
- **KA-contemplation is a probabilistic discovery roll, not a guaranteed connector.** Per dDd: "It's kind of like fishing maybe? The Game has to have something stored to give them. There is a chance they will figure it out when they use KA (to think about it), but maybe they won't. Could unlock a new Behavior, a new Emotion, a new Glyph, a new Script (which is an Expression or Conditional ready to go [like you find all 3 Glyphs and realized how they are connected, now you can go talk about it]). Those are all supposed to reinforce each other." This directly answers what the "KA connects Target and Idea Glyphs" idea (above) actually *produces* on success — not passive metadata tagging, a genuinely new usable thing (a new Behavior/Emotion/Glyph/Script), gated behind a real chance of failure. "Those are all supposed to reinforce each other" — unlocking one is meant to feed the odds or availability of the others, not fully specified yet.
- **Multi-Glyph Ideas can be half-remembered, and that's a real, meaningful state — not a bug to prevent.** Per dDd: "The Glyph could be forgotten. But that whole Expression or Condition can be thought of as a Script. So you can have a half-remembered Script, which means you still have the entire Script, [even] for forgot (or never knew!) some of the Glyphs." Confirms per-Glyph Retention tracking is real (individual Glyphs inside a multi-Glyph Idea decay/climb independently) while the Script itself persists structurally as a container, blanks and all. dDd's own worked example, a real intended playstyle: "someone obsessed over an Ancient Scroll, trying to put the pieces together at the end of the Third Era. He goes all over the Land, seeking Glyph Archives. His Scroll contains an equally Ancient Composition, and he knows it Glyph for Glyph by Heart, but only the Shapes. The meaning he has to figure out, scouring the land for Characters or Writings with the answers." Knowing a Glyph's *shape* (it exists, here, in this sequence) without its *meaning* (which Variety-understanding from Table 2 above would supply) is exactly this state — a genuinely different kind of "known" than fully grasping it.

### Logged, not built — "just so this is on paper"

**The Directions/Movement Behavior should queue**, so a Character with a real Target (destination) can path there across as many Rounds as it takes, rather than one direction-pick per roll. The Player's own Move Order already carries a multi-Tile path across Rounds (js/map.js/js/noncombat.js) — worth checking whether that same mechanism generalizes to Behavior-driven movement once this gets picked up, rather than building a second, separate path-carrying system.

## Closing framing

The goal was never to simulate an infinite conversation — that's the LLM
freeform-text trap this design deliberately avoids. The actual, achievable
goal: simulate an infinite number of ways *this particular Character* might
express themselves. Bounded, authorable, deterministic, and still feels alive.
