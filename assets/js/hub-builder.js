/**
 * LocalityHub Builder - Production Logic
 * Ensures clean HTML for Jekyll/Kramdown compatibility.
 */

document.execCommand("defaultParagraphSeparator", false, "p");
let sectionCount = 0;
let previewObjectUrls = [];
let availableCommunities = [];
let currentSubmissionLayout = "content";

const REPO_DETAIL_PATTERN =
  /(api\.github\.com|github\.com\/|\brepos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i;

function i18nText(key, fallback) {
  if (typeof window.t === "function") {
    return window.t(key, fallback);
  }
  return fallback;
}

// Expose i18nText globally so other scripts can access it
window.i18nText = i18nText;

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

function slugifyCommunityName(name) {
  return (name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCommunityName(name) {
  return (name || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseReviewLines(rawValue) {
  return sanitizeReviewText(rawValue, { keepLineBreaks: true })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function sanitizeReviewText(rawValue, options = {}) {
  const { keepLineBreaks = false } = options;

  const normalized = String(rawValue || "").replace(/\r\n?/g, "\n");

  // Strip any pasted HTML tags while preserving visible text.
  const withoutTags = normalized.replace(/<[^>]*>/g, " ");

  // Decode entities if user pasted encoded HTML fragments.
  const decoder = document.createElement("textarea");
  decoder.innerHTML = withoutTags;
  const decoded = decoder.value || "";

  if (keepLineBreaks) {
    return decoded
      .split("\n")
      .map((line) =>
        line
          .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]+/g, " ")
          .trim(),
      )
      .join("\n")
      .trim();
  }

  return decoded
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function starsFromRating(value) {
  const rating = Math.max(1, Math.min(5, Number(value) || 0));
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

function toTitleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderPreview() {
  generatePreview();
}

function switchView(view) {
  const editorView = document.getElementById("editor-view");
  const previewView = document.getElementById("preview-view");
  const editBtn = document.getElementById("edit-view-btn");
  const previewBtn = document.getElementById("preview-view-btn");

  if (view === "preview") {
    editorView?.classList.add("hidden");
    previewView?.classList.remove("hidden");
    previewView?.classList.add("active");
    editBtn?.classList.remove("active");
    previewBtn?.classList.add("active");
    renderPreview();
  } else {
    editorView?.classList.remove("hidden");
    previewView?.classList.add("hidden");
    previewView?.classList.remove("active");
    editBtn?.classList.add("active");
    previewBtn?.classList.remove("active");
  }
}
function loadCommunityCatalog() {
  const dataEl = document.getElementById("community-data");
  if (!dataEl) return [];

  const parsed = parseJsonSafe(dataEl.textContent) || [];
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => {
      const slug = slugifyCommunityName(item?.slug || item?.name || "");
      const name = String(item?.name || "").trim();
      const key = String(item?.key || "")
        .trim()
        .toLowerCase();
      if (!name || !slug) return null;
      return {
        name,
        slug,
        key: key || `comm-${slug}`,
      };
    })
    .filter(Boolean);
}

function syncSelectedCommunityToHiddenField() {
  const communitySelect = document.getElementById("communitySelect");
  const newCommunityGroup = document.getElementById("newCommunityGroup");
  const newCommunityInput = document.getElementById("newCommunityInput");
  const condoInput = document.getElementById("condoInput");
  const communityKeyInput = document.getElementById("communityKeyInput");
  if (!communitySelect || !condoInput || !communityKeyInput) return;

  const selectedValue = communitySelect.value || "";

  if (selectedValue === "__other__") {
    if (newCommunityGroup) {
      newCommunityGroup.classList.remove("hidden");
      newCommunityGroup.style.display = "block";
    }
    if (newCommunityInput) {
      newCommunityInput.required = true;
      condoInput.value = newCommunityInput.value.trim();
      newCommunityInput.focus();
    }
    communityKeyInput.value = "";
    return;
  }

  if (newCommunityGroup) {
    newCommunityGroup.classList.add("hidden");
    newCommunityGroup.style.display = "none";
  }
  if (newCommunityInput) {
    newCommunityInput.required = false;
    newCommunityInput.value = "";
  }

  if (!selectedValue) {
    condoInput.value = "";
    communityKeyInput.value = "";
    return;
  }

  const selected = availableCommunities.find(
    (item) => item.slug === selectedValue,
  );
  if (!selected) {
    condoInput.value = "";
    communityKeyInput.value = "";
    return;
  }

  condoInput.value = selected.name;
  communityKeyInput.value = selected.key;
}

function initCommunitySelector() {
  const communitySelect = document.getElementById("communitySelect");
  const newCommunityGroup = document.getElementById("newCommunityGroup");
  const newCommunityInput = document.getElementById("newCommunityInput");
  if (!communitySelect) return;

  if (newCommunityGroup) {
    newCommunityGroup.classList.add("hidden");
    newCommunityGroup.style.display = "none";
  }

  availableCommunities = loadCommunityCatalog().sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  communitySelect.innerHTML = "";

  const chooseOption = document.createElement("option");
  chooseOption.value = "";
  chooseOption.selected = true;
  chooseOption.textContent = i18nText(
    "submit.choose_community",
    "Choose a Community",
  );
  communitySelect.appendChild(chooseOption);

  availableCommunities.forEach((community) => {
    const option = document.createElement("option");
    option.value = community.slug;
    option.textContent = community.name;
    option.dataset.communityKey = community.key;
    communitySelect.appendChild(option);
  });

  const otherOption = document.createElement("option");
  otherOption.value = "__other__";
  otherOption.textContent = i18nText(
    "submit.other_community",
    "Other (Create New Community)",
  );
  communitySelect.appendChild(otherOption);

  communitySelect.addEventListener(
    "change",
    syncSelectedCommunityToHiddenField,
  );

  if (newCommunityInput) {
    newCommunityInput.addEventListener("input", () => {
      const condoInput = document.getElementById("condoInput");
      if (condoInput) condoInput.value = newCommunityInput.value.trim();
    });
  }

  syncSelectedCommunityToHiddenField();
}

function setSubmissionLayout(layout) {
  currentSubmissionLayout = layout === "review" ? "review" : "content";

  const layoutInput = document.getElementById("submissionLayoutInput");
  if (layoutInput) {
    layoutInput.value = currentSubmissionLayout;
  }

  document.querySelectorAll(".layout-btn").forEach((btn) => {
    const isActive = btn.dataset.layout === currentSubmissionLayout;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  const reviewBuilder = document.getElementById("review-builder");
  const sectionsContainer = document.getElementById("sections-container");
  const addSectionBtn = document.getElementById("add-section-btn");

  reviewBuilder?.classList.toggle(
    "hidden",
    currentSubmissionLayout !== "review",
  );
  sectionsContainer?.classList.toggle(
    "hidden",
    currentSubmissionLayout !== "content",
  );
  addSectionBtn?.classList.toggle(
    "hidden",
    currentSubmissionLayout !== "content",
  );
}

function initSubmissionLayoutToggle() {
  document.querySelectorAll(".layout-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setSubmissionLayout(btn.dataset.layout || "content");
    });
  });

  setSubmissionLayout("content");
}

function resolvePostSubmitRedirectUrl(submissionId) {
  const selectedCommunityKey = (
    document.getElementById("communityKeyInput")?.value || ""
  )
    .trim()
    .toLowerCase();
  const selectedCommunityMatch =
    selectedCommunityKey.match(/^comm-([a-z0-9-]+)$/);
  return window.ResiHubApi?.buildSuccessPageUrl({
    type: "wiki",
    community: selectedCommunityMatch?.[1] || "",
    existing: Boolean(selectedCommunityMatch?.[1]),
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

  const goNext = () => {
    window.location.href = redirectUrl || resolvePostSubmitRedirectUrl();
  };

  overlay.addEventListener("click", goNext);
  document.body.appendChild(overlay);
}

document.addEventListener("DOMContentLoaded", () => {
  initCommunitySelector();
  addSection();
  initSubmissionLayoutToggle();

  document.addEventListener("click", handleGlobalClicks);
  document.addEventListener("toggle", handleSectionPanelToggle, true);
  document.addEventListener("selectionchange", handleToolbarSelectionChange);
  document.addEventListener("focusin", handleToolbarFocusChange);
  document.addEventListener("keyup", handleToolbarKeyup, true);

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  const form = document.getElementById("submissionForm");
  if (form) form.addEventListener("submit", handleFormSubmit);

  // Ensure defaultParagraphSeparator is set for all editor-area (for mobile)
  function setDefaultParagraphSeparatorForEditors() {
    document.querySelectorAll(".editor-area").forEach((el) => {
      try {
        document.execCommand("defaultParagraphSeparator", false, "p");
      } catch (e) {}
    });
  }
  setDefaultParagraphSeparatorForEditors();

  // Fix Enter/Return on mobile for editor-area
  document.addEventListener("keydown", function (e) {
    if (!e.target.classList || !e.target.classList.contains("editor-area"))
      return;
    if (e.key === "Enter" && !e.shiftKey) {
      // On mobile, some browsers do not insert a new line. Try to force it.
      setTimeout(() => {
        // If caret is at end and no new block created, insert <br>
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          // If parent is editor-area and no block, insert <br>
          if (
            range.startContainer === e.target ||
            (range.startContainer.nodeType === 3 &&
              range.startContainer.parentNode === e.target)
          ) {
            document.execCommand("insertHTML", false, "<br>");
          }
        }
      }, 0);
    }
  });

  // When a new section is added, set defaultParagraphSeparator for its editor
  const origAddSection = window.addSection;
  window.addSection = function () {
    if (origAddSection) origAddSection();
    setDefaultParagraphSeparatorForEditors();
  };
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    syncSelectedCommunityToHiddenField();
  }
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function unwrapEncodedCodeBlocks(html) {
  return html.replace(
    /<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_, inner) => decodeHtmlEntities(inner.trim()),
  );
}

function deepCleanHTML(html) {
  if (
    !html ||
    html.trim() === "" ||
    html === "<br>" ||
    html === "<p><br></p>"
  ) {
    return "";
  }

  const parser = new DOMParser();
  const parseHtml = (source) => {
    const doc = parser.parseFromString(source, "text/html");
    doc.querySelectorAll("*").forEach((el) => {
      while (el.attributes.length > 0) {
        el.removeAttribute(el.attributes[0].name);
      }
    });
    return doc.body.innerHTML;
  };

  let clean = unwrapEncodedCodeBlocks(html).trim();

  if (clean.includes("&lt;") && clean.includes("&gt;")) {
    clean = decodeHtmlEntities(clean);
  }

  clean = clean
    .replace(/<section\b[^>]*>/gi, "")
    .replace(/<\/section>/gi, "")
    .replace(
      /<p>\s*&lt;\/?(div|section|p|span|br|strong|em|ul|ol|li|iframe|img)[^>]*&gt;\s*<\/p>/gi,
      "",
    )
    .replace(/^[ \t]+/gm, "")
    .replace(/\n[ \t]+/g, "\n")
    .trim();

  clean = parseHtml(clean);

  clean = clean
    .replace(/<p>\s*<ul/gi, "<ul")
    .replace(/<\/ul>\s*<\/p>/gi, "</ul>")
    .replace(/<p>\s*<ol/gi, "<ol")
    .replace(/<\/ol>\s*<\/p>/gi, "</ol>")
    .replace(/<p>(?:\s|&nbsp;|<br\s*\/?\>)*<\/p>/gi, "")
    .replace(/<p><\/p>/gi, "")
    .trim();

  return clean;
}

// Expose deepCleanHTML globally so other scripts can access it
window.deepCleanHTML = deepCleanHTML;

function htmlToMarkdown(html) {
  if (!html || html.trim() === "") return "";

  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?div[^>]*>/gi, "")
    .replace(/<\/?span[^>]*>/gi, "")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i>(.*?)<\/i>/gi, "*$1*")
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    .replace(/<ul[^>]*>/gi, "")
    .replace(/<\/ul>/gi, "\n")
    .replace(/<ol[^>]*>/gi, "")
    .replace(/<\/ol>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

function addSection() {
  const container = document.getElementById("sections-container");
  const template = document.getElementById("section-template");
  if (!template || !container) return;

  const clone = template.content.cloneNode(true);
  const section = clone.querySelector(".content-section");

  section.dataset.index = sectionCount;
  section.querySelector(".section-label").textContent =
    `${i18nText("messages.section_prefix", "Section #")}${sectionCount + 1}`;

  const toolbarShell = section.querySelector(".rich-toolbar-shell");
  if (toolbarShell) {
    toolbarShell.open = !window.matchMedia("(max-width: 768px)").matches;
  }

  const fileInput = section.querySelector(".file-input");
  if (fileInput) fileInput.name = `section_image_${sectionCount}`;

  container.appendChild(clone);
  if (typeof window.applyTranslations === "function") {
    window.applyTranslations(container);
  }
  sectionCount += 1;
}

function handleGlobalClicks(e) {
  const target = e.target.closest("button");
  if (!target) return;

  if (target.dataset.cmd) {
    e.preventDefault();
    document.execCommand(target.dataset.cmd, false, null);
    const section = target.closest(".content-section");
    const editor = section?.querySelector(".editor-area");
    if (editor) {
      editor.focus();
      updateToolbarState(editor);
    }
  }

  if (target.classList.contains("remove-section")) {
    const sections = document.querySelectorAll(".content-section");
    if (sections.length > 1) target.closest(".content-section")?.remove();
  }

  if (target.id === "add-section-btn") addSection();
}

function handleSectionPanelToggle(e) {
  const panel = e.target;
  if (!panel.classList?.contains("section-settings-panel") || !panel.open) {
    return;
  }

  document.querySelectorAll(".section-settings-panel[open]").forEach((item) => {
    if (item !== panel) {
      item.open = false;
    }
  });
}

function handleToolbarSelectionChange() {
  const activeEditor = document.activeElement;
  if (!activeEditor?.classList?.contains("editor-area")) return;
  updateToolbarState(activeEditor);
}

function handleToolbarFocusChange(e) {
  if (!e.target?.classList?.contains("editor-area")) return;
  updateToolbarState(e.target);
}

function handleToolbarKeyup(e) {
  if (!e.target?.classList?.contains("editor-area")) return;
  updateToolbarState(e.target);
}

function updateToolbarState(editor) {
  const toolbar = editor
    .closest(".content-section")
    ?.querySelector(".rich-toolbar");
  if (!toolbar) return;

  ["bold", "italic", "underline"].forEach((command) => {
    const button = toolbar.querySelector(`button[data-cmd="${command}"]`);
    if (!button) return;

    let isActive = false;
    try {
      isActive = document.queryCommandState(command);
    } catch (_) {
      isActive = false;
    }

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

document.addEventListener("paste", (e) => {
  if (e.target.classList.contains("editor-area")) {
    e.preventDefault();
    const text = (e.originalEvent || e).clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }
});

async function handleFormSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("submitBtn");
  const submissionError = document.getElementById("submissionError");
  const originalText = btn.innerText;
  let progressStarted = false;

  if (submissionError) {
    submissionError.textContent = "";
    submissionError.classList.add("hidden");
  }

  btn.disabled = true;
  btn.innerText = i18nText(
    "messages.submitting_for_review",
    "Submitting for Review",
  );

  const sectionsData = [];
  const seenSectionTexts = new Set();

  if (currentSubmissionLayout === "review") {
    const reviewKind = document.getElementById("reviewKind")?.value || "other";
    const reviewSubject = sanitizeReviewText(
      document.getElementById("reviewSubject")?.value || "",
    );
    const reviewRating = document.getElementById("reviewRating")?.value || "3";
    const reviewVerdict =
      document.getElementById("reviewVerdict")?.value || "maybe";
    const reviewSummary = sanitizeReviewText(
      document.getElementById("reviewSummary")?.value || "",
    );
    const reviewImageAlign =
      document.getElementById("reviewImageAlign")?.value || "center";
    const reviewPros = parseReviewLines(
      document.getElementById("reviewPros")?.value || "",
    );
    const reviewCons = parseReviewLines(
      document.getElementById("reviewCons")?.value || "",
    );

    if (!reviewSubject) {
      throw new Error("Please enter what you are reviewing.");
    }
    if (!reviewSummary) {
      throw new Error("Please add a short review summary.");
    }

    const verdictLabelMap = {
      yes: "Recommended",
      maybe: "Recommended with caveats",
      no: "Not recommended",
    };
    const verdictLabel =
      verdictLabelMap[reviewVerdict] || "Recommended with caveats";
    const ratingStars = starsFromRating(reviewRating);

    const reviewMarkdownParts = [
      `## Review: ${reviewSubject}`,
      `**Type:** ${toTitleCase(reviewKind)}`,
      `**Rating:** ${reviewRating}/5 (${ratingStars})`,
      `**Verdict:** ${verdictLabel}`,
      "",
      "### Summary",
      reviewSummary,
      "",
      "### Pros",
      reviewPros.length
        ? reviewPros.map((item) => `- ${item}`).join("\n")
        : "- No clear strengths were listed.",
      "",
      "### Cons",
      reviewCons.length
        ? reviewCons.map((item) => `- ${item}`).join("\n")
        : "- No clear weaknesses were listed.",
    ];

    const reviewMarkdown = reviewMarkdownParts.join("\n").trim();

    sectionsData.push({
      text: reviewMarkdown,
      video: "",
      align: reviewImageAlign,
    });
  } else {
    const sectionsPromises = Array.from(
      document.querySelectorAll(".content-section"),
    ).map(async (sec) => {
      const editor = sec.querySelector(".editor-area");
      const videoUrl =
        sec.querySelector('input[name="section_video[]"]')?.value || "";
      const align =
        sec.querySelector('select[name="section_align[]"]')?.value || "center";
      const fileInput = sec.querySelector('input[name="section_image[]"]');
      let imageBase64 = "";
      if (fileInput && fileInput.files.length > 0) {
        imageBase64 = await fileToBase64(fileInput.files[0]);
      }

      const cleanedContent = deepCleanHTML(editor.innerHTML);
      const markdownContent = htmlToMarkdown(cleanedContent);
      const normalizedContent = markdownContent.replace(/\s+/g, " ").trim();
      if (normalizedContent === "") {
        const hiddenInput = sec.querySelector('input[name="section_text[]"]');
        if (hiddenInput) hiddenInput.value = "";
        return null;
      }

      const normalizedPlainText = normalizedContent
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      if (seenSectionTexts.has(normalizedPlainText)) {
        const hiddenInput = sec.querySelector('input[name="section_text[]"]');
        if (hiddenInput) hiddenInput.value = "";
        return null;
      }

      seenSectionTexts.add(normalizedPlainText);
      const hiddenInput = sec.querySelector('input[name="section_text[]"]');
      if (hiddenInput) {
        hiddenInput.value = markdownContent;
      }

      return {
        text: markdownContent,
        video: videoUrl,
        align,
        image: imageBase64,
      };
    });

    const sectionsResults = await Promise.all(sectionsPromises);
    sectionsData.push(...sectionsResults.filter(Boolean));
  }

  try {
    const selectedCommunity =
      document.getElementById("communitySelect")?.value || "";
    const condoValue = (
      document.getElementById("condoInput")?.value || ""
    ).trim();

    if (!selectedCommunity) {
      throw new Error(
        i18nText(
          "messages.community_selection_required",
          "Please choose an existing community or select Other.",
        ),
      );
    }

    if (selectedCommunity === "__other__" && !condoValue) {
      throw new Error(
        i18nText(
          "messages.new_community_name_required",
          "Please enter a new community name.",
        ),
      );
    }

    if (selectedCommunity === "__other__") {
      const inputNormalized = normalizeCommunityName(condoValue);
      const existingMatch = availableCommunities.find(
        (item) =>
          normalizeCommunityName(item.name) === inputNormalized ||
          item.slug === slugifyCommunityName(condoValue),
      );
      if (existingMatch) {
        throw new Error(
          i18nText(
            "messages.community_name_exists_select_existing",
            "This community already exists. Please select it from the dropdown.",
          ),
        );
      }
    }

    const formData = new FormData(e.target);
    const selectedCommunityKey = (
      document.getElementById("communityKeyInput")?.value || ""
    ).trim();
    const currentCommunityKey = (
      document.body?.dataset?.communityKey || ""
    ).trim();
    const currentPageKey = (document.body?.dataset?.pageKey || "").trim();

    if (selectedCommunityKey) {
      formData.set("community_key", selectedCommunityKey);
    } else if (currentCommunityKey) {
      formData.set("community_key", currentCommunityKey);
    }

    const submissionId =
      currentPageKey || window.ResiHubApi?.createSubmissionId("page");
    if (submissionId) {
      formData.set("page_key", submissionId);
    }

    formData.set("submission_layout", currentSubmissionLayout);
    formData.append("sections_json", JSON.stringify(sectionsData));

    if (currentSubmissionLayout === "review") {
      const reviewSubject = sanitizeReviewText(
        document.getElementById("reviewSubject")?.value || "",
      );
      const reviewSummary = sanitizeReviewText(
        document.getElementById("reviewSummary")?.value || "",
      );
      const reviewPros = parseReviewLines(
        document.getElementById("reviewPros")?.value || "",
      );
      const reviewCons = parseReviewLines(
        document.getElementById("reviewCons")?.value || "",
      );

      const reviewPayload = {
        kind: document.getElementById("reviewKind")?.value || "other",
        subject: reviewSubject,
        rating: document.getElementById("reviewRating")?.value || "3",
        recommend: document.getElementById("reviewVerdict")?.value || "maybe",
        image_align:
          document.getElementById("reviewImageAlign")?.value || "center",
        summary: reviewSummary,
        pros: reviewPros,
        cons: reviewCons,
      };
      formData.append("review_json", JSON.stringify(reviewPayload));
    }

    window.ResiHubSubmissionProgress?.start(
      i18nText("messages.submitting_for_review", "Submitting for Review"),
      i18nText(
        "messages.processing_submission_wait",
        "Please wait while your submission is being processed.",
      ),
    );
    progressStarted = true;

    const submitEndpoint =
      window.ResiHubApi?.ENDPOINTS?.submit ||
      "https://hub-worker-api.dekumar-ca.workers.dev/api/submit";

    const response = await fetch(submitEndpoint, {
      method: "POST",
      body: formData,
    });

    const rawResponse = await response.text();
    const responseHasSensitiveData = hasSensitiveRepoDetails(rawResponse);

    if (response.ok) {
      window.ResiHubSubmissionProgress?.complete(
        i18nText(
          "messages.sent_for_review_success",
          "Successfully sent for Review!",
        ),
        i18nText(
          "messages.submission_completed",
          "The server accepted your submission.",
        ),
      );
      btn.style.background = "#10b981";
      btn.innerText = i18nText(
        "messages.sent_for_review_success",
        "Successfully sent for Review!",
      );

      setTimeout(() => {
        showSubmissionSuccessModal(resolvePostSubmitRedirectUrl(submissionId));
      }, 1500);
    } else {
      let errorMessage = "Server Error";
      const parsedError = parseJsonSafe(rawResponse);
      if (!responseHasSensitiveData) {
        if (parsedError && typeof parsedError.error === "string") {
          errorMessage = parsedError.error;
        }
      } else {
        errorMessage = i18nText(
          "messages.repo_details_blocked",
          "Response blocked for security reasons. Please try again.",
        );
      }
      throw new Error(errorMessage);
    }
  } catch (err) {
    console.error("Submission Failed:", err);
    if (progressStarted) {
      window.ResiHubSubmissionProgress?.error(
        i18nText("messages.error_try_again", "Error - Try Again"),
        String(err?.message || "Submission failed."),
      );
    }

    const errorMessage = String(
      err?.message || i18nText("messages.error_try_again", "Error - Try Again"),
    );

    if (submissionError) {
      submissionError.textContent = errorMessage;
      submissionError.classList.remove("hidden");
    }

    btn.disabled = false;
    btn.style.background = "#ef4444";
    btn.innerText = i18nText("messages.error_try_again", "Error - Try Again");

    setTimeout(() => {
      btn.style.background = "";
      btn.innerText = originalText;
    }, 3000);
  }
}

function extractYoutubeId(url) {
  if (!url) return "";

  const trimmed = url.trim();
  const directMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([^&#?\/]+)/i,
  );
  if (directMatch && directMatch[1]) {
    return directMatch[1];
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace(/^\//, "").split("/")[0] || "";
    }
    const byQuery = parsed.searchParams.get("v");
    if (byQuery) return byQuery;
    const pathMatch = parsed.pathname.match(/\/(embed|shorts)\/([^/?#]+)/i);
    if (pathMatch && pathMatch[2]) {
      return pathMatch[2];
    }
  } catch (_) {
    return "";
  }

  return "";
}

function generatePreview() {
  previewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  previewObjectUrls = [];

  const title =
    document.getElementById("titleInput")?.value ||
    i18nText("messages.untitled_page", "Untitled Page");
  const condo =
    document.getElementById("condoInput")?.value ||
    i18nText("messages.community", "Community");

  let html = `<h1>${escapeHtml(title)}</h1><p class="preview-subtitle">${escapeHtml(condo)}</p><hr class="preview-hr">`;

  if (currentSubmissionLayout === "review") {
    const reviewKind = escapeHtml(
      document.getElementById("reviewKind")?.value || "other",
    );
    const reviewSubject = escapeHtml(
      sanitizeReviewText(
        document.getElementById("reviewSubject")?.value || "Untitled review",
      ),
    );
    const reviewRating = Number(
      document.getElementById("reviewRating")?.value || "3",
    );
    const reviewVerdictRaw =
      document.getElementById("reviewVerdict")?.value || "maybe";
    const reviewVerdictMap = {
      yes: "Recommended",
      maybe: "Recommended with caveats",
      no: "Not recommended",
    };
    const reviewVerdict = escapeHtml(
      reviewVerdictMap[reviewVerdictRaw] || "Recommended with caveats",
    );
    const reviewSummary = escapeHtml(
      sanitizeReviewText(
        document.getElementById("reviewSummary")?.value ||
          "Add your review summary to preview.",
      ),
    );
    const reviewPros = parseReviewLines(
      document.getElementById("reviewPros")?.value || "",
    ).map(escapeHtml);
    const reviewCons = parseReviewLines(
      document.getElementById("reviewCons")?.value || "",
    ).map(escapeHtml);
    const reviewImageAlign =
      document.getElementById("reviewImageAlign")?.value || "center";
    const reviewImageFile =
      document.getElementById("reviewImageInput")?.files?.[0] || null;

    const prosHtml = reviewPros.length
      ? `<ul>${reviewPros.map((item) => `<li>${item}</li>`).join("")}</ul>`
      : "<p>No pros added yet.</p>";
    const consHtml = reviewCons.length
      ? `<ul>${reviewCons.map((item) => `<li>${item}</li>`).join("")}</ul>`
      : "<p>No cons added yet.</p>";

    let mediaHtml = "";
    if (reviewImageFile) {
      const imageUrl = URL.createObjectURL(reviewImageFile);
      previewObjectUrls.push(imageUrl);
      mediaHtml = `<div class="review-preview-card__media review-preview-card__media--${reviewImageAlign}"><img src="${imageUrl}" alt="Review cover image"></div>`;
    }

    html += `
      <section class="review-preview-card">
        ${mediaHtml}
        <header class="review-preview-card__header">
          <p class="review-preview-card__type">${reviewKind} review</p>
          <h2>${reviewSubject}</h2>
          <div class="review-preview-card__meta-row">
            <span class="review-preview-pill">${reviewKind}</span>
            <span class="review-preview-pill">${reviewRating}/5</span>
          </div>
          <p class="review-preview-card__rating">${starsFromRating(reviewRating)} <span>${reviewRating}/5 score</span></p>
          <p class="review-preview-card__verdict">Verdict: ${reviewVerdict}</p>
        </header>
        <p class="review-preview-card__summary">${reviewSummary}</p>
        <div class="review-preview-card__grid">
          <div>
            <h3>Pros</h3>
            ${prosHtml}
          </div>
          <div>
            <h3>Cons</h3>
            ${consHtml}
          </div>
        </div>
      </section>
    `;

    const previewEl = document.getElementById("live-preview-content");
    if (previewEl) previewEl.innerHTML = html;
    return;
  }

  document.querySelectorAll(".content-section").forEach((sec) => {
    const editor = sec.querySelector(".editor-area");
    const text = editor ? deepCleanHTML(editor.innerHTML) : "";

    const align = sec.querySelector(".floating-select")?.value || "center";
    const videoUrl =
      sec.querySelector('input[name="section_video[]"]')?.value || "";
    const fileInput = sec.querySelector(".file-input");
    const imageFile = fileInput?.files?.[0] || null;

    let videoHtml = "";
    const id = extractYoutubeId(videoUrl);
    if (id) {
      videoHtml = `<div class="lh-video-container"><iframe src="https://www.youtube.com/embed/${id}" frameborder="0" allowfullscreen></iframe></div>`;
    }

    let mediaHtml = "";
    if (imageFile) {
      const imageUrl = URL.createObjectURL(imageFile);
      previewObjectUrls.push(imageUrl);
      mediaHtml = `
        <div class="lh-align-${align}">
          <figure class="lh-image-container">
            <img src="${imageUrl}" alt="Preview image" class="lh-fluid-img">
          </figure>
        </div>`;
    }

    html += `
      <div class="lh-section">
        ${videoHtml}
        ${mediaHtml}
        <div class="lh-text">${text}</div>
        <div class="lh-clear"></div>
      </div>`;
  });

  const previewEl = document.getElementById("live-preview-content");
  if (previewEl) previewEl.innerHTML = html;
}
