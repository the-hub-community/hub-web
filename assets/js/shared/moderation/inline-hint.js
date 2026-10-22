/**
 * moderation/inline-hint.js
 * Non-blocking inline hint UI. Shows a dismissible banner above
 * the editor footer. Never blocks. Auto-hides after 8s.
 */
(function initModerationHint() {
  "use strict";
  if (window.ResiHubModerationHint) return;

  let activeHint = null;
  let hideTimer = null;

  function ensureContainer() {
    const drawer = document.getElementById("editor-panel");
    const footer = drawer?.querySelector(".drawer-footer");
    if (!footer) return null;

    let container = drawer.querySelector(".moderation-hint");
    if (!container) {
      container = document.createElement("div");
      container.className = "moderation-hint";
      container.setAttribute("role", "status");
      container.setAttribute("aria-live", "polite");
      footer.parentNode.insertBefore(container, footer);
    }
    return container;
  }

  function show(message) {
    const container = ensureContainer();
    if (!container) return;

    container.innerHTML = `
      <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
      <span>${escapeHtml(message)}</span>
    `;
    container.classList.add("is-visible");
    activeHint = container;

    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 8000);
  }

  function hide() {
    if (activeHint) {
      activeHint.classList.remove("is-visible");
    }
    clearTimeout(hideTimer);
  }

  function escapeHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  window.ResiHubModerationHint = { show, hide };
})();
