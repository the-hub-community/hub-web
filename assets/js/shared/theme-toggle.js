/**
 * theme-toggle.js
 * Reads saved preference, applies to <html>, and provides
 * a toggle() function that cycles light → dark → system.
 */
(function initThemeToggle() {
  "use strict";

  const STORAGE_KEY = "resihub_theme";
  const VALID = ["light", "dark", "system"];

  function getSaved() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return VALID.includes(saved) ? saved : "system";
  }

  function apply(theme) {
    const root = document.documentElement;
    root.classList.add("theme-transitioning");

    if (theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }

    // Update toggle button icon if it exists
    const btn = document.getElementById("themeToggleBtn");
    if (btn) {
      const icon = btn.querySelector("i");
      if (icon) {
        icon.className =
          theme === "dark"
            ? "fa-solid fa-moon"
            : theme === "light"
              ? "fa-solid fa-sun"
              : "fa-solid fa-circle-half-stroke";
      }
    }

    setTimeout(() => root.classList.remove("theme-transitioning"), 350);
  }

  function set(theme) {
    if (!VALID.includes(theme)) theme = "system";
    localStorage.setItem(STORAGE_KEY, theme);
    apply(theme);
  }

  function toggle() {
    const current = getSaved();

    // If currently in "system", resolve to what's actually showing
    let effective = current;
    if (current === "system") {
      effective = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    // Then flip to the opposite
    const next = effective === "dark" ? "light" : "dark";
    set(next);
    return next;
  }

  // Apply on load (before paint) to avoid flash
  apply(getSaved());

  // Expose for UI buttons
  window.ResiHubTheme = { toggle, set, get: getSaved };

  // Wire up any element with [data-theme-toggle]
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-theme-toggle]").forEach((el) => {
      el.addEventListener("click", () => toggle());
    });
  });
})();
