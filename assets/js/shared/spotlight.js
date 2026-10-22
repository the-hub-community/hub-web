/**
 * spotlight.js
 * Tracks mouse position on .spotlight-card elements and sets
 * CSS custom properties --spotlight-x / --spotlight-y.
 * Uses requestAnimationFrame for smooth 60fps.
 */
(function initSpotlight() {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const CARDS_SELECTOR = ".spotlight-card";
  let rafId = null;
  let lastEvent = null;

  function updateCard(card, event) {
    const rect = card.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty("--spotlight-x", x + "%");
    card.style.setProperty("--spotlight-y", y + "%");
  }

  function handleMove(event) {
    lastEvent = event;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      const card = lastEvent.target.closest?.(CARDS_SELECTOR);
      if (card) updateCard(card, lastEvent);
      rafId = null;
    });
  }

  function bindTo(root = document) {
    root.querySelectorAll(CARDS_SELECTOR).forEach((card) => {
      if (card.dataset.spotlightBound === "true") return;
      card.dataset.spotlightBound = "true";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindTo();
    document.addEventListener("mousemove", handleMove, { passive: true });

    // Watch for dynamically added cards (marketplace grid renders via JS)
    const observer = new MutationObserver(() => bindTo());
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
