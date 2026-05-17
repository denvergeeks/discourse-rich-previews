import { iconHTML } from "discourse/lib/icon-library";

import { matchPreviewTarget } from "./preview-router";
import {
  escapeHTML,
  getPreviewProvider,
  providerColor,
  sanitizeURL,
} from "./rich-preview-utils";

function discourseIcon(name) {
  try {
    return iconHTML(name) || "";
  } catch {
    return "";
  }
}

function glyphHTMLForTarget(target, config) {
  const providerKey = target?.providerKey || target?.type || "external";
  const provider = getPreviewProvider(config, providerKey);

  if (!provider || provider.enabled === false || provider.glyphMode === "none") {
    return "";
  }

  if (provider.glyphMode === "emoji") {
    const emoji = String(provider.emoji || "").trim();
    return emoji
      ? `<span class="thc-inline-glyph" aria-hidden="true">${escapeHTML(
          emoji
        )}</span>`
      : "";
  }

  const iconName = String(provider.icon || "").trim();
  if (!iconName) {
    return "";
  }

  const icon = discourseIcon(iconName);
  return icon
    ? `<span class="thc-inline-glyph" aria-hidden="true">${icon}</span>`
    : "";
}

function shouldDecorateTarget(target, config) {
  const providerKey = target?.providerKey || target?.type;
  const provider = getPreviewProvider(config, providerKey);

  if (!provider || provider.enabled === false) {
    return false;
  }

  switch (providerKey) {
    case "topic":
      return (
        config.previewsTopicMode === "composer_only" ||
        config.previewsTopicMode === "auto_and_composer"
      );

    case "remote_topic":
      return (
        config.previewsRemoteTopicMode === "composer_only" ||
        config.previewsRemoteTopicMode === "auto_and_composer"
      );

    case "external":
      return (
        config.previewsExternalMode === "composer_only" ||
        config.previewsExternalMode === "auto_and_composer"
      );

    case "wikipedia":
      return (
        config.previewsWikipediaMode === "composer_only" ||
        config.previewsWikipediaMode === "auto_and_composer"
      );

    default:
      return false;
  }
}

function applyPreviewClasses(anchor, target, config) {
  const providerKey = target?.providerKey || target?.type || "external";

  anchor.classList.add("rich-preview-link");
  anchor.classList.add(`rich-preview-link--${providerKey}`);

  if (config.previewsShowUnderline) {
    anchor.classList.add(
      config.previewsUnderlineAlways
        ? "rich-preview-link--underline-always"
        : "rich-preview-link--underline-hover"
    );
  }

  if (config.previewsShowIcon) {
    anchor.classList.add(
      config.previewsIconPosition === "before"
        ? "rich-preview-link--icon-before"
        : "rich-preview-link--icon-after"
    );
  }
}

function applyPreviewDataAttributes(anchor, target, config) {
  const providerKey = target?.providerKey || target?.type || "external";
  const color = providerColor(providerKey, config, "");

  anchor.dataset.richPreview = "true";
  anchor.dataset.richPreviewType = providerKey;
  anchor.dataset.bbcode = "true";

  if (config.previewsShowUnderline) {
    anchor.dataset.richPreviewUnderline = config.previewsUnderlineAlways
      ? "always"
      : "hover";
  }

  if (config.previewsShowIcon) {
    anchor.dataset.richPreviewIcon = config.previewsIconPosition;
  }

  if (color) {
    anchor.style.setProperty("--rp-color", color);
  }
}

function appendGlyph(anchor, target, config) {
  if (!config.previewsShowIcon) {
    return;
  }

  if (anchor.querySelector(":scope > .thc-inline-glyph")) {
    return;
  }

  const glyph = glyphHTMLForTarget(target, config);
  if (!glyph) {
    return;
  }

  if (config.previewsIconPosition === "before") {
    anchor.insertAdjacentHTML("afterbegin", glyph);
  } else {
    anchor.insertAdjacentHTML("beforeend", glyph);
  }
}

function decoratePreviewAnchor(anchor, config) {
  if (!(anchor instanceof HTMLAnchorElement)) {
    return;
  }

  if (anchor.dataset.richPreviewDecorated === "true") {
    return;
  }

  if (anchor.closest(".onebox, .inline-onebox")) {
    return;
  }

  const href = sanitizeURL(anchor.getAttribute("href"));
  if (!href) {
    return;
  }

  const target = matchPreviewTarget(href, config);
  if (!target || !shouldDecorateTarget(target, config)) {
    return;
  }

  applyPreviewClasses(anchor, target, config);
  applyPreviewDataAttributes(anchor, target, config);
  appendGlyph(anchor, target, config);

  anchor.dataset.richPreviewDecorated = "true";
}

function decorateCooked(container, config) {
  const anchors = container.querySelectorAll('a[data-bbcode="true"]');
  anchors.forEach((anchor) => decoratePreviewAnchor(anchor, config));
}

export function registerPreviewBBCode(api, config) {
  api.decorateCookedElement(
    (element) => {
      decorateCooked(element, config);
    },
    { id: "discourse-rich-previews-bbcode" }
  );
}