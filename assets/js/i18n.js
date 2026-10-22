(function () {
  const i18nState = {
    currentLanguage: "en",
    dict: {},
  };
  const I18N_STORAGE_KEY = "resiHubLanguage";
  const SUPPORTED_LANGUAGES = new Set(["en", "fr"]);

  function resolveKey(obj, key) {
    if (!obj || !key) return undefined;
    return key.split(".").reduce((acc, part) => {
      if (acc && Object.prototype.hasOwnProperty.call(acc, part)) {
        return acc[part];
      }
      return undefined;
    }, obj);
  }

  function t(key, fallback = "") {
    const value = resolveKey(i18nState.dict, key);
    if (typeof value === "string") return value;
    return fallback || key;
  }

  function applyTranslations(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const fallback =
        el.getAttribute("data-i18n-fallback") || el.textContent.trim();
      el.textContent = t(key, fallback);
    });

    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      const fallback = el.getAttribute("placeholder") || "";
      el.setAttribute("placeholder", t(key, fallback));
    });

    root.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria-label");
      const fallback = el.getAttribute("aria-label") || "";
      el.setAttribute("aria-label", t(key, fallback));
    });
  }

  function resolvePreferredLanguage() {
    const savedLanguage = (localStorage.getItem(I18N_STORAGE_KEY) || "")
      .trim()
      .toLowerCase();
    if (SUPPORTED_LANGUAGES.has(savedLanguage)) {
      return savedLanguage;
    }
    return "en";
  }

  function buildCatalogUrl(language) {
    const baseUrl = (document.body?.dataset?.baseurl || "").trim();
    const normalizedBase = baseUrl.replace(/\/$/, "");
    return `${normalizedBase}/assets/${language}.json`;
  }

  function updateLanguageControl(selectedLanguage) {
    const languageToggle = document.getElementById("languageToggle");
    if (!languageToggle) return;
    languageToggle.value = SUPPORTED_LANGUAGES.has(selectedLanguage)
      ? selectedLanguage
      : "en";
  }

  async function setLanguage(language) {
    const targetLanguage = SUPPORTED_LANGUAGES.has(language) ? language : "en";

    try {
      let res = await fetch(buildCatalogUrl(targetLanguage), {
        cache: "no-store",
      });
      if (!res.ok && targetLanguage !== "en") {
        res = await fetch(buildCatalogUrl("en"), { cache: "no-store" });
        if (!res.ok) return;
        i18nState.currentLanguage = "en";
      } else if (!res.ok) {
        return;
      } else {
        i18nState.currentLanguage = targetLanguage;
      }

      i18nState.dict = await res.json();
      localStorage.setItem(I18N_STORAGE_KEY, i18nState.currentLanguage);
      applyTranslations(document);
      updateLanguageControl(i18nState.currentLanguage);

      window.dispatchEvent(
        new CustomEvent("resiHub:languageChanged", {
          detail: { language: i18nState.currentLanguage },
        }),
      );
    } catch (_) {
      // Fail silently and keep hardcoded fallback text.
    }
  }

  function initLanguageToggle() {
    const languageToggle = document.getElementById("languageToggle");
    if (!languageToggle) return;

    updateLanguageControl(i18nState.currentLanguage);
    languageToggle.addEventListener("change", function () {
      setLanguage(this.value);
    });
  }

  async function initI18n() {
    i18nState.currentLanguage = resolvePreferredLanguage();
    await setLanguage(i18nState.currentLanguage);
    initLanguageToggle();
  }

  function getCurrentLanguage() {
    return i18nState.currentLanguage || "en";
  }

  window.t = t;
  window.applyTranslations = applyTranslations;
  window.setLanguage = setLanguage;
  window.getCurrentLanguage = getCurrentLanguage;

  document.addEventListener("DOMContentLoaded", initI18n);
})();
