(function () {
  var form = document.getElementById("statusLookupForm");
  var input = document.getElementById("submissionIdInput");
  var errorEl = document.getElementById("statusLookupError");
  var resultEl = document.getElementById("statusResult");
  var badgeEl = document.getElementById("statusBadge");
  var descEl = document.getElementById("statusDescription");

  function text(key, fallback) {
    return typeof window.t === "function" ? window.t(key, fallback) : fallback;
  }

  function setError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  function renderStatus(data, submissionId) {
    resultEl.hidden = false;
    var status = String(data.status || "pending").toLowerCase();
    var knownStatuses = {
      pending: true,
      approved: true,
      published: true,
      closed: true,
      not_found: true,
      invalid: true,
    };
    if (!knownStatuses[status]) {
      status = "pending";
    }

    var badgeLabels = {
      pending: text("status.badge_pending", "Pending"),
      approved: text("status.badge_approved", "Accepted"),
      published: text("status.badge_published", "Published"),
      closed: text("status.badge_closed", "Unavailable"),
      not_found: text("status.badge_not_found", "Not Found"),
      invalid: text("status.badge_invalid", "Invalid ID"),
    };

    badgeEl.textContent = badgeLabels[status] || badgeLabels.pending;
    badgeEl.className = "status-badge status-badge--" + status;

    var descriptions = {
      pending: text(
        "status.description_pending",
        "Your submission is being processed.",
      ),
      approved: text(
        "status.description_approved",
        "Your submission was accepted and will be available soon.",
      ),
      published: text(
        "status.description_published",
        "Your submission is published.",
      ),
      closed: text(
        "status.description_closed",
        "This submission is no longer active. Please submit again if needed.",
      ),
      not_found: text(
        "status.description_not_found",
        "We could not find that submission. Please check your Submission ID and try again.",
      ),
      invalid: text(
        "status.description_invalid",
        "The provided submission ID is not valid.",
      ),
    };

    descEl.textContent = descriptions[status] || descriptions.pending;
  }

  async function lookupStatus(submissionId) {
    setError("");
    resultEl.hidden = true;

    window.ResiHubSubmissionProgress?.start(
      text("status.lookuping", "Checking submission status..."),
      text(
        "status.lookuping_detail",
        "Please wait while we fetch the latest review state.",
      ),
    );

    try {
      var endpoint =
        window.ResiHubApi?.ENDPOINTS?.submissionStatus ||
        "https://hub-worker-api.dekumar-ca.workers.dev/api/submission-status";
      var response = await fetch(
        endpoint + "?submission_id=" + encodeURIComponent(submissionId),
      );
      var raw = await response.text();
      var payload = null;
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch (_) {
        payload = null;
      }

      if (
        payload &&
        (payload.status === "not_found" || payload.status === "invalid")
      ) {
        renderStatus(payload, submissionId);
        window.ResiHubSubmissionProgress?.complete(
          text("status.lookup_complete", "Status loaded"),
          text(
            "status.lookup_complete_detail",
            "The latest submission state is now shown below.",
          ),
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          payload && payload.error
            ? payload.error
            : text("status.lookup_failed", "Unable to load submission status."),
        );
      }

      if (!payload) {
        throw new Error(
          text("status.lookup_failed", "Unable to load submission status."),
        );
      }

      renderStatus(payload, submissionId);
      window.ResiHubSubmissionProgress?.complete(
        text("status.lookup_complete", "Status loaded"),
        text(
          "status.lookup_complete_detail",
          "The latest submission state is now shown below.",
        ),
      );
    } catch (err) {
      setError(
        err && err.message
          ? err.message
          : text("status.lookup_failed", "Unable to load submission status."),
      );
      window.ResiHubSubmissionProgress?.error(
        text("status.lookup_failed", "Unable to load submission status."),
        err && err.message
          ? err.message
          : text("messages.error_try_again", "Error - Try Again"),
      );
    }
  }

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var submissionId = String((input && input.value) || "").trim();
      if (!submissionId) {
        setError(
          text(
            "status.submission_id_required",
            "Enter a submission ID to continue.",
          ),
        );
        return;
      }
      lookupStatus(submissionId);
    });
  }

  var params = new URLSearchParams(window.location.search);
  var submissionId = (params.get("submission_id") || "").trim();
  if (submissionId && input) {
    input.value = submissionId;
    lookupStatus(submissionId);
  }
})();
