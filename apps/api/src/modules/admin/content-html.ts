const allowedTags = new Set([
  "p",
  "br",
  "h1",
  "h2",
  "h3",
  "strong",
  "em",
  "u",
  "s",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
  "img"
]);

const dangerousTags = new Set(["script", "style", "iframe", "object", "embed", "form", "input", "button", "textarea", "select", "template", "svg", "math"]);
const voidTags = new Set(["br", "img"]);
const attributesByTag: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title"])
};
const imagePathPattern = /^\/api\/public-assets\/site-content-images\/[a-z0-9-]+\.(?:jpg|png|webp)$/i;

function escapeText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string) {
  return escapeText(value).replace(/"/g, "&quot;");
}

function findTagEnd(value: string, start: number) {
  let quote = "";
  for (let index = start + 1; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === "\"" || char === "'") {
      quote = char;
    } else if (char === ">") {
      return index;
    }
  }
  return -1;
}

function parseTag(raw: string) {
  const match = raw.match(/^<\s*(\/)?\s*([a-z][a-z0-9:-]*)/i);
  if (!match) return null;
  return {
    name: match[2].toLowerCase(),
    closing: Boolean(match[1]),
    bodyStart: match[0].length,
    selfClosing: /\/\s*>$/.test(raw)
  };
}

function parseAttributes(raw: string, start: number, end: number) {
  const attributes: Array<{ name: string; value: string }> = [];
  let index = start;
  while (index < end) {
    while (index < end && /[\s/]/.test(raw[index])) index += 1;
    if (index >= end) break;

    const nameStart = index;
    while (index < end && !/[\s=/>]/.test(raw[index])) index += 1;
    if (nameStart === index) {
      index += 1;
      continue;
    }
    const name = raw.slice(nameStart, index).toLowerCase();
    while (index < end && /\s/.test(raw[index])) index += 1;

    let value = "";
    if (raw[index] === "=") {
      index += 1;
      while (index < end && /\s/.test(raw[index])) index += 1;
      const quote = raw[index] === "\"" || raw[index] === "'" ? raw[index++] : "";
      const valueStart = index;
      if (quote) {
        while (index < end && raw[index] !== quote) index += 1;
      } else {
        while (index < end && !/[\s>]/.test(raw[index])) index += 1;
      }
      value = raw.slice(valueStart, index);
      if (quote && raw[index] === quote) index += 1;
    }
    attributes.push({ name, value });
  }
  return attributes;
}

function normalizeLink(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("#") || (trimmed.startsWith("/") && !trimmed.startsWith("//"))) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeImage(value: string) {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed, "https://cook.invalid");
    if (!/^https?:$/.test(url.protocol) || !imagePathPattern.test(url.pathname) || url.search || url.hash) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

function buildAttributes(tagName: string, raw: string, start: number, end: number) {
  const allowed = attributesByTag[tagName] ?? new Set<string>();
  const attributes: string[] = [];
  let href: string | null = null;
  for (const attribute of parseAttributes(raw, start, end)) {
    if (!allowed.has(attribute.name)) continue;
    if (attribute.name === "href") {
      href = normalizeLink(attribute.value);
      if (!href) continue;
      attributes.push(` href="${escapeAttribute(href)}"`);
      continue;
    }
    if (attribute.name === "src") {
      const src = normalizeImage(attribute.value);
      if (!src) return null;
      attributes.push(` src="${escapeAttribute(src)}"`);
      continue;
    }
    if (attribute.name === "target") {
      if (attribute.value === "_blank" && href) attributes.push(' target="_blank"');
      continue;
    }
    if (attribute.name === "rel") {
      if (href) attributes.push(' rel="noopener noreferrer"');
      continue;
    }
    if (attribute.value) attributes.push(` ${attribute.name}="${escapeAttribute(attribute.value)}"`);
  }
  if (tagName === "img" && !attributes.some(attribute => attribute.startsWith(" src="))) return null;
  return attributes.join("");
}

export function sanitizeContentHtml(value: string) {
  let output = "";
  let cursor = 0;
  const openTags: string[] = [];
  const skippedTags: string[] = [];

  while (cursor < value.length) {
    const start = value.indexOf("<", cursor);
    if (start < 0) {
      if (!skippedTags.length) output += escapeText(value.slice(cursor));
      break;
    }
    if (!skippedTags.length) output += escapeText(value.slice(cursor, start));

    if (value.startsWith("<!--", start)) {
      const commentEnd = value.indexOf("-->", start + 4);
      cursor = commentEnd < 0 ? value.length : commentEnd + 3;
      continue;
    }

    const end = findTagEnd(value, start);
    if (end < 0) {
      if (!skippedTags.length) output += escapeText(value.slice(start));
      break;
    }
    const raw = value.slice(start, end + 1);
    const tag = parseTag(raw);
    cursor = end + 1;
    if (!tag) {
      if (!skippedTags.length) output += escapeText(raw);
      continue;
    }

    if (skippedTags.length) {
      if (dangerousTags.has(tag.name)) {
        if (tag.closing && skippedTags[skippedTags.length - 1] === tag.name) skippedTags.pop();
        else if (!tag.closing && !tag.selfClosing) skippedTags.push(tag.name);
      }
      continue;
    }
    if (dangerousTags.has(tag.name)) {
      if (!tag.closing && !tag.selfClosing) skippedTags.push(tag.name);
      continue;
    }
    if (!allowedTags.has(tag.name)) continue;
    if (tag.closing) {
      const openIndex = openTags.lastIndexOf(tag.name);
      if (openIndex < 0) continue;
      openTags.splice(openIndex);
      output += `</${tag.name}>`;
      continue;
    }

    const attributes = buildAttributes(tag.name, raw, tag.bodyStart, raw.length - 1);
    if (attributes === null) continue;
    output += `<${tag.name}${attributes}>`;
    if (!voidTags.has(tag.name) && !tag.selfClosing) openTags.push(tag.name);
  }

  return output;
}
