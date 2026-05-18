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

  console.log("[rich-previews] parseMarkdownInlineLink input", {
    content,
    normalized,
  });

  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);

  if (!match) {
    console.log("[rich-previews] parseMarkdownInlineLink no match");
    return null;
  }

  const parsed = {
    text: unescapeMarkdownLabel(match[1]),
    href: normalizeAttrValue(match[2]),
  };

  console.log("[rich-previews] parseMarkdownInlineLink matched", parsed);

  return parsed;
}

function extractPreviewParts(attrs, content) {
  const explicitHref = normalizeAttrValue(attrs?.default);
  const explicitTitle = normalizeAttrValue(attrs?.title);
  const normalizedContent = normalizeAttrValue(content);

  console.log("[rich-previews] extractPreviewParts input", {
    attrs,
    content,
    explicitHref,
    explicitTitle,
    normalizedContent,
  });

  if (explicitHref) {
    const parts = {
      href: explicitHref,
      text: normalizedContent || explicitHref,
      title: explicitTitle,
    };

    console.log("[rich-previews] extractPreviewParts explicit href", parts);
    return parts;
  }

  const markdownLink = parseMarkdownInlineLink(normalizedContent);

  if (markdownLink) {
    const parts = {
      href: markdownLink.href,
      text: markdownLink.text || markdownLink.href,
      title: explicitTitle,
    };

    console.log("[rich-previews] extractPreviewParts markdown link", parts);
    return parts;
  }

  if (normalizedContent) {
    const parts = {
      href: normalizedContent,
      text: normalizedContent,
      title: explicitTitle,
    };

    console.log("[rich-previews] extractPreviewParts bare url fallback", parts);
    return parts;
  }

  console.log("[rich-previews] extractPreviewParts no usable parts");
  return null;
}

function buildFallbackTextToken(token, content) {
  console.log("[rich-previews] buildFallbackTextToken", {
    token,
    content,
  });

  token.type = "text";
  token.tag = "";
  token.nesting = 0;
  token.attrs = null;
  token.content = content;
  token.children = null;
}

function buildWrapperOpenHTML(parts) {
  console.log("[rich-previews] buildWrapperOpenHTML input", parts);

  if (!parts?.href) {
    console.log("[rich-previews] buildWrapperOpenHTML missing href");
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

  const html = `<span ${attrs.join(" ")}>`;
  console.log("[rich-previews] buildWrapperOpenHTML output", html);

  return html;
}

function buildPreviewWrapperTokens(startToken, endToken, tagInfo, content) {
  console.log("[rich-previews] buildPreviewWrapperTokens start", {
    tagInfo,
    content,
    startToken,
    endToken,
  });

  const parts = extractPreviewParts(tagInfo?.attrs, content);
  const openHTML = buildWrapperOpenHTML(parts);

  if (!openHTML) {
    console.log("[rich-previews] buildPreviewWrapperTokens fallback path");
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

  console.log("[rich-previews] buildPreviewWrapperTokens success", {
    startToken,
    endToken,
  });

  return false;
}

export function setup(helper) {
  console.log("[rich-previews] setup called", {
    helper,
    markdownIt: helper?.markdownIt,
  });

  if (!helper?.markdownIt) {
    console.log("[rich-previews] helper.markdownIt missing, aborting");
    return;
  }

  const allowList = [
    "span.rich-preview-wrap",
    "span[data-rich-preview]",
    "span[data-bbcode]",
    "span[data-preview-href]",
    "span[data-preview-title]",
    "span[data-preview-text]",
  ];

  console.log("[rich-previews] applying allowList", allowList);
  helper.allowList(allowList);

  helper.registerPlugin((md) => {
    console.log("[rich-previews] registerPlugin called", {
      md,
      hasInline: !!md?.inline,
      hasBbcode: !!md?.inline?.bbcode,
      bbcodeRuler: md?.inline?.bbcode?.ruler,
    });

    if (!md?.inline?.bbcode?.ruler) {
      console.log("[rich-previews] md.inline.bbcode.ruler missing");
      return;
    }

    md.inline.bbcode.ruler.push("preview", {
      tag: "preview",

      wrap(startToken, endToken, tagInfo, content) {
        console.log("[rich-previews] preview wrap fired", {
          tagInfo,
          content,
          startToken,
          endToken,
        });

        return buildPreviewWrapperTokens(
          startToken,
          endToken,
          tagInfo,
          content
        );
      },
    });

    console.log("[rich-previews] preview rule registered");
  });
}