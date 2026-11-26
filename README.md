# SSBU-VS

A 1v1 rock-paper-scissors battler using the Super Smash Bros. Ultimate cast. Each turn both players secretly pick **Attack**, **Counter** or **Grab**, their fighter's unique **skill**, or a **Final Smash**.

- Attack beats Grab · Grab beats Counter · Counter beats Attack. A win deals 10.
- Attack vs Attack = clash (both take 5). Counter/Counter and Grab/Grab whiff.
- **Smash Meter** (0–8): +1 per basic action, +1 per hit taken. Public by default.
- **Skills** cost 1–3 meter, win/lose like their type, beat a basic action of the same type, and add their bonus on a win.
- **Final Smash**: spend all 8 meter for 14 unstoppable damage.
- 83 fighters, each with a passive and a skill (Miis excluded; Pokémon Trainer and Pyra/Mythra are single slots with switching kits).

## Run it

```bash
npm install
npm start          # http://localhost:3000
```

Modes: **Play vs CPU** and **online rooms** (create a room, share the 4-letter code). Deploys to Render with `render.yaml` (free web service, `npm install` / `npm start`).

Fighter art lives in `public/images/<fighter id>.png` (copied from SSBU-mon). Pokémon Trainer and Pyra/Mythra also have per-form images (`pt-squirtle.png`, `pyra-mythra.png`, …) that swap in during battle. Missing images fall back to initials.

## Battle screen

- **Left:** you · **Right:** your opponent. Each side shows player name, fighter, HP bar, Smash Meter, then that fighter's special resources (e.g. Waft bar, Golden Feathers, Luma HP, Belly Armor, KO Stars, Limit, Pikmin) and active effects.
- **Reveal:** once both players lock in, the two cards flip. The winner's card grows and glows while the loser's shrinks and dims; a clash shakes both cards together in the middle; a whiff leaves both as they are.
- **Then** HP bars drop (with a red damage trail) and Smash Meters charge or drain.
- **Battle log:** every turn lists both choices, the outcome, each hit's damage breakdown, procs, heals, statuses, Burns, meter changes and passive triggers.

## Layout

| Path | What it is |
| --- | --- |
| `src/engine.js` | Core rules and turn resolution (`RULES` holds every global number) |
| `src/fighters.js` | All 83 kits as hooks; tunable numbers live in `N` at the top |
| `src/ai.js` | CPU player: one-turn lookahead, solves the payoff matrix as a zero-sum game, then samples |
| `src/view.js` | What each player may see (Snake's meter is hidden), per-fighter resource widgets, turn reveal data |
| `data/kits.json` | Display text for every passive and skill (keep in sync with `N`) |
| `server.js` | Express + Socket.IO server: CPU games, rooms, rematches |
| `public/` | Client (fighter select with search and skill-type filter, battle screen) |
| `tools/` | Balance tooling (below) |

## Balance tools

```bash
npm test                                         # smoke test: 3 CPU games per fighter
node tools/sim.js 150 tools/results.json         # every matchup, N games each → win rate vs field
node tools/row.js mario 100 '{"mario":{"s":9}}'  # one fighter vs the field with a trial change
node tools/value.js tools/no-overrides.json 30   # value per meter: skills vs Final Smash
node tools/tune.js 3 60 2.5                       # auto-nudge outliers' skill bonus toward 50%
```

Current balance (Nov 2026, 150 games per matchup): every fighter between **47.8% and 53.2%** vs the field, and skills return the same value per meter as Final Smash (~1.76 HP).

## Known simplifications

- Byleth's Divine Pulse fires automatically on a lethal or 10+ damage turn.
- In CPU games the CPU picks Shulk's Monado Art with a simple rule; human Shulk players pick it each turn.
- The CPU knows Snake's meter in simulations (it's hidden from human opponents).
