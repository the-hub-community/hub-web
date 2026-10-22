/**
 * sidebar-marks.js
 * Enhances sidebar community + sub-page items with visual marks:
 *   - Communities: monogram badge, tinted via the accent color system
 *   - Sub-pages: type-detected inline SVG icon
 *
 * Runs idempotently. Safe to re-run after sidebar mutations.
 */
(function initSidebarMarks() {
  "use strict";
  if (window.__resiHubSidebarMarksLoaded) return;
  window.__resiHubSidebarMarksLoaded = true;

  // ── Page type detection ─────────────────────────────────────
  const TYPE_RULES = [
    { keys: ["movie", "film", "cinema"], icon: "film" },
    { keys: ["restaurant", "food", "eat", "cafe", "dining"], icon: "fork" },
    { keys: ["intelligence", "news", "update", "brief"], icon: "news" },
    { keys: ["sport", "sports", "gym", "field", "court"], icon: "sport" },
    { keys: ["book", "library", "read"], icon: "book" },
    { keys: ["event", "calendar", "schedule"], icon: "calendar" },
    { keys: ["service", "repair", "fix"], icon: "wrench" },
    { keys: ["garden", "park", "plant", "green"], icon: "leaf" },
    { keys: ["health", "clinic", "doctor", "medical"], icon: "heart" },
    { keys: ["school", "education", "learn"], icon: "book" },
    { keys: ["transport", "transit", "bus", "train"], icon: "route" },
  ];

  const ICONS = {
    film: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 15h18M8 4l-2 16M18 4l-2 16"/></svg>`,
    fork: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3v8a3 3 0 0 0 3 3v7M9 3v8M12 3v8a3 3 0 0 1-3 3"/><path d="M18 3c-1.5 2-2 4-2 7s.5 4 2 4v7"/></svg>`,
    news: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h13v16H6a2 2 0 0 1-2-2V4z"/><path d="M17 8h3v10a2 2 0 0 1-2 2h-1M8 8h5M8 12h5M8 16h3"/></svg>`,
    sport: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/></svg>`,
    book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2V5z"/><path d="M4 17h15"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
    wrench: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 7a4 4 0 0 1 5-3.5l-3 3 1.5 1.5 3-3A4 4 0 0 1 18 10l-9 9a2.8 2.8 0 0 1-4-4l9-9z"/></svg>`,
    leaf: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20c0-8 5-14 16-15 0 8-3 15-10 15-3 0-6-1-6 0z"/><path d="M4 20l9-9"/></svg>`,
    heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-5-7-11a4 4 0 0 1 7-2.5A4 4 0 0 1 19 9c0 6-7 11-7 11z"/></svg>`,
    route: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M6 8v6a4 4 0 0 0 4 4h6"/></svg>`,
    doc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l5 5v13H6z"/><path d="M14 3v6h6M9 13h6M9 17h4"/></svg>`,
  };

  function iconForTitle(title) {
    const t = String(title || "").toLowerCase();
    for (const rule of TYPE_RULES) {
      if (rule.keys.some((k) => t.includes(k))) {
        return ICONS[rule.icon] || ICONS.doc;
      }
    }
    return ICONS.doc;
  }

  // ── Monogram for community ──────────────────────────────────
  function monogramFor(name) {
    const clean = String(name || "").trim();
    if (!clean) return "?";
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }

  // ── Apply marks ────────────────────────────────────────────
  function applyMarks(root) {
    const scope = root || document;

    // Community rows — monogram
    scope
      .querySelectorAll(
        ".sidebar-nav__item--community:not([data-mark-applied])",
      )
      .forEach((el) => {
        el.dataset.markApplied = "1";
        const nameEl = el.querySelector("span:not(.sidebar-nav__count)");
        const name = nameEl?.textContent?.trim() || "";
        const mark = document.createElement("span");
        mark.className =
          "sidebar-nav__item-mark sidebar-nav__item-mark--community";
        mark.setAttribute("aria-hidden", "true");
        mark.textContent = monogramFor(name);
        el.insertBefore(mark, el.firstChild);
      });

    // Sub-pages — type icon
    scope
      .querySelectorAll(".sidebar-nav__subpage:not([data-mark-applied])")
      .forEach((el) => {
        el.dataset.markApplied = "1";
        const span = el.querySelector("span");
        const title = span?.textContent?.trim() || el.title || "";
        // Replace existing Font Awesome <i> with our SVG
        const existingIcon = el.querySelector("i.fa-regular, i.fa-solid");
        if (existingIcon) existingIcon.remove();
        const mark = document.createElement("span");
        mark.className = "sidebar-nav__item-mark sidebar-nav__item-mark--page";
        mark.setAttribute("aria-hidden", "true");
        mark.innerHTML = iconForTitle(title);
        el.insertBefore(mark, el.firstChild);
      });
  }

  window.ResiHubSidebarMarks = { applyMarks, iconForTitle, monogramFor };

  // Boot + observe
  function boot() {
    applyMarks(document);
    const observer = new MutationObserver(() => applyMarks(document));
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
