/* ================================================================
   MARKETPLACE ENGINE: FILTERS, PAGINATION, & TRANSITIONS
   ================================================================ */

let currentCategory = "all";
let currentCommunity = "all";
let currentPage = 1;
const adsPerPage = 6; // Adjust based on your preference
let currentSort = "relevance";
let currentPriceBand = "all";
const activeTags = new Set();
let listingIndex = [];

const SORT_LABELS = {
  relevance: "Smart relevance",
  newest: "Newest first",
  price_low: "Price: Low to High",
  price_high: "Price: High to Low",
  title_az: "Title: A-Z",
};

const PRICE_LABELS = {
  all: "Any",
  free: "Free / Contact seller",
  under50: "Under $50",
  "50to200": "$50 - $200",
  "200plus": "$200+",
};

function normalizeCommunity(value) {
  return (value || "").toString().trim().toLowerCase();
}

function slugifyCommunity(value) {
  return normalizeCommunity(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveCommunityFilterFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return normalizeCommunity(params.get("community"));
}

function parseUrlState() {
  const params = new URLSearchParams(window.location.search);
  const page = Number.parseInt(params.get("page") || "1", 10);
  const rawTags = (params.get("tags") || "").trim();

  return {
    category: (params.get("category") || "all").trim() || "all",
    community: normalizeCommunity(params.get("community") || "all") || "all",
    q: (params.get("q") || "").trim(),
    sort: (params.get("sort") || "relevance").trim() || "relevance",
    price: (params.get("price") || "all").trim() || "all",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    tags: rawTags
      ? rawTags
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean)
      : [],
  };
}

function writeUrlState() {
  const params = new URLSearchParams();
  const searchValue = document.getElementById("adSearch")?.value?.trim() || "";

  if (currentCategory !== "all") params.set("category", currentCategory);
  if (currentCommunity !== "all") params.set("community", currentCommunity);
  if (searchValue) params.set("q", searchValue);
  if (currentSort !== "relevance") params.set("sort", currentSort);
  if (currentPriceBand !== "all") params.set("price", currentPriceBand);
  if (activeTags.size) params.set("tags", Array.from(activeTags).join(","));
  if (currentPage > 1) params.set("page", String(currentPage));

  const query = params.toString();
  const nextUrl = query
    ? `${window.location.pathname}?${query}`
    : window.location.pathname;
  window.history.replaceState({}, "", nextUrl);
}

function normalizeToken(value) {
  return (value || "").toString().trim().toLowerCase();
}

function splitTokens(value) {
  const input = normalizeToken(value);
  if (!input) return [];
  return input.split(/[^a-z0-9]+/).filter((part) => part.length > 1);
}

function parsePrice(value) {
  if (value === null || value === undefined) return 0;
  const normalized = String(value)
    .replace(/[^0-9.]/g, "")
    .trim();
  if (!normalized) return 0;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toTitleCase(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function resolveCommunityHomeUrl(communityName) {
  const slug = slugifyCommunity(communityName);
  if (!slug || slug === "general") return "";
  const baseUrl = (document.body?.dataset?.baseurl || "").trim();
  return `${baseUrl}/content/${slug}/`;
}

function resolveMarketplaceUrl(communityName) {
  const baseUrl = (document.body?.dataset?.baseurl || "").trim();
  const marketplaceUrl = `${baseUrl}/marketplace.html`;
  const normalizedCommunity = normalizeCommunity(communityName);

  if (
    !normalizedCommunity ||
    normalizedCommunity === "all" ||
    normalizedCommunity === "general"
  ) {
    return marketplaceUrl;
  }

  return `${marketplaceUrl}?community=${encodeURIComponent(communityName)}`;
}

function getCategoryLabel(category) {
  if (!category || category === "all") return "All Explore";
  return category;
}

function getCommunityLabel(communityName) {
  if (!communityName || communityName === "all") return "All communities";

  const normalized = normalizeCommunity(communityName);
  const normalizedSlug = slugifyCommunity(normalized);
  const match = listingIndex.find(
    (item) =>
      item.communityNorm === normalized ||
      item.communitySlug === normalizedSlug,
  );

  if (match?.communityLabel) return match.communityLabel;
  return toTitleCase(normalized.replace(/-/g, " "));
}

function resolveCommunitySelectValue(rawValue, selectEl) {
  const normalized = normalizeCommunity(rawValue) || "all";
  if (normalized === "all") return "all";

  const options = new Set(
    Array.from(selectEl?.options || []).map((option) =>
      normalizeCommunity(option.value),
    ),
  );

  if (options.has(normalized)) return normalized;

  const normalizedSlug = slugifyCommunity(normalized);
  const match = listingIndex.find(
    (item) =>
      item.communityNorm === normalized ||
      item.communitySlug === normalizedSlug,
  );

  if (match && options.has(match.communityNorm)) {
    return match.communityNorm;
  }

  return "all";
}

function getSortLabel(sort) {
  return SORT_LABELS[sort] || SORT_LABELS.relevance;
}

function getPriceLabel(priceBand) {
  return PRICE_LABELS[priceBand] || PRICE_LABELS.all;
}

function buildListingIndex() {
  const cards = Array.from(document.querySelectorAll(".ad-card-wrapper"));

  listingIndex = cards.map((card) => {
    const category = String(card.dataset.category || "").trim();
    const categoryNorm = normalizeToken(category);
    const titleNorm = normalizeToken(card.dataset.title || "");
    const tags = String(card.dataset.tags || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);

    const communityFromLabel = normalizeToken(
      card.querySelector(".label-com")?.textContent || "",
    );
    const communityNorm = normalizeToken(
      card.dataset.community || communityFromLabel || "general",
    );
    const communityLabel =
      card.querySelector(".label-com")?.textContent?.trim() ||
      toTitleCase(communityNorm) ||
      "General";
    const communitySlug = slugifyCommunity(
      card.dataset.communitySlug || card.dataset.community || communityLabel,
    );
    const price = parsePrice(card.dataset.price);
    const date = Number.parseInt(card.dataset.date || "0", 10);
    const searchBlob = `${titleNorm} ${tags.join(" ")} ${categoryNorm} ${communityNorm} ${communitySlug}`;

    return {
      card,
      category,
      categoryNorm,
      titleNorm,
      tags,
      communityNorm,
      communitySlug,
      communityLabel,
      price,
      date: Number.isFinite(date) ? date : 0,
      searchBlob,
    };
  });
}

function populateCommunityOptions() {
  const select = document.getElementById("mpCommunitySelect");
  if (!select) return;

  const communityMap = new Map();

  const addCommunity = (rawValue, rawLabel) => {
    const key = normalizeCommunity(rawValue);
    if (!key || key === "all") return;
    if (communityMap.has(key)) return;

    const label =
      String(rawLabel || "").trim() || toTitleCase(key.replace(/-/g, " "));
    communityMap.set(key, label);
  };

  listingIndex.forEach((item) => {
    addCommunity(
      item.communityNorm || item.communitySlug || "general",
      item.communityLabel,
    );
  });

  // Fallback: sidebar hub links exist even when there are no visible listing cards.
  document
    .querySelectorAll(".community-filter-link[data-community]")
    .forEach((link) => {
      addCommunity(link.dataset.community, link.dataset.community);
    });

  // Fallback: preserve a direct community query param as a selectable value.
  const queryCommunity = parseUrlState().community;
  if (queryCommunity && queryCommunity !== "all") {
    addCommunity(
      queryCommunity,
      toTitleCase(queryCommunity.replace(/-/g, " ")),
    );
  }

  const communities = Array.from(communityMap.entries()).sort((a, b) =>
    a[1].localeCompare(b[1]),
  );

  select.innerHTML = '<option value="all">All communities</option>';
  communities.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
}

function buildTagRail() {
  const rail = document.getElementById("mpTagRail");
  if (!rail) return;

  const frequencies = new Map();
  listingIndex.forEach((item) => {
    const seen = new Set();
    item.tags.forEach((tag) => {
      if (seen.has(tag)) return;
      seen.add(tag);
      frequencies.set(tag, (frequencies.get(tag) || 0) + 1);
    });
  });

  const popularTags = Array.from(frequencies.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 12);

  rail.innerHTML = "";

  if (!popularTags.length) {
    rail.hidden = true;
    return;
  }

  const intro = document.createElement("span");
  intro.className = "mp-tag-intro";
  intro.textContent = "Quick tags:";
  rail.appendChild(intro);

  popularTags.forEach(([tag, count]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mp-tag-chip";
    btn.dataset.tag = tag;
    btn.innerHTML = `<span>#${tag}</span><small>${count}</small>`;
    btn.setAttribute("aria-pressed", activeTags.has(tag) ? "true" : "false");
    rail.appendChild(btn);
  });

  rail.hidden = false;
}

function syncTagRailState() {
  document.querySelectorAll(".mp-tag-chip").forEach((button) => {
    const tag = normalizeToken(button.dataset.tag);
    const active = activeTags.has(tag);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function updateCategoryPillState() {
  document.querySelectorAll(".mp-pill").forEach((pill) => {
    const text = normalizeToken(pill.innerText);
    const active =
      currentCategory === "all"
        ? text.includes("all")
        : text.includes(normalizeToken(currentCategory));
    pill.classList.toggle("active", active);
  });
}

function passesPriceBand(price) {
  if (currentPriceBand === "all") return true;
  if (currentPriceBand === "free") return price <= 0;
  if (currentPriceBand === "under50") return price > 0 && price < 50;
  if (currentPriceBand === "50to200") return price >= 50 && price <= 200;
  if (currentPriceBand === "200plus") return price > 200;
  return true;
}

function calculateRelevanceScore(item, searchValue, tokens) {
  let score = 0;

  if (searchValue) {
    if (item.titleNorm.includes(searchValue)) score += 120;
    if (item.titleNorm.startsWith(searchValue)) score += 30;
  }

  tokens.forEach((token) => {
    if (item.titleNorm.includes(token)) score += 42;
    if (item.tags.includes(token)) score += 26;
    if (item.searchBlob.includes(token)) score += 12;
  });

  if (activeTags.size) {
    activeTags.forEach((tag) => {
      if (item.tags.includes(tag)) score += 34;
    });
  }

  if (
    currentCategory !== "all" &&
    item.categoryNorm === normalizeToken(currentCategory)
  ) {
    score += 8;
  }
  if (currentCommunity !== "all" && item.communityNorm === currentCommunity) {
    score += 8;
  }

  if (item.date > 0) {
    const now = Math.floor(Date.now() / 1000);
    const ageDays = Math.max(0, (now - item.date) / 86400);
    score += Math.max(0, 18 - Math.floor(ageDays / 14));
  }

  return score;
}

function updateResultsInfo(visibleCount, totalPages) {
  const info = document.getElementById("marketplaceResultsInfo");
  if (!info) return;

  const query = document.getElementById("adSearch")?.value?.trim() || "";
  const tagsText = activeTags.size
    ? Array.from(activeTags)
        .slice(0, 3)
        .map((tag) => `#${tag}`)
        .join(", ")
    : "none";

  info.textContent = `${visibleCount} listings found | Sort: ${getSortLabel(currentSort)} | Price: ${getPriceLabel(currentPriceBand)} | Tags: ${tagsText}${query ? ` | Query: \"${query}\"` : ""}${totalPages > 1 ? ` | Page ${currentPage} of ${totalPages}` : ""}`;
}

function updateMarketplaceSnapshot(visibleCount) {
  const searchValue = document.getElementById("adSearch")?.value?.trim() || "";
  const categoryLabel = getCategoryLabel(currentCategory);
  const communityLabel = getCommunityLabel(currentCommunity);
  const sortLabel = getSortLabel(currentSort);
  const priceLabel = getPriceLabel(currentPriceBand);
  const tagLabel = activeTags.size
    ? Array.from(activeTags)
        .slice(0, 3)
        .map((tag) => `#${tag}`)
        .join(", ")
    : "All";

  const liveBadge = document.getElementById("marketplaceLiveCategory");
  const liveCount = document.getElementById("marketplaceLiveCount");
  const liveCommunity = document.getElementById("marketplaceLiveCommunity");
  const liveSearch = document.getElementById("marketplaceLiveSearch");
  const liveCategoryText = document.getElementById(
    "marketplaceLiveCategoryText",
  );
  const liveCommunityText = document.getElementById(
    "marketplaceLiveCommunityText",
  );
  const liveSort = document.getElementById("marketplaceLiveSort");
  const livePrice = document.getElementById("marketplaceLivePrice");
  const liveTags = document.getElementById("marketplaceLiveTags");
  const heroCommunity = document.getElementById("marketplaceHeroCommunity");

  if (liveBadge) liveBadge.textContent = categoryLabel;
  if (liveCount) liveCount.textContent = String(visibleCount);
  if (liveCommunity) liveCommunity.textContent = communityLabel;
  if (liveSearch) {
    liveSearch.textContent = searchValue
      ? `Search term: ${searchValue}`
      : "Search term: none";
  }
  if (liveCategoryText) liveCategoryText.textContent = categoryLabel;
  if (liveCommunityText) liveCommunityText.textContent = communityLabel;
  if (liveSort) liveSort.textContent = sortLabel;
  if (livePrice) livePrice.textContent = priceLabel;
  if (liveTags) liveTags.textContent = tagLabel;
  if (heroCommunity) {
    heroCommunity.innerHTML = `<i class="fa-solid fa-location-dot"></i> Community: ${communityLabel}`;
  }
}

function initCommunityNavigation() {
  const marketplaceReturnUrl = resolveMarketplaceUrl(currentCommunity);
  const backLink = document.getElementById("communityBackLink");

  if (backLink) {
    backLink.hidden = true;
    backLink.removeAttribute("href");
  }

  document.querySelectorAll(".asymmetric-card").forEach((linkEl) => {
    try {
      const url = new URL(linkEl.getAttribute("href"), window.location.origin);
      url.searchParams.set("return", marketplaceReturnUrl);
      if (currentCommunity && currentCommunity !== "all") {
        url.searchParams.set("community", currentCommunity);
      } else {
        url.searchParams.delete("community");
      }
      linkEl.setAttribute("href", `${url.pathname}${url.search}${url.hash}`);
    } catch (_) {
      // Keep original link if URL parsing fails.
    }
  });

  if (!currentCommunity || currentCommunity === "all") return;

  const communityHomeUrl = resolveCommunityHomeUrl(currentCommunity);
  if (!communityHomeUrl) return;

  if (backLink) {
    backLink.href = communityHomeUrl;
    backLink.hidden = false;
  }
}

function initMarketplaceImageLightbox() {
  const listingGrid = document.getElementById("adList");
  if (!listingGrid || document.querySelector(".md-image-lightbox")) return;

  const lightbox = document.createElement("div");
  lightbox.className = "md-image-lightbox";
  lightbox.setAttribute("aria-hidden", "true");
  lightbox.innerHTML = `
    <div class="md-image-lightbox__backdrop" data-lightbox-close="true"></div>
    <div class="md-image-lightbox__content" role="dialog" aria-modal="true" aria-label="Image preview">
      <button type="button" class="md-image-lightbox__close" data-lightbox-close="true" aria-label="Close">&times;</button>
      <img class="md-image-lightbox__img" alt="" />
    </div>
  `;

  const imageEl = lightbox.querySelector(".md-image-lightbox__img");

  const closeLightbox = () => {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("md-lightbox-open");
  };

  const openLightbox = (src, alt) => {
    if (!imageEl || !src) return;
    imageEl.src = src;
    imageEl.alt = alt || "";
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("md-lightbox-open");
  };

  listingGrid.addEventListener("click", (event) => {
    const imageBox = event.target.closest("[data-enlarge-image='true']");
    if (!imageBox) return;

    const image = imageBox.querySelector(".ad-main-img");
    const imageSrc = image?.currentSrc || image?.src;
    if (!imageSrc || image?.style.display === "none") return;

    event.preventDefault();
    event.stopPropagation();
    openLightbox(imageSrc, image.alt);
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

  document.body.appendChild(lightbox);
}

/**
 * Main filter controller
 * @param {string} category - The category to display
 */
function updateFilter(category) {
  const grid = document.getElementById("adList");

  // 1. Add fade-out effect
  grid.style.opacity = "0";
  grid.style.transform = "translateY(10px)";

  setTimeout(() => {
    currentCategory = category;
    currentPage = 1;

    // 2. Update UI State for Pills
    updateCategoryPillState();
    const categoryInSelect = document.getElementById("mpSortSelect");
    if (categoryInSelect) categoryInSelect.value = currentSort;

    applyLogic();
    writeUrlState();

    // 3. Fade back in
    grid.style.transition = `all var(--transition-speed) ease`;
    grid.style.opacity = "1";
    grid.style.transform = "translateY(0)";
  }, 200);
}

/**
 * Handles the Visibility and Pagination of cards
 */
function applyLogic() {
  const searchRaw = document.getElementById("adSearch")?.value || "";
  const search = normalizeToken(searchRaw);
  const tokens = splitTokens(search);
  const categoryNorm = normalizeToken(currentCategory);
  const currentCommunitySlug = slugifyCommunity(currentCommunity);
  const selectedTags = Array.from(activeTags);

  const nowSec = Math.floor(Date.now() / 1000);
  const DAY_SEC = 86400;

  const filtered = listingIndex
    .filter((item) => {
      const categoryMatch =
        currentCategory === "all" || item.categoryNorm === categoryNorm;
      const communityMatch =
        currentCommunity === "all" ||
        item.communityNorm === currentCommunity ||
        item.communitySlug === currentCommunitySlug;
      const priceMatch = passesPriceBand(item.price);
      const tagMatch =
        !selectedTags.length ||
        selectedTags.some((tag) => item.tags.includes(normalizeToken(tag)));
      const searchMatch =
        !search ||
        item.searchBlob.includes(search) ||
        (tokens.length > 0 &&
          tokens.every((token) => item.searchBlob.includes(token)));

      // New filters from editorial pills
      const dateMatch =
        typeof currentDateFilter === "undefined" ||
        currentDateFilter === "all" ||
        (item.date > 0 && nowSec - item.date < DAY_SEC);

      const photosMatch =
        typeof currentPhotosOnly === "undefined" ||
        !currentPhotosOnly ||
        Boolean(item.card.querySelector(".mp-card-v2__media img"));

      const verifiedMatch =
        typeof currentVerifiedOnly === "undefined" ||
        !currentVerifiedOnly ||
        Boolean(item.card.querySelector(".mp-badge--verified"));

      return (
        categoryMatch &&
        communityMatch &&
        priceMatch &&
        tagMatch &&
        searchMatch &&
        dateMatch &&
        photosMatch &&
        verifiedMatch
      );
    })
    .map((item) => ({
      ...item,
      relevance: calculateRelevanceScore(item, search, tokens),
    }));

  filtered.sort((a, b) => {
    if (currentSort === "newest") {
      return (b.date || 0) - (a.date || 0);
    }
    if (currentSort === "price_low") {
      const aPrice = a.price || 0;
      const bPrice = b.price || 0;
      if (aPrice === bPrice) return (b.date || 0) - (a.date || 0);
      if (aPrice === 0) return 1;
      if (bPrice === 0) return -1;
      return aPrice - bPrice;
    }
    if (currentSort === "price_high") {
      const aPrice = a.price || 0;
      const bPrice = b.price || 0;
      if (aPrice === bPrice) return (b.date || 0) - (a.date || 0);
      if (aPrice === 0) return 1;
      if (bPrice === 0) return -1;
      return bPrice - aPrice;
    }
    if (currentSort === "title_az") {
      return a.titleNorm.localeCompare(b.titleNorm);
    }

    const hasDiscoverySignal = Boolean(search) || selectedTags.length > 0;
    if (!hasDiscoverySignal) {
      return (b.date || 0) - (a.date || 0);
    }

    if (b.relevance !== a.relevance) {
      return b.relevance - a.relevance;
    }
    return (b.date || 0) - (a.date || 0);
  });

  listingIndex.forEach((item) => {
    item.card.style.display = "none";
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / adsPerPage));
  currentPage = Math.min(currentPage, totalPages);

  const start = (currentPage - 1) * adsPerPage;
  const end = start + adsPerPage;
  const pageItems = filtered.slice(start, end);

  pageItems.forEach((item) => {
    item.card.style.display = "block";
  });

  const noResults = document.getElementById("marketplaceNoResults");
  if (noResults) {
    noResults.hidden = filtered.length > 0;
  }

  const pageInfoEl = document.getElementById("pageInfo");
  if (pageInfoEl) pageInfoEl.innerText = `${currentPage} / ${totalPages}`;

  updateMarketplaceSnapshot(filtered.length);
  updateResultsInfo(filtered.length, totalPages);
  syncTagRailState();

  const prevBtnEl = document.getElementById("prevBtn");
  if (prevBtnEl) prevBtnEl.disabled = currentPage === 1;
  const nextBtnEl = document.getElementById("nextBtn");
  if (nextBtnEl) {
    nextBtnEl.disabled = currentPage === totalPages || filtered.length === 0;
  }
}

/**
 * Pagination Navigation
 * @param {number} step - 1 for next, -1 for previous
 */
function changePage(step) {
  const grid = document.getElementById("adList");
  grid.style.opacity = "0";

  setTimeout(() => {
    currentPage += step;
    applyLogic();
    writeUrlState();
    grid.style.opacity = "1";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, 200);
}

// Global search listener
function applyFilter() {
  currentPage = 1;
  applyLogic();
  writeUrlState();
}

function syncControlsWithState() {
  const communitySelect = document.getElementById("mpCommunitySelect");
  const sortSelect = document.getElementById("mpSortSelect");
  const priceSelect = document.getElementById("mpPriceBand");
  const searchInput = document.getElementById("adSearch");

  if (communitySelect) {
    currentCommunity = resolveCommunitySelectValue(
      currentCommunity,
      communitySelect,
    );
    communitySelect.value = currentCommunity;
  }
  if (sortSelect) sortSelect.value = currentSort;
  if (priceSelect) priceSelect.value = currentPriceBand;
  if (searchInput) {
    const parsed = parseUrlState();
    if (parsed.q && !searchInput.value) searchInput.value = parsed.q;
  }

  updateCategoryPillState();
  syncTagRailState();
}

function bindDiscoveryControls() {
  const communitySelect = document.getElementById("mpCommunitySelect");
  const sortSelect = document.getElementById("mpSortSelect");
  const priceSelect = document.getElementById("mpPriceBand");
  const clearBtn = document.getElementById("mpClearFilters");
  const tagRail = document.getElementById("mpTagRail");

  if (communitySelect) {
    communitySelect.addEventListener("change", () => {
      currentCommunity = normalizeCommunity(communitySelect.value) || "all";
      currentPage = 1;
      initCommunityNavigation();
      applyLogic();
      writeUrlState();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      currentSort = sortSelect.value || "relevance";
      currentPage = 1;
      applyLogic();
      writeUrlState();
    });
  }

  if (priceSelect) {
    priceSelect.addEventListener("change", () => {
      currentPriceBand = priceSelect.value || "all";
      currentPage = 1;
      applyLogic();
      writeUrlState();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      currentCategory = "all";
      currentCommunity = "all";
      currentSort = "relevance";
      currentPriceBand = "all";
      currentPage = 1;
      activeTags.clear();

      const searchInput = document.getElementById("adSearch");
      if (searchInput) searchInput.value = "";

      initCommunityNavigation();
      syncControlsWithState();
      applyLogic();
      writeUrlState();
    });
  }

  if (tagRail) {
    tagRail.addEventListener("click", (event) => {
      const button = event.target.closest(".mp-tag-chip");
      if (!button) return;

      const tag = normalizeToken(button.dataset.tag);
      if (!tag) return;

      if (activeTags.has(tag)) {
        activeTags.delete(tag);
      } else {
        activeTags.add(tag);
      }

      currentPage = 1;
      applyLogic();
      writeUrlState();
    });
  }
}

// Initial Render
document.addEventListener("DOMContentLoaded", () => {
  const parsedState = parseUrlState();

  currentCategory = parsedState.category || "all";
  currentCommunity =
    parsedState.community || resolveCommunityFilterFromUrl() || "all";
  currentSort = SORT_LABELS[parsedState.sort] ? parsedState.sort : "relevance";

  let currentDateFilter = "all";
  let currentPhotosOnly = false;
  let currentVerifiedOnly = false;

  currentPriceBand = PRICE_LABELS[parsedState.price]
    ? parsedState.price
    : "all";
  currentPage = parsedState.page || 1;
  parsedState.tags.forEach((tag) => activeTags.add(tag));

  const searchInput = document.getElementById("adSearch");
  if (searchInput && parsedState.q) {
    searchInput.value = parsedState.q;
  }

  buildListingIndex();
  populateCommunityOptions();
  buildTagRail();
  bindDiscoveryControls();
  syncControlsWithState();
  initCommunityNavigation();
  initMarketplaceImageLightbox();
  applyLogic();
  writeUrlState();

  // ── New: bind filter pills + category links ────────────────
  // The new editorial markup uses .mp-pill-v2 with data-filter
  // and .mp-category-link with data-category. Route them to
  // existing state + applyLogic().

  const FILTER_TO_PRICE_BAND = {
    under50: "under50",
    free: "free",
  };

  // Show Local Banner if filtered
  if (currentCommunity && currentCommunity !== "all") {
    const banner = document.getElementById("localMarketplaceBanner");
    const bannerName = document.getElementById("bannerCommunityName");
    if (banner && bannerName) {
      // Capitalize first letter of each word
      const formattedName = currentCommunity
        .replace(/-/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      bannerName.textContent = formattedName;
      banner.style.display = "flex";
    }
  }

  // "new today" = listing date within 24h

  document.addEventListener("click", (e) => {
    // ── Filter pills ─────────────────────────────────────────
    const pill = e.target.closest(".mp-pill-v2");
    if (pill) {
      e.preventDefault();
      const filter = String(pill.dataset.filter || "all");

      // Sort pill cycles through sort options
      if (filter === "sort") {
        const sorts = [
          { key: "relevance", label: "Smart relevance" },
          { key: "newest", label: "Newest first" },
          { key: "price_low", label: "Price: Low → High" },
          { key: "price_high", label: "Price: High → Low" },
          { key: "title_az", label: "Title: A → Z" },
        ];
        const idx = sorts.findIndex((s) => s.key === currentSort);
        const next = sorts[(idx + 1) % sorts.length];
        currentSort = next.key;
        pill.textContent = `Sort: ${next.label} ▾`;
        currentPage = 1;
        applyLogic();
        writeUrlState();
        return;
      }

      // Reset all toggle-style filters first
      currentDateFilter = "all";
      currentPhotosOnly = false;
      currentVerifiedOnly = false;
      currentPriceBand = "all";
      currentCategory = "all";

      // Apply the clicked filter
      switch (filter) {
        case "all":
          // already reset
          break;
        case "new":
          currentDateFilter = "new";
          break;
        case "under50":
          currentPriceBand = "under50";
          break;
        case "free":
          currentPriceBand = "free";
          break;
        case "photos":
          currentPhotosOnly = true;
          break;
        case "verified":
          currentVerifiedOnly = true;
          break;
        default:
          currentCategory = filter;
      }

      // Visual state
      document.querySelectorAll(".mp-pill-v2").forEach((p) => {
        p.classList.toggle("active", p === pill);
      });
      document.querySelectorAll(".mp-category-link").forEach((c) => {
        c.classList.remove("active");
      });

      currentPage = 1;
      applyLogic();
      writeUrlState();
      return;
    }

    // ── Category links ───────────────────────────────────────
    const cat = e.target.closest(".mp-category-link");
    if (cat) {
      e.preventDefault();
      const category = String(cat.dataset.category || "all");

      // Reset toggle-style filters
      currentDateFilter = "all";
      currentPhotosOnly = false;
      currentVerifiedOnly = false;
      currentPriceBand = "all";
      currentCategory = category === "all" ? "all" : category;

      document.querySelectorAll(".mp-category-link").forEach((c) => {
        c.classList.toggle("active", c === cat);
      });
      document.querySelectorAll(".mp-pill-v2").forEach((p) => {
        p.classList.remove("active");
      });
      const allPill = document.querySelector('.mp-pill-v2[data-filter="all"]');
      if (allPill) allPill.classList.add("active");

      currentPage = 1;
      applyLogic();
      writeUrlState();
      return;
    }
  });

  // Auto-hide skeletons after images load
  document.querySelectorAll(".ad-main-img").forEach((img) => {
    if (img.complete) {
      img.style.opacity = "1";
      const imageBox = img.closest(".ad-image-box");
      const skeleton = imageBox?.querySelector(".skeleton");
      const placeholder = imageBox?.querySelector(".no-image-placeholder");

      imageBox?.classList.add("has-image");

      if (skeleton) {
        skeleton.style.display = "none";
      }

      if (placeholder) {
        placeholder.style.display = "none";
      }
    }
  });
});
