# Gomsdu — The Table

Browser-based multiplayer RPG table. Panel-based interface, real backend (Supabase), no build step required.

## Setup

**1. Create a Supabase project** (this part has to be you — account/project creation isn't something I can do on your behalf):
- Go to [supabase.com](https://supabase.com), sign in, create a new project.
- Once it's up, open the **SQL Editor** and run everything in `supabase-schema.sql`.
- Go to **Project Settings > API** and copy your **Project URL** and **anon public** key.

**2. Add your credentials:**
- Open `js/config.js` and paste in your URL and anon key.

**3. Enable Realtime on the table** (if the SQL script's `alter publication` line didn't take):
- **Database > Replication** in the Supabase dashboard, toggle on for the `sessions` table.

**4. Run it locally.** This uses real ES modules, which browsers block from `file://` — you need a tiny local server:
```
npx serve .
```
or
```
python3 -m http.server 8000
```
Then open the URL it gives you (e.g. `http://localhost:3000` or `:8000`).

## Structure

```
index.html          shell + panel markup
css/
  base.css           variables, buttons, resets
  layout.css          landing screen, toolbar, persistent Ledger/Map area
  panels.css           panel/modal system, character sheet, combat, sequencer, DM, map grid
js/
  config.js            your Supabase credentials go here
  supabaseClient.js     connection, load/save, realtime subscription
  sync.js               mutateTable() — the one function everything uses to change shared state
  state.js              in-memory app state + per-tab "remember my session" (sessionStorage, not localStorage — see below)
  utils.js              shared helpers (ids, tick math, name shorthand, Power→Damage bracket)
  panels.js             open/close the contextual panels, gates Combat/Sequencer on encounter state
  map.js                 grid rendering, click-to-move, DM tile editing
  ledger.js               chat log + roster
  character.js             builds, character sheet
  combat.js                 target range, attack/block/essence staging, the resolve engine
  sequencer.js               the ruler + staged action markers
  dm.js                      enemy spawning, acting-as, DM staging, encounter start/end
  main.js                    entry point — wires every button, owns the render loop
```

## What's genuinely new here, not just reorganized

- **Panels.** Character/Combat/Sequencer/DM are now popups, not always-on scrolling sections. Combat and Sequencer are disabled until the DM starts an encounter.
- **Map.** A simple grid (default 10×8), traversable/blocked tiles, click-adjacent-to-move. DM has an edit toggle to paint walls.
- **Encounter state.** `inEncounter` on the session — a real on/off switch that didn't exist before.
- **Real backend.** Supabase instead of Claude's artifact storage. Realtime subscriptions replace polling.
- **Block.** General Block (timing-window, sized by Range) and Target Block (locked to one attacker) fully negate the attack they intercept — no damage at all, not a reduction. If Counter was set on that Block, the blocker also hits back for their own Power as Flow damage to the attacker.
- **Hit% persists, and Recovery actually does something.** Once a target's Flow is broken, their exposure (Hit%) now lives on the character record and carries across rounds instead of quietly resetting every time. Recovery no longer blindly refills Flow every round either — it claws Hit% back down first (double rate), and only rebuilds Flow once Hit% is back at its 1% floor. A **Rest** action (Combat panel) lets a player commit AP instead of acting to double whichever of those Recovery is currently doing, scaled by how much AP went into it.
- **Power → Damage bracket.** Wounds and Hit%-escalation are driven by a bracketed Damage value (`powerToDamage()` in `js/utils.js`), not raw Power — a 0–50 Power stat dumped straight into a 3–8 Wounds pool one-shot everything, which defeated the point of having an exposure system at all. Power vs. Flow is unaffected; only the post-Flow-break Wounds math changed.
- **Ledger, tiered.** Combat resolution entries render as a structured attacker → defender / action / result block with a Tick number, instead of one dense abbreviated sentence per hit. Full names throughout — no more shorthand like "FA" or "ES1" in the log.

## One honest thing to watch for

Rendering happens whenever a realtime update arrives — including your *own* writes, since Supabase's realtime fires for any change to the row, not just ones from other clients. That keeps "when does the screen update" consistent for everyone, but it means there's a small round-trip (usually well under half a second) between clicking something and seeing it happen, rather than an instant local update. If that ever feels laggy in practice, the fix is adding an optimistic local render inside `mutateTable()` in `sync.js` — flagged there as a possible next step, not done yet since it adds a bit of complexity around double-rendering.

Session identity is per-**tab**, not per-window-you-think-you-closed: it uses `sessionStorage`, so two tabs open to the same table are always independent (no more "why did I turn into someone else"), but a closed tab really is gone — there's no "remember me" across a closed-and-reopened tab, only across a reload of the same one.

