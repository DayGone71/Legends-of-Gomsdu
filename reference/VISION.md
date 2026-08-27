# High-Level Goals

Not `ROADMAP.md`. That document is the trenches — live `[Ready]`/`[Discuss]`
work, one panel and one bug at a time, weeks deep. This is the other
altitude: the big-picture build order and the "why we're actually doing
this" reasoning behind it, meant to stay stable for a while and get referred
back to, not edited every session.

**Written CC2-1 (Cycle 2, Session 1), 2026-08-17** — see [CYCLES.md](CYCLES.md)
for what Cycle/Session actually mean. **Rewritten 2026-08-25, at Cycle 2's
own Assessment, and again CC3-1, 2026-08-26** — restructured from a 9-item
Priority Order into 7 Stages. The 2026-08-25 version had marked
Dialogue-Skeleton and Personality/Stats "Completed" based on the mechanism
existing and running; CC3-1's own conversation on the Glyph/Language data
underneath Wimbis found that "Completed" was true at the surface level and
wrong at the organization level (Behavior/Variety duplicated as hand-kept JS
constants instead of living in the Glyph JSON — already the cause of one
real bug; Grammar Lines, Marks, and Expression structure all thinner than
the JSON implied). This version reflects that finding directly rather than
repeating a status line that no longer held up. Full detail in
[CHANGELOG.md](CHANGELOG.md)'s 2026-08-26 entry.

Cross-reference: [gomsdu-codex.md](gomsdu-codex.md) (the world/themes this is
all in service of), [dialogue-system.md](dialogue-system.md) (the fuller
design space several Stages below draw from — the full Wimbis pivot and
Universal Characters Table history live there in dated detail, not
repeated here), [style-guide.md](style-guide.md) (Stage 7), [ROADMAP.md](ROADMAP.md)
(the tactical layer underneath all of this), [CYCLES.md](CYCLES.md) (what
the current Cycle is actually scoped to do next).

---

## The state of things, as of CC3-1 (2026-08-26)

Cycle 2's Assessment described a real gap that had genuinely closed by that
point — a sophisticated Codex sitting next to an engine with zero narrative
surface isn't true anymore. Wimbis is real, Personality is real, Characters
are universal, and a real Scene exists and is playable (Era 1: Gom). What
that Assessment didn't have yet was a close look at whether "real" also
meant "organized" — it didn't, for the Language/Glyph data specifically (see
[ROADMAP.md](ROADMAP.md)'s Architecture/Systemization section for the actual
findings, gathered CC3-1). The honest state now: the mechanisms that make
the game playable exist; several of them sit on data that's duplicated,
thin, or not yet structured enough to extend safely. Not a regression from
Cycle 2's read — a more accurate one, now that organization-level
completeness actually got checked instead of assumed alongside
surface-level completeness.

---

## The 7 Stages

Restructured CC3-1 from the old 9-item Priority Order. That order was built
around old item 1's own dependency chain (Dialogue needed to exist before
Personality Stats could attach to anything, etc.) — the durable premises
that chain settled (Wimbis as the real Language, Characters as one universal
shape, not a separate NPC data type) aren't Stages anymore; they're the
ground the 7 Stages below stand on.

**1 — Architecture/Systemization discipline.** Not a feature — the gate.
Real, reusable systems instead of one-off hardcoding per mechanic; real
verification through actual gameplay scenarios instead of bespoke functions
that force internal state to fake a pass. Named 2026-08-25 (see
[ROADMAP.md](ROADMAP.md)), first tested for real CC3-1 against the Glyph
data — Stage 2 immediately below is its first concrete application.

**2 — Language/Glyph Architecture.** What CC3-1's Architecture conversation
actually found broken, named directly instead of assumed done: Glyph
identity (a validity audit still needed — what's current vs. stale across
the 39 Glyphs), Marks (only the Chevron confirmed so far), Grammar Lines (2
entries against at least 5 more already in use), Expression/Paragraph
composition structure (not built as data anywhere yet), Behavior/Variety
folded into the Glyph JSON instead of duplicated as JS constants (the
duplication already caused a real bug — `KULOG`/`KALAG` swapped in
`js/behaviors.js`'s `GLYPH_BEHAVIOR`), Era-gated roles (a Glyph's shape never
changes, but which roles it can play — standalone, Mark, Compound-component
— can unlock in a later Era), and Target identification's 3-tier system
(category-level now, personal Number in Second Era, personal Name in Third
Era, generalizing to Ideas eventually). Full breakdown in
[ROADMAP.md](ROADMAP.md)'s Architecture/Systemization section.

**3 — Personality/Behavior completion.** Downstream of Stage 2 by a
dependency CC3-1 found directly — `GLYPH_BEHAVIOR` reads off Glyph identity,
so Behavior can't be trusted to extend correctly until Stage 2's data is
real. What's left once it is: AP actually draining as the Behavior Queue
resolves, and Attachment/Desire moved from hardcoded JS
(`js/relationships.js`) into real JSON. Old item 2, narrowed to what's
genuinely still open rather than marked Completed.

**4 — Character/NPC integration.** Old items 3+4 merged. The Universal
Characters Table is real and durable — what's left is old item 4's own
flagged-open question ("needs a closer read against what's actually
built"), plus Species actually mattering mechanically once something
differentiates on it (currently a flavor-text string with nothing reading
it — confirmed CC3-1, see [ROADMAP.md](ROADMAP.md)).

**5 — Combat/Movement engine.** New as its own Stage — the old 9-item order
never gave this a real slot, just a nod under old item 5 ("minor mechanical
fixes"). Locality-based Encounters, the Map Evolution, Formation/Wall
Formation, and everything else `ROADMAP.md` already tracks under Combat/
Movement/Sequencer is a thread the same size as Language, not a footnote.
Combat Panel itself is in a deliberate teardown (see `ROADMAP.md`) — this
Stage is the engine-level work underneath it, not the standalone popup.

**6 — Scenes/Narrative assembly.** Old item 6, effectively unchanged — the
layer where Stages 1-5 actually run together in play. Era 1: Gom is the
existing proof this works at all, not a finished instance of it. Worth
naming directly, confirmed CC3-1: this Stage's real destination isn't
undefined. `gomsdu-codex.md`'s "Present Day" heading is explicitly labeled
**Third Era**, and it already holds a substantially complete campaign —
Bane's opening sequence, the Man of Gom tutorial arc, the Prophecy of
Krowkist, the reserved True Union endgame. First and Second Era — everything
Stages 1-5 are actually building — are the Living Stone's own prehistory,
teaching the Language/systems vocabulary a player needs before that
already-designed Third Era campaign is reachable. Not aspirational framing —
per creator: "Third Era is the Goal of the Game itself... all this stuff is
foundation," and First/Second Era content is meant to be fully valid
gameplay in its own right along the way (primer missions/tutorials), not
throwaway scaffolding.

**7 — Presentation.** Old items 7 (Web Lab), 8 (Visual/Art-direction), and 9
(Physics-as-Narrative) merged into one. The 2026-08-25 version of this
document already noted 8 and 9 were "doing double duty" through the same
work (the Mindeye Interface); Web Lab was always explicitly parallel/
recreational, never competing for priority. One Stage — how the game
actually looks and feels — instead of three separate ones that were already
overlapping in practice.

---

## The Web Laboratory — Forces & Experiments

Landing-page-only right now (`index.html`'s Color Lab, Lightning box, Lava
box — see `js/main.js`'s `initLightningBox`/`initLavaBox`), explicitly no
game state beyond what Stage 7 above has started connecting. dDd's vision
for where this goes: not decoration, but the Narrative eventually
*presented through* these semi-random forces going off — which lines up
unusually well with the Codex's own cosmology, where the First and Second
Wars are literally Lightning-and-Lava acting on each other at
civilizational scale. The Founding Rule — neither brother creates from
nothing, both act on shared material, Liquid doesn't exist until the two of
them actually meet — is a real, buildable mechanic if the experiments below
share one canvas and interact, instead of living in separate boxes.

dDd's seed list, with a first creative pass on technique/feasibility for
each (plain Canvas 2D / SVG / vanilla JS throughout — no libraries, matching
what Lightning/Lava already do and the project's own no-build-step rule):

- **Water** — shouldn't be its own box. Should be the emergent seam where
  Lightning and Lava touch: wherever a bolt's endpoint lands inside the lava
  particle field, spawn droplet-particles that inherit the lava sim's own
  physics. Water as something that *happens*, not something authored — the
  single most thematically exact item on the list, since it's the Codex's
  own derivation running live instead of being described.
- **Blood** — a settled pool (cheap two-buffer ripple convolution) with
  droplets falling and splashing into it, pool hue drifting redder per drop
  absorbed. Feeds naturally from Water: a few drops of the Kulkrow-red patch
  landing in accumulated Water becomes Blood, mechanically.
- **Mud** — reuses the Lightning box's own midpoint-displacement branch
  generator, but the resulting path gets baked permanently onto a clay-brown
  canvas instead of animating out and discarding — a growing, never-cleared
  network of frozen veins. Close to a literal fulgurite.
- **Mycelium** — a space-colonization algorithm (attraction points + growing
  nodes reaching toward the nearest one), slow and organic rather than
  electric. Best version only grows where Mud veins or Blood pools already
  exist on the shared canvas — the Orks' Blood Film lore as a live rule
  instead of a paragraph.
- **Crystal** — a seed point plus slow diffusion-limited aggregation, hard
  geometric facets rather than organic branching — deliberate visual contrast
  against Mycelium's softness next to it, echoing forced/tortured structure
  versus willing growth.
- **Stone** — three techniques, each one an actual named spell/event from the
  Codex: *Carve* = Separation (canvas `destination-out` chisel, the removed
  chunk becomes its own draggable physics object). *Melt* = feeds directly
  into the existing Lava particle sim. *Explode* = Voronoi fracture, a
  clickable Rainbow-Shards moment.
- **Iron (the Planet)** — less a peer experiment, more the base layer the
  others sit on and visibly erode/melt/grow across over time: a slowly
  rotating mass with a frozen Voronoi crack pattern (same fracture technique
  as Stone's explode, unlit).

Structural payoff of building these as one shared canvas with real
interaction rules, rather than seven isolated toggles: it turns the Lab into
a small working model of the Founding Rule itself — which is the most
"Gomsdu" thing this feature could plausibly do.

---

## Closing note on this rewrite

The 2026-08-25 version's own closing note (explaining how that Assessment
folded 4 dated Addenda into status lines instead of keeping them as appended
prose) is itself now historical — full detail lives in git history and in
[CYCLES.md](CYCLES.md)'s Cycle 2 entry, not repeated here for the same
reason that version gave for not repeating what came before it. This
rewrite's own reasoning is covered in the header note above and in
[CHANGELOG.md](CHANGELOG.md)'s 2026-08-26 entry — nothing to add here that
isn't better placed there.
