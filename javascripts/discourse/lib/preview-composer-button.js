/**
 * Registers the composer toolbar button for wrapping links in the
 * configured preview BBCode tag. The tag name is driven by the
 * previews_tag_name setting so it stays in sync with preview-bbcode.js.
 */

/**
 * Called from the api initializer to add the composer toolbar button.
 * Accepts config so the tag name and behavior match the current settings.
 */
export function registerPreviewComposerButton(api, config) {
  const tagName = config?.previewsTagName || "preview";
  const open = `[${tagName}]`;
  const close = `[/${tagName}]`;

  api.onToolbarCreate((toolbar) => {
    toolbar.addButton({
      id: "rich-preview-wrap",
      group: "insertions",
      icon: "eye",
      label: "rich_previews.composer_button.label",
      title: "rich_previews.composer_button.title",
      perform(toolbarEvent) {
        const selected = toolbarEvent.selected;

        if (selected?.value) {
          // Text is selected — wrap it in the configured tag
          toolbarEvent.applySurround(
            open,
            close,
            "rich_preview_wrap_default"
          );
        } else {
          // Nothing selected — insert a Markdown link placeholder
          toolbarEvent.addText(`${open}[link text](paste URL here)${close}`);
        }
      },
    });
  });
}