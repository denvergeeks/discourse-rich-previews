/**
 * Registers the [preview]...[/preview] wrapper handling and applies
 * preview decoration to both manual wrapped links and auto-detected
 * eligible links in cooked content.
 *
 * This includes a very narrow cooked-stage repair for malformed bare-URL
 * preview output of the form:
 *
 *   [preview]<a href="https://example.com/%5B/preview%5D">https://example.com/[/preview]</a>
 *
 * The repair is intentionally conservative and only runs when that exact
 * broken shape is detected.
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
  if (!(root instanceof Element)) return;

  root
    .querySelectorAll(
      "a[data-rich-preview-type], a.rich-preview-link, .rich-preview-wrap a[href]"
    )
    .forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) return;
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

function unwrapLeadingPreviewText(container) {
  if (!(container instanceof Element)) {
    return;
  }

  const firstNode = container.firstChild;

  if (firstNode?.nodeType !== Node.TEXT_NODE) {
    return;
  }

  const value = firstNode.nodeValue || "";
  if (!value.includes(OPEN_TAG)) {
    return;
  }

  const cleaned = value.replace(OPEN_TAG, "");
  if (cleaned) {
    firstNode.nodeValue = cleaned;
  } else {
    firstNode.remove();
  }
}

function removeTrailingPreviewTextNodes(container) {
  if (!(container instanceof Element)) {
    return;
  }

  for (const node of [...container.childNodes]) {
    if (node.nodeType !== Node.TEXT_NODE) {
      continue;
    }

    const value = node.nodeValue || "";
    if (!value.includes(CLOSE_TAG)) {
      continue;
    }

    const cleaned = value.replace(CLOSE_TAG, "");
    if (cleaned) {
      node.nodeValue = cleaned;
    } else {
      node.remove();
    }
  }
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

  unwrapLeadingPreviewText(container);
  removeTrailingPreviewTextNodes(container);

  const wrap = ensureWrapAroundAnchor(anchor);

  // Remove any stray literal preview tags still present in the container HTML.
  for (const node of [...container.childNodes]) {
    if (node === wrap) {
      continue;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.nodeValue || "";
      if (value.includes(OPEN_TAG) || value.includes(CLOSE_TAG)) {
        const cleaned = value.replaceAll(OPEN_TAG, "").replaceAll(CLOSE_TAG, "");
        if (cleaned) {
          node.nodeValue = cleaned;
        } else {
          node.remove();
        }
      }
    }
  }

  return !!wrap;
}

function repairBrokenBareUrlPreviews(root) {
  if (!(root instanceof Element)) {
    return;
  }

  root.querySelectorAll("p, li, td, div, blockquote").forEach((container) => {
    repairBrokenBareUrlPreview(container);
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
    repairBrokenBareUrlPreviews(root);
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