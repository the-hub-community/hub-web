(function initImageFallback() {
  "use strict";

  const FALLBACK = (category = "General") => {
    const iconMap = {
      Food: "fa-utensils",
      Parking: "fa-car",
      Rentals: "fa-key",
      Services: "fa-wrench",
      "Items for Sale": "fa-box-open",
      General: "fa-store",
    };
    const icon = iconMap[category] || iconMap.General;
    return `
      <div class="empty-state empty-state--inline" data-category="${category}">
        <div class="empty-state__icon" aria-hidden="true">
          <i class="fa-solid ${icon}"></i>
        </div>
        <p class="empty-state__label">Photos coming soon</p>
      </div>`;
  };

  function replaceWithFallback(img) {
    const box = img.closest(
      ".ad-image-box, .listing-gallery-stage, .review-preview-card__media, .lh-image-container, .detail-gallery__hero",
    );
    if (!box || box.dataset.fallbackApplied) return;
    const category =
      box.closest("[data-category]")?.dataset.category ||
      img.dataset.category ||
      "General";
    box.dataset.fallbackApplied = "true";
    box.innerHTML = FALLBACK(category);
    box.classList.add("has-fallback");
  }

  function scan(root = document) {
    root.querySelectorAll("img:not([data-fallback-bound])").forEach((img) => {
      img.dataset.fallbackBound = "true";
      img.addEventListener("error", () => replaceWithFallback(img), {
        once: true,
      });
      if (img.complete && img.naturalWidth === 0) replaceWithFallback(img);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    scan();
    const observer = new MutationObserver(() => scan());
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
