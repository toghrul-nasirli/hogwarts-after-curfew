# Hogwarts: After Curfew ⚡

A first-person Hogwarts you can wander at night, built with [Three.js](https://threejs.org).
Everything — the castle, textures, sounds — is generated from code. No assets, no build step.

**▶ Play it now: https://toghrul-nasirli.github.io/hogwarts-after-curfew/**

> A fan-made tribute for private fun. Not affiliated with Warner Bros. or J.K. Rowling.
> Please don't distribute or commercialize it.

## Run it

**Easiest:** double-click `HogwartsAfterCurfew.html` — a self-contained build that works
straight from the file system, no server needed. (Rebuild it after code changes:
`npx esbuild src/main.js --bundle --format=iife --minify --outfile=/tmp/b.js` and re-inline,
or ask Claude.)

**Dev setup:**

```bash
cd hogwarts
npm start          # serves on http://localhost:8123
```

Then open **http://localhost:8123** in Chrome (best) or any modern browser, click to enter,
and turn your sound on. (`npm start` just runs `python3 -m http.server 8123` — any static
file server works. Note: `index.html` itself won't work over `file://` — browsers refuse to
load JS modules from plain files; use the standalone build for that.)

## How to play

| Input | Action |
|---|---|
| `W A S D` / arrows | Walk |
| Mouse | Look |
| `Shift` | Run |
| `Space` | Jump |
| `1`–`5`, `0` | Select spell |
| Left click | Cast the selected spell |
| `E` | Open / close doors |
| `Esc` | Pause (click to resume) |

### The six spells

- **Lumos** `1` — lights your wand-tip. You'll need it in the dungeons.
- **Nox** `2` — puts the wand-light out.
- **Alohomora** `3` — unlocks the door you're looking at (the Castle Gate, the Charms
  Classroom, the Potions Store…).
- **Incendio** `4` — sets fire to unlit sconces and candelabras all over the castle:
  the dungeon torches, the Great Hall table candles, the classroom and potion-store
  candelabras…
- **Aguamenti** `5` — a jet of water that douses anything Incendio can light.
- **Expecto Patronum** `0` — conjures a silver stag that charges ahead and banishes
  Dementors. Don't let them touch you, or you'll wake up in the Entrance Hall with
  a mouthful of chocolate.

The objective panel (top-left) walks you through all four. After that, the castle is yours:
the Great Hall with its floating candles and enchanted ceiling, the Grand Staircase with its
swinging stairs and portraits, the east corridor, the classroom, the dungeon cells, and
Snape's potion store.

## Project layout

```
index.html        page, HUD, styles
libs/             vendored three.js (module build)
src/
  main.js         bootstrap, quest line, game loop, __game debug hooks
  world.js        the whole castle: geometry, colliders, doors, lights (map in header comment)
  player.js       first-person controller + collision
  spells.js       wand, the four spells, sparkles, door interaction
  creatures.js    Dementors + the Patronus stag
  ui.js           HUD (objective, captions, spell bar, chill vignette)
  audio.js        WebAudio-synthesized sound (wind, spells, doors, Dementor drone)
  textures.js     procedural canvas textures (stone, wood, sky, banners, portraits)
qa/shot.mjs       headless-Chrome screenshot/playtest harness (node qa/shot.mjs all)
```

## QA harness

With the server running and Google Chrome installed:

```bash
node qa/shot.mjs all           # every scenario → qa/shots/*.png + state + console errors
node qa/shot.mjs great-hall patronus
```

The page exposes `window.__game` (teleport, cast, state, openAll, noCatch) for scripted testing.
