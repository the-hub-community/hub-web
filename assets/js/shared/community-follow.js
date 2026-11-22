(function () {
  "use strict";

  const STORAGE_PREFIX = "hubcollective:community-follow:v1:";

  function setFollowState(button, following) {
    button.textContent = following ? "Following" : "Follow";
    button.setAttribute("aria-pressed", String(following));
    button.classList.toggle("is-following", following);
  }

  document.querySelectorAll("[data-community-follow]").forEach((button) => {
    const community = button.dataset.communityFollow;
    if (!community) {
      console.error("Community follow button is missing its community key.");
      button.disabled = true;
      button.textContent = "Unavailable";
      return;
    }

    const storageKey = `${STORAGE_PREFIX}${community}`;
    try {
      setFollowState(button, localStorage.getItem(storageKey) === "true");
    } catch (error) {
      console.error("Could not load community follow status.", error);
      button.disabled = true;
      button.textContent = "Unavailable";
      return;
    }

    button.addEventListener("click", () => {
      const following = button.getAttribute("aria-pressed") !== "true";
      try {
        localStorage.setItem(storageKey, String(following));
        setFollowState(button, following);
      } catch (error) {
        console.error("Could not save community follow status.", error);
        button.title = "Could not save your follow status.";
      }
    });
  });
})();
