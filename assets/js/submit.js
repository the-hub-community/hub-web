// Functions deepCleanHTML, htmlToMarkdown, i18nText, etc. are loaded globally from hub-builder.js and error-toast.js

const SUBMIT_ENDPOINT =
  window.ResiHubApi?.ENDPOINTS?.submit || "http://localhost:3000/api/submit";
const SUBMIT_TIMEOUT_MS = 30000;

// --- Consolidated DOMContentLoaded Handler ---
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    // Step navigation
    const steps = Array.from(document.querySelectorAll(".thc-step"));
    const tabs = Array.from(document.querySelectorAll(".thc-step-tab"));
    let currentStep = 0;
    function showStep(idx) {
      steps.forEach((s, i) => {
        s.classList.toggle("active", i === idx);
        s.style.display = i === idx ? "" : "none";
      });
      tabs.forEach((t, i) => {
        t.classList.toggle("active", i === idx);
        t.setAttribute("aria-selected", i === idx ? "true" : "false");
      });
      currentStep = idx;
      if (idx === 2) {
        document.querySelectorAll(".editor-area").forEach((ed) => ed.blur());
        fillPreview();
      }
    }
    tabs.forEach((tab, idx) => {
      tab.addEventListener("click", () => showStep(idx));
    });
    document.querySelectorAll(".thc-next").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (currentStep < 2) showStep(currentStep + 1);
      });
    });
    document.querySelectorAll(".thc-back").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (currentStep > 0) showStep(currentStep - 1);
      });
    });
    // Community dropdown logic
    const commSelect = document.getElementById("thcCommunitySelect");
    const newCommGroup = document.querySelector(".thc-new-community");
    // --- Ensure community dropdown event is attached after options are populated ---
    if (commSelect && newCommGroup) {
      // If options are not present, wait for them to be populated
      const ensureCommunityDropdown = () => {
        if (commSelect.options.length === 0) {
          setTimeout(ensureCommunityDropdown, 50);
          return;
        }
        commSelect.addEventListener("change", function () {
          if (commSelect.value === "__new__") {
            newCommGroup.style.display = "";
            const newCommInput = document.getElementById("thcNewCommunity");
            if (newCommInput) newCommInput.required = true;
          } else {
            newCommGroup.style.display = "none";
            const newCommInput = document.getElementById("thcNewCommunity");
            if (newCommInput) newCommInput.required = false;
          }
        });
        // Trigger once on load in case default is __new__
        commSelect.dispatchEvent(new Event("change"));
      };
      ensureCommunityDropdown();
    }
    // Section logic
    const sectionContainer = document.getElementById("thc-sections-container");
    const sectionTemplate = document.getElementById("thc-section-template");
    const addSectionBtn = document.getElementById("thc-add-section");
    function addSection() {
      if (!sectionTemplate || !sectionContainer) return;
      const clone = sectionTemplate.content.cloneNode(true);
      const section = clone.querySelector(".content-section");
      if (!section) return;
      const removeBtn = section.querySelector(".thc-remove-section");
      if (removeBtn) {
        removeBtn.addEventListener("click", function () {
          section.remove();
        });
      }
      const editor = section.querySelector(".editor-area");
      if (editor) {
        section.querySelectorAll("[data-cmd]").forEach((btn) => {
          btn.addEventListener("click", function () {
            editor.focus();
            document.execCommand(btn.dataset.cmd, false, null);
          });
        });
        editor.addEventListener("focus", function () {
          if (editor.classList.contains("empty"))
            editor.classList.remove("empty");
        });
        editor.addEventListener("blur", function () {
          if (!editor.textContent.trim()) editor.classList.add("empty");
        });
        editor.classList.add("empty");
        editor.addEventListener("input", function () {
          const hidden = section.querySelector('input[name="section_text[]"]');
          if (hidden) hidden.value = deepCleanHTML(editor.innerHTML);
        });
      }
      sectionContainer.appendChild(clone);
    }
    if (addSectionBtn) {
      addSectionBtn.addEventListener("click", addSection);
    }
    // Always add a default section if none exists
    if (
      sectionContainer &&
      sectionTemplate &&
      !sectionContainer.querySelector(".content-section")
    ) {
      addSection();
    }
    // Content type toggle
    const articleBlock = document.querySelector(".thc-content-article");
    const reviewBlock = document.querySelector(".thc-content-review");
    document.querySelectorAll('input[name="content_type"]').forEach((radio) => {
      radio.addEventListener("change", function () {
        if (this.value === "article") {
          articleBlock.style.display = "";
          reviewBlock.style.display = "none";
        } else {
          articleBlock.style.display = "none";
          reviewBlock.style.display = "";
        }
      });
    });
    // Rating selector
    const ratingBtns = document.querySelectorAll(".thc-rating-btn");
    const ratingInput = document.getElementById("thcReviewRating");
    ratingBtns.forEach((btn) => {
      btn.addEventListener("click", function () {
        ratingBtns.forEach((b) => b.classList.remove("selected"));
        this.classList.add("selected");
        ratingInput.value = this.dataset.rating;
      });
    });
    // Preview step
    function fillPreview() {
      const comm =
        commSelect?.options[commSelect.selectedIndex]?.textContent || "";
      const title = document.getElementById("thcPageTitle")?.value || "";
      const tags = document.getElementById("thcTags")?.value || "";
      const type =
        document.querySelector('input[name="content_type"]:checked')?.value ||
        "article";
      let html = `<div><strong>Community:</strong> ${comm}</div>`;
      html += `<div><strong>Page title:</strong> ${title}</div>`;
      html += `<div><strong>Type:</strong> ${type === "article" ? "Article / Guide" : "Review"}</div>`;
      if (tags) html += `<div><strong>Tags:</strong> ${tags}</div>`;
      if (type === "article") {
        const sections = document.querySelectorAll(".content-section");
        html += `<div style='margin-top:1em'><strong>Content:</strong>`;
        sections.forEach((section, idx) => {
          const rawHtml =
            section.querySelector(".editor-area")?.innerHTML || "";
          const cleanedHtml = deepCleanHTML(rawHtml);
          const imgInput = section.querySelector('input[type="file"]');
          const alignInput = section.querySelector(
            'select[name="section_align[]"]',
          );
          const align = alignInput ? alignInput.value : "center";
          let imgHtml = "";
          let alignClass = "review-preview-card__media--center";
          if (align === "left") alignClass = "review-preview-card__media--left";
          else if (align === "right")
            alignClass = "review-preview-card__media--right";
          if (imgInput && imgInput.files && imgInput.files[0]) {
            const url = URL.createObjectURL(imgInput.files[0]);
            imgHtml = `<div class="review-preview-card__media ${alignClass}"><img src="${url}" alt="Section image" style="border-radius:8px;box-shadow:0 2px 8px #0001"></div>`;
          }
          html += `<div style="margin:18px 0 0 0"><strong>Section ${idx + 1}:</strong><div>${imgHtml}${cleanedHtml}</div></div>`;
        });
        html += `</div>`;
      } else {
        html += `<div style='margin-top:1em'><strong>Review subject:</strong> ${document.getElementById("thcReviewSubject")?.value || ""}</div>`;
        const rating = Number(ratingInput?.value || 0);
        html += `<div><strong>Rating:</strong> ${'<i class="fa fa-star"></i>'.repeat(rating)}</div>`;
        html += `<div><strong>What's great:</strong> ${(document.getElementById("thcReviewPros")?.value || "").replace(/\n/g, "<br>")}</div>`;
        html += `<div><strong>What could be better:</strong> ${(document.getElementById("thcReviewCons")?.value || "").replace(/\n/g, "<br>")}</div>`;
        html += `<div><strong>Summary:</strong> ${document.getElementById("thcReviewSummary")?.value || ""}</div>`;
      }
      document.querySelector(".thc-preview-card").innerHTML = html;
    }

    // Submission handler with progress bar
    const form = document.getElementById("thcSubmissionForm");
    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        let progressStarted = false;
        try {
          window.ResiHubSubmissionProgress?.start(
            i18nText("messages.editing_in_progress", "Submitting..."),
            { sticky: true },
          );
          progressStarted = true;
          // Collect form data
          const formData = new FormData(form);
          // Set 'condo' field to selected or new community
          const commSelect = document.getElementById("thcCommunitySelect");
          let condoValue = "";
          if (commSelect) {
            if (commSelect.value === "__new__") {
              const newCommInput = document.getElementById("thcNewCommunity");
              condoValue = newCommInput ? newCommInput.value : "";
            } else {
              condoValue =
                commSelect.options[commSelect.selectedIndex]?.textContent || "";
            }
          }
          formData.set("condo", condoValue);
          // Submit to backend
          const response = await fetch(SUBMIT_ENDPOINT, {
            method: "POST",
            body: formData,
          });
          if (!response.ok) throw new Error("Submission failed");
          window.ResiHubSubmissionProgress?.complete(
            i18nText("messages.submission_success", "Submission complete!"),
            { autoClose: true },
          );
        } catch (err) {
          if (progressStarted) {
            window.ResiHubSubmissionProgress?.error(
              i18nText("messages.submission_failed", "Submission failed!"),
              { autoClose: true },
            );
          }
          // Optionally show error to user
          alert(err?.message || "Submission failed");
        }
      });
    }
    document.querySelectorAll(".thc-next").forEach((btn) => {
      btn.addEventListener("click", function () {
        if (currentStep === 1) {
          document.querySelectorAll(".editor-area").forEach((ed) => ed.blur());
          fillPreview();
        }
      });
    });
    // Initial state
    showStep(0);
  });
})();
