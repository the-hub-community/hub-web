/**
 * community-color.js
 * Deterministic community tinting. Reads data-community-slug on any
 * element, hashes the slug, and sets data-accent to a palette name.
 *
 * FOUC-safe: include synchronously in <head> (no defer).
 * Idempotent: elements already tagged with data-accent are skipped.
 */
(function initCommunityColor() {
  "use strict";
  if (window.__resiHubCommunityColorLoaded) return;
  window.__resiHubCommunityColorLoaded = true;

  const PALETTE = [
    "amber",
    "olive",
    "teal",
    "sky",
    "navy",
    "plum",
    "terracotta",
    "forest",
  ];

  function hashSlug(slug) {
    let hash = 0;
    const s = String(slug || "")
      .toLowerCase()
      .trim();
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  function applyAccents(root) {
    const scope = root || document;
    const nodes = scope.querySelectorAll(
      "[data-community-slug]:not([data-accent])",
    );
    nodes.forEach((el) => {
      const slug = String(el.getAttribute("data-community-slug") || "").trim();
      if (!slug) return;
      el.setAttribute("data-accent", PALETTE[hashSlug(slug) % PALETTE.length]);
    });
  }

  window.ResiHubCommunityColor = { applyAccents, hashSlug };

  // Run synchronously if document is already parsed; else wait
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      applyAccents(document);
      // Watch for dynamic insertions (marketplace cards, sidebar rebuilds)
      const observer = new MutationObserver(() => applyAccents(document));
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    applyAccents(document);
    const observer = new MutationObserver(() => applyAccents(document));
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
