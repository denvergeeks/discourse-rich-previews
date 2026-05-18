function isValidHttpUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function addAttr(token, name, value) {
  token.attrs ||= [];
  token.attrs.push([name, value]);
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
    md.inline.bbcode.ruler.push("preview", {
      tag: "preview",

      wrap(startToken, endToken, _tagInfo, content) {
        const inner = (content || "").trim();

        if (isValidHttpUrl(inner)) {
          startToken.type = "html_inline";
          startToken.tag = "";
          startToken.nesting = 0;
          startToken.content = "";

          endToken.type = "html_inline";
          endToken.tag = "";
          endToken.nesting = 0;
          endToken.content = "";

          const spanOpen = new startToken.constructor("span_open", "span", 1);
          addAttr(spanOpen, "class", "rich-preview-wrap");
          addAttr(spanOpen, "data-rich-preview", "true");

          const linkOpen = new startToken.constructor("link_open", "a", 1);
          addAttr(linkOpen, "href", inner);

          const text = new startToken.constructor("text", "", 0);
          text.content = inner;

          const linkClose = new startToken.constructor("link_close", "a", -1);
          const spanClose = new startToken.constructor("span_close", "span", -1);

          startToken.meta = {
            richPreviewReplacementTokens: [spanOpen, linkOpen, text],
          };

          endToken.meta = {
            richPreviewReplacementTokens: [linkClose, spanClose],
          };

          startToken.type = "rich_preview_open";
          endToken.type = "rich_preview_close";

          return false;
        }

        startToken.type = "span_open";
        startToken.tag = "span";
        startToken.nesting = 1;
        startToken.content = "";
        startToken.attrs = [
          ["class", "rich-preview-wrap"],
          ["data-rich-preview", "true"],
        ];

        endToken.type = "span_close";
        endToken.tag = "span";
        endToken.nesting = -1;
        endToken.content = "";

        return false;
      },
    });

    md.core.ruler.push("rich-preview-token-expander", (state) => {
      for (const blockToken of state.tokens) {
        if (!blockToken.children?.length) {
          continue;
        }

        const expanded = [];

        for (const token of blockToken.children) {
          if (
            token.type === "rich_preview_open" &&
            token.meta?.richPreviewReplacementTokens
          ) {
            expanded.push(...token.meta.richPreviewReplacementTokens);
            continue;
          }

          if (
            token.type === "rich_preview_close" &&
            token.meta?.richPreviewReplacementTokens
          ) {
            expanded.push(...token.meta.richPreviewReplacementTokens);
            continue;
          }

          expanded.push(token);
        }

        blockToken.children = expanded;
      }

      return false;
    });
  });
}