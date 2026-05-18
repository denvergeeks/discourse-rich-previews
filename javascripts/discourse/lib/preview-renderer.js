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
      return buildTopicPreviewHTML(
        preview,
        provider,
        categories,
        config,
        isMobile
      );
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
  const { providerKey, providerColor } = resolveProviderKeyAndColor(
    preview,
    config
  );

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

export function buildRootAttrsForTarget(
  target,
  config,
  fallbackType = "topic"
) {
  const previewLike = {
    type: target?.type || fallbackType,
    providerKey: target?.providerKey,
  };

  return buildProviderRootAttrs(previewLike, config, fallbackType).rootAttrs;
}

function densityFor(provider, config, isMobile, previewType) {
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
      &times;
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
    ? config?.thumbnailSizePercentMobile ||
      config?.imageSizePercentMobile ||
      config?.thumbnailSizeMobile ||
      25
    : config?.thumbnailSizePercent ||
      config?.imageSizePercent ||
      config?.thumbnailSize ||
      15;

  const autoMaxWidth = isMobile
    ? config?.autoThumbnailMaxWidthMobile || "8rem"
    : config?.autoThumbnailMaxWidth || "10rem";

  const thumbTopBottomHeight = isMobile
    ? config?.thumbnailTopBottomHeightMobile || "auto"
    : config?.thumbnailTopBottomHeight || "auto";

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
  if (!value) return String(value ?? "");
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function buildMetaItem(label, value, extraClass = "") {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return `
    <span class="topic-hover-card__meta-item ${escapeHTML(extraClass)}">
      <span class="topic-hover-card__meta-label">${escapeHTML(label)}:</span>
      <span>${escapeHTML(formatMetaDate(value))
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

  const categoryId = previewCategory?.id ?? preview?.categoryId ?? preview?.raw?.category_id;
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
    preview?.raw?.categoryColor ||
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
  const showTags = pick(
    config,
    "showTagsDesktop",
    "showTagsMobile",
    isMobile
  );

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
          tag.name ??
          tag.text ??
          tag.slug ??
          tag.value ??
          tag.id ??
          null;

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

  const username =
    preview?.author?.username ||
    preview?.username ||
    preview?.op?.username ||
    "";

  if (!username) {
    return "";
  }

  const avatarUrl = sanitizeURL(
    preview?.author?.avatarUrl ||
      preview?.avatarUrl ||
      safeAvatarURL(
        preview?.author?.avatarTemplate || preview?.avatar_template,
        48
      )
  );

  return `
    <span class="topic-hover-card__meta-item topic-hover-card__meta-item--op">
      ${
        avatarUrl
          ? `<img class="topic-hover-card__avatar" src="${avatarUrl}" alt="" loading="lazy" decoding="async">`
          : ""
      }
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
  const showTitle = pick(
    config,
    "showTitleDesktop",
    "showTitleMobile",
    isMobile
  );

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

function buildOneboxLayoutBody(preview, config, isMobile, options = {}) {
  const {
    primaryLabel = "Open link",
    showSourceRow = true,
    sourceLabel,
    titlePreview = preview,
    excerptPreview = preview,
  } = options;

  const titleHtml = buildTitleHTML(
    titlePreview || preview,
    config,
    isMobile
  );
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
    preview?.thumbnail_url ||
    "";
  const category = preview?.category || preview?.raw?.category || null;
  const tags = preview?.tags || preview?.raw?.tags || [];

  const showPublishDate = pick(
    config,
    "showPublishDateDesktop",
    "showPublishDateMobile",
    isMobile
  );
  const showViews = pick(
    config,
    "showViewsDesktop",
    "showViewsMobile",
    isMobile
  );
  const showReplyCount = pick(
    config,
    "showReplyCountDesktop",
    "showReplyCountMobile",
    isMobile
  );
  const showLikes = pick(
    config,
    "showLikesDesktop",
    "showLikesMobile",
    isMobile
  );
  const showActivity = pick(
    config,
    "showActivityDesktop",
    "showActivityMobile",
    isMobile
  );

  const metaTop = buildMetaRow([
    buildTopicCategoryHTML(category, categories, config, isMobile),
  ]);

  const tagsHtml = buildTagsHTML(tags, config, isMobile);
  const thumbHtml = buildSharedThumbnailHTML(
    imageUrl,
    title,
    config,
    isMobile,
    { variant: "blur-bg" }
  );
  const authorHtml = buildAuthorHTML(preview, config, isMobile);
  const excerptHtml = buildExcerptHTML(preview, config, isMobile);

  const metaBottom = buildMetaRow([
    showPublishDate
      ? buildMetaItem(
          "Created",
          preview?.createdAt || preview?.created_at,
          "topic-hover-card__meta-item--date"
        )
      : "",
    showActivity
      ? buildMetaItem(
          "Activity",
          preview?.lastPostedAt ||
            preview?.bumpedAt ||
            preview?.last_posted_at ||
            preview?.bumped_at,
          "topic-hover-card__meta-item--date"
        )
      : "",
    showViews
      ? buildMetaItem(
          "Views",
          formatNumber(preview?.views || 0),
          "topic-hover-card__meta-item--stats"
        )
      : "",
    showReplyCount
      ? buildMetaItem(
          "Replies",
          formatNumber(
            preview?.replyCount ??
              preview?.postsCount ??
              preview?.reply_count ??
              0
          ),
          "topic-hover-card__meta-item--stats"
        )
      : "",
    showLikes
      ? buildMetaItem(
          "Likes",
          formatNumber(
            preview?.likeCount ?? preview?.like_count ?? preview?.like_score ?? 0
          ),
          "topic-hover-card__meta-item--stats"
        )
      : "",
  ]);

  const cardClasses = buildCardClasses(preview, config, isMobile);
  const placement = placementFor(config, isMobile);
  const layout = layoutMode(config);

  const bodyHtml = `
    <div class="topic-hover-card__body">
      ${metaTop}
      ${buildTitleHTML(preview, config, isMobile)}
      ${excerptHtml}
      ${tagsHtml}
      <div class="topic-hover-card__meta">
        ${authorHtml}
        ${metaBottom}
      </div>
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

  const title = preview?.title || preview?.pageKey || "Wikipedia";
  const host = preview?.host || "wikipedia.org";
  const imageUrl =
    preview?.imageUrl ||
    preview?.thumbnail ||
    preview?.image ||
    preview?.thumbnailUrl ||
    preview?.thumbnail_url ||
    "";

  const cardClasses = buildCardClasses(preview, config, isMobile);
  const placement = placementFor(config, isMobile);
  const layout = layoutMode(config);

  const thumbHtml = buildSharedThumbnailHTML(
    imageUrl,
    title,
    config,
    isMobile,
    { variant: "blur-bg" }
  );

  const bodyHtml = `
    <div class="topic-hover-card__body">
      ${buildMobileActionsHTML(preview, isMobile, "Open article")}
      ${buildTitleHTML(preview, config, isMobile)}
      ${buildExcerptHTML(preview, config, isMobile)}
      ${buildMetaRow([
        buildMetaItem("Source", host),
      ])}
    </div>
  `;

  if (layout === "hover_card" && (placement === "left" || placement === "right")) {
    if (placement === "left") {
      return `
        <article class="${cardClasses}" ${rootAttrs}>
          ${thumbHtml}
          ${bodyHtml}
        </article>
      `;
    }

    return `
      <article class="${cardClasses}" ${rootAttrs}>
        ${bodyHtml}
        ${thumbHtml}
      </article>
      `;
  }

  return `
    <article class="${cardClasses}" ${rootAttrs}>
      ${bodyHtml}
      ${thumbHtml}
    </article>
  `;
}

function buildExternalPreviewHTML(preview, provider, config, isMobile) {
  const { rootAttrs } = buildProviderRootAttrs(preview, config, "external");

  const title =
    preview?.title || preview?.hostname || preview?.url || "External link";
  const imageUrl =
    preview?.imageUrl ||
    preview?.thumbnail ||
    preview?.image ||
    preview?.thumbnailUrl ||
    preview?.thumbnail_url ||
    "";
  const description =
    preview?.excerpt || preview?.description || preview?.siteName || "";

  const normalizedPreview = {
    ...preview,
    title,
    excerpt: description,
  };

  const cardClasses = buildCardClasses(preview, config, isMobile);
  const placement = placementFor(config, isMobile);
  const layout = layoutMode(config);

  const thumbHtml = buildSharedThumbnailHTML(
    imageUrl,
    title,
    config,
    isMobile,
    { variant: "blur-bg" }
  );

  if (layout === "onebox") {
    return `
      <article class="${cardClasses}" ${rootAttrs}>
        ${thumbHtml}
        ${buildOneboxLayoutBody(normalizedPreview, config, isMobile, {
          primaryLabel: "Open link",
          showSourceRow: true,
          sourceLabel: preview?.siteName || preview?.hostname,
          titlePreview: normalizedPreview,
          excerptPreview: normalizedPreview,
        })}
      </article>
    `;
  }

  const excerptHtml = buildExcerptHTML(normalizedPreview, config, isMobile);
  const metaHtml = buildMetaRow([
    buildMetaItem("Site", preview?.siteName || preview?.hostname),
    buildMetaItem("URL", preview?.displayUrl || preview?.url),
  ]);

  const bodyHtml = `
    <div class="topic-hover-card__body">
      ${buildMobileActionsHTML(normalizedPreview, isMobile, "Open link")}
      ${metaHtml}
      ${buildTitleHTML(normalizedPreview, config, isMobile)}
      ${excerptHtml}
    </div>
  `;

  if (layout === "hover_card" && (placement === "left" || placement === "right")) {
    if (placement === "left") {
      return `
        <article class="${cardClasses}" ${rootAttrs}>
          ${thumbHtml}
          ${bodyHtml}
        </article>
      `;
    }

    return `
      <article class="${cardClasses}" ${rootAttrs}>
        ${bodyHtml}
        ${thumbHtml}
      </article>
    `;
  }

  return `
    <article class="${cardClasses}" ${rootAttrs}>
      ${bodyHtml}
      ${thumbHtml}
    </article>
  `;
}
