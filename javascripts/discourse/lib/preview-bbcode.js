import { linkInSupportedArea } from "./rich-preview-utils";
import { matchPreviewTarget } from "./preview-router";
import {
  clearDecoratedLink,
  decorateAutoDetectedLink,
  decorateWrappedPreviewLink,
} from "./link-decorator";

const MANUAL_LINK_SELECTOR = 'a[data-rich-preview="true"][href]';

function clearAutoLinkIndicators(root) {
  if (!(root instanceof Element)) {
    return;
  }

  root
    .querySelectorAll("a[data-rich-preview-type], a.rich-preview-link, a[href]")
    .forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      clearDecoratedLink(link);
    });
}

function decorateManualPreviewLink(link, config) {
  if (!(link instanceof HTMLAnchorElement)) {
    return;
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

  decorateWrappedPreviewLink(null, link, target, config);
}

function stampAutoLinkIndicators(root, config) {
  if (!(root instanceof Element) || !config) {
    return;
  }

  clearAutoLinkIndicators(root);

  root.querySelectorAll(MANUAL_LINK_SELECTOR).forEach((link) => {
    decorateManualPreviewLink(link, config);
  });

  root.querySelectorAll("a[href]").forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    if (link.matches(MANUAL_LINK_SELECTOR)) {
      return;
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

export function applyPreviewWraps(root, _tagName = "preview", config = null) {
  if (!(root instanceof Element)) {
    return;
  }

  stampAutoLinkIndicators(root, config);
}

export function registerPreviewBBCode(api, config) {
  api.decorateCookedElement(
    (element) => applyPreviewWraps(element, "preview", config),
    {
      id: "rich-preview-bbcode-decorator",
      onlyStream: false,
    }
  );
}