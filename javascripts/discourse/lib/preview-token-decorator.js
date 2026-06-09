import { linkInSupportedArea } from "./rich-preview-utils";
import { matchPreviewTarget } from "./preview-router";
import { decorateAutoDetectedLink, clearDecoratedLink } from "./link-decorator";

const PREVIEW_TOKEN_REGEX = /\s+\{preview(?:=(off))?\}\s*$/i;

function clearAutoLinkIndicators(root) {
  if (!(root instanceof Element)) {
    return;
  }

  root
    .querySelectorAll("a[data-rich-preview-type], a.rich-preview-link")
    .forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      clearDecoratedLink(link);
      delete link.dataset.previewPreference;
    });
}

function extractAfterLinkPreference(nextSibling) {
  if (nextSibling?.nodeType !== Node.TEXT_NODE) {
    return null;
  }

  const value = nextSibling.nodeValue || "";
  const match = value.match(PREVIEW_TOKEN_REGEX);

  if (!match) {
    return null;
  }

  const preference = match[1] ? "off" : "force";
  const cleaned = value.replace(PREVIEW_TOKEN_REGEX, "");

  if (cleaned) {
    nextSibling.nodeValue = cleaned;
  } else {
    nextSibling.remove();
  }

  return preference;
}

function detectPreviewPreference(link) {
  if (!(link instanceof HTMLAnchorElement)) {
    return null;
  }

  return extractAfterLinkPreference(link.nextSibling);
}

function stampAutoLinkIndicators(root, config) {
  if (!(root instanceof Element) || !config) {
    return;
  }

  clearAutoLinkIndicators(root);

  root.querySelectorAll("a[href]").forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    const preference = detectPreviewPreference(link);

    if (preference) {
      link.dataset.previewPreference = preference;
    } else {
      delete link.dataset.previewPreference;
    }

    if (!linkInSupportedArea(link, config)) {
      clearDecoratedLink(link);
      return;
    }

    const target = matchPreviewTarget(link, config);

    if (!target) {
      clearDecoratedLink(link);
      return;
    }

    decorateAutoDetectedLink(link, target, config);
  });
}

export function registerPreviewTokenDecorator(api, config) {
  api.decorateCookedElement(
    (element) => {
      stampAutoLinkIndicators(element, config);
    },
    { id: "discourse-rich-previews-token-decorator" }
  );
}