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
  state.js              in-memory app state + local (per-browser) "remember my session"
  utils.js              shared helpers (ids, tick math, name shorthand)
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

## One honest thing to watch for

Rendering happens whenever a realtime update arrives — including your *own* writes, since Supabase's realtime fires for any change to the row, not just ones from other clients. That keeps "when does the screen update" consistent for everyone, but it means there's a small round-trip (usually well under half a second) between clicking something and seeing it happen, rather than an instant local update. If that ever feels laggy in practice, the fix is adding an optimistic local render inside `mutateTable()` in `sync.js` — flagged there as a possible next step, not done yet since it adds a bit of complexity around double-rendering.

## Also not done yet (known, not accidental)

- Block still doesn't actually reduce incoming damage during Resolve — same limitation as the prototype, next real system to build.
- No automatic starting position variety on the map — everyone spawns at (0,0) and moves from there.
- Combat/Sequencer/DM panel content hasn't been tested against a live Supabase project yet, since I don't have credentials to run one. The single-file prototype's logic was proven; this port follows it closely, but the Supabase integration layer specifically is the part most likely to need a debugging pass once it's actually connected.
