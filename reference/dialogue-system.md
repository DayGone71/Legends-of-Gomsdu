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

## Closing framing

The goal was never to simulate an infinite conversation — that's the LLM
freeform-text trap this design deliberately avoids. The actual, achievable
goal: simulate an infinite number of ways *this particular Character* might
express themselves. Bounded, authorable, deterministic, and still feels alive.
