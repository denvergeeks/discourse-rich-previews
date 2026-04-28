/**
 * Registers the [preview]...[/preview] wrapper handling and applies
 * visual decoration metadata to both manual wrapped links and
 * auto-detected eligible links in cooked content.
 */

import { classifyLink, linkInSupportedArea } from "./rich-preview-utils";
import { matchPreviewTarget } from "./preview-router";

function clearWrapModifierClasses(wrapEl) {
  if (!(wrapEl instanceof Element)) return;

  [
    "rich-preview-wrap--topic",
    "rich-preview-wrap--remote_topic",
    "rich-preview-wrap--external",
    "rich-preview-wrap--wikipedia",
    "rich-preview-wrap--underline-always",
    "rich-preview-wrap--underline-hover",
    "rich-preview-wrap--icon-before",
    "rich-preview-wrap--icon-after",
  ].forEach((klass) => wrapEl.classList.remove(klass));

  wrapEl.style.removeProperty("--rp-color");
}

function clearAutoLinkIndicators(root) {
  if (!(root instanceof Element)) return;

  root.querySelectorAll("a[data-rich-preview-type]").forEach((link) => {
    link.removeAttribute("data-rich-preview-type");
    link.removeAttribute("data-rich-preview-underline");
    link.removeAttribute("data-rich-preview-icon");
    link.style.removeProperty("--rp-color");
  });
}

/**
 * Manual [preview] wrapper decoration.
 * Only decorate when the wrapped link is actually eligible in the current
 * render context/settings, so visual treatment matches real preview behavior.
 */
function stampModifierClasses(wrapEl, config) {
  if (!(wrapEl instanceof Element)) return;

  clearWrapModifierClasses(wrapEl);

  const link = wrapEl.querySelector("a[href]");
  if (!(link instanceof HTMLAnchorElement)) {
    return;
  }

  if (!linkInSupportedArea(link, config)) {
    return;
  }

  const type = classifyLink(link, config);
  if (!type || type === "unsupported") {
    return;
  }

  wrapEl.classList.add(`rich-preview-wrap--${type}`);

  if (config?.previewsShowUnderline) {
    wrapEl.classList.add(
      config?.previewsUnderlineAlways
        ? "rich-preview-wrap--underline-always"
        : "rich-preview-wrap--underline-hover"
    );
  }

  if (config?.previewsShowIcon) {
    wrapEl.classList.add(
      config?.previewsIconPosition === "before"
        ? "rich-preview-wrap--icon-before"
        : "rich-preview-wrap--icon-after"
    );
  }

  const colorMap = {
    topic: config?.previewsColorTopic,
    remote_topic: config?.previewsColorRemote,
    external: config?.previewsColorRemote,
    wikipedia: config?.previewsColorWikipedia,
  };

  const color = colorMap[type];
  if (color) {
    wrapEl.style.setProperty("--rp-color", color);
  }
}

/**
 * Auto-link decoration for plain cooked links.
 * Uses the same routing decision as hover previews so visual indicators
 * and actual preview behavior cannot drift apart.
 */
function stampAutoLinkIndicators(root, config) {
  if (!(root instanceof Element) || !config) return;

  clearAutoLinkIndicators(root);

  if (!config.previewsShowIcon && !config.previewsShowUnderline) return;

  root.querySelectorAll("a[href]").forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    if (link.closest(".rich-preview-wrap")) return;

    if (!linkInSupportedArea(link, config)) {
      return;
    }

    const target = matchPreviewTarget(link, config);
    const type = target?.providerKey;

    if (!type || type === "unsupported") {
      return;
    }

    link.setAttribute("data-rich-preview-type", type);

    if (config.previewsShowUnderline) {
      link.setAttribute(
        "data-rich-preview-underline",
        config.previewsUnderlineAlways ? "always" : "hover"
      );
    } else {
      link.removeAttribute("data-rich-preview-underline");
    }

    if (config.previewsShowIcon) {
      link.setAttribute(
        "data-rich-preview-icon",
        config.previewsIconPosition === "before" ? "before" : "after"
      );
    } else {
      link.removeAttribute("data-rich-preview-icon");
    }

    const colorMap = {
      topic: config.previewsColorTopic,
      remote_topic: config.previewsColorRemote,
      external: config.previewsColorRemote,
      wikipedia: config.previewsColorWikipedia,
    };

    const color = colorMap[type];
    if (color) {
      link.style.setProperty("--rp-color", color);
    }
  });
}

/**
 * Converts literal [preview]...[/preview] text into wrapper spans
 * for older cooked posts or content that did not already render the wrapper.
 */
function wrapLiteralPreviewTags(root, tagName = "preview") {
  if (!(root instanceof Element)) return;

  const openTag = `[${tagName}]`;
  const closeTag = `[/${tagName}]`;

  root.querySelectorAll("p, li, td, div, blockquote").forEach((container) => {
    if (!(container instanceof Element)) return;

    const html = container.innerHTML;
    if (!html || !html.includes(openTag)) return;

    container.innerHTML = html.replaceAll(
      new RegExp(
        `\\[${tagName}\\]([\\s\\S]*?)\\[\\/${tagName}\\]`,
        "gi"
      ),
      `<span class="rich-preview-wrap" data-rich-preview="true">$1</span>`
    );
  });
}

/**
 * Applies manual wrapper decoration + auto-link indicators to a cooked root.
 */
export function applyPreviewWraps(root, tagName = "preview", config = null) {
  if (!(root instanceof Element)) return;

  wrapLiteralPreviewTags(root, tagName);

  if (config) {
    root
      .querySelectorAll(".rich-preview-wrap[data-rich-preview='true']")
      .forEach((wrapEl) => stampModifierClasses(wrapEl, config));

    stampAutoLinkIndicators(root, config);
  }
}

/**
 * Hook into cooked post rendering.
 */
export function registerPreviewBBCode(api, config) {
  api.decorateCookedElement(
    (element) => {
      applyPreviewWraps(element, "preview", config);
    },
    {
      id: "rich-preview-bbcode-decorator",
      onlyStream: false,
    }
  );
}
