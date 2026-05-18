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

function setPreviewWrapperAttrs(token) {
  token.attrs ||= [];
  token.attrs.push(["class", "rich-preview-wrap"]);
  token.attrs.push(["data-rich-preview", "true"]);
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
      wrap(startToken, endToken, tagInfo, content) {
        const inner = (content || "").trim();

        // Bare URL case:
        // [preview]https://example.com/[/preview]
        //
        // Emit a real anchor directly so markdown-it does not have to guess
        // autolink boundaries around the closing BBCode marker.
        if (isValidHttpUrl(inner)) {
          startToken.type = "html_inline";
          startToken.tag = "";
          startToken.attrs = null;
          startToken.content =
            `<span class="rich-preview-wrap" data-rich-preview="true">` +
            `<a href="${inner}">`;

          endToken.type = "html_inline";
          endToken.tag = "";
          endToken.attrs = null;
          endToken.content = "</a></span>";
          return false;
        }

        // Default case:
        // [preview][Label](https://example.com)[/preview]
        //
        // Keep the inner markdown content intact and only wrap it.
        startToken.type = "span_open";
        startToken.tag = "span";
        startToken.nesting = 1;
        startToken.content = "";
        setPreviewWrapperAttrs(startToken);

        endToken.type = "span_close";
        endToken.tag = "span";
        endToken.nesting = -1;
        endToken.content = "";

        return false;
      },
    });
  });
}