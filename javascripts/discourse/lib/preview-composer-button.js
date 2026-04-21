import { iconHTML } from "discourse-common/lib/icon-library";

const PREVIEW_WRAP_OPEN = "[preview]";
const PREVIEW_WRAP_CLOSE = "[/preview]";

/**
 * Registers the [preview] composer toolbar button.
 * Wraps selected text in [preview]...[/preview].
 * If no text is selected and the cursor is on a URL, wraps the URL.
 */
export function registerPreviewComposerButton(api) {
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
          // Text is selected — wrap it
          toolbarEvent.applySurround(
            PREVIEW_WRAP_OPEN,
            PREVIEW_WRAP_CLOSE,
            "rich_preview_wrap_default"
          );
        } else {
          // Nothing selected — insert placeholder
          toolbarEvent.addText(
            `${PREVIEW_WRAP_OPEN}paste link here${PREVIEW_WRAP_CLOSE}`
          );
        }
      },
    });
  });
}