import I18n from "I18n";
import RichPreviewLinkModal from "../components/rich-preview-link-modal";

function safeTrim(value) {
  return String(value ?? "").trim();
}

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\/[^\s<>"']+$/i.test(safeTrim(value));
}

function parseMarkdownLink(selection) {
  const match = safeTrim(selection).match(
    /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+"([^"]*)")?\)$/i
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

function parsePreviewWrappedMarkdown(selection) {
  const explicitMatch = safeTrim(selection).match(
    /^\[preview=([^\]]+)\]([\s\S]*?)\[\/preview\]$/i
  );

  if (explicitMatch) {
    return {
      format: "explicit",
      url: safeTrim(explicitMatch[1]),
      linkText: safeTrim(explicitMatch[2]),
      title: "",
    };
  }

  const wrappedMatch = safeTrim(selection).match(/^\[preview\]([\s\S]*?)\[\/preview\]$/i);

  if (!wrappedMatch) {
    return null;
  }

  const inner = safeTrim(wrappedMatch[1]);
  const markdownLink = parseMarkdownLink(inner);

  if (markdownLink) {
    return {
      format: "markdown",
      url: markdownLink.url,
      linkText: markdownLink.linkText,
      title: markdownLink.title,
    };
  }

  if (isAbsoluteHttpUrl(inner)) {
    return {
      format: "bare",
      url: inner,
      linkText: "",
      title: "",
    };
  }

  return {
    format: "markdown",
    url: "",
    linkText: inner,
    title: "",
  };
}

function extractInitialValues(selectedValue) {
  const selected = safeTrim(selectedValue);

  if (!selected) {
    return {
      initialUrl: "",
      initialLinkText: "",
      initialTitle: "",
      initialFormat: "markdown",
    };
  }

  const wrappedPreview = parsePreviewWrappedMarkdown(selected);
  if (wrappedPreview) {
    return {
      initialUrl: wrappedPreview.url,
      initialLinkText: wrappedPreview.linkText,
      initialTitle: wrappedPreview.title,
      initialFormat: wrappedPreview.format,
    };
  }

  const markdownLink = parseMarkdownLink(selected);
  if (markdownLink) {
    return {
      initialUrl: markdownLink.url,
      initialLinkText: markdownLink.linkText,
      initialTitle: markdownLink.title,
      initialFormat: "markdown",
    };
  }

  if (isAbsoluteHttpUrl(selected)) {
    return {
      initialUrl: selected,
      initialLinkText: "",
      initialTitle: "",
      initialFormat: "bare",
    };
  }

  return {
    initialUrl: "",
    initialLinkText: selected,
    initialTitle: "",
    initialFormat: "markdown",
  };
}

function ensureComposerTranslations() {
  try {
    const locale = I18n.currentLocale();
    const jsRoot = I18n.translations[locale]?.js;

    if (!jsRoot) {
      return;
    }

    jsRoot.composer_button ||= {};
    jsRoot.modal ||= {};

    jsRoot.composer_button.label ||= "Preview Link";
    jsRoot.composer_button.title ||= "Insert a Rich Preview Link";
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
          initialFormat,
        } = extractInitialValues(selectedValue);

        api.container.lookup("service:modal").show(RichPreviewLinkModal, {
          model: {
            config,
            initialUrl,
            initialLinkText,
            initialTitle,
            initialFormat,

            onInsert(bbcode) {
              if (selectedValue) {
                toolbarEvent.replaceText(selectedValue, bbcode);
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