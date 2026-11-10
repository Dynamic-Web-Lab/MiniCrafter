// Accessibility helpers (see docs/accessibility.md): pop-ups behave like proper dialogs
// (named, keyboard focus moves in, Tab stays inside, Esc closes) and one place to ask
// whether the player prefers reduced motion.
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Menu-level pop-ups: Esc presses their Back/Done button (in-game panels have their own Esc handling).
const ESC_CLOSES = [['together', 'tg-close'], ['account', 'acc-done'], ['worlds', 'w-done'], ['news', 'news-done'], ['report', 'report-done'], ['gate', 'gate-cancel']];
const FOCUSABLE = 'button, a[href], input:not([type=hidden]), select, summary, textarea, [tabindex="0"]';
const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

/** Call once, after every overlay exists in the page. */
export function initA11y(overlayIds) {
  const $ = (id) => document.getElementById(id);
  let n = 0;
  for (const id of overlayIds) {
    const ov = $(id);
    const panel = ov?.querySelector('.panel');
    if (!ov || !panel) continue;
    const h = panel.querySelector('h1, h2');
    if (h) { if (!h.id) h.id = `a11y-title-${++n}`; ov.setAttribute('aria-labelledby', h.id); }
    if (!ov.getAttribute('role')) ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    panel.tabIndex = -1;
    let opener = null;
    new MutationObserver(() => {
      if (!ov.classList.contains('hidden')) {
        // Opened: remember where the player was, then move keyboard focus into the pop-up.
        const a = document.activeElement;
        opener = a && a !== document.body && !ov.contains(a) ? a : null;
        requestAnimationFrame(() => { if (!ov.classList.contains('hidden') && !ov.contains(document.activeElement)) panel.focus({ preventScroll: true }); });
      } else if (opener) {
        // Closed: hand focus back to the menu button that opened it (never to in-game controls).
        if (opener.isConnected && $('menu').contains(opener) && shown(opener)) opener.focus({ preventScroll: true });
        opener = null;
      }
    }).observe(ov, { attributes: true, attributeFilter: ['class'] });
  }
  // Long lists that scroll must be reachable by keyboard even when they hold no buttons.
  for (const [id, label] of [['qb-list', 'Quests'], ['recipes', 'Recipes']]) { const el = $(id); if (el) { el.tabIndex = 0; el.setAttribute('role', 'region'); el.setAttribute('aria-label', label); } }
  for (const id of ['tg-status', 'loading']) $(id)?.setAttribute('aria-live', 'polite');

  document.addEventListener('keydown', (e) => {
    const open = [...document.querySelectorAll('.overlay[aria-modal]:not(.hidden)')].pop();
    if (!open) return;
    if (e.key === 'Escape') {
      const hit = ESC_CLOSES.find(([ov]) => ov === open.id);
      if (hit) { e.preventDefault(); $(hit[1]).click(); }
    } else if (e.key === 'Tab') {
      const items = [...open.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled && shown(el));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (!open.contains(document.activeElement) || document.activeElement === open.querySelector('.panel')) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, true);
}
