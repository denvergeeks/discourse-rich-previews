function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeUrlCandidate(value) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return "";
}

function buildAnchorHTML(url, label) {
  const safeUrl = normalizeUrlCandidate(url);
  const safeLabel = String(label ?? "").trim();

  if (!safeUrl) {
    return safeLabel ? escapeHtml(safeLabel) : "";
  }

  return `<a href="${escapeHtml(safeUrl)}">${escapeHtml(
    safeLabel || safeUrl
  )}</a>`;
}

function transformPreviewInner(attrValue, inner) {
  const trimmedInner = String(inner ?? "").trim();
  const trimmedAttr = String(attrValue ?? "").trim();

  if (trimmedAttr) {
    return buildAnchorHTML(trimmedAttr, trimmedInner);
  }

  if (!trimmedInner) {
    return "";
  }

  if (/^https?:\/\/\S+$/i.test(trimmedInner)) {
    return buildAnchorHTML(trimmedInner, trimmedInner);
  }

  return trimmedInner;
}

function wrapPreviewTags(source, tagName = "preview") {
  if (!source?.toLowerCase().includes(`[${tagName}`)) {
    return source;
  }

  const pattern = new RegExp(
    `\\[${escapeRegExp(tagName)}(?:=([^\\]]+))?\\]([\\s\\S]*?)\\[\\/${escapeRegExp(
      tagName
    )}\\]`,
    "gi"
  );

  return source.replace(pattern, (_match, attrValue, inner) => {
    const renderedInner = transformPreviewInner(attrValue, inner);

    return `<span class="rich-preview-wrap" data-rich-preview="true">${renderedInner}</span>`;
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