# High-Level Goals

Not `ROADMAP.md`. That document is the trenches — live `[Ready]`/`[Discuss]` work,
one panel and one bug at a time, weeks deep. This is the other altitude: the
big-picture build order and the "why we're actually doing this" reasoning
behind it, meant to stay stable for a while and get referred back to, not
edited every session. Started 2026-08-17, after stepping back from active
build work for the first real high-level conversation about where the whole
project is headed.

Cross-reference: [gomsdu-codex.md](gomsdu-codex.md) (the world/themes this is
all in service of), [dialogue-system.md](dialogue-system.md) (the fuller
design space item 1-2 below draws from), [style-guide.md](style-guide.md)
(item 8), [ROADMAP.md](ROADMAP.md) (the tactical layer underneath all of this).

---

## The state of things, honestly assessed

Two projects at very different maturity levels sharing one interface. The
Codex is a real, load-bearing thematic argument, not flavor text — every
faction is a different disguise on the same underlying exploitation, and the
"Player-Facing Reveal" sequence is genuinely sophisticated design. The engine
underneath (Global Counter combat, Possession, the Chunk/Wounds split) is
further along than it looks. But as of this writing, the app has **zero
narrative surface** — no Scene system, no NPC, no dialogue anywhere in `js/`.
An excellent tactical combat/party table sitting next to a beautiful bible,
currently unconnected. Everything below is the plan for connecting them.

---

## The Priority Order (settled 2026-08-17)

dDd's own ordering for 1–5 and 7; Claude filled the gaps at 6, 8, 9 on request,
confirmed correct.

**1 — Dialogue System Skeleton.** Before its own Stats exist, decide *how*
they'll be used — same lesson Combat already learned. dDd's own framing,
worth preserving verbatim: *"With the Combat, I started by thinking of the
way heroes in movies were portrayed. Aragorn could slay like 7 orks in 3
seconds. What the heck was going on with enemies having these ridiculous
health bars? ... Is it possible to get that sense across while having the
Player feel pretty much unstoppable amongst all the commotion?"* Dialogue
needs the equivalent translation pass — Themes into what's actually
expressible inside HTML/CSS/JS — before anything gets built. **The one Theme
singled out: Information.** Non-Combat/Personality Stats are about what a
Character *does* with Information (which is what Axes are, functionally);
personality develops as a *reaction to* Information. Start there, then work
backward into the Stats — not the other way around.

**2 — Personality/Dialogue Stats.** Downstream of 1 by construction.

**3 — NPC Creation.** Needs somewhere to put the Stats.

**4 — Character refinement + NPC integration.** Needs NPCs to exist first to
know what "integration" means concretely.

**5 — Minor mechanical fixes** — the 4 items standing between the current Map
and a Bane-shaped encounter: AP-costed/queued movement, DM control over Enemy
movement, Range Restriction on Actions (Attack/Block gated by Tile
adjacency), Neutral Characters. Confirmed narrow and self-contained, not an
architecture fight — Tile-disabling itself is already built.

**6 — Scenes / Narrative Interface.** The assembly layer. 1–5 are components;
this is the first place they run together — text, a real dialogue exchange
using the actual Axes/Stats, an NPC rendered as one, handing off into Combat
on the now-Range-restricted Map. "Bane" was never a separate priority from
this — it's what building #6 for the first time looks like.

**7 — Web Lab development & Experiments.** Parallel/recreational track, not
competing for priority against 1–6 — the thing that happens *during* a break
from them, not after them. dDd: encourages "lots of creative thinking," and
the Codex itself hands over plenty of Force/Form combinations to draw from.

**8 — Visual/Art-direction pass.** The current ink/parchment/brass look is
explicitly flagged in `style-guide.md` as never art-directed, "all of it is
getting replaced" — real work, but nothing upstream depends on it.

**9 — Physics-as-Narrative fusion.** The eventual payoff of everything above
it: Possession driving the Lightning box's own strike-rate live, a Scene
rendering as a tuned storm instead of a paragraph. Correctly last — it needs
Dialogue, Stats, NPCs, a Scene System to live inside, *and* a mature-enough
Lab, all at once, before there's anything real to hook it into.

---

## The Web Laboratory — Forces & Experiments

Landing-page-only right now (`index.html`'s Color Lab, Lightning box, Lava
box — see `js/main.js`'s `initLightningBox`/`initLavaBox`), explicitly no
game state. dDd's vision for where this goes: not decoration, but the
Narrative eventually *presented through* these semi-random forces going off
— which lines up unusually well with the Codex's own cosmology, where the
First and Second Wars are literally Lightning-and-Lava acting on each other
at civilizational scale. The Founding Rule — neither brother creates from
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

## Open, not yet started

- **Dialogue System Skeleton** (item 1) — has a real skeleton standing now,
  not just design notes. Three companion documents landed and got absorbed
  (`gomsdu-dialogue-mechanics.md`, `gomsdu-vibe-doc.md`,
  `gomsdu-influences.md`, all now living in `reference/` alongside this
  file), formalizing the **Four Pillars — Exchange, Information,
  Personality, Relationships — with Chemistry as the process connecting
  them, not a fifth.** Each Pillar now has its own standalone, working
  prototype: `prototypes/dialogue-line.html` (Exchange — Line, Set Pieces,
  Snippets, saved Exchanges), `information-pillar.html` (Local/Global kit),
  `personality-pillar.html` (Heart/Stomach/Head, Pole-Mid-Pole Axes),
  `relationships-pillar.html` (Temporary→Final, Chemistry Pairs), and
  `chemistry-pillar.html` (a snapshot dashboard pulling all four together —
  placeholder data for now, not live-wired). The Set-Piece/Axis grammar
  itself got real validation, not just internal consistency — see
  [dialogue-snippets.md](dialogue-snippets.md), a running library of real
  quotes decomposed into this notation, with genuine emergent overlap
  surfacing unforced four times across the first six tried. Full detail in
  [dialogue-system.md](dialogue-system.md)'s "2026-08-17, later that night"
  and "2026-08-18" sections. Items 2–4 (Stats, NPCs, Character integration)
  are still genuinely not started as game-integrated systems — though the
  Personality prototype above is arguably a first concrete stab at item 2's
  Stats specifically, worth reconciling rather than starting item 2 fresh
  from nothing.
