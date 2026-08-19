const allowedTags = new Set(["p", "br", "h1", "h2", "h3", "strong", "em", "u", "s", "blockquote", "ul", "ol", "li", "a", "img"]);
const forbiddenTags = new Set(["script", "style", "iframe", "object", "embed", "form", "input", "button", "textarea", "select", "template", "svg", "math"]);
const imagePathPattern = /^\/api\/public-assets\/site-content-images\/[a-z0-9-]+\.(?:jpg|png|webp)$/i;

function normalizeLink(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("#") || (trimmed.startsWith("/") && !trimmed.startsWith("//"))) return trimmed;
  try {
    return new URL(trimmed).protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

function normalizeImage(value: string) {
  try {
    const url = new URL(value.trim(), window.location.origin);
    if (!/^https?:$/.test(url.protocol) || !imagePathPattern.test(url.pathname) || url.search || url.hash) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

function unwrap(element: Element) {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
}

function cleanElement(element: Element) {
  const tagName = element.tagName.toLowerCase();
  if (forbiddenTags.has(tagName)) {
    element.remove();
    return;
  }
  if (!allowedTags.has(tagName)) {
    for (const child of Array.from(element.children)) cleanElement(child);
    unwrap(element);
    return;
  }

  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    if (tagName === "a" && name === "href") {
      const href = normalizeLink(attribute.value);
      if (href) element.setAttribute("href", href);
      else element.removeAttribute(name);
      continue;
    }
    if (tagName === "img" && name === "src") {
      const src = normalizeImage(attribute.value);
      if (src) element.setAttribute("src", src);
      else {
        element.remove();
        return;
      }
      continue;
    }
    const allowed = tagName === "a" ? new Set(["href", "title", "target", "rel"]) : tagName === "img" ? new Set(["src", "alt", "title"]) : new Set<string>();
    if (!allowed.has(name)) element.removeAttribute(name);
  }

  if (tagName === "img" && !element.getAttribute("src")) {
    element.remove();
    return;
  }
  if (tagName === "a" && element.getAttribute("href")) {
    if (element.getAttribute("target") !== "_blank") element.removeAttribute("target");
    if (element.getAttribute("target") === "_blank") element.setAttribute("rel", "noopener noreferrer");
  } else {
    element.removeAttribute("target");
    element.removeAttribute("rel");
  }

  for (const child of Array.from(element.children)) cleanElement(child);
}

export function sanitizeContentHtml(value: string) {
  const template = document.createElement("template");
  template.innerHTML = value;
  for (const child of Array.from(template.content.children)) cleanElement(child);
  return template.innerHTML;
}
