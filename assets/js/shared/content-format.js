(function initResiHubContentFormatter() {
  "use strict";
  if (window.ResiHubContentFormatter) return;

  const allowedTags = new Set([
    "A", "B", "BLOCKQUOTE", "BR", "CODE", "EM", "H2", "H3", "H4",
    "HR", "I", "LI", "OL", "P", "PRE", "STRONG", "UL",
  ]);
  const droppedTags = new Set(["IFRAME", "OBJECT", "SCRIPT", "STYLE", "SVG"]);
  const urlPattern = /https?:\/\/[^\s<>"']+/gi;

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
    container.innerHTML = sanitize(html);
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
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    return normalize(collect(parsed.body)) === normalize(originalText);
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

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement?.closest("a, code, pre")) continue;
      textNodes.push(node);
    }
    textNodes.forEach((node) => {
      node.textContent = (node.textContent || "").replace(
        /(https?:\/\/[^\s<>"']+?)(Website|Map|Address|Price|Date|Time|Location):(?=\s*https?:\/\/)/gi,
        "$1 $2: ",
      );
    });

    root.querySelectorAll(".lh-text p").forEach((paragraph) => {
      if (paragraph.children.length) return;
      const text = paragraph.textContent || "";
      const labelPattern = /(^|[\s.])((?:Price|Address|Website|Map|Date|Time|Location|What to try)):\s*/gi;
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match;
      let changed = false;
      while ((match = labelPattern.exec(text))) {
        fragment.append(document.createTextNode(text.slice(lastIndex, match.index) + match[1]));
        fragment.append(document.createElement("br"));
        const strong = document.createElement("strong");
        strong.textContent = `${match[2]}:`;
        fragment.append(strong, document.createTextNode(" "));
        lastIndex = match.index + match[0].length;
        changed = true;
      }
      if (changed) {
        fragment.append(document.createTextNode(text.slice(lastIndex)));
        paragraph.replaceChildren(fragment);
      }
    });
    linkify(root);
  }

  window.ResiHubContentFormatter = Object.freeze({
    formatLegacyContent,
    linkify,
    markdownToHtml,
    preservesText,
  });
})();
