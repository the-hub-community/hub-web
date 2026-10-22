/**
 * command-palette.js
 * ⌘K / Ctrl+K command palette with static + semantic search.
 * Pure vanilla, no dependencies beyond Font Awesome + i18n.
 */
(function initCommandPalette() {
  "use strict";

  if (window.__resiHubCmdkLoaded) return;
  window.__resiHubCmdkLoaded = true;

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || "");
  const OPEN_SHORTCUT_LABEL = isMac ? "⌘K" : "Ctrl+K";
  const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");

  const state = {
    isOpen: false,
    query: "",
    results: [],
    activeIndex: 0,
    lastFocused: null,
  };

  // ── Static actions registry ──────────────────────────────────
  const STATIC_ACTIONS = [
    {
      id: "action-new-page",
      group: "actions",
      icon: "fa-solid fa-pen-to-square",
      labelKey: "command_palette.actions.new_page",
      fallback: "Create a new page",
      href: "/submit.html",
    },
    {
      id: "action-new-listing",
      group: "actions",
      icon: "fa-solid fa-tag",
      labelKey: "command_palette.actions.new_listing",
      fallback: "Post a listing",
      href: "/list-service.html",
    },
    {
      id: "action-broadcast",
      group: "actions",
      icon: "fa-solid fa-bullhorn",
      labelKey: "command_palette.actions.broadcast",
      fallback: "Send a broadcast",
      href: "/broadcast.html",
    },
    {
      id: "action-notification",
      group: "actions",
      icon: "fa-solid fa-bell",
      labelKey: "command_palette.actions.notifications",
      fallback: "Share a notice",
      href: "/notification.html",
    },
    {
      id: "action-submissions",
      group: "actions",
      icon: "fa-regular fa-file-lines",
      labelKey: "command_palette.actions.my_submissions",
      fallback: "View my submissions",
      href: "/my-submissions.html",
    },
    {
      id: "action-settings",
      group: "actions",
      icon: "fa-solid fa-gear",
      labelKey: "command_palette.actions.settings",
      fallback: "Open settings",
      href: "/status.html",
    },
    {
      id: "action-toggle-theme",
      group: "actions",
      icon: "fa-solid fa-circle-half-stroke",
      labelKey: "command_palette.actions.toggle_theme",
      fallback: "Toggle dark mode",
      onSelect: () => window.ResiHubTheme?.toggle?.(),
    },
  ];

  // ── DOM lookups ──────────────────────────────────────────────
  let root, input, resultsEl, emptyEl, loadingEl;

  function cacheDom() {
    root = document.getElementById("cmd-palette");
    if (!root) return false;
    input = root.querySelector("#cmd-palette-input");
    resultsEl = root.querySelector("#cmd-palette-results");
    emptyEl = root.querySelector("#cmd-palette-empty");
    loadingEl = root.querySelector("#cmd-palette-loading");
    return true;
  }

  function t(key, fallback) {
    return typeof window.t === "function" ? window.t(key, fallback) : fallback;
  }

  // ── Open / close ─────────────────────────────────────────────
  function open() {
    if (state.isOpen) return;
    state.lastFocused = document.activeElement;
    state.isOpen = true;
    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("cmd-palette-open");
    input.value = "";
    state.query = "";
    renderResults([]);
    requestAnimationFrame(() => input.focus());
  }

  function close() {
    if (!state.isOpen) return;
    state.isOpen = false;
    root.classList.remove("is-open");
    document.body.classList.remove("cmd-palette-open");

    // Restore focus BEFORE hiding the palette from assistive tech,
    // otherwise Chrome blocks the aria-hidden change.
    if (state.lastFocused && state.lastFocused.focus) {
      state.lastFocused.focus();
    }

    root.setAttribute("aria-hidden", "true");
  }

  // ── Search ───────────────────────────────────────────────────
  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .trim();
  }

  function getLocalCandidates() {
    const candidates = [...STATIC_ACTIONS];

    // Sidebar nav items — become searchable
    document.querySelectorAll(".sidebar-nav__item").forEach((el) => {
      const label = el.querySelector("span")?.textContent?.trim();
      const href = el.getAttribute("href");
      if (!label || !href) return;
      candidates.push({
        id: `nav-${href}`,
        group: "pages",
        icon: "fa-solid fa-file-lines",
        label,
        subtitle: "Navigation",
        href,
      });
    });

    // Marketplace listings
    document.querySelectorAll(".mp-card-v2").forEach((card) => {
      const title = card
        .querySelector(".mp-card-v2__title")
        ?.textContent?.trim();
      const href = card.getAttribute("href");
      if (!title || !href) return;
      candidates.push({
        id: `listing-${href}`,
        group: "listings",
        icon: "fa-solid fa-tag",
        label: title,
        subtitle: "Listing",
        href,
      });
    });

    return candidates;
  }

  function resolveCandidateLabel(candidate) {
    if (!candidate) return "";
    if (typeof candidate.label === "string" && candidate.label.trim()) {
      return candidate.label;
    }
    if (typeof candidate.labelKey === "string") {
      const fallback = candidate.fallback || "";
      const translated =
        typeof window.t === "function"
          ? window.t(candidate.labelKey, fallback)
          : fallback;
      if (typeof translated === "string" && translated.trim()) {
        return translated;
      }
    }
    return candidate.fallback || "";
  }

  function scoreCandidate(candidate, query) {
    const q = normalize(query);
    if (!q) return 1;
    const label = normalize(resolveCandidateLabel(candidate));
    if (!label) return 0;
    if (label === q) return 100;
    if (label.startsWith(q)) return 60;
    if (label.includes(q)) return 30;
    return 0;
  }

  function searchLocal(query) {
    const candidates = getLocalCandidates();
    return candidates
      .map((c) => ({ ...c, score: scoreCandidate(c, query) }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }

  async function searchRemote(query) {
    if (!API_BASE || !query || query.length < 2) return [];
    try {
      const res = await fetch(
        `${API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=6`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) return [];
      const data = await res.json();
      if (!data?.success || !Array.isArray(data.results)) return [];
      return data.results.map((r) => ({
        id: `remote-${r.id || r.href}`,
        group: r.type || "pages",
        icon: r.icon || "fa-solid fa-file-lines",
        label: r.title,
        subtitle: r.subtitle || "",
        href: r.href,
      }));
    } catch {
      return [];
    }
  }

  // ── Render ───────────────────────────────────────────────────
  const GROUP_LABELS = {
    actions: "command_palette.sections.actions",
    pages: "command_palette.sections.pages",
    listings: "command_palette.sections.listings",
    communities: "command_palette.sections.communities",
  };

  const GROUP_FALLBACKS = {
    actions: "Actions",
    pages: "Pages",
    listings: "Listings",
    communities: "Communities",
  };

  function renderResults(items) {
    state.results = items;
    state.activeIndex = 0;
    resultsEl
      .querySelectorAll(".cmd-palette__group")
      .forEach((n) => n.remove());

    if (!items.length) {
      emptyEl.hidden = state.query.length === 0;
      return;
    }
    emptyEl.hidden = true;

    const grouped = items.reduce((acc, item) => {
      const key = item.group || "pages";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    let flatIndex = 0;
    Object.keys(grouped).forEach((groupKey) => {
      const group = document.createElement("div");
      group.className = "cmd-palette__group";
      group.dataset.group = groupKey;

      const header = document.createElement("div");
      header.className = "cmd-palette__group-header";
      header.textContent = t(
        GROUP_LABELS[groupKey] || "command_palette.sections.pages",
        GROUP_FALLBACKS[groupKey] || "Results",
      );
      group.appendChild(header);

      grouped[groupKey].forEach((item) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "cmd-palette__item";
        row.dataset.index = String(flatIndex);
        row.setAttribute("role", "option");
        if (flatIndex === 0) row.classList.add("is-active");

        const displayLabel = resolveCandidateLabel(item);
        const displaySubtitle = item.subtitle || "";
        row.innerHTML = `
          <span class="cmd-palette__item-icon"><i class="${item.icon}" aria-hidden="true"></i></span>
          <span class="cmd-palette__item-body">
            <span class="cmd-palette__item-label">${escapeHtml(displayLabel)}</span>
            ${displaySubtitle ? `<span class="cmd-palette__item-subtitle">${escapeHtml(displaySubtitle)}</span>` : ""}
          </span>
          <span class="cmd-palette__item-arrow"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
        `;

        row.addEventListener("click", () => {
          selectIndex(Number(row.dataset.index));
        });
        row.addEventListener("mouseenter", () => {
          setActive(Number(row.dataset.index));
        });

        group.appendChild(row);
        flatIndex += 1;
      });

      resultsEl.appendChild(group);
    });

    // Move empty/loading after groups
    resultsEl.appendChild(emptyEl);
    resultsEl.appendChild(loadingEl);
  }

  function setActive(index) {
    const items = resultsEl.querySelectorAll(".cmd-palette__item");
    items.forEach((el) => el.classList.remove("is-active"));
    const target = items[index];
    if (target) {
      target.classList.add("is-active");
      target.scrollIntoView({ block: "nearest" });
      state.activeIndex = index;
    }
  }

  function selectIndex(index) {
    const item = state.results[index];
    if (!item) return;
    if (typeof item.onSelect === "function") {
      item.onSelect();
      close();
      return;
    }
    if (item.href) {
      window.location.href = item.href;
      close();
    }
  }

  function move(delta) {
    const total = state.results.length;
    if (!total) return;
    const next = (state.activeIndex + delta + total) % total;
    setActive(next);
  }

  // ── Escape helper ────────────────────────────────────────────
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ── Debounced search ─────────────────────────────────────────
  let searchTimer = null;
  let requestId = 0;

  function scheduleSearch(query) {
    state.query = query;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 180);
  }

  async function runSearch() {
    const query = state.query;
    const local = searchLocal(query);

    if (!query) {
      renderResults(local);
      return;
    }

    // Show local immediately, then enrich with remote
    renderResults(local);
    if (query.length < 2 || !API_BASE) return;

    const myRequest = ++requestId;
    loadingEl.hidden = false;

    const remote = await searchRemote(query);
    if (myRequest !== requestId) return;
    loadingEl.hidden = true;

    const seen = new Set(local.map((x) => x.id));
    const merged = [...local, ...remote.filter((r) => !seen.has(r.id))];
    renderResults(merged);
  }

  // ── Keyboard handling ────────────────────────────────────────
  function onGlobalKeydown(e) {
    const isShortcut =
      (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k";
    if (isShortcut) {
      e.preventDefault();
      state.isOpen ? close() : open();
      return;
    }
    if (e.key === "Escape" && state.isOpen) {
      e.preventDefault();
      close();
    }
  }

  function onPaletteKeydown(e) {
    if (!state.isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectIndex(state.activeIndex);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      e.preventDefault();
    }
  }

  // ── Bootstrap ────────────────────────────────────────────────
  function bindTriggers() {
    document.querySelectorAll("[data-cmdk-open]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        open();
      });
    });
  }

  function bootstrap() {
    if (!cacheDom()) {
      console.warn("[cmd-palette] root element not found");
      return;
    }
    bindTriggers();

    root.querySelectorAll("[data-cmdk-close]").forEach((el) => {
      el.addEventListener("click", close);
    });

    input.addEventListener("input", (e) => scheduleSearch(e.target.value));
    input.addEventListener("keydown", onPaletteKeydown);
    document.addEventListener("keydown", onGlobalKeydown);

    window.addEventListener("resiHub:languageChanged", () => {
      if (state.isOpen) renderResults(state.results);
    });

    window.ResiHubCommandPalette = {
      open,
      close,
      toggle: () => (state.isOpen ? close() : open()),
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
