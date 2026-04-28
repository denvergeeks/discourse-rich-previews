import {
  providerKeyForTarget,
  providerColor,
  renderInlineProviderGlyph,
} from "./rich-preview-utils";

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

function getInlineGlyphNode(link) {
  return link?.querySelector(":scope > .thc-inline-glyph") || null;
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
}

function clearInlineProviderPresentation(link, wrapper = null) {
  if (link) {
    link.style.removeProperty("--rp-color");
    removeInlineGlyphNode(link);
    clearLinkClasses(link);

    delete link.dataset.richPreviewType;
    delete link.dataset.richPreviewUnderline;
    delete link.dataset.richPreviewIcon;
  }

  if (wrapper) {
    wrapper.style.removeProperty("--rp-color");
  }
}

function buildInlineGlyphFragment(providerKey, config) {
  const html = renderInlineProviderGlyph(providerKey, config);

  if (!html) {
    return null;
  }

  const template = document.createElement("template");
  template.innerHTML = html.trim();

  return template.content.firstElementChild || null;
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

  return normalizeInlineGlyphPosition(config);
}

function anchorHasComplexInlineContent(link) {
  if (!link) {
    return false;
  }

  return !!link.querySelector(
    "img, picture, video, audio, svg:not(.thc-inline-glyph svg), .onebox, .badge-wrapper"
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

function applyLinkClasses(link, providerKey, config) {
  if (!link || !providerKey) {
    return;
  }

  clearLinkClasses(link);

  link.classList.add("rich-preview-link", `rich-preview-link--${providerKey}`);

  const underlineMode = normalizeUnderlineMode(config);
  const iconMode = normalizeIconMode(config, providerKey);

  if (underlineMode === "always") {
    link.classList.add("rich-preview-link--underline-always");
  } else if (underlineMode === "hover") {
    link.classList.add("rich-preview-link--underline-hover");
  }

  if (iconMode === "before") {
    link.classList.add("rich-preview-link--icon-before");
  } else if (iconMode === "after") {
    link.classList.add("rich-preview-link--icon-after");
  }
}

function applyInlineProviderPresentation(link, wrapper, providerKey, config) {
  if (!providerKey) {
    return;
  }

  const color = providerColor(providerKey, config, "var(--tertiary)");

  if (wrapper) {
    if (color) {
      wrapper.style.setProperty("--rp-color", color);
    } else {
      wrapper.style.removeProperty("--rp-color");
    }
  }

  if (!link) {
    return;
  }

  if (color) {
    link.style.setProperty("--rp-color", color);
  } else {
    link.style.removeProperty("--rp-color");
  }

  applyLinkClasses(link, providerKey, config);

  link.dataset.richPreviewType = providerKey;

  const underlineMode = normalizeUnderlineMode(config);
  const iconMode = normalizeIconMode(config, providerKey);

  if (underlineMode) {
    link.dataset.richPreviewUnderline = underlineMode;
  } else {
    delete link.dataset.richPreviewUnderline;
  }

  if (iconMode) {
    link.dataset.richPreviewIcon = iconMode;
  } else {
    delete link.dataset.richPreviewIcon;
  }

  if (config?.previewsShowIcon === false) {
    removeInlineGlyphNode(link);
    return;
  }

  if (anchorHasComplexInlineContent(link)) {
    removeInlineGlyphNode(link);
    return;
  }

  const existingGlyphNode = getInlineGlyphNode(link);
  const nextGlyphNode = buildInlineGlyphFragment(providerKey, config);

  if (!nextGlyphNode) {
    removeInlineGlyphNode(link);
    return;
  }

  if (existingGlyphNode) {
    existingGlyphNode.replaceWith(nextGlyphNode);
  }

  const glyphNode = existingGlyphNode ? getInlineGlyphNode(link) : nextGlyphNode;
  const position = normalizeInlineGlyphPosition(config);

  placeInlineGlyphNode(link, glyphNode, position);
}

export function decorateAutoDetectedLink(link, target, config) {
  const providerKey = providerKeyForTarget(target, null);

  if (!providerKey) {
    clearInlineProviderPresentation(link);
    return;
  }

  applyInlineProviderPresentation(link, null, providerKey, config);
}

export function decorateWrappedPreviewLink(wrapper, link, target, config) {
  const resolvedLink = resolveLink(wrapper, link);
  const providerKey = providerKeyForTarget(target, null);

  if (!providerKey) {
    clearInlineProviderPresentation(resolvedLink, wrapper);
    clearWrapperState(wrapper);
    return;
  }

  applyInlineProviderPresentation(resolvedLink, wrapper, providerKey, config);

  if (wrapper) {
    wrapper.classList.remove(...WRAP_TYPE_CLASSES);
    wrapper.classList.add(`rich-preview-wrap--${providerKey}`);

    const underlineMode = normalizeUnderlineMode(config);
    const iconMode = normalizeIconMode(config, providerKey);

    wrapper.classList.toggle(
      "rich-preview-wrap--underline-always",
      underlineMode === "always"
    );
    wrapper.classList.toggle(
      "rich-preview-wrap--underline-hover",
      underlineMode === "hover"
    );
    wrapper.classList.toggle(
      "rich-preview-wrap--icon-before",
      iconMode === "before"
    );
    wrapper.classList.toggle(
      "rich-preview-wrap--icon-after",
      iconMode === "after"
    );
  }
}

export function clearDecoratedLink(link, wrapper = null) {
  const resolvedLink = resolveLink(wrapper, link);

  clearInlineProviderPresentation(resolvedLink, wrapper);
  clearWrapperState(wrapper);
}
