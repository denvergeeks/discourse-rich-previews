import {
  providerKeyForTarget,
  providerColor,
  renderInlineProviderGlyph,
} from "./rich-preview-utils";

function removeInlineGlyphNode(link) {
  link?.querySelector(":scope > .thc-inline-glyph")?.remove();
}

function getInlineGlyphNode(link) {
  return link?.querySelector(":scope > .thc-inline-glyph") || null;
}

function clearInlineProviderPresentation(link) {
  if (!link) {
    return;
  }

  link.style.removeProperty("--rp-color");
  removeInlineGlyphNode(link);
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

function applyInlineProviderPresentation(link, providerKey, config) {
  if (!link || !providerKey) {
    return;
  }

  const color = providerColor(providerKey, config);

  if (color) {
    link.style.setProperty("--rp-color", color);
  } else {
    link.style.removeProperty("--rp-color");
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

  const glyphNode = existingGlyphNode
    ? getInlineGlyphNode(link)
    : nextGlyphNode;

  const position = normalizeInlineGlyphPosition(config);
  placeInlineGlyphNode(link, glyphNode, position);
}

function normalizeUnderlineMode(config) {
  if (!config?.previewsShowUnderline) {
    return "none";
  }

  return config?.previewsUnderlineAlways ? "always" : "hover";
}

function normalizeIconMode(config, providerKey) {
  if (!providerKey || config?.previewsShowIcon === false) {
    return "none";
  }

  return normalizeInlineGlyphPosition(config);
}

function applySharedLinkState(link, providerKey, config) {
  if (!link || !providerKey) {
    return;
  }

  link.dataset.richPreviewType = providerKey;
  link.dataset.richPreviewUnderline = normalizeUnderlineMode(config);
  link.dataset.richPreviewIcon = normalizeIconMode(config, providerKey);
}

function clearSharedLinkState(link) {
  if (!link) {
    return;
  }

  delete link.dataset.richPreviewType;
  delete link.dataset.richPreviewUnderline;
  delete link.dataset.richPreviewIcon;
}

export function decorateAutoDetectedLink(link, target, config) {
  const providerKey = providerKeyForTarget(target, null);

  if (!providerKey) {
    clearInlineProviderPresentation(link);
    clearSharedLinkState(link);
    return;
  }

  applyInlineProviderPresentation(link, providerKey, config);
  applySharedLinkState(link, providerKey, config);
}

export function decorateWrappedPreviewLink(wrapper, link, target, config) {
  const providerKey = providerKeyForTarget(target, null);

  if (!providerKey) {
    clearInlineProviderPresentation(link);
    clearSharedLinkState(link);
    return;
  }

  applyInlineProviderPresentation(link, providerKey, config);
  applySharedLinkState(link, providerKey, config);

  if (wrapper) {
    wrapper.classList.remove(
      "rich-preview-wrap--topic",
      "rich-preview-wrap--remote_topic",
      "rich-preview-wrap--external",
      "rich-preview-wrap--wikipedia"
    );
    wrapper.classList.add(`rich-preview-wrap--${providerKey}`);
    wrapper.classList.toggle(
      "rich-preview-wrap--underline-always",
      link.dataset.richPreviewUnderline === "always"
    );
    wrapper.classList.toggle(
      "rich-preview-wrap--underline-hover",
      link.dataset.richPreviewUnderline === "hover"
    );
    wrapper.classList.toggle(
      "rich-preview-wrap--icon-before",
      link.dataset.richPreviewIcon === "before"
    );
    wrapper.classList.toggle(
      "rich-preview-wrap--icon-after",
      link.dataset.richPreviewIcon === "after"
    );
  }
}

export function clearDecoratedLink(link, wrapper = null) {
  clearInlineProviderPresentation(link);
  clearSharedLinkState(link);

  if (wrapper) {
    wrapper.classList.remove(
      "rich-preview-wrap--topic",
      "rich-preview-wrap--remote_topic",
      "rich-preview-wrap--external",
      "rich-preview-wrap--wikipedia",
      "rich-preview-wrap--underline-always",
      "rich-preview-wrap--underline-hover",
      "rich-preview-wrap--icon-before",
      "rich-preview-wrap--icon-after"
    );
  }
}
