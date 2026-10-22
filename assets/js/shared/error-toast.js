function i18nText(key, fallback) {
  if (typeof window.t === "function") {
    return window.t(key, fallback);
  }
  return fallback;
}

export function showErrorMessage(message) {
  const errorDiv = document.createElement("div");
  errorDiv.className = "app-error-toast";
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  setTimeout(() => errorDiv.remove(), 5000);
}

export function initGlobalErrorHandling() {
  if (window.__appGlobalErrorHandlersAttached) {
    return;
  }

  window.__appGlobalErrorHandlersAttached = true;

  window.addEventListener("error", (e) => {
    console.error("JavaScript Error:", e.error);
    showErrorMessage(
      i18nText(
        "messages.unexpected_error_refresh",
        "An unexpected error occurred. Please refresh the page.",
      ),
    );
  });

  window.addEventListener("unhandledrejection", (e) => {
    console.error("Unhandled Promise Rejection (API Failure):", e.reason);
    showErrorMessage(
      i18nText(
        "messages.network_error_check",
        "A network or API error occurred. Please check your connection and try again.",
      ),
    );
  });
}
