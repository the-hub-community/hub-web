import {
  i18nText,
  normalizeEditorHtml,
  normalizeYoutubeUrl,
} from "./transformers.js";

let previousActiveElement = null;
let trapFocusHandler = null;

function getDraftKey() {
  return `editor-draft-${document.body?.dataset?.pageKey || "global"}`;
}

function mountSectionImagePicker(section) {
  const pickerEl = section?.querySelector('[data-role="image-picker"]');
  if (!pickerEl) {
    console.error("[Editor] image picker container not found");
    return;
  }
  if (!window.ResiHubImagePicker) {
    console.error("[Editor] image picker module unavailable");
    return;
  }
  window.ResiHubImagePicker.mount(pickerEl);
}

function showUndoToast(message, undoCallback) {
  document.querySelector(".undo-toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "undo-toast";
  toast.innerHTML = `<span>${message}</span><button type="button">Undo</button>`;
  toast.querySelector("button").addEventListener("click", () => {
    undoCallback();
    toast.remove();
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    if (document.body.contains(toast)) {
      toast.classList.add("fade-out");
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

function trapFocus(element) {
  if (trapFocusHandler)
    document.removeEventListener("keydown", trapFocusHandler);
  trapFocusHandler = function (e) {
    if (e.key === "Escape") {
      togglePanel();
      return;
    }
    if (e.key !== "Tab") return;
    const focusableEls = element.querySelectorAll(
      'a[href]:not([disabled]), button:not([disabled]), textarea:not([disabled]), input[type="text"]:not([disabled]), input[type="radio"]:not([disabled]), input[type="checkbox"]:not([disabled]), select:not([disabled]), [contenteditable]',
    );
    if (focusableEls.length === 0) return;
    const firstFocusableEl = focusableEls[0];
    const lastFocusableEl = focusableEls[focusableEls.length - 1];
    if (e.shiftKey) {
      if (
        document.activeElement === firstFocusableEl ||
        document.activeElement === element
      ) {
        lastFocusableEl.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastFocusableEl) {
        firstFocusableEl.focus();
        e.preventDefault();
      }
    }
  };
  document.addEventListener("keydown", trapFocusHandler);
}

export function addSectionToDrawer(
  text = "",
  video = "",
  align = "center",
  image = "",
  videoAlign = "center",
) {
  const container = document.getElementById("drawer-sections-container");
  const template = document.getElementById("drawer-section-template");
  if (!container || !template) return;

  const clone = template.content.cloneNode(true);
  const editor = clone.querySelector(".editor-area");
  const videoInput = clone.querySelector(".video-input");
  const videoAlignSelect = clone.querySelector(".video-align-select");
  const mediaCol = clone.querySelector(".section-media");
  const toolbarShell = clone.querySelector(".rich-toolbar-shell");

  if (editor) editor.innerHTML = text;
  if (videoInput) videoInput.value = video;
  if (videoAlignSelect) videoAlignSelect.value = videoAlign;
  if (toolbarShell)
    toolbarShell.open = !window.matchMedia("(max-width: 768px)").matches;

  if (mediaCol && image) {
    const imagePath = image;
    const renderLoadedState = () => {
      mediaCol.querySelector(".existing-image-removed-row")?.remove();
      mediaCol.querySelector(".existing-image-loaded-row")?.remove();
      const indicatorRow = document.createElement("div");
      indicatorRow.className = "existing-image-loaded-row";
      const indicator = document.createElement("div");
      indicator.className = "existing-image-indicator";
      indicator.textContent = i18nText(
        "messages.existing_image_loaded",
        "✓ Existing Image Loaded",
      );
      const removeImageBtn = document.createElement("button");
      removeImageBtn.type = "button";
      removeImageBtn.className = "existing-image-remove-btn";
      removeImageBtn.textContent = i18nText(
        "messages.remove_existing_image",
        "Remove Existing Image",
      );
      removeImageBtn.addEventListener("click", renderRemovedState);
      indicatorRow.append(indicator, removeImageBtn);
      mediaCol.prepend(indicatorRow);
      let hidden = mediaCol.querySelector(".existing-image-path");
      if (!hidden) {
        hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.className = "existing-image-path";
        mediaCol.appendChild(hidden);
      }
      hidden.value = imagePath;
      hidden.dataset.align = ["left", "right"].includes(align)
        ? align
        : "center";
    };
    const renderRemovedState = () => {
      mediaCol.querySelector(".existing-image-loaded-row")?.remove();
      mediaCol.querySelector(".existing-image-path")?.remove();
      const removedRow = document.createElement("div");
      removedRow.className = "existing-image-removed-row";
      const removedNote = document.createElement("div");
      removedNote.className = "existing-image-removed-note";
      removedNote.textContent = i18nText(
        "messages.existing_image_removed_save",
        "Existing image removed. Save to apply this change.",
      );
      const undoBtn = document.createElement("button");
      undoBtn.type = "button";
      undoBtn.className = "existing-image-undo-btn";
      undoBtn.textContent = i18nText("messages.undo", "Undo");
      undoBtn.addEventListener("click", renderLoadedState);
      removedRow.append(removedNote, undoBtn);
      mediaCol.prepend(removedRow);
    };
    renderLoadedState();
  }

  const sectionElement = clone.querySelector(".drawer-section-card");

  sectionElement.querySelectorAll(".btn-move").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const dir = e.currentTarget.dataset.dir;
      const container = document.getElementById("drawer-sections-container");
      if (dir === "up" && sectionElement.previousElementSibling)
        container.insertBefore(
          sectionElement,
          sectionElement.previousElementSibling,
        );
      else if (dir === "down" && sectionElement.nextElementSibling)
        container.insertBefore(
          sectionElement.nextElementSibling,
          sectionElement,
        );
    });
  });

  sectionElement
    .querySelector(".btn-remove-sec")
    .addEventListener("click", (e) => {
      const section = e.currentTarget.closest(".drawer-section-card");
      const parent = section.parentNode;
      const nextSibling = section.nextElementSibling;
      section.remove();
      showUndoToast("Section deleted.", () => {
        if (nextSibling) parent.insertBefore(section, nextSibling);
        else parent.appendChild(section);
      });
    });

  const aiBtn = sectionElement.querySelector(".btn-ai-format");
  const editorArea = sectionElement.querySelector(".editor-area");
  if (aiBtn && editorArea) {
    aiBtn.addEventListener("click", async () => {
      const rawText = editorArea.innerText.trim();
      if (!rawText || rawText.length < 10) return;
      const originalIcon = aiBtn.innerHTML;
      aiBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      aiBtn.disabled = true;
      try {
        const endpoint =
          window.ResiHubApi?.ENDPOINTS?.autoFormat ||
          "https://api.hubcollective.ca/api/ai/auto-format";
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: rawText }),
        });
        const data = await res.json();
        if (data.success && data.text) {
          editorArea.innerHTML = data.text
            .split("\n\n")
            .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
            .join("");
        }
      } catch (err) {
        console.error("Format failed:", err);
      } finally {
        aiBtn.innerHTML = originalIcon;
        aiBtn.disabled = false;
      }
    });
  }

  container.appendChild(clone);
  mountSectionImagePicker(container.lastElementChild);
  if (typeof window.applyTranslations === "function")
    window.applyTranslations(container);
}

export function saveDraft() {
  const sections = document.querySelectorAll(
    "#drawer-sections-container .drawer-section-card",
  );
  const draft = {
    condo: document.getElementById("condo")?.value || "",
    title: document.getElementById("title")?.value || "",
    sections: [],
  };

  sections.forEach((sec) => {
    const editor = sec.querySelector(".editor-area");
    const serializedEditor = window.ResiHubEditorInlineMedia?.serialize(editor);
    let editorHtml = serializedEditor?.html || editor?.innerHTML || "";
    let missingInlineImages = 0;
    serializedEditor?.inlineMedia.forEach((media) => {
      const marker = `[[HUB_INLINE_MEDIA:${media.token}]]`;
      let replacement = "";
      if (media.type === "video") {
        const videoId = media.url.match(/[?&]v=([a-zA-Z0-9_-]{6,20})/)?.[1];
        if (videoId) {
          replacement = `<div class="lh-video-container"><iframe src="https://www.youtube.com/embed/${videoId}" title="YouTube video" allowfullscreen></iframe></div>`;
        }
      } else if (media.file instanceof File) {
        replacement = "<p>[Photo must be re-added after resuming this draft]</p>";
        missingInlineImages += 1;
      } else {
        const escapeAttr = (value) => String(value || "")
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const alignment = ["left", "right"].includes(media.align) ? media.align : "center";
        replacement = `<div class="lh-align-${alignment}"><figure class="lh-image-container"><img src="${escapeAttr(media.url)}" alt="${escapeAttr(media.alt)}" title="${escapeAttr(media.alt)}" class="lh-fluid-img"></figure></div>`;
      }
      editorHtml = editorHtml.replace(marker, replacement);
    });
    const normalizedContent = normalizeEditorHtml(editorHtml);
    if (normalizedContent) {
      draft.sections.push({
        text: normalizedContent,
        video: sec.querySelector(".video-input")?.value || "",
        videoAlign: sec.querySelector(".video-align-select")?.value || "center",
        missingInlineImages,
        align: (() => {
          const picker = sec.querySelector('[data-role="image-picker"]');
          const images =
            picker && window.ResiHubImagePicker
              ? window.ResiHubImagePicker.getImages(picker)
              : [];
          return images.length === 1 ? images[0].align || "center" : "center";
        })(),
      });
    }
  });

  if (draft.title || draft.sections.length > 0) {
    localStorage.setItem(getDraftKey(), JSON.stringify(draft));
  }
}

export function restoreDraft() {
  const draft = localStorage.getItem(getDraftKey());
  if (!draft) return;

  try {
    const data = JSON.parse(draft);
    if (!data.sections || data.sections.length === 0) return;

    const promptBox = document.createElement("div");
    promptBox.className = "undo-toast";
    promptBox.style.bottom = "90px";
    promptBox.innerHTML = `
      <span>You have an unsaved draft. Resume?${data.sections.some((section) => section.missingInlineImages) ? " Some local photos must be re-added after resuming." : ""}</span>
      <button id="btn-resume-draft">Resume</button>
      <button id="btn-discard-draft" style="color: #fca5a5;">Discard</button>
    `;
    document.body.appendChild(promptBox);

    document
      .getElementById("btn-resume-draft")
      .addEventListener("click", () => {
        if (data.title) {
          const titleInput = document.getElementById("title");
          if (titleInput) titleInput.value = data.title;
        }
        if (data.condo) {
          const condoInput = document.getElementById("condo");
          if (condoInput) condoInput.value = data.condo;
        }

        const container = document.getElementById("drawer-sections-container");
        if (container) {
          container.innerHTML = "";
          data.sections.forEach((sec) => {
            addSectionToDrawer(
              normalizeEditorHtml(sec.text || ""),
              sec.video,
              sec.align,
              "",
              sec.videoAlign,
            );
          });
        }
        promptBox.remove();
        togglePanel("edit"); // ACTUALLY OPEN THE PANEL
      });

    document
      .getElementById("btn-discard-draft")
      .addEventListener("click", () => {
        localStorage.removeItem(getDraftKey());
        promptBox.remove();
      });
  } catch (_) {
    localStorage.removeItem(getDraftKey());
  }
}

export function prepareEdit() {
  const wikiContainer = document.querySelector(".wiki-render");
  const titleInput = document.getElementById("title");
  const typeInput = document.getElementById("type");
  const sectionsContainer = document.getElementById(
    "drawer-sections-container",
  );

  if (!wikiContainer || !titleInput || !sectionsContainer) return;

  if (typeInput) typeInput.value = "update";
  titleInput.value = wikiContainer.querySelector("h1")?.innerText || "";
  sectionsContainer.innerHTML = "";

  const contentBody = wikiContainer.querySelector(".lh-content-body");
  const sections = contentBody
    ? Array.from(contentBody.children).filter((element) =>
        element.matches(".lh-section, .lh-image-gallery"),
      )
    : Array.from(wikiContainer.querySelectorAll(".lh-section"));
  if (sections.length > 0) {
    sections.forEach((sec) => {
      const textHTML = normalizeEditorHtml(
        sec.querySelector(".lh-text")?.innerHTML.trim() || "",
      );
      const videoURL = normalizeYoutubeUrl(
        Array.from(sec.querySelectorAll("iframe"))
          .find((iframe) => !iframe.closest(".lh-text"))?.src || "",
      );
      const imageElements = Array.from(
        sec.querySelectorAll("figure.lh-image-container img"),
      ).filter((image) => !image.closest(".lh-text"));
      if (!imageElements.length) {
        const legacyImage = sec.querySelector(
          ".lh-align-left img, .lh-align-center img, .lh-align-right img",
        );
        if (legacyImage && !legacyImage.closest(".lh-text")) {
          imageElements.push(legacyImage);
        }
      }
      const images = imageElements.map((image, index) => {
        const alignment = image.closest(".lh-align-left, .lh-align-right");
        const imageAlign = alignment?.classList.contains("lh-align-left")
          ? "left"
          : alignment?.classList.contains("lh-align-right")
            ? "right"
            : image.closest("figure.lh-image-container")?.dataset.align ||
              "center";
        return {
          id: `existing-${Date.now()}-${index}`,
          url: image.src,
          previewUrl: image.src,
          alt: image.alt || "",
          align: imageAlign,
          isLocal: false,
        };
      });
      const align =
        images.length === 1 && ["left", "right"].includes(images[0].align)
          ? images[0].align
          : "center";
      let videoAlign = "center";
      const sectionVideo = Array.from(sec.querySelectorAll("iframe"))
        .find((iframe) => !iframe.closest(".lh-text"));
      if (sectionVideo?.closest(".lh-align-left")) videoAlign = "left";
      if (sectionVideo?.closest(".lh-align-right")) videoAlign = "right";

      addSectionToDrawer(textHTML, videoURL, align, "", videoAlign);

      const lastSection = sectionsContainer.lastElementChild;
      const pickerEl = lastSection?.querySelector('[data-role="image-picker"]');
      if (pickerEl && window.ResiHubImagePicker) {
        window.ResiHubImagePicker.setImages(pickerEl, images);
      }
    });
  } else {
    addSectionToDrawer("", "", "center", "", "center");
  }

  togglePanel("edit");
}

export function togglePanel(mode = "create") {
  const currentCondo = (document.body?.dataset?.pageCondo || "").trim();
  const condoInput = document.getElementById("condo");
  const titleInput = document.getElementById("title");
  const typeInput = document.getElementById("type");
  const sectionsContainer = document.getElementById(
    "drawer-sections-container",
  );
  const errorBox = document.getElementById("drawerSubmissionError");
  const editorPanel = document.getElementById("editor-panel");
  const editBtn = document.getElementById("pageEditBtn");

  if (!editorPanel) return;
  const isOpening = !editorPanel.classList.contains("is-open");

  if (condoInput) {
    if (currentCondo) {
      condoInput.value = currentCondo;
      condoInput.setAttribute("readonly", "true");
      condoInput.classList.add("condo-input-locked", "field-locked");
      if (!condoInput.parentElement.querySelector(".field-locked-helper")) {
        const helper = document.createElement("small");
        helper.className = "field-locked-helper";
        helper.innerHTML =
          '<i class="fa-solid fa-lock"></i> Community is locked to this page';
        condoInput.parentElement.appendChild(helper);
      }
    } else {
      condoInput.value = "";
      condoInput.removeAttribute("readonly");
      condoInput.classList.remove("condo-input-locked", "field-locked");
      condoInput.parentElement.querySelector(".field-locked-helper")?.remove();
    }
  }

  if (isOpening) {
    previousActiveElement = document.activeElement;
    if (editBtn) editBtn.setAttribute("aria-expanded", "true");
    editorPanel.setAttribute("aria-hidden", "false");
    if (errorBox) {
      errorBox.textContent = "";
      errorBox.style.display = "none";
    }

    const heading = editorPanel?.querySelector(".drawer-header h2");
    const submitBtn = document.getElementById("sync-btn");

    if (mode === "edit") {
      if (typeInput) typeInput.value = "update";
      if (heading) {
        heading.setAttribute("data-i18n", "editor.update_information");
        heading.textContent = i18nText(
          "editor.update_information",
          "Update Information",
        );
      }
      if (submitBtn) {
        submitBtn.setAttribute("data-i18n", "common.update");
        submitBtn.textContent = i18nText("common.update", "Update");
      }
    } else {
      if (typeInput) typeInput.value = "wiki";
      if (titleInput) titleInput.value = "";
      if (sectionsContainer) {
        sectionsContainer.innerHTML = "";
        addSectionToDrawer("", "", "center", "", "center");
      }
      if (heading) {
        heading.setAttribute("data-i18n", "editor.create_wiki_page");
        heading.textContent = i18nText(
          "editor.create_wiki_page",
          "Create Wiki Page",
        );
      }
      if (submitBtn) {
        submitBtn.setAttribute("data-i18n", "common.create");
        submitBtn.textContent = i18nText("common.create", "Create");
      }
    }

    editorPanel.classList.add("is-open");
    trapFocus(editorPanel);
    const focusTarget = editorPanel.querySelector(
      "input, button, [contenteditable]",
    );
    if (focusTarget) setTimeout(() => focusTarget.focus(), 100);
  } else {
    editorPanel.classList.remove("is-open");
    editorPanel.setAttribute("aria-hidden", "true");
    if (editBtn) editBtn.setAttribute("aria-expanded", "false");
    if (trapFocusHandler) {
      document.removeEventListener("keydown", trapFocusHandler);
      trapFocusHandler = null;
    }
    if (previousActiveElement && previousActiveElement.focus)
      previousActiveElement.focus();
  }
}

export function addNewSection() {
  const container = document.getElementById("drawer-sections-container");
  const template = document.getElementById("drawer-section-template");
  if (!container || !template) return;
  const clone = template.content.cloneNode(true);
  const section = clone.querySelector(".drawer-section-card");
  const sectionIndex = container.querySelectorAll(
    ".drawer-section-card",
  ).length;
  if (section) {
    section.dataset.index = sectionIndex;
    const label = section.querySelector(".sec-label");
    if (label)
      label.textContent = `${i18nText("messages.section_prefix", "Section #")}${sectionIndex + 1}`;
    const toolbarShell = section.querySelector(".rich-toolbar-shell");
    if (toolbarShell)
      toolbarShell.open = !window.matchMedia("(max-width: 768px)").matches;
  }
  container.appendChild(clone);
  mountSectionImagePicker(container.lastElementChild);
  if (typeof window.applyTranslations === "function")
    window.applyTranslations(container);
}

export function initDrawer() {
  // Only check for drafts if the edit drawer exists on the page
  if (document.getElementById("editor-panel")) {
    restoreDraft();
  }

  const editorPanel = document.getElementById("editor-panel");
  if (editorPanel) {
    setInterval(() => {
      if (editorPanel.classList.contains("is-open")) saveDraft();
    }, 30000);
  }

  const contentArea = document.getElementById("drawer-sections-container");
  if (contentArea) {
    contentArea.addEventListener("input", saveDraft);
    contentArea.addEventListener("change", saveDraft);
  }
}
