# High-Level Goals

Not `ROADMAP.md`. That document is the trenches — live `[Ready]`/`[Discuss]`
work, one panel and one bug at a time, weeks deep. This is the other
altitude: the big-picture build order and the "why we're actually doing
this" reasoning behind it, meant to stay stable for a while and get referred
back to, not edited every session.

**Written CC2-1 (Cycle 2, Session 1), 2026-08-17** — see [CYCLES.md](CYCLES.md)
for what Cycle/Session actually mean. **Rewritten 2026-08-25, at Cycle 2's
own Assessment** — the original had drifted into half-plan, half-diary (4
dated Addenda bolted onto the bottom, a "state of things" section describing
a build from over a week before it was last read). This version folds dDd's
own status pass on every Priority item, given directly at that Assessment,
into a single current statement instead of a patched-over one.

Cross-reference: [gomsdu-codex.md](gomsdu-codex.md) (the world/themes this is
all in service of), [dialogue-system.md](dialogue-system.md) (the fuller
design space several items below draw from — the full Wimbis pivot and
Universal Characters Table history live there in dated detail, not
repeated here), [style-guide.md](style-guide.md) (item 8), [ROADMAP.md](ROADMAP.md)
(the tactical layer underneath all of this), [CYCLES.md](CYCLES.md) (what
the current Cycle is actually scoped to do next).

---

## The state of things, as of Cycle 2's Assessment (2026-08-25)

The gap this document originally described — a sophisticated Codex sitting
next to an engine with zero narrative surface — has substantially closed.
Wimbis is real: a whole `language/` toolchain, a living Glyphic System.
Personality is real: Heart/Stomach/Head domains, per-Glyph Emotion Axes, a
working Pursuit/Longing Behavior Queue. Characters are universal: one
logical space across Players/Enemies/NPCs, with Ally/Enemy correctly scoped
to Combat only rather than a permanent tag. A real Scene exists and is
playable — Era 1: Gom. Per dDd's own pass below, most of the original
9-item order is now Completed or Partially Completed. The honest gap left
isn't "nothing's connected" anymore — it's the handful of items still
Started or Partial, plus the process problem named in this same Assessment
(hardcoding one-off mechanics instead of reusable systems — see
[ROADMAP.md](ROADMAP.md)'s Architecture/Systemization section) that's now
the actual gate on what gets picked up next, not any single item below.

---

## The Priority Order

dDd's own ordering for 1–5 and 7; Claude filled the gaps at 6, 8, 9 on
request, confirmed correct at the time. Status lines are dDd's own pass,
given directly at Cycle 2's Assessment, 2026-08-25.

**1 — Dialogue System Skeleton. Status: Completed — WIMBIS.**
Before its own Stats exist, decide *how* they'll be used — same lesson
Combat already learned. dDd's own framing, worth preserving verbatim:
*"With the Combat, I started by thinking of the way heroes in movies were
portrayed. Aragorn could slay like 7 orks in 3 seconds. What the heck was
going on with enemies having these ridiculous health bars? ... Is it
possible to get that sense across while having the Player feel pretty much
unstoppable amongst all the commotion?"* Dialogue needed the equivalent
translation pass — Themes into what's actually expressible inside
HTML/CSS/JS — before anything got built. The path that actually got there
wasn't the original English Set-Piece/Call-Response engine (superseded —
see `dialogue-system.md`'s "2026-08-19 to 2026-08-20 — The pivot to
Wimbis" section) — it's Wimbis, the world's own Language, built as a real
system first, with English demoted to a translation layer handed to the
Player. Full history in `dialogue-system.md`'s dated sections, 2026-08-19
through 2026-08-24 (the file was trimmed 2026-08-25 — it originally also
covered the superseded English engine itself, cut for the same reason
`gomsdu-dialogue-mechanics.md` was).

**2 — Personality/Dialogue Stats. Status: Completed — Personality and the
Axis.** Downstream of 1 by construction. Built: Heart/Stomach/Head as the
domains Axes attach to, Attachment/Desire as the real per-Glyph Emotion
Axes, and the full Desire + Longing + Plan + Repeat = Pursuit weighting
formula driving a working Behavior Queue. Full history in `CHANGELOG.md`'s
2026-08-21 through 2026-08-24 entries.

**3 — NPC Creation. Status: Completed — Characters are universal.** Needs
somewhere to put the Stats. Resolved by the Universal Characters Table
(`table.characters`) — per dDd, *"Character, defined: anything with a Stat
Sheet... applies uniformly to Players, Mini-Party members, Enemies, and
NPCs — there's no separate 'NPC' data shape, just another Character."* See
`dialogue-system.md`'s 2026-08-22 and 2026-08-24 sections, and
`CHANGELOG.md` 2026-08-24 (Yom as the Table's first real tenant).

**4 — Character refinement + NPC integration. Status: Partially
Completed.** Needs NPCs to exist first to know what "integration" means
concretely. Per dDd, 2026-08-25: this item needs a closer read against
what's actually built before its status can be judged precisely — flagged
open rather than guessed at.

**5 — Minor mechanical fixes. Status: Completed** — per dDd, 2026-08-25,
"every one of these have been resolved." The 4 items standing between the
old Map and a Bane-shaped encounter: AP-costed/queued movement, DM control
over Enemy movement, Range Restriction on Actions (Attack/Block gated by
Tile adjacency), Neutral Characters. AP-costed movement → Move Orders,
built 2026-08-21 (see `CHANGELOG.md` same date). **Worth reconciling**:
`ROADMAP.md`'s DM Panel item E ("nobody can move an Enemy once it
spawns — not the DM, not anyone") is still listed `[Discuss]`, open as of
2026-08-25 — flagged here rather than silently marked resolved, since it
reads like a real gap against "every one of these have been resolved" and
is worth a quick check next time DM Panel work comes up.

**6 — Scenes / Narrative Interface. Status: Partially Completed.** The
assembly layer. Items 1–5 are components; this is the first place they run
together — text, a real dialogue exchange using the actual Axes/Stats, an
NPC rendered as one, handing off into Combat on a Range-restricted Map.
Per dDd, 2026-08-25: the Grid Tile Map is turning out much more flexible
than first anticipated, and the Narrative itself is planned to work in
tandem with item 9 (Physics-as-Narrative), not as a separate track. Era 1:
Gom is the first real instance of this item actually existing in play —
see `CHANGELOG.md` 2026-08-20/22.

**7 — Web Lab development & Experiments. Status: Ongoing** — a longer
initiative by design, not a race to finish. Parallel/recreational track,
not competing for priority against 1–6 — the thing that happens *during* a
break from them, not after them. dDd encourages "lots of creative
thinking," and the Codex itself hands over plenty of Force/Form
combinations to draw from. See "The Web Laboratory" section below for the
full seed list.

**8 — Visual/Art-direction pass. Status: Started.** The current
ink/parchment/brass look is explicitly flagged in `style-guide.md` as
never art-directed, "all of it is getting replaced" — real work, but
nothing upstream depends on it. Per dDd, 2026-08-25: the Mindeye Interface
(the animated smoke → split → Vesica Piscis → Glyph-box reveal, built
2026-08-20) is a real example of this pass actually happening, not just
planned.

**9 — Physics-as-Narrative fusion. Status: Started.** The eventual payoff
of everything above it: Possession driving the Lightning box's own
strike-rate live, a Scene rendering as a tuned storm instead of a
paragraph. Per dDd, 2026-08-25: the Mindeye Interface is a working example
here too — it's the Home Page's own Lightning-box effect, adapted to how a
Script presents itself on screen. The same piece of art-direction work is
doing double duty as items 8 and 9 at once — worth noticing as a real
connection, not a coincidence to resolve.

---

## The Web Laboratory — Forces & Experiments

Landing-page-only right now (`index.html`'s Color Lab, Lightning box, Lava
box — see `js/main.js`'s `initLightningBox`/`initLavaBox`), explicitly no
game state beyond what item 9 above has started connecting. dDd's vision
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

The 4 dated Addenda that used to sit below the Priority Order (2026-08-19
through 2026-08-22 — the Wimbis pivot, the Non-Combat Round landing, and
Composition-to-Behavior/the Universal Characters Table getting named) have
been folded into the status lines above instead of kept as appended prose.
Nothing was lost: full original detail lived in `dialogue-system.md` (the
Wimbis pivot, Composition-to-Behavior) and `CHANGELOG.md`'s 2026-08-21 and
2026-08-22 entries (the Non-Combat Round) — just no longer duplicated in a
document meant to stay stable. Same reasoning for the old "Open, not yet
started" section, which only ever covered item 1's now-superseded English
Dialogue Engine prototypes — **that content is now gone from `dialogue-system.md`
too, cut in a follow-up pass the same day** (1130 lines down to ~400 — per
dDd, "more than half of that information is useless"). Genuinely retired,
not relocated — the same "zero consequence" judgment already applied to
`gomsdu-dialogue-mechanics.md`/`gomsdu-vibe-doc.md`/`dialogue-snippets.md`.
