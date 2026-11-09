# MiniCrafter

A browser-based voxel sandbox in the spirit of block-building games. You can explore an endless procedural world, mine and build. It is plain JavaScript and [Three.js](https://threejs.org/) ES modules, with no build step and no image or audio files. Every texture and sound is generated in code.

## Features

- **Endless procedural world.** Terrain streams in 16×16×96 chunks, with plains, forests, deserts with cacti, snowy mountains, beaches, oceans, caves and ores (coal, iron, gold, diamond).
- **Fast chunk meshing.** Hidden faces are culled and voxel ambient occlusion is applied, with one draw call per chunk layer. This replaces the old one-mesh-per-block approach.
- **Real player physics.** AABB collision against blocks, walking, sprinting, jumping, swimming and creative flight.
- **Building.** Voxel raycasting picks blocks precisely, a selection outline shows the target, and holding a mouse button breaks or places repeatedly. Middle-click picks a block.
- **29 block types.** They include grass, stone, ores, logs, leaves, glass, bricks, wool, lamps, water and more, all drawn as procedural pixel art.
- **Hotbar and inventory.** 9 slots with isometric block icons, the mouse wheel or 1–9 to select, and `E` for the full block picker.
- **Day/night cycle.** The sky colour changes, with sunsets, a sun and moon, stars, and drifting clouds.
- **Water.** It is translucent, with an underwater fog effect and swimming.
- **Auto-save.** Seed, edits, player position, hotbar and time of day are kept in `localStorage`. You can start a new world with any text or number seed.
- **Settings.** Render distance (3–12 chunks), mouse sensitivity and FOV.
- **Debug screen.** `F3` shows FPS, coordinates, chunk, biome, target block and draw calls.

## Controls

| Action | Control |
| :--- | :--- |
| Move | `W` `A` `S` `D` / arrow keys |
| Look | Mouse |
| Jump / swim up / fly up | `Space` |
| Sprint (fly down while flying) | `Shift` |
| Toggle flying | `F` |
| Break block (hold to repeat) | Left click |
| Place block (hold to repeat) | Right click |
| Pick block | Middle click |
| Select hotbar slot | `1`–`9` / mouse wheel |
| Block inventory | `E` |
| Debug info | `F3` |
| Pause / settings | `Esc` |

## Run locally

Browsers block ES modules from `file://`, so serve the folder with any static server:

```bash
git clone https://github.com/<your-user>/MiniCrafter.git
cd MiniCrafter
python3 -m http.server 8765
```

Then open http://localhost:8765. It needs a desktop browser with WebGL and a mouse; touch controls are not supported yet.

## Deploy

The project is fully static. Push it to GitHub and enable **GitHub Pages** on the `main` branch root, or drop the folder onto any static host.

## Project layout

```
index.html        Page shell, menus, HUD, import map (three@0.160.0 from unpkg)
style.css         UI styles
src/main.js       Boot, game loop, input, pointer lock, UI, saving
src/world.js      Chunks, terrain generation, meshing + AO, raycast, streaming
src/player.js     Player physics and collision
src/blocks.js     Block registry (IDs are saved, never renumber them)
src/textures.js   Procedural texture atlas + hotbar icons
src/sky.js        Day/night, sun, moon, stars, clouds
src/particles.js  Block-break particles
src/audio.js      Synthesized dig/place sounds
src/noise.js      Seeded Perlin noise and hashes
```

To add a block, add a tile painter in `textures.js` and a `def(...)` line in `blocks.js`.

In the browser console, `window.minicrafter` exposes `world`, `player` and `save()` for debugging.

## Roadmap ideas

- Survival mode: health, hunger, block drops, an inventory with counts, crafting
- Mobs (passive animals first)
- Voxel lighting (torches, darkness in caves)
- Flowing water
- Generating chunks in a Web Worker for smoother streaming
- Touch controls for mobile
