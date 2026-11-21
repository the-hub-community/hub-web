(function initPageReactions() {
  "use strict";

  const ACTOR_STORAGE_KEY = "hub-community:reaction-actor:v1";
  const REACTION_TYPES = new Set(["like", "dislike"]);

  function getActorId() {
    let actorId = window.localStorage.getItem(ACTOR_STORAGE_KEY);
    if (/^[a-f0-9]{32}$/i.test(actorId || "")) return actorId;

    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    actorId = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    window.localStorage.setItem(ACTOR_STORAGE_KEY, actorId);
    return actorId;
  }

  function setStatus(widget, message, isError) {
    const status = widget.querySelector("[data-reaction-status]");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", Boolean(isError));
  }

  function render(widget, payload) {
    const counts = payload?.counts;
    if (
      !counts ||
      !Number.isSafeInteger(counts.like) ||
      !Number.isSafeInteger(counts.dislike) ||
      (payload.vote !== null && !REACTION_TYPES.has(payload.vote))
    ) {
      throw new Error("Reaction service returned invalid data.");
    }

    widget.querySelectorAll("[data-reaction]").forEach((button) => {
      const reaction = button.dataset.reaction;
      const count = widget.querySelector(`[data-count="${reaction}"]`);
      if (!REACTION_TYPES.has(reaction) || !count) return;
      count.textContent = String(counts[reaction]);
      button.setAttribute("aria-pressed", String(payload.vote === reaction));
      button.disabled = false;
    });
  }

  async function request(endpoint, options) {
    const response = await fetch(endpoint, options);
    const payload = await response.json();
    if (!response.ok || payload?.success !== true) {
      throw new Error(payload?.error || "Reaction request failed.");
    }
    return payload;
  }

  async function initWidget(widget, actorId) {
    const endpoint = window.ResiHubApi?.ENDPOINTS?.reactions;
    if (!endpoint) {
      setStatus(widget, "Feedback service is unavailable.", true);
      return;
    }

    const fields = {
      type: widget.dataset.reactionType,
      community_key: widget.dataset.communityKey,
      content_id: widget.dataset.contentId,
      actor_id: actorId,
    };

    try {
      const query = new URLSearchParams(fields);
      const payload = await request(`${endpoint}?${query.toString()}`, {
        headers: { Accept: "application/json" },
      });
      render(widget, payload);
    } catch (error) {
      setStatus(widget, `Feedback could not load: ${error.message}`, true);
      widget.querySelectorAll("[data-reaction]").forEach((button) => {
        button.disabled = false;
      });
    }

    widget.querySelectorAll("[data-reaction]").forEach((button) => {
      button.addEventListener("click", async () => {
        widget.querySelectorAll("[data-reaction]").forEach((item) => {
          item.disabled = true;
        });
        setStatus(widget, "Saving feedback…", false);

        try {
          const payload = await request(endpoint, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...fields,
              reaction: button.dataset.reaction,
            }),
          });
          render(widget, payload);
          setStatus(
            widget,
            payload.vote ? "Thanks for your feedback." : "Your vote was removed.",
            false,
          );
        } catch (error) {
          widget.querySelectorAll("[data-reaction]").forEach((item) => {
            item.disabled = false;
          });
          setStatus(widget, `Feedback could not save: ${error.message}`, true);
        }
      });
    });
  }

  function init() {
    const widgets = document.querySelectorAll("[data-reaction-widget]");
    if (!widgets.length) return;

    try {
      const actorId = getActorId();
      widgets.forEach((widget) => {
        void initWidget(widget, actorId);
      });
    } catch (error) {
      widgets.forEach((widget) => {
        setStatus(widget, `Feedback could not initialize: ${error.message}`, true);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
