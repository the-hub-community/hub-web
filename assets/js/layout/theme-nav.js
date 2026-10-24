import { i18nText } from "../editor/transformers.js";

const TEXT_ZOOM_STORAGE_KEY = "resiHubTextZoom";
const TEXT_ZOOM_MIN = 85;
const TEXT_ZOOM_MAX = 130;
const TEXT_ZOOM_STEP = 5;

function clampZoom(value) {
  return Math.max(TEXT_ZOOM_MIN, Math.min(TEXT_ZOOM_MAX, value));
}

function applyTextZoom(value) {
  const safeZoom = clampZoom(value);
  document.documentElement.style.fontSize = `${safeZoom}%`;
  localStorage.setItem(TEXT_ZOOM_STORAGE_KEY, String(safeZoom));
  return safeZoom;
}

function getSavedTextZoom() {
  const saved = Number(localStorage.getItem(TEXT_ZOOM_STORAGE_KEY));
  if (Number.isFinite(saved)) {
    return clampZoom(saved);
  }
  return 100;
}

function initTextZoom() {
  let currentZoom = applyTextZoom(getSavedTextZoom());
  const zoomOutBtn = document.getElementById("zoomOut");
  const zoomInBtn = document.getElementById("zoomIn");

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", () => {
      currentZoom = applyTextZoom(currentZoom - TEXT_ZOOM_STEP);
    });
  }

  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", () => {
      currentZoom = applyTextZoom(currentZoom + TEXT_ZOOM_STEP);
    });
  }
}

function initThemeToggle() {
  const themeToggle = document.getElementById("themeToggle");
  const body = document.body;
  const root = document.documentElement;

  // Product decision: keep a single calm default theme across the app.
  body.removeAttribute("data-theme");
  root.removeAttribute("data-theme");
  localStorage.setItem("resiHubTheme", "purple");

  if (themeToggle) {
    themeToggle.value = "purple";
  }
}

function initUrgencyPreview() {
  const urgencySelect = document.getElementById("urgency");
  const formPreview = document.getElementById("broadcastForm");

  if (!urgencySelect || !formPreview) return;

  urgencySelect.addEventListener("change", function () {
    formPreview.classList.remove(
      "preview-low",
      "preview-medium",
      "preview-high",
      "preview-critical",
    );
    formPreview.classList.add("preview-" + this.value);
  });
}

export function toggleAlertFeed() {
  const drawer = document.getElementById("alert-drawer");
  const icon = document.getElementById("chevron-icon");
  if (drawer && icon) {
    drawer.classList.toggle("is-open");
    icon.style.transform = drawer.classList.contains("is-open")
      ? "rotate(180deg)"
      : "rotate(0deg)";
  }
}

function initSidebarMenu() {
  const menuToggle = document.getElementById("navToggle");
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  if (!menuToggle || !sidebar) return;

  menuToggle.addEventListener("click", function (e) {
    e.stopPropagation();
    sidebar.classList.toggle("is-open");
    if (overlay) overlay.classList.toggle("is-active");

    const icon = menuToggle.querySelector("i");
    if (icon) {
      icon.classList.toggle("fa-bars");
      icon.classList.toggle("fa-xmark");
    }
  });

  if (overlay) {
    overlay.addEventListener("click", function () {
      sidebar.classList.remove("is-open");
      overlay.classList.remove("is-active");

      const icon = menuToggle.querySelector("i");
      if (icon) {
        icon.classList.add("fa-bars");
        icon.classList.remove("fa-xmark");
      }
    });
  }
}

function initSidebarFilters() {
  const bindFilter = (inputId, selector, valueResolver) => {
    const input = document.getElementById(inputId);
    if (!input) return;

    const links = Array.from(document.querySelectorAll(selector));
    if (!links.length) {
      const wrapper = input.closest(".sidebar-filter-wrap");
      if (wrapper) wrapper.style.display = "none";
      return;
    }

    const applyFilter = () => {
      const query = (input.value || "").trim().toLowerCase();
      links.forEach((link) => {
        const value = valueResolver(link).toLowerCase();
        const matches = !query || value.includes(query);
        link.style.display = matches ? "" : "none";
      });
    };

    input.addEventListener("input", applyFilter);
  };

  function initMarketplaceCommunityPagination() {
    const input = document.getElementById("marketplaceCommunityFilter");
    const toggle = document.getElementById("marketplaceCommunityToggle");
    const allCommunityLinks = Array.from(
      document.querySelectorAll(".community-filter-link--all"),
    );

    if (!toggle || !allCommunityLinks.length) {
      if (toggle) toggle.hidden = true;
      return;
    }

    const collapsedLimit = 3;
    let isExpanded = false;

    const getLabel = () => {
      const key = isExpanded
        ? "sidebar.show_less_communities"
        : "sidebar.show_more_communities";
      const fallback = isExpanded ? "Show less" : "Show more";
      return typeof window.t === "function"
        ? window.t(key, fallback)
        : fallback;
    };

    const applyListState = () => {
      const query = (input && input.value ? input.value : "")
        .trim()
        .toLowerCase();
      const isFiltering = query.length > 0;
      const visibleLinks = allCommunityLinks.filter(
        (link) => link.style.display !== "none",
      );

      allCommunityLinks.forEach((link) =>
        link.classList.remove("is-hidden-by-pagination"),
      );

      if (!isFiltering && !isExpanded && visibleLinks.length > collapsedLimit) {
        visibleLinks.slice(collapsedLimit).forEach((link) => {
          link.classList.add("is-hidden-by-pagination");
        });
      }

      if (!isFiltering && visibleLinks.length > collapsedLimit) {
        toggle.hidden = false;
        toggle.textContent = getLabel();
      } else {
        toggle.hidden = true;
      }
    };

    toggle.addEventListener("click", () => {
      isExpanded = !isExpanded;
      applyListState();
    });

    if (input) {
      input.addEventListener("input", applyListState);
    }

    window.addEventListener("resiHub:languageChanged", () => {
      if (!toggle.hidden) {
        toggle.textContent = getLabel();
      }
    });

    applyListState();
  }

  bindFilter(
    "marketplaceCommunityFilter",
    ".community-filter-link",
    (link) => link.getAttribute("data-community") || link.textContent || "",
  );

  bindFilter(
    "communityWikiFilter",
    ".community-search-link",
    (link) => link.getAttribute("data-search-text") || link.textContent || "",
  );

  initMarketplaceCommunityPagination();
}

function initSidebarAccordionState() {
  const sideNav = document.getElementById("sideNav");
  if (!sideNav) return;

  const accordions = Array.from(
    sideNav.querySelectorAll("details.sidebar-accordion"),
  );
  if (!accordions.length) return;

  const isHomePage = (window.location.pathname || "/") === "/";

  // On non-home pages, start with the accordion that contains the active nav item.
  if (!isHomePage) {
    const activeItem = sideNav.querySelector(".nav-item.active");
    const activeAccordion = activeItem
      ? activeItem.closest("details.sidebar-accordion")
      : null;

    if (activeAccordion) {
      accordions.forEach((accordion) => {
        accordion.open = accordion === activeAccordion;
      });
    } else {
      const opened = accordions.filter((accordion) => accordion.open);
      if (opened.length > 1) {
        opened.slice(1).forEach((accordion) => {
          accordion.open = false;
        });
      }
    }
  }

  // Users can open any accordion; when one opens, others close.
  accordions.forEach((accordion) => {
    accordion.addEventListener("toggle", () => {
      if (!accordion.open) return;
      accordions.forEach((other) => {
        if (other !== accordion) {
          other.open = false;
        }
      });
    });
  });
}

function initMarkdownImageLightbox() {
  const wikiContainer = document.querySelector(".wiki-render");
  if (!wikiContainer) return;

  const lightbox = document.createElement("div");
  lightbox.className = "md-image-lightbox";
  lightbox.setAttribute("aria-hidden", "true");
  lightbox.innerHTML = `
    <div class="md-image-lightbox__backdrop" data-lightbox-close="true"></div>
    <div class="md-image-lightbox__content" role="dialog" aria-modal="true" aria-label="Image preview">
      <button type="button" class="md-image-lightbox__close" data-lightbox-close="true" aria-label="${i18nText("messages.close", "Close")}">&times;</button>
      <img class="md-image-lightbox__img" alt="" />
    </div>
  `;

  const imgEl = lightbox.querySelector(".md-image-lightbox__img");
  const closeButton = lightbox.querySelector(".md-image-lightbox__close");

  const syncCloseLabel = () => {
    if (!closeButton) return;
    closeButton.setAttribute("aria-label", i18nText("messages.close", "Close"));
  };

  const closeLightbox = () => {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("md-lightbox-open");
  };

  const openLightbox = (src, alt) => {
    if (!imgEl || !src) return;
    imgEl.src = src;
    imgEl.alt = alt || "";
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("md-lightbox-open");
  };

  wikiContainer.addEventListener("click", (event) => {
    const targetImage = event.target.closest(
      ".lh-content-body img, .wiki-render > img",
    );
    if (!targetImage) return;

    if (targetImage.closest("[data-disable-md-lightbox='true']")) {
      return;
    }

    const imageSrc = targetImage.currentSrc || targetImage.src;
    if (!imageSrc) return;

    openLightbox(imageSrc, targetImage.alt);
  });

  lightbox.addEventListener("click", (event) => {
    if (event.target.closest("[data-lightbox-close='true']")) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && lightbox.classList.contains("is-open")) {
      closeLightbox();
    }
  });

  window.addEventListener("resiHub:languageChanged", syncCloseLabel);
  syncCloseLabel();

  document.body.appendChild(lightbox);
}

function initWikiLanguageContent() {
  const wikiContainer = document.querySelector(".wiki-render");
  if (!wikiContainer) return;

  const englishHtml = wikiContainer.innerHTML;
  const frenchTemplate = document.getElementById("wikiContentFr");
  const frenchHtml = frenchTemplate ? frenchTemplate.innerHTML : "";
  let renderedLanguage = "en";

  const applyWikiLanguage = async (language) => {
    if (language !== "fr") {
      if (renderedLanguage === "en") {
        return;
      }
      wikiContainer.innerHTML = englishHtml;
      renderedLanguage = "en";
      return;
    }

    if (frenchHtml.trim()) {
      if (renderedLanguage === "fr") {
        return;
      }
      wikiContainer.innerHTML = frenchHtml;
      renderedLanguage = "fr";
      return;
    }

    if (renderedLanguage !== "en") {
      wikiContainer.innerHTML = englishHtml;
      renderedLanguage = "en";
    }
  };

  const currentLanguage =
    typeof window.getCurrentLanguage === "function"
      ? window.getCurrentLanguage()
      : "en";
  applyWikiLanguage(currentLanguage);

  window.addEventListener("resiHub:languageChanged", (event) => {
    const language = event?.detail?.language || "en";
    applyWikiLanguage(language);
  });
}

function initAlertDrawerLanguageContent() {
  const drawerItems = Array.from(
    document.querySelectorAll(".alert-drawer-body .drawer-item"),
  );
  if (!drawerItems.length) return;

  const entries = drawerItems
    .map((item) => {
      const body = item.querySelector(".drawer-text");
      if (!body) return null;

      const englishHtml = body.innerHTML;
      const frenchTemplate = item.querySelector(".drawer-text-fr");
      const frenchHtml = frenchTemplate ? frenchTemplate.innerHTML : "";

      return { body, englishHtml, frenchHtml };
    })
    .filter(Boolean);

  if (!entries.length) return;

  let renderedLanguage = "en";

  const applyAlertLanguage = (language) => {
    const targetLanguage = language === "fr" ? "fr" : "en";
    if (targetLanguage === renderedLanguage) {
      return;
    }

    entries.forEach(({ body, englishHtml, frenchHtml }) => {
      if (targetLanguage === "fr" && frenchHtml.trim()) {
        body.innerHTML = frenchHtml;
        return;
      }
      body.innerHTML = englishHtml;
    });

    renderedLanguage = targetLanguage;
  };

  const currentLanguage =
    typeof window.getCurrentLanguage === "function"
      ? window.getCurrentLanguage()
      : "en";
  applyAlertLanguage(currentLanguage);

  window.addEventListener("resiHub:languageChanged", (event) => {
    const language = event?.detail?.language || "en";
    applyAlertLanguage(language);
  });
}

export function initThemeNav() {
  // initThemeToggle();
  initTextZoom();
  initUrgencyPreview();
  initSidebarMenu();
  initSidebarAccordionState();
  initSidebarFilters();
  initWikiLanguageContent();
  initAlertDrawerLanguageContent();
  // initMarkdownImageLightbox();
  initGlobalLightbox();
  initAddToHomeScreen();
}
function initGlobalLightbox() {
  // Safety guard: Don't run if it already exists
  if (document.getElementById("global-lightbox")) return;

  const lb = document.createElement("div");
  lb.id = "global-lightbox";
  lb.className = "global-lightbox";
  lb.innerHTML = `
    <div class="global-lightbox__backdrop"></div>
    <button class="global-lightbox__close" aria-label="Close image">&times;</button>
    <img class="global-lightbox__img" src="" alt="Enlarged image">
  `;
  document.body.appendChild(lb);

  const img = lb.querySelector(".global-lightbox__img");
  const close = lb.querySelector(".global-lightbox__close");
  const backdrop = lb.querySelector(".global-lightbox__backdrop");

  const closeLightbox = () => {
    lb.classList.remove("is-open");
    document.body.style.overflow = "";
  };

  close.addEventListener("click", closeLightbox);
  backdrop.addEventListener("click", closeLightbox);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lb.classList.contains("is-open")) closeLightbox();
  });

  document.addEventListener("click", (e) => {
    // Catches images in wiki pages, marketplace detail galleries, and standard content blocks
    const targetImg = e.target.closest(
      ".detail-gallery__hero img, .wiki-render img, .lh-content-body img",
    );

    if (!targetImg || targetImg.closest(".comment-card")) return;

    e.preventDefault();
    img.src = targetImg.src;
    lb.classList.add("is-open");
    document.body.style.overflow = "hidden";
  });
}

function initAddToHomeScreen() {
  const banner = document.getElementById("a2hs-banner");
  const closeBtn = document.getElementById("a2hs-close-btn");
  const settingsItem = document.getElementById("a2hs-settings-item");

  // 1. Check if already installed
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone;

  // Hide the settings option if the app is already installed
  if (isStandalone && settingsItem) {
    settingsItem.style.display = "none";
  }

  // 2. Listen for the native prompt (Android/Chrome)
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  // 3. Expose a global function for the Settings page button
  window.ResiHubInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted" && banner) banner.style.display = "none";
      deferredPrompt = null;
    } else if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      alert(
        "To install on iOS:\n\n1. Tap the Share icon\n2. Scroll down and tap 'Add to Home Screen'",
      );
    } else {
      alert(
        "Installation is not available right now. Please check your browser menu.",
      );
    }
  };

  // 4. Show the Toast on initial load
  if (!banner) return;

  // Don't show if installed, or if we are already on the settings page
  if (isStandalone || window.location.pathname.includes("/settings")) return;

  // Show it once per session (so it doesn't annoy them on every click)
  if (!sessionStorage.getItem("a2hs-dismissed")) {
    setTimeout(() => {
      banner.style.display = "flex";
    }, 1500); // 1.5 second delay so it doesn't flash on load
  }

  // Handle close button
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      banner.style.display = "none";
      sessionStorage.setItem("a2hs-dismissed", "true");
    });
  }
}
