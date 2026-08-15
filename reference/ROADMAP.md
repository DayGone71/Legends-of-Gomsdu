# Roadmap

Legend: **\[Ready\]** clear enough to build directly. **\[Discuss\]** flagged as needing a live conversation before building. **\[Resolved\]** clarified, folded into the plan below.

---

## Character Panel

-   **\[Discuss\]** Figure out what the auto-save behavior is actually doing (debounced save-on-edit) — flagged as confusing during testing; not yet a defined fix, just needs explaining/deciding. One concrete finding from this pass: `ch-recovery`, `ch-control`, and `ch-attunement` aren't wired to the autosave-on-input listener at all (only affects direct field edits — loading a build or hitting "Make Active Character" still saves those fields correctly), worth folding into whatever this discussion decides.

## Combat Panel

-   **A \[Discuss\]** Expand the Control/AP-cost logic to actually scale across 0–9, not just the current binary (0 = normal cost, 10 = 1 AP flat). Needs a real formula.
-   **B \[Ready\]** Hovering a defeated (crossed-out) enemy chip fades in a small red X; clicking it removes that specific enemy from the panel — a per-enemy version of "clear the dead," not just the DM's bulk action.
-   **C \[Ready\]** Attack/Block/Essence submenus should always start collapsed when the Combat panel opens, rather than remembering whatever state they were left in.
-   **D \[Discuss\]** Block, Maintain, and Counter all currently display "+5 AP" with no visual distinction between them — worth a pass on clarity.
-   **E \[Ready\]** A real staged-actions list beneath Commit, each entry with its own red X for individual removal — Undo currently only pops the most recent staged action, this allows removing any of them directly.

## Sequencer Panel

-   **A \[Discuss\]** No specific asks yet, but flagged as needing a visual overhaul.

## Dungeon Master Panel

-   **A \[Ready\]** New: a Template List dropdown for whole **encounters** (not individual characters) — sits above Start/End Encounter, paired with an Encounter Name field and a Save Encounter button. Distinct from the existing per-character Saved Characters system; this saves/loads a full enemy roster at once.
-   Everything else in this panel mirrors the Combat panel items above one-for-one: per-enemy hover-X removal, submenus defaulting to collapsed, the locked Block checkbox, the +5 AP display question, and a staged-actions list with individual removal.
-   No "Discard round" equivalent exists here currently, and given it's being removed from Combat as a testing leftover, there's no need to add one here either.
-   **B \[Discuss\]** The Ledger currently broadcasts everything to every player, including things a player character wouldn't actually know yet — e.g. "Human Bandit #2 sets a Target Block with Counter" is visible to everyone the moment it's staged, not just the DM. Some information (enemy Blocks/Counters armed but not yet triggered, at minimum) probably needs to stay DM-only until it actually resolves, rather than spoiling the bet the moment it's set.

## Party System (new)

-   **A \[Ready\]** "Add AI Party Member" button.
-   **B \[Ready\]** "Remove Party Member" button, for any party member that isn't the human player themselves.
-   **C \[Discuss\]** The mini-Party system as a whole — this is the big one. Specific threads to work through together:
    -   **Free-Will Characters** — party members with genuine independent agency.
    -   **Possessed Characters** — party members whose actions are actually driven by another character, directly mechanizing the existing "Possession: the Two Voices" lore rather than inventing something new.
    -   **Control as the mini-DM solution** — a leader's Control stat governing their capacity to direct Possessed followers, reframing "one player controls several sheets" through an already-established lore mechanic instead of a bolted-on UI convenience.
    -   **An AI Character system** for Free-Will followers specifically, who aren't Possessed and need to act with some independence.
    -   **The Above/Below relationship** between Possessed and Free-Will characters — not yet defined, worth naming explicitly as its own design question.
    -   **AI-driven Possession backdoor** (seeded 2026-08-14, notes only): give a Claude Code instance a way to actually play a character — Gom taking direct control for a set token budget, with some soft-lock on the possessed player's own options while it's active. The base mechanic stays built for humans; a Claude instance only gets summoned when there's an in-fiction reason to, not by default. Sparked by confirming live chat round-trips through the Ledger (Claude posting/replying to a human player) work over realtime Supabase with no manual refresh.

## Movement System

-   **A \[Ready, once built\]** The Map should show enemies from the current Encounter, the core Player Party, and any individual player's mini-Party all at once.
-   **B \[Ready, once built\]** Proper support for more than one — up to five — characters sharing a single Tile (partially already true by omission in the current code; needs to be made deliberate and robust).
-   **C \[Discuss\]** Formation, Obstruction, Corpse Piles, and how angle/positioning factor into combat outcomes. Entirely open.

## Stats

-   **A \[Discuss, foundational\]** **Life** — the final stat, and the only true binary (0 or 1). Living Stone = 1, Molten Ones = 0. Disembodied Gom and the Dark Cloud (present-day Kulkrow) are both Life-0 examples — not because they're weak, but because Life measures independent embodied existence, not power. A Life-0 character can still act fully as a **Possessor**, with all their other stats valid — and can also be on the *receiving* end of Possession themselves. One open thread: "characters can have maxed-out Wounds, or sustained Wounds beyond what should be possible" — genuinely unclear to me what this means mechanically yet, worth explaining further before it gets built. (The field itself — a plain 1/0 on the Character sheet — is built now, see the **\[Resolved\]** entry under Character Panel; this entry is about the underlying mechanics, which are still entirely open.)
-   **B \[Discuss, foundational\]** **Control-substitution** — a Control-0 character in a player's mini-Party has to be Possessed to act at all, borrowing their Possessor's Control. Possession is described as being "more about the relation between Focus and Control" specifically. A lighter-weight version also exists: spending Control Points to temporarily "boost" or command a Free-Will character for a specific task, short of full Possession.
-   **C \[Resolved\]** **Control baseline** (established 2026-08, previously undocumented — this is that documentation): a normal human sits at **Control 6**. Above-average/trained characters run higher — Sir Reginald Wallop III was corrected up to Control 7 during this pass. Matters a lot mechanically since `apCostForControl` (11 − Control, clamped 1–10) means each point of Control swings action AP cost hard — Control 4 vs. 7 is 7 AP vs. 4 AP per base action, nearly double.
-   **D \[Resolved\]** **Power scale vs. codex, corrected** — flagged this session as a possible mismatch (codex describes small "Power," current Builds range 1–74), but that's terminology drift, not a real gap: the codex was written in its first 2-3 days and kept evolving since. What the codex called "Power" (hits for 1, hits for 2) is what today's bracketed **Damage** output is — the "1 and 2" were about how many hits it takes to take a character out, not a literal fixed Wounds number. Confirmed the bracket lands in the right zone: 4 Wounds one-shotting a 3-Wound character, or landing twice against an 8-Wound character, both read as correct. Later systems (armor, special abilities) will factor into this further.
-   **E \[Resolved\]** The flat **+1 Wounds for Strong Attack**, layered on top of the bracketed Damage value — flagged as maybe reading oddly, but confirmed intentional and good: Strong Attack was always meant to hit noticeably harder (conceptually closer to double), and against the Power→Damage bracket's scale, +1 lands about right. `powerToDamage()`'s divisor was also tuned from ÷5 to ÷10 during this pass (in `js/utils.js`) for the same overall calibration.
-   **F \[Discuss, foundational\]** **Control tiers + a Wounds debuff** — recalled as "somewhat thought out" but not pinned down: Control 4-9 were meant to tie into some general tier list (beyond just the Control 6 human baseline above), and a character above some Wounds threshold was meant to take a Control debuff, reflecting how being badly hurt degrades composure/precision. Neither the tier boundaries nor the Wounds threshold are defined yet — needs a real conversation before it's buildable.

## Test Panel

-   \*\*\[\]

## Misc

-   Naming pass needed on "mini-Party," "Free-Will Characters," and "Possessed Characters" — current terms are working labels, not final.

## Experiments

-   **First Experiment, redefined as simulating the First War itself:**
    -   Gom and Kulkrow can Wound each other but can never reduce each other's Life to 0 — a hard rule enforced by the engine, not just agreed on in fiction.
    -   Molten Ones require Possession to act at all; Living Stone likewise require Gom (or Kulkrow, for Molten Ones) to substitute Control.
    -   Requires the Party System to actually run — a mini-Party stands in for each brother's forces.
    -   Possessing a Molten One or Controlling a Living Stone are themselves tied to Lava/Lightning spells respectively, not a free automatic ability.
-   **Second Experiment, simulating the Second War:**
    -   Slightly revised versions of the same four sheets, plus new ones for Mud People, Crystal Beings, and the Melting Titan.
    -   Mostly an expansion of Focus/Flow mechanics already in play, leading into Special Abilities.
    -   Expected to be a moderate step up from the First Experiment, not a huge leap.
-   **Experiments Three through Five** all require the Movement System to exist first.
-   **Both the First and Second Experiments** need the Party System and the Stat update (Life, Control-substitution) in place before they count as actually "successful" — the basic combat proof from this session was real progress, but isn't the finish line for either experiment as now scoped.