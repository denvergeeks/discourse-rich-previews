function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPreviewAnchor(url, label) {
  const safeUrl = String(url || "").trim();
  const safeLabel = String(label || "").trim() || safeUrl;

  if (!safeUrl) {
    return "";
  }

  return `<a href="${escapeHtml(safeUrl)}">${escapeHtml(safeLabel)}</a>`;
}

function wrapPreviewTags(source, tagName = "preview") {
  if (!source?.includes(`[${tagName}`)) {
    return source;
  }

  const pattern = new RegExp(
    `\\[${tagName}(?:=([^\\]]+))?\\]([\\s\\S]*?)\\[\\/${tagName}\\]`,
    "gi"
  );

  return source.replace(pattern, (_match, attrUrl, inner) => {
    const trimmedInner = String(inner || "").trim();
    const explicitUrl = String(attrUrl || "").trim();

    let content = trimmedInner;

    if (explicitUrl) {
      content = buildPreviewAnchor(explicitUrl, trimmedInner);
    } else if (/^https?:\/\/[^\s<>"']+$/i.test(trimmedInner)) {
      content = buildPreviewAnchor(trimmedInner, trimmedInner);
    }

    return `<span class="rich-preview-wrap" data-rich-preview="true">${content}</span>`;
  });
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