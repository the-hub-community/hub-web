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

  const inviteDialog = document.getElementById("communityInviteDialog");
  if (!inviteDialog) return;

  const inviteLink = inviteDialog.querySelector("[data-community-invite-link]");
  const inviteQr = inviteDialog.querySelector("[data-community-qr]");
  const inviteStatus = inviteDialog.querySelector("[data-community-invite-status]");
  const shareButton = inviteDialog.querySelector("[data-community-invite-share]");
  const copyButton = inviteDialog.querySelector("[data-community-invite-copy]");
  let qrGeneratorPromise = null;

  function setInviteStatus(message) {
    inviteStatus.textContent = message;
  }

  function loadQrGenerator(button) {
    if (!qrGeneratorPromise) {
      qrGeneratorPromise = [button.dataset.qrcodeScript, button.dataset.qrcodeUtf8Script]
        .reduce((promise, src) => promise.then(() => new Promise((resolve, reject) => {
          if (!src) {
            reject(new Error("QR generator script URL is missing."));
            return;
          }
          const script = document.createElement("script");
          script.src = src;
          script.onload = resolve;
          script.onerror = () => reject(new Error(`QR generator could not load: ${src}`));
          document.head.append(script);
        })), Promise.resolve());
    }
    return qrGeneratorPromise;
  }

  async function renderInviteQr(button) {
    try {
      await loadQrGenerator(button);
      if (typeof window.qrcode !== "function") {
        throw new Error("QR generator did not expose its API.");
      }
      const code = window.qrcode(0, "M");
      code.addData(inviteLink.value);
      code.make();
      inviteQr.innerHTML = code.createSvgTag(5, 4);
      inviteQr.hidden = false;
    } catch (error) {
      console.error("Could not generate community invite QR code.", error);
      setInviteStatus("QR code unavailable. Share or copy the link instead.");
    }
  }

  document.querySelectorAll("[data-community-share-open]").forEach((button) => {
    button.addEventListener("click", () => {
      try {
        const url = new URL(button.dataset.communityShareUrl, window.location.href);
        if (url.origin !== window.location.origin) {
          throw new Error("Community invite URL must stay on this site.");
        }
        inviteLink.value = url.href;
        inviteQr.replaceChildren();
        inviteQr.hidden = true;
        setInviteStatus("");
        inviteDialog.showModal();
        void renderInviteQr(button);
      } catch (error) {
        console.error("Could not open community invite.", error);
        setInviteStatus("Community invite is unavailable.");
      }
    });
  });

  inviteDialog.querySelector("[data-community-invite-close]").addEventListener("click", () => {
    inviteDialog.close();
  });

  shareButton.addEventListener("click", async () => {
    if (!navigator.share) {
      inviteLink.select();
      setInviteStatus("Sharing unavailable here. Copy the selected community link.");
      return;
    }
    try {
      await navigator.share({
        title: `Join ${inviteDialog.querySelector("#communityInviteTitle").textContent}`,
        text: "Explore this community on The Hub Collective.",
        url: inviteLink.value,
      });
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Could not share community invite.", error);
        setInviteStatus("Sharing failed. Copy the community link instead.");
      }
    }
  });

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(inviteLink.value);
      setInviteStatus("Community link copied.");
    } catch (error) {
      console.error("Could not copy community invite link.", error);
      inviteLink.select();
      setInviteStatus("Copy unavailable. Select the link and copy it.");
    }
  });
})();
