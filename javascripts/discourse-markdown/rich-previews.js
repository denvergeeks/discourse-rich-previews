function normalizeAttrValue(value) {
  return String(value ?? "").trim();
}

function getPreviewHref(attrs, content) {
  const explicitHref = normalizeAttrValue(attrs?._default);
  const fallbackHref = normalizeAttrValue(content);

  return explicitHref || fallbackHref;
}

function copyAttrs(token, attrs = {}) {
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
    startToken.type = "text";
    startToken.tag = "";
    startToken.nesting = 0;
    startToken.content = "";

    endToken.type = "text";
    endToken.tag = "";
    endToken.nesting = 0;
    endToken.content = "";

    return false;
  }

  startToken.type = "link_open";
  startToken.tag = "a";
  startToken.nesting = 1;
  startToken.content = "";
  startToken.attrs = [];

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
  endToken.content = "";

  return false;
}

export function setup(helper) {
  if (!helper?.markdownIt) {
    return;
  }

  helper.registerPlugin((md) => {
    md.inline.bbcode.ruler.push("preview", {
      tag: "preview",

      wrap(startToken, endToken, tagInfo, content) {
        return buildAnchorTokens(startToken, endToken, tagInfo, content);
      },
    });
  });
}