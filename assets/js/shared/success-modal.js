(function initSuccessModal() {
  "use strict";

  function show({ redirectUrl = "/", submissionId = "" } = {}) {
    const existing = document.getElementById("resihub-success-modal");
    if (existing) existing.remove();

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
        ${submissionId ? `<code class="success-modal-card__id">${submissionId}</code>` : ""}
        <div class="success-modal-card__actions">
          <a href="${statusHref}" class="btn-secondary">Track status</a>
          <button type="button" class="btn-primary" data-continue>Continue</button>
        </div>
      </div>
    `;

    overlay.querySelector("[data-continue]").addEventListener("click", () => {
      window.location.href = redirectUrl;
    });

    document.body.appendChild(overlay);
    setTimeout(() => overlay.querySelector("[data-continue]")?.focus(), 100);
  }

  window.ResiHubSuccessModal = { show };
})();
