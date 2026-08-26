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

## Where to actually orient yourself

This file is a map of the code, not the game. For what's currently being worked on, what's already built, and how any given system actually behaves, start in `reference/`:

- **[reference/HANDOFF.md](reference/HANDOFF.md)** — written at the end of each work Session for whoever picks it up next. The fastest way to see current state.
- **[reference/ROADMAP.md](reference/ROADMAP.md)** — live planning only, edited constantly.
- **[reference/CHANGELOG.md](reference/CHANGELOG.md)** — the historical record, dated, with real reasoning kept alongside each entry — more reliable than reading the code cold if you want to know *how* something works.
- **[reference/CYCLES.md](reference/CYCLES.md)** — what a whole multi-Session Cycle accomplished and what changed about process, written once per Cycle.
- **[reference/VISION.md](reference/VISION.md)** / **[reference/gomsdu-codex.md](reference/gomsdu-codex.md)** — the big-picture build order and the world/lore this all serves.
- **[reference/style-guide.md](reference/style-guide.md)** — the tiebreaker for any color/design question.

## Structure

```
index.html          shell + panel markup
css/
  base.css             variables, buttons, resets
  layout.css           landing screen, toolbar, persistent Ledger/Map area
  panels.css           panel/modal system, character sheet, combat, sequencer, DM, map grid
js/
  config.js              your Supabase credentials go here
  supabaseClient.js      connection, load/save, realtime subscription
  sync.js                mutateTable() — the one function everything uses to change shared state,
                         with optimistic-concurrency versioning against write collisions
  state.js               in-memory app state + per-tab "remember my session" (sessionStorage)
  utils.js               shared helpers (ids, tick math, rosters, Power→Damage bracket)
  main.js                entry point — wires every button, owns the render loop
  panels.js              open/close the contextual panels

  character.js            builds, character sheet, spawnCharacter()
  combat.js                target range, staging, the Global Counter resolve engine
  noncombat.js              the Non-Combat Round — Move, Message, Behavior resolution
  techniques.js              Technique staging, panel-agnostic (Combat and Non-Combat both)
  craftPopup.js               Map click-to-craft popup
  dm.js                        DM/TATA panel — enemy spawning, Acting-As, Encounter start/end
  map.js                        grid rendering, click-to-move, Tile coloring, Facing
  sequencer.js                  the persistent Master Panel — timeline, staged-action markers
  ledger.js                      chat log + roster
  party.js / possession.js / possessionView.js   Mini-Party, Possession/Shadow-Link
  scenes.js                       Scene loading, Spawn Lists, seedScene()
  scripts.js                       Write/Assign Script panel
  information.js / personality.js / relationships.js / behaviors.js
                                   the Personality build — Mindeye/Glyph memory, Heart/Stomach/
                                   Head, Attachment/Desire, Pursuit/Longing Behavior weighting
  activeCharacter.js               Active Character display (TATA puppeting)
  characterView.js                 read-only Character Sheet viewer
  savedCharacters.js / savedEncounters.js / dmtest.js   DM Test panel tooling

language/              the Wimbis Glyphic System — its own standalone toolchain
  gomsdu-glyphic-system.json      the real language data (Primitives, Words, grammar, corrections)
  gomsdu-compositions.json        saved Compositions (sentences/rituals)
  gomsdu-glyph-viewer.html / -arranger.html / -designer.html   disposable authoring tools

oc/oc-protocol.js      Claude-as-collaborator helper module, never imported by the game itself —
                       see reference/HANDOFF.md's OC protocol note before using it

prototypes/             disposable, standalone HTML/JS experiments, no dependency on the live game

tools/                  Python spreadsheet↔JSON pipeline for bulk-authoring Characters/Techniques
data/                   the JSON the game actually fetch-loads (characters.json, techniques.json)
                       and the .xlsx spreadsheet that authors them
```

## One honest thing to watch for

Rendering happens whenever a realtime update arrives — including your *own* writes, since Supabase's realtime fires for any change to the row, not just ones from other clients. That keeps "when does the screen update" consistent for everyone, but it means there's a small round-trip (usually well under half a second) between clicking something and seeing it happen, rather than an instant local update.

Session identity is per-**tab**, not per-window-you-think-you-closed: it uses `sessionStorage`, so two tabs open to the same table are always independent (no more "why did I turn into someone else"), but a closed tab really is gone — there's no "remember me" across a closed-and-reopened tab, only across a reload of the same one.
