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
  const alignSelect = clone.querySelector(".align-select");
  const videoAlignSelect = clone.querySelector(".video-align-select");
  const mediaCol = clone.querySelector(".section-media");
  const toolbarShell = clone.querySelector(".rich-toolbar-shell");

  if (editor) editor.innerHTML = text;
  if (videoInput) videoInput.value = video;
  if (alignSelect) alignSelect.value = align;
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
          "https://hub-community-apis.dekumar-ca.workers.dev/api/ai/auto-format";
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
  const newSection = container.lastElementChild;
  const pickerEl = newSection?.querySelector('[data-role="image-picker"]');
  if (pickerEl && window.ResiHubImagePicker)
    window.ResiHubImagePicker.mount(pickerEl);
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
    const normalizedContent = normalizeEditorHtml(editor?.innerHTML || "");
    if (normalizedContent) {
      draft.sections.push({
        text: normalizedContent,
        video: sec.querySelector(".video-input")?.value || "",
        videoAlign: sec.querySelector(".video-align-select")?.value || "center",
        align: sec.querySelector(".align-select")?.value || "center",
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
      <span>You have an unsaved draft. Resume?</span>
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

  const sections = wikiContainer.querySelectorAll(".lh-section");
  if (sections.length > 0) {
    sections.forEach((sec) => {
      const textHTML = normalizeEditorHtml(
        sec.querySelector(".lh-text")?.innerHTML.trim() || "",
      );
      const videoURL = normalizeYoutubeUrl(
        sec.querySelector("iframe")?.src || "",
      );
      const imageURL = sec.querySelector("img")?.src || "";
      let align = "center";
      if (sec.querySelector(".lh-align-left")) align = "left";
      if (sec.querySelector(".lh-align-right")) align = "right";

      let videoAlign = align;
      if (sec.querySelector(".lh-align-left iframe")) videoAlign = "left";
      if (sec.querySelector(".lh-align-right iframe")) videoAlign = "right";

      addSectionToDrawer(textHTML, videoURL, align, imageURL, videoAlign);

      const lastSection = sectionsContainer.lastElementChild;
      const pickerEl = lastSection?.querySelector('[data-role="image-picker"]');
      if (pickerEl && window.ResiHubImagePicker && imageURL) {
        window.ResiHubImagePicker.mount(pickerEl, {
          images: [
            {
              id: `existing-${Date.now()}`,
              url: imageURL,
              previewUrl: imageURL,
              alt: "",
              align: align || "center",
              isLocal: false,
            },
          ],
        });
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
