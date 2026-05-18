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

function classifyPreviewPayload(attrValue, inner) {
  const trimmedAttr = String(attrValue ?? "").trim();
  const trimmedInner = String(inner ?? "").trim();

  if (trimmedAttr) {
    return {
      form: "explicit",
      url: normalizeUrlCandidate(trimmedAttr),
      label: trimmedInner,
      markdown: "",
    };
  }

  if (!trimmedInner) {
    return {
      form: "empty",
      url: "",
      label: "",
      markdown: "",
    };
  }

  if (/^https?:\/\/\S+$/i.test(trimmedInner)) {
    return {
      form: "bare",
      url: normalizeUrlCandidate(trimmedInner),
      label: trimmedInner,
      markdown: "",
    };
  }

  return {
    form: "markdown",
    url: "",
    label: "",
    markdown: trimmedInner,
  };
}

function buildPlaceholderSpan(payload) {
  const attrs = [
    `class="rich-preview-wrap"`,
    `data-rich-preview="true"`,
    `data-preview-form="${escapeHtml(payload.form)}"`,
  ];

  if (payload.url) {
    attrs.push(`data-preview-url="${escapeHtml(payload.url)}"`);
  }

  if (payload.label) {
    attrs.push(`data-preview-label="${escapeHtml(payload.label)}"`);
  }

  if (payload.markdown) {
    attrs.push(`data-preview-markdown="${escapeHtml(payload.markdown)}"`);
    return `<span ${attrs.join(" ")}>${escapeHtml(payload.markdown)}</span>`;
  }

  if (payload.label) {
    return `<span ${attrs.join(" ")}>${escapeHtml(payload.label)}</span>`;
  }

  return `<span ${attrs.join(" ")}></span>`;
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
    return buildPlaceholderSpan(classifyPreviewPayload(attrValue, inner));
  });
}

export function setup(helper) {
  if (!helper.markdownIt) {
    return;
  }

  helper.allowList([
    "span.rich-preview-wrap",
    "span[data-rich-preview]",
    "span[data-preview-form]",
    "span[data-preview-url]",
    "span[data-preview-label]",
    "span[data-preview-markdown]",
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