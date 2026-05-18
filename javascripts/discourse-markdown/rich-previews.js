/**
 * discourse-markdown/rich-previews.js
 *
 * Implements [preview] as a proper inline BBCode rule.
 *
 * Supported forms:
 *
 * 1. Explicit default attr:
 *    [preview=https://example.com/]Label[/preview]
 *
 * 2. Markdown link inside preview:
 *    [preview][Label](https://example.com/)[/preview]
 *
 * 3. Bare URL fallback:
 *    [preview]https://example.com/[/preview]
 */

const ABSOLUTE_HTTP_URL_RE = /^https?:\/\/[^\s"'<>]+$/i;

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeUrl(value) {
  const trimmed = String(value ?? "").trim();
  return ABSOLUTE_HTTP_URL_RE.test(trimmed) ? trimmed : "";
}

function pushHtmlInline(state, content) {
  const token = state.push("html_inline", "", 0);
  token.content = content;
  return token;
}

function pushPreviewWrapOpen(state) {
  return pushHtmlInline(
    state,
    '<span class="rich-preview-wrap" data-rich-preview="true">'
  );
}

function pushPreviewWrapClose(state) {
  return pushHtmlInline(state, "</span>");
}

function pushAnchor(state, href, text) {
  const safeHref = escapeAttr(href);
  const safeText = escapeText(text);

  pushHtmlInline(state, `<a href="${safeHref}">${safeText}</a>`);
}

export function setup(helper) {
  if (!helper.markdownIt) {
    return;
  }

  helper.allowList([
    "span.rich-preview-wrap",
    "span[data-rich-preview]",
    "a[href]",
  ]);

  helper.registerPlugin((md) => {
    md.inline.bbcode.ruler.push("preview", {
      tag: "preview",

      replace(state, tagInfo, content) {
        const attrUrl = normalizeUrl(tagInfo.attrs?._default);
        const inner = String(content ?? "");
        const trimmedInner = inner.trim();

        pushPreviewWrapOpen(state);

        // Form 1:
        // [preview=https://example.com/]Label[/preview]
        if (attrUrl) {
          pushAnchor(state, attrUrl, trimmedInner || attrUrl);
          pushPreviewWrapClose(state);
          return true;
        }

        // Form 3:
        // [preview]https://example.com/[/preview]
        const bareUrl = normalizeUrl(trimmedInner);
        if (bareUrl) {
          pushAnchor(state, bareUrl, bareUrl);
          pushPreviewWrapClose(state);
          return true;
        }

        // Form 2:
        // [preview][Label](https://example.com/)[/preview]
        //
        // Re-parse the inner markdown inline so markdown-it can emit a normal
        // link token sequence inside our wrapper span.
        const innerTokens = [];
        state.md.inline.parse(inner, state.md, state.env, innerTokens);

        for (const token of innerTokens) {
          state.tokens.push(token);
        }

        pushPreviewWrapClose(state);
        return true;
      },
    });
  });
}