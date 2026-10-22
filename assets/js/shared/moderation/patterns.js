/**
 * moderation/patterns.js
 * Layer 1 — structural abuse detection.
 *
 * Catches things that regex can identify without needing a wordlist:
 *   - Contact harvesting (dense phone/email, shorteners)
 *   - Spam signatures (all-caps, repetition, marketing hype)
 *   - PII injection (card numbers, government IDs, addresses)
 *
 * Never names a category to the user. Messages are neutral.
 */
(function initPatterns() {
  "use strict";
  if (window.ResiHubPatterns) return;

  const RULES = [
    // ── Contact harvesting ────────────────────────────────────
    {
      id: "phone-dense",
      severity: "flag",
      test: (t) => (t.match(/\+?\d[\d\s\-().]{8,}\d/g) || []).length >= 3,
      message:
        "It looks like you're sharing several phone numbers. Please share one clear way for people to reach you.",
    },
    {
      id: "email-dense",
      severity: "flag",
      test: (t) =>
        (t.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) || []).length >=
        3,
      message:
        "Multiple email addresses detected. Consider consolidating to one.",
    },
    {
      id: "url-shortener",
      severity: "warn",
      test: (t) =>
        /(bit\.ly|tinyurl|t\.co|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly)/i.test(t),
      message:
        "Shortened links can hide where they're going. Consider sharing the full address.",
    },

    // ── Spam signatures ───────────────────────────────────────
    {
      id: "marketing-shout",
      severity: "warn",
      test: (t) => {
        const letters = t.replace(/[^A-Za-z]/g, "");
        if (letters.length < 40) return false;
        const caps = (t.match(/[A-Z]/g) || []).length;
        return caps / letters.length > 0.6;
      },
      message:
        "All-caps text reads as shouting. Consider mixed case for a friendlier tone.",
    },
    {
      id: "repetition",
      severity: "warn",
      test: (t) => {
        const words = t.toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length < 20) return false;
        const counts = words.reduce((m, w) => {
          if (w.length < 4) return m;
          m[w] = (m[w] || 0) + 1;
          return m;
        }, {});
        return Object.values(counts).some((n) => n >= 8);
      },
      message: "Some words are repeated many times. Try rewording for clarity.",
    },
    {
      id: "guarantee-hype",
      severity: "flag",
      test: (t) =>
        /\b(guaranteed|risk.?free|100%\s*(?:profit|return|success)|instant\s*(?:money|cash|profit))\b/i.test(
          t,
        ),
      message:
        "Claims like 'guaranteed' or 'risk-free' can't be verified. Consider describing what you're offering more plainly.",
    },

    // ── PII injection ─────────────────────────────────────────
    {
      id: "payment-card",
      severity: "block",
      test: (t) => /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(t),
      message:
        "This content contains something that looks like a payment card. Please remove it before posting.",
    },
    {
      id: "gov-id",
      severity: "block",
      test: (t) => /\b\d{3}-\d{2}-\d{4}\b/.test(t),
      message:
        "This content contains something that looks like a government ID. Please remove it before posting.",
    },

    // ── Structural junk ───────────────────────────────────────
    {
      id: "empty-links",
      severity: "warn",
      test: (t) =>
        /(https?:\/\/\s*(?:\s|$))|(href\s*=\s*["']?\s*["']?)/i.test(t),
      message: "Some links appear to have no destination.",
    },
  ];

  /**
   * @param {string} text
   * @returns {{
   *   ok: boolean,
   *   code?: string,
   *   severity?: "block" | "flag" | "warn",
   *   message?: string
   * }}
   */
  function check(text) {
    const t = String(text || "");
    if (!t.trim()) return { ok: true };

    // Block-level first. One hit and we stop.
    for (const rule of RULES) {
      if (rule.severity !== "block") continue;
      if (rule.test(t)) {
        return {
          ok: false,
          code: rule.id,
          severity: "block",
          message: rule.message,
        };
      }
    }

    // Then flags / warns. Keep the highest severity.
    let worst = null;
    for (const rule of RULES) {
      if (rule.severity === "block") continue;
      if (rule.test(t)) {
        if (!worst || (rule.severity === "flag" && worst.severity === "warn")) {
          worst = rule;
        }
      }
    }

    if (!worst) return { ok: true };
    return {
      ok: true,
      code: worst.id,
      severity: worst.severity,
      message: worst.message,
    };
  }

  window.ResiHubPatterns = { check };
})();
