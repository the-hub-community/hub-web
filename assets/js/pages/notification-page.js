/**
 * notification-page.js
 * Handles the community notice form submission with image upload
 */

(function () {
  "use strict";

  // ===== Configuration =====
  const FORM_ID = "notificationForm";
  const SUBMIT_BTN_ID = "submitBtn";
  const ERROR_DISPLAY_ID = "notificationError";
  const EXPIRY_TIMER_ID = "broadcastExpiryTimer";
  const EXPIRY_TIMER_MIRROR_ID = "broadcastExpiryTimerMirror";
  const COMMUNITY_INPUT_ID = "condo";
  const FILE_UPLOAD_ZONE_ID = "fileUploadZone";
  const FILE_INPUT_ID = "screenshotInput";
  const IMAGE_PREVIEW_ID = "imagePreview";
  const PREVIEW_IMAGE_ID = "previewImage";
  const REMOVE_IMAGE_BTN_ID = "removeImageBtn";
  const NOTICE_TITLE_ID = "notice_title";
  const NOTICE_MESSAGE_ID = "messageTextarea";
  const CATEGORY_SELECT_ID = "categorySelect";
  const LIVE_PREVIEW_ID = "livePreviewBody";
  const LIVE_PREVIEW_TITLE_ID = "livePreviewTitle";
  const LIVE_PREVIEW_CATEGORY_ID = "liveCategoryBadge";
  const LIVE_PREVIEW_IMG_ID = "livePreviewImg";
  const LIVE_PREVIEW_IMAGE_SECTION_ID = "livePreviewImage";
  const TITLE_COUNT_ID = "titleCount";
  const MESSAGE_COUNT_ID = "messageCount";
  const SUBMIT_ENDPOINT =
    window.ResiHubApi?.ENDPOINTS?.notification ||
    "https://hub-community-apis.dekumar-ca.workers.dev/api/submit";
  const SUBMIT_FALLBACK_ENDPOINT =
    window.ResiHubApi?.ENDPOINTS?.submit ||
    "https://hub-community-apis.dekumar-ca.workers.dev/api/submit";

  const EXPIRY_HOURS = 48;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const CATEGORY_COLORS = {
    maintenance: "category-maintenance",
    safety: "category-safety",
    policy: "category-policy",
    event: "category-event",
    other: "category-other",
  };

  let communitiesData = null;
  let selectedImageFile = null;
  let expiryInterval = null;

  function ensurePageKey() {
    const pageKeyInput = document.getElementById("pageKeyInput");
    const existing = String(pageKeyInput?.value || "").trim();
    if (existing) return existing;

    const generated =
      window.ResiHubApi?.createSubmissionId?.("notify") ||
      `notify-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

    if (pageKeyInput) {
      pageKeyInput.value = generated;
    }
    return generated;
  }

  // ===== Setup =====
  function setupForm() {
    const form = document.getElementById(FORM_ID);
    if (!form) return console.error("Form not found");

    // Load communities
    loadCommunities();

    // Generate a unique key for this submission
    ensurePageKey();

    // Form submission
    form.addEventListener("submit", handleFormSubmit);

    // Community input
    setupCommunityInput();

    // File upload
    setupFileUpload();

    // Category selector
    setupCategorySelector();

    // Text input listeners
    setupTextInputListeners();

    // Title and message inputs for live preview
    document
      .querySelector(`[name="notice_title"]`)
      ?.addEventListener("input", updateLivePreview);
    document
      .getElementById(NOTICE_MESSAGE_ID)
      ?.addEventListener("input", updateLivePreview);

    // Expiry timer
    updateExpiryTimer();
    expiryInterval = setInterval(updateExpiryTimer, 60000); // Update every minute
  }

  // ===== Communities =====
  function loadCommunities() {
    const scriptTag = document.getElementById("community-data");
    if (!scriptTag) return;
    try {
      communitiesData = JSON.parse(scriptTag.textContent);
      populateCommunitySelect();
      setupAutocomplete();
    } catch (e) {
      console.error("Failed to parse community data:", e);
    }
  }

  function populateCommunitySelect() {
    const communityField = document.getElementById(COMMUNITY_INPUT_ID);
    if (!communityField || communityField.tagName !== "SELECT") return;

    communityField.innerHTML =
      '<option value="">Select a community...</option>';

    (communitiesData || []).forEach((community) => {
      const option = document.createElement("option");
      option.value = community.name || "";
      option.textContent = community.name || "";
      option.dataset.key = community.key || "";
      option.dataset.slug = community.slug || "";
      communityField.appendChild(option);
    });
  }

  function setupAutocomplete() {
    const input = document.getElementById(COMMUNITY_INPUT_ID);
    if (!input) return;
    if (input.tagName === "SELECT") return;

    input.addEventListener("input", (e) => {
      const value = e.target.value.toLowerCase().trim();
      if (!value) return;

      const matches = communitiesData.filter((c) =>
        c.name.toLowerCase().includes(value),
      );

      showCommunityDropdown(matches, input);
    });

    input.addEventListener("focus", () => {
      if (communitiesData) {
        showCommunityDropdown(communitiesData, input);
      }
    });

    input.addEventListener("blur", () => {
      setTimeout(() => {
        const dropdown = document.querySelector(".community-dropdown");
        if (dropdown) dropdown.remove();
      }, 200);
    });
  }

  function showCommunityDropdown(matches, input) {
    let dropdown = document.querySelector(".community-dropdown");
    if (!dropdown) {
      dropdown = document.createElement("div");
      dropdown.className = "community-dropdown";
      input.parentElement.appendChild(dropdown);
    }

    dropdown.innerHTML = matches
      .map(
        (c) => `
      <div class="dropdown-item" data-slug="${c.slug}" data-key="${c.key}">
        ${c.name}
      </div>
    `,
      )
      .join("");

    dropdown.querySelectorAll(".dropdown-item").forEach((item) => {
      item.addEventListener("click", () => {
        input.value = item.textContent;
        document.getElementById("communityKeyInput").value = item.dataset.key;
        document.getElementById("pageKeyInput").value = "";
        dropdown.remove();
        updateLivePreview();
      });
    });
  }

  function setupCommunityInput() {
    const input = document.getElementById(COMMUNITY_INPUT_ID);
    if (input) {
      input.addEventListener("change", (e) => {
        const selectedOption = e.target.selectedOptions?.[0] || null;
        const communityKeyInput = document.getElementById("communityKeyInput");
        const pageKeyInput = document.getElementById("pageKeyInput");
        if (communityKeyInput) {
          communityKeyInput.value = selectedOption?.dataset?.key || "";
        }
        if (pageKeyInput) {
          pageKeyInput.value = "";
          ensurePageKey();
        }
      });
      input.addEventListener("change", updateLivePreview);
    }
  }

  // ===== File Upload =====
  function setupFileUpload() {
    const zone = document.getElementById(FILE_UPLOAD_ZONE_ID);
    const input = document.getElementById(FILE_INPUT_ID);
    const removeBtn = document.getElementById(REMOVE_IMAGE_BTN_ID);

    if (!zone || !input) return;

    // Prevent default drag behavior
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      zone.addEventListener(eventName, preventDefaults, false);
      document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight on drag
    ["dragenter", "dragover"].forEach((eventName) => {
      zone.addEventListener(
        eventName,
        () => zone.classList.add("highlight"),
        false,
      );
    });

    ["dragleave", "drop"].forEach((eventName) => {
      zone.addEventListener(
        eventName,
        () => zone.classList.remove("highlight"),
        false,
      );
    });

    // Handle drop
    zone.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      handleFileSelect(files[0]);
    });

    // Handle click
    zone.addEventListener("click", () => input.click());

    input.addEventListener("change", (e) => {
      if (e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
    });

    // Remove button
    if (removeBtn) {
      removeBtn.addEventListener("click", removeImage);
    }
  }

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleFileSelect(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showError("Please select an image file");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showError(
        `File is too large. Maximum size is 5MB (your file: ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
      );
      return;
    }

    selectedImageFile = file;
    showImagePreview(file);
    updateLivePreview();
  }

  function showImagePreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById(IMAGE_PREVIEW_ID);
      const previewImg = document.getElementById(PREVIEW_IMAGE_ID);
      const livePreviewImg = document.getElementById(LIVE_PREVIEW_IMG_ID);
      const livePreviewSection = document.getElementById(
        LIVE_PREVIEW_IMAGE_SECTION_ID,
      );

      if (preview && previewImg) {
        previewImg.src = e.target.result;
        preview.style.display = "block";
      }

      if (livePreviewImg && livePreviewSection) {
        livePreviewImg.src = e.target.result;
        livePreviewSection.style.display = "block";
      }
    };
    reader.readAsDataURL(file);
  }

  function removeImage() {
    selectedImageFile = null;
    document.getElementById(FILE_INPUT_ID).value = "";
    document.getElementById(IMAGE_PREVIEW_ID).style.display = "none";
    document.getElementById(LIVE_PREVIEW_IMAGE_SECTION_ID).style.display =
      "none";
  }

  // ===== Category Selector =====
  function setupCategorySelector() {
    const select = document.getElementById(CATEGORY_SELECT_ID);
    if (select) {
      select.addEventListener("change", () => {
        updateLivePreview();
        updateCategoryBadge();
      });
      updateCategoryBadge();
    }
  }

  function updateCategoryBadge() {
    const select = document.getElementById(CATEGORY_SELECT_ID);
    const badge = document.getElementById(LIVE_PREVIEW_CATEGORY_ID);
    if (select && badge) {
      const value = select.value;
      const label = select.options[select.selectedIndex].text;
      badge.textContent = label;
      badge.className = `broadcast-live-card__badge ${CATEGORY_COLORS[value] || "category-other"}`;
    }
  }

  // ===== Text Input Listeners =====
  function setupTextInputListeners() {
    const titleInput = document.querySelector(`[name="notice_title"]`);
    const messageInput = document.getElementById(NOTICE_MESSAGE_ID);

    if (titleInput) {
      titleInput.addEventListener("input", (e) => {
        document.getElementById(TITLE_COUNT_ID).textContent =
          e.target.value.length;
      });
    }

    if (messageInput) {
      messageInput.addEventListener("input", (e) => {
        const wordCount = e.target.value
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0).length;
        document.getElementById(MESSAGE_COUNT_ID).textContent = wordCount;
      });
    }
  }

  // ===== Live Preview =====
  function updateLivePreview() {
    const titleInput = document.querySelector(`[name="notice_title"]`);
    const messageInput = document.getElementById(NOTICE_MESSAGE_ID);
    const condoInput = document.getElementById(COMMUNITY_INPUT_ID);
    const preview = document.getElementById(LIVE_PREVIEW_ID);
    const previewTitle = document.getElementById(LIVE_PREVIEW_TITLE_ID);
    const previewCondo = document.querySelector("#livePreviewCondo");

    if (previewTitle)
      previewTitle.textContent =
        titleInput?.value || "No dogs in school premise";
    if (preview)
      preview.textContent =
        messageInput?.value || "Provide details from the official notice...";
    if (previewCondo)
      previewCondo.textContent = condoInput?.value || "Select a community";
  }

  // ===== Expiry Timer =====
  function updateExpiryTimer() {
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + EXPIRY_HOURS);
    const now = new Date();
    const diff = futureDate - now;

    const totalHours = Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const timerText = `${totalHours}h ${String(minutes).padStart(2, "0")}m`;

    document.getElementById(EXPIRY_TIMER_ID).textContent = timerText;
    document.getElementById(EXPIRY_TIMER_MIRROR_ID).textContent = timerText;
  }

  function parseJsonSafe(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function shouldRetryAsWiki(status, errorMessage) {
    const normalized = String(errorMessage || "").toLowerCase();
    return (
      status === 400 &&
      normalized.includes("unsupported submission type") &&
      normalized.includes("notification")
    );
  }

  // ===== Form Submission =====
  async function handleFormSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = document.getElementById(SUBMIT_BTN_ID);
    const titleInput = document.querySelector(`[name="notice_title"]`);
    const messageInput = document.getElementById(NOTICE_MESSAGE_ID);
    const condoInput = document.getElementById(COMMUNITY_INPUT_ID);

    // Validation
    if (!condoInput.value.trim()) {
      showError("Please select a community");
      return;
    }

    if (!titleInput?.value.trim()) {
      showError("Please enter a notice title");
      return;
    }

    if (!messageInput?.value.trim()) {
      showError("Please enter a notice description");
      return;
    }

    const wordCount = messageInput.value
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    if (wordCount > 200) {
      showError("Description must be 200 words or less");
      return;
    }

    // Submit
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<span data-i18n="notification.dispatching">Submitting Notice...</span>';

    try {
      const buildPayload = (type) => {
        const payload = new FormData(form);
        payload.set("type", type);
        payload.set("title", titleInput.value.trim());
        payload.set("content", messageInput.value.trim());
        return payload;
      };

      let response = await fetch(SUBMIT_ENDPOINT, {
        method: "POST",
        body: buildPayload("notification"),
      });

      let raw = await response.text();
      let result = parseJsonSafe(raw) || {};

      // Compatibility fallback for older deployed APIs that do not support
      // notification as a first-class submit type yet.
      if (shouldRetryAsWiki(response.status, result.error)) {
        response = await fetch(SUBMIT_FALLBACK_ENDPOINT, {
          method: "POST",
          body: buildPayload("wiki"),
        });
        raw = await response.text();
        result = parseJsonSafe(raw) || {};
      }

      if (!response.ok) {
        showError(result.error || "Submission failed. Please try again.");
        submitBtn.disabled = false;
        submitBtn.innerHTML =
          '<span data-i18n="notification.submit_for_review">Submit for Review</span>';
        return;
      }

      // Success
      const submissionId =
        result.data?.submission_id || result.submission_id || "";
      handleSuccessfulSubmission(submissionId);
    } catch (error) {
      console.error("Submission error:", error);
      showError("Network error. Please check your connection and try again.");
      submitBtn.disabled = false;
      submitBtn.innerHTML =
        '<span data-i18n="notification.submit_for_review">Submit for Review</span>';
    }
  }

  function handleSuccessfulSubmission(submissionId) {
    const siteBase = String(document.body?.dataset?.baseurl || "")
      .trim()
      .replace(/\/+$/, "");
    const successUrl = `${siteBase}/success.html?type=notification&submission_id=${encodeURIComponent(submissionId)}`;
    window.location.href = successUrl;
  }

  // ===== Error Display =====
  function showError(message) {
    const errorDisplay = document.getElementById(ERROR_DISPLAY_ID);
    if (errorDisplay) {
      errorDisplay.textContent = message;
      errorDisplay.hidden = false;
      errorDisplay.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        errorDisplay.hidden = true;
      }, 5000);
    }
  }

  // ===== Utilities =====
  function generateRequestId() {
    return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===== Initialize =====
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupForm);
  } else {
    setupForm();
  }
})();
