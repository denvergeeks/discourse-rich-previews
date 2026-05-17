function normalizeAttrValue(value) {
  return String(value ?? "").trim();
}

function getPreviewHref(attrs, content) {
  const explicitHref = normalizeAttrValue(attrs?.default);
  const fallbackHref = normalizeAttrValue(content);
  return explicitHref || fallbackHref;
}

function copyAttrs(token, attrs) {
  Object.entries(attrs).forEach(([name, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }

    token.attrSet(name, String(value));
  });
}

function buildFallbackTextToken(token, content) {
  token.type = "text";
  token.tag = "";
  token.nesting = 0;
  token.attrs = null;
  token.content = content;
  token.children = null;
}

function buildPreviewWrapperTokens(startToken, endToken, tagInfo, content) {
  const href = getPreviewHref(tagInfo?.attrs, content);

  if (!href) {
    buildFallbackTextToken(startToken, content);
    buildFallbackTextToken(endToken, "");
    return false;
  }

  startToken.type = "html_inline";
  startToken.tag = "";
  startToken.nesting = 0;
  startToken.attrs = null;
  startToken.content = `<span class="rich-preview-wrap" data-rich-preview="true" data-bbcode="true" data-preview-href="${href.replace(/"/g, "&quot;")}">`;

  endToken.type = "html_inline";
  endToken.tag = "";
  endToken.nesting = 0;
  endToken.attrs = null;
  endToken.content = "</span>";

  return false;
}

export function setup(helper) {
  if (!helper?.markdownIt) {
    return;
  }

  helper.allowList([
    "span.rich-preview-wrap",
    "span[data-rich-preview]",
    "span[data-bbcode]",
    "span[data-preview-href]",
  ]);

  helper.registerPlugin((md) => {
    md.inline.bbcode.ruler.push("preview", {
      tag: "preview",

      wrap(startToken, endToken, tagInfo, content) {
        return buildPreviewWrapperTokens(
          startToken,
          endToken,
          tagInfo,
          content
        );
      },
    });
  });
}