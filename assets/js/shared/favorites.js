(function initFavorites() {
  "use strict";

  const STORAGE_KEY = "resihub_favorites";
  const SIDEBAR_LIMIT = 5;
  const body = document.body;
  const baseUrl = (body.dataset.baseurl || "").replace(/\/+$/, "");
  const contentPrefix = `${baseUrl}/content/`;
  const toggle = document.querySelector("[data-favorite-toggle]");
  const sidebarGroup = document.querySelector("[data-favorites-sidebar]");
  const sidebarList = document.querySelector("[data-favorites-sidebar-list]");
  const favoritesList = document.querySelector("[data-favorites-list]");
  const emptyState = document.querySelector("[data-favorites-empty]");
  const errorState = document.querySelector("[data-favorites-error]");
  const toggleStatus = document.querySelector("[data-favorite-status]");
  let favorites = [];
  let storageFailed = false;

  function normalizeFavorite(item) {
    if (!item || typeof item !== "object" || !["community", "page"].includes(item.type)) {
      return null;
    }

    const title = typeof item.title === "string" ? item.title.trim() : "";
    const community = typeof item.community === "string" ? item.community.trim() : "";
    if (!title || !community || typeof item.url !== "string") return null;

    let url;
    try {
      url = new URL(item.url, window.location.origin);
    } catch {
      return null;
    }

    if (url.origin !== window.location.origin || !url.pathname.startsWith(contentPrefix)) {
      return null;
    }

    return {
      type: item.type,
      title,
      community,
      url: url.pathname,
    };
  }

  function sortFavorites(items) {
    return items.sort((left, right) =>
      left.community.localeCompare(right.community) ||
      (left.type === right.type ? 0 : left.type === "community" ? -1 : 1) ||
      left.title.localeCompare(right.title),
    );
  }

  function setError(message, error) {
    storageFailed = true;
    console.error(`Favorites: ${message}`, error);
    if (toggleStatus) {
      toggleStatus.textContent = "Favorites unavailable in this browser.";
      toggleStatus.hidden = false;
    }
    if (errorState) {
      errorState.textContent = "Favorites could not be loaded or saved in this browser.";
      errorState.hidden = false;
    }
    if (toggle) toggle.disabled = true;
  }

  function loadFavorites() {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      throw new TypeError("Saved favorites must be an array.");
    }

    return parsed.map(normalizeFavorite).filter((favorite) => {
      if (favorite) return true;
      console.warn("Favorites: ignored invalid saved favorite.");
      return false;
    });
  }

  function makeLink(favorite, sidebar = false) {
    const link = document.createElement("a");
    link.className = sidebar ? "sidebar-nav__favorite" : "favorites-page__link";
    link.href = favorite.url;
    link.title = `${favorite.title} — ${favorite.community}`;

    const icon = document.createElement("i");
    icon.className = favorite.type === "community"
      ? "fa-solid fa-house"
      : "fa-regular fa-file-lines";
    icon.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    copy.className = sidebar ? "sidebar-nav__favorite-copy" : "favorites-page__copy";
    const title = document.createElement("span");
    title.className = sidebar ? "sidebar-nav__favorite-title" : "favorites-page__title";
    title.textContent = favorite.title;
    copy.append(title);

    const community = document.createElement("span");
    community.className = sidebar ? "sidebar-nav__favorite-community" : "favorites-page__community";
    community.textContent = favorite.type === "community" ? "Community" : favorite.community;
    copy.append(community);

    link.append(icon, copy);
    return link;
  }

  function makeRemoveButton(favorite) {
    const button = document.createElement("button");
    button.className = "favorites-page__remove";
    button.type = "button";
    button.textContent = "Remove";
    button.setAttribute("aria-label", `Remove ${favorite.title} from favorites`);
    button.addEventListener("click", () => updateFavorite(favorite, false));
    return button;
  }

  function render() {
    if (storageFailed) return;
    const sorted = sortFavorites([...favorites]);

    if (sidebarGroup && sidebarList) {
      sidebarList.replaceChildren();
      sidebarGroup.hidden = sorted.length === 0;
      sorted.slice(0, SIDEBAR_LIMIT).forEach((favorite) => {
        sidebarList.append(makeLink(favorite, true));
      });
    }

    if (favoritesList && emptyState) {
      favoritesList.replaceChildren();
      emptyState.hidden = sorted.length > 0;
      sorted.forEach((favorite) => {
        const row = document.createElement("article");
        row.className = "favorites-page__item";
        row.append(makeLink(favorite), makeRemoveButton(favorite));
        favoritesList.append(row);
      });
    }

    if (toggle) {
      const current = normalizeFavorite({
        type: toggle.dataset.favoriteType,
        title: toggle.dataset.favoriteTitle,
        community: toggle.dataset.favoriteCommunity,
        url: toggle.dataset.favoriteUrl,
      });
      if (!current) {
        toggle.disabled = true;
        console.error("Favorites: current wiki page has invalid favorite metadata.");
        if (toggleStatus) {
          toggleStatus.textContent = "This page cannot be added to favorites.";
          toggleStatus.hidden = false;
        }
        return;
      }

      const isFavorite = favorites.some((favorite) => favorite.url === current.url);
      toggle.setAttribute("aria-pressed", String(isFavorite));
      toggle.querySelector("[data-favorite-label]").textContent = isFavorite
        ? "Remove from favorites"
        : "Save to favorites";
      toggle.querySelector("i").className = isFavorite
        ? "fa-solid fa-star"
        : "fa-regular fa-star";
    }
  }

  function persist() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }

  function updateFavorite(item, shouldSave) {
    if (storageFailed) return;
    const favorite = normalizeFavorite(item);
    if (!favorite) {
      setError("Could not update favorite because page metadata was invalid.", new TypeError("Invalid favorite metadata."));
      return;
    }

    const previous = favorites;
    const next = previous.filter((saved) => saved.url !== favorite.url);
    if (shouldSave) next.push(favorite);
    try {
      favorites = next;
      persist();
      if (toggleStatus) {
        toggleStatus.textContent = shouldSave ? "Added to favorites." : "Removed from favorites.";
        toggleStatus.hidden = false;
      }
      render();
    } catch (error) {
      favorites = previous;
      setError("Could not save favorites.", error);
    }
  }

  try {
    favorites = loadFavorites();
    render();
  } catch (error) {
    setError("Could not load favorites.", error);
  }

  if (toggle) {
    toggle.addEventListener("click", () => {
      const favorite = normalizeFavorite({
        type: toggle.dataset.favoriteType,
        title: toggle.dataset.favoriteTitle,
        community: toggle.dataset.favoriteCommunity,
        url: toggle.dataset.favoriteUrl,
      });
      if (favorite) {
        updateFavorite(favorite, !favorites.some((saved) => saved.url === favorite.url));
      } else {
        setError("Could not update favorite because page metadata was invalid.", new TypeError("Invalid favorite metadata."));
      }
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    try {
      favorites = loadFavorites();
      if (toggleStatus) toggleStatus.hidden = true;
      render();
    } catch (error) {
      setError("Could not refresh favorites.", error);
    }
  });
})();
