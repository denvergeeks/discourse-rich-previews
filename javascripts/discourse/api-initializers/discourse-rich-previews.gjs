import { later, cancel } from "@ember/runloop";
import { iconHTML } from "discourse/lib/icon-library";
import { apiInitializer } from "discourse/lib/api";

import {
  DELAY_HIDE,
  VIEWPORT_MARGIN,
  TOOLTIP_ID,
  TOOLTIP_SELECTOR,
  readConfig,
  logDebug,
  sanitizeURL,
  createViewportState,
  getCachedValue,
  setCachedValue,
  getJSON,
  linkInSupportedArea,
  normalizedFieldKeyVariants,
  findTruthyFieldMatch,
  currentUserIsStaffLike,
  escapeHTML,
  safeAvatarURL,
  sanitizeExcerpt,
  normalizeTag,
  formatNumber,
} from "../lib/rich-preview-utils";

import { matchPreviewTarget } from "../lib/preview-router";
import {
  buildPreviewHTML,
  buildLoadingPreviewHTML,
  buildErrorPreviewHTML,
} from "../lib/preview-renderer";
import { createTopicProvider } from "../lib/providers/topic-provider";
import { createWikipediaProvider } from "../lib/providers/wikipedia-provider";

function discourseIcon(name) {
  try {
    return iconHTML(name) || "";
  } catch {
    return "";
  }
}

function joinMetadataGroups(items, separator = "·") {
  const filtered = items.filter(Boolean);
  if (!filtered.length) return "";

  return filtered
    .map((item, index) =>
      index === 0
        ? item
        : `<span class="topic-hover-card__sep">${escapeHTML(separator)}</span>${item}`
    )
    .join("");
}

function getSiteCategories(api) {
  return api.container.lookup("service:site")?.categories || [];
}

function findCategoryById(categories, categoryId) {
  if (!categories?.length || !categoryId) return null;
  return categories.find((c) => Number(c.id) === Number(categoryId)) || null;
}

function pick(config, desktopKey, mobileKey, isMobile) {
  return isMobile ? config[mobileKey] : config[desktopKey];
}

function buildThumbnailHTML(topic, config, isMobile = false) {
  const imageUrl = sanitizeURL(topic.image_url);
  if (!imageUrl) {
    return "";
  }

  const thumbHeight = pick(
    config,
    "thumbnailHeightTopBottomDesktop",
    "thumbnailHeightTopBottomMobile",
    isMobile
  );

  return `
    <div class="topic-hover-card__thumb-wrap">
      <div
        class="topic-hover-card__thumb-bg"
        style="background-image: url('${escapeHTML(imageUrl)}');"
        aria-hidden="true"
      ></div>
      <img
        class="topic-hover-card__thumb"
        src="${escapeHTML(imageUrl)}"
        alt=""
        loading="lazy"
        decoding="async"
        style="--thc-thumb-top-bottom-height:${escapeHTML(thumbHeight || "auto")};"
      >
    </div>
  `;
}

function buildCategoryHTML(topic, categories, config, isMobile) {
  if (!pick(config, "showCategoryDesktop", "showCategoryMobile", isMobile)) {
    return "";
  }

  if (!topic.category_id) return "";

  const category = findCategoryById(categories, topic.category_id);
  const name =
    category?.name ||
    category?.slug ||
    topic.category_name ||
    topic.category_slug ||
    "";

  const rawColor = category?.color || topic.category_color || null;
  const color = rawColor ? `#${String(rawColor).replace(/^#/, "")}` : null;

  if (!name) return "";

  return `
    <span class="topic-hover-card__badge topic-hover-card__badge--category"${
      color ? ` style="--thc-category-color:${escapeHTML(color)};"` : ""
    }>
      ${escapeHTML(name)}
    </span>
  `;
}

function buildTagsHTML(topic, config, isMobile) {
  if (!pick(config, "showTagsDesktop", "showTagsMobile", isMobile)) return "";
  if (!Array.isArray(topic.tags) || !topic.tags.length) return "";

//  logDebug(config, "Raw topic tags", topic.tags);

  const tags = topic.tags.map(normalizeTag).filter(Boolean);

//  logDebug(config, "Normalized tags", tags);

  if (!tags.length) return "";

  return `
    <div class="topic-hover-card__tags">
      ${tags
        .map(
          (tag) => `
            <span class="topic-hover-card__badge topic-hover-card__badge--tag">
              ${escapeHTML(tag)}
            </span>
          `
        )
        .join("")}
    </div>
  `;
}

function buildBadgesHTML(topic, categories, config, isMobile) {
  const categoryHTML = buildCategoryHTML(topic, categories, config, isMobile);
  const tagsHTML = buildTagsHTML(topic, config, isMobile);

  if (!categoryHTML && !tagsHTML) return "";

  return `
    <div class="topic-hover-card__badges">
      ${categoryHTML}
      ${tagsHTML}
    </div>
  `;
}

function buildTitleHTML(topic, config, isMobile) {
  if (!pick(config, "showTitleDesktop", "showTitleMobile", isMobile)) return "";
  const title = topic.fancy_title ?? topic.title ?? "(no title)";

  return `
    <h3 class="topic-hover-card__title">
      ${escapeHTML(title)}
    </h3>
  `;
}

function buildExcerptHTML(topic, config, isMobile) {
  if (!pick(config, "showExcerptDesktop", "showExcerptMobile", isMobile)) {
    return "";
  }

  const lines = pick(
    config,
    "excerptLengthDesktop",
    "excerptLengthMobile",
    isMobile
  );

  const firstPost = topic.post_stream?.posts?.[0];
  const excerptSource =
    topic.excerpt || firstPost?.excerpt || firstPost?.cooked || "";

  const cleanedExcerpt = topic.__thc_excerpt ?? sanitizeExcerpt(excerptSource);
  topic.__thc_excerpt = cleanedExcerpt;

  const finalExcerpt = cleanedExcerpt.length >= 20 ? cleanedExcerpt : "";
  if (!finalExcerpt) return "";

  // Estimate whether the excerpt will overflow the wrap-excerpt
  // height cap. At ~32rem card width, roughly 90 characters fit
  // per line at excerpt font size. If the excerpt is longer than
  // one line's worth of characters, it is likely to be truncated
  // by the max-height cap and the fade is appropriate.
  // If it fits in a single line, the fade is skipped.
  const CHARS_PER_LINE = 90;
  const isLikelyMultiLine = finalExcerpt.length > CHARS_PER_LINE;
  const overflowClass = isLikelyMultiLine
    ? " topic-hover-card__excerpt--overflows"
    : "";

  return `
    <div
      class="topic-hover-card__excerpt${overflowClass}"
      style="--thc-excerpt-lines:${escapeHTML(String(lines))};"
    >
      ${escapeHTML(finalExcerpt)}
    </div>
  `;
}

function buildOpHTML(topic, config, isMobile) {
  if (!pick(config, "showOpDesktop", "showOpMobile", isMobile)) return "";

  const op =
    topic.details?.created_by ||
    (topic.post_stream?.posts?.[0]?.username && {
      username: topic.post_stream.posts[0].username,
      avatar_template: topic.post_stream.posts[0].avatar_template,
    }) ||
    topic.posters?.[0]?.user;

  if (!op?.username) return "";

  const avatarUrl =
    topic.op_avatar_url ||
    safeAvatarURL(topic.posters?.[0]?.avatar_template, 24);
  const avatarImg = avatarUrl
    ? `<img class="topic-hover-card__op-avatar" src="${escapeHTML(
        avatarUrl
      )}" alt="" loading="lazy" decoding="async" />`
    : "";

  return `
    <span class="topic-hover-card__meta-item topic-hover-card__meta-item--op">
      ${avatarImg}
      <span>${escapeHTML(op.username)}</span>
    </span>
  `;
}

function buildPublishDateHTML(topic, config, isMobile) {
  if (!pick(config, "showPublishDateDesktop", "showPublishDateMobile", isMobile)) {
    return "";
  }

  if (!topic.created_at) return "";
  const d = new Date(topic.created_at);
  if (Number.isNaN(d.getTime())) return "";

  const fmt = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return `
    <span class="topic-hover-card__meta-item topic-hover-card__meta-item--date">
      ${escapeHTML(fmt)}
    </span>
  `;
}

function buildStatsHTML(topic, config, isMobile) {
  const stats = [];

  if (pick(config, "showViewsDesktop", "showViewsMobile", isMobile)) {
    stats.push(`
      <span class="topic-hover-card__stat">
        ${discourseIcon("far-eye")}
        <span>${escapeHTML(formatNumber(topic.views))}</span>
      </span>
    `);
  }

  if (pick(config, "showReplyCountDesktop", "showReplyCountMobile", isMobile)) {
    const replyCount = topic.reply_count ?? Math.max((topic.posts_count ?? 1) - 1, 0);
    stats.push(`
      <span class="topic-hover-card__stat">
        ${discourseIcon("comment")}
        <span>${escapeHTML(formatNumber(replyCount))}</span>
      </span>
    `);
  }

  if (pick(config, "showLikesDesktop", "showLikesMobile", isMobile)) {
    const likes = topic.like_count ?? topic.topic_post_like_count ?? 0;
    stats.push(`
      <span class="topic-hover-card__stat">
        ${discourseIcon("heart")}
        <span>${escapeHTML(formatNumber(likes))}</span>
      </span>
    `);
  }

  if (
    pick(config, "showActivityDesktop", "showActivityMobile", isMobile) &&
    topic.last_posted_at
  ) {
    const d = new Date(topic.last_posted_at);
    if (!Number.isNaN(d.getTime())) {
      const fmt = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      stats.push(`
        <span class="topic-hover-card__stat">
          ${discourseIcon("clock")}
          <span>${escapeHTML(fmt)}</span>
        </span>
      `);
    }
  }

  return stats.length
    ? `<span class="topic-hover-card__meta-item topic-hover-card__meta-item--stats">${stats.join(
        ""
      )}</span>`
    : "";
}

function buildMetadataHTML(topic, config, isMobile) {
  const content = joinMetadataGroups([
    buildOpHTML(topic, config, isMobile),
    buildPublishDateHTML(topic, config, isMobile),
    buildStatsHTML(topic, config, isMobile),
  ]);

  return content
    ? `
      <div class="topic-hover-card__meta">
        ${content}
      </div>
    `
    : "";
}

function buildMobileActionsHTML(topic, isMobile) {
  if (!isMobile) return "";

  const slug = escapeHTML(String(topic.slug || topic.id || ""));
  const id = escapeHTML(String(topic.id || ""));
  const topicUrl = sanitizeURL(
    `${window.location.origin}/t/${slug}/${id}`
  );

  return `
    <div class="topic-hover-card__actions topic-hover-card__actions--mobile">
      <a
        class="btn btn-primary topic-hover-card__open-topic"
        href="${escapeHTML(topicUrl || "#")}"
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
  `;
}

function buildCardHTML(topic, categories, config, isMobile = false) {
  const showThumbnail = pick(
    config,
    "showThumbnailDesktop",
    "showThumbnailMobile",
    isMobile
  );

  const placement = pick(
    config,
    "thumbnailPlacementDesktop",
    "thumbnailPlacementMobile",
    isMobile
  );

  const density = pick(config, "densityDesktop", "densityMobile", isMobile);
  const densityClass = `topic-hover-card--density-${density}`;

  const sizeMode = pick(
    config,
    "thumbnailSizeModeDesktop",
    "thumbnailSizeModeMobile",
    isMobile
  );

  const hasImage = !!sanitizeURL(topic.image_url);
  const isWrapExcerpt = sizeMode === "wrap_excerpt" && hasImage;

  const sizeModeClass =
    sizeMode === "auto_fit_height"
      ? "topic-hover-card--thumb-size-auto-fit-height"
      : sizeMode === "wrap_excerpt"
      ? "topic-hover-card--thumb-size-wrap-excerpt"
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
    hasImage && showThumbnail ? buildThumbnailHTML(topic, config, isMobile) : "";

  const outerThumbnail = isWrapExcerpt ? "" : thumbnail;

  const excerptHTML = buildExcerptHTML(topic, config, isMobile);

  const wrappedExcerptHTML =
    isWrapExcerpt && thumbnail && excerptHTML
      ? `
        <div class="topic-hover-card__excerpt-wrap topic-hover-card__excerpt-wrap--${escapeHTML(
          placement
        )}">
          ${thumbnail}
          ${excerptHTML}
        </div>
      `
      : excerptHTML;

  const bodyInner = `
    <div class="topic-hover-card__body">
      ${mobileCloseButton}
      ${buildTitleHTML(topic, config, isMobile)}
      ${wrappedExcerptHTML}
      ${buildMetadataHTML(topic, config, isMobile)}
      ${buildBadgesHTML(topic, categories, config, isMobile)}
      ${buildMobileActionsHTML(topic, isMobile)}
    </div>
  `;

  const wrapperStyle = `
    --thc-thumbnail-size-percent:${escapeHTML(String(thumbnailPercent ?? 15))};
    --thc-auto-thumb-max-width:${escapeHTML(autoFitMaxWidth || "10rem")};
    --thc-thumb-top-bottom-height:${escapeHTML(topBottomHeight || "auto")};
  `;

  switch (placement) {
    case "left":
      return `
        <div
          class="topic-hover-card topic-hover-card--topic topic-hover-card--left ${densityClass} ${sizeModeClass}"
          style="${wrapperStyle}"
        >
          ${outerThumbnail}
          ${bodyInner}
        </div>
      `;
    case "right":
      return `
        <div
          class="topic-hover-card topic-hover-card--topic topic-hover-card--right ${densityClass} ${sizeModeClass}"
          style="${wrapperStyle}"
        >
          ${bodyInner}
          ${outerThumbnail}
        </div>
      `;
    case "bottom":
      return `
        <div
          class="topic-hover-card topic-hover-card--topic topic-hover-card--bottom ${densityClass} ${sizeModeClass}"
          style="${wrapperStyle}"
        >
          ${bodyInner}
          ${outerThumbnail}
        </div>
      `;
    case "top":
    default:
      return `
        <div
          class="topic-hover-card topic-hover-card--topic topic-hover-card--top ${densityClass} ${sizeModeClass}"
          style="${wrapperStyle}"
        >
          ${outerThumbnail}
          ${bodyInner}
        </div>
      `;
  }
}

export default apiInitializer((api) => {
  const config = readConfig(settings);

  if (!config.enabled) return;

  const categories = getSiteCategories(api);
  const currentUser = api.getCurrentUser?.() || null;
  const viewport = createViewportState();

  let tooltip = null;
  let showTimer = null;
  let hideTimer = null;
  let clearSuppressionTimer = null;
  let currentPreviewKey = null;
  let currentAbortController = null;
  let currentAnchor = null;
  let isInsideCard = false;
  let suppressNextClick = false;
  let resolvedUserFieldId = null;
  let resolvedUserFieldIdPromise = null;

  const topicCache = new Map();
  const renderCache = new Map();
  const previewCache = new Map();
  const inFlightFetches = new Map();
  const cleanupFns = [];

  const topicProvider = createTopicProvider(
    api,
    config,
    topicCache,
    inFlightFetches
  );

  const wikipediaProvider = createWikipediaProvider(
    config,
    previewCache,
    inFlightFetches
  );

  function addCleanup(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    cleanupFns.push(() => target.removeEventListener(type, handler, options));
  }

  function runCleanup() {
    cancel(showTimer);
    cancel(hideTimer);
    cancel(clearSuppressionTimer);

    try {
      currentAbortController?.abort();
    } catch {
      // no-op
    }

    while (cleanupFns.length) {
      const fn = cleanupFns.pop();
      try {
        fn?.();
      } catch {
        // no-op
      }
    }
  }

  function ensureTooltip() {
    if (tooltip?.isConnected) return;

    tooltip = document.querySelector(TOOLTIP_SELECTOR);

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = TOOLTIP_ID;
      tooltip.setAttribute("role", "tooltip");
      tooltip.setAttribute("aria-live", "polite");
      document.body.appendChild(tooltip);

      cleanupFns.push(() => {
        if (tooltip?.isConnected) tooltip.remove();
        tooltip = null;
      });
    }

    tooltip.style.setProperty("--thc-width", config.cardWidth);
    tooltip.style.setProperty(
      "--thc-mobile-width",
      `${config.mobileWidthPercent}vw`
    );
  }

  function positionTooltip(anchorRect) {
    if (!tooltip) return;

    if (viewport.isMobileInteractionMode()) {
      const left = Math.max(
        VIEWPORT_MARGIN,
        (window.innerWidth - tooltip.offsetWidth) / 2
      );
      const top = Math.max(VIEWPORT_MARGIN, 16);
      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
      tooltip.classList.remove("is-above");

      if (currentAnchor) {
        currentAnchor.setAttribute("aria-describedby", TOOLTIP_ID);
      }
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardH = tooltip.offsetHeight || 320;
    const cardW = Math.min(
      tooltip.offsetWidth || 512,
      vw - VIEWPORT_MARGIN * 2
    );

    const gapBelow = 10;
    const gapAbove = 4;

    let top = anchorRect.bottom + gapBelow;
    let isAbove = false;

    if (top + cardH > vh - VIEWPORT_MARGIN) {
      top = anchorRect.top - cardH - gapAbove;
      isAbove = true;
    }

    top = Math.max(VIEWPORT_MARGIN, top);

    let left = anchorRect.left;
    if (left + cardW > vw - VIEWPORT_MARGIN) {
      left = vw - cardW - VIEWPORT_MARGIN;
    }
    left = Math.max(VIEWPORT_MARGIN, left);

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.classList.toggle("is-above", isAbove);

    if (currentAnchor) {
      currentAnchor.setAttribute("aria-describedby", TOOLTIP_ID);
    }
  }

  function positionTooltipNextFrame(anchorRect) {
    requestAnimationFrame(() => positionTooltip(anchorRect));
  }

  function getRenderCacheKey(preview, isMobile) {
    return `${preview.type}:${preview.id}:${isMobile ? "mobile" : "desktop"}`;
  }

  function getRenderedCard(preview, isMobile) {
    const key = getRenderCacheKey(preview, isMobile);
    const cached = getCachedValue(renderCache, key);
    if (cached) return cached;

    let html;

    if (preview.type === "topic" && preview.raw) {
      html = buildCardHTML(preview.raw, categories, config, isMobile);
    } else {
      html = buildPreviewHTML(preview, categories, config, isMobile);
    }

    setCachedValue(renderCache, key, html, config.topicCacheMax * 2);
    return html;
  }

  function abortCurrentRequest() {
    try {
      currentAbortController?.abort();
    } catch {
      // no-op
    }
    currentAbortController = null;
  }

  function clearCurrentAnchorDescription() {
    if (currentAnchor?.removeAttribute) {
      currentAnchor.removeAttribute("aria-describedby");
    }
    currentAnchor = null;
  }

  function hideCard() {
    abortCurrentRequest();

    if (!tooltip) return;

    tooltip.classList.remove("is-visible");
    clearCurrentAnchorDescription();

    later(() => {
      if (!tooltip?.classList.contains("is-visible")) {
        currentPreviewKey = null;
      }
    }, 300);
  }

  function scheduleHide() {
    cancel(hideTimer);
    hideTimer = later(() => {
      if (!isInsideCard) hideCard();
      suppressNextClick = false;
    }, DELAY_HIDE);
  }

  function scheduleShow(target, anchorRect, anchorEl) {
    cancel(showTimer);
    cancel(hideTimer);

    showTimer = later(() => {
      currentAnchor = anchorEl || null;
      showCard(target, anchorRect);
    }, config.delayShow);
  }

  function resetSuppressedClickSoon() {
    cancel(clearSuppressionTimer);
    clearSuppressionTimer = later(() => {
      suppressNextClick = false;
    }, 700);
  }

  async function fetchPreview(target, signal) {
    if (!target) return null;

    if (target.type === "topic") {
      return topicProvider.fetch(target, signal);
    }

    if (target.type === "wikipedia") {
      return wikipediaProvider.fetch(target, signal);
    }

    return null;
  }

  function showCard(target, anchorRect) {
    ensureTooltip();
    cancel(hideTimer);

    if (
      currentPreviewKey === target.key &&
      tooltip.classList.contains("is-visible")
    ) {
      positionTooltipNextFrame(anchorRect);
      return;
    }

    abortCurrentRequest();
    currentAbortController = new AbortController();
    currentPreviewKey = target.key;

    tooltip.innerHTML = buildLoadingPreviewHTML();
    tooltip.classList.add("is-visible");
    positionTooltipNextFrame(anchorRect);

    fetchPreview(target, currentAbortController.signal)
      .then((preview) => {
        if (!tooltip || currentPreviewKey !== target.key) {
          return;
        }

        if (!preview) {
          tooltip.innerHTML = buildErrorPreviewHTML("No preview available.");
          positionTooltipNextFrame(anchorRect);
          return;
        }

        tooltip.innerHTML = getRenderedCard(
          preview,
          viewport.isMobileLayout()
        );
        positionTooltipNextFrame(anchorRect);
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;

        console.error("[discourse-rich-previews] Could not load preview", {
          target,
          error,
        });
        logDebug(config, "Could not load preview", { target, error });

        if (!tooltip || currentPreviewKey !== target.key) return;

        tooltip.innerHTML = buildErrorPreviewHTML("Could not load preview.");
        positionTooltipNextFrame(anchorRect);
      });
  }

  async function resolveUserFieldIdForAdmins() {
    if (!config.resolveUserFieldIdForAdmins) return null;
    if (!currentUserIsStaffLike(currentUser)) return null;
    if (!config.userPreferenceFieldName) return null;

    const raw = String(config.userPreferenceFieldName).trim();
    if (/^\d+$/.test(raw)) return raw;
    if (/^user_field_\d+$/i.test(raw)) return raw.match(/\d+/)?.[0] ?? null;

    if (resolvedUserFieldId !== null) return resolvedUserFieldId;
    if (resolvedUserFieldIdPromise) return resolvedUserFieldIdPromise;

    resolvedUserFieldIdPromise = getJSON("/admin/config/user-fields.json")
      .then((result) => {
        const fields = Array.isArray(result) ? result : result?.user_fields || [];
        const wanted = raw.toLowerCase();

        const match = fields.find((field) => {
          const id = field?.id;
          const name = String(field?.name || "")
            .trim()
            .toLowerCase();

          return (
            name === wanted ||
            `user_field_${id}` === wanted ||
            String(id) === wanted
          );
        });

        resolvedUserFieldId = match?.id ?? null;
        return resolvedUserFieldId;
      })
      .catch((error) => {
        logDebug(
          config,
          "Could not resolve user-field ID from admin endpoint",
          error
        );
        resolvedUserFieldId = null;
        return null;
      })
      .finally(() => {
        resolvedUserFieldIdPromise = null;
      });

    return resolvedUserFieldIdPromise;
  }

  async function fetchFullCurrentUser() {
    if (!currentUser?.username) return null;

    try {
      const store = api.container.lookup("service:store");
      return (await store.find("user", currentUser.username)) || null;
    } catch (error) {
      logDebug(config, "Could not fetch full current user record", error);
      return null;
    }
  }

  async function hoverCardsDisabledForUser() {
    if (!currentUser || !config.userPreferenceFieldName) return false;

    const directCandidates = normalizedFieldKeyVariants(
      config.userPreferenceFieldName
    );

    const currentUserCustomFields = currentUser?.custom_fields || {};
    const currentUserUserFields = currentUser?.user_fields || {};

    let match =
      findTruthyFieldMatch(currentUserCustomFields, directCandidates) ||
      findTruthyFieldMatch(currentUserUserFields, directCandidates);

    if (match) return true;

    const resolvedId = await resolveUserFieldIdForAdmins();
    const resolvedCandidates = resolvedId
      ? normalizedFieldKeyVariants(resolvedId)
      : [];

    if (resolvedCandidates.length) {
      match =
        findTruthyFieldMatch(currentUserCustomFields, resolvedCandidates) ||
        findTruthyFieldMatch(currentUserUserFields, resolvedCandidates);

      if (match) return true;
    }

    const fullUser = await fetchFullCurrentUser();
    const fullUserFields = fullUser?.user_fields || {};
    const fullUserCustomFields = fullUser?.custom_fields || {};

    match =
      findTruthyFieldMatch(fullUserFields, directCandidates) ||
      findTruthyFieldMatch(fullUserCustomFields, directCandidates);

    if (match) return true;

    if (resolvedCandidates.length) {
      match =
        findTruthyFieldMatch(fullUserFields, resolvedCandidates) ||
        findTruthyFieldMatch(fullUserCustomFields, resolvedCandidates);

      if (match) return true;
    }

    return false;
  }

  function onTooltipMouseEnter() {
    isInsideCard = true;
    cancel(hideTimer);
  }

  function onTooltipMouseLeave() {
    isInsideCard = false;
    scheduleHide();
  }

  function onTooltipClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const inCard = target.closest(".topic-hover-card");
    if (!inCard) return;

    const closeBtn = target.closest("[data-thc-close]");
    if (closeBtn) {
      event.preventDefault();
      event.stopPropagation();
      suppressNextClick = false;
      hideCard();
      return;
    }

    const openBtn = target.closest("[data-thc-open-topic]");
    if (openBtn) {
      suppressNextClick = false;
      event.stopPropagation();
      hideCard();
      return;
    }

    if (viewport.isMobileInteractionMode()) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function onMouseOver(event) {
    if (viewport.isMobileInteractionMode()) return;
    if (!(event.target instanceof Element)) return;

    const link = event.target.closest("a[href]");
    if (!link || !linkInSupportedArea(link, config)) return;

    const target = matchPreviewTarget(link, config);
    if (!target) return;

    scheduleShow(target, link.getBoundingClientRect(), link);
  }

  function onMouseOut(event) {
    if (viewport.isMobileInteractionMode()) return;
    if (!(event.target instanceof Element)) return;

    const link = event.target.closest("a[href]");
    if (!link || !linkInSupportedArea(link, config)) return;

    scheduleHide();
  }

  function onTouchStart(event) {
    if (!viewport.isMobileInteractionMode() || !config.mobileEnabled) return;
    if (!(event.target instanceof Element)) return;
    if (event.target.closest(TOOLTIP_SELECTOR)) return;

    const link = event.target.closest("a[href]");
    if (!link || !linkInSupportedArea(link, config)) return;

    const target = matchPreviewTarget(link, config);
    if (!target) return;

    currentAnchor = link;
    event.preventDefault();
    event.stopPropagation();
    suppressNextClick = true;
    resetSuppressedClickSoon();
    showCard(target, link.getBoundingClientRect());
  }

  function onDocumentClick(event) {
    if (!viewport.isMobileInteractionMode() || !config.mobileEnabled) return;
    if (!(event.target instanceof Element)) return;

    if (event.target.closest("[data-thc-open-topic]")) {
      suppressNextClick = false;
      return;
    }

    if (suppressNextClick) {
      const link = event.target.closest("a[href]");
      if (
        link &&
        linkInSupportedArea(link, config) &&
        matchPreviewTarget(link, config)
      ) {
        event.preventDefault();
        event.stopPropagation();
        suppressNextClick = false;
        return;
      }
    }

    if (event.target.closest(TOOLTIP_SELECTOR)) return;

    if (tooltip?.classList.contains("is-visible")) hideCard();
    suppressNextClick = false;
  }

  function onScroll(event) {
    if (event.target?.closest?.(`.topic-hover-card, ${TOOLTIP_SELECTOR}`)) {
      return;
    }

    cancel(showTimer);
    hideCard();
    suppressNextClick = false;
  }

  function onResize() {
    if (tooltip?.classList.contains("is-visible")) {
      hideCard();
    }
    suppressNextClick = false;
  }

  function bindEvents() {
    ensureTooltip();

    addCleanup(tooltip, "mouseenter", onTooltipMouseEnter);
    addCleanup(tooltip, "mouseleave", onTooltipMouseLeave);
    addCleanup(tooltip, "click", onTooltipClick);

    addCleanup(document, "mouseover", onMouseOver, { passive: true });
    addCleanup(document, "mouseout", onMouseOut, { passive: true });
    addCleanup(document, "touchstart", onTouchStart, { passive: false });
    addCleanup(document, "click", onDocumentClick, true);
    addCleanup(document, "scroll", onScroll, { passive: true, capture: true });
    addCleanup(window, "resize", onResize, { passive: true });
  }

  (async () => {
    const disabledForUser = await hoverCardsDisabledForUser();
    if (disabledForUser) {
      logDebug(config, "Hover cards disabled for current user");
      return;
    }

    bindEvents();

    api.onPageChange(() => {
      cancel(showTimer);
      cancel(hideTimer);
      cancel(clearSuppressionTimer);
      hideCard();
      currentPreviewKey = null;
      suppressNextClick = false;
      clearCurrentAnchorDescription();
    });

    logDebug(config, "Hover cards initialized", {
      mobileEnabled: config.mobileEnabled,
      topicCacheMax: config.topicCacheMax,
      configuredField: config.userPreferenceFieldName,
      currentViewportIsMobile: viewport.isMobileInteractionMode(),
      densityDesktop: config.densityDesktop,
      densityMobile: config.densityMobile,
      thumbnailPlacementDesktop: config.thumbnailPlacementDesktop,
      thumbnailPlacementMobile: config.thumbnailPlacementMobile,
      thumbnailSizeModeDesktop: config.thumbnailSizeModeDesktop,
      thumbnailSizeModeMobile: config.thumbnailSizeModeMobile,
      thumbnailSizePercentDesktop: config.thumbnailSizePercentDesktop,
      thumbnailSizePercentMobile: config.thumbnailSizePercentMobile,
      wikipediaPreviewsEnabled: config.wikipediaPreviewsEnabled,
      wikipediaPreviewsBaseUrl: config.wikipediaPreviewsBaseUrl,
    });
  })().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[discourse-rich-previews] Fatal init error:", error);
    runCleanup();
  });
});