# Wimbis, the Universal Characters Table, and the Memory Lifecycle — Design History

**Trimmed 2026-08-25 — was 1130 lines, cut to this.** dDd's own catch, reading back through the docs during this Assessment: "do you really need 1130 lines in dialogue-system.md? More than half of that information is useless." He was right almost exactly — the original file opened with ~640 lines of the old English Set-Piece/Call-Response Dialogue Engine (a 2026-08-16 ChatGPT brainstorm, "The Beat System," "Call and Response," and "Pillars, Chemistry"), all of it superseded the moment Wimbis was confirmed as the real Dialogue engine below. Same category of content as `gomsdu-dialogue-mechanics.md`/`gomsdu-vibe-doc.md`/`dialogue-snippets.md`, already deleted the same day for the same reason — cut outright here too, not summarized, per dDd's own standing view on this kind of material ("we've moved beyond them... zero consequence"). What's left is everything genuinely load-bearing: the Wimbis pivot itself, the Universal Characters Table, and the 4-stage Memory lifecycle — all live, all cited elsewhere in `ROADMAP.md`/`CHANGELOG.md`.

**TATA, mentioned a few times below, is retired as of 2026-08-25** — see `ROADMAP.md`'s Dungeon Master Panel section. Yom, a real Character who can take Direct Control of any NPC, is the actual replacement. Left as accurate history where quoted directly, flagged inline where it'd otherwise read as current.

---

## 2026-08-19 to 2026-08-20 — The pivot to Wimbis: building the Language for real

dDd's own framing: "Human Personalities and English is sort of dense and abstract, it was a lot to think about... instead of doing that, I just went to the start, with Gom and the Living Stone." Rather than keep forcing English into a game-mechanical grammar,
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
  grammar — the "shared grammar over bespoke systems" principle, found
  independently at the language layer.
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
secret duality is structurally identical to an Information ladder
(Unknown → Rumored → Confirmed → Misunderstood) — "who has access to which
Glyph" could plug directly into "what does this Character know."

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
`yield-line` marking a terminal outcome per branch. Arrived at from an
entirely different direction — the Composition format doesn't need a
separate branching system layered on top for Dialogue;
`follow`/`goto`/`wildcard`/`yield` already give the Language itself
a graph shape, unprompted.

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
Fixes** (see `VISION.md` for the full context).

**The Big One — Wimbis is confirmed as Dialogue's real engine, not a
parallel discovery sitting near it.** Per dDd: "WIMBIS is the result of all
that [Second Era Crystal Being] experimentation, the answer to it. It'll
have everything to do with Dialogue since it's the only way to Communicate
in World (Actions, Sounds, Thoughts, Writing)." The "Reverse Engineer It to
English" principle stays the standing approach — English is still the
translation layer handed to the Player, not the thing being formalized.
Wimbis's own grammar *is* the branching-Dialogue mechanism, not a candidate
for it.

**Head → Information → Behavior, confirmed, with a concrete downstream use.**
Per dDd: "Head to Information (Expressions or Compositions right now).
That information informs Movement on the Map and choices in Combat
(recklessly attacking for example). Information can be Orders." Routing a
Character's Behavior through Composition/Expression via the Head
domain is real, not speculative — the second item in the attack
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
  redundancy, not an error.
- **Character, defined:** anything with a Stat Sheet — of which there are
  two, Physical (essentially done — the existing Combat/Stats system) and
  Personality (the new parallel build). Applies uniformly to Players,
  Mini-Party members, Enemies, and NPCs — there's no separate "NPC" data
  shape, just another Character.

**Blocked items, updated (some now moot, kept as historical record):**
- Navigation resolves simply — "a Drop Down Select somewhere on the Main
  Game Screen," no bigger location-graph system needed.
- Axes/Axis/Ax genuinely wait on Personality and Language settling first
  — confirmed, not reopened.
- TATA stays on hold until NPCs exist to work with — confirmed at the time;
  **moot as of 2026-08-25, TATA itself is retired, see the note at the top
  of this file.**
- "Interaction authoring format" wasn't recognized as posed ("I don't know
  what this is about") — needs a concrete example next time it's raised.

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
(TATA retired 2026-08-25 — this quote describes the pre-retirement role;
the "temporary state, not a type" reasoning still holds under Yom.)
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
Combat action selection too, not a separate system to build later.

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
available on the Game Map and in the Lore."*

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
possible but rare/secondary.

**A real new mechanical axis: Letter/Mark composability is gated by
Biology, separate from simply "knowing" a Glyph.** Per dDd: *"It's about
their Biology. A Stone might know W, but not M. Even if knows both, they are
very unlikely to be able to do anything with WM together, cause they won't
have I. That's related to Vibration, which the Crystal use to make their
Harmonic Language."* Knowing individual Marks doesn't imply the ability to
*combine* them — a Character's own biology caps which combinations are even
physically expressible, and "I" (GI, Vibration) specifically is
Crystal-Being territory, not Living Stone.

**Mindeye vs. Sonic is the Writing/Speaking split — dDd's own reaction:
"That is huge."** The two aren't just a cosmetic reskin of the same mechanic,
they map onto **Writing vs. Speaking** as the two channels Language actually
travels through. Not fully specified yet.

**Four new First Era Glyphs adopted**, from dDd's own direct hand-edit of
`language/gomsdu-glyphic-system.json`: `SUU`
("Stop"), `KULOG` ("Find / Hunt"), `KALAG` ("Explore / Wander" — composition
currently just the bare `cross-core` primitive with no distinguishing Marks
yet), `YO` ("Reference to Star Father").

**The migration approach, settled: merge feature by feature, not a
rewrite.** Per dDd: *"We will keep both, merging feature by feature... It's
mostly about getting these foundational ideas into a practical working
state."* Concrete worked example, Movement specifically: *"Plotting Moves
works great. Suppose a Character only knew RO? They could only move closer
to the row, but be unable to move to the proper column. That would get
factored into the Line logic."*

**The storage-shape question — delegated to Claude, decided.** Per dDd:
*"You let me know. That's your Domain... whatever is going to cause the
least headache for us both down the line is what makes sense to me."*
**Recommendation: don't migrate the storage layer yet — build the Universal
Character as a logical/virtual layer on top of the existing
`table.players`/`table.enemies` split, not a literal merge.** Reasoning:
`table.players[id]`/`table.enemies[id]` lookups are threaded through roughly
15 files — collapsing them into one literal structure now would be a sweeping,
high-risk, all-at-once rewrite, which is exactly the opposite of "merge
feature by feature." The conceptual fix doesn't actually
require changing *storage* — it requires new **functions** that treat the
existing split as one logical space.

## 2026-08-23 — The 4-stage Memory lifecycle, Ideas as Axis-loaded Expressions, and Target identification across Eras

Grew directly out of playtesting the new Personality Panel Plan section (see [ROADMAP.md](ROADMAP.md), Personality/Behaviors section, and [CHANGELOG.md](CHANGELOG.md) 2026-08-23) — dDd noticed the earlier Innate/Received/Known Category proposal from that session was basically re-deriving something already half-designed, then handed over the real spec. Nothing below is built — per dDd, explicitly: "This is mostly to illuminate how it can grow from what we are implementing here," acknowledging scope directly rather than asking for it now.

### The 4-stage Category lifecycle

**Corrected 2026-08-23, same-day questions pass — this is a single continuous 0-100 stat with threshold bands, not four independent boolean-flag combinations.** Every piece of Information carries one numeric Retention-style stat, and Category is just which band it currently falls in:

- **1-25 → Fleeting** (= "Received"). Just arrived, nothing reinforcing it yet.
- **26-75 → Retained.**
- **76-99 → Known.**
- **100 → Perfected** (the word dDd actually meant throughout — "naturalized" in his first message was an earlier draft word, not a second distinct flag).

**The stat decays naturally over time** (unmodeled rate — not yet specified) **unless reinforced**, and can be **actively attacked** — **by the Character themselves, on their own Memory, not an enemy's**. Per dDd: "You can attack a Memory (S is for Attacking, which has double feature like KA, for Physical and Mental) which will weaken it." `S` is a Glyph with the same Physical/Mental duality `KA` already has — Physical-S presumably the existing literal combat Attack, Mental-S a Character deliberately weakening *their own* held Information. Not built.

**`born` is real and separate from the climb entirely** — "Born being Born with it, learned in the Womb, pure instinct." Not a value on the 0-100 stat at all.

**Reaching Perfected (100) via the climb is a one-way door, per dDd**: "Imprinting should only be able to be removed by advanced means (like a Technique designed for it)."

**`heard` stays out of scope until Second Era** (Kulkrow's Sonic Glyphs).

**Real mechanical payoff, confirmed**: "using KA on a Glyph changes it from Fleeting to Retained. If that doesn't get done, it might become forgotten." This is KA's long-flagged Mental half (Contemplation) getting a real definition — forgetting-priority is the inverse of the Retention stat, not a separate mechanism.

**What actually pushes the stat from Retained toward Known (`studied`) is a genuinely open question** — per dDd, directly: "Just a lot of really intense study? Something practical? It's an open question actually. I've wanted there to be a progression system for a Living Stone Player in the First Era. That just hasn't gotten designed yet."

### Directions/Actions/Targets/Ideas — the Variety axis, refined

- **Directions** confirmed as the rename over "Movement" — dDd's own reasoning: "the Character is conducting Movement, but they are following Directions to reach their Target." Movement is the *Behavior* (the act); Directions is the *Information* (the memory that guides it).
- **A real composition fact, logged not yet acted on**: "the Arrows are Chevrons and KA" — the 4 Direction Glyphs are structurally composed of a Chevron primitive plus a KA component.
- **Target and Idea can be interchangeable, KA as the connector** — dDd's own proposed starting point: KA links two Glyphs "in the Head" *unless* the KA-Action is pointing at an NPC, in which case it's the already-built external Maintain Empower instead.
- **Gom's own Glyph is deliberately dual-typed** — "Gom is Religion and a Character, so a dual Glyph." Not a special case exclusive to Gom — any Glyph may be ambiguously both Target and Idea.

### Ideas, confirmed

1. **Still a Glyph** — but "an Expression or Conditional would be a better way of thinking about it." Example: Gom's own Life-giving/taking (the Current toggle) *is* a concrete Idea.
2. **Confirmed exactly**: Ideas are "loaded with Axes" — specifically designed to shift Attachment/Desire and ripple through Personality. Mechanically, this may already be substantially available — `js/scripts.js`'s "Give Memory" tool already lets any Mindeye entry carry `attachment`/`desire`.
3. **Target Glyphs, per-Era**: First Era is deliberately sparse — only Kulkrow, Living Stone, and Gom exist. Second Era: Crystal Beings use Numbers. Third Era: real Names (full Expressions), pioneered by Crystal Being royalty.
4. **Confirmed**: not every Category is meant to apply to every Variety.

### Questions-pass answers, same day — Variety's two tables, KA as a discovery roll, and half-remembered Scripts

- **Variety is two separate tables checking each other, not one.** Table 1 (objective, game-data): which Varieties a given Glyph is *capable* of expressing as. Table 2 (subjective, per-Character): which of those potential Varieties this specific Character actually *understands*.
- **KA-contemplation is a probabilistic discovery roll, not a guaranteed connector.** Per dDd: "It's kind of like fishing maybe? ... Could unlock a new Behavior, a new Emotion, a new Glyph, a new Script... Those are all supposed to reinforce each other."
- **Multi-Glyph Ideas can be half-remembered, and that's a real, meaningful state — not a bug to prevent.** dDd's own worked example: "someone obsessed over an Ancient Scroll... he knows it Glyph for Glyph by Heart, but only the Shapes. The meaning he has to figure out."

### Logged, not built — "just so this is on paper"

**The Directions/Movement Behavior should queue**, so a Character with a real Target (destination) can path there across as many Rounds as it takes, rather than one direction-pick per roll.

## 2026-08-24 — The Universal Characters Table, built for real

Follow-up to 2026-08-22's "The Universal Characters Table" section above — that entry was the design; this is it actually existing. Surfaced the same way the original did: chasing what looked like a small bug (the New Game screen not genuinely leading into a Scene) turned up a real gap between what had been scoped and what had shipped. dDd, checking on Yom specifically: *"Yom is a Full Character in the Data Model. We scoped that, we planned for that, I was told that was what we built. That's not what is happening."* He wasn't — `js/activeCharacter.js` had been rebuilding an ephemeral display object off `BUILDS.yom` every render the whole time, with no persisted record at all.

**The fix confirmed the original design was right, not just theoretical.** When the question came up of where a newly-real Yom should actually live, the instinct was `table.enemies` — exactly the structure the 2026-08-22 conversation had already flagged as due for replacement. dDd caught it directly: *"Why table.enemies? What happened to the Universal Character Table?"* Since Yom was brand new — nothing to migrate, no existing callers to break — he turned out to be the cleanest possible place to actually start the "merge feature by feature, not a rewrite" migration. `table.characters` exists now, for real, with Yom as its first tenant. `table.players`/`table.enemies` are untouched, exactly as the original plan called for.

Full build detail — `spawnYom()`, `resolveEntityRef()`/`allCharacterRoster()` extended additively, the NPC Panel and Active Character default both updated, Yom appearing on the Map alone then vanishing the moment a real Player arrives — lives in [CHANGELOG.md](CHANGELOG.md) 2026-08-24.

## Closing framing

The goal was never to simulate an infinite conversation — that's the LLM
freeform-text trap this design deliberately avoids. The actual, achievable
goal: simulate an infinite number of ways *this particular Character* might
express themselves. Bounded, authorable, deterministic, and still feels alive.
