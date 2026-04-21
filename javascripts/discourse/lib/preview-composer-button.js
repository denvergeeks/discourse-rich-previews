/**
 * Registers the composer toolbar button for wrapping links in the
 * configured preview BBCode tag. Opens a modal for the user to
 * input the URL, link text, and optional title attribute.
 */

import RichPreviewLinkModal from "../components/rich-preview-link-modal";

export function registerPreviewComposerButton(api, config) {
  const tagName = config?.previewsTagName || "preview";

  api.onToolbarCreate((toolbar) => {
    toolbar.addButton({
      id: "rich-preview-wrap",
      group: "insertions",
      icon: "eye",
      label: "rich_previews.composer_button.label",
      title: "rich_previews.composer_button.title",
      perform(toolbarEvent) {
        const selected = toolbarEvent.selected;
        const initialLinkText = selected?.value?.trim() || "";

        // Detect if selected text looks like a URL
        let initialUrl = "";
        let initialText = initialLinkText;

        try {
          new URL(initialLinkText);
          // Selected text is a URL — use it as the URL, clear link text
          initialUrl = initialLinkText;
          initialText = "";
        } catch {
          // Selected text is not a URL — use it as link text
        }

        api.container.lookup("service:modal").show(RichPreviewLinkModal, {
          model: {
            config,
            tagName,
            initialUrl,
            initialLinkText: initialText,
            onInsert(bbcode) {
              // Replace the current selection or insert at cursor
              if (selected?.value) {
                toolbarEvent.replaceText(selected.value, bbcode);
              } else {
                toolbarEvent.addText(bbcode);
              }
            },
          },
        });
      },
    });
  });
}