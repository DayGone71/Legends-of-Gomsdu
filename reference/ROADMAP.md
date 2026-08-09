# Roadmap

Legend: **[Ready]** clear enough to build directly. **[Discuss]** flagged as needing a live conversation before building. **[Resolved]** clarified, folded into the plan below.

---

## Character Panel
- **[Resolved, no code needed]** "Save as Template" button text/visual glitch — raised twice now (once directly, once via Testing Notes.txt), confirmed both times as a chat-interface rendering artifact, not a real bug in the app.
- **[Resolved]** Swap Flow and Wounds: Wounds now stands alone (where Flow used to sit), Flow moved into the Form grid alongside AP and Recovery as a single number. The sheet's single Flow field edits the character's rating (flowMax); current mid-combat Flow is preserved separately and just clamped down if the new max is lower.
- **[Discuss]** Figure out what the auto-save behavior is actually doing (debounced save-on-edit) — flagged as confusing during testing; not yet a defined fix, just needs explaining/deciding. One concrete finding from this pass: `ch-recovery`, `ch-control`, and `ch-attunement` aren't wired to the autosave-on-input listener at all (only affects direct field edits — loading a build or hitting "Make Active Character" still saves those fields correctly), worth folding into whatever this discussion decides.
- **[Resolved]** Add a Life stat: plain 0/1 field added next to Control/Attunement, defaults to 1 everywhere. The deeper Life mechanics stay **[Discuss, foundational]** in the Stats section below — this was just the field.
- **[Resolved]** Renamed the "Saved" group in both the sheet's and DM's build pickers to "Custom".
- **[Resolved]** New "Make Active Character" button, placed above Name and below Load a Build. Loading a build (or a Custom template) now only fills the form for preview — it no longer autosaves — and this button is the explicit commit that makes it the live player.
- **[Resolved]** Sheet's stat ranges now match reference/gomsdu-stats.odt (AP 0–100, Flow/Power/Recovery/Quickness/Range 0–50, Essence stats 0–10, Life 0–1) — enforced both as HTML min/max and as real clamping on save, not just decorative. Wounds deliberately left unclamped, pending the separate Wounds-model rebuild below.

## Combat Panel
- **[Discuss]** Expand the Control/AP-cost logic to actually scale across 0–9, not just the current binary (0 = normal cost, 10 = 1 AP flat). Needs a real formula.
- **[Ready]** Hovering a defeated (crossed-out) enemy chip fades in a small red X; clicking it removes that specific enemy from the panel — a per-enemy version of "clear the dead," not just the DM's bulk action.
- **[Ready]** Attack/Block/Essence submenus should always start collapsed when the Combat panel opens, rather than remembering whatever state they were left in.
- **[Ready]** The base Block checkbox should be locked permanently checked, not a real toggle — Maintain and Counter stay optional on top of it.
- **[Discuss]** Block, Maintain, and Counter all currently display "+5 AP" with no visual distinction between them — worth a pass on clarity.
- **[Ready]** A real staged-actions list beneath Commit, each entry with its own red X for individual removal — Undo currently only pops the most recent staged action, this allows removing any of them directly.
- **[Resolved]** Remove the "Discard round" button — confirmed as a leftover from earlier combat playtesting, not something to keep.

## Sequencer Panel
- **[Discuss]** No specific asks yet, but flagged as needing a visual overhaul.

## Dungeon Master Panel
- **[Ready]** New: a Template List dropdown for whole **encounters** (not individual characters) — sits above Start/End Encounter, paired with an Encounter Name field and a Save Encounter button. Distinct from the existing per-character Saved Characters system; this saves/loads a full enemy roster at once.
- Everything else in this panel mirrors the Combat panel items above one-for-one: per-enemy hover-X removal, submenus defaulting to collapsed, the locked Block checkbox, the +5 AP display question, and a staged-actions list with individual removal.
- No "Discard round" equivalent exists here currently, and given it's being removed from Combat as a testing leftover, there's no need to add one here either.

## Party System (new)
- **[Ready]** "Add AI Party Member" button.
- **[Ready]** "Remove Party Member" button, for any party member that isn't the human player themselves.
- **[Discuss]** The mini-Party system as a whole — this is the big one. Specific threads to work through together:
  - **Free-Will Characters** — party members with genuine independent agency.
  - **Possessed Characters** — party members whose actions are actually driven by another character, directly mechanizing the existing "Possession: the Two Voices" lore rather than inventing something new.
  - **Control as the mini-DM solution** — a leader's Control stat governing their capacity to direct Possessed followers, reframing "one player controls several sheets" through an already-established lore mechanic instead of a bolted-on UI convenience.
  - **An AI Character system** for Free-Will followers specifically, who aren't Possessed and need to act with some independence.
  - **The Above/Below relationship** between Possessed and Free-Will characters — not yet defined, worth naming explicitly as its own design question.

## Movement System
- **[Ready, once built]** The Map should show enemies from the current Encounter, the core Player Party, and any individual player's mini-Party all at once.
- **[Ready, once built]** Proper support for more than one — up to five — characters sharing a single Tile (partially already true by omission in the current code; needs to be made deliberate and robust).
- **[Discuss]** Formation, Obstruction, Corpse Piles, and how angle/positioning factor into combat outcomes. Entirely open.

## Stats
- **[Discuss, foundational]** **Life** — the final stat, and the only true binary (0 or 1). Living Stone = 1, Molten Ones = 0. Disembodied Gom and the Dark Cloud (present-day Kulkrow) are both Life-0 examples — not because they're weak, but because Life measures independent embodied existence, not power. A Life-0 character can still act fully as a **Possessor**, with all their other stats valid — and can also be on the *receiving* end of Possession themselves. One open thread: "characters can have maxed-out Wounds, or sustained Wounds beyond what should be possible" — genuinely unclear to me what this means mechanically yet, worth explaining further before it gets built. (The field itself — a plain 1/0 on the Character sheet — is built now, see the **[Resolved]** entry under Character Panel; this entry is about the underlying mechanics, which are still entirely open.)
- **[Discuss, foundational]** **Control-substitution** — a Control-0 character in a player's mini-Party has to be Possessed to act at all, borrowing their Possessor's Control. Possession is described as being "more about the relation between Focus and Control" specifically. A lighter-weight version also exists: spending Control Points to temporarily "boost" or command a Free-Will character for a specific task, short of full Possession.

## Misc
- Naming pass needed on "mini-Party," "Free-Will Characters," and "Possessed Characters" — current terms are working labels, not final.

## Experiments
- **First Experiment, redefined as simulating the First War itself:**
  - Gom and Kulkrow can Wound each other but can never reduce each other's Life to 0 — a hard rule enforced by the engine, not just agreed on in fiction.
  - Molten Ones require Possession to act at all; Living Stone likewise require Gom (or Kulkrow, for Molten Ones) to substitute Control.
  - Requires the Party System to actually run — a mini-Party stands in for each brother's forces.
  - Possessing a Molten One or Controlling a Living Stone are themselves tied to Lava/Lightning spells respectively, not a free automatic ability.
- **Second Experiment, simulating the Second War:**
  - Slightly revised versions of the same four sheets, plus new ones for Mud People, Crystal Beings, and the Melting Titan.
  - Mostly an expansion of Focus/Flow mechanics already in play, leading into Special Abilities.
  - Expected to be a moderate step up from the First Experiment, not a huge leap.
- **Experiments Three through Five** all require the Movement System to exist first.
- **Both the First and Second Experiments** need the Party System and the Stat update (Life, Control-substitution) in place before they count as actually "successful" — the basic combat proof from this session was real progress, but isn't the finish line for either experiment as now scoped.
