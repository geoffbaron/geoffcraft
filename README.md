# EasterCraft

A browser-based Minecraft clone built with a custom voxel engine and Three.js.

## Features

- **Procedural terrain** — hills, mountains, oceans, rivers, caves, and ore deposits generated with Perlin/FBM noise
- **Realistic flowing water** — source blocks spread downhill with per-block flow levels (meta 0–7), smooth sloped water surfaces
- **First-person controls** — WASD movement, mouse look, jump, sprint
- **Block interaction** — left-click to place, right-click to break
- **17 block types** — grass, dirt, stone, sand, water, wood, leaves, cobblestone, planks, snow, bedrock, gravel, coal ore, iron ore, glass, brick
- **Procedural pixel textures** — all textures generated at runtime with noise; no external assets required
- **Dynamic sky** — animated clouds, directional sun with shadows, fog
- **Chunk system** — 16×16×128 chunks with render distance streaming and unloading
- **Hotbar & inventory** — 9-slot hotbar, scroll-to-cycle, `E` to open inventory, `1–9` to select
- **Debug overlay** — FPS, XYZ position, chunk coordinates

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Space | Jump |
| Shift | Sprint |
| Left Click | Place block |
| Right Click | Break block |
| 1–9 | Select hotbar slot |
| Scroll Wheel | Cycle hotbar |
| E | Toggle inventory |
| Esc | Pause / release mouse |

## Running Locally

Serve the project root with any static HTTP server (needed for ES module imports):

```bash
npx serve .
# or
python3 -m http.server
```

Then open `http://localhost:3000` (or whichever port) in your browser.

## Tech Stack

- **Three.js** (via CDN import map) for WebGL rendering
- Pure ES modules — no bundler required
- Custom voxel mesher with greedy-style face culling and per-block-type texture groups
- Perlin noise implementation for terrain, caves, ores, and tree placement
