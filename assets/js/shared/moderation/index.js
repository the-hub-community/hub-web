/**
 * moderation/index.js
 * Public API for the moderation cascade.
 *
 * Layers (in order):
 *   1 — patterns.js     (sync, ~15ms)
 *   2 — semantic        (async via gateway, ~800ms)
 *
 * Layer 0 (blocklist) is intentionally not implemented here.
 * Category moderation is handled server-side by the semantic layer.
 *
 * Usage:
 *   const v = await ResiHubModeration.check(text, { context: "comment" });
 *   if (!v.ok)            → show v.blockMessage, stop
 *   else if (v.warnMessage) → show inline hint, proceed
 *   if (v.flagged)        → proceed, attach flag to payload
 */
(function initModeration() {
  "use strict";
  if (window.ResiHubModeration) return;

  // Skip semantic check for trivially short text.
  const MIN_LENGTH_FOR_SEMANTIC = 40;

  // Layer 2 (semantic) runs server-side on the gateway submit path,
  // where it has access to Llama Guard with proper timeouts. Calling it
  // from the client adds ~28s to every submission on the free tier.
  // Client-side moderation is patterns-only.
  const CLIENT_SEMANTIC_ENABLED = false;

  /**
   * @param {string} text
   * @param {object} [options]
   * @param {string} [options.context] — "comment" | "wiki" | "listing" | "broadcast" | "notification"
   * @returns {Promise<{
   *   ok: boolean,
   *   flagged: boolean,
   *   blockMessage?: string,
   *   warnMessage?: string,
   *   flagReason?: string
   * }>}
   */
  async function check(text, options = {}) {
    const input = String(text || "").trim();
    if (!input) return { ok: true, flagged: false };

    // ── Layer 1: patterns ─────────────────────────────────────
    const l1 = window.ResiHubPatterns?.check(input);
    if (l1 && !l1.ok) {
      return {
        ok: false,
        flagged: false,
        blockMessage: l1.message,
      };
    }

    let flagged = false;
    let flagReason = null;
    let warnMessage = null;

    if (l1 && l1.severity === "flag") {
      flagged = true;
      flagReason = l1.code;
    } else if (l1 && l1.severity === "warn") {
      warnMessage = l1.message;
    }

    // ── Layer 2: semantic (async, optional) ───────────────────
    // if (input.length >= MIN_LENGTH_FOR_SEMANTIC && navigator.onLine) {
    if (
      CLIENT_SEMANTIC_ENABLED &&
      input.length >= MIN_LENGTH_FOR_SEMANTIC &&
      navigator.onLine
    ) {
      try {
        const l2 = await semanticCheck(input, options.context);
        if (l2 && !l2.ok) {
          return {
            ok: false,
            flagged: false,
            blockMessage:
              l2.message ||
              "This content can't be posted. Please review our community guidelines.",
          };
        }
        if (l2 && l2.flagged) {
          flagged = true;
          flagReason = flagReason || "semantic";
        }
      } catch (_) {
        // Fail open. The gateway re-checks server-side anyway.
      }
    }

    return { ok: true, flagged, flagReason, warnMessage };
  }

  /**
   * Layer 2 — semantic check via gateway.
   * The gateway runs Llama Guard 3 server-side.
   */
  async function semanticCheck(text, context) {
    const endpoint =
      window.ResiHubApi?.ENDPOINTS?.moderate ||
      `${(window.API_BASE || "").replace(/\/+$/, "")}/api/moderate`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, context: context || "generic" }),
    });

    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data) return null;

    return {
      ok: data.safe !== false,
      flagged: data.flagged === true,
      message: data.message,
    };
  }

  window.ResiHubModeration = { check };
})();
