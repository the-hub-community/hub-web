/**
 * image-picker.js — Mobile-first multi-image upload with alignment and alt text.
 */
(function initImagePicker() {
  "use strict";

  if (window.__resiHubImagePickerLoaded) return;
  window.__resiHubImagePickerLoaded = true;

  const state = {
    pickers: new WeakMap(),
    activePicker: null,
  };

  let idCounter = 0;
  const nextId = () => `img-${Date.now()}-${++idCounter}`;

  // ── Public API ─────────────────────────────────────────
  function mount(container, options = {}) {
    if (!container || state.pickers.has(container)) return;
    container.classList.remove("dropzone");
    container.removeAttribute("style");
    container.classList.add("image-picker");
    const picker = {
      container,
      images: options.images ? [...options.images] : [],
    };
    state.pickers.set(container, picker);
    bindDropEvents(container, picker);
    render(container, picker);
  }

  function setImages(container, images = []) {
    if (!container) return;

    const nextImages = Array.isArray(images) ? [...images] : [];
    let picker = state.pickers.get(container);
    if (!picker) {
      mount(container, { images: nextImages });
      return;
    }

    const retainedPreviewUrls = new Set(
      nextImages.map((img) => img.previewUrl).filter(Boolean),
    );
    picker.images.forEach((img) => {
      if (
        img.isLocal &&
        img.previewUrl &&
        !retainedPreviewUrls.has(img.previewUrl)
      ) {
        URL.revokeObjectURL(img.previewUrl);
      }
    });

    picker.images = nextImages;
    render(container, picker);
  }

  function getImages(container) {
    const p = state.pickers.get(container);
    return p ? [...p.images] : [];
  }

  function clear(container) {
    const p = state.pickers.get(container);
    if (!p) return;
    p.images.forEach((img) => {
      if (img.isLocal && img.previewUrl) URL.revokeObjectURL(img.previewUrl);
    });
    p.images = [];
    render(container, p);
  }

  function bindDropEvents(container, picker) {
    let dragDepth = 0;
    const hasFiles = (dataTransfer) =>
      Array.from(dataTransfer?.types || []).includes("Files");
    const clearDragState = () => {
      dragDepth = 0;
      container.classList.remove("is-dragover");
    };

    container.addEventListener("dragenter", (event) => {
      if (!hasFiles(event.dataTransfer)) return;
      event.preventDefault();
      dragDepth += 1;
      container.classList.add("is-dragover");
    });

    container.addEventListener("dragover", (event) => {
      if (!hasFiles(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    });

    container.addEventListener("dragleave", (event) => {
      if (!hasFiles(event.dataTransfer)) return;
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      const nextTarget = event.relatedTarget;
      if (
        dragDepth === 0 ||
        !(nextTarget instanceof Node) ||
        !container.contains(nextTarget)
      ) {
        clearDragState();
      }
    });

    container.addEventListener("drop", (event) => {
      if (!hasFiles(event.dataTransfer)) return;
      event.preventDefault();
      clearDragState();
      handleFiles(picker, Array.from(event.dataTransfer.files || []));
    });

    container.addEventListener("dragend", clearDragState);
  }

  // ── Render ─────────────────────────────────────────────
  function render(container, picker) {
    container.innerHTML = "";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "image-picker__add";
    addBtn.innerHTML = `
      <i class="fa-solid fa-plus" aria-hidden="true"></i>
      <span>${picker.images.length ? "Add more images" : "Add image"}</span>
    `;
    addBtn.addEventListener("click", () => openSourceSheet(picker));
    container.appendChild(addBtn);

    const status = document.createElement("p");
    status.className = "image-picker__status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.hidden = true;
    container.appendChild(status);

    if (!picker.images.length) {
      container.dispatchEvent(
        new CustomEvent("resiHub:image-picker-change", {
          bubbles: true,
          detail: { count: 0 },
        }),
      );
      return;
    }

    const strip = document.createElement("ul");
    strip.className = "image-picker__strip";
    strip.setAttribute("role", "list");
    const isGallery = picker.images.length > 1;

    picker.images.forEach((img, index) => {
      const li = document.createElement("li");
      li.className = "image-picker__item";
      li.dataset.id = img.id;
      li.dataset.gallery = String(isGallery);
      const align = ["left", "right"].includes(img.align)
        ? img.align
        : "center";
      li.dataset.align = align;

      const thumbSrc = img.previewUrl || img.url;
      li.innerHTML = `
        <img src="${escapeAttr(thumbSrc)}" alt="${escapeAttr(img.alt || "")}" class="image-picker__thumb">
        <span class="image-picker__badge">${isGallery ? `Photo ${index + 1}` : `${index + 1} · ${align}`}</span>
        <button type="button" class="image-picker__menu" aria-label="Edit image ${index + 1}" title="Edit image">
          <i class="fa-solid fa-pen" aria-hidden="true"></i>
        </button>
      `;

      li.querySelector(".image-picker__thumb").addEventListener("click", (e) => {
        e.stopPropagation();
        openLightbox(picker, img.id);
      });
      li.querySelector(".image-picker__menu").addEventListener("click", (e) => {
        e.stopPropagation();
        openEditSheet(picker, img.id);
      });

      strip.appendChild(li);
    });

    container.appendChild(strip);
    if (isGallery) {
      const galleryNote = document.createElement("p");
      galleryNote.className = "image-picker__gallery-note";
      galleryNote.textContent =
        "Gallery layout is automatic. Edit photos to add alt text, reorder, or remove.";
      container.appendChild(galleryNote);
    }
    container.dispatchEvent(
      new CustomEvent("resiHub:image-picker-change", {
        bubbles: true,
        detail: { count: picker.images.length },
      }),
    );
  }

  // ── Source sheet ───────────────────────────────────────
  function openSourceSheet(picker) {
    state.activePicker = picker;
    const sheet = ensureSheet("image-source-sheet");
    sheet.innerHTML = `
      <div class="image-sheet__backdrop" data-close="true"></div>
      <div class="image-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="image-source-title">
        <div class="image-sheet__handle"></div>
        <h3 class="image-sheet__title" id="image-source-title">Add images</h3>
        <button type="button" class="image-source__option" data-source="camera">
          <i class="fa-solid fa-camera" aria-hidden="true"></i><span>Take photo</span>
        </button>
        <button type="button" class="image-source__option" data-source="library">
          <i class="fa-solid fa-image" aria-hidden="true"></i><span>Photo library</span>
        </button>
        <button type="button" class="image-source__option" data-source="files">
          <i class="fa-solid fa-paperclip" aria-hidden="true"></i><span>Choose files</span>
        </button>
        <button type="button" class="image-source__cancel" data-close="true">Cancel</button>
      </div>
    `;
    sheet.classList.add("is-open");

    sheet
      .querySelectorAll("[data-close]")
      .forEach((el) => el.addEventListener("click", closeSheet));
    sheet.querySelectorAll(".image-source__option").forEach((btn) => {
      btn.addEventListener("click", () => {
        const source = btn.dataset.source;
        closeSheet();
        triggerFilePicker(picker, source);
      });
    });

    requestAnimationFrame(() =>
      sheet.querySelector(".image-source__option")?.focus(),
    );
  }

  // ── File picker ────────────────────────────────────────
  function triggerFilePicker(picker, source) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    if (source === "camera") input.capture = "environment";
    input.style.display = "none";

    input.addEventListener("change", () => {
      handleFiles(picker, Array.from(input.files || []));
      input.remove();
    });

    document.body.appendChild(input);
    input.click();
  }

  function handleFiles(picker, files) {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    const rejectedCount = files.length - imageFiles.length;
    if (!imageFiles.length) {
      setPickerStatus(
        picker,
        files.length
          ? "No images added. Choose image files to upload."
          : "",
      );
      return;
    }

    imageFiles.forEach((file) => {
      picker.images.push({
        id: nextId(),
        file,
        previewUrl: URL.createObjectURL(file),
        url: "",
        alt: "",
        align: "center",
        isLocal: true,
      });
    });

    render(picker.container, picker);
    if (rejectedCount > 0) {
      setPickerStatus(
        picker,
        `${rejectedCount} non-image file${rejectedCount === 1 ? "" : "s"} skipped. Only images were added.`,
      );
    }
    const lastAdded = picker.images[picker.images.length - imageFiles.length];
    if (lastAdded) openEditSheet(picker, lastAdded.id);
  }

  function setPickerStatus(picker, message) {
    const status = picker.container.querySelector(".image-picker__status");
    if (!status) return;
    status.textContent = message;
    status.hidden = !message;
  }

  // ── Edit sheet ─────────────────────────────────────────
  function openEditSheet(picker, imageId) {
    const img = picker.images.find((i) => i.id === imageId);
    if (!img) return;

    const index = picker.images.indexOf(img);
    const isFirst = index === 0;
    const isLast = index === picker.images.length - 1;
    const isGallery = picker.images.length > 1;

    const sheet = ensureSheet("image-edit-sheet");
    sheet.innerHTML = `
      <div class="image-sheet__backdrop" data-close="true"></div>
      <div class="image-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="image-edit-title">
        <div class="image-sheet__handle"></div>
        <button type="button" class="image-sheet__close" aria-label="Close image editor" title="Close image editor">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
        <h3 class="image-sheet__title" id="image-edit-title">Edit image</h3>
        <div class="image-edit__preview"><img src="${escapeAttr(img.previewUrl || img.url)}" alt=""></div>

        ${isGallery ? `
        <p class="image-edit__gallery-note">
          This photo is part of a gallery. Gallery photos stay centered automatically.
        </p>` : `
        <div class="image-edit__row">
          <label>Alignment</label>
          <div class="segmented" role="radiogroup" aria-label="Image alignment">
            <button type="button" class="segmented__btn" role="radio" data-align="left" aria-checked="${img.align === "left"}">
              <i class="fa-solid fa-align-left"></i><span>Left</span>
            </button>
            <button type="button" class="segmented__btn" role="radio" data-align="center" aria-checked="${img.align === "center"}">
              <i class="fa-solid fa-align-center"></i><span>Center</span>
            </button>
            <button type="button" class="segmented__btn" role="radio" data-align="right" aria-checked="${img.align === "right"}">
              <i class="fa-solid fa-align-right"></i><span>Right</span>
            </button>
          </div>
        </div>`}

        <div class="image-edit__row">
          <label for="image-alt-input">Alt text (for screen readers)</label>
          <input type="text" id="image-alt-input" placeholder="Describe this image"
                 value="${escapeAttr(img.alt || "")}" maxlength="160">
        </div>

        <div class="image-edit__actions">
          <button type="button" data-action="move-up" ${isFirst ? "disabled" : ""}>
            <i class="fa-solid fa-arrow-up"></i>Move up
          </button>
          <button type="button" data-action="move-down" ${isLast ? "disabled" : ""}>
            <i class="fa-solid fa-arrow-down"></i>Move down
          </button>
          <button type="button" class="is-danger" data-action="remove">
            <i class="fa-solid fa-trash"></i>Remove image
          </button>
        </div>
      </div>
    `;
    sheet.classList.add("is-open");

    sheet
      .querySelectorAll("[data-close]")
      .forEach((el) => el.addEventListener("click", closeSheet));
    sheet
      .querySelector(".image-sheet__close")
      ?.addEventListener("click", closeSheet);

    sheet.querySelectorAll(".segmented__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const align = btn.dataset.align;
        img.align = align;
        sheet.querySelectorAll(".segmented__btn").forEach((b) => {
          b.setAttribute(
            "aria-checked",
            b.dataset.align === align ? "true" : "false",
          );
        });
        const li = picker.container.querySelector(`[data-id="${img.id}"]`);
        if (li) {
          li.dataset.align = align;
          const badge = li.querySelector(".image-picker__badge");
          if (badge) badge.textContent = `${index + 1} · ${align}`;
        }
        picker.container.dispatchEvent(
          new CustomEvent("resiHub:image-picker-change", {
            bubbles: true,
            detail: { count: picker.images.length },
          }),
        );
      });
    });

    const altInput = sheet.querySelector("#image-alt-input");
    altInput.addEventListener("input", () => {
      img.alt = altInput.value;
      picker.container.dispatchEvent(
        new CustomEvent("resiHub:image-picker-change", {
          bubbles: true,
          detail: { count: picker.images.length },
        }),
      );
    });

    sheet
      .querySelector("[data-action='move-up']")
      ?.addEventListener("click", () => {
        moveImage(picker, img.id, -1);
        closeSheet();
        openEditSheet(picker, img.id);
      });
    sheet
      .querySelector("[data-action='move-down']")
      ?.addEventListener("click", () => {
        moveImage(picker, img.id, 1);
        closeSheet();
        openEditSheet(picker, img.id);
      });
    sheet
      .querySelector("[data-action='remove']")
      ?.addEventListener("click", () => {
        removeImage(picker, img.id);
        closeSheet();
      });

    requestAnimationFrame(() => sheet.querySelector(".image-sheet__close")?.focus());
  }

  function moveImage(picker, imageId, delta) {
    const idx = picker.images.findIndex((i) => i.id === imageId);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= picker.images.length) return;
    const [item] = picker.images.splice(idx, 1);
    picker.images.splice(target, 0, item);
    render(picker.container, picker);
  }

  function removeImage(picker, imageId) {
    const idx = picker.images.findIndex((i) => i.id === imageId);
    if (idx < 0) return;
    const [removed] = picker.images.splice(idx, 1);
    if (removed.isLocal && removed.previewUrl)
      URL.revokeObjectURL(removed.previewUrl);
    render(picker.container, picker);
  }

  // ── Lightbox ───────────────────────────────────────────
  function openLightbox(picker, imageId) {
    let lb = document.getElementById("image-picker-lightbox");
    if (!lb) {
      lb = document.createElement("div");
      lb.id = "image-picker-lightbox";
      lb.className = "image-picker-lightbox";
      lb.innerHTML = `
        <button type="button" class="image-picker-lightbox__nav image-picker-lightbox__nav--previous" aria-label="Previous image">
          <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
        </button>
        <button type="button" class="image-picker-lightbox__close" aria-label="Close preview">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <img alt="">
        <span class="image-picker-lightbox__count" aria-live="polite"></span>
        <button type="button" class="image-picker-lightbox__nav image-picker-lightbox__nav--next" aria-label="Next image">
          <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </button>
      `;
      document.body.appendChild(lb);
      lb.addEventListener("click", (e) => {
        if (
          e.target === lb ||
          e.target.closest(".image-picker-lightbox__close")
        ) {
          closePickerLightbox(lb);
        }
      });
      lb.querySelector(".image-picker-lightbox__nav--previous").addEventListener(
        "click",
        () => stepLightboxImage(-1),
      );
      lb.querySelector(".image-picker-lightbox__nav--next").addEventListener(
        "click",
        () => stepLightboxImage(1),
      );
    }
    state.lightboxPicker = picker;
    state.lightboxImageId = imageId;
    renderLightboxImage(lb);
    lb.classList.add("is-open");
  }

  function renderLightboxImage(lightbox) {
    const picker = state.lightboxPicker;
    if (!picker) return;
    const index = picker.images.findIndex(
      (image) => image.id === state.lightboxImageId,
    );
    if (index < 0) {
      lightbox.classList.remove("is-open");
      state.lightboxPicker = null;
      state.lightboxImageId = null;
      return;
    }

    const image = picker.images[index];
    const imageElement = lightbox.querySelector("img");
    imageElement.src = image.previewUrl || image.url;
    imageElement.alt = image.alt || "";
    lightbox.querySelector(".image-picker-lightbox__count").textContent =
      `${index + 1} / ${picker.images.length}`;
    lightbox.querySelectorAll(".image-picker-lightbox__nav").forEach((button) => {
      button.hidden = picker.images.length < 2;
    });
  }

  function stepLightboxImage(delta) {
    const picker = state.lightboxPicker;
    if (!picker || picker.images.length < 2) return;
    const index = picker.images.findIndex(
      (image) => image.id === state.lightboxImageId,
    );
    const nextIndex = (index + delta + picker.images.length) % picker.images.length;
    state.lightboxImageId = picker.images[nextIndex].id;
    renderLightboxImage(document.getElementById("image-picker-lightbox"));
  }

  function closePickerLightbox(lightbox) {
    lightbox.classList.remove("is-open");
    state.lightboxPicker = null;
    state.lightboxImageId = null;
  }

  // ── Sheet infra ────────────────────────────────────────
  function ensureSheet(id) {
    let sheet = document.getElementById(id);
    if (!sheet) {
      sheet = document.createElement("div");
      sheet.id = id;
      sheet.className = "image-sheet";
      document.body.appendChild(sheet);
    }
    return sheet;
  }

  function closeSheet() {
    document
      .querySelectorAll(".image-sheet.is-open")
      .forEach((s) => s.classList.remove("is-open"));
    state.activePicker = null;
  }

  document.addEventListener("keydown", (e) => {
    const lightbox = document.getElementById("image-picker-lightbox");
    if (lightbox?.classList.contains("is-open")) {
      if (e.key === "Escape") {
        closePickerLightbox(lightbox);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        stepLightboxImage(e.key === "ArrowRight" ? 1 : -1);
      }
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const item = e.target.closest?.(".image-picker__item");
      const items = item
        ? Array.from(item.parentElement.querySelectorAll(".image-picker__item"))
        : [];
      if (items.length < 2) return;
      const currentIndex = items.indexOf(item);
      const nextIndex =
        (currentIndex + (e.key === "ArrowRight" ? 1 : -1) + items.length) %
        items.length;
      const nextButton = items[nextIndex].querySelector(".image-picker__menu");
      if (!nextButton) return;
      e.preventDefault();
      nextButton.focus();
      nextButton.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
    if (e.key === "Escape") closeSheet();
  });

  function escapeAttr(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  window.ResiHubImagePicker = { mount, setImages, getImages, clear };
})();
