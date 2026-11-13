(function initResiHubContentFormatter() {
  "use strict";
  if (window.ResiHubContentFormatter) return;

  const allowedTags = new Set([
    "A", "B", "BLOCKQUOTE", "BR", "CODE", "EM", "H2", "H3", "H4",
    "HR", "I", "LI", "OL", "P", "PRE", "STRONG", "UL",
  ]);
  const droppedTags = new Set(["IFRAME", "OBJECT", "SCRIPT", "STYLE", "SVG"]);
  const urlPattern = /https?:\/\/[^\s<>"']+/gi;
  const labelPattern =
    /(^|[\s.])((?:Price|Address|Website|Map|Date|Time|Location|What to try)):\s*/gi;

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:"
        ? url.href
        : "";
    } catch {
      return "";
    }
  }

  function linkify(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement?.closest("a, code, pre, script, style")) continue;
      if (urlPattern.test(node.textContent || "")) {
        textNodes.push(node);
      }
      urlPattern.lastIndex = 0;
    }

    textNodes.forEach((node) => {
      const value = node.textContent || "";
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match;
      urlPattern.lastIndex = 0;
      while ((match = urlPattern.exec(value))) {
        const trailing = match[0].match(/[.,!?;:)\]}]+$/)?.[0] || "";
        const candidate = trailing ? match[0].slice(0, -trailing.length) : match[0];
        const href = safeUrl(candidate);
        if (!href) continue;

        fragment.append(document.createTextNode(value.slice(lastIndex, match.index)));
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.textContent = candidate;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        fragment.append(anchor);
        if (trailing) fragment.append(document.createTextNode(trailing));
        lastIndex = match.index + match[0].length;
      }
      fragment.append(document.createTextNode(value.slice(lastIndex)));
      node.replaceWith(fragment);
    });
  }

  function sanitize(html) {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const cleanChildren = (parent) => {
      Array.from(parent.children).forEach((element) => {
        if (droppedTags.has(element.tagName)) {
          element.remove();
          return;
        }
        cleanChildren(element);
        if (!allowedTags.has(element.tagName)) {
          element.replaceWith(...element.childNodes);
          return;
        }

        const href = element.tagName === "A"
          ? safeUrl(element.getAttribute("href") || "")
          : "";
        Array.from(element.attributes).forEach((attribute) => {
          element.removeAttribute(attribute.name);
        });
        if (element.tagName === "A") {
          if (!href) {
            element.replaceWith(...element.childNodes);
          } else {
            element.href = href;
            element.target = "_blank";
            element.rel = "noopener noreferrer";
          }
        }
      });
    };
    cleanChildren(parsed.body);
    return parsed.body.innerHTML;
  }

  function markdownToHtml(markdown) {
    const source = String(markdown || "")
      .trim()
      .replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i, "$1")
      .replace(/(^|[\s>])((?:Price|Address|Website|Map|Date|Time|Location|What to try)):/gim, "$1**$2:**")
      .replace(/^(\s*)•\s+/gm, "$1- ");
    if (!source) return "";
    const html = window.marked && typeof window.marked.parse === "function"
      ? window.marked.parse(source, { gfm: true, breaks: true })
      : source
          .split(/\n{2,}/)
          .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
          .join("");
    const container = document.createElement("div");
    container.className = "lh-text";
    container.innerHTML = sanitize(html);
    normalizePresentation(container, { addDirections: false });
    linkify(container);
    return container.innerHTML;
  }

  function preservesText(html, originalText) {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const blockTags = new Set([
      "BLOCKQUOTE", "BR", "H2", "H3", "H4", "LI", "OL", "P", "PRE", "UL",
    ]);
    const collect = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      const separator = blockTags.has(node.tagName) ? " " : "";
      return separator + Array.from(node.childNodes, collect).join("") + separator;
    };
    const normalize = (value) =>
      String(value || "")
        .replace(/\s+/g, " ")
        .replace(/([.!?])\s+(?=[A-Z])/g, "$1")
        .trim();
    return normalize(collect(parsed.body)) === normalize(originalText);
  }

  function isStandaloneUrl(value) {
    const candidate = String(value || "").trim().replace(/[.,!?;:)\]}]+$/, "");
    return /^https?:\/\/\S+$/i.test(candidate);
  }

  function nestStandaloneUrlItems(root) {
    root.querySelectorAll("ul").forEach((list) => {
      let parentItem = null;
      Array.from(list.children).forEach((item) => {
        if (item.tagName !== "LI") return;
        if (isStandaloneUrl(item.textContent) && parentItem) {
          let nestedList = Array.from(parentItem.children).find(
            (child) => child.tagName === "UL",
          );
          if (!nestedList) {
            nestedList = document.createElement("ul");
            parentItem.append(nestedList);
          }
          nestedList.append(item);
        } else {
          parentItem = item;
        }
      });
    });
  }

  function normalizePresentation(
    root,
    { splitCamelCase = false, addDirections = true } = {},
  ) {
    const containers = [];
    if (root.matches?.(".lh-text, .review-preview-card, .editor-area")) {
      containers.push(root);
    }
    containers.push(
      ...root.querySelectorAll(".lh-text, .review-preview-card, .editor-area"),
    );
    containers.forEach((container) => {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.parentElement?.closest("a, code, pre")) continue;
        textNodes.push(node);
      }
      textNodes.forEach((node) => {
        let text = (node.textContent || "")
          .replace(/[ \t]{2,}/g, " ")
          .replace(/\s+([,.;!?])/g, "$1")
          .replace(/([.!?])(?=[A-Z])/g, "$1 ");
        if (splitCamelCase) {
          text = text.replace(/([a-z]{3,})([A-Z][a-z]+)\b/g, "$1 $2");
        }
        node.textContent = text;
      });
      nestStandaloneUrlItems(container);
      container.querySelectorAll("p").forEach(formatParagraph);
      if (addDirections) addDirectionsLinks(container);
    });
  }

  function needsLabelBreak(node, fragment) {
    let previous = fragment.lastChild || node.previousSibling;
    while (
      previous &&
      previous.nodeType === Node.TEXT_NODE &&
      !previous.textContent.trim()
    ) {
      previous = previous.previousSibling;
    }
    return Boolean(previous && previous.nodeName !== "BR");
  }

  function formatParagraph(paragraph) {
    while (paragraph.firstElementChild?.tagName === "BR") {
      paragraph.firstElementChild.remove();
    }

    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement?.closest("a, code, pre, strong")) continue;
      textNodes.push(node);
    }

    textNodes.forEach((node) => {
      const text = node.textContent || "";
      labelPattern.lastIndex = 0;
      if (!labelPattern.test(text)) return;
      labelPattern.lastIndex = 0;

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match;
      while ((match = labelPattern.exec(text))) {
        fragment.append(
          document.createTextNode(
            text.slice(lastIndex, match.index) + match[1].trim(),
          ),
        );
        const label = document.createElement("strong");
        label.textContent = `${match[2]}:`;
        if (needsLabelBreak(node, fragment)) {
          fragment.append(document.createElement("br"));
        }
        fragment.append(label, document.createTextNode(" "));
        lastIndex = match.index + match[0].length;
      }
      fragment.append(document.createTextNode(text.slice(lastIndex)));
      node.replaceWith(fragment);
    });

    paragraph.querySelectorAll("strong").forEach((label) => {
      if (!/^(?:Price|Address|Website|Map|Date|Time|Location|What to try):?$/i.test(
        label.textContent.trim(),
      )) {
        return;
      }
      let previous = label.previousSibling;
      while (
        previous &&
        previous.nodeType === Node.TEXT_NODE &&
        !previous.textContent.trim()
      ) {
        previous = previous.previousSibling;
      }
      if (previous?.nodeName === "BR") return;
      if (previous && !(previous.nodeType === Node.TEXT_NODE && !previous.textContent.trim())) {
        paragraph.insertBefore(document.createElement("br"), label);
      }
    });
  }

  function addDirectionsLinks(root) {
    root.querySelectorAll(".lh-text p, .review-preview-card p").forEach((paragraph) => {
      if (paragraph.querySelector(".lh-directions-link")) return;
      const label = Array.from(paragraph.querySelectorAll("strong")).find(
        (element) => /^Address:?$/i.test(element.textContent.trim()),
      );
      if (!label) return;

      const addressParts = [];
      let end = label.nextSibling;
      while (end && end.nodeName !== "BR") {
        if (
          end.nodeType === Node.ELEMENT_NODE &&
          end.matches("strong") &&
          /^(?:Price|Address|Website|Map|Date|Time|Location|What to try):?$/i.test(
            end.textContent.trim(),
          )
        ) {
          break;
        }
        addressParts.push(end.textContent || "");
        end = end.nextSibling;
      }
      const address = addressParts
        .join("")
        .replace(/^\s*:\s*/, "")
        .replace(/[.,!?;]+$/, "")
        .trim();
      if (!address) return;

      const directions = document.createElement("a");
      directions.className = "lh-directions-link";
      directions.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
      directions.target = "_blank";
      directions.rel = "noopener noreferrer";
      directions.setAttribute("aria-label", `Get directions to ${address}`);
      directions.innerHTML =
        '<i class="fa-solid fa-diamond-turn-right" aria-hidden="true"></i> Directions';

      if (end) {
        paragraph.insertBefore(document.createTextNode(" "), end);
        paragraph.insertBefore(directions, end);
      } else {
        paragraph.append(document.createTextNode(" "), directions);
      }
    });
  }

  function formatLegacyContent(root) {
    if (!root) return;
    root.querySelectorAll(".lh-text a[href]").forEach((anchor) => {
      let sibling = anchor.nextSibling;
      while (sibling && sibling.nodeType === Node.TEXT_NODE && !sibling.textContent.trim()) {
        sibling = sibling.nextSibling;
      }
      if (
        !sibling ||
        sibling.nodeType !== Node.TEXT_NODE ||
        !/^\s*:\s*/.test(sibling.textContent || "")
      ) {
        return;
      }
      let mapLink = sibling.nextSibling;
      while (mapLink && mapLink.nodeType === Node.TEXT_NODE && !mapLink.textContent.trim()) {
        mapLink = mapLink.nextSibling;
      }
      if (
        !(mapLink instanceof HTMLAnchorElement) ||
        !/^https?:\/\/(?:www\.)?google\.[^/]+\/maps\//i.test(mapLink.href)
      ) {
        return;
      }

      const websiteUrl = new URL(anchor.href);
      if (!/\/Map$/i.test(websiteUrl.pathname)) return;
      websiteUrl.pathname = websiteUrl.pathname.replace(/\/Map$/i, "/");
      anchor.href = websiteUrl.href;
      anchor.textContent = websiteUrl.href;
      sibling.textContent = sibling.textContent.replace(/^\s*:\s*/, "");
      const label = document.createElement("strong");
      label.textContent = "Map:";
      anchor.after(document.createElement("br"), label, document.createTextNode(" "));
    });

    normalizePresentation(root, { splitCamelCase: true });
    linkify(root);
  }

  function formatEditorContent(root) {
    if (!root) return;
    normalizePresentation(root, {
      splitCamelCase: true,
      addDirections: false,
    });
  }

  window.ResiHubContentFormatter = Object.freeze({
    formatLegacyContent,
    formatEditorContent,
    linkify,
    markdownToHtml,
    preservesText,
  });
})();
