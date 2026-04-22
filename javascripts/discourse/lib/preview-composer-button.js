/**
 * Registers the composer toolbar button for wrapping links in the
 * configured preview BBCode tag. Opens a modal for the user to
 * input the URL, link text, and optional title attribute.
 */

import I18n from "I18n";
import RichPreviewLinkModal from "../components/rich-preview-link-modal";

export function registerPreviewComposerButton(api, config) {
  const tagName = config?.previewsTagName || "preview";
//  const open = `[${tagName}]`;
//  const close = `[/${tagName}]`;

  // Discourse builds the toolbar tooltip key as composer.{id}_title
  // so we inject it directly into the global I18n namespace
  try {
    const locale = I18n.currentLocale();
    I18n.translations[locale] ??= {};
    I18n.translations[locale].js ??= {};
    I18n.translations[locale].js.composer ??= {};
    I18n.translations[locale].js.composer["rich-preview-wrap_title"] =
      "Rich preview link";
  } catch {
    // no-op if I18n is not available
  }

  api.onToolbarCreate((toolbar) => {
    toolbar.addButton({
      id: "rich-preview-wrap",
      group: config?.composerButtonGroup || "insertions",
      icon: "tooltip-icon",
      shortcut: "P",
      perform(toolbarEvent) {
        const selected = toolbarEvent.selected;
        const initialLinkText = selected?.value?.trim() || "";

        let initialUrl = "";
        let initialText = initialLinkText;

        try {
          new URL(initialLinkText);
          initialUrl = initialLinkText;
          initialText = "";
        } catch {
          // selected text is not a URL — use as link text
        }

        api.container.lookup("service:modal").show(RichPreviewLinkModal, {
          model: {
            config,
            tagName,
            initialUrl,
            initialLinkText: initialText,
            onInsert(bbcode) {
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