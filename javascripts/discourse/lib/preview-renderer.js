import {
  escapeHTML,
  formatNumber,
  getPreviewProvider,
  providerColor,
  providerKeyForTarget,
  safeAvatarURL,
  sanitizeExcerpt,
  sanitizeURL,
  normalizeTag,
} from "./rich-preview-utils";

export function buildPreviewHTML(preview, categories, config, isMobile = false) {
  if (!preview) {
    return buildErrorPreviewHTML("No preview available.");
  }

  const providerKey = resolveProviderKey(preview);
  const provider = getPreviewProvider(config, providerKey);

  if (!provider || provider.enabled === false) {
    return buildErrorPreviewHTML("Preview provider is disabled.");
  }

  switch (preview.type) {
    case "wikipedia":
      return buildWikipediaPreviewHTML(preview, provider, config, isMobile);
    case "external":
      return buildExternalPreviewHTML(preview, provider, config, isMobile);
    case "topic":
      return buildTopicPreviewHTML(preview, provider, categories, config, isMobile);
    default:
      return buildErrorPreviewHTML("Unsupported preview type.");
  }
}

export function buildLoadingPreviewHTML(rootAttrs = "") {
  return `
    <div class="topic-hover-card topic-hover-card--loading" ${rootAttrs}>
      <div class="topic-hover-card__body">
        <div class="topic-hover-card__meta">
          <span class="topic-hover-card__meta-item">Loading preview…</span>
        </div>
      </div>
    </div>
  `;
}

export function buildErrorPreviewHTML(message, rootAttrs = "") {
  return `
    <div class="topic-hover-card topic-hover-card--error" ${rootAttrs}>
      <div class="topic-hover-card__body">
        <div class="topic-hover-card__meta">
          <span class="topic-hover-card__meta-item topic-hover-card__meta-item--error">
            Preview unavailable
          </span>
        </div>
        <div class="topic-hover-card__excerpt">
          ${escapeHTML(message)}
        </div>
      </div>
    </div>
  `;
}

function resolveProviderKey(preview) {
  return (
    preview?.providerKey ||
    providerKeyForTarget(preview, preview) ||
    (preview?.type === "wikipedia"
      ? "wikipedia"
      : preview?.type === "external"
        ? "external"
        : "topic")
  );
}

function resolveProviderKeyAndColor(preview, config) {
  const providerKey = resolveProviderKey(preview);
  const color = providerColor(providerKey, config, "var(--tertiary)");

  return {
    providerKey,
    providerColor: color || "var(--tertiary)",
  };
}

function buildProviderRootAttrs(preview, config, fallbackType = "topic") {
  const { providerKey, providerColor } = resolveProviderKeyAndColor(preview, config);
  const finalProviderKey = providerKey || fallbackType;

  return {
    providerKey: finalProviderKey,
    providerColor,
    rootAttrs: `data-preview-type="${escapeHTML(
      preview?.type || fallbackType
    )}" data-provider-key="${escapeHTML(
      finalProviderKey
    )}" style="--thc-provider-color:${escapeHTML(providerColor)};"`,
  };
}

export function buildRootAttrsForTarget(target, config, fallbackType = "topic") {
  const previewLike = {
    type: target?.type || fallbackType,
    providerKey: target?.providerKey,
  };

  return buildProviderRootAttrs(previewLike, config, fallbackType).rootAttrs;
}

function densityFor(_provider, config, isMobile, previewType) {
  if (previewType === "wikipedia") {
    return isMobile
      ? config?.wikipediaDensityMobile || "compact"
      : config?.wikipediaDensityDesktop || "cozy";
  }

  return isMobile
    ? config?.densityMobile || "cozy"
    : config?.densityDesktop || "default";
}

function pick(config, desktopKey, mobileKey, isMobile) {
  return isMobile ? config?.[mobileKey] : config?.[desktopKey];
}

function placementFor(config, isMobile) {
  return (
    pick(
      config,
      "thumbnailPlacementDesktop",
      "thumbnailPlacementMobile",
      isMobile
    ) || "left"
  );
}

function sizeModeFor(config, isMobile) {
  return (
    pick(
      config,
      "thumbnailSizeModeDesktop",
      "thumbnailSizeModeMobile",
      isMobile
    ) || "auto_fit_height"
  );
}

function layoutMode(config) {
  return config?.previewLayout || "hover_card";
}

function buildCardClasses(preview, config, isMobile) {
  const density = densityFor(null, config, isMobile, preview.type);
  const placement = placementFor(config, isMobile);
  const sizeMode = sizeModeFor(config, isMobile);

  const classes = ["topic-hover-card"];

  if (preview.type === "wikipedia") {
    classes.push("topic-hover-card--topic", "topic-hover-card--wikipedia");
  } else if (preview.type) {
    classes.push(`topic-hover-card--${preview.type}`);
  } else {
    classes.push("topic-hover-card--topic");
  }

  classes.push(
    `topic-hover-card--${placement}`,
    `topic-hover-card--density-${density}`,
    `topic-hover-card--thumb-size-${sizeMode}`,
    `topic-hover-card--layout-${layoutMode(config)}`
  );

  if (isMobile) {
    classes.push("topic-hover-card--mobile");
  }

  return classes.join(" ");
}

function buildMobileActionsHTML(preview, isMobile, primaryLabel = "Open link") {
  if (!isMobile) {
    return "";
  }

  const safeUrl = sanitizeURL(preview?.url);
  if (!safeUrl) {
    return "";
  }

  const mobileCloseButton = `
    <button
      class="topic-hover-card__mobile-x"
      type="button"
      aria-label="Close preview"
      data-thc-close
    >
      ×
    </button>
  `;

  const actions = `
    <div class="topic-hover-card__actions topic-hover-card__actions--mobile">
      <a
        class="btn btn-primary topic-hover-card__open-topic"
        href="${escapeHTML(safeUrl)}"
        data-thc-open-topic
      >
        ${escapeHTML(primaryLabel)}
      </a>
      <button
        class="btn btn-default topic-hover-card__close"
        type="button"
        data-thc-close
      >
        Close
      </button>
    </div>
  `;

  return mobileCloseButton + actions;
}

function buildSharedThumbnailHTML(
  imageUrl,
  title,
  config,
  isMobile,
  options = {}
) {
  const safeImage =
    typeof imageUrl === "string" && imageUrl.trim().length
      ? imageUrl.trim()
      : "";

  if (!safeImage) {
    return "";
  }

  const sizeMode = sizeModeFor(config, isMobile);
  const placement = placementFor(config, isMobile);
  const variant = options.variant || "plain";

  const sizePercent = isMobile
    ? config?.thumbnailSizePercentMobile || 25
    : config?.thumbnailSizePercentDesktop || 15;

  const autoMaxWidth = isMobile
    ? config?.thumbnailAutoFitMaxWidthMobile || "8rem"
    : config?.thumbnailAutoFitMaxWidthDesktop || "10rem";

  const thumbTopBottomHeight = isMobile
    ? config?.thumbnailHeightTopBottomMobile || "auto"
    : config?.thumbnailHeightTopBottomDesktop || "auto";

  const imgClasses = ["topic-hover-card__thumb"];
  const wrapStyles = [
    `--thc-thumbnail-size-percent:${escapeHTML(String(sizePercent))};`,
  ];
  const imgStyles = [];

  if (sizeMode === "auto_fit_height") {
    imgClasses.push("topic-hover-card__thumb--auto-fit");
    wrapStyles.push(
      `--thc-auto-thumb-max-width:${escapeHTML(String(autoMaxWidth))};`
    );
  }

  if (placement === "top" || placement === "bottom") {
    wrapStyles.push(
      `--thc-thumb-top-bottom-height:${escapeHTML(
        String(thumbTopBottomHeight)
      )};`
    );
    imgStyles.push(
      `--thc-thumb-top-bottom-height:${escapeHTML(
        String(thumbTopBottomHeight)
      )};`
    );
  }

  const wrapStyleAttr = wrapStyles.length
    ? `style="${wrapStyles.join("")}"`
    : "";
  const imgStyleAttr = imgStyles.length
    ? `style="${imgStyles.join("")}"`
    : "";
  const safeAlt = escapeHTML(title || "Preview image");
  const safeSrc = escapeHTML(safeImage);
  const imgClassAttr = imgClasses.join(" ");

  if (variant === "blur-bg") {
    return `
      <div class="topic-hover-card__thumb-wrap" ${wrapStyleAttr}>
        <div
          class="topic-hover-card__thumb-bg"
          style="background-image: url('${safeSrc}');"
          aria-hidden="true"
        ></div>
        <img
          class="${imgClassAttr}"
          src="${safeSrc}"
          alt="${safeAlt}"
          loading="lazy"
          decoding="async"
          ${imgStyleAttr}
        >
      </div>
    `;
  }

  return `
    <div class="topic-hover-card__thumb-wrap" ${wrapStyleAttr}>
      <img
        class="${imgClassAttr}"
        src="${safeSrc}"
        alt="${safeAlt}"
        loading="lazy"
        decoding="async"
        ${imgStyleAttr}
      >
    </div>
  `;
}

function buildMetaRow(items) {
  const filtered = items.filter(Boolean);
  if (!filtered.length) {
    return "";
  }

  return `
    <div class="topic-hover-card__meta">
      ${filtered.join("")}
    </div>
  `;
}

function formatMetaDate(value) {
  if (!value) {
    return String(value ?? "");
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return String(value);
  }

  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildMetaItem(label, value, extraClass = "") {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return `
    <span class="topic-hover-card__meta-item ${escapeHTML(extraClass)}">
      <span class="topic-hover-card__meta-label">${escapeHTML(label)}:</span>
      <span>${escapeHTML(String(value))}</span>
    </span>
  `;
}

function buildTopicCategoryHTML(preview, categories, config, isMobile) {
  if (!pick(config, "showCategoryDesktop", "showCategoryMobile", isMobile)) {
    return "";
  }

  const previewCategory =
    preview?.category ||
    (preview?.categoryId
      ? {
          id: preview.categoryId,
          name: preview.categoryName || null,
          slug: preview.categorySlug || null,
          color: preview.categoryColor || null,
          text_color: preview.categoryTextColor || null,
        }
      : null);

  const categoryId =
    previewCategory?.id ?? preview?.categoryId ?? preview?.raw?.category_id;

  const matchedCategory =
    categoryId && Array.isArray(categories)
      ? categories.find((c) => Number(c?.id) === Number(categoryId))
      : null;

  const category = matchedCategory || previewCategory;

  const name =
    category?.name ||
    category?.slug ||
    preview?.categoryName ||
    preview?.categorySlug ||
    preview?.raw?.category_name ||
    preview?.raw?.category_slug;

  if (!name) {
    return "";
  }

  const rawColor =
    category?.color ||
    category?.text_color ||
    category?.textColor ||
    preview?.categoryColor ||
    preview?.categoryTextColor ||
    preview?.raw?.category_color ||
    null;

  const normalizedColor = rawColor ? String(rawColor).trim() : "";
  const color = normalizedColor.startsWith("#")
    ? normalizedColor.slice(1)
    : normalizedColor || null;

  const styleAttr = color
    ? ` style="--thc-category-color:#${escapeHTML(color)};"`
    : "";

  return `<span class="topic-hover-card__badge topic-hover-card__badge--category"${styleAttr}>${escapeHTML(
    String(name)
  )}</span>`;
}

function buildTagsHTML(tags, config, isMobile) {
  const showTags = pick(config, "showTagsDesktop", "showTagsMobile", isMobile);

  if (!showTags || !Array.isArray(tags) || !tags.length) {
    return "";
  }

  const normalizedTags = tags
    .map((tag) => {
      const normalized = normalizeTag(tag);
      if (normalized) {
        return normalized;
      }

      if (typeof tag === "string") {
        const trimmed = tag.trim();
        return trimmed || null;
      }

      if (tag && typeof tag === "object") {
        const fallback =
          tag.name ?? tag.text ?? tag.slug ?? tag.value ?? tag.id ?? null;
        return fallback ? String(fallback).trim() : null;
      }

      return null;
    })
    .filter(Boolean)
    .slice(0, 5);

  if (!normalizedTags.length) {
    return "";
  }

  return (
    '<div class="topic-hover-card__tags">' +
    normalizedTags
      .map(
        (tag) =>
          '<span class="topic-hover-card__badge topic-hover-card__badge--tag">' +
          escapeHTML(String(tag)) +
          "</span>"
      )
      .join("") +
    "</div>"
  );
}

function buildAuthorHTML(preview, config, isMobile) {
  const showOp = pick(config, "showOpDesktop", "showOpMobile", isMobile);

  if (!showOp) {
    return "";
  }

  const showAvatar = pick(
    config,
    "showOpAvatarDesktop",
    "showOpAvatarMobile",
    isMobile
  );

  const username =
    preview?.author?.username ||
    preview?.username ||
    preview?.op?.username ||
    preview?.raw?.username ||
    "";

  if (!username) {
    return "";
  }

  const avatarUrl = showAvatar
    ? sanitizeURL(
        preview?.author?.avatarUrl ||
          preview?.avatarUrl ||
          safeAvatarURL(
            preview?.author?.avatarTemplate || preview?.avatarTemplate,
            24
          )
      )
    : "";

  const avatarHtml = avatarUrl
    ? `<img class="topic-hover-card__avatar" src="${escapeHTML(
        avatarUrl
      )}" alt="" loading="lazy" decoding="async">`
    : "";

  return `
    <span class="topic-hover-card__meta-item topic-hover-card__meta-item--op">
      ${avatarHtml}
      <span>${escapeHTML(username)}</span>
    </span>
  `;
}

function buildExcerptHTML(preview, config, isMobile) {
  const showExcerpt = pick(
    config,
    "showExcerptDesktop",
    "showExcerptMobile",
    isMobile
  );

  if (!showExcerpt) {
    return "";
  }

  const rawExcerpt =
    preview?.excerpt ||
    preview?.description ||
    preview?.raw?.excerpt ||
    preview?.raw?.blurb ||
    "";

  const excerpt = sanitizeExcerpt(
    rawExcerpt,
    config?.excerptExcludedSelectors || []
  );

  if (!excerpt) {
    return "";
  }

  const lines = pick(
    config,
    "excerptLengthDesktop",
    "excerptLengthMobile",
    isMobile
  );

  const overflowClass =
    typeof lines === "number" && lines > 0
      ? " topic-hover-card__excerpt--overflows"
      : "";

  return `
    <div class="topic-hover-card__excerpt${overflowClass}" style="--thc-excerpt-lines:${Number(
      lines || 3
    )};">
      ${escapeHTML(excerpt)}
    </div>
  `;
}

function buildTitleHTML(preview, config, isMobile) {
  const showTitle = pick(config, "showTitleDesktop", "showTitleMobile", isMobile);

  if (!showTitle) {
    return "";
  }

  const title = preview?.title || preview?.label || preview?.hostname || "";

  if (!title) {
    return "";
  }

  if (preview.type === "topic") {
    return `
      <h3 class="topic-hover-card__title">
        ${escapeHTML(title)}
      </h3>
    `;
  }

  return `
    <div class="topic-hover-card__title">
      ${escapeHTML(title)}
    </div>
  `;
}

function buildPublishDateHTML(preview, config, isMobile) {
  const showPublishDate = pick(
    config,
    "showPublishDateDesktop",
    "showPublishDateMobile",
    isMobile
  );

  const value = preview?.createdAt;
  if (!showPublishDate || !value) {
    return "";
  }

  return `
    <span class="topic-hover-card__meta-item topic-hover-card__meta-item--date">
      <span>${escapeHTML(formatMetaDate(value))}</span>
    </span>
  `;
}

function buildIconHTML(iconName) {
  const safeIcon = escapeHTML(String(iconName));
  return `<svg class="fa d-icon d-icon-${safeIcon} svg-icon fa-width-auto svg-string" width="1em" height="1em" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#${safeIcon}"></use></svg>`;
}

function buildTopicStatsHTML(preview, config, isMobile) {
  const items = [];

  if (
    pick(config, "showViewsDesktop", "showViewsMobile", isMobile) &&
    Number.isFinite(Number(preview?.views))
  ) {
    items.push(`
      <span class="topic-hover-card__stat">
        ${buildIconHTML("far-eye")}
        <span>${escapeHTML(formatNumber(Number(preview.views)))}</span>
      </span>
    `);
  }

  if (
    pick(config, "showReplyCountDesktop", "showReplyCountMobile", isMobile) &&
    Number.isFinite(Number(preview?.replyCount))
  ) {
    items.push(`
      <span class="topic-hover-card__stat">
        ${buildIconHTML("comment")}
        <span>${escapeHTML(formatNumber(Number(preview.replyCount)))}</span>
      </span>
    `);
  }

  if (
    pick(config, "showLikesDesktop", "showLikesMobile", isMobile) &&
    Number.isFinite(Number(preview?.likeCount))
  ) {
    items.push(`
      <span class="topic-hover-card__stat">
        ${buildIconHTML("heart")}
        <span>${escapeHTML(formatNumber(Number(preview.likeCount)))}</span>
      </span>
    `);
  }

  if (
    pick(config, "showActivityDesktop", "showActivityMobile", isMobile) &&
    preview?.lastPostedAt
  ) {
    items.push(`
      <span class="topic-hover-card__stat">
        ${buildIconHTML("clock")}
        <span>${escapeHTML(formatMetaDate(preview.lastPostedAt))}</span>
      </span>
    `);
  }

  if (!items.length) {
    return "";
  }

  return `<span class="topic-hover-card__meta-item topic-hover-card__meta-item--stats">${items.join(
    ""
  )}</span>`;
}

function buildOneboxLayoutBody(preview, config, isMobile, options = {}) {
  const {
    primaryLabel = "Open link",
    showSourceRow = true,
    sourceLabel,
    titlePreview = preview,
    excerptPreview = preview,
  } = options;

  const titleHtml = buildTitleHTML(titlePreview || preview, config, isMobile);
  const excerptHtml = buildExcerptHTML(
    excerptPreview || preview,
    config,
    isMobile
  );

  const metaItems = [];
  if (showSourceRow && sourceLabel) {
    metaItems.push(
      buildMetaItem("Source", sourceLabel, "topic-hover-card__meta-item--source")
    );
  }

  const metaHtml = buildMetaRow(metaItems);

  return `
    <div class="topic-hover-card__body topic-hover-card__body--onebox">
      ${buildMobileActionsHTML(preview, isMobile, primaryLabel)}
      ${titleHtml}
      ${excerptHtml}
      ${metaHtml}
    </div>
  `;
}

function buildTopicPreviewHTML(
  preview,
  _provider,
  categories,
  config,
  isMobile
) {
  const { rootAttrs } = buildProviderRootAttrs(preview, config, "topic");
  const title = preview?.title || "";
  const imageUrl =
    preview?.imageUrl ||
    preview?.thumbnail ||
    preview?.image ||
    preview?.thumbnailUrl ||
    "";
  const tags = preview?.tags || preview?.raw?.tags || [];

  const thumbHtml = buildSharedThumbnailHTML(
    imageUrl,
    title,
    config,
    isMobile,
    { variant: "blur-bg" }
  );

  const titleHtml = buildTitleHTML(preview, config, isMobile);
  const excerptHtml = buildExcerptHTML(preview, config, isMobile);
  const authorHtml = buildAuthorHTML(preview, config, isMobile);
  const publishDateHtml = buildPublishDateHTML(preview, config, isMobile);
  const statsHtml = buildTopicStatsHTML(preview, config, isMobile);

  const metaItems = [authorHtml, publishDateHtml, statsHtml].filter(Boolean);
  const metaHtml = metaItems.length
    ? `<div class="topic-hover-card__meta">${metaItems.join(
        '<span class="topic-hover-card__sep">·</span>'
      )}</div>`
    : "";

  const badgesParts = [
    buildTopicCategoryHTML(preview, categories, config, isMobile),
    buildTagsHTML(tags, config, isMobile),
  ].filter(Boolean);

  const badgesHtml = badgesParts.length
    ? `<div class="topic-hover-card__badges">${badgesParts.join("")}</div>`
    : "";

  const cardClasses = buildCardClasses(preview, config, isMobile);
  const placement = placementFor(config, isMobile);
  const layout = layoutMode(config);

  const bodyClass =
    layout === "onebox"
      ? "topic-hover-card__body topic-hover-card__body--onebox"
      : "topic-hover-card__body";

  const bodyHtml = `
    <div class="${bodyClass}">
      ${buildMobileActionsHTML(preview, isMobile, "Open topic")}
      ${titleHtml}
      ${excerptHtml}
      ${metaHtml}
      ${badgesHtml}
    </div>
  `;

  if (layout === "hover_card" && (placement === "left" || placement === "right")) {
    if (placement === "left") {
      return `
        <div class="${cardClasses}" ${rootAttrs}>
          ${thumbHtml}
          ${bodyHtml}
        </div>
      `;
    }

    return `
      <div class="${cardClasses}" ${rootAttrs}>
        ${bodyHtml}
        ${thumbHtml}
      </div>
    `;
  }

  return `
    <div class="${cardClasses}" ${rootAttrs}>
      ${bodyHtml}
      ${thumbHtml}
    </div>
  `;
}

function buildWikipediaPreviewHTML(preview, provider, config, isMobile) {
  const { rootAttrs } = buildProviderRootAttrs(preview, config, "wikipedia");
  const classes = buildCardClasses(preview, config, isMobile);

  const showImage = config?.wikipediaShowImage !== false;
  const thumbHtml =
    showImage && preview?.imageUrl
      ? buildSharedThumbnailHTML(preview.imageUrl, preview.title, config, isMobile)
      : "";

  const titleHtml = buildTitleHTML(preview, config, isMobile);
  const excerptHtml = buildExcerptHTML(preview, config, isMobile);

  const sourceLabel = provider?.label || "Wikipedia";
  const bodyHtml =
    layoutMode(config) === "onebox"
      ? buildOneboxLayoutBody(preview, config, isMobile, {
          primaryLabel: "Open article",
          showSourceRow: true,
          sourceLabel,
        })
      : `
        <div class="topic-hover-card__body">
          ${buildMobileActionsHTML(preview, isMobile, "Open article")}
          ${titleHtml}
          ${excerptHtml}
          <div class="topic-hover-card__meta">
            ${buildMetaItem("Source", sourceLabel, "topic-hover-card__meta-item--source")}
          </div>
        </div>
      `;

  return `
    <div class="${classes}" ${rootAttrs}>
      ${thumbHtml}
      ${bodyHtml}
    </div>
  `;
}

function buildExternalPreviewHTML(preview, provider, config, isMobile) {
  const { rootAttrs } = buildProviderRootAttrs(preview, config, "external");
  const classes = buildCardClasses(preview, config, isMobile);

  const thumbHtml = preview?.imageUrl
    ? buildSharedThumbnailHTML(preview.imageUrl, preview.title, config, isMobile)
    : "";

  const titleHtml = buildTitleHTML(preview, config, isMobile);
  const excerptHtml = buildExcerptHTML(preview, config, isMobile);

  const sourceLabel = preview?.hostname || provider?.label || "External link";
  const metaHtml = `
    <div class="topic-hover-card__meta">
      ${buildMetaItem("Source", sourceLabel, "topic-hover-card__meta-item--source")}
    </div>
  `;

  const bodyHtml =
    layoutMode(config) === "onebox"
      ? buildOneboxLayoutBody(preview, config, isMobile, {
          primaryLabel: "Open link",
          showSourceRow: true,
          sourceLabel,
        })
      : `
        <div class="topic-hover-card__body">
          ${buildMobileActionsHTML(preview, isMobile, "Open link")}
          ${titleHtml}
          ${excerptHtml}
          ${metaHtml}
        </div>
      `;

  return `
    <div class="${classes}" ${rootAttrs}>
      ${thumbHtml}
      ${bodyHtml}
    </div>
  `;
}