(function initContentExpiry() {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const validUntil = document.body?.dataset.validUntil || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) return;

    const expiresAt = new Date(`${validUntil}T23:59:59Z`);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() >= Date.now()) {
      return;
    }

    const detail = document.querySelector(".detail-shell");
    if (!detail) return;

    const notice = document.createElement("p");
    notice.className = "wiki-expired-notice";
    notice.setAttribute("role", "status");
    notice.textContent = "This listing has expired and is no longer available.";
    detail.replaceWith(notice);
  });
})();
