import iconHTML from "discourse/lib/icon-library";
import { providerColor, sanitizeURL, getPreviewProvider } from "./rich-preview-utils";

const WRAP_TYPE_CLASSES = [
  "rich-preview-wrap--topic",
  "rich-preview-wrap--remote_topic",
  "rich-preview-wrap--external",
  "rich-preview-wrap--wikipedia",
];

const WRAP_MODE_CLASSES = [
  "rich-preview-wrap--underline-always",
  "rich-preview-wrap--underline-hover",
  "rich-preview-wrap--icon-before",
  "rich-preview-wrap--icon-after",
];

const LINK_DECORATION_CLASSES = [
  "rich-preview-link",
  "rich-preview-link--topic",
  "rich-preview-link--remote_topic",
  "rich-preview-link--external",
  "rich-preview-link--wikipedia",
  "rich-preview-link--underline-always",
  "rich-preview-link--underline-hover",
  "rich-preview-link--icon-before",
  "rich-preview-link--icon-after",
];

function resolveLink(wrapper, link) {
  if (link instanceof HTMLAnchorElement) {
    return link;
  }

  if (wrapper instanceof Element) {
    const resolved = wrapper.querySelector(":scope > a[href]");
    return resolved instanceof HTMLAnchorElement ? resolved : null;
  }

  return null;
}

function removeInlineGlyphNode(link) {
  link?.querySelector(":scope > .thc-inline-glyph")?.remove();
}

function removeWrapperGlyphNode(wrapper) {
  wrapper?.querySelector(":scope > .thc-inline-glyph-wrap")?.remove();
}

function clearLinkClasses(link) {
  if (!link) {
    return;
  }

  link.classList.remove(...LINK_DECORATION_CLASSES);
}

function clearWrapperState(wrapper) {
  if (!wrapper) {
    return;
  }

  wrapper.classList.remove(...WRAP_TYPE_CLASSES, ...WRAP_MODE_CLASSES);
  wrapper.style.removeProperty("--rp-color");
  delete wrapper.dataset.providerKey;
  delete wrapper.dataset.richPreview;
  removeWrapperGlyphNode(wrapper);
}

function clearInlineProviderPresentation(link, wrapper = null) {
  if (link) {
    link.style.removeProperty("--rp-color");
    removeInlineGlyphNode(link);
    clearLinkClasses(link);
    delete link.dataset.richPreviewType;
    delete link.dataset.richPreviewUnderline;
    delete link.dataset.richPreviewIcon;
    delete link.dataset.richPreview;
  }

  if (wrapper) {
    clearWrapperState(wrapper);
  }
}

function renderInlineProviderGlyph(providerKey, config) {
  const provider = getPreviewProvider(config, providerKey);
  const iconName = provider?.icon;

  if (!iconName) {
    return null;
  }

  let html;

  try {
    html = iconHTML(iconName);
  } catch {
    html = "";
  }

  if (!html) {
    return null;
  }

  return `<span class="thc-inline-glyph" aria-hidden="true">${html}</span>`;
}

function buildInlineGlyphFragment(providerKey, config, wrapperMode = false) {
  const html = renderInlineProviderGlyph(providerKey, config);

  if (!html) {
    return null;
  }

  const template = document.createElement("template");
  template.innerHTML = html.trim();
  const node = template.content.firstElementChild || null;

  if (!node) {
    return null;
  }

  if (wrapperMode) {
    node.classList.remove("thc-inline-glyph");
    node.classList.add("thc-inline-glyph-wrap");
  }

  return node;
}

function normalizeInlineGlyphPosition(config) {
  const position = String(config?.previewsIconPosition || "after")
    .trim()
    .toLowerCase();

  return position === "before" ? "before" : "after";
}

function normalizeUnderlineMode(config) {
  if (!config?.previewsShowUnderline) {
    return null;
  }

  return config?.previewsUnderlineAlways ? "always" : "hover";
}

function normalizeIconMode(config, providerKey) {
  if (!providerKey || config?.previewsShowIcon === false) {
    return null;
  }

  const provider = getPreviewProvider(config, providerKey);

  if (!provider || provider.enabled === false || provider.glyphMode === "none") {
    return null;
  }

  return normalizeInlineGlyphPosition(config);
}

function anchorHasComplexInlineContent(link) {
  if (!link) {
    return false;
  }

  return !!link.querySelector(
    [
      ":scope > img",
      ":scope > picture",
      ":scope > video",
      ":scope > audio",
      ":scope > svg:not(.thc-inline-glyph svg)",
      ":scope > .onebox",
      ":scope > .badge-wrapper",
      ":scope > br",
      ":scope > blockquote",
      ":scope > code",
      ":scope > pre",
    ].join(", ")
  );
}

function glyphNodeIsInPosition(link, glyphNode, position) {
  if (!link || !glyphNode) {
    return false;
  }

  if (position === "before") {
    return link.firstElementChild === glyphNode;
  }

  return link.lastElementChild === glyphNode;
}

function placeInlineGlyphNode(link, glyphNode, position = "after") {
  if (!link || !glyphNode) {
    return;
  }

  if (glyphNodeIsInPosition(link, glyphNode, position)) {
    return;
  }

  glyphNode.remove();

  if (position === "before") {
    link.prepend(glyphNode);
  } else {
    link.append(glyphNode);
  }
}

function wrapperGlyphNodeIsInPosition(wrapper, glyphNode, position) {
  if (!wrapper || !glyphNode) {
    return false;
  }

  const anchor = wrapper.querySelector(":scope > a[href]");

  if (!anchor) {
    return false;
  }

  if (position === "before") {
    return wrapper.firstElementChild === glyphNode;
  }

  return wrapper.lastElementChild === glyphNode;
}

function placeWrapperGlyphNode(wrapper, glyphNode, position = "after") {
  if (!wrapper || !glyphNode) {
    return;
  }

  if (wrapperGlyphNodeIsInPosition(wrapper, glyphNode, position)) {
    return;
  }

  glyphNode.remove();

  const anchor = wrapper.querySelector(":scope > a[href]");

  if (!anchor) {
    return;
  }

  if (position === "before") {
    wrapper.insertBefore(glyphNode, anchor);
  } else if (anchor.nextSibling) {
    wrapper.insertBefore(glyphNode, anchor.nextSibling);
  } else {
    wrapper.appendChild(glyphNode);
  }
}

function applyLinkDecorationClasses(link, providerKey, underlineMode, iconMode) {
  if (!link) {
    return;
  }

  clearLinkClasses(link);

  link.classList.add("rich-preview-link", `rich-preview-link--${providerKey}`);

  if (underlineMode) {
    link.classList.add(`rich-preview-link--underline-${underlineMode}`);
    link.dataset.richPreviewUnderline = underlineMode;
  } else {
    delete link.dataset.richPreviewUnderline;
  }

  if (iconMode) {
    link.classList.add(`rich-preview-link--icon-${iconMode}`);
    link.dataset.richPreviewIcon = iconMode;
  } else {
    delete link.dataset.richPreviewIcon;
  }

  link.dataset.richPreview = "true";
  link.dataset.richPreviewType = providerKey;
}

function applyWrapperDecorationClasses(wrapper, providerKey, underlineMode, iconMode) {
  if (!wrapper) {
    return;
  }

  clearWrapperState(wrapper);

  wrapper.classList.add("rich-preview-wrap", `rich-preview-wrap--${providerKey}`);

  if (underlineMode) {
    wrapper.classList.add(`rich-preview-wrap--underline-${underlineMode}`);
  }

  if (iconMode) {
    wrapper.classList.add(`rich-preview-wrap--icon-${iconMode}`);
  }

  wrapper.dataset.providerKey = providerKey;
  wrapper.dataset.richPreview = "true";
}

function applyProviderColor(link, wrapper, providerKey, config) {
  const color = providerColor(providerKey, config, "var(--tertiary)");

  if (!color) {
    return;
  }

  if (link) {
    link.style.setProperty("--rp-color", color);
  }

  if (wrapper) {
    wrapper.style.setProperty("--rp-color", color);
  }
}

function ensureInlineGlyph(link, providerKey, config, iconMode) {
  if (!link || !providerKey || !iconMode) {
    removeInlineGlyphNode(link);
    return;
  }

  if (anchorHasComplexInlineContent(link)) {
    removeInlineGlyphNode(link);
    return;
  }

  let glyphNode = link.querySelector(":scope > .thc-inline-glyph");

  if (!glyphNode) {
    glyphNode = buildInlineGlyphFragment(providerKey, config, false);
  }

  if (!glyphNode) {
    return;
  }

  placeInlineGlyphNode(link, glyphNode, iconMode);
}

function ensureWrapperGlyph(wrapper, providerKey, config, iconMode) {
  if (!wrapper || !providerKey || !iconMode) {
    removeWrapperGlyphNode(wrapper);
    return;
  }

  let glyphNode = wrapper.querySelector(":scope > .thc-inline-glyph-wrap");

  if (!glyphNode) {
    glyphNode = buildInlineGlyphFragment(providerKey, config, true);
  }

  if (!glyphNode) {
    return;
  }

  placeWrapperGlyphNode(wrapper, glyphNode, iconMode);
}

function createAnchorFromWrapper(wrapper) {
  if (!(wrapper instanceof Element)) {
    return null;
  }

  const href = sanitizeURL(wrapper.dataset.previewHref || wrapper.dataset.href);

  if (!href) {
    return null;
  }

  const text =
  wrapper.dataset.previewText?.trim() ||
  wrapper.textContent?.trim() ||
  href;

  wrapper.textContent = "";

  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.textContent = text;
  anchor.setAttribute("data-bbcode", "true");

  const title = wrapper.dataset.previewTitle?.trim();
  if (title) {
    anchor.title = title;
  }

  wrapper.appendChild(anchor);
  return anchor;
}

function ensureWrappedAnchor(wrapper, link = null) {
  const existing = resolveLink(wrapper, link);

  if (existing) {
    return existing;
  }

  return createAnchorFromWrapper(wrapper);
}

function normalizeWrappedAnchor(wrapper, link = null) {
  const resolvedLink = ensureWrappedAnchor(wrapper, link);

  if (!(resolvedLink instanceof HTMLAnchorElement)) {
    return null;
  }

  const href = sanitizeURL(
    resolvedLink.getAttribute("href") || wrapper?.dataset?.previewHref
  );

  if (!href) {
    return null;
  }

  resolvedLink.setAttribute("href", href);
  resolvedLink.setAttribute("data-bbcode", "true");

  if (wrapper?.dataset?.previewTitle && !resolvedLink.getAttribute("title")) {
    resolvedLink.setAttribute("title", wrapper.dataset.previewTitle);
  }

  return resolvedLink;
}

function wrappedProviderKey(target) {
  return target?.glyphProviderKey || target?.providerKey || target?.type || null;
}

export function decorateAnchorOnlyPreviewLink(link, target, config) {
  if (!(link instanceof HTMLAnchorElement) || !target?.providerKey) {
    return;
  }

  const providerKey = wrappedProviderKey(target);
  const underlineMode = normalizeUnderlineMode(config);
  const iconMode = normalizeIconMode(config, providerKey);

  clearInlineProviderPresentation(link);

  const href = sanitizeURL(link.getAttribute("href"));
  if (href) {
    link.setAttribute("href", href);
  }

  applyLinkDecorationClasses(link, providerKey, underlineMode, iconMode);
  applyProviderColor(link, null, providerKey, config);
  ensureInlineGlyph(link, providerKey, config, iconMode);
}

export function decorateAutoDetectedLink(link, target, config) {
  decorateAnchorOnlyPreviewLink(link, target, config);
}

export function decorateWrappedPreviewLink(wrapper, link, target, config) {
  if (!(wrapper instanceof Element) || !target?.providerKey) {
    return;
  }

  const resolvedLink = normalizeWrappedAnchor(wrapper, link);

  if (!(resolvedLink instanceof HTMLAnchorElement)) {
    return;
  }

  const providerKey = wrappedProviderKey(target);
  const underlineMode = normalizeUnderlineMode(config);
  const iconMode = normalizeIconMode(config, providerKey);

  clearInlineProviderPresentation(resolvedLink, wrapper);

  applyLinkDecorationClasses(resolvedLink, providerKey, underlineMode, iconMode);
  applyWrapperDecorationClasses(wrapper, providerKey, underlineMode, iconMode);
  applyProviderColor(resolvedLink, wrapper, providerKey, config);

  if (anchorHasComplexInlineContent(resolvedLink)) {
    ensureWrapperGlyph(wrapper, providerKey, config, iconMode);
    removeInlineGlyphNode(resolvedLink);
  } else {
    removeWrapperGlyphNode(wrapper);
    ensureInlineGlyph(resolvedLink, providerKey, config, iconMode);
  }
}

export function clearDecoratedLink(link, wrapper = null) {
  const resolvedLink = resolveLink(wrapper, link);
  clearInlineProviderPresentation(resolvedLink, wrapper);
  clearWrapperState(wrapper);
}