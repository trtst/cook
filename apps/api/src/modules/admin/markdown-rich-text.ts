export interface RichTextMarkdownResult {
  title: string | null;
  html: string;
  text: string;
}

const listPattern = /^(\s*)([-*+]|\d+[.)])\s+(.+)$/;
const headingPattern = /^(#{1,6})\s+(.+)$/;
const tableDividerPattern = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;
const imageLinePattern = /^!\[([^\]]*)]\(([^)]+)\)$/;
const imagePathPattern = /^\/(?:static\/)?uploads\/site-content-images\/[a-z0-9-]+\.(?:jpg|png|webp)$/i;

function escapeText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string) {
  return escapeText(value).replace(/"/g, "&quot;");
}

function resolveLinkHref(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("#") || (trimmed.startsWith("/") && !trimmed.startsWith("//"))) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function resolveImageSrc(value: string) {
  const trimmed = value.trim();
  if (imagePathPattern.test(trimmed)) return trimmed;
  return null;
}

function renderInline(value: string) {
  const tokens: string[] = [];
  const reserve = (html: string) => {
    const key = `@@MDTOKEN${tokens.length}@@`;
    tokens.push(html);
    return key;
  };

  let output = value
    .replace(/!\[([^\]]*)]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, (_match, label: string, href: string) => {
      const link = resolveLinkHref(href);
      if (!link) return label;
      return reserve(`<a href="${escapeAttribute(link)}" target="_blank" rel="noopener noreferrer">${escapeText(label)}</a>`);
    });

  output = escapeText(output)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1");

  tokens.forEach((html, index) => {
    output = output.replace(`@@MDTOKEN${index}@@`, html);
  });
  return output.trim();
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, block => block.replace(/```[a-zA-Z0-9_-]*\n?|\n?```/g, ""))
    .replace(/!\[([^\]]*)]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*>+\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/[*_`|]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitTableRow(value: string) {
  return value
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map(item => item.trim())
    .filter(Boolean);
}

export function markdownToRichText(markdown: string): RichTextMarkdownResult {
  const lines = markdown.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const htmlParts: string[] = [];
  let title: string | null = null;
  let listKind: "ul" | "ol" | null = null;
  let inFence = false;
  let fenceLines: string[] = [];
  let tableRows: string[][] = [];

  const closeList = () => {
    if (!listKind) return;
    htmlParts.push(`</${listKind}>`);
    listKind = null;
  };

  const flushFence = () => {
    if (!fenceLines.length) return;
    closeList();
    const body = fenceLines.map(line => escapeText(line)).join("<br>");
    if (body.trim()) htmlParts.push(`<blockquote><p>${body}</p></blockquote>`);
    fenceLines = [];
  };

  const flushTable = () => {
    if (!tableRows.length) return;
    closeList();
    htmlParts.push("<ul>");
    tableRows.forEach(row => {
      htmlParts.push(`<li>${renderInline(row.join(" / "))}</li>`);
    });
    htmlParts.push("</ul>");
    tableRows = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      if (inFence) {
        inFence = false;
        flushFence();
      } else {
        flushTable();
        closeList();
        inFence = true;
      }
      continue;
    }
    if (inFence) {
      fenceLines.push(line);
      continue;
    }

    if (!trimmed) {
      flushTable();
      closeList();
      continue;
    }

    if (trimmed.includes("|")) {
      if (tableDividerPattern.test(trimmed)) continue;
      const cells = splitTableRow(trimmed);
      if (cells.length > 1) {
        tableRows.push(cells);
        continue;
      }
      flushTable();
    } else {
      flushTable();
    }

    const heading = trimmed.match(headingPattern);
    if (heading) {
      closeList();
      const level = Math.min(Math.max(heading[1].length, 2), 3);
      const headingText = heading[2].trim();
      if (!title && heading[1].length === 1) {
        title = stripMarkdown(headingText);
        continue;
      }
      htmlParts.push(`<h${level}>${renderInline(headingText)}</h${level}>`);
      continue;
    }

    const image = trimmed.match(imageLinePattern);
    if (image) {
      closeList();
      const src = resolveImageSrc(image[2]);
      if (src) htmlParts.push(`<img src="${escapeAttribute(src)}" alt="${escapeAttribute(stripMarkdown(image[1]))}">`);
      else htmlParts.push(`<p>${renderInline(image[1])}</p>`);
      continue;
    }

    if (trimmed.startsWith(">")) {
      closeList();
      htmlParts.push(`<blockquote><p>${renderInline(trimmed.replace(/^>+\s?/, ""))}</p></blockquote>`);
      continue;
    }

    const list = line.match(listPattern);
    if (list) {
      const nextKind = /^\d/.test(list[2]) ? "ol" : "ul";
      if (listKind !== nextKind) {
        closeList();
        listKind = nextKind;
        htmlParts.push(`<${listKind}>`);
      }
      htmlParts.push(`<li>${renderInline(list[3])}</li>`);
      continue;
    }

    closeList();
    htmlParts.push(`<p>${renderInline(trimmed)}</p>`);
  }

  flushTable();
  flushFence();
  closeList();

  const text = stripMarkdown(markdown);
  return {
    title,
    html: htmlParts.join("\n"),
    text
  };
}
