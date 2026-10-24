(function initTrustSafetyReporting() {
  "use strict";

  var REPORT_ENDPOINT =
    window.ResiHubApi?.ENDPOINTS?.reportContent ||
    (window.API_BASE || "https://api.hubcollective.ca") + "/api/reports";

  var REASONS = [
    "spam",
    "scam",
    "abuse",
    "harassment",
    "violence",
    "explicit",
    "misinformation",
    "other",
  ];
  var tr = function (key, fallback) {
    return typeof window.t === "function" ? window.t(key, fallback) : fallback;
  };

  function getReasonLabel(reason) {
    return tr(
      "trust_safety.reason_" + reason,
      reason.charAt(0).toUpperCase() + reason.slice(1),
    );
  }

  function normalizeReason(value) {
    var normalized = String(value || "")
      .trim()
      .toLowerCase();
    return REASONS.includes(normalized) ? normalized : "other";
  }

  function getReportNode(button) {
    if (!button) return null;
    return button.closest("[data-ugc-type][data-ugc-id]");
  }

  function extractTextPreview(node) {
    if (!node) return "";
    var declared = String(node.getAttribute("data-ugc-text") || "").trim();
    if (declared) return declared.slice(0, 800);

    var textNode =
      node.querySelector(".comment-card__text") ||
      node.querySelector(".comment-text") ||
      node.querySelector(".ad-item-overview") ||
      node.querySelector(".text-content") ||
      node;

    return String(textNode.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 800);
  }

  function setButtonState(button, status, message) {
    if (!button) return;

    var statusNode = button.parentElement?.querySelector(".report-status-text");
    if (!statusNode) {
      statusNode = document.createElement("span");
      statusNode.className = "report-status-text";
      button.parentElement?.appendChild(statusNode);
    }

    button.dataset.state = status;
    statusNode.textContent = message || "";
  }

  function openReportModal(button, onSubmit) {
    var overlay = document.createElement("div");
    overlay.className = "report-modal-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "report-modal-title");

    var selectedReason = "spam";

    overlay.innerHTML = `
      <div class="report-modal">
        <h2 class="report-modal__title" id="report-modal-title">${tr("trust_safety.modal_title", "Report Content")}</h2>
        <p class="report-modal__subtitle">${tr("trust_safety.modal_subtitle", "Help us understand the problem. Your report is anonymous.")}</p>
        <span class="report-modal__label">${tr("trust_safety.select_reason", "Select a reason")}</span>
        <div class="report-modal__reasons" role="group" aria-label="${tr("trust_safety.report_reasons", "Report reasons")}">
          ${REASONS.map((r) => `<button type="button" class="report-reason-btn" data-reason="${r}" aria-pressed="${r === selectedReason}">${getReasonLabel(r)}</button>`).join("")}
        </div>
        <span class="report-modal__label">${tr("trust_safety.additional_details", "Additional details")} <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#94a3b8">(${tr("trust_safety.optional", "optional")})</span></span>
        <textarea class="report-modal__textarea" id="report-details" placeholder="${tr("trust_safety.details_placeholder", "Any extra context helps moderators review faster...")}" maxlength="500" rows="3"></textarea>
        <div class="report-modal__actions">
          <button type="button" class="report-modal__cancel">${tr("common.cancel", "Cancel")}</button>
          <button type="button" class="report-modal__submit">${tr("trust_safety.submit_report", "Submit Report")}</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    var reasonBtns = overlay.querySelectorAll(".report-reason-btn");
    var cancelBtn = overlay.querySelector(".report-modal__cancel");
    var submitBtn = overlay.querySelector(".report-modal__submit");
    var detailsInput = overlay.querySelector("#report-details");

    reasonBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectedReason = btn.dataset.reason;
        reasonBtns.forEach(function (b) {
          b.setAttribute("aria-pressed", "false");
        });
        btn.setAttribute("aria-pressed", "true");
      });
    });

    function close() {
      overlay.remove();
      button.focus();
    }

    cancelBtn.addEventListener("click", close);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    overlay.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    submitBtn.addEventListener("click", function () {
      submitBtn.disabled = true;
      submitBtn.textContent = tr("trust_safety.submitting", "Submitting...");
      onSubmit(
        normalizeReason(selectedReason),
        String(detailsInput.value || "")
          .trim()
          .slice(0, 500),
        close,
      );
    });

    // Focus first reason button
    reasonBtns[0] && reasonBtns[0].focus();
  }

  async function submitReport(button) {
    var reportNode = getReportNode(button);
    if (!reportNode) return;

    openReportModal(button, async function (reason, details, closeModal) {
      var payload = {
        content_type: String(
          reportNode.getAttribute("data-ugc-type") || "unknown",
        ),
        content_id: String(reportNode.getAttribute("data-ugc-id") || "").trim(),
        reason: reason,
        details: details,
        content_text: extractTextPreview(reportNode),
        page_url: window.location.href,
        community_key: reportNode.getAttribute("data-community-key") || "",
        page_key: reportNode.getAttribute("data-page-key") || "",
      };

      if (!payload.content_id) {
        closeModal();
        window.alert(
          tr(
            "trust_safety.missing_content_id",
            "Unable to submit report: content ID is missing.",
          ),
        );
        return;
      }

      button.disabled = true;
      setButtonState(
        button,
        "pending",
        tr("trust_safety.submitting", "Submitting..."),
      );

      try {
        var response = await fetch(REPORT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        var data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              tr("trust_safety.failed_submit", "Failed to submit report."),
          );
        }

        closeModal();
        setButtonState(
          button,
          "submitted",
          tr("trust_safety.reported", "Reported"),
        );
        button.setAttribute("aria-disabled", "true");
        button.title = tr("trust_safety.report_submitted", "Report submitted");
      } catch (error) {
        console.error("Report submission failed", error);
        button.disabled = false;
        closeModal();
        setButtonState(
          button,
          "error",
          String(
            error?.message ||
              tr("trust_safety.failed_submit_short", "Failed to submit."),
          ).slice(0, 80),
        );
      }
    });
  }

  document.addEventListener("click", function onReportClick(event) {
    var button = event.target.closest(".report-content-btn");
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    if (button.dataset.state === "submitted") return;
    submitReport(button);
  });
})();
