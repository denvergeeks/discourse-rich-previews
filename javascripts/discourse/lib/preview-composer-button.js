import { getOwner } from "@ember/owner";
import RichPreviewLinkModal from "../components/rich-preview-link-modal";

function safeTrim(value) {
  return String(value ?? "").trim();
}

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\/[^\s<>"']+$/i.test(safeTrim(value));
}

function parseMarkdownLink(selection) {
  const match = safeTrim(selection).match(
    /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+("[^"]*"))?\)$/
  );

  if (!match) {
    return null;
  }

  return {
    linkText: safeTrim(match[1]),
    url: safeTrim(match[2]),
    title: safeTrim(match[3]),
  };
}

function stripPreviewToken(value) {
  return safeTrim(value).replace(/\s+\{preview(?:=off)?\}\s*$/i, "");
}

function extractInitialValues(selectedValue) {
  const selected = stripPreviewToken(selectedValue);

  if (!selected) {
    return {
      initialUrl: "",
      initialLinkText: "",
      initialTitle: "",
      initialInsertionMode: "preview",
    };
  }

  const markdownLink = parseMarkdownLink(selected);
  if (markdownLink) {
    return {
      initialUrl: markdownLink.url,
      initialLinkText: markdownLink.linkText,
      initialTitle: markdownLink.title,
      initialInsertionMode: "markdown",
    };
  }

  if (isAbsoluteHttpUrl(selected)) {
    return {
      initialUrl: selected,
      initialLinkText: "",
      initialTitle: "",
      initialInsertionMode: "bare_url",
    };
  }

  return {
    initialUrl: "",
    initialLinkText: selected,
    initialTitle: "",
    initialInsertionMode: "preview",
  };
}

function ensureComposerTranslations() {
  try {
    // eslint-disable-next-line no-undef
    const I18n = require("I18n").default;
    const locale = I18n.currentLocale();
    const jsRoot = I18n.translations[locale]?.js;
    if (!jsRoot) {
      return;
    }
    jsRoot.composer_button ||= {};
    jsRoot.modal ||= {};
    jsRoot.composer_button.label ||= "Preview Link";
    jsRoot.composer_button.title ||= "Insert a Link";
    jsRoot.modal.insert ||= "Insert Link";
  } catch {
    // no-op
  }
}

export function registerPreviewComposerButton(api, config) {
  ensureComposerTranslations();

  api.onToolbarCreate((toolbar) => {
    toolbar.addButton({
      id: "rich-preview-wrap",
      group: config?.composerButtonGroup || "insertions",
      icon: "tooltip-icon",
      title: "composer_button.title",
      perform(toolbarEvent) {
        const selectedValue = toolbarEvent?.selected?.value || "";
        const {
          initialUrl,
          initialLinkText,
          initialTitle,
          initialInsertionMode,
        } = extractInitialValues(selectedValue);

        const modalService = api.container?.lookup?.("service:modal");
        // Use getOwner(toolbarEvent) rather than api.container, which is
        // deprecated in current Discourse and causes TypeError at getPrototypeOf.
        const owner =
          getOwner(toolbarEvent) ||
          getOwner(toolbar) ||
          api.container;

        if (!owner) {
          // eslint-disable-next-line no-console
          console.error(
            "[discourse-rich-previews] Could not resolve owner to show modal."
          );
          return;
        }

        const modalService = owner.lookup("service:modal");

        if (!modalService) {
          // eslint-disable-next-line no-console
          console.error(
            "[discourse-rich-previews] service:modal not available."
          );
          return;
        }

        modalService.show(RichPreviewLinkModal, {
          model: {
            config,
            initialUrl,
            initialLinkText,
            initialTitle,
            initialInsertionMode,
            onInsert(insertedText) {
              if (selectedValue) {
                toolbarEvent.replaceText(selectedValue, insertedText);
              } else {
                toolbarEvent.addText(insertedText);
              }
            },
          },
        });
      },
    });
  });
}
