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

## Bit the code robot

Bit is a friendly hovering robot that runs programs one visible step at a time.

- **Getting Bit:** in creative, pick **Robot Bit** from the block picker. In survival, craft it at a Crafting Table from 3 Iron Ingots, 1 Glass and 1 Coal.
- **Placing and programming:** right-click a block to place Bit; it faces the way you look. Right-click Bit to open its panel: pick a starter program (tower, wall, stairs, tunnel, walk a square, explore) and watch it work. You can run at 1×/2×/4× speed and stop any time.
- **Building:** Bit places the block you're holding. In survival it uses your blocks and hands you what it digs.
- **Safety:** Bit can't break bedrock and stays within 64 blocks of you. If something is in the way, Bit shakes its head, says why, and carries on. Runaway loops are stopped with a friendly message.

## Learning quests

A quest tracker (top right) always shows the next 3 goals with progress bars. Press `Q`, or tap the tracker, to open the **quest book** with all quests and the stars you've earned. Finishing a quest plays a short celebration and awards 1–3 ⭐. Some survival quests also give apples.

The 23 quests teach:
- **Controls:** walking, jumping, swimming and climbing.
- **Animal names:** pat a pig, a cow and a sheep.
- **Counting:** "Count to 10" by placing blocks.
- **Colours:** "Rainbow Builder" asks for 4 wool colours.
- **Shapes:** a 5-tall tower and a 3 × 3 square floor.
- **Simple maths:** "Break 3 + 4 dirt" reveals "3 + 4 = 7", and there's a "2 × 3 glass" quest.
- **Nature:** shearing sheep, raising a baby animal, and staying up to see the stars.
- **Survival progression (survival only):** first log → crafting table → pickaxe → stone → furnace → glass → iron → diamond.

Quest progress is saved with each world.

## Friendly animals

Pigs, cows, sheep and chickens roam the grasslands in small herds. Nothing can hurt the player, and the animals can't be hurt either.

- **Pat (left click):** the animal hops and makes a happy sound.
- **Feed an apple (right click):** the animal falls in love (hearts). Two in love walk together and make a **baby**, which follows its parents and grows up after a few minutes. Feeding a baby makes it grow faster.
- **Shear a sheep (right click without an apple):** you get 1–3 wool in the sheep's colour, and the wool grows back after a minute. Sheep come in white, red, blue, yellow, green and black.
- **Saving:** animals you have fed, bred or spawned are saved with the world.
- **Spawn eggs (creative):** right-click a block to place an animal.

## Game modes

Switch between modes at any time from the pause menu (`Esc`).

- **Creative:** unlimited blocks, instant breaking and flying.
- **Survival (gentle, made for kids):** there are no monsters and no hunger.
  - **Mining:** mining takes time. Better tools mine faster, and ores need the right pickaxe (iron needs Stone, gold and diamond need Iron).
  - **Crafting:** blocks drop items into a 36-slot inventory. Press `E` for the recipe book: click a recipe to craft it, with no grid patterns to learn. Some recipes need a Crafting Table or Furnace within 4 blocks.
  - **Tools:** Wooden, Stone, Iron and Diamond pickaxes, axes and shovels.
  - **Hearts:** you have 10 hearts. Only big falls (more than 4 blocks) and running out of air underwater hurt you. Hearts come back slowly, and apples (sometimes dropped by leaves) heal.
  - **Fainting:** if you faint, you respawn and keep all your items.
  - **Tips:** one-time tips guide new players ("hold left click on a tree trunk…").

## Controls

| Action | Control |
| :--- | :--- |
| Move | `W` `A` `S` `D` / arrow keys |
| Look | Mouse |
| Jump / swim up / fly up | `Space` |
| Sprint (fly down while flying) | `Shift` |
| Toggle flying (creative) | `F` |
| Break block (hold to repeat) | Left click |
| Place block (hold to repeat) | Right click |
| Pick block | Middle click |
| Pat an animal / feed or shear it | Left click / right click on the animal |
| Select hotbar slot | `1`–`9` / mouse wheel |
| Inventory & crafting (survival) / block picker (creative) | `E` |
| Eat an apple (survival) | Right click with an apple |
| Quest book | `Q` |
| Debug info | `F3` |
| Pause / settings | `Esc` |

### Tablets and phones

Touch controls switch on automatically on touch devices. You can force them with `?touch=1`, or turn them off with `?touch=0`.

| Action | Touch |
| :--- | :--- |
| Walk | Left joystick |
| Look | Drag anywhere on the right side |
| Place / use / feed / shear | Quick tap |
| Mine / pat an animal | Press and hold |
| Jump (fly up) | ⬆ button |
| Fly down | ⬇ button (while flying) |
| Fly on/off (creative) | 🕊️ button |
| Inventory & crafting | 🎒 button, then **Done** to close |
| Pause | ⏸ button |
| Select hotbar slot | Tap the slot |

Tablets start with a render distance of 5 chunks for smoother play.

## Run locally

Browsers block ES modules from `file://`, so serve the folder with any static server:

```bash
git clone https://github.com/<your-user>/MiniCrafter.git
cd MiniCrafter
python3 -m http.server 8765
```

Then open http://localhost:8765. It works in desktop browsers with a mouse and keyboard, and on tablets and phones with touch.

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
src/items.js      Items, tools, mining rules, drops, recipes, item icons
src/inventory.js  36-slot survival inventory
src/survival.js   Hearts, breath, fall damage, regen, timed mining + cracks
src/craftui.js    Inventory + recipe-book crafting screen
src/mobs.js       Friendly animals: models, wandering AI, breeding, shearing
src/touch.js      On-screen joystick, look-drag, tap/hold and buttons for tablets
src/quests.js     Learning quests, stars and progress tracking
src/robot.js      Bit the robot: model, program interpreter, animated actions
src/robotui.js    Bit's side panel (starter programs, speed, stop)
src/textures.js   Procedural texture atlas + hotbar icons
src/sky.js        Day/night, sun, moon, stars, clouds
src/particles.js  Block-break particles
src/audio.js      Synthesized dig/place sounds
src/noise.js      Seeded Perlin noise and hashes
```

To add a block, add a tile painter in `textures.js` and a `def(...)` line in `blocks.js`.

In the browser console, `window.minicrafter` exposes `world`, `player`, `inv`, `save()`, `setMode()` and `step(n)` for debugging. `step(n)` advances n frames by hand, which is useful when the tab is in the background.

## Roadmap ideas

- Voxel lighting (torches, darkness in caves)
- Flowing water
- Generating chunks in a Web Worker for smoother streaming
