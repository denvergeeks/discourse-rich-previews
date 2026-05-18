/**
 * Applies preview decoration to both manual wrapped links and
 * auto-detected eligible links in cooked content.
 *
 * This file intentionally performs a small cooked-stage repair for a few
 * malformed literal [preview]...[/preview] output shapes that can still
 * appear after markdown processing:
 *
 * 1. [preview]https://example.com/[/preview]
 *    -> may autolink as href="https://example.com/%5B/preview%5D"
 *
 * 2. [preview]<a href="https://example.com/">Label</a>[/preview]
 *
 * 3. [preview=<a href="https://example.com/">https://example.com/</a>]Label[/preview]
 *
 * The repair is narrow and DOM-based on purpose, to minimize production risk.
 */

import { linkInSupportedArea } from "./rich-preview-utils";
import { matchPreviewTarget } from "./preview-router";
import {
  decorateAutoDetectedLink,
  decorateWrappedPreviewLink,
  clearDecoratedLink,
} from "./link-decorator";

const WRAP_SELECTOR = ".rich-preview-wrap[data-rich-preview='true']";
const OPEN_TAG = "[preview]";
const CLOSE_TAG = "[/preview]";
const OPEN_EQ_PREFIX = "[preview=";
const ENCODED_CLOSE_TAG = "%5B/preview%5D";

function clearWrapModifierClasses(wrapEl) {
  if (!(wrapEl instanceof Element)) {
    return;
  }

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
  delete wrapEl.dataset.providerKey;
}

function clearAutoLinkIndicators(root) {
  if (!(root instanceof Element)) {
    return;
  }

  root
    .querySelectorAll(
      "a[data-rich-preview-type], a.rich-preview-link, .rich-preview-wrap a[href]"
    )
    .forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      clearDecoratedLink(link);
    });
}

function getWrappedAnchor(wrapEl) {
  if (!(wrapEl instanceof Element)) {
    return null;
  }

  const link = wrapEl.querySelector(":scope > a[href]");
  return link instanceof HTMLAnchorElement ? link : null;
}

function stripCloseTagSuffix(value) {
  if (typeof value !== "string" || !value.length) {
    return value;
  }

  return value
    .replace(new RegExp(`${ENCODED_CLOSE_TAG}$`, "i"), "")
    .replace(/\[\/preview\]$/i, "");
}

function ensureWrapAroundAnchor(anchor) {
  if (!(anchor instanceof HTMLAnchorElement)) {
    return null;
  }

  const existingWrap = anchor.closest(WRAP_SELECTOR);
  if (existingWrap) {
    return existingWrap;
  }

  const wrap = document.createElement("span");
  wrap.className = "rich-preview-wrap";
  wrap.dataset.richPreview = "true";

  anchor.parentNode?.insertBefore(wrap, anchor);
  wrap.appendChild(anchor);

  return wrap;
}

function trimTextNodeValue(node, matcher, replacement = "") {
  if (node?.nodeType !== Node.TEXT_NODE) {
    return false;
  }

  const original = node.nodeValue || "";
  const updated = original.replace(matcher, replacement);

  if (updated === original) {
    return false;
  }

  if (updated) {
    node.nodeValue = updated;
  } else {
    node.remove();
  }

  return true;
}

function cleanupPreviewMarkerText(container) {
  if (!(container instanceof Element)) {
    return;
  }

  for (const node of [...container.childNodes]) {
    if (node.nodeType !== Node.TEXT_NODE) {
      continue;
    }

    const value = node.nodeValue || "";
    const cleaned = value
      .replaceAll(OPEN_TAG, "")
      .replaceAll(CLOSE_TAG, "")
      .replace(/\[preview=$/i, "");

    if (cleaned === value) {
      continue;
    }

    if (cleaned) {
      node.nodeValue = cleaned;
    } else {
      node.remove();
    }
  }
}

function repairBrokenBareUrlPreview(container) {
  if (!(container instanceof Element)) {
    return false;
  }

  const anchor = container.querySelector(":scope > a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) {
    return false;
  }

  const rawHref = anchor.getAttribute("href") || "";
  const rawText = anchor.textContent || "";
  const containerHtml = container.innerHTML || "";

  const looksBroken =
    containerHtml.includes(OPEN_TAG) &&
    rawText.includes(CLOSE_TAG) &&
    rawHref.toLowerCase().includes(ENCODED_CLOSE_TAG);

  if (!looksBroken) {
    return false;
  }

  const repairedHref = stripCloseTagSuffix(rawHref);
  const repairedText = stripCloseTagSuffix(rawText);

  if (!repairedHref || !repairedText) {
    return false;
  }

  anchor.setAttribute("href", repairedHref);
  anchor.textContent = repairedText;

  trimTextNodeValue(container.firstChild, /\[preview\]/i, "");
  cleanupPreviewMarkerText(container);
  ensureWrapAroundAnchor(anchor);

  return true;
}

function repairLiteralWrappedAnchorPreview(container) {
  if (!(container instanceof Element)) {
    return false;
  }

  const anchor = container.querySelector(":scope > a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) {
    return false;
  }

  const firstNode = container.firstChild;
  const lastNode = container.lastChild;

  const hasLeadingOpenTag =
    firstNode?.nodeType === Node.TEXT_NODE &&
    (firstNode.nodeValue || "").includes(OPEN_TAG);

  const hasTrailingCloseTag =
    lastNode?.nodeType === Node.TEXT_NODE &&
    (lastNode.nodeValue || "").includes(CLOSE_TAG);

  if (!hasLeadingOpenTag || !hasTrailingCloseTag) {
    return false;
  }

  trimTextNodeValue(firstNode, /\[preview\]/i, "");
  trimTextNodeValue(lastNode, /\[\/preview\]/i, "");
  cleanupPreviewMarkerText(container);
  ensureWrapAroundAnchor(anchor);

  return true;
}

function repairPreviewEqualsAnchorSyntax(container) {
  if (!(container instanceof Element)) {
    return false;
  }

  const anchor = container.querySelector(":scope > a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) {
    return false;
  }

  const firstNode = container.firstChild;
  const afterAnchor = anchor.nextSibling;
  const lastNode = container.lastChild;

  const hasOpeningPrefix =
    firstNode?.nodeType === Node.TEXT_NODE &&
    (firstNode.nodeValue || "").includes(OPEN_EQ_PREFIX);

  const closesBracketAfterAnchor =
    afterAnchor?.nodeType === Node.TEXT_NODE &&
    (afterAnchor.nodeValue || "").startsWith("]");

  const hasClosingTag =
    lastNode?.nodeType === Node.TEXT_NODE &&
    (lastNode.nodeValue || "").includes(CLOSE_TAG);

  if (!hasOpeningPrefix || !closesBracketAfterAnchor || !hasClosingTag) {
    return false;
  }

  const href = anchor.getAttribute("href") || "";
  if (!href) {
    return false;
  }

  const labelText = (afterAnchor.nodeValue || "").replace(/^\]/, "");
  const closingText = (lastNode.nodeValue || "").replace(CLOSE_TAG, "");
  const finalLabel = `${labelText}${closingText}`.trim();

  anchor.setAttribute("href", href);
  anchor.textContent = finalLabel || anchor.textContent || href;

  trimTextNodeValue(firstNode, /\[preview=$/i, "");

  if (afterAnchor.nodeType === Node.TEXT_NODE) {
    afterAnchor.nodeValue = "";
    afterAnchor.remove();
  }

  trimTextNodeValue(lastNode, /\[\/preview\]/i, "");
  cleanupPreviewMarkerText(container);
  ensureWrapAroundAnchor(anchor);

  return true;
}

function repairLiteralPreviewSyntax(root) {
  if (!(root instanceof Element)) {
    return;
  }

  root.querySelectorAll("p, li, td, div, blockquote").forEach((container) => {
    if (!(container instanceof Element)) {
      return;
    }

    if (container.querySelector(WRAP_SELECTOR)) {
      return;
    }

    repairBrokenBareUrlPreview(container) ||
      repairLiteralWrappedAnchorPreview(container) ||
      repairPreviewEqualsAnchorSyntax(container);
  });
}

function stampModifierClasses(wrapEl, config) {
  if (!(wrapEl instanceof Element)) {
    return;
  }

  clearWrapModifierClasses(wrapEl);

  const link = getWrappedAnchor(wrapEl);
  if (!link) {
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

  if (link.dataset.richPreviewType) {
    wrapEl.dataset.providerKey = link.dataset.richPreviewType;
  }
}

function stampAutoLinkIndicators(root, config) {
  if (!(root instanceof Element) || !config) {
    return;
  }

  clearAutoLinkIndicators(root);

  root.querySelectorAll("a[href]").forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    if (link.closest(WRAP_SELECTOR)) {
      return;
    }

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

export function applyPreviewWraps(root, tagName = "preview", config = null) {
  if (!(root instanceof Element)) {
    return;
  }

  if (tagName === "preview") {
    repairLiteralPreviewSyntax(root);
  }

  if (!config) {
    return;
  }

  root.querySelectorAll(WRAP_SELECTOR).forEach((wrapEl) => {
    stampModifierClasses(wrapEl, config);
  });

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