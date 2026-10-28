(function initEditorInlineMedia() {
  "use strict";
  if (window.ResiHubEditorInlineMedia) return;

  const savedRanges = new WeakMap();
  const filesById = new Map();
  let mediaCounter = 0;

  function getEditor(element) {
    return getEditorSection(element)
      ?.querySelector(".editor-area, [data-editor-area]") || null;
  }

  function getEditorSection(element) {
    return element?.closest(".drawer-section-card, .editor-section, .editor-shell") || null;
  }

  function captureRange(editor) {
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedRanges.set(editor, range.cloneRange());
    }
  }

  function restoreRange(editor) {
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    const range = savedRanges.get(editor);
    if (range && editor.contains(range.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }

    const endRange = document.createRange();
    endRange.selectNodeContents(editor);
    endRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(endRange);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function youtubeId(value) {
    try {
      const url = new URL(value.trim());
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      if (host === "youtu.be") return url.pathname.slice(1).split("/")[0];
      if (host !== "youtube.com" && host !== "m.youtube.com") return "";
      return url.searchParams.get("v") ||
        url.pathname.match(/^\/(?:embed|shorts)\/([^/?#]+)/i)?.[1] ||
        "";
    } catch {
      return "";
    }
  }

  function mediaId() {
    mediaCounter += 1;
    return `hub-inline-${Date.now().toString(36)}-${mediaCounter.toString(36)}`;
  }

  function insertHtml(editor, html) {
    restoreRange(editor);
    if (!document.execCommand("insertHTML", false, html)) {
      setStatus(editor, "Could not insert media. Place cursor in text and retry.");
      return false;
    }
    captureRange(editor);
    return true;
  }

  function setStatus(editor, message) {
    const section = editor?.closest(".drawer-section-card, .editor-section, .editor-shell");
    const status = section?.querySelector("[data-inline-media-status]");
    if (status) {
      status.textContent = message;
      status.hidden = false;
    }
  }

  function removeButton(label) {
    return `<button type="button" class="inline-media-remove" data-inline-media-remove aria-label="${escapeHtml(label)}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;
  }

  function addInlineBlock(editor, block, type, id) {
    block.classList.add("lh-inline-media-block", `lh-inline-media-block--${type}`);
    block.dataset.inlineMediaType = type;
    block.dataset.inlineMediaId = id;
    block.setAttribute("contenteditable", "false");
    if (!block.querySelector("[data-inline-media-remove]")) {
      block.insertAdjacentHTML("beforeend", removeButton("Remove inserted media"));
    }
    editor.querySelectorAll(".lh-inline-media-block").forEach((existing) => {
      if (!existing.dataset.inlineMediaId) {
        existing.dataset.inlineMediaId = mediaId();
      }
    });
  }

  function decorateExistingMedia(editor) {
    editor.querySelectorAll("figure.lh-image-container").forEach((figure) => {
      if (figure.closest(".lh-inline-media-block")) return;
      addInlineBlock(editor, figure, "image", mediaId());
    });
    editor.querySelectorAll(".lh-video-container").forEach((video) => {
      if (video.closest(".lh-inline-media-block")) return;
      addInlineBlock(editor, video, "video", mediaId());
    });
  }

  function insertImage(editor, file, alt) {
    const id = mediaId();
    const source = URL.createObjectURL(file);
    filesById.set(id, file);
    const html = `<figure class="lh-image-container lh-inline-media-block lh-inline-media-block--image" data-inline-media-type="image" data-inline-media-id="${id}" contenteditable="false"><img src="${source}" alt="${escapeHtml(alt)}" title="${escapeHtml(alt)}" class="lh-fluid-img">${removeButton("Remove inserted photo")}</figure><p><br></p>`;
    if (!insertHtml(editor, html)) {
      filesById.delete(id);
      URL.revokeObjectURL(source);
      return false;
    }
    return true;
  }

  function insertVideo(editor, url) {
    const id = mediaId();
    const videoId = youtubeId(url);
    if (!videoId || !/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
      return false;
    }
    const safeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const html = `<div class="lh-video-container lh-inline-media-block lh-inline-media-block--video" data-inline-media-type="video" data-inline-media-id="${id}" data-inline-url="${safeUrl}" contenteditable="false"><iframe src="https://www.youtube.com/embed/${videoId}" title="YouTube video" allowfullscreen></iframe>${removeButton("Remove inserted video")}</div><p><br></p>`;
    return insertHtml(editor, html);
  }

  function getAlignment(block) {
    const alignment = block.closest(".lh-align-left, .lh-align-right");
    if (alignment?.classList.contains("lh-align-left")) return "left";
    if (alignment?.classList.contains("lh-align-right")) return "right";
    return "center";
  }

  function serialize(editor) {
    decorateExistingMedia(editor);
    const clone = editor.cloneNode(true);
    const inlineMedia = [];
    editor.querySelectorAll(".lh-inline-media-block").forEach((block) => {
      const id = block.dataset.inlineMediaId || mediaId();
      block.dataset.inlineMediaId = id;
      const type = block.dataset.inlineMediaType;
      const token = id;
      const cloned = clone.querySelector(`[data-inline-media-id="${id}"]`);
      if (!cloned) return;
      if (type === "image") {
        const image = block.querySelector("img");
        if (!image) return;
        const file = filesById.get(id);
        inlineMedia.push({
          token,
          type,
          alt: image.alt || "",
          align: getAlignment(block),
          file: file || null,
          url: file ? "" : image.currentSrc || image.src,
        });
      } else if (type === "video") {
        const videoUrl = block.dataset.inlineUrl ||
          block.querySelector("iframe")?.src ||
          "";
        const videoId = youtubeId(videoUrl);
        if (!videoId) return;
        inlineMedia.push({
          token,
          type,
          url: `https://www.youtube.com/watch?v=${videoId}`,
        });
      } else {
        return;
      }
      cloned.replaceWith(document.createTextNode(`[[HUB_INLINE_MEDIA:${token}]]`));
    });
    return { html: clone.innerHTML, inlineMedia };
  }

  document.addEventListener("mousedown", (event) => {
    const control = event.target.closest("[data-inline-image-trigger], [data-inline-video-toggle]");
    if (!control) return;
    const editor = getEditor(control);
    if (editor) {
      captureRange(editor);
      event.preventDefault();
    }
  });

  document.addEventListener("click", (event) => {
    const imageTrigger = event.target.closest("[data-inline-image-trigger]");
    if (imageTrigger) {
      const editor = getEditor(imageTrigger);
      const input = getEditorSection(imageTrigger)
        ?.querySelector("[data-inline-image-input]");
      if (!editor || !input) return;
      captureRange(editor);
      input.click();
      return;
    }

    const videoToggle = event.target.closest("[data-inline-video-toggle]");
    if (videoToggle) {
      const editor = getEditor(videoToggle);
      const composer = getEditorSection(videoToggle)
        ?.querySelector("[data-inline-video-composer]");
      if (!editor || !composer) return;
      captureRange(editor);
      composer.hidden = !composer.hidden;
      if (!composer.hidden) composer.querySelector("input")?.focus();
      return;
    }

    const videoInsert = event.target.closest("[data-inline-video-insert]");
    if (videoInsert) {
      const composer = videoInsert.closest("[data-inline-video-composer]");
      const editor = getEditor(videoInsert);
      const input = composer?.querySelector("input");
      if (!editor || !input) return;
      if (!insertVideo(editor, input.value)) {
        input.setCustomValidity("Enter a valid YouTube video link.");
        input.reportValidity();
        return;
      }
      input.setCustomValidity("");
      input.value = "";
      composer.hidden = true;
      setStatus(editor, "Video inserted at cursor.");
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    const removeButton = event.target.closest("[data-inline-media-remove]");
    if (removeButton) {
      const block = removeButton.closest(".lh-inline-media-block");
      const id = block?.dataset.inlineMediaId;
      const image = block?.querySelector("img");
      if (image && image.src.startsWith("blob:")) URL.revokeObjectURL(image.src);
      if (id) filesById.delete(id);
      block?.remove();
      return;
    }
  });

  document.addEventListener("change", (event) => {
    const input = event.target.closest("[data-inline-image-input]");
    if (!input) return;
    const editor = getEditor(input);
    const file = input.files?.[0];
    if (!editor || !file) return;
    if (!file.type.startsWith("image/")) {
      input.value = "";
      setStatus(editor, "Choose an image file to insert.");
      return;
    }
    const fallbackAlt = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    if (insertImage(editor, file, fallbackAlt)) {
      setStatus(editor, "Photo inserted at cursor.");
    }
    input.value = "";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches(".editor-area, [data-editor-area]")) {
          decorateExistingMedia(node);
        }
        node.querySelectorAll?.(".editor-area, [data-editor-area]").forEach(decorateExistingMedia);
      });
    });
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });

  window.ResiHubEditorInlineMedia = {
    decorateExistingMedia,
    getFile(id) {
      return filesById.get(id) || null;
    },
    serialize,
  };
})();
