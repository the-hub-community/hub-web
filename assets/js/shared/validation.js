(function initValidation() {
  "use strict";
  const cache = new Map();

  async function friendlyError(rawError, fieldName = "field") {
    if (!rawError) return "Something went wrong. Please try again.";
    const key = `${fieldName}:${rawError}`;
    if (cache.has(key)) return cache.get(key);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);

    try {
      const res = await fetch("/api/ai/rewrite-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: rawError, field: fieldName }),
        signal: controller.signal,
      });
      const data = await res.json();
      const text = data.text || rawError;
      cache.set(key, text);
      return text;
    } catch {
      return rawError;
    } finally {
      clearTimeout(timer);
    }
  }

  window.ResiHubValidation = { friendlyError };
})();
