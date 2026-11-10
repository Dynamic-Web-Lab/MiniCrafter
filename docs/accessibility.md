# MiniCrafter accessibility

Audit date: 2026-11-10 · Game version: 33 · Tools: axe-core 4.12.1 (injected with Playwright, as in `tests/smoke.mjs`), plus a manual pass at 1280×720 (desktop) and 812×375 sideways with `?touch=1` (phone).

MiniCrafter is a 3D block game. Looking around and placing blocks needs sight and a mouse, keyboard or touch screen, so it is **not playable with a screen reader**. This page says what we do support, what we checked, and what is still open.

## What we support (for schools)

- **Whole-menu keyboard use.** Every menu, panel and setting can be reached and used with Tab, Shift+Tab, Enter and Space. Pop-up panels (worlds, Play Together, account, inventory, crafting, quest book, photo, pet, What's new, report) move focus into the panel, keep Tab inside it, and close with **Esc**. Focus goes back to the button you used.
- **Visible focus.** A thick yellow ring shows where the keyboard focus is.
- **Big touch targets.** On phones and tablets every button, tab, field, slider and the hotbar slots are at least 44×44 px.
- **Readable HUD.** Text drawn over the game (hints, messages, mode badge, level number, armor line, hotbar numbers) has a dark backing and is at least 4.5:1 against any sky, including pure white.
- **Not colour alone.** Hearts change shape (♥ full, ♡ empty) as well as colour. Quest progress shows "3 / 5" next to its bar. Finished quests show a ✅ and filled stars. The selected chip also gets a white border.
- **Reduced motion.** If the device asks for it (`prefers-reduced-motion`), fades and slides are switched off, the quest-complete card does not zoom in, the red damage flash is softer and shorter, and celebration confetti is skipped. The game has no camera bob or screen shake.
- **Labels.** Every icon-only button has an accessible name. The ✕ close button on every panel is labelled "Close". Health, air and food are announced as "Health: 7 of 10 hearts". Messages and hints are announced by screen readers.
- **Language and structure.** The page language is set (`lang="en"`). Panels are named dialogs. Headings run in order inside each panel.
- **Legal pages and the features page** pass axe-core with no violations.
- **No tracking or outside content** that could get in the way of assistive tools: the game loads nothing from other sites.

Not supported yet: playing with a screen reader, a text-size setting, remapping keys, one-switch / eye-control play, and zooming the page on phones (see the open items below). If your school needs any of these, tell us.

## Findings

Severity: **High** blocks a group of players, **Medium** makes things hard, **Low** is a polish or best-practice item. "Fixed" means fixed in game version 33.

| # | Issue | Where | Severity | Status |
|---|---|---|---|---|
| 1 | Esc did not close Play Together, account, My worlds, What's new, report or the adventure gate (it only worked in-game) | Menu pop-ups | High | Fixed |
| 2 | Keyboard focus stayed on the button behind a pop-up; Tab walked through the hidden menu underneath | All pop-ups | High | Fixed (focus moves in, Tab stays in, focus returns) |
| 3 | Focus ring was the browser's 1 px default line | Everywhere | Medium | Fixed (3 px ring) |
| 4 | HUD text had only a text-shadow and no backing: 1.2–2.5:1 on a bright sky (hint, toast, armor line, mode badge, level number) and 2.5:1 for hotbar numbers | HUD | High | Fixed (6.4–8.7:1 on white; hotbar counts 5.0:1) |
| 5 | Touch targets under 44 px: menu mode buttons (36), "Another idea" (30), sliders (16), selects (35), account tabs (30), Play Together chips (28), Back/Done (38), links (16), Bit's Run/Stop/speed (38–41), ✕ at short heights (40), hotbar slots (38–40) | Phone | Medium | Fixed (44 px minimum with `?touch=1` / touch devices; hotbar and XP bar nudged up 12 px on short phone screens) |
| 6 | Selected colour chip: white text on pink, 4.0:1 (axe `color-contrast`) | Play Together | Medium | Fixed (dark or white label by colour) |
| 7 | "Survival only" tags in the quest book were 2.5:1 (the dimming made them faint) | Quest book | Medium | Fixed |
| 8 | Hearts: empty vs full relied on red vs dark red | Survival HUD | Medium | Fixed (♡ vs ♥ shape, plus a spoken label) |
| 9 | Health, air and food had no text alternative | Survival HUD | Medium | Fixed |
| 10 | Toast, hint and quest-complete card were not announced | HUD | Medium | Fixed (`role="status"`) |
| 11 | No reduced-motion handling for the quest-complete zoom, fades, confetti, damage flash (only the "turn your phone" hint had it) | HUD, game | Medium | Fixed |
| 12 | Scrollable quest list and recipe list could not be scrolled with the keyboard (axe `scrollable-region-focusable`) | Quest book, crafting | Medium | Fixed |
| 13 | Pop-ups were plain `div`s: no dialog role or name | All pop-ups | Medium | Fixed |
| 14 | Fields with only a placeholder (World name, Seed, adult-check answer) | Worlds, gate | Low | Fixed (`aria-label`) |
| 15 | Colour-picker groups had a label but no role | Play Together | Low | Fixed |
| 16 | Axe `region`: content outside landmarks (menu, game view, HUD) | Everywhere | Low | Mostly fixed (menu is `main`, pop-ups are dialogs, game view is labelled). The in-game HUD still reports it. Not fixed: HUD is overlay chrome, and a screen reader cannot play the game anyway |
| 17 | Axe `meta-viewport`: pinch-zoom is switched off (`user-scalable=no`) | All game screens | Medium | **Not fixed.** On phones the canvas uses touch gestures and the browser zoom would fight them. Needs a design decision; see follow-ups |
| 18 | Smallest text is 11.5 px (item names under inventory blocks, "Quests (Q)" key hint, hotbar numbers 11 px) | Inventory, HUD | Low | Not fixed. Fits the layout and passes contrast; a text-size setting is the real fix |
| 19 | "Oops!" screen uses a second `h1` | Death screen | Low | Not fixed (it is a separate screen, so order is still fine) |
| 20 | Quest tracker layout on phones (fold, mini view and a `#quest-view` setting) | `#quest-tracker` | Not an accessibility fault | Out of scope here. Handled in PR #44, which is not covered by this audit. Re-check its header height (32–40 px before that change) against 44 px once it lands |
| 21 | Hotbar slots, block grid and crafting slots are not keyboard-reachable (1–9 and the wheel select hotbar slots, the inventory uses the mouse/touch) | Inventory, crafting | High | Not fixed (follow-up) |
| 22 | The 3D game cannot be played with a screen reader | Game | High | Not fixed (follow-up) |
| 23 | No in-game text-size setting | Settings | Medium | Not fixed (follow-up) |

Axe results across the start menu (with settings open), Play Together, account (log in and create), What's new, report, My worlds, trade, adventure gate, rotate prompt, death, inventory, crafting, quest book, pet panel, photo mode, the HUD with Bit's panel, `features.html`, `privacy.html`, `terms.html` and `stats.html`:

- Before: `color-contrast` (2 screens), `scrollable-region-focusable` (2 screens), `meta-viewport` and `region` everywhere. The static pages had no violations.
- After: only `meta-viewport` (item 17) and a few `region` hits on the HUD (item 16).

## Manual checklist

| Check | Desktop | Phone (812×375, `?touch=1`) |
|---|---|---|
| Touch targets ≥ 44 px | Not required for a mouse; all controls ≥ 24 px (WCAG 2.5.8) | Pass after the fix. The quest tracker header is the one exception (item 20) |
| HUD contrast ≥ 4.5:1 over a bright sky | Pass (computed against white, the worst case) | Pass |
| Smallest text | 11.5 px (item 18) | 11.5 px |
| Icon-only buttons have `aria-label` | Pass (pause, undo, inventory, fly, emoji, photo, respawn, jump, down, ✕) | Pass |
| Tab order through the menus | Play, Play Together, account, My worlds, Quest book, idea, mode buttons, settings, controls, report, links: matches the screen | Same |
| Esc closes every panel | Pass after the fix (item 1) | No Esc key on phones. Every panel has a ✕ and tapping outside it closes it |
| Focus visible | Pass after the fix | Pass |
| `prefers-reduced-motion` | Pass after the fix | Pass |
| Not colour alone | Pass after the fix | Pass |
| Page language and headings | `lang="en"`; one `h1` per screen; `h2` then `h3` inside panels | Same |

## Follow-ups (bigger items, not in this change)

1. **Keyboard access to slots.** Make the hotbar, block picker and crafting slots focusable with arrow keys (roving tabindex), so players who cannot use a mouse can build.
2. **Text-size setting** (Small / Normal / Large) in Settings, which also fixes item 18.
3. **Pinch-zoom on menus.** Allow page zoom while a menu is open and keep it off while playing (item 17).
4. **Screen-reader play.** Announce what the player is looking at, what is nearby and how to move. This is a large design job. Bit the robot's Blockly editor also needs its own check.
5. **Key remapping and one-switch play.**
6. **Quest tracker target size** once the phone layout change lands.
7. Add axe to `tests/` so a new violation fails the build (the audit script injected axe-core by hand; it is not stored in the repo).

## How to re-run the audit

Start the game with `node server/dev.mjs` (set `PORT` to change it). In Playwright, open the page, inject `axe.min.js` from the `axe-core` package (`await page.addScriptTag({ path })`), run `axe.run(document)` on each screen, and open each pop-up first, either with its button or by taking `hidden` off its `.overlay`. For the phone check use an 812×375 viewport and `?touch=1`.
