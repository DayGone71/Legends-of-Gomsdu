# Scenes

A Script Place — not mechanical reference, not settled Codex fact. Closer to
the spreadsheet-pipeline source material that feeds bulk-authored content
(Characters, Techniques) than to `gomsdu-codex.md` itself. Per dDd: this
*develops* what the Codex already has without needing to be reconciled into
it as new canon — a Scene stands on its own, doesn't have to resolve
anything. Add more Scenes here as they come up, same running-file pattern as
`gomsdu-influences.md` and `dialogue-snippets.md`.

---

## First Era Legend — the Map vision (seeded 2026-08-22)

Not built, not fully scoped — dDd shared this live, unprompted, as context for
why the Interface work (Facing, Active Character, the Map Evolution — see
[ROADMAP.md](ROADMAP.md)'s Movement System/Party System/Personality-Behaviors
sections) matters: it's what the First Era Legend's actual Map is *for*.
Worth preserving at this level of detail rather than letting it thin back
down to a one-line reminder.

**The idea**: the First Era Legend's Map has roughly 5 parts. Mostly Living
Stone, clustered by Personality:

-   **Standers** — think standing is the best thing ever. (The literal
    Stand-Around-dominant cluster — see the Behaviors system, [CHANGELOG.md](CHANGELOG.md) 2026-08-22.)
-   **Learners** — always going around asking Gom stuff.
-   **Fighters** — just like rumbling.
-   **Watchers** — follow Kulkrow around the Map as he melts stuff.
-   **Elites** — get Marked by Gom, go around doing whatever they please.

**Gom and Kulkrow both roam the Map doing their own thing.** Kulkrow mostly
moves around making Tiles unenterable for a while — lava flows that
solidify, a real, literal use of the Map's existing blocked/traversable Tile
toggle, not a new mechanic. He sometimes carves stuff that Gom then uses to
make *more* Living Stone with unique Personalities — a direct callback to
the Genesis Scene above (Gom shaping Kulkrow's own Matter into a new Stone).

**Why the Map's styling is basically already done, per dDd**: "the First
Era has zero foliage, terrain, water, geography; it's literally just a
massive barren ball of Iron, so 0 reason to create [visual] features on the
Map besides the toggle to enable/disable travel." The existing
blocked/traversable Tile system already covers everything First Era's Map
visually needs — no new art/terrain work implied by this vision, just the
Interface pieces (Facing, Active Character, Behaviors already built) needed
to actually populate and animate it.

dDd's own read on how close this already is: "the crazy part is that we
have the infrastructure for all of that like 70% complete."

### The First War — the secret story underneath the sandbox (2026-08-22)

The First Era Legend isn't only a mechanics sandbox — it's also a hidden
history. dDd's framing: since the Game is mostly played in the Third Era,
the Player Character having secretly been *present* at the First War is a
way to represent that they know more than everyone else around them, in a
gently fourth-wall-adjacent way. "Something unusual about you..." — a line
that recurs in the main Third Era storyline too — works on three
simultaneous levels for exactly this reason: the Player Character saw the
Shield Fragment, used another Character to participate in a Myth in front of
the person saying the line, *and* visibly makes their own decisions instead
of running on the same subconscious Behavior math every NPC does. One line,
honestly true from three different angles at once — the surprise-is-earned
principle from `dialogue-system.md`'s Vibe Doc, still holding.

**The trigger.** A very specific, non-obvious interaction with an Inert
Stone — no other Character can do it, not because it's flagged
Player-only, but because no NPC's Pursuit math could ever produce it as a
Likely Behavior; nothing's built Longing toward it. The Player *can* do it
because Player input was never routed through Behavior in the first place —
same shape of blindness on both sides of the fourth wall, human routine
mirroring Character routine on purpose. Doing it changes both Gom and
Kulkrow, and sets the First War in motion.

**Behavior control has (at least) three modes, per dDd — and all three
already have a home in something built or specced:**

-   **Player-direct** — today's default: the Player chooses actions by hand.
-   **Subconscious** — the Behavior math (Pursuit/Longing, [CHANGELOG.md](CHANGELOG.md)
    2026-08-22) actually *executing* instead of just logging to the Ledger,
    which is as far as this session took it on purpose. Per dDd: "the
    Player should be able to simply let their Character do whatever they
    want" — letting go is a real, intended playstyle, not a fallback.
-   **Gom Chooses** — routed through Possession/Active Character (see
    [ROADMAP.md](ROADMAP.md)'s Party System section) — "direct control"
    from TATA is *always* Possession via Shadow Gom under the hood, never a
    separate control mode.

A softer variant of Subconscious mode: **the Player adds Weight to
Information instead of choosing directly** — nudging Attachment/Desire on
what a Character remembers (already real, per-entry data — see the
Relationships Panel) and letting Pursuit compute the actual action, rather
than picking a Craft by hand every time. The concrete use case: **time
skips** — "setting the Time to pass for 13 game hours. The Character can do
whatever they want to fill that, with some suggestions prompting them to
lean into this or that." This is the Global-Time scaling explicitly
deferred when the Non-Combat Round first shipped ([ROADMAP.md](ROADMAP.md),
Sequencer Panel) — coming back around from a different, better-motivated
direction.

**The extreme end of losing control is real gameplay stakes, per dDd, "something to consider when making a new Character":**
the Mind can Break, the Heart can be overcome with Fear (fight or flight),
the Stomach can produce an involuntary response — full loss of input, not
just a heavy thumb on the scale. Governed by **Force** — anything external
that's weighting a Character's Behavior (a Message, a Script, another
Character's own Personality state) — measured 1-7. Per dDd: "7 would be
when whatever the Force... is literally unsurmountable. 5 or 6 would mean
the Character would very likely do whatever it is they are being
suggested/manipulated/asked to do, but there is a chance it won't happen."
Force is upstream of the math already built, not a competing gauge: **Force
(external, 1-7) → shifts a target's Attachment/Desire/Longing → Pursuit
computes the Behavior**, same pipeline, just naming what generates the
input side of it.

**This opens a real inter-Player dynamic.** Other Players can talk a
struggling Player's Force down — "the others reassure them, getting that
Force down to like 2 or 3, and thus manageable." dDd's own hoped-for
consequence: **Reassuring Psychologist** and **Cryptic Prophet** become
legitimate playstyles, not combat-adjacent flavor — "I'm hoping a Player
Party can get away with 2 or 3 Combat Focused Characters (or 1 super badass)
and the others be geared towards engagement with the other Game Mechanics."

**A worked Script, for the War itself** (Scripts themselves are a new,
not-yet-built concept — "given to NPCs in Scenes, like a list of things to
look out for," able to deliver Information, reweight Behavior, alter
Technique access, or shift a Personality Axis, all things `mutateTable`
already does to a Character today — this is the first concrete example of
one):

-   Living Stone are coerced into attacking the Molten Ones (Gom's Messages
    directly reweighting their Behavior). Molten Ones try to interact or
    flee instead — but Living Stone are faster.
-   **Molten Ones can only say SUU (Stop) — and Living Stone can't hear
    them, and wouldn't understand the sound even if they could, since they
    only know the laser-engraved Glyphs written into their own heads** (see
    the Genesis Scene above — writing before speech, for this species,
    always). The communication barrier that made the very first Living
    Stone's language legible is what makes this specific tragedy possible.
    SUU attempts gradually cease as the War goes on, "cause they lose
    Hope."
-   **Molten Ones are just Kulkrow — identical Personality, no
    individuation.** Living Stone are genuinely independent of Gom's own
    Personality — which is *why* the First Era Legend's five Personality
    clusters (above) can exist at all; the asymmetry between the brothers
    shows up at the level of who gets to be a distinct person.
-   Finite Living Stone (only made from Inert Stone, which only Kulkrow can
    create) vs. infinite Molten Ones (raised straight out of Lava Flow
    Tiles) — a losing war of attrition by design. Gom and Kulkrow can't
    Wound each other, so the brothers themselves are a permanent stalemate.
    Gom doesn't attempt to infuse a Molten One until Living Stone are almost
    gone and Molten Ones are overrunning the Map — the attempt makes it
    explode, creating Rainbow Shards (which "work like Chunks" — a real
    motivating reason to finally build the deferred per-Character Chunk
    system, [ROADMAP.md](ROADMAP.md)'s Movement System item I). Kulkrow
    recedes from the Map while Gom creates as many Shards as he can before
    that window closes.

**Three new Personality Axes, all currently exclusive to named
Characters, all invisible to the Player unless they flip to TATA and
check:**

-   **Hope** — a *Heart* Axis, per dDd, shared by both Gom and Kulkrow.
    Molten Ones inherit it (they're just Kulkrow); Living Stone genuinely
    don't — no exception to the Head-only First Era rule, since Gom and
    Kulkrow already had Heart-capacity as the two original conscious
    beings, and ordinary Living Stone were simply never built with that
    layer.
-   **Anguish** — a *Head* Axis, exclusive to Kulkrow. Passing its first
    threshold starts the War; its second threshold starts the War's end.
-   **Glee** — a *Head* Axis, exclusive to Gom. He wants it badly but barely
    indulges it by default — the rare moment he does something that reads
    as out-of-character is him satisfying it a little. The War is
    permission to stop suppressing it: "he goes crazy with Glee once he
    realizes what destruction is."

All three function as **Forces** weighting every NPC's Behavior all Scene
long — and the Player's own Character too. Which sets up the real climax,
per dDd: **the actual Final Boss of the First Era is self-control.** Not
Kulkrow, not a Molten One — whether the Player can hold Stand Around against
rising, unexplained pressure long enough to survive.

**Why Stand Around specifically is the winning move, mechanically, not just
narratively**: per dDd, "Stand Around should cause the least influence on
other things... Running or struggling weakens the Character's ability to
resist, since they are tiring themselves out. Standing Around Characters
are able to maintain their Personality better basically, and thus avoid the
Messages." The only Living Stone with real endurance against Gom's
coercion are the least-weathered ones — the ones who never engaged at all.
dDd's own framing for the resulting gameplay: *"the Game is about standing
around trying to forget what is going on around you, sick huh?"* — survival
through willful disengagement, played completely straight. A related,
explicitly unsettled idea from the same conversation: some way to
deliberately *forget* Information on purpose — "maybe always not so easy!"
— still just a seed, not scoped. **The expected outcome, stated directly**:
most Players who succeed in starting the War are not expected to survive
it. The actual win condition is surviving long enough to witness Gom
destroy the Molten Ones and Kulkrow retreat — a sole-survivor ending, by
design, not a balance failure to fix later.

### Second Era seed — the same dark joke, one scale up (2026-08-22)

Barely introduced, deliberately left as an open thread — per dDd: "feel
free to play with them, that's why I mentioned them here." Not scoped,
not committed to; just worth not losing.

**Mud People** have Hearts, but no Glee for Head. **Crystal Beings** have
Hearts, but no Anguish for Head — the same exclusive-to-specific-Characters
pattern the First War's own three Axes use, just no longer restricted to
the two brothers alone. **The two Hearts aren't the same organ, per dDd**:
a Crystal Being's is a Rainbow Sliver (see the Genesis Scene's Crystal
Hearts note above); a Mud Person's is "a bundle in the center of the Mud,
like a Root Cluster" — different Biology, functionally equivalent, and
**not recognized as the same thing by either culture** — each society's own
blindness to the other's version of the exact thing it has itself. Crystal
Beings build Crystal Structures — mostly
**Spires** — the literal architectural payoff of ZON (a Crystal Structure,
built, physical — see the Genesis Scene's "Retcon, next session" note
above). Mud People dig **Mud Pits going into the Planet** — the same
downward-vs-upward, inward-vs-outward contrast as everything else in this
cosmology.

dDd's own read on what this actually is: **"The Second Era takes
Psychological Themes and makes them Sociological, with the same dark joke
angle applied to a new scale."** The First Era's dark joke is one
Character's survival-through-disengagement. Whatever the Second Era's own
version turns out to be, it's a *society's* version of the same move —
Spires reaching up and Pits reaching down read like two civilizations each
finding their own large-scale way to not look directly at something, the
same shape as Stand Around, just population-sized. Not asserted as settled
— a resonance worth noticing, not a design decision made on dDd's behalf.

## Genesis: Gom and the First Stone

Built 2026-08-18, across a long, deliberately "get in the headspace"
conversation — dDd's own framing: *"They are rocks and lava and
singularities, it's ridiculous, but I feel like there is a Story there."*
Not answering an open Codex question, not required reading for anything —
a Scene that could exist alongside the Codex, developing the same cosmology
from ground level instead of from orbit.

**Premise.** Gom and Kulkrow never develop language anywhere in the existing
lore. This asks the actual question: with a newly-animated Living Stone —
solid a moment ago that was molten, aware for the first time, made of Gom's
own essence infused into Kulkrow's shaped Matter — how would language even
begin?

**Living Stone have no mouths.** Whatever happens here is never spoken —
it's engraved, laser-etched imagery reflecting the Stone's own mental
process directly onto itself (technically a sibling of the Lightning box's
recursive midpoint-displacement generator, rendered static instead of
animated — a real, reusable piece of code, not just a visual metaphor).
Writing comes before speech for this species, not after — the opposite of
how it worked for anything else that's ever talked in this world.

### The Scene

The Stone cools. Aware for the first time, it reaches for the only thing
already inside it — Gom's own presence, already there before anything else
exists to name. Its first instinct, un-taught: total fusion. It doesn't
just call out to Gom, it becomes him in the only way it knows how to be
anything at all:

```
GOM-GOM
```

One unbroken line. No separation, because none exists in the Stone's own
mind yet — it can't tell what it is apart from what made it. Not fusion out
of love. Fusion because individuality was never actually available as an
option.

Gom corrects it — not into real independence, into something more useful to
him. A claim of ownership in place of a claim of identity:

```
GO
___
KROW
```

Two syllables now, and for the first time, a divider. Not neutral relation
— hierarchy. GO sits above the line. KROW sits beneath it. *Gokrow* — Life
belonging to Gom, as the Stone itself now understands the word. Bare
`KROW` alone was never taught as real Life at all: without Gom, why be
Life? What even is Life? The lesson installs Gom's own centrality directly
into the grammar of existing, before the Stone has any other words to think
against.

Then Kulkrow — the Divider, though he has no mouth either:

```
<-KUL->
```

One line, both arrows pointing outward from the same word. Not division —
omnidirectional threat, `KUL`'s own actual sense (Share / Around /
Surround, corrected 2026-08-22 — see `gomsdu-codex.md`'s "Language as the
Animating Gate" for the full reasoning) rendered almost too literally: the
arrows radiate outward in every direction, exactly what Kulkrow's endless
Lava-spread does across the Map. Destroyer, all around — not because `KUL`
means Kill directly, but because anything caught inside that spread doesn't
survive it.

Gom intervenes, the same vertical grammar as before, now over the threat
itself instead of over Life:

```
GO
___
KUL
```

Giving himself to stop it.

What follows, dDd flagged as the part he'd held back — heavier than the
rest, and deliberately not softened:

```
GO   →   GO
GOM        (a letter gone)

KROW →   KRO
           (a letter gone)
```

Both words scarred — not just Gom's. GOM loses its M becoming GO; KROW
loses its W becoming KRO. It sounds identical inside the Stone's own head,
in its own laser-eyes — the meaning hasn't shifted at all. What's different
is that Gom carves the truncated shape directly into the Stone's body. A
real, physical, permanent, non-consensual mark. Gom gave himself for Krow.
Gom gave himself again to end Kul, for Krow. So: **what will Kro do for
Gom?** The debt isn't rhetorical once the scar exists — it's carved into
both sides of the relationship at once, the cost visible in Gom's own
truncated name and carved into the Stone's flesh in the same stroke.

Marked for real now, the Stone is sent off.

**It accidentally creates Water.**

Not decoration — the Codex is explicit that Liquid doesn't exist until
Death does, and Water specifically originates from Living Stone and Molten
Ones fusing and dying together in the First War. Whether this scene is a
smaller-scale instance of that same mechanism, or an intimate telling of
that very first death from inside one Stone's own head rather than as war
history — genuinely open, worth deciding on purpose whenever this gets
written for real rather than left ambiguous by accident.

### Companion beat — the Molten Ones

Kulkrow has no mouth either. The Molten Ones are what he becomes to get
one. Their first spoken word — the first sound made through an actual
mouth in this world at all — is **Suu**, meaning *Stop*. Where the Stone's
first reach was toward permanence (the bond staying), the Molten Ones'
first word reaches against an ending. Same accumulation/expulsion split
that's run through everything else in this cosmology, now showing up as
"what each side's first creations beg for."

### Physical grounding, for whenever this needs staging

Gom and Kulkrow's truest, most concrete physical description, from the
Cosmology section directly: **Gom — a tiny White Orb, generating
Lightning. Kulkrow — a tiny Orb of pure Blackness, a literal tear in
reality, constantly pushing Lava out.** dDd's own sci-fi framing on top of
that, worth keeping alongside it: **Gom as an intelligent Black Hole, using
whatever's in its Event Horizon as a body, feeding endlessly off the "Star
Father."** Kulkrow as the physics-inverse — closest to a White Hole, except
what it produces isn't light or matter, it's a ceaseless stream of molten
lava. Left to his own nature, without Gom's cooperation, what he actually
makes isn't Stone — it's **Dust, which simply blows away**. Not a moral
failing. A structural fact about what Kulkrow's own physics can and can't
make permanent on his own — the Founding Rule, restated as cosmic mechanics
instead of myth.

### Crystal Hearts, resolved (not a contradiction after all)

The apparent tension with the Codex's "Crystal Beings have no Hearts...
except one sliver" line turned out to be a literal reading, not a revision:
a Crystal Being's Heart is a physical fragment of a Rainbow Shard — small
by nature, which is exactly what "one sliver" was always describing. Not a
retcon, a more literal version of something the Codex had already
compressed into a single phrase.

---

## Appendix — the Genesis Syllabary (seed data for naming and authoring)

A small, fixed set of root syllables, meant to recombine — the same
combinatorial principle running through the Cosmology, the Web Lab, and the
dev process itself, now applied to language.

| Syllable | Meaning | Notes |
|---|---|---|
| `GOM` | Gom's own name/presence | One syllable, one Sound |
| `GO` | Gom, truncated | The scarred form; also the "belongs-to" prefix (Gokrow) |
| `KROW` | Life | Two syllables |
| `KRO` | Life, truncated | The scarred form |
| `KUL` | Share / Around / Surround | Corrected 2026-08-22 — Kulkrow's own name now reads "The Spreading One," not "Life-Killer." Still deadly in effect (touching his ever-spreading Lava kills), just not the verb's own literal sense |
| `MO` | to Take | Gom's own name, reversed, minus the G — not a coincidence |
| `KROMO` | Taken Life | The closest concept to Death — there is no word for Death itself, since dying just returns you to Gom |
| `SUU` | Stop | The first *spoken* word, via the Molten Ones |

**Orthography is two-dimensional, on purpose.** Horizontal arrangement
carries one grammatical job — an unbroken line means fusion/identity
(`GOM-GOM`); flanking arrows mean omnidirectional threat (`<-KUL->`).
Vertical arrangement, marked by a divider line, carries a different job
entirely — hierarchy and ownership, with whatever sits above the line
dominating whatever sits beneath it (`GO` over `KROW`; `GO` over `KUL`).

**A phrase already built from this set:** *"My Gom take us"* — rendered as
**"Gomo Weez"** (Gomo = Gom + take; Weez = us). The first evidence of actual
morphological fusion, not just isolated root-words sitting side by side.

**Six names already generated from this system** (from an earlier session,
now legible against the syllabary above): Barak-Kara, Timula, Gomula,
Zinbardo, Zebark, Zesubi.

**Cross-reference:** the Genesis language's own grammar —
`((Noun)) {Verb} ((Noun))` — turned out to be the identical shape as the
Set-Piece Tag notation already built for the Dialogue Engine (see
[dialogue-system.md](dialogue-system.md)). Not planned to converge that
way; worth treating as a real signal the mechanical grammar is honest, not
just a coincidence to note in passing.
