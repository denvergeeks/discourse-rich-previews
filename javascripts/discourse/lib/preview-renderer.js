import { escapeHTML, sanitizeURL } from "./hover-preview-utils";

export function buildPreviewHTML(preview, categories, config, isMobile = false) {
  if (!preview) {
    return buildErrorPreviewHTML("No preview available.");
  }

  switch (preview.type) {
    case "wikipedia":
      return buildWikipediaPreviewHTML(preview, config, isMobile);
    case "topic":
      return buildTopicFallbackHTML(preview, config, isMobile);
    default:
      return buildErrorPreviewHTML("Unsupported preview type.");
  }
}

function pick(config, desktopKey, mobileKey, isMobile) {
  return isMobile ? config?.[mobileKey] : config?.[desktopKey];
}

function buildSharedThumbnailHTML(imageUrl, config, isMobile) {
  if (!imageUrl) {
    return "";
  }

  const showThumbnail = pick(
    config,
    "showThumbnailDesktop",
    "showThumbnailMobile",
    isMobile
  );

  if (!showThumbnail) {
    return "";
  }

  const topBottomHeight = pick(
    config,
    "thumbnailHeightTopBottomDesktop",
    "thumbnailHeightTopBottomMobile",
    isMobile
  );

  const isAutoFit =
    pick(
      config,
      "thumbnailSizeModeDesktop",
      "thumbnailSizeModeMobile",
      isMobile
    ) === "auto_fit_height";

  return `
    <div class="topic-hover-card__thumb-wrap">
      <img
        class="topic-hover-card__thumb${isAutoFit ? " topic-hover-card__thumb--auto-fit" : ""}"
        src="${escapeHTML(imageUrl)}"
        alt=""
        loading="lazy"
        decoding="async"
        style="--thc-thumb-top-bottom-height:${escapeHTML(topBottomHeight || "auto")};"
      />
    </div>
  `;
}

function buildWikipediaPreviewHTML(preview, config, isMobile) {
  const placement = pick(
    config,
    "thumbnailPlacementDesktop",
    "thumbnailPlacementMobile",
    isMobile
  );

  const density = pick(config, "densityDesktop", "densityMobile", isMobile);
  const densityClass = `topic-hover-card--density-${density || "default"}`;

  const sizeMode = pick(
    config,
    "thumbnailSizeModeDesktop",
    "thumbnailSizeModeMobile",
    isMobile
  );

  const sizeModeClass =
    sizeMode === "auto_fit_height"
      ? "topic-hover-card--thumb-size-auto-fit-height"
      : "topic-hover-card--thumb-size-manual";

  const thumbnailPercent = pick(
    config,
    "thumbnailSizePercentDesktop",
    "thumbnailSizePercentMobile",
    isMobile
  );

  const autoFitMaxWidth = pick(
    config,
    "thumbnailAutoFitMaxWidthDesktop",
    "thumbnailAutoFitMaxWidthMobile",
    isMobile
  );

  const topBottomHeight = pick(
    config,
    "thumbnailHeightTopBottomDesktop",
    "thumbnailHeightTopBottomMobile",
    isMobile
  );

  const showTitle = pick(config, "showTitleDesktop", "showTitleMobile", isMobile);
  const showExcerpt = pick(
    config,
    "showExcerptDesktop",
    "showExcerptMobile",
    isMobile
  );

  const showImage = config?.wikipediaPreviewShowImage !== false;
  const useExtractHtml = config?.wikipediaPreviewUseExtractHtml !== false;
  const safeUrl = sanitizeURL(preview.url) || "#";

  const wrapperStyle = `
    --thc-thumbnail-size-percent:${escapeHTML(String(thumbnailPercent ?? 15))};
    --thc-auto-thumb-max-width:${escapeHTML(autoFitMaxWidth || "10rem")};
    --thc-thumb-top-bottom-height:${escapeHTML(topBottomHeight || "auto")};
  `;

  const mobileCloseButton = isMobile
    ? `
      <button
        class="topic-hover-card__mobile-x"
        type="button"
        aria-label="Close preview"
        data-thc-close
      >
        &times;
      </button>
    `
    : "";

  const thumbnail =
    showImage && preview.image_url
      ? buildSharedThumbnailHTML(preview.image_url, config, isMobile)
      : "";

  let excerptHTML = "";
  if (showExcerpt) {
    excerptHTML =
      useExtractHtml && preview.html
        ? `
          <div class="topic-hover-card__excerpt">
            ${preview.html}
          </div>
        `
        : `
          <div class="topic-hover-card__excerpt">
            ${escapeHTML(preview.excerpt || "")}
          </div>
        `;
  }

  const titleHTML = showTitle
    ? `
      <h3 class="topic-hover-card__title">
        ${escapeHTML(preview.title || "Wikipedia")}
      </h3>
    `
    : "";

  const mobileActionsHTML = isMobile
    ? `
      <div class="topic-hover-card__actions topic-hover-card__actions--mobile">
        <a
          class="btn btn-primary topic-hover-card__open-topic"
          href="${escapeHTML(safeUrl)}"
          target="_blank"
          rel="noopener noreferrer"
          data-thc-open-topic
        >
          Open article
        </a>
        <button
          class="btn btn-default topic-hover-card__close"
          type="button"
          data-thc-close
        >
          Close
        </button>
      </div>
    `
    : "";

  const bodyInner = `
    <div class="topic-hover-card__body">
      ${mobileCloseButton}
      ${titleHTML}
      ${excerptHTML}

      <div class="topic-hover-card__meta">
        <span class="topic-hover-card__meta-item">
          <a
            href="${escapeHTML(safeUrl)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read more on Wikipedia
          </a>
        </span>
      </div>

      ${mobileActionsHTML}
    </div>
  `;

  switch (placement) {
    case "left":
      return `
        <div
          class="topic-hover-card topic-hover-card--wikipedia topic-hover-card--left ${densityClass} ${sizeModeClass}"
          style="${wrapperStyle}"
        >
          ${thumbnail}
          ${bodyInner}
        </div>
      `;
    case "right":
      return `
        <div
          class="topic-hover-card topic-hover-card--wikipedia topic-hover-card--right ${densityClass} ${sizeModeClass}"
          style="${wrapperStyle}"
        >
          ${bodyInner}
          ${thumbnail}
        </div>
      `;
    case "bottom":
      return `
        <div
          class="topic-hover-card topic-hover-card--wikipedia topic-hover-card--bottom ${densityClass} ${sizeModeClass}"
          style="${wrapperStyle}"
        >
          ${bodyInner}
          ${thumbnail}
        </div>
      `;
    case "top":
    default:
      return `
        <div
          class="topic-hover-card topic-hover-card--wikipedia topic-hover-card--top ${densityClass} ${sizeModeClass}"
          style="${wrapperStyle}"
        >
          ${thumbnail}
          ${bodyInner}
        </div>
      `;
  }
}

function buildTopicFallbackHTML(preview, config, isMobile) {
  const density = pick(config, "densityDesktop", "densityMobile", isMobile);
  const densityClass = `topic-hover-card--density-${density || "default"}`;

  const showTitle = pick(config, "showTitleDesktop", "showTitleMobile", isMobile);
  const showExcerpt = pick(
    config,
    "showExcerptDesktop",
    "showExcerptMobile",
    isMobile
  );

  const safeUrl = sanitizeURL(preview.url) || "";

  const mobileCloseButton = isMobile
    ? `
      <button
        class="topic-hover-card__mobile-x"
        type="button"
        aria-label="Close preview"
        data-thc-close
      >
        &times;
      </button>
    `
    : "";

  const mobileActionsHTML = isMobile && safeUrl
    ? `
      <div class="topic-hover-card__actions topic-hover-card__actions--mobile">
        <a
          class="btn btn-primary topic-hover-card__open-topic"
          href="${escapeHTML(safeUrl)}"
          data-thc-open-topic
        >
          Open topic
        </a>
        <button
          class="btn btn-default topic-hover-card__close"
          type="button"
          data-thc-close
        >
          Close
        </button>
      </div>
    `
    : isMobile
    ? `
      <div class="topic-hover-card__actions topic-hover-card__actions--mobile">
        <button
          class="btn btn-default topic-hover-card__close"
          type="button"
          data-thc-close
        >
          Close
        </button>
      </div>
    `
    : "";

  return `
    <div class="topic-hover-card ${densityClass}">
      <div class="topic-hover-card__body">
        ${mobileCloseButton}

        ${
          showTitle
            ? `
          <h3 class="topic-hover-card__title">
            ${escapeHTML(preview.title || "(no title)")}
          </h3>
        `
            : ""
        }

        ${
          showExcerpt
            ? `
          <div class="topic-hover-card__excerpt">
            ${escapeHTML(preview.excerpt || "")}
          </div>
        `
            : ""
        }

        ${mobileActionsHTML}
      </div>
    </div>
  `;
}

export function buildLoadingPreviewHTML() {
  return `
    <div class="topic-hover-card topic-hover-card--loading">
      <div class="topic-hover-card__body">
        <div class="topic-hover-card__skeleton topic-hover-card__skeleton--title"></div>
        <div class="topic-hover-card__skeleton topic-hover-card__skeleton--line"></div>
        <div class="topic-hover-card__skeleton topic-hover-card__skeleton--line"></div>
        <div class="topic-hover-card__skeleton topic-hover-card__skeleton--meta"></div>
      </div>
    </div>
  `;
}

export function buildErrorPreviewHTML(message = "Could not load preview.") {
  return `
    <div class="topic-hover-card topic-hover-card--error">
      <div class="topic-hover-card__body">
        ${escapeHTML(message)}
      </div>
    </div>
  `;
}