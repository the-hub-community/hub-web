(function () {
  "use strict";

  const STORAGE_KEY = "hubcollective-community-posts-v1";
  const seedEl = document.getElementById("civicSeedData");
  const feedPageTitle = document.title;
  const replyCountRequests = new Set();
  let replyCountObserver = null;
  let seed = { hubs: [], posts: [] };
  try { seed = JSON.parse(seedEl?.textContent || '{"hubs":[],"posts":[]}'); } catch (_) {}
  const seedPostById = new Map();
  (seed.posts || []).forEach((post) => {
    if (post.id) seedPostById.set(String(post.id), post);
    if (post.pageKey) seedPostById.set(String(post.pageKey), post);
  });

  let posts = [];
  let communitySyncPromise = Promise.resolve();
  let hubs = (seed.hubs || []).map((hub) => ({
    ...hub,
    name: decodeText(hub.name),
    purpose: decodeText(hub.purpose),
  }));
  let activeHub = "all";
  let activeType = "all";
  let activeSort = "engagement";
  let searchText = "";
  let siteSearchIndexPromise = null;
  let siteSearchRequestId = 0;
  let savedOnly = new URLSearchParams(location.search).get("saved") === "1";
  let selectedPostType = "broadcast";
  let publishedPostId = null;

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(saved)) posts = saved;
    } catch (error) {
      console.error("Could not load saved community posts.", error);
      showPersistenceWarning(error, false);
    }
    if (!posts.length) posts = (seed.posts || []).map(normalizeSeedPost);
    posts = posts
      .map((post) => normalizeSeedPost(post))
      .filter(isPostWithinVisibilityWindow);
  }

  const BROADCAST_VISIBILITY_MS = 5 * 24 * 60 * 60 * 1000;
  const NOTICE_VISIBILITY_MS = 48 * 60 * 60 * 1000;

  function isPostWithinVisibilityWindow(post) {
    if (!post || !["broadcast", "notification"].includes(post.type)) return true;
    const createdAt = new Date(post.createdAt).getTime();
    if (!Number.isFinite(createdAt)) return false;
    const expiresAt = post.expiresAt
      ? new Date(post.expiresAt).getTime()
      : createdAt + (
          post.type === "notification"
            ? NOTICE_VISIBILITY_MS
            : BROADCAST_VISIBILITY_MS
        );
    return Number.isFinite(expiresAt) && expiresAt > Date.now();
  }

  function normalizeSeedPost(post) {
    const source = decodeText(post.source);
    const imageFromSource = source.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
    const rawStatus = String(post.status || "").toLowerCase();
    const pageKey = decodeText(post.pageKey || post.page_key || post.id);
    const seedPost = seedPostById.get(String(post.id)) || seedPostById.get(pageKey);
    const communityKey = decodeText(post.communityKey || post.community_key || post.hubId || "");
    const replies = Array.isArray(post.replies) ? post.replies : [];
    const suppliedReplyCount = post.replyCount ?? post.reply_count;
    const parsedReplyCount = Number(suppliedReplyCount);
    const hasSuppliedReplyCount = Number.isSafeInteger(parsedReplyCount) &&
      suppliedReplyCount !== null && suppliedReplyCount !== "";
    const hasExternalComments = Boolean(
      pageKey &&
      communityKey &&
      (post.pageUrl || seedPost?.pageUrl),
    );
    return {
      ...post,
      title: decodeText(post.title),
      summary: readableText(post.summary).replace(/\s+/g, " ").trim(),
      details: readableText(post.details),
      hub: decodeText(post.hub),
      pageKey,
      pageUrl: decodeText(post.pageUrl || seedPost?.pageUrl || ""),
      communityKey,
      author: decodeText(post.author),
      source,
      image: decodeText(post.image || imageFromSource || ""),
      priority: String(post.priority || "").toLowerCase() === "high" ||
        String(post.priority || "").toLowerCase() === "critical" ? "Urgent" : post.priority,
      status: post.type === "listing"
        ? ["sold", "claimed"].includes(rawStatus) ? "Claimed"
          : ["pending", "reserved"].includes(rawStatus) ? "Pending" : "Available"
        : post.status || "Active",
      upvotes: Number(post.upvotes) || 0,
      replies,
      replyCount: hasExternalComments
        ? null
        : hasSuppliedReplyCount
          ? Math.max(0, parsedReplyCount, replies.length)
          : replies.length,
      saved: Boolean(post.saved),
      voted: Boolean(post.voted),
      facts: Object.fromEntries(Object.entries(post.facts || {}).map(([label, value]) => [decodeText(label), decodeText(value)])),
    };
  }

  function decodeText(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = String(value ?? "");
    return textarea.value;
  }

  function readableText(value) {
    let text = String(value ?? "");
    const blockTags = new Set([
      "ADDRESS", "ARTICLE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT",
      "H1", "H2", "H3", "H4", "H5", "H6", "LI", "OL", "P", "SECTION",
      "TABLE", "TR", "UL",
    ]);
    const extractText = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      if (["IFRAME", "OBJECT", "SCRIPT", "STYLE", "SVG"].includes(node.tagName)) return "";
      if (node.tagName === "BR") return "\n";
      const content = Array.from(node.childNodes, extractText).join("");
      return blockTags.has(node.tagName) ? `\n${content}\n` : content;
    };

    for (let pass = 0; pass < 3; pass += 1) {
      const body = new DOMParser().parseFromString(text, "text/html").body;
      const extracted = extractText(body)
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      if (extracted === text) break;
      text = extracted;
    }
    return text;
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
      return true;
    } catch (error) {
      console.error("Could not save community posts on this device.", error);
      showPersistenceWarning(error, false);
      return false;
    }
  }

  async function postAction(post, action, extra) {
    persist();
    await communitySyncPromise;
    const endpoint = window.ResiHubApi?.ENDPOINTS?.communityPosts;
    if (!endpoint) return;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ action, id: post.id, actor_id: getActorId(), ...extra }),
      });
      const payload = await response.json();
      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.error || `Community post update failed (${response.status}).`);
      }
      if (payload.post) {
        const updatedPost = normalizeSeedPost(payload.post);
        posts = posts.map((item) => item.id === updatedPost.id ? updatedPost : item);
        persist();
        render();
      }
    } catch (error) {
      showPersistenceWarning(error);
    }
  }

  function getActorId() {
    const key = "hubcollective:anonymous-actor:v1";
    let id = localStorage.getItem(key);
    if (!/^[a-f0-9]{32}$/i.test(id || "")) {
      const bytes = new Uint8Array(16);
      if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
      else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
      id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(key, id);
    }
    return id;
  }

  function showPersistenceWarning(error, deviceSaved = true) {
    const confirmation = document.getElementById("publishConfirmation");
    if (!confirmation) return;
    confirmation.hidden = false;
    confirmation.querySelector("span").textContent = deviceSaved
      ? `Saved on this device. Server sync failed: ${error.message}`
      : `Could not access saved posts on this device: ${error.message}`;
    confirmation.dataset.syncFailed = "true";
  }

  async function syncCommunityPosts() {
    const endpoint = window.ResiHubApi?.ENDPOINTS?.communityPosts;
    if (!endpoint) return;
    try {
      const response = await fetch(`${endpoint}?actor_id=${encodeURIComponent(getActorId())}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Community feed sync failed (${response.status}).`);
      const payload = await response.json();
      if (!Array.isArray(payload.posts)) return;
      const byId = new Map(payload.posts.map((post) => [post.id, normalizeSeedPost(post)]));
      posts = posts.map((post) => byId.get(post.id) || post);
      payload.posts.forEach((post) => {
        if (!posts.some((item) => item.id === post.id)) posts.unshift(normalizeSeedPost(post));
      });
      const storedIds = new Set(payload.posts.map((post) => post.id));
      const missingPosts = posts.filter((post) => !storedIds.has(post.id));
      if (missingPosts.length) {
        for (let index = 0; index < missingPosts.length; index += 25) {
          const migration = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ action: "seed", posts: missingPosts.slice(index, index + 25) }),
          });
          if (!migration.ok) throw new Error(`Community archive sync failed (${migration.status}).`);
        }
      }
      persist();
      render();
      openLinkedPost();
    } catch (error) {
      showPersistenceWarning(error);
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    })[char]);
  }

  function formattedDetails(value, title) {
    const text = readableText(value);
    const formatter = window.ResiHubContentFormatter;
    if (!formatter) return escapeHtml(text).replace(/\n/g, "<br>");

    let html = formatter.markdownToHtml(text);
    if (!/^\s*```/.test(text)) {
      const codeBlock = new DOMParser().parseFromString(html, "text/html")
        .body.querySelector("pre code");
      if (
        codeBlock &&
        codeBlock.textContent.trim().length > text.trim().length * 0.5
      ) {
        // Rendered wiki indentation can make most prose look like a code block.
        const unindented = text.replace(/^[\t ]+/gm, "");
        if (unindented !== text) {
          const normalizedHtml = formatter.markdownToHtml(unindented);
          const normalized = new DOMParser().parseFromString(normalizedHtml, "text/html");
          if (!normalized.body.querySelector("pre code")) html = normalizedHtml;
        }
      }
    }

    const rendered = new DOMParser().parseFromString(html, "text/html");
    const firstBlock = rendered.body.firstElementChild;
    const normalizedTitle = String(title || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase();
    const firstBlockText = firstBlock?.textContent
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase();
    if (
      normalizedTitle &&
      firstBlock &&
      /^(H[1-6]|P)$/.test(firstBlock.tagName) &&
      firstBlockText === normalizedTitle
    ) {
      firstBlock.remove();
    }
    return rendered.body.innerHTML;
  }

  function relativeTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "Recently";
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function exactTime(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      : "Recently";
  }

  function score(post) {
    return post.upvotes * 2 + (post.replyCount ?? post.replies.length) * 3 + (post.saved ? 2 : 0);
  }

  function filteredPosts() {
    let list = posts.filter((post) => (activeHub === "all" || post.hubId === activeHub) && (!savedOnly || post.saved));
    if (activeType !== "all") list = list.filter((post) => post.type === activeType);
    const query = searchText.toLowerCase();
    if (query) {
      list = list.filter((post) => [
        post.title, post.summary, post.details, post.author, post.hub,
        post.pickupArea, post.tags?.join(" "), post.listingType,
      ].join(" ").toLowerCase().includes(query));
    }
    list.sort((a, b) => {
      if (activeSort === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
      if (activeSort === "discussed") {
        return (b.replyCount ?? b.replies.length) - (a.replyCount ?? a.replies.length) || score(b) - score(a) ||
          new Date(b.createdAt) - new Date(a.createdAt);
      }
      return score(b) - score(a) || new Date(b.createdAt) - new Date(a.createdAt);
    });
    return list;
  }

  function loadSiteSearchIndex() {
    if (!siteSearchIndexPromise) {
      const baseUrl = document.body?.dataset.baseurl || "";
      siteSearchIndexPromise = fetch(`${baseUrl}/search-index.json`, {
        headers: { Accept: "application/json" },
      }).then((response) => {
        if (!response.ok) throw new Error(`Search index request failed (${response.status}).`);
        return response.json();
      }).then((entries) => {
        if (!Array.isArray(entries)) throw new Error("Search index response must be an array.");
        return entries;
      }).catch((error) => {
        siteSearchIndexPromise = null;
        throw error;
      });
    }
    return siteSearchIndexPromise;
  }

  function closeSiteSearchResults() {
    const input = document.getElementById("feedSearch");
    const results = document.getElementById("siteSearchResults");
    results.hidden = true;
    input.setAttribute("aria-expanded", "false");
  }

  async function updateSiteSearchResults(query) {
    const input = document.getElementById("feedSearch");
    const results = document.getElementById("siteSearchResults");
    const requestId = ++siteSearchRequestId;
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) {
      closeSiteSearchResults();
      results.replaceChildren();
      return;
    }

    input.setAttribute("aria-expanded", "true");
    results.hidden = false;
    results.classList.add("is-message");
    results.textContent = "Searching all community content…";
    try {
      const entries = await loadSiteSearchIndex();
      if (requestId !== siteSearchRequestId) return;
      const matches = entries.map((entry) => {
        const title = String(entry.title || "");
        const text = String(entry.text || "").replace(/\s+/g, " ").trim();
        const url = String(entry.url || "");
        const searchable = `${title} ${text} ${url}`.toLowerCase();
        if (!terms.every((term) => searchable.includes(term))) return null;
        const normalizedTitle = title.toLowerCase();
        const score = terms.reduce((total, term) =>
          total + (normalizedTitle.includes(term) ? 10 : 0) + (url.toLowerCase().includes(term) ? 5 : 0), 0);
        return { title, text, url, type: entry.type, score };
      }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 7);

      results.replaceChildren();
      if (!matches.length) {
        results.classList.add("is-message");
        results.textContent = "No community content matches this search.";
        return;
      }

      results.classList.remove("is-message");
      matches.forEach((match) => {
        const link = document.createElement("a");
        link.className = "civic-search-result";
        link.href = match.url;
        const title = document.createElement("strong");
        title.textContent = match.title || match.url;
        const type = document.createElement("span");
        type.className = "civic-search-result__type";
        type.textContent = match.type === "listings" ? "Marketplace listing" : "Community page";
        const excerpt = document.createElement("span");
        excerpt.className = "civic-search-result__excerpt";
        excerpt.textContent = match.text.slice(0, 150);
        link.append(type, title, excerpt);
        results.append(link);
      });
    } catch (error) {
      if (requestId !== siteSearchRequestId) return;
      console.error("Could not search community content.", error);
      results.classList.add("is-message");
      results.textContent = "Site search unavailable. Try again shortly.";
    }
  }

  function renderHubs() {
    const rail = document.querySelector("[data-civic-hub-rail]");
    const mobile = document.getElementById("mobileHubSwitcher");
    const hubHtml = [
      { id: "all", name: "All Community Hubs", count: posts.length },
      ...hubs.map((hub) => ({
        id: hub.id,
        name: hub.name,
        count: posts.filter((post) => post.hubId === hub.id).length,
      })),
    ];

    if (rail) {
      rail.innerHTML = `
        <div class="civic-rail-label">Civic Stream</div>
        ${hubHtml.slice(0, 1).map((hub) => hubButton(hub)).join("")}
        <div class="civic-rail-label">Neighborhood Hubs</div>
        ${hubHtml.slice(1).filter((hub) => !["Photography", "Rockies", "Stock"].some((v) => hub.name.includes(v))).map((hub) => hubButton(hub)).join("")}
        <div class="civic-rail-label">Interest Groups</div>
        ${hubHtml.slice(1).filter((hub) => ["Photography", "Rockies", "Stock"].some((v) => hub.name.includes(v))).map((hub) => hubButton(hub)).join("")}
      `;
    }
    if (mobile) {
      mobile.innerHTML = `
        <label class="sr-only" for="mobileHubSelect">Community hub</label>
        <select id="mobileHubSelect" aria-label="Community hub">
          ${hubHtml.map((hub) => `<option value="${escapeHtml(hub.id)}" ${activeHub === hub.id ? "selected" : ""}>${escapeHtml(hub.name)} (${hub.count} ${hub.count === 1 ? "page" : "pages"})</option>`).join("")}
        </select>
      `;
    }
    document.querySelectorAll(".civic-top-nav a").forEach((link) => {
      const isSaved = new URL(link.href).searchParams.get("saved") === "1";
      if (link.textContent.trim() === "Saved") link.classList.toggle("is-active", savedOnly && isSaved);
      else if (link.textContent.trim() === "Stream") link.classList.toggle("is-active", !savedOnly);
    });
  }

  function hubButton(hub) {
    return `<button type="button" class="civic-hub-link ${activeHub === hub.id ? "is-active" : ""}" data-hub="${escapeHtml(hub.id)}"><span>${escapeHtml(hub.name)}</span><strong>${hub.count}</strong></button>`;
  }

  function imageHtml(post, type) {
    if (!post.image) return "";
    const className = type === "listing" ? "civic-card__media civic-card__media--listing" : "civic-card__media";
    return `<button type="button" class="${className}" data-open-post="${escapeHtml(post.id)}" aria-label="Open ${escapeHtml(post.title)}">
      <img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" referrerpolicy="no-referrer" data-fallback="true">
    </button>`;
  }

  function metadata(post) {
    const typeLabel = {
      broadcast: post.priority === "Urgent" ? "Urgent Broadcast" : "Broadcast",
      listing: "Listing",
      evergreen: "Evergreen Info",
      update: "Community Update",
    }[post.type];
    return `<span>${escapeHtml(typeLabel)} · ${escapeHtml(post.hub)} · ${relativeTime(post.createdAt)} · Score ${score(post)}</span>`;
  }

  function card(post) {
    let extra = "";
    if (post.type === "broadcast" && post.effectiveWindow) {
      extra = `<div class="civic-effective-window"><strong>Effective window</strong> ${escapeHtml(post.effectiveWindow)}</div>`;
    }
    if (post.type === "listing") {
      extra = `<div class="civic-listing-row"><strong>${escapeHtml(post.price || "Contact for price")}</strong><span>${escapeHtml(post.listingType || "For Sale")} · ${escapeHtml(post.pickupArea || "Nearby")}</span><em>${escapeHtml(post.status || "Available")}</em></div>`;
    }
    if (post.type === "evergreen") {
      const facts = post.facts || {};
      const entries = Object.entries(facts).slice(0, 4);
      extra = entries.length ? `<dl class="civic-key-facts">${entries.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>` :
        `<div class="civic-verified">Verified ${exactTime(post.lastVerifiedAt || post.createdAt)}</div>`;
    }
    const listingMedia = post.type === "listing" ? imageHtml(post, "listing") : "";
    const regularMedia = post.type !== "listing" ? imageHtml(post, "") : "";
    const replyLabel = post.replyCount === 1 ? "Reply" : "Replies";
    const replyCount = post.replyCount === null
      ? ""
      : `<span class="civic-card__reply-count">${post.replyCount}</span>`;
    return `<article class="civic-card civic-card--${escapeHtml(post.type)}">
      ${listingMedia}
      <div class="civic-card__body">
        <div class="civic-card__meta">${post.type === "broadcast" && post.priority === "Urgent" ? '<span class="civic-urgent"><i class="fa-solid fa-triangle-exclamation"></i></span>' : ""}
          ${metadata(post)}
        </div>
        <h2><button type="button" data-open-post="${escapeHtml(post.id)}">${escapeHtml(post.title)}</button></h2>
        <p>${escapeHtml(post.summary)}</p>
        ${regularMedia}
        ${extra}
      </div>
      <footer class="civic-card__footer">
        <button type="button" data-vote="${escapeHtml(post.id)}" class="${post.voted ? "is-active" : ""}" aria-label="${post.voted ? "Remove upvote" : "Upvote post"}" aria-pressed="${post.voted}"><i class="fa-solid fa-arrow-up"></i> ${post.voted ? "Upvoted" : "Upvote"}</button>
        <button type="button" data-replies="${escapeHtml(post.id)}" aria-label="${post.replyCount === null ? "Open replies" : `${post.replyCount} ${replyLabel}`}"><i class="fa-regular fa-comment" aria-hidden="true"></i>${replyCount}<span>${replyLabel}</span></button>
        <button type="button" data-save="${escapeHtml(post.id)}" class="${post.saved ? "is-active" : ""}" aria-pressed="${post.saved}"><i class="fa-${post.saved ? "solid" : "regular"} fa-bookmark"></i> ${post.saved ? "Saved" : "Save"}</button>
        <button type="button" data-open-post="${escapeHtml(post.id)}">Open Thread</button>
      </footer>
    </article>`;
  }

  function render() {
    renderHubs();
    const list = filteredPosts();
    document.getElementById("resultCount").textContent = `${list.length} post${list.length === 1 ? "" : "s"}`;
    const grid = document.getElementById("feedGrid");
    grid.innerHTML = list.map(card).join("");
    document.getElementById("feedEmpty").hidden = list.length !== 0;
    observeReplyCounts(grid, list);
    bindImageFallbacks();
    renderPinned();
  }

  function observeReplyCounts(grid, list) {
    replyCountObserver?.disconnect();
    const pending = new Set(list
      .filter((post) => post.replyCount === null && post.pageKey && post.communityKey)
      .map((post) => post.id));
    if (!pending.size) return;

    if (!("IntersectionObserver" in window)) {
      list.filter((post) => pending.has(post.id)).forEach((post) => void loadReplyCount(post));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        const post = posts.find((item) => item.id === entry.target.dataset.replies);
        if (post) void loadReplyCount(post);
      });
    }, { rootMargin: "160px" });
    replyCountObserver = observer;

    grid.querySelectorAll("button[data-replies]").forEach((button) => {
      if (pending.has(button.dataset.replies)) observer.observe(button);
    });
  }

  async function loadReplyCount(post) {
    const endpoint = window.ResiHubApi?.ENDPOINTS?.comments;
    if (!endpoint || !post.pageKey || !post.communityKey) return;
    const requestKey = `${post.communityKey}:${post.pageKey}`;
    if (replyCountRequests.has(requestKey)) return;
    replyCountRequests.add(requestKey);

    try {
      const query = new URLSearchParams({
        page_key: post.pageKey,
        community_key: post.communityKey,
      });
      const response = await fetch(`${endpoint}?${query}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Replies could not load (${response.status}).`);
      const payload = await response.json();
      if (payload?.success !== true || !Number.isSafeInteger(payload.total) || payload.total < 0) {
        throw new Error(payload?.error || "Comments service returned an invalid count.");
      }

      const currentPost = posts.find((item) => item.id === post.id);
      if (!currentPost) return;
      currentPost.replyCount = payload.total;
      persist();
      render();
    } catch (error) {
      console.error(`Could not load reply count for post "${post.id}".`, error);
    }
  }

  function bindImageFallbacks() {
    document.querySelectorAll("img[data-fallback]").forEach((img) => {
      img.addEventListener("error", () => {
        const slot = img.closest(".civic-card__media, .civic-post-image");
        if (slot) {
          slot.classList.add("is-fallback");
          slot.innerHTML = '<span>Photo unavailable</span>';
        }
      }, { once: true });
    });
  }

  function renderPinned() {
    const pinned = posts.filter((post) => post.type === "broadcast" && (activeHub === "all" || post.hubId === activeHub))
      .sort((a, b) => score(b) - score(a))[0];
    const el = document.getElementById("pinnedBroadcast");
    if (!el) return;
    el.hidden = !pinned;
    if (!pinned) return;
    el.innerHTML = `
      <i class="fa-solid fa-thumbtack" aria-hidden="true"></i>
      <div><strong>${pinned.priority === "Urgent" ? "Urgent Broadcast" : "Pinned Broadcast"}</strong>
      <span>${escapeHtml(pinned.title)} · ${escapeHtml(pinned.hub)} · ${relativeTime(pinned.createdAt)}</span></div>
      <button type="button" data-open-post="${escapeHtml(pinned.id)}">Read Notice</button>`;
  }

  function clearPostPageTheme(page) {
    const addedClasses = (page.dataset.pageThemeClasses || "").split(/\s+/).filter(Boolean);
    document.body.classList.remove(...addedClasses);
    delete page.dataset.pageThemeClasses;
  }

  async function loadPostPageContent(post, page, content) {
    if (!post.pageUrl || post.type === "listing") return;

    try {
      const pageUrl = new URL(post.pageUrl, window.location.href);
      if (pageUrl.origin !== window.location.origin) return;

      const response = await fetch(pageUrl.href, { headers: { Accept: "text/html" } });
      if (!response.ok) throw new Error(`Community page could not load (${response.status}).`);

      const pageDocument = new DOMParser().parseFromString(await response.text(), "text/html");
      const pageContent = pageDocument.querySelector(".wiki-render");
      if (!pageContent) throw new Error("Community page content was not found.");
      if (page.dataset.postId !== post.id || page.hidden) return;

      clearPostPageTheme(page);
      const pageClasses = Array.from(pageDocument.body.classList)
        .filter((className) => className.startsWith("page-"));
      const addedClasses = pageClasses.filter((className) => !document.body.classList.contains(className));
      document.body.classList.add(...addedClasses);
      if (addedClasses.length) page.dataset.pageThemeClasses = addedClasses.join(" ");

      const preparePageElement = (element) => {
        element.querySelectorAll("script, style, object, embed").forEach((child) => child.remove());
        element.querySelectorAll("iframe").forEach((frame) => {
          try {
            const url = new URL(frame.getAttribute("src") || "", pageUrl);
            if (
              url.protocol !== "https:" ||
              !["www.youtube.com", "www.youtube-nocookie.com"].includes(url.hostname)
            ) {
              throw new Error("Unsupported embedded video URL.");
            }
            frame.setAttribute("src", url.href);
            frame.setAttribute("title", frame.getAttribute("title") || "Embedded video");
            frame.setAttribute("allowfullscreen", "");
            frame.setAttribute("loading", "lazy");
            frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
          } catch {
            frame.remove();
          }
        });
        [element, ...element.querySelectorAll("*")].forEach((child) => {
          Array.from(child.attributes).forEach((attribute) => {
            if (/^on/i.test(attribute.name)) {
              child.removeAttribute(attribute.name);
            } else if (["href", "src", "poster"].includes(attribute.name.toLowerCase())) {
              try {
                const url = new URL(attribute.value, pageUrl);
                if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported URL protocol.");
                child.setAttribute(attribute.name, url.href);
              } catch {
                child.removeAttribute(attribute.name);
              }
            }
          });
        });
        return element;
      };

      const renderedContent = pageContent.cloneNode(true);
      window.ResiHubContentFormatter?.formatLegacyContent(renderedContent);
      preparePageElement(renderedContent);

      const firstHeading = renderedContent.querySelector("h1");
      if (firstHeading?.textContent.trim().toLocaleLowerCase() === post.title.trim().toLocaleLowerCase()) {
        firstHeading.remove();
      }

      content.querySelector(".civic-detail-prose").replaceChildren(renderedContent);
    } catch (error) {
      console.error("Could not load rendered community page in post view.", error);
    }
  }

  function openPost(id) {
    const post = posts.find((item) => item.id === id);
    if (!post) return;
    const url = new URL(window.location.href);
    const alreadySelected = url.searchParams.get("post") === post.id;
    if (!alreadySelected) {
      url.searchParams.set("post", post.id);
      history.pushState({ postId: post.id }, "", url);
    }
    showPostPage(post);
  }

  function showPostPage(post) {
    const feed = document.getElementById("civicFeed");
    const page = document.getElementById("postPage");
    const content = document.getElementById("postPageContent");
    clearPostPageTheme(page);
    feed.hidden = true;
    page.hidden = false;
    document.title = `${post.title} | ${post.hub} | The Hub Community`;
    const replyCount = post.replyCount === null ? "…" : post.replyCount;
    page.dataset.postId = post.id;
    const facts = post.facts || {};
    const extraImage = !post.pageUrl && post.image
      ? `<figure class="civic-post-image"><img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" referrerpolicy="no-referrer" data-fallback="true"></figure>`
      : "";
    content.innerHTML = `
      <article class="civic-post-page__article">
      <header class="civic-post-page__header">
        <div class="civic-detail-meta">${escapeHtml(metadata(post).replace(/<[^>]+>/g, ""))}</div>
        <h1 id="postPageTitle">${escapeHtml(post.title)}</h1>
        <p class="civic-detail-author">${escapeHtml(post.author)} · ${escapeHtml(post.authorRole || "Community Member")}</p>
        <p class="civic-detail-reading-time"><i class="fa-regular fa-clock" aria-hidden="true"></i> ${estimatedReadMinutes(post.details || post.summary)} min read</p>
      </header>
      <div class="civic-detail-prose">${formattedDetails(post.details || post.summary, post.title)}</div>
      ${extraImage}
      ${postShareLinks(post)}
      ${detailActions(post)}
      ${post.type === "listing" ? listingDetail(post) : ""}
      ${post.type === "evergreen" ? evergreenDetail(post, facts) : ""}
      <section class="civic-replies">
        <h3>Community replies</h3>
        <span id="replyCount" class="sr-only">${replyCount}</span>
        <p id="pageCommentsStatus" role="status" aria-live="polite"></p>
        <div id="replyList">${post.replies.map(renderReplyCard).join("") || "<p>No replies yet.</p>"}</div>
        <form id="replyForm" class="civic-reply-form">
          <label><span>Author Name</span><input name="author" maxlength="60" required></label>
          <label><span>Message</span><textarea name="message" maxlength="1000" required rows="3"></textarea></label>
          <button type="submit" class="civic-btn civic-btn--primary">Post Reply</button>
        </form>
      </section>
      </article>`;
    syncReplyToggles(content.querySelector("#replyList"));
    bindImageFallbacks();
    void loadPostPageContent(post, page, content);
    void loadPageComments(post);
    const listingStatus = content.querySelector("#listingStatus");
    if (listingStatus) {
      listingStatus.addEventListener("change", () => {
        post.status = listingStatus.value;
        persist();
        void postAction(post, "listing-status", { status: post.status });
        render();
      });
    }
    const verifyButton = content.querySelector("#markVerified");
    if (verifyButton) {
      verifyButton.addEventListener("click", () => {
        if (verifyButton.disabled) return;
        post.lastVerifiedAt = new Date().toISOString();
        persist();
        void postAction(post, "verify");
        const verifiedStatus = content.querySelector(".civic-verified");
        if (verifiedStatus) verifiedStatus.textContent = `Last verified ${exactTime(post.lastVerifiedAt)}`;
        verifyButton.disabled = true;
        verifyButton.textContent = "Verified Today";
        render();
      });
    }
    document.getElementById("replyForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      post.replies.push({
        author: data.get("author").trim(),
        message: data.get("message").trim(),
        createdAt: new Date().toISOString(),
      });
      if (post.replyCount !== null) post.replyCount += 1;
      persist();
      void postAction(post, "reply", {
        author: data.get("author").trim(),
        message: data.get("message").trim(),
      });
      openPost(post.id);
      render();
    });
  }

  function listingDetail(post) {
    return `<div class="civic-listing-controls"><label>Listing Status<select id="listingStatus"><option ${post.status === "Available" ? "selected" : ""}>Available</option><option ${post.status === "Pending" ? "selected" : ""}>Pending</option><option ${post.status === "Claimed" ? "selected" : ""}>Claimed</option></select></label></div>`;
  }

  function evergreenDetail(post, facts) {
    const factsHtml = Object.keys(facts).length
      ? `<dl class="civic-detail-facts">${Object.entries(facts).map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`
      : "";
    const verifiedDate = post.lastVerifiedAt ? new Date(post.lastVerifiedAt) : null;
    const verifiedToday = verifiedDate && Number.isFinite(verifiedDate.getTime())
      && verifiedDate.toDateString() === new Date().toDateString();
    const verifiedAt = post.lastVerifiedAt
      ? `Last verified ${exactTime(post.lastVerifiedAt)}`
      : "Not verified yet";
    return `${factsHtml}<p class="civic-verified" role="status">${escapeHtml(verifiedAt)}</p><button type="button" class="civic-btn civic-btn--secondary" id="markVerified"${verifiedToday ? " disabled" : ""}>${verifiedToday ? "Verified Today" : "Mark Verified Today"}</button>`;
  }

  function renderReplies(post, importedReplies) {
    const replyList = document.getElementById("replyList");
    const replyCount = document.getElementById("replyCount");
    if (!replyList || !replyCount) return;

    const commentsLoaded = Array.isArray(importedReplies);
    const replies = [...post.replies, ...(importedReplies || [])].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    );
    if (commentsLoaded || !post.pageKey || !post.communityKey) {
      post.replyCount = replies.length;
    }
    replyCount.textContent = String(replies.length);
    replyList.innerHTML = replies.map(renderReplyCard).join("") || "<p>No replies yet.</p>";
    syncReplyToggles(replyList);
  }

  function renderReplyCard(reply) {
    return `<article><strong>${escapeHtml(reply.author || "Anonymous")}</strong><time>${relativeTime(reply.createdAt)}</time><p class="civic-reply__message">${escapeHtml(reply.message)}</p><button type="button" class="civic-reply__toggle" data-reply-toggle aria-expanded="false" hidden>Show more</button></article>`;
  }

  function syncReplyToggles(replyList) {
    replyList.querySelectorAll(".civic-reply__message").forEach((message) => {
      const toggle = message.nextElementSibling;
      if (!toggle) return;
      toggle.hidden = message.scrollHeight <= message.clientHeight + 1;
    });
  }

  async function loadPageComments(post) {
    const endpoint = window.ResiHubApi?.ENDPOINTS?.comments;
    if (!endpoint || !post.pageKey || !post.communityKey) return;

    const page = document.getElementById("postPage");
    const status = document.getElementById("pageCommentsStatus");
    if (!status) return;
    status.textContent = "Loading existing comments…";
    try {
      const query = new URLSearchParams({
        page_key: post.pageKey,
        community_key: post.communityKey,
      });
      const response = await fetch(`${endpoint}?${query}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Comments could not load (${response.status}).`);
      const payload = await response.json();
      if (payload?.success !== true || !Array.isArray(payload.comments)) {
        throw new Error(payload?.error || "Comments service returned invalid data.");
      }
      if (page.dataset.postId !== post.id) return;

      const replies = payload.comments.map((comment) => ({
        author: comment.author || "Anonymous",
        message: comment.text || "",
        createdAt: comment.submitted_at || comment.createdAt,
      })).filter((comment) => comment.message);
      renderReplies(post, replies);
      render();
      status.textContent = "";
    } catch (error) {
      if (page.dataset.postId === post.id) status.textContent = error.message;
    }
  }

  function postShareLinks(post) {
    const shareUrl = new URL(window.location.href);
    shareUrl.search = "";
    shareUrl.hash = "";
    shareUrl.searchParams.set("post", post.id);
    const encodedUrl = encodeURIComponent(shareUrl.toString());
    const encodedTitle = encodeURIComponent(post.title);
    const links = {
      whatsapp: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      x: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    };
    return `<section class="civic-social-share" aria-label="Share this post"><span>Share this post</span>
      <a href="${links.whatsapp}" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i></a>
      <a href="${links.facebook}" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook"><i class="fa-brands fa-facebook-f" aria-hidden="true"></i></a>
      <a href="${links.x}" target="_blank" rel="noopener noreferrer" aria-label="Share on X"><i class="fa-brands fa-x-twitter" aria-hidden="true"></i></a>
      <a href="${links.linkedin}" target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn"><i class="fa-brands fa-linkedin-in" aria-hidden="true"></i></a>
    </section>`;
  }

  function estimatedReadMinutes(text) {
    const wordCount = String(text || "").trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(wordCount / 200));
  }

  function editPageUrl(post) {
    if (!post.pageUrl || post.type === "listing") return "";
    try {
      const url = new URL(post.pageUrl, window.location.href);
      if (url.origin !== window.location.origin) return "";
      url.searchParams.set("edit", "1");
      return url.href;
    } catch (error) {
      console.error("Could not create edit link for community page.", error);
      return "";
    }
  }

  function detailActions(post) {
    const editUrl = editPageUrl(post);
    const editButton = editUrl
      ? `<a class="civic-btn civic-btn--secondary" href="${escapeHtml(editUrl)}" aria-label="Edit page with full editor"><i class="fa-regular fa-pen-to-square" aria-hidden="true"></i> Edit</a>`
      : "";
    const reportButton = post.pageKey && post.communityKey
      ? `<div class="ugc-report-wrap" data-ugc-type="wiki" data-ugc-id="${escapeHtml(post.pageKey)}" data-community-key="${escapeHtml(post.communityKey)}" data-page-key="${escapeHtml(post.pageKey)}" data-ugc-text="${escapeHtml((post.details || post.summary).slice(0, 220))}"><button type="button" class="civic-btn civic-btn--secondary report-content-btn" aria-label="Report this page"><i class="fa-solid fa-flag" aria-hidden="true"></i> Report</button></div>`
      : "";
    return editButton || reportButton
      ? `<div class="civic-detail-actions">${editButton}${reportButton}</div>`
      : "";
  }

  function openLinkedPost() {
    const postId = new URLSearchParams(location.search).get("post");
    const post = posts.find((item) => item.id === postId);
    if (postId && post) showPostPage(post);
    else showFeedPage();
  }

  function setupActions() {
    window.addEventListener("popstate", openLinkedPost);
    document.addEventListener("click", (event) => {
      const replyToggle = event.target.closest("[data-reply-toggle]");
      if (replyToggle) {
        const message = replyToggle.previousElementSibling;
        if (message) {
          const expanded = replyToggle.getAttribute("aria-expanded") !== "true";
          message.classList.toggle("is-expanded", expanded);
          replyToggle.setAttribute("aria-expanded", String(expanded));
          replyToggle.textContent = expanded ? "Show less" : "Show more";
        }
      }
      const hub = event.target.closest("[data-hub]");
      if (hub) {
        activeHub = hub.dataset.hub;
        updateHubBanner();
        render();
      }
      const vote = event.target.closest("[data-vote]");
      if (vote) toggleVote(vote.dataset.vote);
      const save = event.target.closest("[data-save]");
      if (save) toggleSave(save.dataset.save);
      const open = event.target.closest("[data-open-post]");
      if (open) openPost(open.dataset.openPost);
      const replies = event.target.closest("[data-replies]");
      if (replies) openPost(replies.dataset.replies);
      if (event.target.closest("[data-share-post-open]")) openComposer();
      if (event.target.closest("[data-composer-close]")) closeComposer();
    });

    document.addEventListener("change", (event) => {
      const hubSelect = event.target.closest("#mobileHubSelect");
      if (!hubSelect) return;
      activeHub = hubSelect.value;
      updateHubBanner();
      render();
    });

    const feedSearch = document.getElementById("feedSearch");
    feedSearch.addEventListener("input", (event) => {
      searchText = event.target.value.trim();
      render();
      void updateSiteSearchResults(searchText);
    });
    feedSearch.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeSiteSearchResults();
      if (event.key === "Enter") {
        const firstResult = document.querySelector("#siteSearchResults a");
        if (firstResult) {
          event.preventDefault();
          window.location.assign(firstResult.href);
        }
      }
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".civic-header-search-inner")) closeSiteSearchResults();
    });
    document.getElementById("typeFilter").addEventListener("click", (event) => {
      const button = event.target.closest("[data-type]");
      if (!button) return;
      activeType = button.dataset.type;
      document.querySelectorAll("[data-type]").forEach((item) => {
        item.classList.toggle("is-active", item === button);
        item.setAttribute("aria-pressed", String(item === button));
      });
      render();
    });
    document.getElementById("sortSwitch").addEventListener("click", (event) => {
      const button = event.target.closest("[data-sort]");
      if (!button) return;
      activeSort = button.dataset.sort;
      document.querySelectorAll("[data-sort]").forEach((item) => {
        item.classList.toggle("is-active", item === button);
        item.setAttribute("aria-pressed", String(item === button));
      });
      render();
    });
    document.getElementById("showAllPosts").addEventListener("click", () => {
      activeHub = "all"; activeType = "all"; searchText = ""; savedOnly = false;
      document.getElementById("feedSearch").value = "";
      closeSiteSearchResults();
      document.querySelectorAll("[data-type]").forEach((button) => {
        const active = button.dataset.type === "all";
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      updateHubBanner();
      render();
    });

    document.querySelectorAll("[data-compose-type]").forEach((button) => {
      button.addEventListener("click", () => selectComposerType(button.dataset.composeType));
    });
    document.getElementById("sharePostForm").addEventListener("submit", publishPost);
    document.getElementById("openPublishedPost").addEventListener("click", () => {
      if (publishedPostId) openPost(publishedPostId);
      document.getElementById("publishConfirmation").hidden = true;
    });
  }

  function toggleVote(id) {
    const post = posts.find((item) => item.id === id);
    if (!post) return;
    post.voted = !post.voted;
    post.upvotes = Math.max(0, post.upvotes + (post.voted ? 1 : -1));
    persist(); void postAction(post, "vote"); render();
  }

  function toggleSave(id) {
    const post = posts.find((item) => item.id === id);
    if (!post) return;
    post.saved = !post.saved;
    persist(); void postAction(post, "save"); render();
  }

  function updateHubBanner() {
    if (activeHub === "all") {
      document.getElementById("hubLocation").textContent = "Global Civic Network · North America · APAC · Special Interest";
      document.getElementById("hubTitle").textContent = "All Community Hubs";
      document.getElementById("hubPurpose").textContent = "A fast, edge-cached community broadsheet uniting regional neighborhoods with global knowledge and local exchange.";
      if (typeof window.applyFestivalGreeting === "function") {
        window.applyFestivalGreeting();
      }
      return;
    }
    const hub = hubs.find((item) => item.id === activeHub);
    if (!hub) return;
    document.getElementById("hubLocation").textContent = "Community hub";
    document.getElementById("hubTitle").textContent = hub.name;
    document.getElementById("hubPurpose").textContent = hub.purpose;
    if (typeof window.applyFestivalGreeting === "function") {
      window.applyFestivalGreeting();
    }
  }

  function openComposer() {
    const dialog = document.getElementById("shareComposer");
    populateComposerHubs();
    if (typeof dialog.showModal === "function") dialog.showModal();
  }

  function closeComposer() {
    document.getElementById("shareComposer").close();
  }

  function populateComposerHubs() {
    const select = document.getElementById("composerHub");
    select.innerHTML = hubs.map((hub) => `<option value="${escapeHtml(hub.id)}">${escapeHtml(hub.name)}</option>`).join("");
    if (activeHub !== "all") select.value = activeHub;
  }

  function selectComposerType(type) {
    selectedPostType = type;
    document.querySelectorAll("[data-compose-type]").forEach((button) => {
      const active = button.dataset.composeType === type;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    document.getElementById("broadcastFields").hidden = type !== "broadcast";
    document.getElementById("listingFields").hidden = type !== "listing";
    document.getElementById("evergreenFields").hidden = type !== "evergreen";
  }

  async function publishPost(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const hubId = String(data.get("hub") || "");
    const hub = hubs.find((item) => item.id === hubId);
    if (!data.get("headline")?.trim() || !data.get("summary")?.trim() || !data.get("details")?.trim()) return;
    const now = new Date().toISOString();
    const id = `post-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const post = normalizeSeedPost({
      id,
      type: selectedPostType,
      hub: hub?.name || "Community",
      hubId,
      title: data.get("headline").trim(),
      summary: data.get("summary").trim(),
      details: data.get("details").trim(),
      author: data.get("author").trim(),
      authorRole: "Community Member",
      createdAt: now,
      tags: String(data.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean),
      image: data.get("image")?.trim() || "",
      upvotes: 0,
      replies: [],
      saved: false,
      voted: false,
      status: selectedPostType === "listing" ? "Available" : "Active",
      priority: data.get("priority")?.trim() || "Standard",
      effectiveWindow: data.get("effectiveWindow")?.trim() || "",
      listingType: data.get("listingType")?.trim() || "For Sale",
      price: data.get("price")?.trim() || "",
      pickupArea: data.get("pickupArea")?.trim() || "",
      facts: Object.fromEntries(
        [
          [data.get("fact1Label")?.trim(), data.get("fact1Value")?.trim()],
          [data.get("fact2Label")?.trim(), data.get("fact2Value")?.trim()],
        ].filter(([label, value]) => label && value),
      ),
      lastVerifiedAt: now,
    });
    posts.unshift(post);
    persist();
    activeHub = hubId;
    activeType = "all";
    searchText = "";
    updateHubBanner();
    closeComposer();
    form.reset();
    selectComposerType("broadcast");
    render();
    publishedPostId = id;
    const confirmation = document.getElementById("publishConfirmation");
    confirmation.hidden = false;

    try {
      const endpoint = window.ResiHubApi?.ENDPOINTS?.communityPosts;
      if (!endpoint) return;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ ...post, action: "create", actor_id: getActorId() }),
      });
      if (!response.ok) throw new Error(`Post server sync failed (${response.status}).`);
    } catch (error) {
      showPersistenceWarning(error);
    }
  }

  function showFeedPage() {
    const page = document.getElementById("postPage");
    clearPostPageTheme(page);
    page.hidden = true;
    document.getElementById("civicFeed").hidden = false;
    document.title = feedPageTitle;
  }

  load();
  setupActions();
  updateHubBanner();
  render();
  openLinkedPost();
  selectComposerType("broadcast");
  communitySyncPromise = syncCommunityPosts();
})();
