(function initCharCounter() {
  "use strict";

  const WARN_THRESHOLD = 0.8;
  const HARD_LIMIT_MARGIN = 10;

  function getHintEl(inputEl) {
    const existing = inputEl.parentElement?.querySelector(".char-count");
    if (existing) return existing;
    const hint = document.createElement("small");
    hint.className = "char-count";
    hint.setAttribute("aria-live", "polite");
    inputEl.parentElement.appendChild(hint);
    return hint;
  }

  function attachCounter(inputEl) {
    if (!inputEl || inputEl.dataset.counterAttached === "true") return;
    const max = Number(inputEl.dataset.charLimit || inputEl.maxLength || 0);
    if (!max || max <= 0) return;

    inputEl.dataset.counterAttached = "true";
    const hint = getHintEl(inputEl);
    const isEditable = inputEl.getAttribute("contenteditable") === "true";

    const readLength = () =>
      isEditable
        ? (inputEl.innerText || "").length
        : inputEl.value?.length || 0;

    const update = () => {
      const len = readLength();
      const ratio = len / max;
      const remaining = max - len;
      hint.textContent = `${len} / ${max}`;
      hint.classList.toggle(
        "is-warn",
        ratio >= WARN_THRESHOLD && remaining > HARD_LIMIT_MARGIN,
      );
      hint.classList.toggle("is-over", remaining <= 0);
    };

    let raf = null;
    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    inputEl.addEventListener("input", schedule);
    inputEl.addEventListener("paste", () => setTimeout(update, 0));
    inputEl.addEventListener("cut", () => setTimeout(update, 0));
    update();
  }

  function autoAttach(root = document) {
    root.querySelectorAll("[data-char-limit]").forEach(attachCounter);
  }

  window.ResiHubCharCounter = { attachCounter };

  document.addEventListener("DOMContentLoaded", () => {
    autoAttach();
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.matches?.("[data-char-limit]")) attachCounter(node);
          node.querySelectorAll?.("[data-char-limit]").forEach(attachCounter);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
