import {
  deepCleanHTML,
  htmlToMarkdown,
  i18nText,
  normalizeImageUrl,
  normalizeYoutubeUrl,
} from "./transformers.js";

const SUBMIT_ENDPOINT =
  window.ResiHubApi?.ENDPOINTS?.submit ||
  "https://hub-worker-api.dekumar-ca.workers.dev/api/submit";
const SUBMIT_TIMEOUT_MS = 30000;
const REPO_DETAIL_PATTERN =
  /(api\.github\.com|github\.com\/|\brepos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i;

function slugifyCommunityName(name) {
  return (name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolvePostSubmitRedirectUrl(submissionId) {
  const currentPagePath = (document.body?.dataset?.pagePath || "").trim();
  // Editor is always on an existing community page.
  const pathMatch = currentPagePath.match(/^content\/([^/]+)\//i);
  return window.ResiHubApi?.buildSuccessPageUrl({
    type: "update",
    community: pathMatch?.[1] || "",
    existing: Boolean(pathMatch?.[1]),
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

function hasSensitiveRepoDetails(raw) {
  if (!raw) return false;
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  return REPO_DETAIL_PATTERN.test(text);
}

function parseJsonSafe(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = SUBMIT_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(
        i18nText(
          "messages.request_timed_out_safe_retry",
          "Request timed out. No changes were saved. Please retry.",
        ),
      );
    }
    throw new Error(
      i18nText(
        "messages.network_error_safe_retry",
        "Network issue occurred. Please retry. Your existing page is unchanged.",
      ),
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleDrawerSubmit(e) {
  e.preventDefault();

  const btn = document.getElementById("sync-btn");
  const drawerSubmissionError = document.getElementById(
    "drawerSubmissionError",
  );
  if (!btn) return;
  if (btn.dataset.submitting === "true") return;

  if (drawerSubmissionError) {
    drawerSubmissionError.textContent = "";
    drawerSubmissionError.style.display = "none";
  }

  const originalText = btn.innerText;
  const requestId = `drawer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let progressStarted = false;
  btn.dataset.submitting = "true";
  btn.disabled = true;
  btn.innerText = i18nText(
    "messages.editing_in_progress",
    "Editing in Progress...",
  );

  try {
    const condo = document.getElementById("condo")?.value?.trim();
    const title = document.getElementById("title")?.value?.trim();
    const type = document.getElementById("type")?.value?.trim() || "wiki";
    const currentPagePath = (document.body?.dataset?.pagePath || "").trim();
    const currentCommunityKey = (
      document.body?.dataset?.communityKey || ""
    ).trim();
    const currentPageKey = (document.body?.dataset?.pageKey || "").trim();

    if (!condo || !title) {
      throw new Error(
        i18nText(
          "messages.community_and_title_required",
          "Community and title are required",
        ),
      );
    }

    const fd = new FormData();
    fd.append("condo", condo);
    fd.append("title", title);
    fd.append("type", type);

    if (currentCommunityKey) {
      fd.append("community_key", currentCommunityKey);
    }
    const submissionId =
      currentPageKey || window.ResiHubApi?.createSubmissionId("page");
    if (submissionId) {
      fd.append("page_key", submissionId);
    }

    if (
      type === "update" &&
      currentPagePath &&
      /\.md$/i.test(currentPagePath)
    ) {
      fd.append("target_path", currentPagePath);
    }

    const sections = document.querySelectorAll(
      "#drawer-sections-container .drawer-section-card",
    );
    const sectionsData = [];
    const seenSectionTexts = new Set();
    let count = 0;

    sections.forEach((sec) => {
      const editor = sec.querySelector(".editor-area");
      const cleanedContent = deepCleanHTML(editor ? editor.innerHTML : "");
      const markdownContent = htmlToMarkdown(cleanedContent);
      const normalizedContent = markdownContent.replace(/\s+/g, " ").trim();
      if (normalizedContent === "") return;

      const normalizedPlainText = normalizedContent
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      if (seenSectionTexts.has(normalizedPlainText)) return;
      seenSectionTexts.add(normalizedPlainText);

      const videoUrl = normalizeYoutubeUrl(
        sec.querySelector(".video-input")?.value || "",
      );
      const alignValue = sec.querySelector(".align-select")?.value || "center";

      fd.append(`section_text_${count}`, markdownContent);
      fd.append(`section_video_${count}`, videoUrl);
      fd.append(`section_align_${count}`, alignValue);

      const sectionData = {
        text: markdownContent,
        video: videoUrl,
        align: alignValue,
      };

      // ── Multi-image picker ─────────────────────────────────
      const pickerEl = sec.querySelector('[data-role="image-picker"]');
      const pickedImages =
        pickerEl && window.ResiHubImagePicker
          ? window.ResiHubImagePicker.getImages(pickerEl)
          : [];

      const imageMeta = [];
      let newImageIdx = 0;

      pickedImages.forEach((img) => {
        if (img.isLocal && img.file instanceof File) {
          fd.append(`section_images_${count}`, img.file);
          imageMeta.push({
            isExisting: false,
            align: img.align || "center",
            alt: img.alt || "",
            order: newImageIdx++,
          });
        } else if (img.url) {
          imageMeta.push({
            isExisting: true,
            url: img.url,
            align: img.align || "center",
            alt: img.alt || "",
            order: newImageIdx++,
          });
        }
      });

      // ── Legacy fallback: old single-image sections ─────────
      if (!imageMeta.length) {
        const legacyFile = sec.querySelector(".file-input");
        const legacyPath = sec.querySelector(".existing-image-path");
        if (legacyFile && legacyFile.files[0]) {
          fd.append(`section_image_${count}`, legacyFile.files[0]);
          sectionData.image = legacyFile.files[0].name;
        } else if (legacyPath) {
          const normalizedImage = normalizeImageUrl(legacyPath.value);
          if (normalizedImage) {
            fd.append(`section_image_url_${count}`, normalizedImage);
            sectionData.image_url = normalizedImage;
          }
        }
      } else {
        // Send the metadata as JSON so the Worker can rebuild the gallery
        fd.append(`section_images_meta_${count}`, JSON.stringify(imageMeta));
        sectionData.images_meta = imageMeta;
      }

      sectionsData.push(sectionData);
      count++;
    });

    if (count === 0) {
      throw new Error(
        i18nText(
          "messages.at_least_one_section_required",
          "At least one section with content is required",
        ),
      );
    }

    fd.append("section_count", count);
    fd.append("sections_json", JSON.stringify(sectionsData));

    const payloadSummary = [];
    for (const [key, value] of fd.entries()) {
      if (value instanceof File) {
        payloadSummary.push({
          key,
          file: true,
          name: value.name,
          size: value.size,
          type: value.type,
        });
      } else {
        const raw = String(value);
        payloadSummary.push({
          key,
          value: raw.length > 220 ? `${raw.slice(0, 220)}...` : raw,
        });
      }
    }

    // ── Moderation check ──────────────────────────────────────
    const combinedText = sectionsData
      .map((s) =>
        String(s.text || "")
          .replace(/<[^>]+>/g, " ")
          .trim(),
      )
      .filter(Boolean)
      .join("\n\n");

    const verdict = await window.ResiHubModeration?.check(combinedText, {
      context: "wiki",
    });

    if (verdict && !verdict.ok) {
      throw new Error(verdict.blockMessage || "This content can't be posted.");
    }

    if (verdict && verdict.warnMessage) {
      window.ResiHubModerationHint?.show(verdict.warnMessage);
    }

    if (verdict && verdict.flagged) {
      fd.append("moderation_flag", verdict.flagReason || "auto");
    }
    // ── End moderation check ──────────────────────────────────

    window.ResiHubSubmissionProgress?.start(
      i18nText("messages.editing_in_progress", "Editing in Progress..."),
      i18nText(
        "messages.processing_submission_wait",
        "Please wait while your submission is being processed.",
      ),
    );
    progressStarted = true;

    const res = await fetchWithTimeout(
      SUBMIT_ENDPOINT,
      {
        method: "POST",
        body: fd,
      },
      SUBMIT_TIMEOUT_MS,
    );

    const rawResponse = await res.text();
    const responseHasSensitiveData = hasSensitiveRepoDetails(rawResponse);

    if (!res.ok) {
      let message = i18nText(
        "messages.server_error_try_again",
        "Server error ({status}). Please try again.",
      ).replace("{status}", res.status);

      if (!responseHasSensitiveData) {
        const parsed = parseJsonSafe(rawResponse);
        if (parsed && typeof parsed.error === "string" && parsed.error.trim()) {
          message = parsed.error;
        }
      } else {
        message = i18nText(
          "messages.repo_details_blocked",
          "Response blocked for security reasons. Please try again.",
        );
      }

      throw new Error(message);
    }

    // Hard policy: never expose potentially sensitive repo/GitHub fields.
    // On success we ignore payload content entirely.

    window.ResiHubSubmissionProgress?.complete(
      i18nText("messages.synced_success", "✓ Sent for review!"),
      i18nText(
        "messages.submission_completed",
        "The server accepted your submission.",
      ),
    );

    localStorage.removeItem("editor-draft");

    btn.innerText = i18nText("messages.synced_success", "✓ Sent for review!");
    btn.style.backgroundColor = "#059669";

    setTimeout(() => {
      window.ResiHubSuccessModal.show({
        redirectUrl: resolvePostSubmitRedirectUrl(submissionId),
        submissionId,
      });
    }, 1500);
  } catch (err) {
    // console.error(`[drawer-submit:${requestId}] Sync Error:`, err);
    if (progressStarted) {
      window.ResiHubSubmissionProgress?.error(
        i18nText(
          "messages.failed_sync_try_again",
          "Failed to sync. Please try again.",
        ),
        String(err?.message || "Submission failed."),
      );
    }
    btn.disabled = false;
    btn.innerText = originalText;
    const errorMsg =
      err.message ||
      i18nText(
        "messages.failed_sync_try_again",
        "Failed to sync. Please try again.",
      );
    if (drawerSubmissionError) {
      drawerSubmissionError.textContent = errorMsg;
      drawerSubmissionError.style.display = "block";
    } else {
      alert(`❌ ${errorMsg}`);
    }
  } finally {
    btn.dataset.submitting = "false";
  }
}

export function initDrawerSubmit() {
  const drawerForm = document.getElementById("drawer-form");
  if (!drawerForm) return;
  drawerForm.addEventListener("submit", handleDrawerSubmit);
}
