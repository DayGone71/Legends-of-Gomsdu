# Style Guide

A running record of what's *confirmed* (built with real intent, don't change without dDd's say-so) versus *expendable* (whatever's currently in the CSS because something had to be there, no design decision behind it) — kept separate from `ROADMAP.md` because this is about **how things look**, not what they do. Started 2026-08-16, after the first real color/CSS design conversation this project has had (there was one earlier brainstorm about Gom/Kulkrow colors and the game's visual identity — maybe captured in `gomsdu-codex.md`, maybe not, per dDd — nothing found there as of this writing, so this doc is the first place it's actually written down).

**Every hex code below has a small swatch right next to it** (`<span style="...background:#hex...">`) so colors are visible at a glance, not just codes to mentally decode — added 2026-08-16 per dDd's ask. Renders in GitHub and any markdown viewer that allows inline HTML (VS Code's preview included); shows as plain text in a raw editor.

---

## Confirmed

Everything below was a deliberate design decision, not a placeholder. Changing it should be a real conversation, not a drive-by refactor.

### Map Tile coloring (built 2026-08-16)

Two gradients layer on every Map Tile, driven by inline CSS custom properties computed in [js/map.js](../js/map.js)'s `renderMap()`, consumed by static rules in [css/panels.css](../css/panels.css):

- **Burgundy — Down Characters.** Creeps in from the Tile's edge, never reaching the center, as Down/Obliterated Characters (either side) pile up, 1-5.
  <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#BF527F;border:1px solid #888;vertical-align:middle;"></span> `#BF527F` (1) →
  <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#A84F76;border:1px solid #888;vertical-align:middle;"></span> `#A84F76` (2) →
  <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#8F3B65;border:1px solid #888;vertical-align:middle;"></span> `#8F3B65` (3) →
  <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#7C2856;border:1px solid #888;vertical-align:middle;"></span> `#7C2856` (4) →
  <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#6B1747;border:1px solid #888;vertical-align:middle;"></span> `#6B1747` (5, deepest/closest to center)
- **Pink — Chunks.** Spreads out from the center, opposite direction from Burgundy, as Chunks (see the Chunk Mechanic, `ROADMAP.md` → Movement System item I) pile up, 1-40 in 8 bands of 5. dDd's exact anchor colors sit at the 10/20/30/40 marks; the other 4 are interpolated between them (his own call — "a creative call on your part").
  <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#FFC4E0;border:1px solid #888;vertical-align:middle;"></span> `#FFC4E0` (1-5) →
  <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#FF9DCE;border:1px solid #888;vertical-align:middle;"></span> `#FF9DCE` (6-10, dDd's) →
  <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#FF8FC5;border:1px solid #888;vertical-align:middle;"></span> `#FF8FC5` (11-15) →
  <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#FF82BC;border:1px solid #888;vertical-align:middle;"></span> `#FF82BC` (16-20, dDd's) →
  <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#FF78B5;border:1px solid #888;vertical-align:middle;"></span> `#FF78B5` (21-25) →
  <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#FF6FAE;border:1px solid #888;vertical-align:middle;"></span> `#FF6FAE` (26-30, dDd's) →
  <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#F965A6;border:1px solid #888;vertical-align:middle;"></span> `#F965A6` (31-35) →
  <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#F45A9F;border:1px solid #888;vertical-align:middle;"></span> `#F45A9F` (36-40, dDd's)
  At 30+ Chunks, a soft glow (`box-shadow`) bleeds past the Tile's own box into its neighbors — **pure CSS bleed, confirmed no data movement**: the Chunk count itself always stays on the Tile it happened on.
- **Active-Character edges.** A ring around the Tile signaling crowding at a glance: 3+ Allies or 3+ Enemies (same threshold that drives the actual movement-block — see `ROADMAP.md`). Enemy wins if both apply on the same Tile at once. **Recolored 2026-08-16 (CC5)** — the original green/cyan pairing here turned out to be an unconsidered proof-of-concept pick, not a real design decision, despite being filed under "Confirmed" (dDd, on actually seeing it live: "not sure why they got logged"). Superseded by the Enemy/Ally/Self pass below — the mechanic is unchanged, only the colors moved.

### Enemy / Ally / Self colors (confirmed 2026-08-16, CC5)

Grew out of designing the Sequencer's staged-action marks (see `ROADMAP.md`, Sequencer Panel item A), then correctly identified as also being the fix for the Map's own crowding rings above, which never got a real pass. All three, plus Gom/Kulkrow below, follow one rule: **hue carries *concept*** (who/what something is), **shape and fill/outline carry finer distinctions within a concept.** That's what keeps the palette from needing a new hue every time a category gets one level more specific — side already gets `\`/`/` for free in the Sequencer's marks, so hue doesn't have to also carry side.

- **Green — Self.** The one Character on the board that's *you*, specifically — not "your side" (that's Ally, below). A deliberate split: a Player who is also an Ally still needs a way to spot their own Character at a glance, which collapsing Self into Ally's hue would erase. Reuses the old Ally-ring's exact green rather than picking something unrelated — dDd's own call, "the perfect color for self... especially with the Lore." The meaning narrows from "your whole side" to "exactly you."
  <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#2ECC71;border:1px solid #888;vertical-align:middle;"></span> `#2ECC71`
- **Cyan — Ally.** Other Players, and their statted Mini-Party members (see `ROADMAP.md`, Combat Panel item H's Ally Targeting System). Reuses the old Enemy-ring's cyan — a much better fit for a friendly signal than a hostile one, which was exactly what read wrong about the original assignment.
  <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#22D3EE;border:1px solid #888;vertical-align:middle;"></span> `#22D3EE`
  **Sub-split, not yet built:** a real Ally vs. their own Mini-Party member both stay Cyan — solid fill for the Ally, hollow/outline for the Mini-Party member — the first real planned use of the hue-conservation principle below, once it's actually needed somewhere.
- **Yellow — Enemy.** A fresh hue, picked for enough distance from Brass (<span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#B9975B;border:1px solid #888;vertical-align:middle;"></span> `#B9975B` / <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#D8BA83;border:1px solid #888;vertical-align:middle;"></span> `#D8BA83` — muted, far less saturated) to read clearly, and to avoid the previous cyan's friendly-not-hostile mismatch.
  <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#F5C518;border:1px solid #888;vertical-align:middle;"></span> `#F5C518`

**Applied live 2026-08-16:** the Map's crowding rings (`.map-tile.edge-ally`/`.edge-enemy` in [css/panels.css](../css/panels.css)) now use Ally-Cyan and Enemy-Yellow. Self doesn't have a live UI slot yet — no per-Character "this is you" indicator exists anywhere — so its Green is locked here, ready for whenever one gets built (the Sequencer's staged-action marks are the likeliest first use). **Rule going forward: before introducing a new UI color, check it against this whole list first.**

### Tier 5 palette (Gom / Kulkrow) — tokens only, not yet wired into UI

Defined as CSS custom properties in [css/base.css](../css/base.css)'s `:root`. Ordering is intentional: 1 = Primary, 2 = Secondary, 3 = Tertiary.

| | Primary | Secondary | Tertiary |
|---|---|---|---|
| **Gom** | `--gom-primary` <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#F5F5F0;border:1px solid #888;vertical-align:middle;"></span> `#F5F5F0` (white) | `--gom-secondary` <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#4A90D9;border:1px solid #888;vertical-align:middle;"></span> `#4A90D9` (blue) | `--gom-tertiary` <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#2E2A6E;border:1px solid #888;vertical-align:middle;"></span> `#2E2A6E` (indigo) |
| **Kulkrow** | `--kulkrow-primary` <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#E8792E;border:1px solid #888;vertical-align:middle;"></span> `#E8792E` (orange) | `--kulkrow-secondary` <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#B0281E;border:1px solid #888;vertical-align:middle;"></span> `#B0281E` (red) | `--kulkrow-tertiary` <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#000000;border:1px solid #888;vertical-align:middle;"></span> `#000000` (true black) |

**Codex cross-reference (a good sign, not a coincidence to chase further):** `gomsdu-codex.md` independently describes Gom's first form as a "White Orb" made of Lightning, and Kulkrow as originating from "pure Blackness... a literal tear in reality," made of Lava — lava reads orange/red-hot, which is exactly the primary/secondary picked here, with true black held back for the rarer, more significant association (see below) rather than spent on his everyday palette.

**True black is deliberately rare.** Per dDd: *"Black is the rarest color in the Universe in game."* Every other dark tone anywhere in the UI — `--ink`, `--ink-soft`, the Map's blocked-Tile color — is a charcoal, never pure `#000000`, specifically so literal black stays meaningful when it does show up (Kulkrow's tertiary here; the codex's own **Black Stone Shield**, "the only colorless material on the Planet," is a nice narrative echo of the same rule). **Don't use `#000000` anywhere else without checking in first.** (The landing-page wave art's Kulkrow gradient stop uses <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#1A1A1A;border:1px solid #888;vertical-align:middle;"></span> `#1A1A1A` instead of true black for exactly this reason — pure black would've just faded into the page background.)

**Not wired into any UI element yet** — e.g. the Roster's Possessor icons still use plain circle glyphs (●/○/⊙), not color. Whenever that gets built, these are the values to reach for.

### General principles worth carrying forward

- **"The game is supposed to have a very colorful look"** — dDd's own words, stated while designing the Friend/Foe edges. Don't default to a muted/monochrome palette when adding new visual features; err toward more color, deliberately chosen.
- **Hue is the primary signal, line/fill style is the scaling axis.** When a category needs to split further (e.g. Ally → "my Party" vs. "my Mini-Party" vs. "an Allied Party"), the plan is to keep the same hue per side and vary border style (solid vs. dashed, etc.) rather than mint a new color each time — hues run out fast, line-style doesn't. Not built yet (see `ROADMAP.md`, Movement System item I's last bullet), but the intended pattern for whenever it is.

---

## Expendable

Everything in [css/base.css](../css/base.css)'s `:root` below is the *original* placeholder theme — functional, never actually art-directed, and per dDd (2026-08-16), **all of it is getting replaced**. Safe to redesign freely; nothing here should be treated as a locked decision the way the Confirmed section is.

| Token | Value | Currently used for |
|---|---|---|
| `--ink` | <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#14171B;border:1px solid #888;vertical-align:middle;"></span> `#14171B` | Page/body background |
| `--ink-soft` | <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#1C2027;border:1px solid #888;vertical-align:middle;"></span> `#1C2027` | Slightly lighter panel backgrounds |
| `--ink-line` | <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#2A2F38;border:1px solid #888;vertical-align:middle;"></span> `#2A2F38` | Borders, dividers |
| `--parchment` | <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#EFE7D6;border:1px solid #888;vertical-align:middle;"></span> `#EFE7D6` | Character-sheet-style panel backgrounds |
| `--parchment-line` | <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#D9CBA8;border:1px solid #888;vertical-align:middle;"></span> `#D9CBA8` | Parchment-panel borders |
| `--text-light` | <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#E9E4D8;border:1px solid #888;vertical-align:middle;"></span> `#E9E4D8` | Primary text on dark backgrounds |
| `--text-dim` | <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#9AA0A8;border:1px solid #888;vertical-align:middle;"></span> `#9AA0A8` | Secondary/muted text |
| `--text-dark` | <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#241F18;border:1px solid #888;vertical-align:middle;"></span> `#241F18` | Text on light (parchment/brass) backgrounds |
| `--brass` / `--brass-bright` | <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#B9975B;border:1px solid #888;vertical-align:middle;"></span> `#B9975B` / <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#D8BA83;border:1px solid #888;vertical-align:middle;"></span> `#D8BA83` | Primary accent — buttons, toggled states, the Map's "occupied" tile fill |
| `--ember` / `--ember-bright` | <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#A34B36;border:1px solid #888;vertical-align:middle;"></span> `#A34B36` / <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#C1604A;border:1px solid #888;vertical-align:middle;"></span> `#C1604A` | Secondary accent — destructive/warning-adjacent buttons, error banners |
| `--sage` | <span style="display:inline-block;width:13px;height:13px;border-radius:3px;background:#7C9070;border:1px solid #888;vertical-align:middle;"></span> `#7C9070` | Defined, barely used yet |

This is the ink/parchment/brass "old tabletop" look that's been in place since the app's earliest sessions — reasonable as a functional default, but not a considered art direction. When a real visual pass happens, this whole table is the starting point for what changes.

---

## Open threads

- **"Blood" is a hue *family*, not one color** — Down (burgundy) and Chunks (pink) are both already reds-in-spirit representing the same underlying concept at different shades. Wounds is confirmed to join that same family rather than get an unrelated hue, but its specific shade isn't picked yet. **Correction, 2026-08-16 (CC5):** this was briefly mis-linked to the Sequencer's staged-action slash marks — it isn't. The slashes turned out to be purely Self/Ally/Enemy (shape = friendly vs. hostile, color = which of the three), no effect-type hue involved at all. Wounds' shade (and Support's, below) stay open for whatever their actual eventual use turns out to be, just not this.
- **Support's hue** — mentioned as a category during the Sequencer color pass, not designed yet, and (per the correction above) not actually needed there either. Still genuinely undesigned for wherever it does end up being used.
- **Ally vs. its own Mini-Party Member (solid/hollow Cyan) — deferred out of the Sequencer slash-marks pass specifically, 2026-08-16 (CC5).** The distinction itself is still the plan (see Enemy/Ally/Self above), just not built into the Sequencer yet — plain solid Cyan covers both there for now, no visual difference between a real Ally and their Mini-Party member until this gets picked back up.
- The 4-category Ally/Mini-Party/Allied-Party/Allied-Mini-Party color extension mentioned above — Allied Party / Allied Mini-Party (a *different* Player's side, not your own) is still genuinely undesigned. See `ROADMAP.md`, Movement System item I.
- Whether/how the Tier 5 palette actually gets applied to the Roster's Possessor grid, Character View, or elsewhere — not scoped yet, though the Sequencer's Lightning/Lava marks (Gom/Kulkrow-colored) are the first concrete plan to actually wire it into gameplay UI.
- The base.css redesign itself has no scope or direction yet beyond "it's changing" — worth a real conversation before touching it, same as any other big design thread in `ROADMAP.md`.
