import {
  escapeHTML,
  formatNumber,
  getPreviewProvider,
  providerColor,
  providerKeyForTarget,
  safeAvatarURL,
  sanitizeExcerpt,
  sanitizeURL,
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

export function buildLoadingPreviewHTML() {
  return `
    <article class="topic-hover-card topic-hover-card--loading">
      <div class="topic-hover-card__body">
        <div class="topic-hover-card__title">Loading preview…</div>
      </div>
    </article>
  `;
}

export function buildErrorPreviewHTML(message) {
  return `
    <article class="topic-hover-card topic-hover-card--error">
      <div class="topic-hover-card__body">
        <div class="topic-hover-card__title">Preview unavailable</div>
        <div class="topic-hover-card__excerpt">${escapeHTML(message)}</div>
      </div>
    </article>
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
    )}" style="--thc-provider-color:${escapeHTML(providerColor)};"`
  };
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

function buildCardClasses(preview, config, isMobile) {
  const density = densityFor(resolveProviderKey(preview), config, isMobile, preview.type);
  const classes = ["topic-hover-card", `topic-hover-card--${density}`];

  if (isMobile) {
    classes.push("topic-hover-card--mobile");
  }

  return classes.join(" ");
}

function buildSharedThumbnailHTML(
  imageUrl,
  title,
  config,
  isMobile,
  forceShow = false
) {
  if (!imageUrl) {
    return "";
  }

  const safeImage = sanitizeURL(imageUrl);
  if (!safeImage) {
    return "";
  }

  const showThumbnail = forceShow
    ? true
    : pick(config, "showThumbnailDesktop", "showThumbnailMobile", isMobile);

  if (!showThumbnail) {
    return "";
  }

  const placement = pick(
    config,
    "thumbnailPlacementDesktop",
    "thumbnailPlacementMobile",
    isMobile
  );

  if (!placement) {
    return "";
  }

  const sizeMode = pick(
    config,
    "thumbnailSizeModeDesktop",
    "thumbnailSizeModeMobile",
    isMobile
  );

  const maxWidth = pick(
    config,
    "thumbnailAutoFitMaxWidthDesktop",
    "thumbnailAutoFitMaxWidthMobile",
    isMobile
  );

  const widthPercent = pick(
    config,
    "thumbnailSizePercentDesktop",
    "thumbnailSizePercentMobile",
    isMobile
  );

  const topBottomHeight = pick(
    config,
    "thumbnailHeightTopBottomDesktop",
    "thumbnailHeightTopBottomMobile",
    isMobile
  );

  let style = "";

  if (placement === "left" || placement === "right") {
    if (sizeMode === "manual") {
      style = `style="width:${Number(widthPercent) || 15}%;"`;
    } else {
      style = `style="max-width:${escapeHTML(String(maxWidth || "10rem"))};"`;
    }
  } else if (placement === "top" || placement === "bottom") {
    style = `style="height:${escapeHTML(String(topBottomHeight || "auto"))};"`;
  }

  return `
    <div class="topic-hover-card__thumb topic-hover-card__thumb--${escapeHTML(
      placement
    )} topic-hover-card__thumb--${escapeHTML(sizeMode || "auto_fit_height")}" ${style}>
      <img
        src="${safeImage}"
        alt="${escapeHTML(title || "Preview image")}"
        loading="lazy"
        decoding="async"
      >
    </div>
  `;
}

function buildMetaRow(items) {
  const filtered = items.filter(Boolean);

  if (!filtered.length) {
    return "";
  }

  return `<div class="topic-hover-card__meta">${filtered.join("")}</div>`;
}

function buildMetaItem(label, value, extraClass = "") {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return `<span class="topic-hover-card__meta-item ${extraClass}"><span class="topic-hover-card__meta-label">${escapeHTML(
    label
  )}:</span> ${escapeHTML(String(value))}</span>`;
}

function buildTopicCategoryHTML(category, categories, config, isMobile) {
  const showCategory = pick(
    config,
    "showCategoryDesktop",
    "showCategoryMobile",
    isMobile
  );

  if (!showCategory || !category) {
    return "";
  }

  const categoryName =
    category?.name ||
    categories?.find?.((c) => Number(c.id) === Number(category?.id))?.name ||
    "";

  if (!categoryName) {
    return "";
  }

  return `<span class="topic-hover-card__badge topic-hover-card__category">${escapeHTML(
    categoryName
  )}</span>`;
}

function buildTagsHTML(tags, config, isMobile) {
  const showTags = pick(config, "showTagsDesktop", "showTagsMobile", isMobile);

  if (!showTags || !Array.isArray(tags) || !tags.length) {
    return "";
  }

  return `
    <div class="topic-hover-card__tags">
      ${tags
        .filter(Boolean)
        .slice(0, 5)
        .map(
          (tag) =>
            `<span class="topic-hover-card__badge topic-hover-card__tag">${escapeHTML(
              String(tag)
            )}</span>`
        )
        .join("")}
    </div>
  `;
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
      safeAvatarURL(preview?.author?.avatarTemplate || preview?.avatar_template, 48)
  );

  return `
    <div class="topic-hover-card__author">
      ${
        avatarUrl
          ? `<img class="topic-hover-card__author-avatar" src="${avatarUrl}" alt="" loading="lazy" decoding="async">`
          : ""
      }
      <span class="topic-hover-card__author-name">${escapeHTML(username)}</span>
    </div>
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

  return `
    <div class="topic-hover-card__excerpt" style="-webkit-line-clamp:${Number(lines) || 3};">
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

  return `<div class="topic-hover-card__title">${escapeHTML(title)}</div>`;
}

function buildTopicPreviewHTML(preview, _provider, categories, config, isMobile) {
  const { rootAttrs } = buildProviderRootAttrs(preview, config, "topic");
  const title = preview?.title || "";
  const imageUrl = preview?.imageUrl || preview?.thumbnail || preview?.image || "";
  const category = preview?.category || preview?.raw?.category || null;
  const tags = preview?.tags || preview?.raw?.tags || [];

  const showPublishDate = pick(
    config,
    "showPublishDateDesktop",
    "showPublishDateMobile",
    isMobile
  );
  const showViews = pick(config, "showViewsDesktop", "showViewsMobile", isMobile);
  const showReplyCount = pick(
    config,
    "showReplyCountDesktop",
    "showReplyCountMobile",
    isMobile
  );
  const showLikes = pick(config, "showLikesDesktop", "showLikesMobile", isMobile);
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
  const thumbHtml = buildSharedThumbnailHTML(imageUrl, title, config, isMobile);
  const authorHtml = buildAuthorHTML(preview, config, isMobile);
  const excerptHtml = buildExcerptHTML(preview, config, isMobile);

  const metaBottom = buildMetaRow([
    showPublishDate
      ? buildMetaItem("Created", preview?.createdAt || preview?.created_at)
      : "",
    showActivity
      ? buildMetaItem(
          "Activity",
          preview?.lastPostedAt ||
            preview?.bumpedAt ||
            preview?.last_posted_at ||
            preview?.bumped_at
        )
      : "",
    showViews ? buildMetaItem("Views", formatNumber(preview?.views || 0)) : "",
    showReplyCount
      ? buildMetaItem(
          "Replies",
          formatNumber(
            preview?.replyCount ??
              preview?.postsCount ??
              preview?.reply_count ??
              0
          )
        )
      : "",
    showLikes
      ? buildMetaItem(
          "Likes",
          formatNumber(preview?.likeCount ?? preview?.like_count ?? 0)
        )
      : "",
  ]);

  return `
    <article class="${buildCardClasses(
      preview,
      config,
      isMobile
    )}" ${rootAttrs}>
      ${thumbHtml}
      <div class="topic-hover-card__body">
        ${metaTop}
        ${buildTitleHTML(preview, config, isMobile)}
        ${excerptHtml}
        ${tagsHtml}
        ${authorHtml}
        ${metaBottom}
      </div>
    </article>
  `;
}

function buildWikipediaPreviewHTML(preview, _provider, config, isMobile) {
  const { rootAttrs } = buildProviderRootAttrs(preview, config, "wikipedia");
  const title = preview?.title || preview?.pageKey || "Wikipedia";
  const imageUrl =
    preview?.imageUrl ||
    preview?.imageUlr ||
    preview?.thumbnail ||
    preview?.raw?.summary?.thumbnail?.source ||
    preview?.raw?.summary?.originalimage?.source ||
    "";
  const host = preview?.host || "wikipedia.org";

  const thumbHtml = buildSharedThumbnailHTML(imageUrl, title, config, isMobile);
  const excerptHtml = buildExcerptHTML(preview, config, isMobile);
  const metaHtml = buildMetaRow([buildMetaItem("Source", host)]);

  return `
    <article class="${buildCardClasses(
      preview,
      config,
      isMobile
    )}" ${rootAttrs}>
      ${thumbHtml}
      <div class="topic-hover-card__body">
        ${metaHtml}
        ${buildTitleHTML(preview, config, isMobile)}
        ${excerptHtml}
      </div>
    </article>
  `;
}

function buildExternalPreviewHTML(preview, _provider, config, isMobile) {
  const { rootAttrs } = buildProviderRootAttrs(preview, config, "external");
  const title = preview?.title || preview?.hostname || preview?.url || "External link";
  const imageUrl = preview?.imageUrl || preview?.thumbnail || preview?.image || "";
  const description =
    preview?.excerpt || preview?.description || preview?.siteName || "";

  const thumbHtml = buildSharedThumbnailHTML(imageUrl, title, config, isMobile);

  const normalizedPreview = {
    ...preview,
    title,
    excerpt: description,
  };

  const excerptHtml = buildExcerptHTML(normalizedPreview, config, isMobile);

  const metaHtml = buildMetaRow([
    buildMetaItem("Site", preview?.siteName || preview?.hostname),
    buildMetaItem("URL", preview?.displayUrl || preview?.url),
  ]);

  return `
    <article class="${buildCardClasses(
      preview,
      config,
      isMobile
    )}" ${rootAttrs}>
      ${thumbHtml}
      <div class="topic-hover-card__body">
        ${metaHtml}
        ${buildTitleHTML(normalizedPreview, config, isMobile)}
        ${excerptHtml}
      </div>
    </article>
  `;
}
