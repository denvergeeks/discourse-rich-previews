/**
 * Registers the [preview]...[/preview] BBCode tag with Discourse's markdown-it
 * pipeline and decorates cooked elements so the theme component can
 * apply preview cards and visual indicators to wrapped links.
 */

import { classifyLink, linkInSupportedArea } from "./rich-preview-utils";
import { matchPreviewTarget } from "./preview-router";

/**
 * Builds a regex that matches [tagName]...[/tagName] case-insensitively.
 * A new regex instance is returned each time to avoid lastIndex state issues.
 */
function buildTagRegex(tagName) {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `\\[${escaped}\\]([\\s\\S]*?)\\[\\/${escaped}\\]`,
    "gi"
  );
}

/**
 * Builds the rendered HTML for a wrapped link.
 * The span gets data-rich-preview="true" so the theme component
 * can find it and apply preview cards regardless of page-level settings.
 */
function buildPreviewWrapHTML(inner) {
  return `<span class="rich-preview-wrap" data-rich-preview="true">${inner}</span>`;
}

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
  wrapEl.style.removeProperty("--rp-icon");
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
 * Stamps modifier classes onto a .rich-preview-wrap span based on:
 * - the type of link inside it (topic, external, wikipedia)
 * - the current config settings for icons and underlines
 *
 * IMPORTANT:
 * Manual [preview] wrappers should only be visually decorated when the link
 * would actually be active for rich preview behavior in the current context.
 * This keeps visual treatment aligned with hover/preview eligibility.
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
  if (!type) {
    return;
  }

  wrapEl.classList.add(`rich-preview-wrap--${type}`);

  if (config?.previewsShowUnderline) {
    if (config?.previewsUnderlineAlways) {
      wrapEl.classList.add("rich-preview-wrap--underline-always");
    } else {
      wrapEl.classList.add("rich-preview-wrap--underline-hover");
    }
  }

  if (config?.previewsShowIcon) {
    const position = config?.previewsIconPosition || "after";
    wrapEl.classList.add(`rich-preview-wrap--icon-${position}`);
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
 * Stamps data-rich-preview-type onto plain eligible <a> tags
 * so CSS can apply visual indicators to auto-detected links
 * the same way it does for manually wrapped links.
 *
 * IMPORTANT: only decorate links that are actually eligible in the current
 * context and settings. This must use the same gating as hover preview
 * behavior to avoid decorating links that will never show previews.
 */
function stampAutoLinkIndicators(root, config) {
  if (!root || !config) return;

  clearAutoLinkIndicators(root);

  if (!config.previewsShowIcon && !config.previewsShowUnderline) return;

  root.querySelectorAll("a[href]").forEach((link) => {
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
 * Scans a cooked element for literal [tagName]...[/tagName] text nodes
 * that were not processed by the markdown pipeline (e.g. posts cooked
 * before this tag was registered) and wraps them in the correct HTML.
 * Then stamps modifier classes on all .rich-preview-wrap spans found.
 */
export function applyPreviewWraps(root, tagName = "preview", config = null) {
  if (!(root instanceof Element)) return;

  const openTagLower = `[${tagName}]`.toLowerCase();
  const closeTagLower = `[/${tagName}]`.toLowerCase();

  const containers = root.querySelectorAll("p, li, td, div, blockquote");

  containers.forEach((container) => {
    let childNodes = Array.from(container.childNodes);

    let i = 0;
    while (i < childNodes.length) {
      const node = childNodes[i];

      if (node.nodeType !== Node.TEXT_NODE) {
        i++;
        continue;
      }

      const text = node.textContent;
      const lowerText = text.toLowerCase();

      const openIdx = lowerText.indexOf(openTagLower);
      if (openIdx === -1) {
        i++;
        continue;
      }

      const beforeText = text.slice(0, openIdx);
      const afterOpenText = text.slice(openIdx + openTagLower.length);
      const closeInSameNode = afterOpenText.toLowerCase().indexOf(closeTagLower);

      if (closeInSameNode !== -1) {
        const inner = afterOpenText.slice(0, closeInSameNode);
        const afterClose = afterOpenText.slice(
          closeInSameNode + closeTagLower.length
        );

        const wrapSpan = document.createElement("span");
        wrapSpan.className = "rich-preview-wrap";
        wrapSpan.setAttribute("data-rich-preview", "true");
        wrapSpan.textContent = inner;

        const fragment = document.createDocumentFragment();
        if (beforeText) fragment.appendChild(document.createTextNode(beforeText));
        fragment.appendChild(wrapSpan);
        if (afterClose) fragment.appendChild(document.createTextNode(afterClose));

        container.replaceChild(fragment, node);

        if (config) stampModifierClasses(wrapSpan, config);

        childNodes = Array.from(container.childNodes);
        i = childNodes.indexOf(wrapSpan) + 1;
        continue;
      }

      const wrapNodes = [];
      let closeNode = null;
      let closeNodeOffset = -1;
      let j = i + 1;

      let afterOpenNode = null;
      if (afterOpenText) {
        afterOpenNode = document.createTextNode(afterOpenText);
      }

      while (j < childNodes.length) {
        const candidate = childNodes[j];

        if (candidate.nodeType === Node.TEXT_NODE) {
          const candidateLower = candidate.textContent.toLowerCase();
          const closeIdx = candidateLower.indexOf(closeTagLower);

          if (closeIdx !== -1) {
            closeNode = candidate;
            closeNodeOffset = closeIdx;
            break;
          }
        }

        wrapNodes.push(candidate);
        j++;
      }

      if (!closeNode) {
        i++;
        continue;
      }

      const wrapSpan = document.createElement("span");
      wrapSpan.className = "rich-preview-wrap";
      wrapSpan.setAttribute("data-rich-preview", "true");

      if (afterOpenNode) {
        wrapSpan.appendChild(afterOpenNode);
      }

      wrapNodes.forEach((n) => wrapSpan.appendChild(n));

      const closeNodeText = closeNode.textContent;
      const textBeforeClose = closeNodeText.slice(0, closeNodeOffset);
      const textAfterClose = closeNodeText.slice(
        closeNodeOffset + closeTagLower.length
      );

      if (textBeforeClose) {
        wrapSpan.appendChild(document.createTextNode(textBeforeClose));
      }

      const fragment = document.createDocumentFragment();

      if (beforeText) {
        fragment.appendChild(document.createTextNode(beforeText));
      }

      fragment.appendChild(wrapSpan);

      if (textAfterClose) {
        fragment.appendChild(document.createTextNode(textAfterClose));
      }

      container.replaceChild(fragment, node);
      closeNode.remove();

      if (config) stampModifierClasses(wrapSpan, config);

      childNodes = Array.from(container.childNodes);
      i = childNodes.indexOf(wrapSpan) + 1;
    }
  });

  if (config) {
    root
      .querySelectorAll(".rich-preview-wrap[data-rich-preview='true']")
      .forEach((wrapEl) => stampModifierClasses(wrapEl, config));

    stampAutoLinkIndicators(root, config);
  }
}

/**
 * Called from the api initializer to decorate cook-time preview wrappers
 * after cooked HTML is rendered into the DOM.
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
