# Vendored libraries

These are copied here so MiniCrafter works offline. They are unmodified copies from unpkg.

| File | Library | Version | License |
|---|---|---|---|
| `three.module.js` | [three.js](https://threejs.org/) | 0.160.0 | MIT, see `LICENSE-three.txt` |
| `blockly.min.js` | [Blockly](https://developers.google.com/blockly) (core, blocks, English messages, JS generator) | 10.4.3 | Apache License 2.0, © Google LLC: https://www.apache.org/licenses/LICENSE-2.0 |

`media/sprites.png` is Blockly's icon sheet (trash can and zoom buttons) from `blockly@10.4.3/media/`. The game points Blockly at it with the `media` option, because the default would load it from Google's servers.

To update one, download the new version from `https://unpkg.com/<package>@<version>/...`, replace the file, update this table, and bump `VERSION` in `sw.js`.
