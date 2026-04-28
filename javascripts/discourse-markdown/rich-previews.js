function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createPreviewRule(tagName) {
  const openTag = `[${tagName}]`;
  const closeTag = `[/${tagName}]`;
  const pattern = new RegExp(
    `${escapeRegExp(openTag)}([\\s\\S]*?)${escapeRegExp(closeTag)}`,
    "gi"
  );

  return function previewBBCodeRule(state) {
    let changed = false;

    state.tokens.forEach((token) => {
      if (token.type !== "inline" || !token.content?.includes(openTag)) {
        return;
      }

      const replaced = token.content.replace(pattern, (_match, inner) => {
        changed = true;
        return `<span class="rich-preview-wrap" data-rich-preview="true">${inner}</span>`;
      });

      if (changed) {
        token.content = replaced;
      }
    });

    return false;
  };
}

export function setup(helper) {
  if (!helper.markdownIt) {
    return;
  }

  helper.allowList([
    "span.rich-preview-wrap",
    "span[data-rich-preview]",
  ]);

  helper.registerOptions((opts, siteSettings) => {
    opts.features ||= {};
    opts.features.rich_previews = siteSettings.rich_previews_enabled !== false;
    opts.richPreviewsTagName = siteSettings.rich_previews_tag_name || "preview";
  });

  helper.registerPlugin((md) => {
    md.core.ruler.push("rich-previews-bbcode", (state) => {
      const tagName = state.md.options.richPreviewsTagName || "preview";
      const rule = createPreviewRule(tagName);
      return rule(state);
    });
  });
}
