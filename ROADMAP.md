# MiniCrafter roadmap

Ideas for future phases, reviewed and grouped. Each phase ships as its own small PR (or a few), and the CI smoke test must stay green. Effort is a rough guide: **S** is a day or less, **M** is a few days, **L** is a week or more.

Rules every idea must follow: **kid-safe** (no fighting, nothing scary, no strangers), **no asset files** (procedural art and sound), and it must **work on tablets and offline**.

---

## ✅ Already in the game

These were on the idea list but MiniCrafter already has them:

| Idea | Where it is today |
|---|---|
| Procedural Web Audio (no mp3 files) | `src/audio.js`: dig, place, pop, craft, animal voices, fanfare. Jump "whoosh" added in Phase 1. |
| Day/night cycle with sun, moon and stars | `src/sky.js`, plus voxel lighting so torches glow at night. Stars twinkle (Phase 1). |
| Local auto-save | Several saved worlds in `localStorage` (`src/worlds.js`) |
| Hills and trees instead of a flat floor | Endless procedural biomes, caves, trees and villages (`src/world.js`) |
| Fast on Chromebooks and low-end laptops | Chunk meshing (1 draw call per chunk layer, not 1 mesh per block), lower default view distance on tablets. *More in Phase 5.* |
| Share a world as a file | ⬇ Download / ⬆ Import in **My worlds** (`.minicrafter.json`). *One-click link sharing is in Phase 4.* |
| Feed pets so they follow you | Dogs and cats tamed with apples (`src/mobs.js`) |
| Low-stakes quests | 36 quests with stars, including the coding track |

---

## Phase 1 · Bouncy fun blocks (S–M) ✅ done

Very high delight for little work. Each one is a new block plus a few lines of player physics.

- [x] **Trampoline block** (yellow): landing on it launches you high. Holding jump bounces higher. No fall damage when you land on it.
- [x] **Speed strip:** walking on it gives a short speed boost in its arrow direction.
- [x] **Ice block:** slippery (low friction), so you can make ice slides.
- [x] **Fan vent:** an updraft column (about 8 blocks) that lifts you, best combined with the glider below.
- [x] **Umbrella glider** (item): hold jump while falling to float down slowly.
- [x] **Neon blocks:** glowing coloured lamps. The lighting engine already supports emissive blocks; this needs coloured light or just glowing colours.
- [x] **Musical step-stones:** 8 colour-coded note blocks (do-re-mi…) that chime when walked on, so kids can compose songs as paths. Synth only.
- [x] **Confetti pad:** a pressure pad that pops harmless confetti particles and a "yay" sound.
- [x] **Jump "whoosh" sound** and **twinkling stars.**
- [x] Quests: *"Boing Boing!"* (bounce 6 blocks high), *"Little Composer"* (play 5 different notes). Bit can play music stones too, so kids can code songs.

**Watch out:** bounce and fan heights must respect the world ceiling (y 95), and survival fall damage must ignore trampoline landings.

## Phase 2 · Power tools for builders (M) ✅ done

Building big things one click at a time is tiring for kids. Magic tools make castles in seconds.

- [x] **Undo / redo:** add this first. Power tools make big mistakes easy.
- [x] **Line / bridge wand:** click two points to fill a straight line of blocks.
- [x] **Fill tool:** Box Builder (filled), House Walls (hollow box with a floor) and Dome Maker (sphere shell). Size comes from the second click; capped at 2,000 blocks.
- [x] **Paint Roller** (repaints with your block) and **Rainbow Brush** (cycles rainbow wool and neon), with no breaking needed.
- [x] Creative only at first. Survival versions would use up your blocks.

**Watch out:** cap each action (for example 2,000 blocks) so saves don't balloon and chunk rebuilds don't freeze tablets. Batch chunk rebuilds after a big edit.

## Phase 3 · Cozy nature and critters (M–L) ✅ done (vines and the chicken coop left)

Nurturing instead of fighting. This fits the kid-safe direction perfectly.

- [x] **Flowers and tall grass:** cross-shaped plant blocks. This needs a new "plant" mesh shape in the mesher.
- [x] **Watering can:** dirt becomes grass, flowers bloom around you, and crops grow a stage. *(Vines on walls are still to do.)*
- [x] **Farming:** seeds, wheat that grows in stages, and bread. (Already on the roadmap.)
- [x] **Habitat wildlife:** *(frogs at pond and lake edges, including dug ponds; butterflies around flowers. Chickens from a coop are still to do.)*
  - a 3×3 pond brings frogs and lily pads
  - 5 flowers bring butterflies
  - a wooden coop makes chickens hatch from eggs
- [x] **Fireflies at night:** tap one to catch a glowing lantern block for your room.
- [x] **Pet accessories:** party hat, tiny crown, sunglasses (small box models on the head).
- [x] Quests: *Rainbow Garden*, *Little Farmer*, *Baker*, *Flutter By*, *Ribbit!*, *Firefly Catcher*, *Party Time*.

**Watch out:** check habitats occasionally (for example when a chunk loads or every few seconds near the player), not every frame.

## Phase 4 · Play, share and discover (M) ✅ done (delivery requests left)

- [x] **One-click share link:** compress the world's edits (`CompressionStream` + base64) into a URL hash.
  - Small builds fit in a link; big ones fall back to the existing file download.
  - Opening a link offers "Add this world to My worlds", never overwriting anything.
- [x] **Hidden Star block:** one sibling hides it in a maze or castle; finding it plays a fanfare.
- [x] **Daily Mystery Blueprint:** a hint card with a building prompt ("Build a spaceship for a hamster!", "The tallest ice-cream cone you can!"). Prompts come from a built-in list; there's no network.
- [ ] **Delivery requests:** villagers (or a lost penguin) ask for a roof or 3 berry bushes and give a golden trophy block. This reuses the quest and villager systems.
- [x] **Portal doors:** paired coloured doors (blue to blue) for mazes and puzzle houses.

**Watch out:** treat shared links as untrusted data. Validate block IDs, cap sizes, and never run anything from them.

## Phase 5 · Bigger tech (L)

- [ ] **Flowing water and water slides:** water spreads with a simple cellular rule; currents push the player downhill.
- [ ] **Marble runs and ball pits:** a rolling sphere with voxel collision (ramps, funnels, half-pipes). This is new physics, so prototype it first.
- [ ] **Boombox / radio cubes:** placeable speakers with synthesized 8-bit tunes, campfire crackle or rain, with distance-based volume and a parent mute.
- [ ] **Smoother tablets:** generate and mesh chunks in a Web Worker so long view distances don't stutter.
- [ ] **Animals, Bit and particles lit by torches** in dark caves.

## ⚔️ Adventure track (opt-in, for older players)

A separate **Adventure** game mode for teens and grown-ups who want excitement. Kids' worlds stay gentle by default: Adventure is chosen per world, sits behind a grown-up gate (a speed bump, not security), and none of its content appears in Creative or gentle Survival worlds. Monsters are original and cartoonish, and disappear in a puff with no blood.

### A1 · Adventure mode ✅ done
- [x] Third game mode in the menu and the new-world form, behind a grown-up gate (a times-table question, once per browser session)
- [x] Hunger (🍗 bar): drains over time and faster with sprinting, jumping and mining. Healing needs food. Starving never goes below half a heart.
- [x] Tougher falls (over 3 blocks instead of 4)
- [x] XP and levels: from ores, harvesting, crafting and quests, with an XP bar and level-up fanfare
- [x] Fainting drops your things into a **Lost Items Chest** where you fell. Go back and click it to get them.
- [x] ☠️ **Hardcore** option: one life. Game Over turns the world look-only (fly around, no breaking).
- [x] Quests: Hungry Hero, Back For It, Level Up

### A2 · Night creatures and combat ✅ done
- [x] Original cartoon monsters that spawn in the dark (light level < 7), so torches matter: Gloomlings (melee hoppers) and Sporelings (spore shooters). Sunlight poofs them.
- [x] Sword (wood → diamond), bow and arrows, shield; armour (wool → iron → diamond)
- [x] Knock-back, hit flash, "poof" defeat with drops and XP; Easy / Normal difficulty
- [x] Quests: Night Watch, Suit Up, Archer, Monster Hunter

### A3 · Spark circuits (redstone-style) ✅ done
Available in every mode (building, not fighting), so younger kids can use them with Bit too.
- [x] Spark Wire, levers, buttons, pressure plates, batteries
- [x] Inverter (NOT gate, makes clocks), delay (repeater), lamps, doors, pistons (push up to 12 blocks, carry the player)
- [x] Bit can read spark power, wait, and flip levers / press buttons (coding with circuits)
- [x] Quests: Light It Up, Secret Door, Push It!, Robot Electrician

### A4 · Dungeons and loot (L)
- [ ] Generated dungeons and ruins with chests and monster spawners
- [ ] Treasure maps; one boss deep underground

### A5 · Challenges (M)
- [ ] Parkour courses with a timer, a speedrun clock, and local best-time boards

## Parked or needs a decision

| Idea | Why it's parked |
|---|---|
| **TNT explosion that clears blocks** | Fun, but it destroys builds (including a sibling's) and "explosives" don't fit the gentle tone. **Proposal:** a *"Poof block"* (creative only) that clears a small area with confetti instead of fire, with **undo** (Phase 2) required first. Needs your OK on the theme. |
| **Press G to spawn hills and trees** | Not needed: worlds are already endless procedural terrain. Could come back later as a "terrain brush" power tool. |
| **Switch to `InstancedMesh`** | The game already uses chunk meshes, which are faster than instancing for voxels. Next performance step is the Web Worker (Phase 5). |
| **Play with friends (multiplayer)** | Needs a server plus a child-safety design (private rooms, no free chat). A project of its own. |

---

### Suggested order

**Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5.**

Phases 1–4 are done (except villager delivery requests). Phase 5 (flowing water, marble runs, boombox, Web Worker meshing, torch-lit animals) is next. Phase 3 deepens the cozy, nurturing direction. Phase 4 lets kids share with family. Phase 5 is the heavier engineering.
