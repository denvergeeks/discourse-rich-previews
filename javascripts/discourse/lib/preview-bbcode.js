/**
 * Registers the [preview]...[/preview] BBCode tag (or whatever tag name
 * is configured via previews_tag_name) with Discourse's markdown-it
 * pipeline and decorates cooked elements so the theme component can
 * apply hover cards and visual indicators to wrapped links.
 */

import {
  classifyLink,
} from "./rich-preview-utils";

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
 * can find it and apply hover cards regardless of page-level settings.
 */
function buildPreviewWrapHTML(inner) {
  return `<span class="rich-preview-wrap" data-rich-preview="true">${inner}</span>`;
}

/**
 * Stamps modifier classes onto a .rich-preview-wrap span based on:
 * - the type of link inside it (topic, external, wikipedia)
 * - the current config settings for icons and underlines
 */
function stampModifierClasses(wrapEl, config) {
  if (!(wrapEl instanceof Element)) return;

  const link = wrapEl.querySelector("a[href]");
  const type = link ? classifyLink(link, config) : null;

  if (type) {
    wrapEl.classList.add(`rich-preview-wrap--${type}`);
  }

  if (config?.previewsShowUnderline) {
    if (config?.previewsUnderlineAlways) {
      wrapEl.classList.add("rich-preview-wrap--underline-always");
    } else {
      wrapEl.classList.add("rich-preview-wrap--underline-hover");
    }
  }

  if (config?.previewsShowIcon && type) {
    const position = config?.previewsIconPosition || "after";
    wrapEl.classList.add(`rich-preview-wrap--icon-${position}`);
  }

  if (type && link) {
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

    wrapEl.style.removeProperty("--rp-icon");
  }
}

/**
 * Stamps data-rich-preview-type onto plain eligible <a> tags
 * so CSS can apply visual indicators to auto-detected links
 * the same way it does for manually wrapped links.
 */
function stampAutoLinkIndicators(root, config) {
  if (!root || !config) return;
  if (!config.previewsShowIcon && !config.previewsShowUnderline) return;

  root.querySelectorAll("a[href]").forEach((link) => {
    if (link.closest(".rich-preview-wrap")) return;
    if (link.hasAttribute("data-rich-preview-type")) return;

    const type = classifyLink(link, config);
    if (!type || type === "unsupported") return;

    link.setAttribute("data-rich-preview-type", type);

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

      // Check if this text node contains [preview] anywhere inside it
      const openIdx = lowerText.indexOf(openTagLower);
      if (openIdx === -1) {
        i++;
        continue;
      }

      // Split this text node into: before-text + open-tag-text + after-text
      // Then look forward for the close tag

      // Text before the open tag
      const beforeText = text.slice(0, openIdx);
      // Text after the open tag on the same node
      const afterOpenText = text.slice(openIdx + openTagLower.length);

      // Now scan forward from the next sibling looking for [/preview]
      // The close tag could be:
      // 1. In the afterOpenText on the same node (whole tag in one text node)
      // 2. In a later sibling text node

      // First check if close tag is in the remainder of this same text node
      const closeInSameNode = afterOpenText.toLowerCase().indexOf(closeTagLower);

      if (closeInSameNode !== -1) {
        // Entire [preview]...[/preview] is within this one text node
        const inner = afterOpenText.slice(0, closeInSameNode);
        const afterClose = afterOpenText.slice(closeInSameNode + closeTagLower.length);

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

      // Close tag is in a later sibling — collect nodes until we find it
      const wrapNodes = [];
      let closeNode = null;
      let closeNodeOffset = -1;
      let j = i + 1;

      // Handle any remaining text after [preview] on the same node
      // by creating a temporary text node for it
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

      // Build the wrap span
      const wrapSpan = document.createElement("span");
      wrapSpan.className = "rich-preview-wrap";
      wrapSpan.setAttribute("data-rich-preview", "true");

      // Add the text after [preview] on the open-tag node (if any)
      if (afterOpenNode) {
        wrapSpan.appendChild(afterOpenNode);
      }

      // Add all collected sibling nodes
      wrapNodes.forEach((n) => wrapSpan.appendChild(n));

      // Handle text before and after [/preview] in the close node
      const closeNodeText = closeNode.textContent;
      const textBeforeClose = closeNodeText.slice(0, closeNodeOffset);
      const textAfterClose = closeNodeText.slice(
        closeNodeOffset + closeTagLower.length
      );

      if (textBeforeClose) {
        wrapSpan.appendChild(document.createTextNode(textBeforeClose));
      }

      // Build the replacement fragment
      const fragment = document.createDocumentFragment();

      if (beforeText) {
        fragment.appendChild(document.createTextNode(beforeText));
      }

      fragment.appendChild(wrapSpan);

      if (textAfterClose) {
        fragment.appendChild(document.createTextNode(textAfterClose));
      }

      // Replace the open-tag text node with the fragment
      container.replaceChild(fragment, node);

      // Remove the close tag text node
      closeNode.remove();

      if (config) stampModifierClasses(wrapSpan, config);

      childNodes = Array.from(container.childNodes);
      i = childNodes.indexOf(wrapSpan) + 1;
    }
  });

  // Stamp modifier classes on all .rich-preview-wrap spans
  if (config) {
    root
      .querySelectorAll(".rich-preview-wrap[data-rich-preview='true']")
      .forEach((wrapEl) => stampModifierClasses(wrapEl, config));

    // Stamp indicators on plain auto-detected links
    stampAutoLinkIndicators(root, config);
  }
}

/**
 * Called from the api initializer to wire up the BBCode tag.
 * Accepts config so the tag name and visual indicators are driven
 * by the component settings.
 */
export function registerPreviewBBCode(api, config) {
  const tagName = config?.previewsTagName || "preview";

  // 2. Decorate already-cooked elements (topic page, user profile,
  //    anywhere cooked HTML appears) so stored posts with the tag
  //    that were cooked before this component was installed still
  //    work, and so modifier classes are applied on every render.
  api.decorateCookedElement(
    (element) => {
      applyPreviewWraps(element, tagName, config);
    },
    {
      id: "rich-preview-bbcode-decorator",
      onlyStream: false,
    }
  );
}