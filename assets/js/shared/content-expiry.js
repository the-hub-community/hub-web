(function initContentExpiry() {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const expiredContent = document.querySelector("[data-expires-at]");
    if (expiredContent) {
      let expiresAt = new Date(expiredContent.dataset.expiresAt);
      if (!Number.isFinite(expiresAt.getTime()) && expiredContent.dataset.createdAt) {
        const createdAt = new Date(expiredContent.dataset.createdAt);
        if (Number.isFinite(createdAt.getTime())) {
          const ttlHours = expiredContent.dataset.contentType === "notification" ? 48 : 120;
          expiresAt = new Date(createdAt.getTime() + ttlHours * 60 * 60 * 1000);
        }
      }
      if (
        Number.isFinite(expiresAt.getTime()) &&
        expiresAt.getTime() < Date.now()
      ) {
        const notice = document.createElement("p");
        notice.className = "wiki-expired-notice";
        notice.setAttribute("role", "status");
        notice.textContent = "This broadcast or notice has expired and is no longer available.";
        expiredContent.replaceWith(notice);
        return;
      }
    }

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
