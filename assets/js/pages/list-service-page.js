const imageInput = document.getElementById("imageInput");
const fileError = document.getElementById("fileError");
const listingSubmissionError = document.getElementById(
  "listingSubmissionError",
);
const fileNamesDisplay = document.getElementById("fileNamesDisplay");
const marketplaceCommunitySelect = document.getElementById(
  "marketplaceCommunitySelect",
);
const marketplaceCommunityKey = document.getElementById(
  "marketplaceCommunityKey",
);
const REPO_DETAIL_PATTERN =
  /(api\.github\.com|github\.com\/|\brepos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i;

function syncMarketplaceCommunityKey() {
  if (!marketplaceCommunitySelect || !marketplaceCommunityKey) return;
  const selected =
    marketplaceCommunitySelect.options[
      marketplaceCommunitySelect.selectedIndex
    ];
  marketplaceCommunityKey.value = (selected?.dataset?.communityKey || "")
    .trim()
    .toLowerCase();
}

syncMarketplaceCommunityKey();
if (marketplaceCommunitySelect) {
  marketplaceCommunitySelect.addEventListener(
    "change",
    syncMarketplaceCommunityKey,
  );
}

function i18nText(key, fallback) {
  if (typeof window.t === "function") {
    return window.t(key, fallback);
  }
  return fallback;
}

function hasSensitiveRepoDetails(raw) {
  if (!raw) return false;
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  return REPO_DETAIL_PATTERN.test(text);
}

function slugifyCommunityName(name) {
  return (name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolvePostSubmitRedirectUrl(submissionId) {
  // Attach community if one is selected from the dropdown.
  const selectedCondo =
    document.querySelector('select[name="condo"]')?.value || "";
  const condoSlug = slugifyCommunityName(selectedCondo);
  return window.ResiHubApi?.buildSuccessPageUrl({
    type: "listing",
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

// Handle multi-file selection display (Chips)
imageInput.onchange = function () {
  fileError.innerHTML = "";
  fileNamesDisplay.innerHTML = "";

  const selectedFiles = Array.from(this.files);

  if (selectedFiles.length === 0) return;

  if (selectedFiles.length > 4) {
    fileError.innerHTML = i18nText(
      "list_service.max_images_error",
      "Maximum 4 images allowed. You selected {count}.",
    ).replace("{count}", selectedFiles.length);
    this.value = "";
    return;
  }

  selectedFiles.forEach((file) => {
    if (file.size > 2 * 1024 * 1024) {
      fileError.innerHTML = i18nText(
        "list_service.file_too_large_error",
        '"{name}" is too heavy (>2MB).',
      ).replace("{name}", file.name);
      this.value = "";
      fileNamesDisplay.innerHTML = "";
      return;
    }

    const chip = document.createElement("div");
    chip.className = "file-chip";
    chip.innerHTML = `<i class="fa-solid fa-image"></i> ${file.name}`;
    fileNamesDisplay.appendChild(chip);
  });

  // After each successful upload (in the success handler of marketplaceForm.onsubmit)
  // OR after file selection for immediate preview + alt-text generation:

  async function previewAndCacheAltText(file) {
    // Show local preview
    const previewUrl = URL.createObjectURL(file);
    const chip = document.createElement("div");
    chip.className = "file-chip file-chip--preview";
    chip.innerHTML = `
      <img src="${previewUrl}" alt="" class="file-chip__thumb">
      <span class="file-chip__name">${file.name}</span>
      <span class="file-chip__alt-status" aria-live="polite">Generating alt text…</span>
    `;
    fileNamesDisplay.appendChild(chip);

    // Upload to R2 first (via existing worker path), then call alt-text
    // OR for lazy generation: call after image_url is returned from submission
    // For P0, defer to post-upload:
    return chip;
  }
};

// ── Drop zone wiring ─────────────────────────────────────────
// The input is `hidden`, so clicks on the visible zone must be
// forwarded to it. Also handles drag-and-drop, which the label
// "Click or drag to upload" promises.
(function initFileDropZone() {
  const zone = document.getElementById("fileDropZone");
  if (!zone || !imageInput) return;

  // Click → open picker. Skip when the user clicked the input itself
  // (defensive: avoids recursion if the input is ever un-hidden).
  zone.addEventListener("click", (event) => {
    if (event.target === imageInput) return;
    imageInput.click();
  });

  // Keyboard: Enter / Space on the focused zone should also open.
  zone.setAttribute("tabindex", "0");
  zone.setAttribute("role", "button");
  zone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      imageInput.click();
    }
  });

  // Drag visuals
  ["dragenter", "dragover"].forEach((evt) => {
    zone.addEventListener(evt, (event) => {
      event.preventDefault();
      event.stopPropagation();
      zone.classList.add("is-dragging");
    });
  });

  ["dragleave", "dragend", "drop"].forEach((evt) => {
    zone.addEventListener(evt, (event) => {
      event.preventDefault();
      event.stopPropagation();
      zone.classList.remove("is-dragging");
    });
  });

  // Drop → hand files to the input, then fire the change handler.
  zone.addEventListener("drop", (event) => {
    const dt = event.dataTransfer;
    if (!dt || !dt.files || !dt.files.length) return;
    imageInput.files = dt.files;
    imageInput.dispatchEvent(new Event("change", { bubbles: true }));
  });
})();

// Handle Form Submission
document.getElementById("marketplaceForm").onsubmit = async (e) => {
  e.preventDefault();
  const btn = document.getElementById("submitBtn");
  const form = e.target;
  let progressStarted = false;

  if (listingSubmissionError) {
    listingSubmissionError.textContent = "";
    listingSubmissionError.style.display = "none";
  }

  // Create new FormData and manually append to ensure 'getAll' works in Worker
  const formData = new FormData();

  // 1. Add regular fields
  const inputs = form.querySelectorAll(
    'input:not([type="file"]), select, textarea',
  );
  inputs.forEach((input) => {
    formData.append(input.name, input.value);
  });

  // 2. Add EACH file specifically to the 'image' key
  const files = imageInput.files;
  for (let i = 0; i < files.length; i++) {
    formData.append("image", files[i]);
  }

  const submissionId = window.ResiHubApi?.createSubmissionId("listing");
  if (submissionId) {
    formData.append("page_key", submissionId);
  }

  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${i18nText("list_service.uploading_images", "Uploading {count} images...").replace("{count}", files.length)}`;

  try {
    window.ResiHubSubmissionProgress?.start(
      i18nText(
        "list_service.uploading_images",
        "Uploading {count} images...",
      ).replace("{count}", files.length),
      i18nText(
        "messages.processing_submission_wait",
        "Please wait while your submission is being processed.",
      ),
    );
    progressStarted = true;
    const submitEndpoint =
      window.ResiHubApi?.ENDPOINTS?.submit ||
      "https://api.hubcollective.ca/api/submit";
    const response = await fetch(submitEndpoint, {
      method: "POST",
      body: formData,
    });

    const rawResponse = await response.text();
    const responseHasSensitiveData = hasSensitiveRepoDetails(rawResponse);

    if (response.ok) {
      window.ResiHubSubmissionProgress?.complete(
        i18nText("list_service.posted_successfully", "Posted Successfully!"),
        i18nText(
          "messages.submission_completed",
          "The server accepted your submission.",
        ),
      );
      btn.innerHTML = `<i class="fa-solid fa-check"></i> ${i18nText("list_service.posted_successfully", "Posted Successfully!")}`;
      btn.style.background = "#28a745";
      setTimeout(() => {
        window.ResiHubSuccessModal.show({
          redirectUrl: resolvePostSubmitRedirectUrl(submissionId),
          submissionId,
        });
      }, 1500);
    } else {
      if (responseHasSensitiveData) {
        throw new Error(
          i18nText(
            "messages.repo_details_blocked",
            "Response blocked for security reasons. Please try again.",
          ),
        );
      }

      let errText = i18nText("list_service.upload_failed", "Upload failed");
      try {
        const parsed = rawResponse ? JSON.parse(rawResponse) : null;
        if (parsed && typeof parsed.error === "string") {
          errText = parsed.error;
        } else if (rawResponse) {
          errText = rawResponse;
        }
      } catch (_) {
        if (rawResponse) errText = rawResponse;
      }

      throw new Error(errText || "Upload failed");
    }
  } catch (err) {
    if (progressStarted) {
      window.ResiHubSubmissionProgress?.error(
        i18nText("messages.error_try_again", "Error - Try Again"),
        err?.message || "Upload failed",
      );
    }
    btn.disabled = false;
    btn.innerHTML = i18nText("messages.error_try_again", "Error - Try Again");
    if (listingSubmissionError) {
      listingSubmissionError.textContent = `${i18nText("list_service.server_error_prefix", "Server Error:")} ${err.message}`;
      listingSubmissionError.style.display = "block";
    }
  }
};
