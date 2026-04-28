/**
 * Registers the [preview]...[/preview] wrapper handling and applies
 * preview decoration to both manual wrapped links and auto-detected
 * eligible links in cooked content.
 */

import { linkInSupportedArea } from "./rich-preview-utils";
import { matchPreviewTarget } from "./preview-router";
import {
  decorateAutoDetectedLink,
  decorateWrappedPreviewLink,
  clearDecoratedLink,
} from "./link-decorator";

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
    if (!(link instanceof HTMLAnchorElement)) return;
    clearDecoratedLink(link);
  });
}

function stampModifierClasses(wrapEl, config) {
  if (!(wrapEl instanceof Element)) return;

  clearWrapModifierClasses(wrapEl);

  const link = wrapEl.querySelector("a[href]");
  if (!(link instanceof HTMLAnchorElement)) {
    return;
  }

  if (!linkInSupportedArea(link, config)) {
    clearDecoratedLink(link, wrapEl);
    return;
  }

  const target = matchPreviewTarget(link, config);
  if (!target) {
    clearDecoratedLink(link, wrapEl);
    return;
  }

  decorateWrappedPreviewLink(wrapEl, link, target, config);
}

function stampAutoLinkIndicators(root, config) {
  if (!(root instanceof Element) || !config) return;

  clearAutoLinkIndicators(root);

  root.querySelectorAll("a[href]").forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    if (link.closest(".rich-preview-wrap")) return;

    if (!linkInSupportedArea(link, config)) {
      clearDecoratedLink(link);
      return;
    }

    const target = matchPreviewTarget(link, config);
    if (!target) {
      clearDecoratedLink(link);
      return;
    }

    decorateAutoDetectedLink(link, target, config);
  });
}

function wrapLiteralPreviewTags(root, tagName = "preview") {
  if (!(root instanceof Element)) return;

  const openTag = `[${tagName}]`;
  const closeTag = `[/${tagName}]`;

  root.querySelectorAll("p, li, td, div, blockquote").forEach((container) => {
    if (!(container instanceof Element)) return;

    const html = container.innerHTML;
    if (!html || !html.includes(openTag) || !html.includes(closeTag)) return;

    container.innerHTML = html.replaceAll(
      new RegExp(
        `\\[${tagName}\\]([\\s\\S]*?)\\[\\/${tagName}\\]`,
        "gi"
      ),
      `<span class="rich-preview-wrap" data-rich-preview="true">$1</span>`
    );
  });
}

export function applyPreviewWraps(root, tagName = "preview", config = null) {
  if (!(root instanceof Element)) return;

  wrapLiteralPreviewTags(root, tagName);

  if (!config) {
    return;
  }

  root
    .querySelectorAll(".rich-preview-wrap[data-rich-preview='true']")
    .forEach((wrapEl) => stampModifierClasses(wrapEl, config));

  stampAutoLinkIndicators(root, config);
}

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
