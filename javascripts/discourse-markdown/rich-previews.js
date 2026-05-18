console.log("[rich-previews canary] module evaluated");

export function setup(helper) {
  console.log("[rich-previews canary] setup called", {
    helper,
    markdownIt: helper?.markdownIt,
  });

  if (!helper?.markdownIt) {
    console.log("[rich-previews canary] helper.markdownIt missing, aborting");
    return;
  }

  helper.allowList([
    "span.rich-preview-wrap",
    "span[data-canary]",
    "span[data-bbcode]",
  ]);

  console.log("[rich-previews canary] allowList applied");

  helper.registerPlugin((md) => {
    console.log("[rich-previews canary] registerPlugin called", {
      md,
      hasInline: !!md?.inline,
      hasBbcode: !!md?.inline?.bbcode,
      hasRuler: !!md?.inline?.bbcode?.ruler,
    });

    if (!md?.inline?.bbcode?.ruler) {
      console.log("[rich-previews canary] bbcode ruler missing");
      return;
    }

    md.inline.bbcode.ruler.push("preview", {
      tag: "preview",

      wrap(startToken, endToken, tagInfo, content) {
        console.log("[rich-previews canary] wrap fired", {
          tagInfo,
          content,
          startToken,
          endToken,
        });

        startToken.type = "html_inline";
        startToken.tag = "";
        startToken.nesting = 0;
        startToken.attrs = null;
        startToken.content =
          '<span class="rich-preview-wrap" data-canary="true" data-bbcode="true">';
        startToken.children = null;

        endToken.type = "html_inline";
        endToken.tag = "";
        endToken.nesting = 0;
        endToken.attrs = null;
        endToken.content = "</span>";
        endToken.children = null;

        return false;
      },
    });

    console.log("[rich-previews canary] preview rule registered");
  });
}