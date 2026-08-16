# Style Guide

A running record of what's *confirmed* (built with real intent, don't change without dDd's say-so) versus *expendable* (whatever's currently in the CSS because something had to be there, no design decision behind it) — kept separate from `ROADMAP.md` because this is about **how things look**, not what they do. Started 2026-08-16, after the first real color/CSS design conversation this project has had (there was one earlier brainstorm about Gom/Kulkrow colors and the game's visual identity — maybe captured in `gomsdu-codex.md`, maybe not, per dDd — nothing found there as of this writing, so this doc is the first place it's actually written down).

---

## Confirmed

Everything below was a deliberate design decision, not a placeholder. Changing it should be a real conversation, not a drive-by refactor.

### Map Tile coloring (built 2026-08-16)

Two gradients layer on every Map Tile, driven by inline CSS custom properties computed in [js/map.js](../js/map.js)'s `renderMap()`, consumed by static rules in [css/panels.css](../css/panels.css):

- **Burgundy — Down Characters.** Creeps in from the Tile's edge, never reaching the center, as Down/Obliterated Characters (either side) pile up, 1-5.
  `#BF527F` (1) → `#A84F76` (2) → `#8F3B65` (3) → `#7C2856` (4) → `#6B1747` (5, deepest/closest to center)
- **Pink — Chunks.** Spreads out from the center, opposite direction from Burgundy, as Chunks (see the Chunk Mechanic, `ROADMAP.md` → Movement System item I) pile up, 1-40 in 8 bands of 5. dDd's exact anchor colors sit at the 10/20/30/40 marks; the other 4 are interpolated between them (his own call — "a creative call on your part").
  `#FFC4E0` (1-5) → `#FF9DCE` (6-10, dDd's) → `#FF8FC5` (11-15) → `#FF82BC` (16-20, dDd's) → `#FF78B5` (21-25) → `#FF6FAE` (26-30, dDd's) → `#F965A6` (31-35) → `#F45A9F` (36-40, dDd's)
  At 30+ Chunks, a soft glow (`box-shadow`) bleeds past the Tile's own box into its neighbors — **pure CSS bleed, confirmed no data movement**: the Chunk count itself always stays on the Tile it happened on.
- **Green / Cyan — Active-Character edges.** A ring around the Tile signaling Friend/Foe crowding at a glance: green for 3+ Allies, cyan for 3+ Enemies (same threshold that drives the actual movement-block — see `ROADMAP.md`). Enemy wins if both apply on the same Tile at once.
  Ally: `#2ECC71` · Enemy: `#22D3EE`

**Why these two hues specifically:** picked to avoid colliding with anything else already claimed — Gom's palette (cool: white/blue/indigo), Kulkrow's palette (warm: orange/red/black), the app's existing brass/gold "occupied" tile color, and the burgundy/pink above. Green and cyan were the last pair on the wheel with no overlap. **Rule going forward: before introducing a new UI color, check it against this whole list first.**

### Tier 5 palette (Gom / Kulkrow) — tokens only, not yet wired into UI

Defined as CSS custom properties in [css/base.css](../css/base.css)'s `:root`. Ordering is intentional: 1 = Primary, 2 = Secondary, 3 = Tertiary.

| | Primary | Secondary | Tertiary |
|---|---|---|---|
| **Gom** | `--gom-primary` `#F5F5F0` (white) | `--gom-secondary` `#4A90D9` (blue) | `--gom-tertiary` `#2E2A6E` (indigo) |
| **Kulkrow** | `--kulkrow-primary` `#E8792E` (orange) | `--kulkrow-secondary` `#B0281E` (red) | `--kulkrow-tertiary` `#000000` (true black) |

**Codex cross-reference (a good sign, not a coincidence to chase further):** `gomsdu-codex.md` independently describes Gom's first form as a "White Orb" made of Lightning, and Kulkrow as originating from "pure Blackness... a literal tear in reality," made of Lava — lava reads orange/red-hot, which is exactly the primary/secondary picked here, with true black held back for the rarer, more significant association (see below) rather than spent on his everyday palette.

**True black is deliberately rare.** Per dDd: *"Black is the rarest color in the Universe in game."* Every other dark tone anywhere in the UI — `--ink`, `--ink-soft`, the Map's blocked-Tile color — is a charcoal, never pure `#000000`, specifically so literal black stays meaningful when it does show up (Kulkrow's tertiary here; the codex's own **Black Stone Shield**, "the only colorless material on the Planet," is a nice narrative echo of the same rule). **Don't use `#000000` anywhere else without checking in first.**

**Not wired into any UI element yet** — e.g. the Roster's Possessor icons still use plain circle glyphs (●/○/⊙), not color. Whenever that gets built, these are the values to reach for.

### General principles worth carrying forward

- **"The game is supposed to have a very colorful look"** — dDd's own words, stated while designing the Friend/Foe edges. Don't default to a muted/monochrome palette when adding new visual features; err toward more color, deliberately chosen.
- **Hue is the primary signal, line/fill style is the scaling axis.** When a category needs to split further (e.g. Ally → "my Party" vs. "my Mini-Party" vs. "an Allied Party"), the plan is to keep the same hue per side and vary border style (solid vs. dashed, etc.) rather than mint a new color each time — hues run out fast, line-style doesn't. Not built yet (see `ROADMAP.md`, Movement System item I's last bullet), but the intended pattern for whenever it is.

---

## Expendable

Everything in [css/base.css](../css/base.css)'s `:root` below is the *original* placeholder theme — functional, never actually art-directed, and per dDd (2026-08-16), **all of it is getting replaced**. Safe to redesign freely; nothing here should be treated as a locked decision the way the Confirmed section is.

| Token | Value | Currently used for |
|---|---|---|
| `--ink` | `#14171B` | Page/body background |
| `--ink-soft` | `#1C2027` | Slightly lighter panel backgrounds |
| `--ink-line` | `#2A2F38` | Borders, dividers |
| `--parchment` | `#EFE7D6` | Character-sheet-style panel backgrounds |
| `--parchment-line` | `#D9CBA8` | Parchment-panel borders |
| `--text-light` | `#E9E4D8` | Primary text on dark backgrounds |
| `--text-dim` | `#9AA0A8` | Secondary/muted text |
| `--text-dark` | `#241F18` | Text on light (parchment/brass) backgrounds |
| `--brass` / `--brass-bright` | `#B9975B` / `#D8BA83` | Primary accent — buttons, toggled states, the Map's "occupied" tile fill |
| `--ember` / `--ember-bright` | `#A34B36` / `#C1604A` | Secondary accent — destructive/warning-adjacent buttons, error banners |
| `--sage` | `#7C9070` | Defined, barely used yet |

This is the ink/parchment/brass "old tabletop" look that's been in place since the app's earliest sessions — reasonable as a functional default, but not a considered art direction. When a real visual pass happens, this whole table is the starting point for what changes.

---

## Open threads

- The 4-category Ally/Mini-Party/Allied-Party/Allied-Mini-Party color extension mentioned above — genuinely undesigned past "keep hue, vary line style." See `ROADMAP.md`, Movement System item I.
- Whether/how the Tier 5 palette actually gets applied to the Roster's Possessor grid, Character View, or elsewhere — not scoped yet.
- The base.css redesign itself has no scope or direction yet beyond "it's changing" — worth a real conversation before touching it, same as any other big design thread in `ROADMAP.md`.
