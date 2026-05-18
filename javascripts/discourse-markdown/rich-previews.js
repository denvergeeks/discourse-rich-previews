function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wrapPreviewTags(source, tagName = "preview") {
  const openTag = `[${tagName}]`;
  const closeTag = `[/${tagName}]`;

  if (!source?.includes(openTag)) {
    return source;
  }

  const pattern = new RegExp(
    `${escapeRegExp(openTag)}([\\s\\S]*?)${escapeRegExp(closeTag)}`,
    "gi"
  );

  return source.replace(pattern, (_match, inner) => {
    return `<span class="rich-preview-wrap" data-rich-preview="true">${inner}</span>`;
  });
}

function rewriteTextTokenContent(token) {
  if (!token || token.type !== "text" || !token.content) {
    return;
  }

  token.content = wrapPreviewTags(token.content, "preview");
}

function rewriteInlineChildren(token) {
  if (!token || token.type !== "inline" || !Array.isArray(token.children)) {
    return;
  }

  token.children.forEach((child) => rewriteTextTokenContent(child));
}

export function setup(helper) {
  if (!helper.markdownIt) {
    return;
  }

  helper.allowList([
    "span.rich-preview-wrap",
    "span[data-rich-preview]",
  ]);

  helper.registerPlugin((md) => {
    md.core.ruler.push("rich-previews-bbcode", (state) => {
      state.tokens.forEach((token) => {
        rewriteInlineChildren(token);
      });
    });
  });
}
