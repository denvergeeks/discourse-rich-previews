function normalizeAttrValue(value) {
  return String(value ?? "").trim();
}

function escapeHtmlAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function unescapeMarkdownLabel(value) {
  return String(value ?? "")
    .replace(/\\([\[\]\(\)])/g, "$1")
    .trim();
}

function parseMarkdownInlineLink(content) {
  const normalized = normalizeAttrValue(content);

  if (!normalized) {
    return null;
  }

  const match = normalized.match(
    /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/
  );

  if (!match) {
    return null;
  }

  return {
    text: unescapeMarkdownLabel(match[1]),
    href: normalizeAttrValue(match[2]),
  };
}

function extractPreviewParts(attrs, content) {
  const explicitHref = normalizeAttrValue(attrs?.default);
  const explicitTitle = normalizeAttrValue(attrs?.title);
  const normalizedContent = normalizeAttrValue(content);

  if (explicitHref) {
    return {
      href: explicitHref,
      text: normalizedContent || explicitHref,
      title: explicitTitle,
    };
  }

  const markdownLink = parseMarkdownInlineLink(normalizedContent);

  if (markdownLink) {
    return {
      href: markdownLink.href,
      text: markdownLink.text || markdownLink.href,
      title: explicitTitle,
    };
  }

  if (normalizedContent) {
    return {
      href: normalizedContent,
      text: normalizedContent,
      title: explicitTitle,
    };
  }

  return null;
}

function buildFallbackTextToken(token, content) {
  token.type = "text";
  token.tag = "";
  token.nesting = 0;
  token.attrs = null;
  token.content = content;
  token.children = null;
}

function buildWrapperOpenHTML(parts) {
  if (!parts?.href) {
    return "";
  }

  const attrs = [
    'class="rich-preview-wrap"',
    'data-rich-preview="true"',
    'data-bbcode="true"',
    `data-preview-href="${escapeHtmlAttribute(parts.href)}"`,
  ];

  if (parts.title) {
    attrs.push(`data-preview-title="${escapeHtmlAttribute(parts.title)}"`);
  }

  if (parts.text) {
    attrs.push(`data-preview-text="${escapeHtmlAttribute(parts.text)}"`);
  }

  return `<span ${attrs.join(" ")}>`;
}

function buildPreviewWrapperTokens(startToken, endToken, tagInfo, content) {
  const parts = extractPreviewParts(tagInfo?.attrs, content);
  const openHTML = buildWrapperOpenHTML(parts);

  if (!openHTML) {
    buildFallbackTextToken(startToken, content);
    buildFallbackTextToken(endToken, "");
    return false;
  }

  startToken.type = "html_inline";
  startToken.tag = "";
  startToken.nesting = 0;
  startToken.attrs = null;
  startToken.content = openHTML;
  startToken.children = null;

  endToken.type = "html_inline";
  endToken.tag = "";
  endToken.nesting = 0;
  endToken.attrs = null;
  endToken.content = "</span>";
  endToken.children = null;

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
    "span[data-preview-title]",
    "span[data-preview-text]",
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