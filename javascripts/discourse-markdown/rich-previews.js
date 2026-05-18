/**
 * discourse-markdown/rich-previews.js
 *
 * Markdown-It plugin that pre-processes [preview] BBCode tags before
 * markdown-it's standard inline rendering runs.
 *
 * Supported forms:
 *
 *   Form 1 — explicit default-attr URL:
 *     [preview=https://example.com/]Link text[/preview]
 *     → <span class="rich-preview-wrap" data-rich-preview="true">
 *          <a href="https://example.com/">Link text</a></span>
 *
 *   Form 2 — composer-style markdown link inside tag (handled naturally):
 *     [preview][Link text](https://example.com/)[/preview]
 *     → markdown-it renders the inner [...](...) as a normal <a> first;
 *        this plugin then wraps it in the span unchanged.
 *
 *   Form 3 — bare URL fallback:
 *     [preview]https://example.com/[/preview]
 *     → <span class="rich-preview-wrap" data-rich-preview="true">
 *          <a href="https://example.com/">https://example.com/</a></span>
 *
 * In all forms the link inside the span is what link-decorator picks up
 * via matchPreviewTarget to show the hover card.
 */

// Matches an absolute URL (http/https) with no surrounding whitespace.
const BARE_URL_RE = /^https?:\/\/[^\s"'<>]+$/i;

// Matches [preview=URL]...[/preview]
const EXPLICIT_ATTR_RE =
  /^https?:\/\/[^\]\s"'<>]+$/i;

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Transform a single [preview...] … [/preview] match.
 *
 * @param {string|undefined} attr  – URL from [preview=URL], or undefined
 * @param {string}           inner – raw inner content
 * @returns {string}               – HTML fragment
 */
function buildWrapHTML(attr, inner) {
  const trimmed = inner.trim();

  // Form 1: explicit attr URL
  if (attr && EXPLICIT_ATTR_RE.test(attr.trim())) {
    const safeHref = escapeAttr(attr.trim());
    // Use inner text as label; fall back to URL if inner is empty
    const label = trimmed || attr.trim();
    return (
      `<span class="rich-preview-wrap" data-rich-preview="true">` +
      `<a href="${safeHref}">${escapeText(label)}</a>` +
      `</span>`
    );
  }

  // Form 3: bare URL inside tag (no attr, inner is a raw URL)
  if (!attr && BARE_URL_RE.test(trimmed)) {
    const safeHref = escapeAttr(trimmed);
    return (
      `<span class="rich-preview-wrap" data-rich-preview="true">` +
      `<a href="${safeHref}">${escapeText(trimmed)}</a>` +
      `</span>`
    );
  }

  // Form 2 (and any other content): pass inner through unchanged so
  // markdown-it can render [text](url) links and other inline markup.
  return (
    `<span class="rich-preview-wrap" data-rich-preview="true">` +
    inner +
    `</span>`
  );
}

/**
 * Replace all [preview] / [preview=URL] … [/preview] occurrences in a
 * raw token content string.
 */
function wrapPreviewTags(source, tagName = "preview") {
  if (!source) {
    return source;
  }

  const escapedTag = escapeRegExp(tagName);

  // Matches:
  //   [preview]...[/preview]              – no attr (forms 2 & 3)
  //   [preview=somevalue]...[/preview]    – with attr (form 1)
  const pattern = new RegExp(
    `\\[${escapedTag}(?:=([^\\]]+))?\\]([\\s\\S]*?)\\[\\/${escapedTag}\\]`,
    "gi"
  );

  return source.replace(pattern, (_match, attr, inner) => {
    return buildWrapHTML(attr, inner);
  });
}

export function setup(helper) {
  if (!helper.markdownIt) {
    return;
  }

  helper.allowList([
    "span.rich-preview-wrap",
    "span[data-rich-preview]",
    // Allow the <a> elements emitted for forms 1 and 3
    "a[href]",
  ]);

  helper.registerPlugin((md) => {
    md.core.ruler.push("rich-previews-bbcode", (state) => {
      state.tokens.forEach((token) => {
        if (token.type !== "inline" || !token.content) {
          return;
        }

        token.content = wrapPreviewTags(token.content, "preview");
      });

      return false;
    });
  });
}
