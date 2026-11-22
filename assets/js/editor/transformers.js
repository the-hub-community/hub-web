function t(key, fallback) {
  if (typeof window.t === "function") {
    return window.t(key, fallback);
  }
  return fallback;
}

export function normalizeEditorHtml(html) {
  if (!html || !html.trim()) {
    return "";
  }

  const hasHtmlTags = /<\/?[a-z][\s\S]*?>/i.test(html);
  let sourceHtml = html.trim();

  if (!hasHtmlTags) {
    const normalizedMarkdown = sourceHtml
      .replace(/\r\n?/g, "\n")
      .replace(/([^\n])\n((?:[-*]|\d+\.)\s+)/g, "$1\n\n$2")
      .trim();

    if (typeof marked !== "undefined") {
      sourceHtml = marked.parse(normalizedMarkdown).trim();
    } else {
      sourceHtml = normalizedMarkdown
        .split(/\n{2,}/)
        .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
        .join("");
    }
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = sourceHtml;

  const output = document.createElement("div");
  let paragraph = null;

  const flushParagraph = () => {
    if (!paragraph) {
      return;
    }

    const paragraphText = paragraph.innerHTML
      .replace(/(?:&nbsp;|\s|<br\s*\/?\s*>)+/gi, "")
      .trim();

    if (paragraphText) {
      output.appendChild(paragraph);
    }

    paragraph = null;
  };

  const appendToParagraph = (node) => {
    if (!paragraph) {
      paragraph = document.createElement("p");
    }

    paragraph.appendChild(node.cloneNode(true));
  };

  Array.from(wrapper.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.trim()) {
        appendToParagraph(node);
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const tagName = node.tagName.toLowerCase();
    const blockTags = [
      "p",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "div",
      "figure",
    ];

    if (blockTags.includes(tagName)) {
      flushParagraph();

      if (tagName === "p") {
        const cleanedParagraph = node.innerHTML
          .replace(/(?:&nbsp;|\s|<br\s*\/?\s*>)+/gi, "")
          .trim();

        if (cleanedParagraph) {
          output.appendChild(node.cloneNode(true));
        }
      } else {
        output.appendChild(node.cloneNode(true));
      }

      return;
    }

    appendToParagraph(node);
  });

  flushParagraph();

  return output.innerHTML.trim();
}

export function decodeHtmlEntities(str) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = str;
  return textarea.value;
}

export function unwrapEncodedCodeBlocks(html) {
  return html.replace(
    /<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_, inner) => decodeHtmlEntities(inner.trim()),
  );
}

export function deepCleanHTML(html) {
  if (
    !html ||
    html.trim() === "" ||
    html === "<br>" ||
    html === "<p><br></p>"
  ) {
    return "";
  }

  const parser = new DOMParser();
  const parseHtml = (source) => {
    const doc = parser.parseFromString(source, "text/html");
    doc.querySelectorAll("*").forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        if (el.tagName === "A" && attr.name.toLowerCase() === "href") {
          try {
            const url = new URL(attr.value, window.location.href);
            if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
              el.removeAttribute(attr.name);
            }
          } catch (_) {
            el.removeAttribute(attr.name);
          }
        } else {
          el.removeAttribute(attr.name);
        }
      });
    });
    return doc.body.innerHTML;
  };

  let clean = unwrapEncodedCodeBlocks(html).trim();

  if (clean.includes("&lt;") && clean.includes("&gt;")) {
    clean = decodeHtmlEntities(clean);
  }

  clean = clean
    .replace(/<section\b[^>]*>/gi, "")
    .replace(/<\/section>/gi, "")
    .replace(
      /<p>\s*&lt;\/?(div|section|p|span|br|strong|em|ul|ol|li|iframe|img)[^>]*&gt;\s*<\/p>/gi,
      "",
    )
    .replace(/^[ \t]+/gm, "")
    .replace(/\n[ \t]+/g, "\n")
    .trim();

  clean = parseHtml(clean);

  clean = clean
    .replace(/<p>\s*<ul/gi, "<ul")
    .replace(/<\/ul>\s*<\/p>/gi, "</ul>")
    .replace(/<p>\s*<ol/gi, "<ol")
    .replace(/<\/ol>\s*<\/p>/gi, "</ol>")
    .replace(/<p>(?:\s|&nbsp;|<br\s*\/?\>)*<\/p>/gi, "")
    .replace(/<p><\/p>/gi, "")
    .trim();

  return clean;
}

export function htmlToMarkdown(html) {
  if (!html || html.trim() === "") {
    return "";
  }

  const root = new DOMParser().parseFromString(html, "text/html").body;
  const blockTags = new Set([
    "ARTICLE",
    "BLOCKQUOTE",
    "DIV",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "P",
    "SECTION",
  ]);
  const safeUrl = (value) => {
    try {
      const url = new URL(value, window.location.href);
      return ["http:", "https:", "mailto:"].includes(url.protocol)
        ? value
        : "";
    } catch {
      return "";
    }
  };
  const renderChildren = (node, listDepth = 0) =>
    Array.from(node.childNodes, (child) => renderNode(child, listDepth)).join("");
  const renderList = (list, depth) => {
    const ordered = list.tagName === "OL";
    const start = Number.parseInt(list.getAttribute("start") || "1", 10);
    let number = Number.isFinite(start) ? start : 1;
    return Array.from(list.children)
      .filter((item) => item.tagName === "LI")
      .map((item) => {
        const body = [];
        const nestedLists = [];
        Array.from(item.childNodes).forEach((child) => {
          if (child.nodeType === Node.ELEMENT_NODE && ["OL", "UL"].includes(child.tagName)) {
            nestedLists.push(renderList(child, depth + 1));
          } else if (child.nodeType === Node.ELEMENT_NODE && blockTags.has(child.tagName)) {
            body.push(renderChildren(child, depth).trim());
          } else {
            body.push(renderNode(child, depth));
          }
        });
        const marker = ordered ? `${number++}.` : "-";
        const text = body.join(" ").replace(/\s+/g, " ").trim();
        const nested = nestedLists.length
          ? `\n${nestedLists.join("\n")}`
          : "";
        return `${"  ".repeat(depth)}${marker} ${text}${nested}`;
      })
      .join("\n");
  };
  const renderNode = (node, listDepth = 0) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || "").replace(/\u00a0/g, " ");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    switch (node.tagName) {
      case "BR":
        return "\n";
      case "STRONG":
      case "B":
        return `**${renderChildren(node, listDepth).trim()}**`;
      case "EM":
      case "I":
        return `*${renderChildren(node, listDepth).trim()}*`;
      case "CODE":
        return `\`${node.textContent || ""}\``;
      case "A": {
        const href = safeUrl(node.getAttribute("href") || "");
        const children = renderChildren(node, listDepth);
        return href ? `[${children.trim()}](${href})` : children;
      }
      case "IMG": {
        const src = safeUrl(node.getAttribute("src") || "");
        return src ? `![${node.getAttribute("alt") || ""}](${src})` : "";
      }
      case "UL":
      case "OL":
        return `\n${renderList(node, listDepth)}\n`;
      case "HR":
        return "\n\n---\n\n";
      case "PRE":
        return `\n\n\`\`\`\n${node.textContent || ""}\n\`\`\`\n\n`;
      case "BLOCKQUOTE":
        return `\n${renderChildren(node, listDepth).trim().split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
      case "H1":
      case "H2":
      case "H3":
      case "H4":
      case "H5":
      case "H6":
        return `\n${"#".repeat(Number(node.tagName.slice(1)))} ${renderChildren(node, listDepth).trim()}\n\n`;
      default:
        const children = renderChildren(node, listDepth);
        return blockTags.has(node.tagName)
          ? `\n${children.trim()}\n\n`
          : children;
    }
  };

  return renderChildren(root)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractYoutubeId(url) {
  if (!url) return "";

  const trimmed = url.trim();
  const directMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([^&#?\/]+)/i,
  );
  if (directMatch && directMatch[1]) {
    return directMatch[1];
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace(/^\//, "").split("/")[0] || "";
    }
    const byQuery = parsed.searchParams.get("v");
    if (byQuery) return byQuery;
    const pathMatch = parsed.pathname.match(/\/(embed|shorts)\/([^/?#]+)/i);
    if (pathMatch && pathMatch[2]) {
      return pathMatch[2];
    }
  } catch (_) {
    return "";
  }

  return "";
}

export function normalizeYoutubeUrl(url) {
  const id = extractYoutubeId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : "";
}

export function normalizeImageUrl(url) {
  if (!url) return "";

  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed, window.location.origin);
    const isSameHost = parsed.hostname === window.location.hostname;
    if (isSameHost) {
      return `${parsed.pathname}${parsed.search}`;
    }
    return parsed.href;
  } catch (_) {
    return trimmed;
  }
}

export function i18nText(key, fallback) {
  return t(key, fallback);
}

// Expose deepCleanHTML globally for non-module usage
window.deepCleanHTML = deepCleanHTML;
