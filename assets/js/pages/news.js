(function initDailyNewsPage() {
  "use strict";

  var widget = document.getElementById("dailyNewsWidget");
  if (!widget) return;

  var countrySelect = document.getElementById("newsCountrySelect");
  var topicPillsWrap = document.getElementById("newsTopicPills");
  var searchInput = document.getElementById("newsSearchInput");
  var searchButton = document.getElementById("newsSearchBtn");
  var clearButton = document.getElementById("newsClearBtn");
  var statusBar = document.getElementById("newsStatusBar");
  var grid = document.getElementById("newsGrid");
  var loadMoreButton = document.getElementById("newsLoadMore");

  if (
    !countrySelect ||
    !topicPillsWrap ||
    !searchInput ||
    !searchButton ||
    !clearButton ||
    !statusBar ||
    !grid ||
    !loadMoreButton
  ) {
    return;
  }

  var state = {
    country: countrySelect.value || "us",
    topic: "",
    q: "",
    page: 1,
    pageSize: 9,
    isLoading: false,
    hasMore: true,
    latestRequestId: 0,
  };

  var endpoint =
    window.ResiHubApi &&
    window.ResiHubApi.ENDPOINTS &&
    window.ResiHubApi.ENDPOINTS.newsLatest
      ? window.ResiHubApi.ENDPOINTS.newsLatest
      : "https://hub-community-apis.dekumar-ca.workers.dev/api/news/latest";

  function setStatus(message) {
    statusBar.textContent = message || "";
  }

  function formatAge(isoValue) {
    if (!isoValue) return "just now";

    var timestamp = Date.parse(isoValue);
    if (Number.isNaN(timestamp)) return "just now";

    var elapsedMs = Date.now() - timestamp;
    if (elapsedMs < 0) return "just now";

    var minutes = Math.floor(elapsedMs / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return minutes + "m ago";

    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "h ago";

    var days = Math.floor(hours / 24);
    if (days < 7) return days + "d ago";

    var weeks = Math.floor(days / 7);
    if (weeks < 5) return weeks + "w ago";

    var months = Math.floor(days / 30);
    if (months < 12) return months + "mo ago";

    var years = Math.floor(days / 365);
    return years + "y ago";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toggleLoadMore() {
    loadMoreButton.hidden = !state.hasMore;
    loadMoreButton.disabled = state.isLoading || !state.hasMore;
  }

  function renderSkeleton(count) {
    var cards = [];
    for (var i = 0; i < count; i += 1) {
      cards.push(
        '<article class="news-card news-card--skeleton" aria-hidden="true">' +
          '<div class="skeleton-img"></div>' +
          '<div class="news-card__body">' +
          '<div class="skeleton-line skeleton-line--short"></div>' +
          '<div class="skeleton-line skeleton-line--full"></div>' +
          '<div class="skeleton-line skeleton-line--mid"></div>' +
          "</div>" +
          "</article>",
      );
    }
    grid.innerHTML = cards.join("");
  }

  function renderEmpty(message, allowRetry) {
    var retry = allowRetry
      ? '<button class="news-empty-state__retry" id="newsRetryBtn" type="button">Try again</button>'
      : "";

    grid.innerHTML =
      '<div class="news-empty-state">' +
      '<div class="news-empty-state__icon"><i class="fa-regular fa-newspaper"></i></div>' +
      '<div class="news-empty-state__msg">' +
      escapeHtml(message) +
      "</div>" +
      retry +
      "</div>";

    if (allowRetry) {
      var retryButton = document.getElementById("newsRetryBtn");
      if (retryButton) {
        retryButton.addEventListener("click", function onRetry() {
          state.page = 1;
          fetchNews(true);
        });
      }
    }
  }

  function createArticleCard(article) {
    var imageHtml = article.image
      ? '<img class="news-card__img" src="' +
        escapeHtml(article.image) +
        '" alt="News image" loading="lazy" referrerpolicy="no-referrer">'
      : '<div class="news-card__img-placeholder"><i class="fa-regular fa-image"></i></div>';

    var source = article.source ? escapeHtml(article.source) : "News Desk";
    var age = formatAge(article.publishedAt);
    var title = escapeHtml(article.title || "Untitled headline");
    var description = escapeHtml(
      article.description || "No summary available.",
    );
    var safeUrl = escapeHtml(article.url || "#");

    return (
      '<article class="news-card">' +
      '<div class="news-card__img-wrap">' +
      imageHtml +
      "</div>" +
      '<div class="news-card__body">' +
      '<div class="news-card__meta">' +
      '<span class="news-card__source">' +
      source +
      "</span>" +
      '<span class="news-card__dot">•</span>' +
      '<span class="news-card__age">' +
      age +
      "</span>" +
      "</div>" +
      '<h4 class="news-card__title">' +
      title +
      "</h4>" +
      '<p class="news-card__desc">' +
      description +
      "</p>" +
      '<a class="news-card__link" href="' +
      safeUrl +
      '" target="_blank" rel="noopener noreferrer">Read article <span class="news-card__link-arrow">→</span></a>' +
      "</div>" +
      "</article>"
    );
  }

  function renderArticles(articles, appendMode) {
    if (!Array.isArray(articles) || articles.length === 0) {
      if (!appendMode) {
        renderEmpty("No stories found for the selected filters.", false);
      }
      return;
    }

    var markup = articles.map(createArticleCard).join("");
    if (appendMode) {
      grid.insertAdjacentHTML("beforeend", markup);
    } else {
      grid.innerHTML = markup;
    }
  }

  function buildQuery() {
    var params = new URLSearchParams();
    params.set("country", state.country);
    params.set("page", String(state.page));
    params.set("pageSize", String(state.pageSize));

    if (state.topic) params.set("topic", state.topic);
    if (state.q) params.set("q", state.q);

    return params;
  }

  async function fetchNews(reset) {
    if (state.isLoading) return;

    state.isLoading = true;
    var requestId = Date.now();
    state.latestRequestId = requestId;
    toggleLoadMore();

    if (reset) {
      renderSkeleton(6);
    } else {
      loadMoreButton.textContent = "Loading...";
    }

    setStatus("Fetching latest headlines...");

    try {
      var params = buildQuery();
      var response = await fetch(endpoint + "?" + params.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      var payload = await response.json();

      if (requestId !== state.latestRequestId) {
        return;
      }

      if (!response.ok || !payload || payload.success !== true) {
        throw new Error(
          (payload && (payload.error || payload.message)) ||
            "Failed to load latest news.",
        );
      }

      var articles = Array.isArray(payload.articles) ? payload.articles : [];
      var totalResults = Number(payload.totalResults || 0);

      if (reset) {
        renderArticles(articles, false);
      } else {
        renderArticles(articles, true);
      }

      var viewedCount = (state.page - 1) * state.pageSize + articles.length;
      state.hasMore = viewedCount < totalResults && articles.length > 0;

      if (articles.length === 0 && reset) {
        setStatus("No stories matched this filter set.");
      } else {
        setStatus(
          "Showing " +
            String(Math.min(viewedCount, totalResults || viewedCount)) +
            " latest stories",
        );
      }
    } catch (error) {
      if (requestId !== state.latestRequestId) return;
      state.hasMore = false;
      renderEmpty(
        error && error.message
          ? error.message
          : "Unable to load news right now.",
        true,
      );
      setStatus("News service is temporarily unavailable.");
    } finally {
      if (requestId === state.latestRequestId) {
        state.isLoading = false;
        loadMoreButton.textContent = "Load more";
        toggleLoadMore();
      }
    }
  }

  function updateActiveTopicButton(nextTopic) {
    var buttons = topicPillsWrap.querySelectorAll(".news-topic-pill");
    buttons.forEach(function applyState(button) {
      var value = String(button.getAttribute("data-topic") || "");
      if (value === nextTopic) {
        button.classList.add("active");
        button.setAttribute("aria-pressed", "true");
      } else {
        button.classList.remove("active");
        button.setAttribute("aria-pressed", "false");
      }
    });
  }

  function applyFiltersAndReload() {
    state.page = 1;
    state.country = countrySelect.value || "us";
    state.q = String(searchInput.value || "").trim();
    fetchNews(true);
  }

  countrySelect.addEventListener("change", function onCountryChanged() {
    applyFiltersAndReload();
  });

  topicPillsWrap.addEventListener("click", function onTopicClick(event) {
    var button = event.target.closest(".news-topic-pill");
    if (!button) return;

    var topic = String(button.getAttribute("data-topic") || "").trim();
    state.topic = topic;
    updateActiveTopicButton(topic);
    applyFiltersAndReload();
  });

  searchButton.addEventListener("click", function onSearchClick() {
    applyFiltersAndReload();
  });

  searchInput.addEventListener("keydown", function onSearchKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      applyFiltersAndReload();
    }
  });

  clearButton.addEventListener("click", function onClearFilters() {
    searchInput.value = "";
    state.topic = "";
    updateActiveTopicButton("");
    applyFiltersAndReload();
  });

  loadMoreButton.addEventListener("click", function onLoadMore() {
    if (state.isLoading || !state.hasMore) return;
    state.page += 1;
    fetchNews(false);
  });

  updateActiveTopicButton(state.topic);
  fetchNews(true);
})();
