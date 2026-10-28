const communityDataEl = document.getElementById("community-data");
const availableCommunities = (() => {
  try {
    const raw = communityDataEl?.textContent || "[]";
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      const slug = (item.slug || "").toLowerCase();
      const normalizedKey = (item.key || "").trim().toLowerCase();
      return {
        name: item.name,
        slug,
        key: normalizedKey || (slug ? `comm-${slug}` : ""),
      };
    });
  } catch (_err) {
    return [];
  }
})();
const REPO_DETAIL_PATTERN =
  /(api\.github\.com|github\.com\/|\brepos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i;

function hasSensitiveRepoDetails(raw) {
  if (!raw) return false;
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  return REPO_DETAIL_PATTERN.test(text);
}

function i18nText(key, fallback) {
  if (typeof window.t === "function") {
    return window.t(key, fallback);
  }
  return fallback;
}

function slugifyCommunityName(name) {
  return (name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fallbackSubmissionId(prefix) {
  const safePrefix =
    String(prefix || "page")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "page";
  return [
    safePrefix,
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 10),
  ].join("-");
}

function resolvePostSubmitRedirectUrl(submissionId) {
  const condoField = document.querySelector('#broadcastForm [name="condo"]');
  const condoSlug = slugifyCommunityName(condoField?.value || "");
  return window.ResiHubApi?.buildSuccessPageUrl({
    type: "broadcast",
    community: condoSlug && condoSlug !== "general" ? condoSlug : "",
    existing: Boolean(condoSlug && condoSlug !== "general"),
    submissionId,
  });
}

function showSubmissionSuccessModal(redirectUrl) {
  const overlay = document.createElement("div");
  overlay.className = "success-modal-overlay";
  overlay.innerHTML = `
            <div class="success-modal-card" role="dialog" aria-modal="true" aria-label="${i18nText("messages.success", "Success")}">
                <h3>${i18nText("messages.submission_received", "Submission received")}</h3>
                <p>${i18nText("messages.click_to_continue", "Click anywhere on this message to continue.")}</p>
            </div>
        `;

  overlay.addEventListener("click", () => {
    window.location.href = redirectUrl || resolvePostSubmitRedirectUrl();
  });

  document.body.appendChild(overlay);
}

const urlParams = new URLSearchParams(window.location.search);
const condoParam = urlParams.get("condo");
const wrapper = document.getElementById("community-input-wrapper");
const communityKeyInput = document.getElementById("communityKeyInput");
const pageKeyInput = document.getElementById("pageKeyInput");
const urgencySelect = document.getElementById("urgencySelect");
// ── AI Urgency Suggestion ────────────────────────────────
let urgencyDebounce = null;

function renderUrgencyChip(urgency, reason) {
  let chip = document.getElementById("urgencySuggestion");
  if (chip) chip.remove();

  chip = document.createElement("div");
  chip.id = "urgencySuggestion";
  chip.className = "ai-suggestion-chip";
  chip.innerHTML = `
    <span class="ai-suggestion-chip__icon" aria-hidden="true">✨</span>
    <span class="ai-suggestion-chip__text">
      AI suggests <strong>${urgency}</strong>${reason ? ` — ${reason}` : ""}
    </span>
    <button type="button" class="ai-suggestion-chip__apply">Apply</button>
    <button type="button" class="ai-suggestion-chip__dismiss" aria-label="Dismiss">×</button>
  `;
  chip
    .querySelector(".ai-suggestion-chip__apply")
    .addEventListener("click", () => {
      urgencySelect.value = urgency;
      urgencySelect.dispatchEvent(new Event("change"));
      chip.remove();
    });
  chip
    .querySelector(".ai-suggestion-chip__dismiss")
    .addEventListener("click", () => chip.remove());
  urgencySelect.parentElement.appendChild(chip);
}

const urgencyMeter = document.getElementById("urgencyMeter");
const urgencyMeterLabel = document.getElementById("urgencyMeterLabel");
const urgencyMeterHint = document.getElementById("urgencyMeterHint");
const urgencyMeterFill = document.getElementById("urgencyMeterFill");
const broadcastExpiryTimer = document.getElementById("broadcastExpiryTimer");
const broadcastExpiryTimerMirror = document.getElementById(
  "broadcastExpiryTimerMirror",
);
const livePreviewTitle = document.getElementById("livePreviewTitle");
const livePreviewCondo = document.getElementById("livePreviewCondo");
const livePreviewBody = document.getElementById("livePreviewBody");
const liveUrgencyBadge = document.getElementById("liveUrgencyBadge");
const broadcastHeroCommunity = document.getElementById(
  "broadcastHeroCommunity",
);

function setCommunityKey(value) {
  if (!communityKeyInput) return;
  communityKeyInput.value = (value || "").trim().toLowerCase();
}

function ensurePageKey() {
  const existing = String(pageKeyInput?.value || "").trim();
  if (existing) return existing;
  const generated =
    window.ResiHubApi?.createSubmissionId?.("bcast") ||
    fallbackSubmissionId("bcast");
  if (pageKeyInput) {
    pageKeyInput.value = generated;
  }
  return generated;
}

ensurePageKey();

const URGENCY_META = {
  low: {
    label: "Low",
    hint: "Informational update",
    width: "20%",
  },
  medium: {
    label: "Medium",
    hint: "Standard community notice",
    width: "45%",
  },
  high: {
    label: "High",
    hint: "Urgent action recommended",
    width: "72%",
  },
  critical: {
    label: "Critical",
    hint: "Immediate attention required",
    width: "100%",
  },
};

function updateUrgencyMeter() {
  const urgency = String(urgencySelect?.value || "medium").toLowerCase();
  const config = URGENCY_META[urgency] || URGENCY_META.medium;

  if (urgencyMeter) {
    urgencyMeter.dataset.urgency = urgency;
  }
  if (urgencyMeterLabel) {
    urgencyMeterLabel.textContent = config.label;
  }
  if (urgencyMeterHint) {
    urgencyMeterHint.textContent = config.hint;
  }
  if (urgencyMeterFill) {
    urgencyMeterFill.style.width = config.width;
  }

  if (liveUrgencyBadge) {
    liveUrgencyBadge.textContent = config.label;
    liveUrgencyBadge.classList.remove(
      "urgency-low",
      "urgency-medium",
      "urgency-high",
      "urgency-critical",
    );
    liveUrgencyBadge.classList.add(`urgency-${urgency}`);
  }
}

function updateLivePreview() {
  const titleField = document.querySelector('#broadcastForm [name="title"]');
  const contentField = document.querySelector(
    '#broadcastForm [name="content"]',
  );
  const condoField = document.querySelector('#broadcastForm [name="condo"]');

  const titleText = String(titleField?.value || "").trim();
  const bodyText = String(contentField?.value || "").trim();
  const condoText = String(condoField?.value || "").trim();

  if (livePreviewTitle) {
    livePreviewTitle.textContent = titleText || "Scheduled Maintenance";
  }
  if (livePreviewCondo) {
    livePreviewCondo.textContent = condoText || "Select a community";
  }
  if (broadcastHeroCommunity) {
    const communityLabel = condoText || "All communities";
    broadcastHeroCommunity.innerHTML = `<i class="fa-solid fa-location-dot"></i> Community: ${communityLabel}`;
  }
  if (livePreviewBody) {
    livePreviewBody.textContent =
      bodyText ||
      "Write your broadcast details to preview how this announcement will appear to residents.";
  }
}

function updateExpiryBanner() {
  if (!broadcastExpiryTimer) return;
  const expiresAt = Date.now() + 5 * 24 * 60 * 60 * 1000;

  const tick = () => {
    const remainingMs = Math.max(0, expiresAt - Date.now());
    const totalMinutes = Math.floor(remainingMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    const countdown = `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
    broadcastExpiryTimer.textContent = countdown;
    if (broadcastExpiryTimerMirror) {
      broadcastExpiryTimerMirror.textContent = countdown;
    }
  };

  tick();
  window.setInterval(tick, 60 * 1000);
}

if (urgencySelect) {
  urgencySelect.addEventListener("change", updateUrgencyMeter);
  updateUrgencyMeter();
}
updateExpiryBanner();
updateLivePreview();

document
  .querySelector('#broadcastForm [name="title"]')
  ?.addEventListener("input", updateLivePreview);

const broadcastContentField = document.querySelector(
  '#broadcastForm [name="content"]',
);
if (broadcastContentField) {
  broadcastContentField.addEventListener("input", () => {
    clearTimeout(urgencyDebounce);
    urgencyDebounce = setTimeout(async () => {
      const text = broadcastContentField.value.trim();
      if (text.length < 30) {
        document.getElementById("urgencySuggestion")?.remove();
        return;
      }
      try {
        const res = await fetch("/api/ai/suggest-urgency", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (data.urgency && data.urgency !== urgencySelect.value) {
          renderUrgencyChip(data.urgency, data.reason);
        }
      } catch {
        /* silent */
      }
    }, 1200);
  });
}

document
  .querySelector('#broadcastForm [name="content"]')
  ?.addEventListener("input", updateLivePreview);
wrapper?.addEventListener("input", updateLivePreview);
wrapper?.addEventListener("change", updateLivePreview);

if (condoParam) {
  const cleanName = condoParam
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
  setCommunityKey(`comm-${condoParam.toLowerCase()}`);
  wrapper.innerHTML = `
            <input type="text" name="condo" value="${cleanName}" class="modern-input broadcast-readonly" readonly>
        `;
} else {
  let optionsHtml = `<option value="">${i18nText("broadcast.choose_community", "-- Choose a Community --")}</option>`;
  availableCommunities.forEach((c) => {
    optionsHtml += `<option value="${c.name}" data-community-key="${c.key}">${c.name}</option>`;
  });

  wrapper.innerHTML = `
            <select name="condo" id="broadcastCommunitySelect" class="modern-input" required>
                ${optionsHtml}
            </select>
        `;

  const dropdown = document.getElementById("broadcastCommunitySelect");
  if (dropdown) {
    dropdown.addEventListener("change", () => {
      const selected = dropdown.options[dropdown.selectedIndex];
      setCommunityKey(selected?.dataset?.communityKey || "");
      updateLivePreview();
    });
    const selected = dropdown.options[dropdown.selectedIndex];
    setCommunityKey(selected?.dataset?.communityKey || "");
    updateLivePreview();
  }
}

document.getElementById("broadcastForm").onsubmit = async (e) => {
  e.preventDefault();
  const btn = document.getElementById("submitBtn");
  const errorBox = document.getElementById("broadcastError");
  const originalContent = btn.innerHTML;
  let progressStarted = false;

  if (errorBox) {
    errorBox.textContent = "";
    errorBox.hidden = true;
  }

  btn.disabled = true;
  btn.innerHTML = `${i18nText("broadcast.dispatching", "Submitting Broadcast...")}`;

  const formData = new FormData(e.target);
  formData.set("type", "broadcast");
  const submitEndpoint =
    window.ResiHubApi?.ENDPOINTS?.broadcast ||
    "https://api.hubcollective.ca/api/broadcast";
  const submissionId = ensurePageKey();
  if (submissionId) {
    if (pageKeyInput) {
      pageKeyInput.value = submissionId;
    }
    formData.set("page_key", submissionId);
  }

  try {
    window.ResiHubSubmissionProgress?.start(
      i18nText("broadcast.dispatching", "Submitting Broadcast..."),
      i18nText(
        "messages.processing_submission_wait",
        "Please wait while your submission is being processed.",
      ),
    );
    progressStarted = true;
    const response = await fetch(submitEndpoint, {
      method: "POST",
      body: formData,
    });

    const rawResponse = await response.text();
    const responseHasSensitiveData = hasSensitiveRepoDetails(rawResponse);

    if (response.ok) {
      window.ResiHubSubmissionProgress?.complete(
        i18nText("broadcast.broadcast_staged", "Broadcast Staged!"),
        i18nText(
          "messages.submission_completed",
          "The server accepted your submission.",
        ),
      );
      btn.style.background = "#22c55e";
      btn.style.borderColor = "#22c55e";
      btn.innerHTML = `<i class="fa-solid fa-check"></i> ${i18nText("broadcast.broadcast_staged", "Broadcast Staged!")}`;

      setTimeout(() => {
        window.ResiHubSuccessModal.show({
          redirectUrl: resolvePostSubmitRedirectUrl(submissionId),
          submissionId,
          type: "broadcast",
          title: document.querySelector('#broadcastForm [name="title"]')?.value || "",
        });
      }, 1800);
    } else {
      if (responseHasSensitiveData) {
        throw new Error(
          i18nText(
            "messages.repo_details_blocked",
            "Response blocked for security reasons. Please try again.",
          ),
        );
      }

      let message = i18nText(
        "broadcast.submission_failed",
        "Submission failed",
      );
      try {
        const parsed = rawResponse ? JSON.parse(rawResponse) : null;
        if (parsed && typeof parsed.error === "string") {
          message = parsed.error;
        } else if (rawResponse) {
          message = rawResponse;
        }
      } catch (_) {
        if (rawResponse) message = rawResponse;
      }

      throw new Error(message);
    }
  } catch (err) {
    if (progressStarted) {
      window.ResiHubSubmissionProgress?.error(
        i18nText("broadcast.submission_failed", "Submission failed"),
        err?.message ||
          i18nText(
            "broadcast.submission_failed_retry",
            "Submission failed. Please try again.",
          ),
      );
    }
    if (errorBox) {
      errorBox.textContent =
        err?.message ||
        i18nText(
          "broadcast.submission_failed_retry",
          "Submission failed. Please try again.",
        );
      errorBox.hidden = false;
    }
    btn.disabled = false;
    btn.style.background = "#ef4444";
    btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${i18nText("broadcast.retry_submission", "Retry Submission")}`;
    setTimeout(() => {
      btn.style.background = "";
      btn.innerHTML = originalContent;
    }, 3000);
  }
};
