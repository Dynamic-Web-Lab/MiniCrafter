# 🎮 MiniCrafter

A lightweight, browser-based 3D voxel sandbox game inspired by Minecraft. Built from scratch with pure WebGL and Three.js, with zero build tools or dependencies required.

---

## 🕹️ Live Demo

Play directly in your browser:  
👉 **`https://<YOUR-GITHUB-USERNAME>.github.io/minicrafter/`**

---

## ✨ Features

- **Pure Web Tech:** Runs directly in any modern desktop browser using Three.js ES modules.
- **First-Person Controls:** Pointer lock camera with mouse-look, directional movement, and jump physics.
- **Voxel Building Mechanics:** 
  - Raycasted placement and destruction.
  - Grid-snapping math ($1 \times 1 \times 1$ cubes).
  - Protected terrain floor.
- **Hotbar Inventory:** Dynamic material selector (Grass, Dirt, Stone, Wood).
- **Zero Config:** Single-file architecture ready to run with any static server.

---

## 🎮 Controls

| Action | Control |
| :--- | :--- |
| **Move** | `W`, `A`, `S`, `D` / Arrow Keys |
| **Look Around** | Mouse |
| **Jump** | `Spacebar` |
| **Break Block** | `Left Click` |
| **Place Block** | `Right Click` |
| **Select Material** | `1`, `2`, `3`, `4` |
| **Pause / Release Mouse** | `Esc` |

---

## 🚀 Quick Start (Local Setup)

Because the project loads Three.js as an ES module, browsers block direct file opening (`file:///`) due to CORS security rules. Use any simple local web server to run it locally.

### 1. Clone the repository
```bash
git clone [https://github.com/](https://github.com/)<YOUR-GITHUB-USERNAME>/minicrafter.git
cd minicrafter
