/**
 * wiki-reading.js
 * Extracts headings into a sticky TOC, tracks scroll position for
 * the reading progress bar, highlights the active section.
 */
(function initWikiReading() {
  "use strict";
  if (window.__resiHubWikiReadingLoaded) return;
  window.__resiHubWikiReadingLoaded = true;

  const article = document.querySelector(".wiki-render");
  if (!article) return;

  const progress = document.getElementById("reading-progress");
  const progressFill = document.getElementById("reading-progress-fill");
  const toc = document.getElementById("wiki-toc");
  const tocNav = document.getElementById("wiki-toc-nav");
  const layout = article.closest(".wiki-layout") || article.parentElement;

  // ── 1. Build TOC from headings ─────────────────────────────
  const headings = Array.from(article.querySelectorAll("h2, h3")).filter(
    (h) => h.textContent.trim().length > 0,
  );

  if (headings.length >= 2 && toc && tocNav) {
    headings.forEach((h, i) => {
      if (!h.id) {
        // slugify heading text
        h.id =
          "h-" +
          h.textContent
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-")
            .slice(0, 60) +
          (h.tagName === "H3" ? `-${i}` : "");
      }

      const link = document.createElement("a");
      link.href = `#${h.id}`;
      link.className =
        "wiki-toc__link" + (h.tagName === "H3" ? " wiki-toc__link--h3" : "");
      link.textContent = h.textContent.trim();
      link.dataset.target = h.id;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        h.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", `#${h.id}`);
      });
      tocNav.appendChild(link);
    });

    toc.hidden = false;
    if (layout) layout.classList.add("has-toc");
  }

  // ── 2. Reading progress + active TOC section ───────────────
  let ticking = false;

  function updateProgress() {
    const rect = article.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const articleTop = rect.top + window.scrollY;
    const articleHeight = article.offsetHeight;
    const scrolled = window.scrollY - articleTop + viewportH * 0.3;
    const ratio = Math.max(0, Math.min(1, scrolled / articleHeight));

    if (progressFill) {
      progressFill.style.width = `${ratio * 100}%`;
    }
    if (progress) {
      progress.classList.toggle("is-active", ratio > 0.02 && ratio < 0.98);
    }

    // Active TOC entry
    if (headings.length && tocNav) {
      const probe = window.scrollY + 130;
      let active = null;
      headings.forEach((h) => {
        const top = h.getBoundingClientRect().top + window.scrollY;
        if (top <= probe) active = h.id;
      });
      tocNav.querySelectorAll(".wiki-toc__link").forEach((link) => {
        link.classList.toggle("is-active", link.dataset.target === active);
      });
    }

    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(updateProgress);
      ticking = true;
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  updateProgress();

  // ── 3. Show/Hide "Back to top" on scroll ───────────────────
  const backToTopBtn = document.querySelector(".wiki-back-to-top");
  if (backToTopBtn) {
    // Smooth scroll on click
    backToTopBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Show when scrolled past 400px
    window.addEventListener(
      "scroll",
      () => {
        if (window.scrollY > 400) {
          backToTopBtn.classList.add("is-visible");
        } else {
          backToTopBtn.classList.remove("is-visible");
        }
      },
      { passive: true },
    );
  }
})();
