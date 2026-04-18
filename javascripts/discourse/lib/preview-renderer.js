import { escapeHTML } from "./hover-preview-utils";

export function buildPreviewHTML(preview, categories, config, isMobile = false) {
  if (!preview) {
    return buildErrorPreviewHTML("No preview available.");
  }

  switch (preview.type) {
    case "wikipedia":
      return buildWikipediaPreviewHTML(preview, isMobile);
    case "topic":
      return buildTopicFallbackHTML(preview);
    default:
      return buildErrorPreviewHTML("Unsupported preview type.");
  }
}

function buildWikipediaPreviewHTML(preview, isMobile) {
  const imageHTML = preview.image_url
    ? `
      <div class="topic-hover-card__thumb-wrap">
        <img
          class="topic-hover-card__thumb"
          src="${escapeHTML(preview.image_url)}"
          alt=""
          loading="lazy"
          decoding="async"
        />
      </div>
    `
    : "";

  const excerptHTML = preview.html
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

  const mobileActionsHTML = isMobile
    ? `
      <div class="topic-hover-card__actions topic-hover-card__actions--mobile">
        <a
          class="btn btn-primary topic-hover-card__open-topic"
          href="${escapeHTML(preview.url)}"
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

  return `
    <div class="topic-hover-card topic-hover-card--wikipedia">
      ${imageHTML}
      <div class="topic-hover-card__body">
        <h3 class="topic-hover-card__title">
          ${escapeHTML(preview.title || "Wikipedia")}
        </h3>

        ${excerptHTML}

        <div class="topic-hover-card__meta">
          <span class="topic-hover-card__meta-item">
            <a
              href="${escapeHTML(preview.url)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read more on Wikipedia
            </a>
          </span>
        </div>

        ${mobileActionsHTML}
      </div>
    </div>
  `;
}

function buildTopicFallbackHTML(preview) {
  return `
    <div class="topic-hover-card">
      <div class="topic-hover-card__body">
        <h3 class="topic-hover-card__title">
          ${escapeHTML(preview.title || "(no title)")}
        </h3>

        <div class="topic-hover-card__excerpt">
          ${escapeHTML(preview.excerpt || "")}
        </div>
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