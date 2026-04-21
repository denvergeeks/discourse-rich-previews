/**
 * Registers the [preview]...[/preview] BBCode tag with Discourse's
 * markdown-it pipeline and decorates cooked elements so the theme
 * component can apply hover cards and visual indicators to wrapped links.
 */

const PREVIEW_TAG_RE = /\[preview\]([\s\S]*?)\[\/preview\]/gi;

/**
 * Called from the api initializer to wire up the BBCode tag.
 */
export function registerPreviewBBCode(api) {
  // 1. Register with the markdown-it BBCode plugin so the tag
  //    is processed server-side during cooking and client-side
  //    in the composer preview.
  if (api.registerBBCodePreview) {
    api.registerBBCodePreview("preview", {
      replace(state, tagInfo, content) {
        const token = state.push("html_inline", "", 0);
        token.content = buildPreviewWrapHTML(content);
        return true;
      },
    });
  }

  // 2. Decorate already-cooked elements (topic page, user profile,
  //    anywhere cooked HTML appears) so stored posts with [preview]
  //    tags that were cooked before this plugin existed still work.
  api.decorateCookedElement(
    (element) => {
      applyPreviewWraps(element);
    },
    {
      id: "rich-preview-bbcode-decorator",
      onlyStream: false,
    }
  );
}

/**
 * Scans a cooked element for literal [preview]...[/preview] text
 * that was not processed by the markdown pipeline (e.g. posts cooked
 * before the tag was registered) and wraps them in the correct HTML.
 */
export function applyPreviewWraps(root) {
  if (!(root instanceof Element)) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const toReplace = [];

  let node;
  while ((node = walker.nextNode())) {
    if (PREVIEW_TAG_RE.test(node.textContent)) {
      toReplace.push(node);
      PREVIEW_TAG_RE.lastIndex = 0;
    }
  }

  for (const textNode of toReplace) {
    const html = textNode.textContent.replace(
      PREVIEW_TAG_RE,
      (_, inner) => buildPreviewWrapHTML(inner)
    );
    PREVIEW_TAG_RE.lastIndex = 0;

    const temp = document.createElement("span");
    temp.innerHTML = html;
    textNode.replaceWith(...temp.childNodes);
  }
}

/**
 * Builds the rendered HTML for a [preview] wrapped link.
 * The span gets data-rich-preview="true" so the theme component
 * can find it and apply hover cards regardless of page-level settings.
 */
function buildPreviewWrapHTML(inner) {
  return `<span class="rich-preview-wrap" data-rich-preview="true">${inner}</span>`;
}