import {
  logDebug,
  providerColor,
  renderProviderGlyph,
  sanitizeURL,
} from "./rich-preview-utils";

const DECORATED_ATTR = "data-rich-preview-onebox";
const MODE_AUTO_ONLY = "auto_only";
const MODE_COMPOSER_ONLY = "composer_only";
const MODE_AUTO_AND_COMPOSER = "auto_and_composer";

function oneboxModeEnabled(config) {
  const mode = String(config?.previewsOneboxMode || "disabled").trim();

  return (
    mode === MODE_AUTO_ONLY ||
    mode === MODE_COMPOSER_ONLY ||
    mode === MODE_AUTO_AND_COMPOSER
  );
}

function oneboxModeAllowsAuto(config) {
  const mode = String(config?.previewsOneboxMode || "disabled").trim();

  return mode === MODE_AUTO_ONLY || mode === MODE_AUTO_AND_COMPOSER;
}

function nearestLinkHref(oneboxEl) {
  const link =
    oneboxEl.querySelector("a[href]") ||
    oneboxEl.closest("a[href]") ||
    null;

  return link ? sanitizeURL(link.href || link.getAttribute("href")) : "";
}

function ensureBadge(oneboxEl, config) {
  const existing = oneboxEl.querySelector(".rich-preview-onebox__badge");

  if (existing) {
    return existing;
  }

  const badge = document.createElement("span");
  badge.className = "rich-preview-onebox__badge";

  const glyph = renderProviderGlyph("onebox", config);
  const label = String(
    config?.previewProviders?.onebox?.label || "Onebox"
  ).trim();

  badge.innerHTML = `
    <span class="rich-preview-onebox__badge-glyph" aria-hidden="true">
      ${glyph || ""}
    </span>
    <span class="rich-preview-onebox__badge-label">${label}</span>
  `;

  return badge;
}

function ensureRootClasses(oneboxEl) {
  oneboxEl.classList.add("rich-preview-onebox");
}

function ensureProviderColor(oneboxEl, config) {
  const color = providerColor("onebox", config, "var(--primary)");

  if (color) {
    oneboxEl.style.setProperty("--rich-preview-provider-color", color);
  }
}

function ensureHrefData(oneboxEl) {
  const href = nearestLinkHref(oneboxEl);

  if (href) {
    oneboxEl.dataset.richPreviewUrl = href;
  }
}

function decorateOnebox(oneboxEl, config) {
  if (!(oneboxEl instanceof Element)) {
    return;
  }

  if (oneboxEl.getAttribute(DECORATED_ATTR) === "true") {
    return;
  }

  ensureRootClasses(oneboxEl);
  ensureProviderColor(oneboxEl, config);
  ensureHrefData(oneboxEl);

  const article =
    oneboxEl.querySelector(".onebox-body") ||
    oneboxEl.querySelector(".aspect-image")?.parentElement ||
    oneboxEl;

  if (article && !article.querySelector(":scope > .rich-preview-onebox__badge")) {
    article.prepend(ensureBadge(oneboxEl, config));
  }

  oneboxEl.setAttribute(DECORATED_ATTR, "true");
}

function undecorateOnebox(oneboxEl) {
  if (!(oneboxEl instanceof Element)) {
    return;
  }

  oneboxEl.removeAttribute(DECORATED_ATTR);
  oneboxEl.classList.remove("rich-preview-onebox");
  oneboxEl.style.removeProperty("--rich-preview-provider-color");
  delete oneboxEl.dataset.richPreviewUrl;

  oneboxEl
    .querySelectorAll(".rich-preview-onebox__badge")
    .forEach((badge) => badge.remove());
}

export function applyOneboxMode(element, config) {
  if (!(element instanceof Element)) {
    return;
  }

  if (!config?.enabled || !oneboxModeEnabled(config)) {
    return;
  }

  if (!oneboxModeAllowsAuto(config)) {
    logDebug(
      config,
      "Skipping cooked onebox decoration because auto mode is disabled",
      {
        previewsOneboxMode: config?.previewsOneboxMode || "disabled",
      }
    );
    return;
  }

  const oneboxes = [
    ...(element.matches?.(".onebox") ? [element] : []),
    ...element.querySelectorAll?.(".onebox"),
  ];

  if (!oneboxes.length) {
    return;
  }

  oneboxes.forEach((oneboxEl) => decorateOnebox(oneboxEl, config));

  logDebug(config, "Decorated cooked oneboxes", {
    count: oneboxes.length,
    previewsOneboxMode: config?.previewsOneboxMode || "disabled",
  });

  return () => {
    oneboxes.forEach((oneboxEl) => undecorateOnebox(oneboxEl));
  };
}