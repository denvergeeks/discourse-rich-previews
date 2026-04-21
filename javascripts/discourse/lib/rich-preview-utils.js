export const DELAY_HIDE = 120;
export const VIEWPORT_MARGIN = 8;
export const TOOLTIP_ID = "discourse-rich-preview-tooltip";
export const TOOLTIP_SELECTOR = `#${TOOLTIP_ID}`;

function intSetting(value, fallback, min = null, max = null) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) {
    return fallback;
  }

  let result = n;

  if (min !== null && result < min) {
    result = min;
  }

  if (max !== null && result > max) {
    result = max;
  }

  return result;
}

function stringSetting(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const str = String(value).trim();
  return str.length ? str : fallback;
}

function cssEscape(value) {
  const str = String(value ?? "");

  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(str);
  }

  return str.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function normalizeListSetting(value) {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split("|")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

export function readConfig(settings) {
  return {
    enabled: settings.enabled !== false,
    debugMode: !!settings.debug_mode,

    delayShow: intSetting(settings.delay_show, 300, 0, 2000),
    cardWidth: stringSetting(settings.card_width, "32rem"),
    mobileWidthPercent: intSetting(settings.mobile_width_percent, 100, 70, 100),
    mobileEnabled: settings.mobile_enabled !== false,

    densityDesktop: stringSetting(settings.density, "default"),
    densityMobile: stringSetting(settings.density_mobile, "cozy"),

    wikipediaDensityDesktop: stringSetting(
      settings.wikipedia_density,
      "cozy"
    ),
    wikipediaDensityMobile: stringSetting(
      settings.wikipedia_density_mobile,
      "compact"
    ),

    showThumbnailDesktop: settings.show_thumbnail !== false,
    thumbnailPlacementDesktop: stringSetting(
      settings.thumbnail_placement,
      "left"
    ),
    thumbnailSizeModeDesktop: stringSetting(
      settings.thumbnail_size_mode,
      "auto_fit_height"
    ),
    thumbnailAutoFitMaxWidthDesktop: stringSetting(
      settings.thumbnail_auto_fit_max_width,
      "10rem"
    ),
    thumbnailSizePercentDesktop: intSetting(
      settings.thumbnail_size_percent,
      15,
      5,
      50
    ),

    showThumbnailMobile: settings.show_thumbnail_mobile !== false,
    thumbnailPlacementMobile: stringSetting(
      settings.thumbnail_placement_mobile,
      "top"
    ),
    thumbnailSizeModeMobile: stringSetting(
      settings.thumbnail_size_mode_mobile,
      "manual"
    ),
    thumbnailAutoFitMaxWidthMobile: stringSetting(
      settings.thumbnail_auto_fit_max_width_mobile,
      "8rem"
    ),
    thumbnailSizePercentMobile: intSetting(
      settings.thumbnail_size_percent_mobile,
      33,
      15,
      60
    ),

    thumbnailHeightTopBottomDesktop: stringSetting(
      settings.thumbnail_height_top_bottom,
      "auto"
    ),
    thumbnailHeightTopBottomMobile: stringSetting(
      settings.thumbnail_height_top_bottom_mobile,
      "auto"
    ),

    showTitleDesktop: settings.show_title !== false,
    showTitleMobile: settings.show_title_mobile !== false,

    showExcerptDesktop: settings.show_excerpt !== false,
    excerptLengthDesktop: intSetting(settings.excerpt_length, 3, 1, 12),

    showExcerptMobile: settings.show_excerpt_mobile !== false,
    excerptLengthMobile: intSetting(settings.excerpt_length_mobile, 3, 1, 12),

    showCategoryDesktop: settings.show_category !== false,
    showCategoryMobile: settings.show_category_mobile !== false,

    showTagsDesktop: settings.show_tags !== false,
    showTagsMobile: settings.show_tags_mobile !== false,

    showOpDesktop: settings.show_op !== false,
    showOpMobile: settings.show_op_mobile !== false,

    showPublishDateDesktop: settings.show_publish_date !== false,
    showPublishDateMobile: settings.show_publish_date_mobile !== false,

    showViewsDesktop: settings.show_views !== false,
    showViewsMobile: settings.show_views_mobile !== false,

    showReplyCountDesktop: settings.show_reply_count !== false,
    showReplyCountMobile: settings.show_reply_count_mobile !== false,

    showLikesDesktop: settings.show_likes !== false,
    showLikesMobile: settings.show_likes_mobile !== false,

    showActivityDesktop: settings.show_activity !== false,
    showActivityMobile: settings.show_activity_mobile !== false,

    enableOnTopicList: settings.enable_on_topic_list !== false,
    enableOnLatest: settings.enable_on_latest !== false,
    enableOnCategories: settings.enable_on_categories !== false,
    enableOnTags: settings.enable_on_tags !== false,
    enableOnSearch: settings.enable_on_search !== false,
    enableOnTopicPage: settings.enable_on_topic_page !== false,
    enableOnUserProfile: settings.enable_on_user_profile !== false,
    enableOnOther: settings.enable_on_other !== false,
    enableOnKanbanBoards: settings.enable_on_kanban_boards === true,

    includedTags: normalizeListSetting(settings.included_tags),
    includedClasses: normalizeListSetting(settings.included_classes),
    excludedTags: normalizeListSetting(settings.excluded_tags),
    excludedClasses: normalizeListSetting(settings.excluded_classes),

    wikipediaPreviewsEnabled:
      settings.wikipedia_previews_enabled !== false,
    wikipediaPreviewsBaseUrl: stringSetting(
      settings.wikipedia_previews_base_url,
      "en.wikipedia.org"
    ),
    wikipediaPreviewsShowImage:
      settings.wikipedia_previews_show_image !== false,
    wikipediaPreviewsUseExtractHtml:
      settings.wikipedia_previews_use_extract_html !== false,

    userPreferenceFieldName: stringSetting(
      settings.user_preference_field_name,
      ""
    ),
    resolveUserFieldIdForAdmins:
      settings.resolve_user_field_id_for_admins !== false,

    excerptExcludedSelectors: normalizeListSetting(
      settings.excerpt_excluded_selectors
    ),

    remoteDiscourseHosts: normalizeListSetting(
      settings.remote_discourse_hosts
    ).map((host) => String(host || "").trim().toLowerCase()),

    remoteDiscourseTimeoutMs: intSetting(
      settings.remote_discourse_timeout_ms,
      3000,
      250,
      10000
    ),

    remoteDiscourseRequireHttps:
      settings.remote_discourse_require_https !== false,

    topicCacheMax: intSetting(settings.topic_cache_max, 100, 10, 500),
  };
}

export function logDebug(config, message, data = null) {
  if (!config?.debugMode) {
    return;
  }

  if (data !== null && data !== undefined) {
    console.debug(`[topic-hover-cards] ${message}`, data);
  } else {
    console.debug(`[topic-hover-cards] ${message}`);
  }
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function sanitizeURL(url) {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(String(url), window.location.origin);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return "";
  }

  return "";
}

export function isElementVisible(el) {
  if (!(el instanceof Element)) {
    return false;
  }

  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function createViewportState() {
  return {
    isMobileLayout() {
      return window.matchMedia("(max-width: 767px)").matches;
    },
    isMobileInteractionMode() {
      return (
        window.matchMedia("(max-width: 767px)").matches ||
        window.matchMedia("(hover: none), (pointer: coarse)").matches
      );
    },
  };
}

export function getCachedValue(map, key) {
  if (!map?.has(key)) {
    return null;
  }

  const value = map.get(key);
  map.delete(key);
  map.set(key, value);
  return value;
}

export function setCachedValue(map, key, value, maxSize = 100) {
  if (!map) {
    return value;
  }

  if (map.has(key)) {
    map.delete(key);
  }

  map.set(key, value);

  while (map.size > maxSize) {
    const oldestKey = map.keys().next().value;
    map.delete(oldestKey);
  }

  return value;
}

export function getJSON(url, options = {}) {
  const parsedUrl = new URL(url, window.location.origin);
  const isCrossOrigin = parsedUrl.origin !== window.location.origin;

  return fetch(parsedUrl.toString(), {
    method: "GET",
    mode: isCrossOrigin ? "cors" : "same-origin",
    credentials: isCrossOrigin ? "omit" : "same-origin",
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
    signal: options.signal,
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${parsedUrl.toString()}`);
    }

    return response.json();
  });
}

export function inCookedPost(el) {
  return !!el?.closest?.(".cooked");
}

export function isCookedPostFragmentLink(link) {
  if (!(link instanceof HTMLAnchorElement)) {
    return false;
  }

  const href = link.getAttribute("href") || "";
  if (!href) {
    return false;
  }

  if (href.startsWith("#")) {
    return true;
  }

  try {
    const url = new URL(link.href, window.location.origin);
    return url.hash.length > 0;
  } catch {
    return false;
  }
}

export function parseTopicUrl(href) {
  if (!href) {
    return null;
  }

  try {
    const url = new URL(href, window.location.origin);

    if (url.origin !== window.location.origin) {
      return null;
    }

    const path = url.pathname.replace(/\/+$/, "");
    const match = path.match(/^\/t\/([^/]+)\/(\d+)(?:\/(\d+))?$/);

    if (!match) {
      return null;
    }

    return {
      slug: match[1],
      topicId: Number.parseInt(match[2], 10),
      postNumber: match[3] ? Number.parseInt(match[3], 10) : null,
      url,
      origin: url.origin,
      hostname: url.hostname,
      isRemote: false,
    };
  } catch {
    return null;
  }
}

export function currentTopicIdFromPage() {
  const bodyTopicId = document.body?.dataset?.topicId;
  if (bodyTopicId && /^\d+$/.test(bodyTopicId)) {
    return Number.parseInt(bodyTopicId, 10);
  }

  const topicEl = document.querySelector("[data-topic-id]");
  const topicId = topicEl?.getAttribute?.("data-topic-id");
  if (topicId && /^\d+$/.test(topicId)) {
    return Number.parseInt(topicId, 10);
  }

  const topicLink = parseTopicUrl(window.location.href);
  return topicLink?.topicId ?? null;
}

export function isCurrentTopicLink(link) {
  const parsed = parseTopicUrl(link?.href);
  const currentTopicId = currentTopicIdFromPage();

  return !!(
    parsed?.topicId &&
    currentTopicId &&
    parsed.topicId === currentTopicId
  );
}

export function topicIdFromHref(href) {
  return parseTopicUrl(href)?.topicId ?? null;
}

function matchesTagList(link, tags) {
  if (!link || !Array.isArray(tags) || !tags.length) {
    return null;
  }

  const selector = tags.join(", ");
  return selector ? link.closest(selector) : null;
}

function matchesClassList(link, classes) {
  if (!link || !Array.isArray(classes) || !classes.length) {
    return null;
  }

  const selector = classes.map((c) => `.${cssEscape(c)}`).join(", ");
  const ancestorMatch = selector ? link.closest(selector) : null;

  if (ancestorMatch) {
    return ancestorMatch;
  }

  for (const cls of link.classList) {
    if (classes.includes(String(cls).toLowerCase())) {
      return link;
    }
  }

  return null;
}

function matchesIncludedRules(link, config) {
  const includedTags = Array.isArray(config?.includedTags)
    ? config.includedTags
    : [];
  const includedClasses = Array.isArray(config?.includedClasses)
    ? config.includedClasses
    : [];

  if (!includedTags.length && !includedClasses.length) {
    return true;
  }

  return !!(
    matchesTagList(link, includedTags) ||
    matchesClassList(link, includedClasses)
  );
}

function matchesExcludedRules(link, config) {
  const excludedTags = Array.isArray(config?.excludedTags)
    ? config.excludedTags
    : [];
  const excludedClasses = Array.isArray(config?.excludedClasses)
    ? config.excludedClasses
    : [];

  const excludedTagMatch = matchesTagList(link, excludedTags);
  if (excludedTagMatch) {
    return {
      type: "tag",
      match: excludedTagMatch,
    };
  }

  const excludedClassMatch = matchesClassList(link, excludedClasses);
  if (excludedClassMatch) {
    return {
      type: "class",
      match: excludedClassMatch,
    };
  }

  return null;
}

export function isWikipediaArticleLink(link) {
  try {
    const url = new URL(link.href, window.location.origin);
    return (
      /(^|\.)wikipedia\.org$/i.test(url.hostname) &&
      url.pathname.startsWith("/wiki/")
    );
  } catch {
    return false;
  }
}

export function isEligiblePreviewLink(link, config) {
  if (!(link instanceof HTMLAnchorElement)) {
    return false;
  }

  if (link.closest(`.topic-hover-card, ${TOOLTIP_SELECTOR}`)) {
    return false;
  }

  if (!matchesIncludedRules(link, config)) {
    logDebug(config, "Skipping link due to include rules", {
      href: link.href,
    });
    return false;
  }

  const excluded = matchesExcludedRules(link, config);
  if (excluded) {
    if (excluded.type === "tag") {
      logDebug(config, "Skipping link due to excluded tag", {
        href: link.href,
        tagName: excluded.match?.tagName,
      });
    } else {
      logDebug(config, "Skipping link due to excluded class", {
        href: link.href,
        className: excluded.match?.className,
      });
    }
    return false;
  }

  if (isWikipediaArticleLink(link)) {
    return config?.wikipediaPreviewsEnabled !== false;
  }

  const parsed =
    parseTopicUrl(link.href) ||
    parseRemoteDiscourseTopicUrl(link.href, config);

  if (!parsed) {
    return false;
  }

  if (!parsed.isRemote && inCookedPost(link)) {
    if (isCurrentTopicLink(link)) {
      logDebug(config, "Skipping current-topic cooked-post link", {
        href: link.href,
      });
      return false;
    }

    if (isCookedPostFragmentLink(link)) {
      logDebug(config, "Skipping cooked-post fragment link", {
        href: link.href,
      });
      return false;
    }
  }

  return true;
}

export function linkInSupportedArea(link, config) {
  if (!(link instanceof Element)) {
    return false;
  }

  if (!isEligiblePreviewLink(link, config)) {
    return false;
  }

  if (config.enableOnKanbanBoards) {
    const isBoardUrl =
      window.location.pathname === "/latest" &&
      new URLSearchParams(window.location.search).has("board");

    const inKanbanUi = !!link.closest(
      ".kanban-board, .kanban-column, .kanban-card, .kanban-topic-card, [class*='kanban']"
    );

    if (isBoardUrl || inKanbanUi) {
      return true;
    }
  }

  if (
    config.enableOnTopicPage &&
    link.closest(".topic-post, .topic-body, .suggested-topics")
  ) {
    return true;
  }

  if (
    config.enableOnSearch &&
    link.closest(".search-results, .search-result-topic")
  ) {
    return true;
  }

  if (
    config.enableOnUserProfile &&
    link.closest(".user-main, .user-content")
  ) {
    return true;
  }

  if (
    config.enableOnTopicList &&
    link.closest(
      ".topic-list, .latest-topic-list, .top-topic-list, .new-topic-list, .unread-topic-list"
    )
  ) {
    return true;
  }

  if (config.enableOnLatest && link.closest(".latest-topic-list")) {
    return true;
  }

  if (
    config.enableOnCategories &&
    link.closest(
      ".categories-list, .category-list, .category-boxes, .categories-and-latest-topics, .categories-and-featured-topics, .categories-with-featured-topics, .categories-only"
    )
  ) {
    return true;
  }

  if (
    config.enableOnTags &&
    link.closest(".tag-topic-list, .tags-page, .discourse-tag")
  ) {
    return true;
  }

  if (config.enableOnOther && link.closest(".cooked")) {
    return true;
  }

  return false;
}

export function normalizedFieldKeyVariants(rawValue) {
  const raw = String(rawValue ?? "").trim();
  if (!raw) {
    return [];
  }

  const normalized = raw.toLowerCase();
  const variants = new Set([normalized]);

  if (/^\d+$/.test(normalized)) {
    variants.add(`user_field_${normalized}`);
  }

  const userFieldMatch = normalized.match(/^user_field_(\d+)$/);
  if (userFieldMatch) {
    variants.add(userFieldMatch[1]);
  }

  return [...variants];
}

function isTruthyUserFieldValue(value) {
  if (value === true || value === 1) {
    return true;
  }

  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  return ["true", "t", "1", "yes", "y", "on"].includes(normalized);
}

export function findTruthyFieldMatch(source, candidates) {
  if (!source || !candidates?.length) {
    return null;
  }

  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      if (isTruthyUserFieldValue(source[key])) {
        return {
          key,
          value: source[key],
        };
      }
    }
  }

  return null;
}

export function currentUserIsStaffLike(user) {
  return !!(user?.admin || user?.moderator || user?.staff);
}

export function safeAvatarURL(avatarTemplate, size = 24) {
  if (!avatarTemplate) {
    return "";
  }

  const replaced = String(avatarTemplate).replace("{size}", String(size));
  return sanitizeURL(replaced);
}

export function safeRemoteAvatarURL(origin, avatarTemplate, size = 24) {
  if (!avatarTemplate || !origin) {
    return "";
  }

  const replaced = String(avatarTemplate).replace("{size}", String(size));

  try {
    return sanitizeURL(new URL(replaced, origin).toString());
  } catch {
    return "";
  }
}

export function sanitizeExcerpt(htmlOrText, excludedSelectors = []) {
  const source = String(htmlOrText ?? "").trim();
  if (!source) {
    return "";
  }

  const temp = document.createElement("div");
  temp.innerHTML = source;

  temp
    .querySelectorAll(
      "script, style, noscript, img, picture, figure, video, audio, source, iframe, svg, canvas, form, button, input, textarea, select"
    )
    .forEach((el) => el.remove());

  excludedSelectors.forEach((selector) => {
    try {
      temp.querySelectorAll(selector).forEach((el) => el.remove());
    } catch {
      // ignore invalid selector
    }
  });

  temp.querySelectorAll("a").forEach((el) => {
    const text = (el.textContent || "").trim();
    if (!text) {
      el.remove();
    }
  });

  temp.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (attr.name.startsWith("data-")) {
        el.removeAttribute(attr.name);
      }
    });
  });

  const text = temp.textContent || temp.innerText || "";
  return text.replace(/\s+/g, " ").trim();
}

export function normalizeTag(tag) {
  if (!tag) {
    return "";
  }

  if (typeof tag === "string") {
    return tag.trim();
  }

  if (typeof tag === "object") {
    // adjust fields to match whatever your topic JSON actually uses
    const value =
      tag.name ||
      tag.text ||
      tag.id ||
      tag.slug ||
      tag.value ||
      "";

    return String(value).trim();
  }

  return String(tag).trim();
}

export function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "0";
  }

  return new Intl.NumberFormat().format(num);
}

export function isAllowedRemoteDiscourseHost(hostname, config) {
  const host = String(hostname || "").trim().toLowerCase();
  return !!host && (config?.remoteDiscourseHosts || []).includes(host);
}

export function parseRemoteDiscourseTopicUrl(href, config) {
  if (!href) {
    return null;
  }

  try {
    const url = new URL(href, window.location.origin);

    if (url.origin === window.location.origin) {
      return null;
    }

    if (
      config?.remoteDiscourseRequireHttps !== false &&
      url.protocol !== "https:"
    ) {
      return null;
    }

    if (!isAllowedRemoteDiscourseHost(url.hostname, config)) {
      return null;
    }

    const path = url.pathname.replace(/\/+$/, "");
    const match = path.match(/^\/t\/(?:([^/]+)\/)?(\d+)(?:\/(\d+))?$/);

    if (!match) {
      return null;
    }

    const topicId = Number.parseInt(match[2], 10);

    return {
      slug: match[1] || "",
      topicId,
      postNumber: match[3] ? Number.parseInt(match[3], 10) : null,
      url,
      origin: url.origin,
      hostname: url.hostname,
      isRemote: true,
      jsonUrl: `${url.origin}/t/${topicId}.json`,
    };
  } catch {
    return null;
  }
}

export function parsePreviewTopicUrl(href, config) {
  return parseTopicUrl(href) || parseRemoteDiscourseTopicUrl(href, config);
}