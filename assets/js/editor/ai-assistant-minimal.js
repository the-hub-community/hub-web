/**
 * Simplified AI Assistant for Hub Content Builder
 * Provides lightweight, non-intrusive writing suggestions
 */

(function initResiHubAiAssistant() {
  "use strict";

  if (window.__resiHubAiAssistantLoaded) {
    return;
  }
  window.__resiHubAiAssistantLoaded = true;

  const AI_ENDPOINTS = {
    titleSuggestions:
      window.ResiHubApi?.ENDPOINTS?.aiTitleSuggestions ||
      "https://api.hubcollective.ca/api/ai/suggestions/title",
    contentQuality:
      window.ResiHubApi?.ENDPOINTS?.aiContentQuality ||
      "https://api.hubcollective.ca/api/ai/suggestions/content-quality",
  };

  async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (_err) {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function getTitleInput() {
    return (
      document.getElementById("titleInput") ||
      document.getElementById("title") ||
      null
    );
  }

  function getAllEditorText() {
    const blocks = Array.from(document.querySelectorAll(".editor-area"));
    return blocks
      .map((node) => String(node?.innerText || "").trim())
      .filter(Boolean)
      .join("\n\n");
  }

  function showSuggestion(message) {
    const dock = document.getElementById("ai-assistant-dock");
    const suggestionMsg = document.getElementById("suggestion-message");

    if (!dock || !suggestionMsg) return;

    if (!message) {
      dock.classList.add("hidden");
      return;
    }

    suggestionMsg.textContent = message;
    dock.classList.remove("hidden");

    // Remove auto-hide - keep visible until user closes it
  }

  function hideSuggestion() {
    const dock = document.getElementById("ai-assistant-dock");
    if (dock) {
      dock.classList.add("hidden");
    }
  }

  function formatScoreSummary(analysis) {
    const overallScore = Number(analysis?.overallScore);
    const readabilityScore = Number(analysis?.readabilityScore);

    if (Number.isFinite(overallScore) && Number.isFinite(readabilityScore)) {
      return ` Overall: ${overallScore}, Readability: ${readabilityScore}.`;
    }

    if (Number.isFinite(overallScore)) {
      return ` Overall: ${overallScore}.`;
    }

    if (Number.isFinite(readabilityScore)) {
      return ` Readability: ${readabilityScore}.`;
    }

    return "";
  }

  async function analyzeTitleQuality() {
    const titleInput = getTitleInput();
    if (!titleInput || !titleInput.value.trim()) return;

    const title = titleInput.value.trim();

    const apiResult = await fetchJson(
      `${AI_ENDPOINTS.titleSuggestions}?title=${encodeURIComponent(title)}&type=wiki`,
    );
    const topSuggestion = apiResult?.suggestions?.[0];
    if (apiResult?.success && topSuggestion?.title) {
      if (
        String(topSuggestion.title || "").toLowerCase() !==
        String(title).toLowerCase()
      ) {
        showSuggestion(`✨ Try title: ${topSuggestion.title}`);
        return;
      }
      showSuggestion("✨ Great title! Clear and descriptive.");
      return;
    }

    if (title.length > 4 && title[0] === title[0].toLowerCase()) {
      showSuggestion(
        "💡 Consider capitalizing the first letter of your title.",
      );
      return;
    }

    if (title.length < 5) {
      showSuggestion(
        "📝 Your title seems short. Consider adding more descriptive words.",
      );
      return;
    }

    if (title.length > 80) {
      showSuggestion(
        "✂️ Your title is quite long. Try shortening it to under 80 characters.",
      );
      return;
    }

    // Show encouragement
    showSuggestion("✨ Great title! Clear and descriptive.");
  }

  async function analyzeContentQuality() {
    const editorText = getAllEditorText();
    if (!editorText || editorText.length < 10) return;

    const apiResult = await fetchJson(AI_ENDPOINTS.contentQuality, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: editorText,
        title: getTitleInput()?.value?.trim() || "",
        type: "wiki",
      }),
    });

    const analysis = apiResult?.analysis;
    if (apiResult?.success && analysis) {
      const scoreSummary = formatScoreSummary(analysis);

      if (Array.isArray(analysis.suggestions) && analysis.suggestions.length) {
        showSuggestion(`📚 ${analysis.suggestions[0]}${scoreSummary}`);
        return;
      }

      const score = Number(analysis.overallScore || 0);
      if (score >= 80) {
        showSuggestion(`✅ Great structure and readability.${scoreSummary}`);
      } else if (score >= 60) {
        showSuggestion(
          `📝 Good draft. Add a little more detail to strengthen it.${scoreSummary}`,
        );
      } else {
        showSuggestion(
          `📚 Add more detail and clearer paragraph structure.${scoreSummary}`,
        );
      }
      return;
    }

    const wordCount = editorText.split(/\s+/).length;

    if (wordCount < 50) {
      showSuggestion(
        "📚 Add more detail to your content for better quality (aim for 50+ words).",
      );
      return;
    }

    if (wordCount > 2000) {
      showSuggestion(
        "💬 Your content is quite long. Consider breaking it into multiple sections.",
      );
      return;
    }

    showSuggestion("✅ Good content length and structure!");
  }

  // Initialize event listeners
  document.addEventListener("DOMContentLoaded", () => {
    const titleInput = getTitleInput();

    // AI suggestion close button
    const aiDock = document.getElementById("ai-assistant-dock");
    if (aiDock) {
      const closeBtn = aiDock.querySelector(".suggestion-close-btn");
      if (closeBtn) {
        closeBtn.addEventListener("click", hideSuggestion);
      }
    }

    if (titleInput) {
      let titleTimeout;
      titleInput.addEventListener("input", () => {
        clearTimeout(titleTimeout);
        titleTimeout = setTimeout(analyzeTitleQuality, 1000);
      });
    }

    // Analyze content as user types
    document.addEventListener("input", (e) => {
      if (e.target.classList.contains("editor-area")) {
        let contentTimeout;
        clearTimeout(contentTimeout);
        contentTimeout = setTimeout(analyzeContentQuality, 2000);
      }
    });
  });
})();
