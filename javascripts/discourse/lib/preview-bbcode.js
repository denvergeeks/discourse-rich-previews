function normalizeAttrValue(value) {
  return String(value ?? "").trim();
}

function getPreviewHref(attrs, content) {
  const explicitHref = normalizeAttrValue(attrs?.default);
  const fallbackHref = normalizeAttrValue(content);

  return explicitHref || fallbackHref;
}

function buildFallbackTextToken(token, content) {
  token.type = "text";
  token.tag = "";
  token.nesting = 0;
  token.attrs = null;
  token.content = content || "";
  token.children = null;
}

function copyAttrs(token, attrs) {
  Object.entries(attrs).forEach(([name, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }

    token.attrSet(name, String(value));
  });
}

function buildAnchorTokens(startToken, endToken, tagInfo, content) {
  const href = getPreviewHref(tagInfo?.attrs, content);

  if (!href) {
    buildFallbackTextToken(startToken, content);
    buildFallbackTextToken(endToken, "");
    return false;
  }

  startToken.type = "link_open";
  startToken.tag = "a";
  startToken.nesting = 1;
  startToken.content = "";
  startToken.attrs = null;
  startToken.children = null;

  copyAttrs(startToken, {
    href,
    "data-bbcode": "true",
  });

  const title = normalizeAttrValue(tagInfo?.attrs?.title);
  if (title) {
    startToken.attrSet("title", title);
  }

  endToken.type = "link_close";
  endToken.tag = "a";
  endToken.nesting = -1;
  endToken.attrs = null;
  endToken.content = "";
  endToken.children = null;

  return false;
}

export function registerPreviewBBCode(api) {
  api.registerMarkdownItPlugin((md) => {
    md.inline.bbcode.ruler.push("preview", {
      tag: "preview",

      wrap(startToken, endToken, tagInfo, content) {
        return buildAnchorTokens(startToken, endToken, tagInfo, content);
      },
    });
  });
}