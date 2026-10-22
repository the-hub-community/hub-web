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
    const picker = {
      container,
      images: options.images ? [...options.images] : [],
    };
    state.pickers.set(container, picker);
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

    if (!picker.images.length) return;

    const strip = document.createElement("ul");
    strip.className = "image-picker__strip";
    strip.setAttribute("role", "list");

    picker.images.forEach((img) => {
      const li = document.createElement("li");
      li.className = "image-picker__item";
      li.dataset.id = img.id;
      li.dataset.align = img.align || "center";

      const thumbSrc = img.previewUrl || img.url;
      li.innerHTML = `
        <img src="${escapeAttr(thumbSrc)}" alt="${escapeAttr(img.alt || "")}" class="image-picker__thumb">
        <button type="button" class="image-picker__menu" aria-label="Image options">
          <i class="fa-solid fa-ellipsis" aria-hidden="true"></i>
        </button>
      `;

      li.querySelector(".image-picker__thumb").addEventListener("click", () =>
        openLightbox(thumbSrc),
      );
      li.querySelector(".image-picker__menu").addEventListener("click", (e) => {
        e.stopPropagation();
        openEditSheet(picker, img.id);
      });

      strip.appendChild(li);
    });

    container.appendChild(strip);
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
    if (!imageFiles.length) return;

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
    const lastAdded = picker.images[picker.images.length - imageFiles.length];
    if (lastAdded) openEditSheet(picker, lastAdded.id);
  }

  // ── Edit sheet ─────────────────────────────────────────
  function openEditSheet(picker, imageId) {
    const img = picker.images.find((i) => i.id === imageId);
    if (!img) return;

    const index = picker.images.indexOf(img);
    const isFirst = index === 0;
    const isLast = index === picker.images.length - 1;

    const sheet = ensureSheet("image-edit-sheet");
    sheet.innerHTML = `
      <div class="image-sheet__backdrop" data-close="true"></div>
      <div class="image-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="image-edit-title">
        <div class="image-sheet__handle"></div>
        <h3 class="image-sheet__title" id="image-edit-title">Edit image</h3>
        <div class="image-edit__preview"><img src="${escapeAttr(img.previewUrl || img.url)}" alt=""></div>

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
        </div>

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
        if (li) li.dataset.align = align;
      });
    });

    const altInput = sheet.querySelector("#image-alt-input");
    altInput.addEventListener("input", () => {
      img.alt = altInput.value;
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

    requestAnimationFrame(() => altInput.focus());
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
  function openLightbox(src) {
    let lb = document.getElementById("image-picker-lightbox");
    if (!lb) {
      lb = document.createElement("div");
      lb.id = "image-picker-lightbox";
      lb.className = "image-picker-lightbox";
      lb.innerHTML = `
        <button type="button" class="image-picker-lightbox__close" aria-label="Close preview">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <img alt="">
      `;
      document.body.appendChild(lb);
      lb.addEventListener("click", (e) => {
        if (
          e.target === lb ||
          e.target.closest(".image-picker-lightbox__close")
        ) {
          lb.classList.remove("is-open");
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && lb.classList.contains("is-open"))
          lb.classList.remove("is-open");
      });
    }
    lb.querySelector("img").src = src;
    lb.classList.add("is-open");
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
    if (e.key === "Escape") closeSheet();
  });

  function escapeAttr(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  window.ResiHubImagePicker = { mount, getImages, clear };
})();
