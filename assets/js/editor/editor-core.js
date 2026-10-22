/**
 * editor-core.js
 * Unified editor engine. Single source of truth for:
 *   - Section rendering + CRUD
 *   - Toolbar command execution
 *   - Image picker mount
 *   - Payload generation (matches worker contract)
 *
 * Instances are independent. Multiple editors on one page are supported.
 */
(function initEditorCore() {
  "use strict";

  if (window.EditorCore) return;

  const uid = () =>
    `ed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  let sectionCounter = 0;

  function cloneTemplate() {
    const template = document.getElementById("editor-section-template");
    if (!template) {
      console.error("[EditorCore] editor-section-template not found");
      return null;
    }
    return template.content.cloneNode(true);
  }

  function normalizeHtml(html) {
    // Minimal cleanup — the Worker's deepCleanHTML does the heavy lifting.
    return String(html || "")
      .replace(/<div><br\s*\/?><\/div>/gi, "")
      .replace(/<br\s*\/?>/gi, "<br>")
      .trim();
  }

  function escapeAttr(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  class EditorInstance {
    constructor(container, options = {}) {
      if (!container) throw new Error("[EditorCore] container required");
      this.container = container;
      this.options = Object.assign(
        {
          initialSections: null,
          onDraftChange: null,
          onSectionCountChange: null,
          submitType: "wiki",
        },
        options,
      );
      this.sections = [];
      this.root = container;
      this._bindAddButton();
      if (Array.isArray(this.options.initialSections)) {
        this.options.initialSections.forEach((sec) => this.addSection(sec));
      } else {
        this.addSection();
      }
    }

    _bindAddButton() {
      const addBtn = this.root.querySelector("[data-editor-add]");
      if (addBtn && !addBtn.dataset.bound) {
        addBtn.dataset.bound = "1";
        addBtn.addEventListener("click", () => this.addSection());
      }
    }

    addSection(initial = {}) {
      const clone = cloneTemplate();
      if (!clone) return null;

      const section = clone.querySelector("[data-editor-section]");
      section.dataset.sectionId = uid();
      sectionCounter += 1;

      const numberEl = section.querySelector("[data-editor-section-number]");
      if (numberEl) numberEl.textContent = String(this.sections.length + 1);

      const editorArea = section.querySelector("[data-editor-area]");
      if (editorArea && initial.text) {
        editorArea.innerHTML = initial.text;
      }

      const videoInput = section.querySelector("[data-editor-video]");
      if (videoInput && initial.video) videoInput.value = initial.video;

      this.container.appendChild(clone);

      // Mount image picker if the module is present
      const pickerEl = section.querySelector('[data-role="image-picker"]');
      if (pickerEl && window.ResiHubImagePicker) {
        window.ResiHubImagePicker.mount(pickerEl, {
          images: Array.isArray(initial.images) ? initial.images : [],
        });
      }

      // Wire the toolbar
      this._bindToolbar(section);
      this._bindModerationHint(section);

      // Wire the remove button
      const removeBtn = section.querySelector("[data-editor-remove]");
      if (removeBtn) {
        removeBtn.addEventListener("click", () => this.removeSection(section));
      }

      this.sections.push(section);
      this._renumber();
      this._emitChange();
      return section;
    }

    _bindToolbar(section) {
      const editorArea = section.querySelector("[data-editor-area]");
      if (!editorArea) return;

      section.querySelectorAll("[data-editor-cmd]").forEach((btn) => {
        btn.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus
        btn.addEventListener("click", () => {
          const cmd = btn.dataset.editorCmd;
          editorArea.focus();
          try {
            document.execCommand(cmd, false, null);
          } catch (_) {
            /* deprecated but still works in all current browsers */
          }
        });
      });
    }

    _bindModerationHint(section) {
      const editorArea = section.querySelector(
        ".editor-area, [data-editor-area]",
      );
      if (!editorArea) return;

      let timer = null;
      const debouncedCheck = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const text = editorArea.innerText || "";
          if (text.trim().length < 20) return;

          const result = window.ResiHubPatterns?.check(text);
          if (result && result.severity === "warn" && result.message) {
            window.ResiHubModerationHint?.show(result.message);
          } else {
            window.ResiHubModerationHint?.hide();
          }
        }, 800);
      };

      editorArea.addEventListener("input", debouncedCheck);
      editorArea.addEventListener("paste", debouncedCheck);
    }

    removeSection(section) {
      const idx = this.sections.indexOf(section);
      if (idx === -1) return;
      if (this.sections.length === 1) return; // keep at least one
      section.remove();
      this.sections.splice(idx, 1);
      this._renumber();
      this._emitChange();
    }

    _renumber() {
      this.sections.forEach((section, i) => {
        const num = section.querySelector("[data-editor-section-number]");
        if (num) num.textContent = String(i + 1);
      });
    }

    _emitChange() {
      if (typeof this.options.onSectionCountChange === "function") {
        this.options.onSectionCountChange(this.sections.length);
      }
      if (typeof this.options.onDraftChange === "function") {
        this.options.onDraftChange(this.getSections());
      }
    }

    /** Returns [{ text, video, images: [...] }] for non-empty sections. */
    getSections() {
      const out = [];
      this.sections.forEach((section, i) => {
        const editorArea = section.querySelector("[data-editor-area]");
        const videoInput = section.querySelector("[data-editor-video]");
        const pickerEl = section.querySelector('[data-role="image-picker"]');

        const text = normalizeHtml(editorArea?.innerHTML || "");
        const plain = text.replace(/<[^>]+>/g, "").trim();
        if (!plain) return;

        const video = String(videoInput?.value || "").trim();
        const images =
          pickerEl && window.ResiHubImagePicker
            ? window.ResiHubImagePicker.getImages(pickerEl)
            : [];

        out.push({
          index: i,
          text,
          video,
          images,
        });
      });
      return out;
    }

    /**
     * Appends the exact FormData keys the Worker expects.
     * Returns { section_count, sections_json } for logging.
     */
    appendToFormData(fd) {
      const sections = this.getSections();
      let fileIdx = 0;

      sections.forEach((sec, i) => {
        fd.append(`section_text_${i}`, sec.text);
        fd.append(`section_video_${i}`, sec.video);
        fd.append(`section_align_${i}`, "center"); // alignment is per-image now

        const meta = [];
        let localIdx = 0;

        sec.images.forEach((img) => {
          if (img.isLocal && img.file instanceof File) {
            fd.append(`section_images_${i}`, img.file);
            meta.push({
              isExisting: false,
              align: img.align || "center",
              alt: img.alt || "",
              order: localIdx++,
            });
          } else if (img.url) {
            meta.push({
              isExisting: true,
              url: img.url,
              align: img.align || "center",
              alt: img.alt || "",
              order: localIdx++,
            });
          }
        });

        fd.append(`section_images_meta_${i}`, JSON.stringify(meta));
      });

      fd.append("section_count", String(sections.length));
      fd.append(
        "sections_json",
        JSON.stringify(
          sections.map((s) => ({
            text: s.text,
            video: s.video,
            align: "center",
          })),
        ),
      );

      return {
        section_count: sections.length,
        sections_json: JSON.stringify(
          sections.map((s) => ({
            text: s.text,
            video: s.video,
            align: "center",
          })),
        ),
      };
    }

    clear() {
      this.sections.forEach((s) => s.remove());
      this.sections = [];
      this.addSection();
    }
  }

  window.EditorCore = {
    mount(container, options) {
      return new EditorInstance(container, options);
    },
  };
})();
