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

  function openLinkDialog() {
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog");
      dialog.className = "editor-link-dialog";

      const form = document.createElement("form");
      form.className = "editor-link-dialog__form";
      const heading = document.createElement("h2");
      heading.textContent = "Add link";
      const label = document.createElement("label");
      label.textContent = "Web address";
      const input = document.createElement("input");
      input.type = "url";
      input.name = "url";
      input.placeholder = "https://example.com";
      input.required = true;
      input.autocomplete = "url";
      input.addEventListener("input", () => input.setCustomValidity(""));
      label.appendChild(input);

      const actions = document.createElement("div");
      actions.className = "editor-link-dialog__actions";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "Cancel";
      const insert = document.createElement("button");
      insert.type = "submit";
      insert.textContent = "Insert link";
      actions.append(cancel, insert);
      form.append(heading, label, actions);
      dialog.appendChild(form);
      document.body.appendChild(dialog);

      dialog.addEventListener(
        "close",
        () => {
          const result = dialog.returnValue || null;
          dialog.remove();
          resolve(result);
        },
        { once: true },
      );
      cancel.addEventListener("click", () => dialog.close());
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        let url;
        try {
          url = new URL(input.value.trim());
        } catch (_) {
          input.setCustomValidity("Enter a valid http or https URL.");
          input.reportValidity();
          return;
        }
        if (!["http:", "https:"].includes(url.protocol)) {
          input.setCustomValidity("Only http and https links are supported.");
          input.reportValidity();
          return;
        }
        input.setCustomValidity("");
        dialog.close(url.href);
      });

      dialog.showModal();
      input.focus();
    });
  }

  window.ResiHubLinkDialog = Object.freeze({ open: openLinkDialog });

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

  function insertTable(editorArea) {
    editorArea.focus();
    const selection = window.getSelection();
    const hasEditorSelection =
      selection?.rangeCount &&
      editorArea.contains(selection.anchorNode);
    if (!hasEditorSelection) {
      const range = document.createRange();
      range.selectNodeContents(editorArea);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    const tableHtml =
      '<table><tbody><tr><th>Header</th><th>Header</th></tr>' +
      '<tr><td>Cell</td><td>Cell</td></tr></tbody></table><p><br></p>';
    document.execCommand("insertHTML", false, tableHtml);
  }

  function sanitizePastedHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html || ""), "text/html");
    const allowed = new Set([
      "A", "B", "STRONG", "I", "EM", "U", "S", "P", "DIV", "BR", "SPAN",
      "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE", "CODE",
      "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD",
    ]);
    doc.body.querySelectorAll("*").forEach((el) => {
      if (!allowed.has(el.tagName)) {
        el.replaceWith(...el.childNodes);
        return;
      }
      Array.from(el.attributes).forEach((attr) => {
        if (el.tagName === "A" && attr.name.toLowerCase() === "href") {
          try {
            const url = new URL(attr.value, window.location.href);
            if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
              el.removeAttribute(attr.name);
            }
          } catch (_) {
            el.removeAttribute(attr.name);
          }
        } else if (
          attr.name.toLowerCase() === "style" &&
          ["SPAN", "P", "DIV", "TD", "TH", "TR", "TABLE"].includes(el.tagName)
        ) {
          const allowedStyles = [];
          for (const declaration of attr.value.split(";")) {
            const colon = declaration.indexOf(":");
            if (colon < 0) continue;
            const property = declaration.slice(0, colon).trim().toLowerCase();
            const value = declaration.slice(colon + 1).trim();
            if (
              ["text-align", "font-weight", "font-style", "text-decoration"].includes(property) &&
              !/expression|javascript|url\s*\(/i.test(value)
            ) allowedStyles.push(`${property}:${value}`);
          }
          if (allowedStyles.length) el.setAttribute("style", allowedStyles.join(";"));
          else el.removeAttribute("style");
        } else {
          el.removeAttribute(attr.name);
        }
      });
    });
    return doc.body.innerHTML;
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
      let savedRange = null;

      editorArea.addEventListener("keydown", (event) => {
        if (event.key !== "Tab") return;
        event.preventDefault();
        document.execCommand(event.shiftKey ? "outdent" : "indent", false, null);
      });

      editorArea.addEventListener("paste", (event) => {
        event.preventDefault();
        const clipboard = event.clipboardData;
        if (!clipboard) return;
        const html = clipboard.getData("text/html");
        if (html) {
          document.execCommand("insertHTML", false, sanitizePastedHtml(html));
        } else {
          document.execCommand("insertText", false, clipboard.getData("text/plain"));
        }
      });

      section.querySelectorAll("[data-editor-cmd]").forEach((btn) => {
        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          const selection = window.getSelection();
          if (selection?.rangeCount && editorArea.contains(selection.anchorNode)) {
            savedRange = selection.getRangeAt(0).cloneRange();
          }
        });
        btn.addEventListener("click", async () => {
          const cmd = btn.dataset.editorCmd;
          editorArea.focus();
          if (cmd === "createLink") {
            const href = await window.ResiHubLinkDialog.open();
            if (!href) {
              savedRange = null;
              return;
            }
            if (cmd === "insertTable") {
              if (savedRange) {
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(savedRange);
              }
              insertTable(editorArea);
              savedRange = null;
              return;
            }
            if (savedRange) {
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(savedRange);
            }
            document.execCommand(cmd, false, href);
            savedRange = null;
            return;
          }
          try {
            document.execCommand(cmd, false, null);
          } catch (_) {
            /* deprecated but still works in all current browsers */
          }
          savedRange = null;
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
