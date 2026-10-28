(function initSuccessModal() {
  "use strict";

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[character];
    });
  }

  function show({
    redirectUrl = "/",
    submissionId = "",
    type = "submission",
    title = "",
    managementToken = "",
  } = {}) {
    const existing = document.getElementById("resihub-success-modal");
    if (existing) existing.remove();

    let historyError = "";
    if (submissionId) {
      try {
        if (!window.ResiHubSubmissionHistory) {
          throw new Error("Submission history is unavailable.");
        }
        window.ResiHubSubmissionHistory.save({
          id: submissionId,
          type,
          title,
          managementToken,
        });
      } catch (error) {
        historyError =
          error instanceof Error ? error.message : "Unable to save submission.";
      }
    }

    const overlay = document.createElement("div");
    overlay.id = "resihub-success-modal";
    overlay.className = "success-modal-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    const statusHref = submissionId
      ? `/status.html?submission_id=${encodeURIComponent(submissionId)}`
      : "/status.html";

    overlay.innerHTML = `
      <div class="success-modal-card">
        <div class="success-modal-card__icon" aria-hidden="true">✓</div>
        <h3>Submission received</h3>
        <p>Your contribution is now under review. You'll see it live within 24–48 hours.</p>
        ${submissionId ? `<code class="success-modal-card__id">${escapeHtml(submissionId)}</code>` : ""}
        ${managementToken ? `<div class="success-modal-card__secret"><span>Private listing management code</span><code>${escapeHtml(managementToken)}</code><button type="button" class="btn-secondary" data-copy-management-code>Copy code</button></div><p class="success-modal-card__note">Saved in My Submissions on this device. Keep this code private.</p>` : ""}
        ${historyError ? `<p class="success-modal-card__error" role="alert">Could not save this submission on this device: ${escapeHtml(historyError)} Copy your submission ID${managementToken ? " and private management code" : ""} before leaving.</p>` : ""}
        <div class="success-modal-card__actions">
          <a href="${statusHref}" class="btn-secondary">Track status</a>
          <a href="/my-submissions.html" class="btn-secondary">My submissions</a>
          <button type="button" class="btn-primary" data-continue>Continue</button>
        </div>
      </div>
    `;

    overlay.querySelector("[data-continue]").addEventListener("click", () => {
      window.location.href = redirectUrl;
    });

    const copyCodeButton = overlay.querySelector("[data-copy-management-code]");
    if (copyCodeButton) {
      copyCodeButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(managementToken);
          copyCodeButton.textContent = "Copied";
        } catch (error) {
          copyCodeButton.textContent = "Copy unavailable";
        }
      });
    }

    document.body.appendChild(overlay);
    setTimeout(() => overlay.querySelector("[data-continue]")?.focus(), 100);
  }

  window.ResiHubSuccessModal = { show };
})();
