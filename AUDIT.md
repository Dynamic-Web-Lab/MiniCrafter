# Audit of the original prototype (commit 73ee515)

The original `index.html` was a single-file, 250-line prototype. These are the findings and how the rewrite handles each.

| # | Severity | Finding | Fix in rewrite |
|---|---|---|---|
| 1 | Bug | Block placement used `floor(hitPoint + normal)`. On +X/+Y/+Z faces the hit point sits on the integer boundary, so new blocks landed **two** cells away and floated with a gap. | Voxel DDA raycast returns the exact block and face normal. The new block goes at `block + normal`. |
| 2 | Bug | No collision with blocks: the player walked through everything, and the only floor was a hard-coded `y < 2` check. | AABB physics against the voxel grid, resolving each axis separately in sub-steps (`src/player.js`). |
| 3 | Bug | You could place a block inside your own body. | Placement checks the block against the player's box first. |
| 4 | Perf | Every block was its own `Mesh`, and raycasting tested every mesh. Performance degrades linearly, and badly, after a few thousand blocks. | Chunked world with hidden-face culling and one geometry per chunk layer. The raycast is an O(distance) grid walk. |
| 5 | Perf | Shadow maps were enabled but did nothing useful. | Removed. Lighting comes from per-face shading plus vertex ambient occlusion. |
| 6 | Gameplay | Flat plane world, 4 colours, no saving, no inventory, no day/night. | Procedural biomes, caves, ores, trees, 29 textured blocks, hotbar and inventory, auto-save, day/night. |
| 7 | UX | No pause menu or settings. Keys could stay stuck after the window lost focus. A large frame delta after switching tabs could launch the player. | Pause menu with settings, a pointer-lock state machine, input cleared on blur, and the frame delta clamped to 50 ms. |
| 8 | Docs | The README had placeholder URLs, a broken markdown link inside the `git clone` command and an unclosed code fence. It also claimed "zero dependencies" while loading three.js and es-module-shims from a CDN. The page title didn't match the project name. | README rewritten. The unnecessary `es-module-shims` polyfill was removed (all current browsers support import maps). |

## Known limits (not yet addressed)

- Desktop only: no touch controls.
- Chunk generation runs on the main thread, so there can be small hitches at high render distances.
- No light propagation: caves are as bright as the surface.
- Water is static (it doesn't flow), except that it fills a broken block next to it.
