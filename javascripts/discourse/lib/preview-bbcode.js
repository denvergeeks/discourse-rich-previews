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

  // Detect link type from the first <a> inside the wrap
  const link = wrapEl.querySelector("a[href]");
  const type = link ? classifyLink(link, config) : null;

  // Type modifier
  if (type) {
    wrapEl.classList.add(`rich-preview-wrap--${type}`);
  }

  // Underline modifiers
  if (config?.previewsShowUnderline) {
    if (config?.previewsUnderlineAlways) {
      wrapEl.classList.add("rich-preview-wrap--underline-always");
    } else {
      wrapEl.classList.add("rich-preview-wrap--underline-hover");
    }
  }

  // Icon modifiers
  if (config?.previewsShowIcon && type) {
    const position = config?.previewsIconPosition || "after";
    wrapEl.classList.add(`rich-preview-wrap--icon-${position}`);
  }

  // Apply per-type custom colors from settings as inline CSS variables
  // so admins can override the defaults without touching SCSS
  if (type && link) {
    const colorMap = {
      topic: config?.previewsColorTopic,
      external: config?.previewsColorRemote,
      wikipedia: config?.previewsColorWikipedia,
    };

    const color = colorMap[type];
    if (color) {
      wrapEl.style.setProperty("--rp-color", color);
    }
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
    // Skip links already inside a rich-preview-wrap
    if (link.closest(".rich-preview-wrap")) return;

    // Skip links that already have the attribute stamped
    if (link.hasAttribute("data-rich-preview-type")) return;

    const type = classifyLink(link, config);
    if (!type || type === "unsupported") return;

    link.setAttribute("data-rich-preview-type", type);

    // Apply color as inline CSS variable so admin settings work
    const colorMap = {
      topic: config.previewsColorTopic,
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
    const childNodes = Array.from(container.childNodes);

    let i = 0;
    while (i < childNodes.length) {
      const node = childNodes[i];

      const isOpenTag =
        node.nodeType === Node.TEXT_NODE &&
        node.textContent.trim().toLowerCase() === openTagLower;

      if (isOpenTag) {

        const wrapNodes = [];
        let closeNode = null;
        let j = i + 1;

        while (j < childNodes.length) {
          const candidate = childNodes[j];
          const isCloseTag =
            candidate.nodeType === Node.TEXT_NODE &&
            candidate.textContent.trim().toLowerCase() === closeTagLower;

          if (isCloseTag) {
            closeNode = candidate;
            break;
          }

          wrapNodes.push(candidate);
          j++;
        }

        if (closeNode && wrapNodes.length > 0) {

          const wrapSpan = document.createElement("span");
          wrapSpan.className = "rich-preview-wrap";
          wrapSpan.setAttribute("data-rich-preview", "true");

          wrapNodes.forEach((n) => wrapSpan.appendChild(n));
          container.replaceChild(wrapSpan, node);
          closeNode.remove();

          if (config) {
            stampModifierClasses(wrapSpan, config);
          }

          // Final pass: stamp modifier classes on all wrap spans
          if (config) {
            root
              .querySelectorAll(".rich-preview-wrap[data-rich-preview='true']")
              .forEach((wrapEl) => stampModifierClasses(wrapEl, config));

            // Also stamp auto-detected plain links
            stampAutoLinkIndicators(root, config);
          }

          const updated = Array.from(container.childNodes);
          i = updated.indexOf(wrapSpan) + 1;
          continue;
        }
      }

      i++;
    }
  });
}

/**
 * Called from the api initializer to wire up the BBCode tag.
 * Accepts config so the tag name and visual indicators are driven
 * by the component settings.
 */
export function registerPreviewBBCode(api, config) {
  const tagName = config?.previewsTagName || "preview";

  // 1. Register with the markdown-it BBCode plugin so the tag
  //    is processed server-side during cooking and client-side
  //    in the composer preview.
  if (api.registerBBCodePreview) {
    api.registerBBCodePreview(tagName, {
      replace(state, tagInfo, content) {
        const token = state.push("html_inline", "", 0);
        token.content = buildPreviewWrapHTML(content);
        return true;
      },
    });
  }

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