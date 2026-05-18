function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function isLikelyUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(String(value).trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function buildWrappedPreviewInner(attrValue, inner) {
  const trimmedInner = String(inner || "").trim();
  const trimmedAttr = String(attrValue || "").trim();

  if (trimmedAttr) {
    const visibleText = trimmedInner || trimmedAttr;

    return `<a href="${escapeAttribute(trimmedAttr)}">${escapeHtml(
      visibleText
    )}</a>`;
  }

  if (isLikelyUrl(trimmedInner)) {
    return `<a href="${escapeAttribute(trimmedInner)}">${escapeHtml(
      trimmedInner
    )}</a>`;
  }

  return inner;
}

function wrapPreviewTags(source, tagName = "preview") {
  if (!source?.includes(`[${tagName}`)) {
    return source;
  }

  const pattern = new RegExp(
    `\\[${tagName}(?:=([^\\]]+))?\\]([\\s\\S]*?)\\[\\/${tagName}\\]`,
    "gi"
  );

  return source.replace(pattern, (_match, attrValue, inner) => {
    const wrappedInner = buildWrappedPreviewInner(attrValue, inner);

    return `<span class="rich-preview-wrap" data-rich-preview="true">${wrappedInner}</span>`;
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