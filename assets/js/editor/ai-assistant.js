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
    autoTags:
      window.ResiHubApi?.ENDPOINTS?.aiAutoTags ||
      "https://api.hubcollective.ca/api/ai/suggestions/auto-tags",
    spellcheck:
      window.ResiHubApi?.ENDPOINTS?.aiSpellcheck ||
      "https://api.hubcollective.ca/api/ai/suggestions/spellcheck",
  };

  let activeSection = null;
  let isSpellcheckRunning = false;

  function debounce(fn, wait = 300) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

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

  function getAssistantForm() {
    return (
      document.getElementById("submissionForm") ||
      document.getElementById("drawer-form") ||
      document.getElementById("drawerForm") ||
      document.querySelector(".submission-form") ||
      null
    );
  }

  function getTitleInput() {
    return (
      document.getElementById("titleInput") ||
      document.getElementById("title") ||
      null
    );
  }

  function getSubmissionType() {
    const hiddenType = document.querySelector('input[name="type"]');
    return String(hiddenType?.value || "wiki").toLowerCase();
  }

  function getAllEditorText() {
    return Array.from(document.querySelectorAll(".editor-area"))
      .map((node) => String(node?.innerText || "").trim())
      .filter(Boolean)
      .join("\n\n");
  }

  function isSubmitPage() {
    return Boolean(document.getElementById("submissionForm"));
  }

  function getEditorDrawer() {
    return (
      document.getElementById("editor-drawer") ||
      document.getElementById("drawer-edit-view") ||
      document.querySelector(".editor-drawer") ||
      null
    );
  }

  function isDrawerPage() {
    return Boolean(getEditorDrawer());
  }

  function isDrawerOpen() {
    const drawer = getEditorDrawer();
    if (!drawer) return true;
    return drawer.classList.contains("is-open");
  }

  function syncAssistantVisibility() {
    // Submit page: keep dock visible
    if (isSubmitPage()) {
      const dock = document.getElementById("ai-assistant-dock");
      if (dock && dock.classList.contains("hidden")) {
        dock.classList.remove("hidden");
      }
      return;
    }

    const panel = document.getElementById("ai-assistant-panel");
    const launcher = document.getElementById("ai-assistant-launcher");
    if (!panel || !launcher) return;

    // Drawer page: inline section suggestions replace the floating assistant.
    if (isDrawerPage()) {
      panel.classList.add("hidden");
      launcher.classList.add("hidden");
      return;
    }

    if (!isDrawerPage()) {
      if (panel.classList.contains("hidden")) {
        launcher.classList.remove("hidden");
      }
      return;
    }
  }

  function ensureDock() {
    let dock = document.getElementById("ai-assistant-dock");
    if (!dock) return null;

    dock.innerHTML = `
      <div class="ai-dock-header">
        <div class="ai-dock-title">
          <i class="fa-solid fa-sparkles" aria-hidden="true"></i>
          <span>AI Assistant</span>
        </div>
      </div>
      <div class="ai-dock-content">
        <section class="ai-dock-section hidden" id="aiDockQualitySection">
          <h4 class="ai-dock-section-title">Content Quality</h4>
          <div class="ai-dock-quality">
            <div class="ai-dock-quality-metric">
              <span class="ai-dock-quality-label">Readability</span>
              <div class="ai-dock-quality-bar"><div class="ai-dock-quality-fill" id="aiDockReadabilityBar"></div></div>
              <span class="ai-dock-quality-value" id="aiDockReadabilityValue">-</span>
            </div>
            <div class="ai-dock-quality-metric">
              <span class="ai-dock-quality-label">Completeness</span>
              <div class="ai-dock-quality-bar"><div class="ai-dock-quality-fill" id="aiDockCompletenessBar"></div></div>
              <span class="ai-dock-quality-value" id="aiDockCompletenessValue">-</span>
            </div>
          </div>
        </section>
        <section class="ai-dock-section" id="aiDockSuggestionsSection">
          <h4 class="ai-dock-section-title">Suggestions</h4>
          <div class="ai-dock-suggestions" id="aiDockSuggestionsList">
            <p class="suggestion-placeholder">Suggestions will appear as you write...</p>
          </div>
        </section>
        <!-- Writing Polish / Spellcheck section disabled for now - will implement later -->
        <!-- <section class="ai-dock-section hidden" id="aiDockSpellSection">
          <h4 class="ai-dock-section-title">Writing Polish</h4>
          <div class="ai-dock-suggestions" id="aiDockSpellChangesList">
            <p class="suggestion-placeholder">Run spellcheck to auto-fix and review changes.</p>
          </div>
          <div class="ai-image-actions" style="margin-top:0.5rem;">
            <button type="button" class="ai-link-btn" data-ai-action="spellcheck-all">Auto-fix all sections</button>
            <button type="button" class="ai-link-btn" data-ai-action="spellcheck-active">Fix active section</button>
          </div>
        </section> -->
        <section class="ai-dock-section hidden" id="aiDockTagsSection">
          <h4 class="ai-dock-section-title">Suggested Tags</h4>
          <div class="ai-dock-suggestions" id="aiDockTagsList"></div>
        </section>
      </div>
    `;

    dock.querySelectorAll("[data-ai-action]").forEach((node) => {
      node.addEventListener("click", () => {
        runAssistantAction(node.getAttribute("data-ai-action") || "");
      });
    });

    return dock;
  }

  function ensurePanel() {
    // On submit page: use dock instead of floating panel
    if (isSubmitPage()) {
      return ensureDock();
    }

    if (isDrawerPage()) {
      return null;
    }

    let panel = document.getElementById("ai-assistant-panel");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = "ai-assistant-panel";
    panel.className = "ai-assistant-panel hidden";
    panel.innerHTML = `
      <div class="ai-panel-header">
        <div class="ai-panel-title">
          <i class="fa-solid fa-sparkles" aria-hidden="true"></i>
          <span>Assistant</span>
        </div>
        <button type="button" class="ai-panel-close" aria-label="Close Assistant">x</button>
      </div>
      <div class="ai-panel-content">
        <section class="ai-section ai-quality-section hidden" id="aiQualitySection">
          <h4 class="ai-section-title">Content Quality</h4>
          <div class="quality-score-container">
            <div class="quality-score-display">
              <div class="quality-score-circle" id="aiOverallScore">
                <span class="quality-score-number">-</span>
                <span class="quality-score-label">Overall</span>
              </div>
              <div class="quality-metrics">
                <div class="quality-metric">
                  <span class="metric-label">Readability</span>
                  <div class="metric-bar"><div class="metric-fill" id="aiReadabilityBar"></div></div>
                  <span class="metric-value" id="aiReadabilityValue">-</span>
                </div>
                <div class="quality-metric">
                  <span class="metric-label">Completeness</span>
                  <div class="metric-bar"><div class="metric-fill" id="aiCompletenessBar"></div></div>
                  <span class="metric-value" id="aiCompletenessValue">-</span>
                </div>
              </div>
            </div>
          </div>
          <div class="quality-meta"><span class="reading-time" id="aiReadingTime"></span></div>
        </section>
        <section class="ai-section" id="aiSuggestionsSection">
          <h4 class="ai-section-title">Suggestions</h4>
          <div class="suggestions-list" id="aiSuggestionsList">
            <p class="suggestion-placeholder">Suggestions will appear as you write...</p>
          </div>
          <p class="ai-action-hint hidden" id="aiActionHint" aria-live="polite"></p>
        </section>
        <!-- Writing Polish / Spellcheck section disabled for now - will implement later -->
        <!-- <section class="ai-section ai-spell-section hidden" id="aiSpellSection">
          <h4 class="ai-section-title">Writing Polish</h4>
          <div class="ai-image-actions">
            <button type="button" class="ai-link-btn" data-ai-action="spellcheck-all">Auto-fix all sections</button>
            <button type="button" class="ai-link-btn" data-ai-action="spellcheck-active">Fix active section</button>
          </div>
          <div class="suggestions-list" id="aiSpellChangesList">
            <p class="suggestion-placeholder">Run spellcheck to auto-fix and review changes.</p>
          </div>
        </section> -->
        <section class="ai-section ai-image-design" id="aiImageDesignSection">
          <h4 class="ai-section-title">Image Design</h4>
          <div class="ai-image-actions">
            <button type="button" class="ai-link-btn" data-ai-action="focus-image">Upload or Replace Image</button>
            <button type="button" class="ai-link-btn" data-ai-action="open-media">Open Media Settings</button>
            <button type="button" class="ai-link-btn" data-ai-action="center-images">Center All Image Layouts</button>
            <button type="button" class="ai-link-btn" data-ai-action="alternate-images">Alternate Left/Right Layout</button>
          </div>
        </section>
        <section class="ai-section ai-title-suggestions hidden" id="aiTitleSuggestionsSection">
          <h4 class="ai-section-title">Title Ideas</h4>
          <div class="title-suggestions-list" id="aiTitleSuggestionsList"></div>
        </section>
        <section class="ai-section ai-tags-section hidden" id="aiTagsSection">
          <h4 class="ai-section-title">Suggested Tags</h4>
          <div class="tags-list" id="aiTagsList"></div>
        </section>
        <div class="ai-loading" id="aiLoadingState" style="display:none;">
          <span class="spinner"></span>
          <span>Analyzing...</span>
        </div>
      </div>
    `;

    const root = document.body || document.documentElement;
    root.appendChild(panel);

    let launcher = document.getElementById("ai-assistant-launcher");
    if (!launcher) {
      launcher = document.createElement("button");
      launcher.id = "ai-assistant-launcher";
      launcher.type = "button";
      launcher.className = "ai-assistant-launcher";
      launcher.setAttribute("aria-label", "Open AI Assistant");
      launcher.textContent = "Suggestions";
      root.appendChild(launcher);
    }

    launcher.addEventListener("click", () => {
      if (isDrawerPage() && !isDrawerOpen()) return;
      panel.classList.remove("hidden");
      launcher.classList.add("hidden");
    });

    const closeBtn = panel.querySelector(".ai-panel-close");
    closeBtn?.addEventListener("click", () => {
      panel.classList.add("hidden");
      if (!isDrawerPage() || isDrawerOpen()) {
        launcher.classList.remove("hidden");
      }
    });

    panel.querySelectorAll("[data-ai-action]").forEach((node) => {
      node.addEventListener("click", () => {
        runAssistantAction(node.getAttribute("data-ai-action") || "");
      });
    });

    syncAssistantVisibility();

    return panel;
  }

  function showActionHint(message) {
    const hint = document.getElementById("aiActionHint");
    if (!hint) return;
    if (!message) {
      hint.classList.add("hidden");
      hint.textContent = "";
      return;
    }
    hint.classList.remove("hidden");
    hint.textContent = message;
  }

  function getAllSections() {
    return Array.from(document.querySelectorAll(".content-section"));
  }

  function resolveActiveSection() {
    const fromFocus = document.activeElement?.closest?.(".content-section");
    if (fromFocus) return fromFocus;
    if (activeSection && document.contains(activeSection)) return activeSection;
    return getAllSections()[0] || null;
  }

  function openMediaDetailsForSection(section, shouldScroll = true) {
    if (!section) return null;
    const details = section.querySelector(".section-settings-panel");
    if (!details) return null;
    details.open = true;
    if (shouldScroll) {
      details.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return details;
  }

  function openMediaDetailsForAllSections() {
    const sections = getAllSections();
    const opened = [];
    sections.forEach((section, index) => {
      const details = openMediaDetailsForSection(section, index === 0);
      if (details) opened.push(details);
    });
    return opened;
  }

  function getEditorForSection(section) {
    return section?.querySelector?.(".editor-area") || null;
  }

  function getOrAssignSectionId(section, index) {
    if (!section) return `section-${index + 1}`;
    const existing = String(section.dataset.aiSectionId || "").trim();
    if (existing) return existing;
    const nextId = `section-${index + 1}`;
    section.dataset.aiSectionId = nextId;
    return nextId;
  }

  function collectSpellcheckSections(activeOnly = false) {
    const sections = getAllSections();
    const active = resolveActiveSection();
    const selected = activeOnly
      ? sections.filter((section) => section === active)
      : sections;

    return selected
      .map((section, index) => {
        const editor = getEditorForSection(section);
        const text = String(editor?.innerText || "").trim();
        if (!editor || !text) return null;
        return {
          id: getOrAssignSectionId(section, index),
          text,
          section,
          editor,
        };
      })
      .filter(Boolean);
  }

  function renderSpellcheckChanges(results, summary) {
    const list = document.getElementById("aiSpellChangesList");
    const dockList = document.getElementById("aiDockSpellChangesList");
    const changed = Array.isArray(results)
      ? results.filter((entry) => entry && entry.changed)
      : [];

    const render = (target) => {
      if (!target) return;
      target.innerHTML = "";

      if (!changed.length) {
        target.innerHTML =
          '<p class="suggestion-placeholder">No spelling/grammar changes were needed.</p>';
        return;
      }

      changed.slice(0, 10).forEach((entry) => {
        const row = document.createElement("div");
        row.className = "suggestion-item";

        const icon = document.createElement("span");
        icon.className = "suggestion-icon";
        icon.textContent = "Aa";

        const text = document.createElement("span");
        text.className = "suggestion-text";
        const topChanges = Array.isArray(entry.changes)
          ? entry.changes.slice(0, 3)
          : [];
        const detail = topChanges
          .map((item) => `${item.from} -> ${item.to} (${item.count})`)
          .join(" | ");
        text.textContent = `Section ${entry.sectionIndex || "?"}: ${entry.totalChanges || 0} edits${detail ? ` - ${detail}` : ""}`;

        row.appendChild(icon);
        row.appendChild(text);
        target.appendChild(row);
      });

      if (summary && Number(summary.changedSections || 0) > changed.length) {
        const more = document.createElement("p");
        more.className = "suggestion-placeholder";
        more.textContent = `+${Number(summary.changedSections) - changed.length} more sections updated.`;
        target.appendChild(more);
      }
    };

    render(list);
    render(dockList);
  }

  async function runSpellcheckForSections(activeOnly = false, options = {}) {
    const opts = {
      silent: false,
      ...options,
    };

    if (isSpellcheckRunning) return;

    const sections = collectSpellcheckSections(activeOnly);
    if (!sections.length) {
      if (!opts.silent) {
        showActionHint("No section text found to spellcheck.");
      }
      return;
    }

    isSpellcheckRunning = true;
    showLoading(true);
    const payload = {
      sections: sections.map((item) => ({ id: item.id, text: item.text })),
    };

    const response = await fetchJson(AI_ENDPOINTS.spellcheck, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    showLoading(false);
    isSpellcheckRunning = false;

    if (!response?.success || !Array.isArray(response.results)) {
      if (!opts.silent) {
        showActionHint(
          "Spellcheck is temporarily unavailable. Please try again.",
        );
      }
      return;
    }

    const byId = new Map(
      response.results.map((entry) => [String(entry.sectionId || ""), entry]),
    );
    let appliedCount = 0;
    sections.forEach((item, index) => {
      const result = byId.get(item.id);
      if (!result || !result.changed) return;

      item.editor.textContent = String(
        result.correctedText || item.editor.textContent || "",
      );
      item.editor.dispatchEvent(new Event("input", { bubbles: true }));

      item.section.classList.add("ai-updated-section");
      setTimeout(
        () => item.section.classList.remove("ai-updated-section"),
        2000 + index * 120,
      );
      appliedCount += 1;
    });

    renderSpellcheckChanges(response.results, response.summary || {});

    if (!appliedCount) {
      if (!opts.silent) {
        showActionHint("No spelling or grammar fixes were needed.");
      }
      return;
    }

    const totalChanges = Number(response.summary?.totalChanges || 0);
    if (!opts.silent) {
      showActionHint(
        `Applied ${totalChanges} writing fix${totalChanges === 1 ? "" : "es"} across ${appliedCount} section${appliedCount === 1 ? "" : "s"}.`,
      );
    }
  }

  function runAssistantAction(action) {
    const actions = {
      "focus-editor": () => {
        const section = resolveActiveSection();
        const editor = getEditorForSection(section);
        if (!editor) {
          showActionHint("Add a section first, then update content.");
          return;
        }
        activeSection = section;
        editor.scrollIntoView({ behavior: "smooth", block: "center" });
        editor.focus();
        showActionHint(
          "Editor focused. Update the text based on this suggestion.",
        );
      },
      "add-section": () => {
        const addBtn =
          document.getElementById("add-section-btn") ||
          document.querySelector("#drawer-edit-view .btn-add-sec");
        if (!addBtn) {
          showActionHint("Section controls are unavailable on this view.");
          return;
        }
        addBtn.click();
        const editors = document.querySelectorAll(
          ".content-section .editor-area",
        );
        const latest = editors[editors.length - 1];
        if (latest) {
          latest.scrollIntoView({ behavior: "smooth", block: "center" });
          latest.focus();
        }
        showActionHint(
          "New section added. Add details to improve completeness.",
        );
      },
      "focus-image": () => {
        const section =
          resolveActiveSection() ||
          getAllSections().find((item) => item.querySelector(".file-input"));
        openMediaDetailsForSection(section);
        const input = section?.querySelector?.(".file-input") || null;
        if (!input) {
          showActionHint("No image field found. Add a section first.");
          return;
        }
        activeSection = section;
        input.focus();
        input.click();
        showActionHint("Choose an image to strengthen the visual design.");
      },
      "open-media": () => {
        const opened = openMediaDetailsForAllSections();
        if (!opened.length) {
          showActionHint("No media settings found. Add a section first.");
          return;
        }
        const section = resolveActiveSection();
        openMediaDetailsForSection(section);
        activeSection = section;
        showActionHint(
          `Media settings opened for ${opened.length} section${opened.length > 1 ? "s" : ""}.`,
        );
      },
      "center-images": () => {
        const aligns = Array.from(
          document.querySelectorAll(
            'select[name="section_align[]"], .content-section .align-select',
          ),
        );
        if (!aligns.length) {
          showActionHint("No image alignment controls found yet.");
          return;
        }
        aligns.forEach((select) => {
          select.value = "center";
          select.dispatchEvent(new Event("change", { bubbles: true }));
        });
        showActionHint("All section image alignments set to Center.");
      },
      "alternate-images": () => {
        const aligns = Array.from(
          document.querySelectorAll(
            'select[name="section_align[]"], .content-section .align-select',
          ),
        );
        if (!aligns.length) {
          showActionHint("No image alignment controls found yet.");
          return;
        }
        aligns.forEach((select, index) => {
          const mode = index % 2 === 0 ? "left" : "right";
          select.value = mode;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        });
        showActionHint(
          "Applied alternating left/right alignment for visual rhythm.",
        );
      },
      "spellcheck-all": () => {
        runSpellcheckForSections(false);
      },
      "spellcheck-active": () => {
        runSpellcheckForSections(true);
      },
    };

    const handler = actions[action];
    if (handler) handler();
  }

  function resolveSuggestionAction(text) {
    const value = String(text || "").toLowerCase();
    if (!value) return null;
    if (value.includes("break long sentences")) {
      return { id: "focus-editor", label: "Fix in Editor" };
    }
    if (
      value.includes("add more detail") ||
      value.includes("add more sections")
    ) {
      return { id: "add-section", label: "Add Section" };
    }
    if (value.includes("paragraph")) {
      return { id: "focus-editor", label: "Edit Paragraphs" };
    }
    if (value.includes("image") || value.includes("visual")) {
      return { id: "focus-image", label: "Add Image" };
    }
    return { id: "focus-editor", label: "Update Content" };
  }

  function showLoading(show) {
    const loading = document.getElementById("aiLoadingState");
    if (loading) loading.style.display = show ? "flex" : "none";
  }

  function getSectionOrdinal(section) {
    const sections = getAllSections();
    const index = sections.findIndex((item) => item === section);
    return index >= 0 ? index + 1 : 1;
  }

  function collapseSectionSuggestions(exceptSection = null) {
    getAllSections().forEach((section) => {
      const details = section.querySelector(".ai-section-inline");
      const meta = section.querySelector(".ai-section-inline__meta");
      if (!details) return;
      // Only collapse — never force-open anything here.
      if (section !== exceptSection) {
        details.open = false;
        if (meta) meta.textContent = "Collapsed";
      }
    });
  }

  function renderSectionSuggestions(section, items) {
    if (!section) return;

    const details = section.querySelector(".ai-section-inline");
    const list = section.querySelector(".ai-section-inline__list");
    const meta = section.querySelector(".ai-section-inline__meta");
    const title = section.querySelector(".ai-section-inline__title");
    if (!details || !list) return;

    if (title) {
      title.textContent = `AI Suggestion · Section ${getSectionOrdinal(section)}`;
    }

    if (!Array.isArray(items) || !items.length) {
      details.classList.add("hidden");
      details.open = false;
      list.innerHTML = "";
      if (meta) meta.textContent = "Collapsed";
      // collapseSectionSuggestions(null);
      return;
    }

    details.classList.remove("hidden");
    // details.open = true;
    // Do NOT auto-open. User opens by tapping the badge or summary.
    if (meta)
      meta.textContent = `${Math.min(items.length, 2)} suggestion${Math.min(items.length, 2) === 1 ? "" : "s"}`;
    list.innerHTML = "";

    items.slice(0, 2).forEach((text) => {
      const row = document.createElement("div");
      row.className = "suggestion-item suggestion-item--inline";

      const icon = document.createElement("span");
      icon.className = "suggestion-icon";
      icon.textContent = "*";

      const body = document.createElement("span");
      body.className = "suggestion-text";
      body.textContent = String(text || "");

      row.appendChild(icon);
      row.appendChild(body);
      list.appendChild(row);
    });

    // collapseSectionSuggestions(section);
  }

  //Unused
  function scrollSectionSuggestionIntoView(section) {
    const details = section?.querySelector(".ai-section-inline");
    if (!details || details.classList.contains("hidden")) return;

    const rect = details.getBoundingClientRect();
    const topSafeZone = 110;
    const bottomSafeZone = window.innerHeight - 120;
    const isOutsideView =
      rect.top < topSafeZone || rect.bottom > bottomSafeZone;

    if (isOutsideView) {
      details.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }

  function renderSuggestions(items) {
    const list = document.getElementById("aiSuggestionsList");
    const dockList = document.getElementById("aiDockSuggestionsList");

    if (!list && !dockList) return;

    if (!Array.isArray(items) || !items.length) {
      if (list)
        list.innerHTML =
          '<p class="suggestion-placeholder">Suggestions will appear as you write...</p>';
      if (dockList)
        dockList.innerHTML =
          '<p class="suggestion-placeholder">Suggestions will appear as you write...</p>';
      return;
    }

    const renderList = (targetList) => {
      if (!targetList) return;
      targetList.innerHTML = "";
      items.forEach((text) => {
        const isSuggestion =
          targetList.id === "aiSuggestionsList" ||
          targetList.id === "aiDockSuggestionsList";
        const row = document.createElement(isSuggestion ? "div" : "button");
        row.className = isSuggestion ? "suggestion-item" : "ai-dock-suggestion";
        row.type = isSuggestion ? "" : "button";

        const icon = document.createElement("span");
        icon.className = isSuggestion
          ? "suggestion-icon"
          : "ai-dock-suggestion-icon";
        icon.textContent = "*";

        const body = document.createElement("span");
        body.className = isSuggestion
          ? "suggestion-text"
          : "ai-dock-suggestion-text";
        body.textContent = String(text || "");

        const actionMeta = resolveSuggestionAction(text);
        if (actionMeta && isSuggestion) {
          const action = document.createElement("button");
          action.type = "button";
          action.className = "ai-link-btn ai-link-btn--inline";
          action.textContent = actionMeta.label;
          action.addEventListener("click", () =>
            runAssistantAction(actionMeta.id),
          );
          row.appendChild(icon);
          row.appendChild(body);
          row.appendChild(action);
        } else {
          row.appendChild(icon);
          row.appendChild(body);
        }
        targetList.appendChild(row);
      });
    };

    if (list) renderList(list);
    if (dockList) renderList(dockList);
  }

  function renderTags(tags) {
    const section = document.getElementById("aiTagsSection");
    const list = document.getElementById("aiTagsList");
    const tagsInput = document.getElementById("tagsInput");
    const dockSection = document.getElementById("aiDockTagsSection");
    const dockList = document.getElementById("aiDockTagsList");

    if (!tagsInput) return;
    if (!Array.isArray(tags) || !tags.length) {
      if (section) section.classList.add("hidden");
      if (dockSection) dockSection.classList.add("hidden");
      return;
    }

    if (section) section.classList.remove("hidden");
    if (dockSection) dockSection.classList.remove("hidden");

    const renderTagList = (targetList) => {
      if (!targetList) return;
      targetList.innerHTML = "";
      tags.forEach((tag) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "tag-item";
        item.title = "Add this tag";

        const text = document.createElement("span");
        text.className = "tag-text";
        text.textContent = String(tag || "");

        item.appendChild(text);
        item.addEventListener("click", () => {
          const incoming = String(tag || "").trim();
          if (!incoming) return;

          const existing = String(tagsInput.value || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
          const hasTag = existing.some(
            (value) => value.toLowerCase() === incoming.toLowerCase(),
          );
          if (hasTag) {
            showActionHint(`Tag already added: ${incoming}`);
            return;
          }

          existing.push(incoming);
          tagsInput.value = existing.join(", ");
          tagsInput.dispatchEvent(new Event("input", { bubbles: true }));
          showActionHint(`Added tag: ${incoming}`);
        });
        targetList.appendChild(item);
      });
    };

    if (list) renderTagList(list);
    if (dockList) renderTagList(dockList);
  }

  function renderTitleSuggestions(suggestions) {
    const section = document.getElementById("aiTitleSuggestionsSection");
    const list = document.getElementById("aiTitleSuggestionsList");
    const titleInput = getTitleInput();
    if (!section || !list || !titleInput) return;

    if (!Array.isArray(suggestions) || !suggestions.length) {
      section.classList.add("hidden");
      return;
    }

    section.classList.remove("hidden");
    list.innerHTML = "";

    suggestions.forEach((entry) => {
      const wrap = document.createElement("div");
      wrap.className = "title-suggestion-item";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "title-suggestion-btn";
      btn.dataset.title = String(entry?.title || "");

      const txt = document.createElement("span");
      txt.className = "suggestion-text";
      txt.textContent = String(entry?.title || "");

      const reason = document.createElement("span");
      reason.className = "suggestion-reason";
      reason.textContent = `(${String(entry?.reason || "suggested")})`;

      btn.appendChild(txt);
      btn.appendChild(reason);
      btn.addEventListener("click", () => {
        titleInput.value = btn.dataset.title || "";
        titleInput.dispatchEvent(new Event("input", { bubbles: true }));
      });

      wrap.appendChild(btn);
      list.appendChild(wrap);
    });
  }

  function renderQuality(analysis) {
    const section = document.getElementById("aiQualitySection");
    if (!analysis) return;
    if (section) {
      section.classList.remove("hidden");
    }

    const readability = Number(analysis.readabilityScore || 0);
    const completeness = Number(analysis.completenessScore || 0);

    const readBar = document.getElementById("aiReadabilityBar");
    const readValue = document.getElementById("aiReadabilityValue");
    const compBar = document.getElementById("aiCompletenessBar");
    const compValue = document.getElementById("aiCompletenessValue");
    const readTime = document.getElementById("aiReadingTime");

    if (readBar)
      readBar.style.width = `${Math.max(0, Math.min(100, readability))}%`;
    if (readValue) readValue.textContent = `${Math.round(readability)}%`;
    if (compBar)
      compBar.style.width = `${Math.max(0, Math.min(100, completeness))}%`;
    if (compValue) compValue.textContent = `${Math.round(completeness)}%`;
    if (readTime) readTime.textContent = analysis.readingTime || "";

    // Also update dock if on submit page
    const dockQualitySection = document.getElementById("aiDockQualitySection");
    if (dockQualitySection) {
      dockQualitySection.classList.remove("hidden");
      const dockReadBar = document.getElementById("aiDockReadabilityBar");
      const dockReadValue = document.getElementById("aiDockReadabilityValue");
      const dockCompBar = document.getElementById("aiDockCompletenessBar");
      const dockCompValue = document.getElementById("aiDockCompletenessValue");

      if (dockReadBar)
        dockReadBar.style.width = `${Math.max(0, Math.min(100, readability))}%`;
      if (dockReadValue)
        dockReadValue.textContent = `${Math.round(readability)}%`;
      if (dockCompBar)
        dockCompBar.style.width = `${Math.max(0, Math.min(100, completeness))}%`;
      if (dockCompValue)
        dockCompValue.textContent = `${Math.round(completeness)}%`;
    }

    const suggestions = Array.isArray(analysis.suggestions)
      ? [...analysis.suggestions]
      : [];
    const overall = Number(analysis.overallScore);
    const readabilityScore = Number(analysis.readabilityScore);
    if (Number.isFinite(overall) || Number.isFinite(readabilityScore)) {
      const scoreLineParts = [];
      if (Number.isFinite(overall)) {
        scoreLineParts.push(`Overall: ${Math.round(overall)}`);
      }
      if (Number.isFinite(readabilityScore)) {
        scoreLineParts.push(`Readability: ${Math.round(readabilityScore)}`);
      }
      suggestions.unshift(scoreLineParts.join(", "));
    }

    renderSuggestions(suggestions);
  }

  const runTitlePass = debounce(async () => {
    const titleInput = getTitleInput();
    const title = String(titleInput?.value || "").trim();
    if (title.length < 3) return;

    showLoading(true);
    const type = getSubmissionType();

    const [titleResult, tagsResult] = await Promise.all([
      fetchJson(
        `${AI_ENDPOINTS.titleSuggestions}?${new URLSearchParams({ title, type }).toString()}`,
      ),
      fetchJson(
        `${AI_ENDPOINTS.autoTags}?${new URLSearchParams({ title, type }).toString()}`,
      ),
    ]);

    showLoading(false);
    renderTitleSuggestions(titleResult?.suggestions || []);
    renderTags(tagsResult?.tags || []);
  }, 700);

  const runContentPass = debounce(async () => {
    const section = resolveActiveSection();
    const editor = getEditorForSection(section);
    const content = String(editor?.innerText || "").trim();
    if (content.length < 20) return;

    const title = String(getTitleInput()?.value || "").trim();
    const type = getSubmissionType();

    showLoading(true);
    const result = await fetchJson(AI_ENDPOINTS.contentQuality, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, type, content }),
    });
    showLoading(false);

    if (result?.analysis) {
      const analysis = {
        ...result.analysis,
        suggestions: Array.isArray(result.analysis.suggestions)
          ? [...result.analysis.suggestions]
          : [],
      };

      const sectionSuggestions = [];
      const overall = Number(analysis.overallScore);
      const readabilityScore = Number(analysis.readabilityScore);
      if (Number.isFinite(overall) || Number.isFinite(readabilityScore)) {
        const scoreLineParts = [];
        if (Number.isFinite(overall)) {
          scoreLineParts.push(`Overall: ${Math.round(overall)}`);
        }
        if (Number.isFinite(readabilityScore)) {
          scoreLineParts.push(`Readability: ${Math.round(readabilityScore)}`);
        }
        sectionSuggestions.push(scoreLineParts.join(", "));
      }

      const hasImage = Boolean(
        section?.querySelector(".file-input")?.files?.length ||
        section?.querySelector(".existing-image-path")?.value,
      );

      if (!hasImage) {
        analysis.suggestions.unshift(
          "Add a supporting image to improve visual storytelling.",
        );
      }

      sectionSuggestions.push(...analysis.suggestions);

      renderQuality(analysis);
      renderSectionSuggestions(section, sectionSuggestions);
      // scrollSectionSuggestionIntoView(section);
      updateSectionAIBadge(section, analysis.overallScore);
      return;
    }

    renderSectionSuggestions(section, [
      "AI analysis is temporarily unavailable. Keep writing and try again.",
    ]);
    scrollSectionSuggestionIntoView(section);
    renderSuggestions([
      "AI analysis is temporarily unavailable. Keep writing and try again.",
    ]);
  }, 1200);

  function updateSectionAIBadge(section, score) {
    if (!section) return;
    const header = section.querySelector(".section-header");
    if (!header) return;

    let badge = header.querySelector(".ai-section-badge");
    if (!badge) {
      badge = document.createElement("button");
      badge.type = "button";
      badge.className = "ai-section-badge";
      badge.setAttribute("aria-label", "Show AI suggestions");

      badge.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const details = section.querySelector(".ai-section-inline");
        if (details && !details.classList.contains("hidden")) {
          details.open = !details.open;
          if (details.open) {
            // Only NOW do we scroll — user asked for it
            details.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }
      });

      const removeBtn = header.querySelector(".btn-remove-sec");
      if (removeBtn) {
        header.insertBefore(badge, removeBtn);
      } else {
        header.appendChild(badge);
      }
    }

    const n = Number(score) || 0;
    badge.textContent = String(Math.round(n));
    badge.dataset.score = String(Math.round(n));
    badge.classList.toggle("is-good", n >= 75);
    badge.classList.toggle("is-fair", n >= 50 && n < 75);
    badge.classList.toggle("is-low", n < 50);
    badge.hidden = false;
  }

  function initializeAIAssistant() {
    const form = getAssistantForm();
    const titleInput = getTitleInput();
    if (!form || !titleInput) return;

    if (form.dataset.aiAssistantReady === "true") return;
    form.dataset.aiAssistantReady = "true";

    ensurePanel();

    // Sync visibility on submit page
    if (isSubmitPage()) {
      syncAssistantVisibility();
    }

    if (isDrawerPage()) {
      const drawer = getEditorDrawer();
      if (drawer) {
        const observer = new MutationObserver(syncAssistantVisibility);
        observer.observe(drawer, {
          attributes: true,
          attributeFilter: ["class"],
        });
      }
      syncAssistantVisibility();
    }

    document.addEventListener("focusin", (event) => {
      // Don't trigger on AI UI elements — they manage their own state
      if (event.target?.closest?.(".ai-section-badge, .ai-section-inline"))
        return;
      const section = event.target?.closest?.(".content-section");
      if (section) {
        activeSection = section;
        // Intentionally do NOT auto-open the panel.
      }
    });

    document.addEventListener("click", (event) => {
      if (event.target?.closest?.(".ai-section-badge, .ai-section-inline"))
        return;
      const section = event.target?.closest?.(".content-section");
      if (section) {
        activeSection = section;
        // Intentionally do NOT auto-open the panel.
      }
    });

    titleInput.addEventListener("input", runTitlePass);
    document.addEventListener("input", (event) => {
      if (event.target && event.target.closest(".editor-area")) {
        const section = event.target.closest(".content-section");
        if (section) activeSection = section;
        runContentPass();
      }
    });
  }

  window.ResiHubAiAssistant = {
    initializeAIAssistant,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeAIAssistant);
  } else {
    initializeAIAssistant();
  }
})();
