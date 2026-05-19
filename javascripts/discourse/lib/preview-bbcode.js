/**
 * Registers the [preview]...[/preview] wrapper handling and applies
 * preview decoration to both manual wrapped links and auto-detected
 * eligible links in cooked content.
 *
 * Supported manual syntaxes:
 *
 * 1. [preview]https://example.com/[/preview]
 *    -> repaired from malformed bare-URL cooked output when needed
 *
 * 2. [preview][Label](https://example.com/)[/preview]
 *    -> repaired when cooked output becomes:
 *       [preview]<a href="https://example.com/">Label</a>[/preview]
 *
 * Intentionally unsupported here:
 * - [preview]<a href="...">Label</a>[/preview] authored as raw HTML
 * - [preview=<a href="...">...</a>]Label[/preview]
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
    .replace(new RegExp(`${CLOSE_TAG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), "");
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

function cleanupPreviewTextNode(node, marker) {
  if (node?.nodeType !== Node.TEXT_NODE) {
    return false;
  }

  const value = node.nodeValue || "";
  if (!value.includes(marker)) {
    return false;
  }

  const cleaned = value.replace(marker, "");
  if (cleaned) {
    node.nodeValue = cleaned;
  } else {
    node.remove();
  }

  return true;
}

function cleanupResidualPreviewMarkers(container, preserveNode = null) {
  if (!(container instanceof Element)) {
    return;
  }

  for (const node of [...container.childNodes]) {
    if (node === preserveNode) {
      continue;
    }

    if (node.nodeType !== Node.TEXT_NODE) {
      continue;
    }

    const value = node.nodeValue || "";
    if (!value.includes(OPEN_TAG) && !value.includes(CLOSE_TAG)) {
      continue;
    }

    const cleaned = value.replaceAll(OPEN_TAG, "").replaceAll(CLOSE_TAG, "");
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
    (containerHtml.includes(CLOSE_TAG) ||
      rawHref.toLowerCase().includes(ENCODED_CLOSE_TAG)) &&
    rawText.includes(CLOSE_TAG);

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

  cleanupPreviewTextNode(container.firstChild, OPEN_TAG);
  cleanupPreviewTextNode(container.lastChild, CLOSE_TAG);

  const wrap = ensureWrapAroundAnchor(anchor);
  cleanupResidualPreviewMarkers(container, wrap);

  return !!wrap;
}

function repairWrappedMarkdownLinkPreview(container) {
  if (!(container instanceof Element)) {
    return false;
  }

  let repairedAny = false;

  container.querySelectorAll(":scope > a[href]").forEach((anchor) => {
    if (!(anchor instanceof HTMLAnchorElement)) {
      return;
    }

    if (anchor.closest(WRAP_SELECTOR)) {
      return;
    }

    const prev = anchor.previousSibling;
    const next = anchor.nextSibling;

    if (prev?.nodeType !== Node.TEXT_NODE || next?.nodeType !== Node.TEXT_NODE) {
      return;
    }

    const prevValue = prev.nodeValue || "";
    const nextValue = next.nodeValue || "";

    if (!prevValue.includes(OPEN_TAG) || !nextValue.includes(CLOSE_TAG)) {
      return;
    }

    prev.nodeValue = prevValue.replace(OPEN_TAG, "");
    next.nodeValue = nextValue.replace(CLOSE_TAG, "");

    if (!prev.nodeValue) {
      prev.remove();
    }

    if (!next.nodeValue) {
      next.remove();
    }

    ensureWrapAroundAnchor(anchor);
    repairedAny = true;
  });

  if (repairedAny) {
    cleanupResidualPreviewMarkers(container);
  }

  return repairedAny;
}

function repairSupportedPreviewSyntax(root) {
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
      repairWrappedMarkdownLinkPreview(container);
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
    repairSupportedPreviewSyntax(root);
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