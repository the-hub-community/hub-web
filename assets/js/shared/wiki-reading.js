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

  document.querySelectorAll(".wiki-community-nav").forEach((nav) => {
    const browseButton = nav.querySelector(".wiki-community-nav__browse");
    if (!browseButton) return;

    const dialog = nav.querySelector(".wiki-pages-dialog");
    const searchInput = nav.querySelector(".wiki-pages-dialog__search input");
    const links = Array.from(
      nav.querySelectorAll(".wiki-pages-dialog__link"),
    );
    const emptyState = nav.querySelector(".wiki-pages-dialog__empty");
    if (!dialog || !searchInput || !links.length || !emptyState) return;

    const filterPages = () => {
      const query = searchInput.value.trim().toLocaleLowerCase();
      let visibleCount = 0;
      links.forEach((link) => {
        const title = link.dataset.searchText || link.textContent || "";
        const matches = title.toLocaleLowerCase().includes(query);
        link.hidden = !matches;
        if (matches) visibleCount += 1;
      });
      emptyState.hidden = visibleCount > 0;
    };

    browseButton.addEventListener("click", () => {
      searchInput.value = "";
      filterPages();
      dialog.showModal();
      searchInput.focus();
    });

    searchInput.addEventListener("input", filterPages);
  });

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

  function getImageFigure(element) {
    if (element.matches("figure.lh-image-container")) {
      return element.querySelector("img") ? element : null;
    }

    const figures = element.querySelectorAll("figure.lh-image-container");
    if (figures.length !== 1 || !figures[0].querySelector("img")) return null;
    return figures[0];
  }

  function preserveImageAlignment(element, figure) {
    const alignment = element.closest(
      ".lh-align-left, .lh-align-center, .lh-align-right",
    );
    if (alignment) {
      figure.dataset.align = alignment.classList.contains("lh-align-left")
        ? "left"
        : alignment.classList.contains("lh-align-right")
          ? "right"
          : "center";
    }
  }

  function createImageGallery(parent, before) {
    const gallery = document.createElement("div");
    gallery.className = "lh-image-gallery";
    gallery.setAttribute("role", "group");
    gallery.setAttribute("aria-label", "Image gallery");
    gallery.tabIndex = 0;
    parent.insertBefore(gallery, before);
    return gallery;
  }

  function initializeImageGalleryControls(contentBody) {
    contentBody.querySelectorAll(".lh-image-gallery").forEach((gallery) => {
      const images = gallery.querySelectorAll("figure.lh-image-container img");
      images.forEach((image) => {
        if (image.alt.trim() && !image.title) image.title = image.alt.trim();
      });

      if (images.length <= 6 || gallery.dataset.controlsReady === "true") {
        return;
      }

      gallery.classList.add("lh-image-gallery--grid");
      gallery.dataset.controlsReady = "true";
      gallery.setAttribute(
        "aria-label",
        `Image gallery, ${images.length} photos`,
      );

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "lh-image-gallery__toggle";
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = `Show all ${images.length} photos`;
      toggle.addEventListener("click", () => {
        const expanded = gallery.classList.toggle("is-expanded");
        toggle.setAttribute("aria-expanded", String(expanded));
        toggle.textContent = expanded
          ? "Show fewer photos"
          : `Show all ${images.length} photos`;
      });
      gallery.insertAdjacentElement("afterend", toggle);
    });
  }

  function groupImagesWithinSection(section) {
    let imageRun = [];

    function flushRun() {
      if (imageRun.length > 1) {
        const gallery = createImageGallery(section, imageRun[0].element);
        imageRun.forEach(({ element, figure }) => {
          preserveImageAlignment(element, figure);
          gallery.appendChild(figure);
          if (element !== figure) element.remove();
        });
      }
      imageRun = [];
    }

    Array.from(section.children).forEach((element) => {
      const figure = getImageFigure(element);
      if (figure) imageRun.push({ element, figure });
      else flushRun();
    });
    flushRun();
  }

  function getImageOnlyFigures(section) {
    const text = section.querySelector(".lh-text");
    if (text && text.textContent.trim()) return null;
    if (section.querySelector(".lh-video-container, iframe")) return null;

    const figures = Array.from(
      section.querySelectorAll("figure.lh-image-container"),
    );
    if (!figures.length) return null;

    const isAllowedChild = (element) =>
      element === text ||
      element.classList.contains("lh-clear") ||
      element.classList.contains("lh-image-gallery") ||
      Boolean(getImageFigure(element));

    return Array.from(section.children).every(isAllowedChild) ? figures : null;
  }

  function groupImageOnlySections(contentBody) {
    let imageSections = [];

    function flushSections() {
      if (imageSections.length > 1) {
        const gallery = createImageGallery(
          imageSections[0].parentNode,
          imageSections[0],
        );
        imageSections.forEach((section) => {
          section
            .querySelectorAll("figure.lh-image-container")
            .forEach((figure) => {
              preserveImageAlignment(figure, figure);
              gallery.appendChild(figure);
            });
          section.remove();
        });
      }
      imageSections = [];
    }

    Array.from(contentBody.querySelectorAll(".lh-section")).forEach((section) => {
      if (getImageOnlyFigures(section)) imageSections.push(section);
      else flushSections();
    });
    flushSections();
  }

  function groupConsecutiveImages(contentBody) {
    const sections = Array.from(contentBody.querySelectorAll(".lh-section"));
    sections.forEach(groupImagesWithinSection);
    groupImageOnlySections(contentBody);
  }

  function initializeImageGalleries() {
    document.querySelectorAll(".lh-content-body").forEach((contentBody) => {
      let scheduled = false;
      const regroup = () => {
        if (scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(() => {
          scheduled = false;
          groupConsecutiveImages(contentBody);
          initializeImageGalleryControls(contentBody);
        });
      };

      groupConsecutiveImages(contentBody);
      initializeImageGalleryControls(contentBody);
      new MutationObserver(regroup).observe(contentBody, {
        childList: true,
        subtree: true,
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeImageGalleries, {
      once: true,
    });
  } else {
    initializeImageGalleries();
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
