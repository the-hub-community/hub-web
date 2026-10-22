(function initSubmissionProgress() {
  "use strict";

  var state = {
    root: null,
    bar: null,
    label: null,
    detail: null,
    timerId: null,
    progress: 0,
  };

  function injectStyles() {
    if (document.getElementById("submission-progress-styles")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "submission-progress-styles";
    style.textContent = [
      ".submission-progress-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;pointer-events:none;z-index:11000;opacity:0;transition:opacity .22s ease;}",
      ".submission-progress-overlay.is-visible{opacity:1;}",
      ".submission-progress-card{width:min(460px,calc(100vw - 32px));padding:16px 18px;border:1px solid rgba(37,99,235,.16);border-radius:18px;background:rgba(255,255,255,.92);box-shadow:0 20px 45px rgba(15,23,42,.16);backdrop-filter:blur(16px);}",
      ".submission-progress-label{display:block;margin:0 0 6px;font:800 14px/1.3 'Plus Jakarta Sans',sans-serif;color:#0f172a;letter-spacing:.02em;}",
      ".submission-progress-detail{display:block;margin:0 0 12px;font:500 12px/1.4 Inter,system-ui,sans-serif;color:#475569;}",
      ".submission-progress-track{height:10px;border-radius:999px;background:rgba(148,163,184,.22);overflow:hidden;}",
      ".submission-progress-bar{height:100%;width:0%;border-radius:inherit;background:linear-gradient(90deg,#2563eb,#06b6d4);transition:width .22s ease,background .22s ease;}",
      ".submission-progress-overlay.is-success .submission-progress-bar{background:linear-gradient(90deg,#10b981,#22c55e);}",
      ".submission-progress-overlay.is-error .submission-progress-bar{background:linear-gradient(90deg,#ef4444,#f97316);}",
      "@media (max-width: 640px){.submission-progress-overlay{padding:16px;}.submission-progress-card{width:min(100vw - 24px,420px);padding:14px 16px;}}",
    ].join("");
    document.head.appendChild(style);
  }

  function ensureDom() {
    if (state.root) {
      return;
    }

    injectStyles();

    var root = document.createElement("div");
    root.className = "submission-progress-overlay";
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-atomic", "true");
    root.innerHTML = [
      '<div class="submission-progress-card" role="status">',
      '  <strong class="submission-progress-label">Submitting...</strong>',
      '  <span class="submission-progress-detail">Please wait while your request is processed.</span>',
      '  <div class="submission-progress-track"><div class="submission-progress-bar"></div></div>',
      "</div>",
    ].join("");

    document.body.appendChild(root);
    state.root = root;
    state.bar = root.querySelector(".submission-progress-bar");
    state.label = root.querySelector(".submission-progress-label");
    state.detail = root.querySelector(".submission-progress-detail");
  }

  function clearTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function setProgress(value) {
    state.progress = Math.max(0, Math.min(100, value));
    if (state.bar) {
      state.bar.style.width = state.progress + "%";
    }
  }

  function hideSoon(delayMs) {
    window.setTimeout(function () {
      if (!state.root) {
        return;
      }
      state.root.classList.remove("is-visible", "is-success", "is-error");
      setProgress(0);
    }, delayMs);
  }

  function start(message, detail) {
    ensureDom();
    clearTimer();

    state.root.classList.remove("is-success", "is-error");
    state.root.classList.add("is-visible");
    state.label.textContent = message || "Submitting...";
    state.detail.textContent =
      detail || "Please wait while your request is processed.";
    setProgress(12);

    state.timerId = window.setInterval(function () {
      if (state.progress >= 92) {
        return;
      }
      setProgress(state.progress + Math.random() * 12);
    }, 280);
  }

  function complete(message, detail) {
    ensureDom();
    clearTimer();
    state.root.classList.remove("is-error");
    state.root.classList.add("is-visible", "is-success");
    state.label.textContent = message || "Submission complete";
    state.detail.textContent =
      detail || "Your request was processed successfully.";
    setProgress(100);
    hideSoon(700);
  }

  function error(message, detail) {
    ensureDom();
    clearTimer();
    state.root.classList.remove("is-success");
    state.root.classList.add("is-visible", "is-error");
    state.label.textContent = message || "Submission failed";
    state.detail.textContent =
      detail || "The request stopped before it could complete.";
    setProgress(100);
    hideSoon(1200);
  }

  window.ResiHubSubmissionProgress = {
    start: start,
    complete: complete,
    error: error,
  };
})();
