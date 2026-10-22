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
      while (el.attributes.length > 0) {
        el.removeAttribute(el.attributes[0].name);
      }
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

  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?div[^>]*>/gi, "")
    .replace(/<\/?span[^>]*>/gi, "")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i>(.*?)<\/i>/gi, "*$1*")
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    .replace(/<ul[^>]*>/gi, "")
    .replace(/<\/ul>/gi, "\n")
    .replace(/<ol[^>]*>/gi, "")
    .replace(/<\/ol>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+$/gm, "")
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
