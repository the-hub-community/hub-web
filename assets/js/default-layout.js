import { initThemeNav, toggleAlertFeed } from "./layout/theme-nav.js";
import {
  addNewSection,
  addSectionToDrawer,
  initDrawer,
  prepareEdit,
  togglePanel,
} from "./editor/drawer.js";
import {
  decodeHtmlEntities,
  deepCleanHTML,
  extractYoutubeId,
  htmlToMarkdown,
  normalizeEditorHtml,
  normalizeImageUrl,
  normalizeYoutubeUrl,
  unwrapEncodedCodeBlocks,
} from "./editor/transformers.js";
import { initDrawerSubmit } from "./editor/submit.js";
import {
  initGlobalErrorHandling,
  showErrorMessage,
} from "./shared/error-toast.js";

// Mobile Alerts Toggle
const mobileAlertsBtn = document.getElementById("mobileAlertsBtn");
const alertsContainer = document.getElementById("wikiAlertsContainer");
const mobileAlertsIcon = document.getElementById("mobileAlertsIcon");

if (mobileAlertsBtn && alertsContainer) {
  mobileAlertsBtn.addEventListener("click", () => {
    alertsContainer.classList.toggle("is-open");
    mobileAlertsIcon.classList.toggle("fa-chevron-down");
    mobileAlertsIcon.classList.toggle("fa-chevron-up");
  });
}

function getResourceMode() {
  return (document.body?.dataset?.resourceMode || "dev").trim().toLowerCase();
}

function shouldExposeDebugBindings() {
  const mode = getResourceMode();
  // Hard lock: never expose debug bindings in prod mode.
  if (mode === "prod") return false;

  const explicit = (document.body?.dataset?.exposeDebugBindings || "")
    .trim()
    .toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return true;
}

function initShareLinks() {
  const isMarketplaceItemPage = Boolean(
    document.querySelector(".ad-v2026-wrapper"),
  );

  let pageUrl = window.location.href;
  let pageTitle = document.title || "ResiHub";

  if (isMarketplaceItemPage) {
    // Share a clean listing URL, not transient marketplace navigation state.
    pageUrl = `${window.location.origin}${window.location.pathname}`;
    const listingTitle = document
      .querySelector(".listing-hero-v26 h1")
      ?.textContent?.trim();
    if (listingTitle) {
      pageTitle = `${listingTitle} | The Hub Collective`;
    }
  }

  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedTitle = encodeURIComponent(pageTitle);

  const links = {
    whatsapp: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    x: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
  };

  document.querySelectorAll("[data-share-platform]").forEach((link) => {
    const platform = (
      link.getAttribute("data-share-platform") || ""
    ).toLowerCase();
    const href = links[platform];
    if (!href) return;
    link.setAttribute("href", href);
  });

  if (isMarketplaceItemPage) {
    const listingShareLabel =
      typeof window.t === "function"
        ? window.t("default.share_this_listing", "Share this listing")
        : "Share this listing";
    document
      .querySelectorAll(".page-share-inline__label")
      .forEach((labelEl) => {
        labelEl.textContent = listingShareLabel;
      });
  }
}

function bindLegacyGlobals() {
  window.toggleAlertFeed = toggleAlertFeed;
  window.prepareEdit = prepareEdit;
  window.togglePanel = togglePanel;
  window.addNewSection = addNewSection;

  if (shouldExposeDebugBindings()) {
    window.addSectionToDrawer = addSectionToDrawer;
    window.normalizeEditorHtml = normalizeEditorHtml;
    window.deepCleanHTML = deepCleanHTML;
    window.htmlToMarkdown = htmlToMarkdown;
    window.extractYoutubeId = extractYoutubeId;
    window.normalizeYoutubeUrl = normalizeYoutubeUrl;
    window.normalizeImageUrl = normalizeImageUrl;
    window.decodeHtmlEntities = decodeHtmlEntities;
    window.unwrapEncodedCodeBlocks = unwrapEncodedCodeBlocks;
    window.showErrorMessage = showErrorMessage;
  }
}

function bootstrap() {
  bindLegacyGlobals();
  initThemeNav();
  initShareLinks();
  initDrawer();
  initDrawerSubmit();
  initGlobalErrorHandling();
}

document.addEventListener("DOMContentLoaded", bootstrap);
