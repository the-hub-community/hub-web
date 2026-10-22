/**
 * swipe-wiki.js
 * Left/right swipe on a wiki page navigates to the next/previous page
 * within the same community. Uses the sidebar sub-page list as the source
 * of truth so it stays in sync with navigation automatically.
 *
 * Desktop: no-op. Touch only. Respects prefers-reduced-motion.
 */
(function initSwipeWiki() {
  "use strict";

  if (window.__resiHubSwipeWikiLoaded) return;
  window.__resiHubSwipeWikiLoaded = true;

  // Only mobile
  if (window.matchMedia("(min-width: 769px)").matches) return;

  // Only on wiki pages
  const article = document.querySelector(".content-card .wiki-render");
  if (!article) return;

  // Reduced motion → disable the transition (still allow navigation)
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  // Gather sibling pages from the sidebar
  const sublinks = Array.from(
    document.querySelectorAll(".sidebar-nav__subpage"),
  );
  if (sublinks.length < 2) return;

  const currentPath = window.location.pathname;
  const currentIdx = sublinks.findIndex(
    (a) => a.getAttribute("href") === currentPath,
  );
  if (currentIdx === -1) return;

  const prevLink = currentIdx > 0 ? sublinks[currentIdx - 1] : null;
  const nextLink =
    currentIdx < sublinks.length - 1 ? sublinks[currentIdx + 1] : null;

  const SWIPE_THRESHOLD = 60;
  const VERTICAL_TOLERANCE = 40;

  let startX = 0;
  let startY = 0;
  let tracking = false;

  article.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    },
    { passive: true },
  );

  article.addEventListener(
    "touchmove",
    (e) => {
      if (!tracking || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      // If gesture is mostly vertical → let the page scroll
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > VERTICAL_TOLERANCE) {
        tracking = false;
        return;
      }
    },
    { passive: true },
  );

  article.addEventListener(
    "touchend",
    (e) => {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      if (Math.abs(dy) > VERTICAL_TOLERANCE) return;

      // Swipe left → next page. Swipe right → previous page.
      if (dx < 0 && nextLink) {
        animateAndNavigate(nextLink.getAttribute("href"), "left");
      } else if (dx > 0 && prevLink) {
        animateAndNavigate(prevLink.getAttribute("href"), "right");
      }
    },
    { passive: true },
  );

  function animateAndNavigate(url, direction) {
    if (!url) return;
    if (reducedMotion) {
      window.location.href = url;
      return;
    }
    article.style.transition =
      "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease";
    article.style.transform = `translateX(${direction === "left" ? "-40px" : "40px"})`;
    article.style.opacity = "0";

    setTimeout(() => {
      window.location.href = url;
    }, 180);
  }

  // Optional: subtle hint on first visit
  if (!sessionStorage.getItem("swipeHintShown")) {
    sessionStorage.setItem("swipeHintShown", "1");
    const hint = document.createElement("div");
    hint.className = "swipe-wiki-hint";
    hint.textContent = "Swipe to browse pages";
    document.body.appendChild(hint);
    setTimeout(() => hint.classList.add("is-visible"), 800);
    setTimeout(() => {
      hint.classList.remove("is-visible");
      setTimeout(() => hint.remove(), 300);
    }, 3200);
  }
})();
