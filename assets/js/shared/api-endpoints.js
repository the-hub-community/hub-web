(function initResiHubApiEndpoints() {
  "use strict";

  // Override at runtime by setting window.RESIHUB_API_BASE before this script.
  var baseUrl = String(
    window.RESIHUB_API_BASE || "https://hub-worker-api.dekumar-ca.workers.dev",
  )
    .trim()
    .replace(/\/+$/, "");
  var statusBaseUrl = String(window.RESIHUB_STATUS_API_BASE || baseUrl)
    .trim()
    .replace(/\/+$/, "");

  var PUBLIC_WORKER_BASE = String(
    window.RESIHUB_PUBLIC_API_BASE ||
      "https://resihub-image-uploader.dekumar-ca.workers.dev",
  ).replace(/\/+$/, "");

  var endpoints = {
    health: baseUrl + "/health",
    submit: baseUrl + "/api/submit",
    notification: baseUrl + "/api/notification",
    broadcast: baseUrl + "/api/submit",
    submissionStatus: statusBaseUrl + "/api/submission-status",

    // Public routes — hit the image-uploader directly.
    // The gateway only forwards /api/submit, so these must bypass it.
    comments: baseUrl + "/api/comments",
    newsLatest: baseUrl + "/api/news/latest",
    aiTitleSuggestions: baseUrl + "/api/ai/suggestions/title",
    aiContentQuality: baseUrl + "/api/ai/suggestions/content-quality",
    aiAutoTags: baseUrl + "/api/ai/suggestions/auto-tags",
    aiSpellcheck: baseUrl + "/api/ai/suggestions/spellcheck",
    reportContent: baseUrl + "/api/reports",
    moderationQueue: baseUrl + "/api/moderation/queue",
    moderationActions: baseUrl + "/api/moderation/actions",
    moderate: baseUrl + "/api/moderate",
    // Search lives on the public worker too
    search: baseUrl + "/api/search",
  };

  function getSiteBaseUrl() {
    return String(
      (document.body &&
        document.body.dataset &&
        document.body.dataset.baseurl) ||
        "",
    )
      .trim()
      .replace(/\/+$/, "");
  }

  function createSubmissionId(prefix) {
    var lead =
      String(prefix || "page")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "page";
    return [
      lead,
      Date.now().toString(36),
      Math.random().toString(36).slice(2, 10),
    ].join("-");
  }

  function buildStatusPageUrl(submissionId) {
    var siteBase = getSiteBaseUrl();
    var params = new URLSearchParams();
    if (submissionId) {
      params.set("submission_id", submissionId);
    }
    return (
      siteBase +
      "/status.html" +
      (params.toString() ? "?" + params.toString() : "")
    );
  }

  function buildSuccessPageUrl(options) {
    var siteBase = getSiteBaseUrl();
    var params = new URLSearchParams();
    var opts = options || {};
    params.set("type", opts.type || "wiki");
    if (opts.community) params.set("community", opts.community);
    if (opts.existing) params.set("existing", "1");
    if (opts.submissionId) params.set("submission_id", opts.submissionId);
    return siteBase + "/success.html?" + params.toString();
  }

  window.ResiHubApi = Object.freeze({
    BASE_URL: baseUrl,
    ENDPOINTS: Object.freeze(endpoints),
    getEndpoint: function getEndpoint(key) {
      return endpoints[key] || baseUrl;
    },
    createSubmissionId: createSubmissionId,
    buildStatusPageUrl: buildStatusPageUrl,
    buildSuccessPageUrl: buildSuccessPageUrl,
  });
})();
