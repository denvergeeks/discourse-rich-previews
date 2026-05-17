import { iconHTML } from "discourse/lib/icon-library";

export const DELAY_HIDE = 120;
export const VIEWPORT_MARGIN = 8;
export const TOOLTIP_ID = "discourse-rich-preview-tooltip";
export const TOOLTIP_SELECTOR = `#${TOOLTIP_ID}`;

function intSetting(value, fallback, min = null, max = null) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;

  let result = n;
  if (min !== null) result = Math.max(result, min);
  if (max !== null) result = Math.min(result, max);
  return result;
}

function stringSetting(value, fallback) {
  if (value === null || value === undefined) return fallback;
  const str = String(value).trim();
  return str.length ? str : fallback;
}

export function cssEscape(value) {
  const str = String(value ?? "");
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(str);
  }
  return str.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function normalizeListSetting(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim().toLowerCase()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split("|")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function normalizeProviderKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizePipeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value)
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePreviewProviders(rawProviders) {
  const defaults = {
    topic: {
      key: "topic",
      enabled: true,
      color: "var(--tertiary)",
      glyphMode: "icon",
      icon: "link",
      emoji: "↗",
      timeoutMs: 3000,
      requireHttps: false,
    },
    remotetopic: {
      key: "remotetopic",
      enabled: true,
      color: "var(--tertiary)",
      glyphMode: "icon",
      icon: "discourse-other",
      emoji: "↗",
      timeoutMs: 3500,
      requireHttps: true,
    },
    external: {
      key: "external",
      enabled: true,
      color: "var(--tertiary)",
      glyphMode: "icon",
      icon: "globe",
      emoji: "↗",
      timeoutMs: 3000,
      requireHttps: true,
    },
    wikipedia: {
      key: "wikipedia",
      enabled: true,
      color: "var(--tertiary)",
      glyphMode: "icon",
      icon: "wikipedia-w",
      emoji: "Ⓦ",
      timeoutMs: 3000,
      requireHttps: true,
    },
  };

  const normalized = { ...defaults };

  if (!rawProviders) {
    return normalized;
  }

  let parsed = rawProviders;
  if (typeof rawProviders === "string") {
    try {
      parsed = JSON.parse(rawProviders);
    } catch {
      return normalized;
    }
  }

  if (Array.isArray(parsed)) {
    parsed.forEach((provider) => {
      const key = normalizeProviderKey(provider?.key);
      if (!key) return;

      normalized[key] = {
        ...defaults[key],
        ...provider,
        key,
        enabled: provider?.enabled !== false,
        color: String(provider?.color ?? defaults[key]?.color ?? "var(--tertiary)").trim(),
        glyphMode: String(provider?.glyphMode ?? provider?.glyph_mode ?? defaults[key]?.glyphMode ?? "icon")
          .trim()
          .toLowerCase(),
        icon: String(provider?.icon ?? defaults[key]?.icon ?? "").trim(),
        emoji: String(provider?.emoji ?? defaults[key]?.emoji ?? "").trim(),
        requireHttps:
          provider?.requireHttps ??
          provider?.require_https ??
          defaults[key]?.requireHttps ??
          true,
        timeoutMs: Math.max(
          250,
          Math.min(
            Number.parseInt(
              provider?.timeoutMs ?? provider?.timeout_ms ?? defaults[key]?.timeoutMs ?? 3000,
              10
            ),
            10000
          )
        ),
      };
    });
  } else if (parsed && typeof parsed === "object") {
    Object.entries(parsed).forEach(([rawKey, provider]) => {
      const key = normalizeProviderKey(rawKey);
      if (!key) return;

      normalized[key] = {
        ...defaults[key],
        ...provider,
        key,
        enabled: provider?.enabled !== false,
        color: String(provider?.color ?? defaults[key]?.color ?? "var(--tertiary)").trim(),
        glyphMode: String(provider?.glyphMode ?? provider?.glyph_mode ?? defaults[key]?.glyphMode ?? "icon")
          .trim()
          .toLowerCase(),
        icon: String(provider?.icon ?? defaults[key]?.icon ?? "").trim(),
        emoji: String(provider?.emoji ?? defaults[key]?.emoji ?? "").trim(),
        requireHttps:
          provider?.requireHttps ??
          provider?.require_https ??
          defaults[key]?.requireHttps ??
          true,
        timeoutMs: Math.max(
          250,
          Math.min(
            Number.parseInt(
              provider?.timeoutMs ?? provider?.timeout_ms ?? defaults[key]?.timeoutMs ?? 3000,
              10
            ),
            10000
          )
        ),
      };
    });
  }

  return normalized;
}

export function readConfig(settings) {
  return {
    enabled: settings.enabled !== false,
    debugMode: !!settings.debug_mode,
    prefetchEnabled: settings.prefetch_enabled !== false,
    prefetchViewportMargin: stringSetting(settings.prefetch_viewport_margin, "200px"),

    previewsTopicMode: stringSetting(settings.previews_topic_mode, "auto_only"),
    previewsRemoteTopicMode: stringSetting(settings.previews_remote_topic_mode, "auto_only"),
    previewsExternalMode: stringSetting(settings.previews_external_mode, "auto_only"),
    previewsWikipediaMode: stringSetting(settings.previews_wikipedia_mode, "auto_only"),

    composerButtonGroup: stringSetting(settings.composer_button_group, "insertions"),

    previewsShowUnderline: settings.previews_show_underline !== false,
    previewsUnderlineAlways: settings.previews_underline_always !== false,
    previewsShowIcon: settings.previews_show_icon !== false,
    previewsIconPosition: stringSetting(settings.previews_icon_position, "after"),

    previewProviders: normalizePreviewProviders(settings.preview_providers),

    delayShow: intSetting(settings.delay_show, 300, 0, 2000),
    cardWidth: stringSetting(settings.card_width, "32rem"),
    mobileWidthPercent: intSetting(settings.mobile_width_percent, 100, 70, 100),
    mobileEnabled: settings.mobile_enabled !== false,

    densityDesktop: stringSetting(settings.density, "default"),
    densityMobile: stringSetting(settings.density_mobile, "default"),
    previewLayout: stringSetting(settings.preview_layout, "hover_card"),

    thumbnailPlacementDesktop: stringSetting(settings.thumbnail_placement_desktop, "left"),
    thumbnailPlacementMobile: stringSetting(settings.thumbnail_placement_mobile, "top"),
    thumbnailSizeModeDesktop: stringSetting(settings.thumbnail_size_mode_desktop, "autofitheight"),
    thumbnailSizeModeMobile: stringSetting(settings.thumbnail_size_mode_mobile, "autofitheight"),
    thumbnailSizePercentDesktop: intSetting(settings.thumbnail_size_percent_desktop, 15, 10, 60),
    thumbnailSizePercentMobile: intSetting(settings.thumbnail_size_percent_mobile, 25, 10, 100),
    thumbnailAutoFitMaxWidthDesktop: stringSetting(settings.thumbnail_auto_fit_max_width_desktop, "10rem"),
    thumbnailAutoFitMaxWidthMobile: stringSetting(settings.thumbnail_auto_fit_max_width_mobile, "8rem"),
    thumbnailHeightTopBottomDesktop: stringSetting(settings.thumbnail_height_top_bottom_desktop, "auto"),
    thumbnailHeightTopBottomMobile: stringSetting(settings.thumbnail_height_top_bottom_mobile, "auto"),

    wikipediaPreviewsEnabled: settings.wikipedia_previews_enabled !== false,
    wikipediaPreviewsBaseUrl: stringSetting(settings.wikipedia_previews_base_url, "en.wikipedia.org"),
    wikipediaPreviewsShowImage: settings.wikipedia_previews_show_image !== false,
    wikipediaPreviewsUseExtractHtml: settings.wikipedia_previews_use_extract_html !== false,
    wikipediaDensityDesktop: stringSetting(settings.wikipedia_density_desktop, "cozy"),
    wikipediaDensityMobile: stringSetting(settings.wikipedia_density_mobile, "compact"),

    showThumbnailDesktop: settings.show_thumbnail_desktop !== false,
    showThumbnailMobile: settings.show_thumbnail_mobile !== false,
    showTitleDesktop: settings.show_title_desktop !== false,
    showTitleMobile: settings.show_title_mobile !== false,
    showExcerptDesktop: settings.show_excerpt_desktop !== false,
    showExcerptMobile: settings.show_excerpt_mobile !== false,
    showCategoryDesktop: settings.show_category_desktop !== false,
    showCategoryMobile: settings.show_category_mobile !== false,
    showTagsDesktop: settings.show_tags_desktop !== false,
    showTagsMobile: settings.show_tags_mobile !== false,
    showOpDesktop: settings.show_op_desktop !== false,
    showOpMobile: settings.show_op_mobile !== false,
    showPublishDateDesktop: settings.show_publish_date_desktop !== false,
    showPublishDateMobile: settings.show_publish_date_mobile !== false,
    showViewsDesktop: settings.show_views_desktop !== false,
    showViewsMobile: settings.show_views_mobile !== false,
    showReplyCountDesktop: settings.show_reply_count_desktop !== false,
    showReplyCountMobile: settings.show_reply_count_mobile !== false,
    showLikesDesktop: settings.show_likes_desktop !== false,
    showLikesMobile: settings.show_likes_mobile !== false,
    showActivityDesktop: settings.show_activity_desktop !== false,
    showActivityMobile: settings.show_activity_mobile !== false,

    excerptLengthDesktop: intSetting(settings.excerpt_length_desktop, 3, 1, 12),
    excerptLengthMobile: intSetting(settings.excerpt_length_mobile, 4, 1, 12),

    includedTags: normalizeListSetting(settings.included_tags),
    excludedTags: normalizeListSetting(settings.excluded_tags),
    includedClasses: normalizePipeList(settings.included_classes),
    excludedClasses: normalizePipeList(settings.excluded_classes),

    userPreferenceFieldName: stringSetting(settings.user_preference_field_name, ""),
    resolveUserFieldIdForAdmins: settings.resolve_user_field_id_for_admins !== false,
    excerptExcludedSelectors: normalizeListSetting(settings.excerpt_excluded_selectors),
    topicCacheMax: intSetting(settings.topic_cache_max, 100, 10, 500),
  };
}

export function logDebug(config, message, data = null) {
  if (!config?.debugMode) return;

  if (data !== null && data !== undefined) {
    console.debug("[discourse-rich-previews]", message, data);
  } else {
    console.debug("[discourse-rich-previews]", message);
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
  if (!url) return "";
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
  if (!(el instanceof Element)) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function createViewportState() {
  const MOBILE_LAYOUT_QUERY = "(max-width: 767px)";
  const MOBILE_INTERACTION_QUERY = "(hover: none), (pointer: coarse)";

  const mobileLayoutMql = window.matchMedia(MOBILE_LAYOUT_QUERY);
  const mobileInteractionMql = window.matchMedia(MOBILE_INTERACTION_QUERY);

  function matches(mql) {
    return !!mql?.matches;
  }

  function isMobileLayout() {
    return matches(mobileLayoutMql);
  }

  function isMobileInteractionMode() {
    return isMobileLayout() || matches(mobileInteractionMql);
  }

  function mode() {
    return {
      isMobileLayout: isMobileLayout(),
      isMobileInteractionMode: isMobileInteractionMode(),
    };
  }

  function onChange(callback) {
    if (typeof callback !== "function") {
      return () => {};
    }

    const handler = () => callback(mode());

    if (typeof mobileLayoutMql?.addEventListener === "function") {
      mobileLayoutMql.addEventListener("change", handler);
      mobileInteractionMql?.addEventListener?.("change", handler);

      return () => {
        mobileLayoutMql.removeEventListener("change", handler);
        mobileInteractionMql?.removeEventListener?.("change", handler);
      };
    }

    if (typeof mobileLayoutMql?.addListener === "function") {
      mobileLayoutMql.addListener(handler);
      mobileInteractionMql?.addListener?.(handler);

      return () => {
        mobileLayoutMql.removeListener(handler);
        mobileInteractionMql?.removeListener?.(handler);
      };
    }

    return () => {};
  }

  return {
    isMobileLayout,
    isMobileInteractionMode,
    mode,
    onChange,
  };
}

export function getCachedValue(map, key) {
  if (!map?.has(key)) return null;
  const value = map.get(key);
  map.delete(key);
  map.set(key, value);
  return value;
}

export function setCachedValue(map, key, value, maxSize = 100) {
  if (!map) return value;
  if (map.has(key)) map.delete(key);
  map.set(key, value);

  while (map.size > maxSize) {
    const oldestKey = map.keys().next().value;
    map.delete(oldestKey);
  }

  return value;
}

export function getPreviewProvider(config, key) {
  return config?.previewProviders?.[key] || null;
}

export function providerColor(providerKey, config, fallback = "var(--tertiary)") {
  return String(getPreviewProvider(config, providerKey)?.color ?? fallback).trim();
}

export function providerEnabled(config, key) {
  return getPreviewProvider(config, key)?.enabled !== false;
}

export function providerTimeoutMs(providerKey, config, fallback = 3000) {
  const timeout = getPreviewProvider(config, providerKey)?.timeoutMs;
  const parsed = Number.parseInt(timeout, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(250, Math.min(parsed, 10000));
}

export function providerModeForType(type, config) {
  switch (type) {
    case "topic":
      return config?.previewsTopicMode || "auto_only";
    case "remotetopic":
      return config?.previewsRemoteTopicMode || "auto_only";
    case "external":
      return config?.previewsExternalMode || "auto_only";
    case "wikipedia":
      return config?.previewsWikipediaMode || "auto_only";
    default:
      return "disabled";
  }
}

export function providerSupportsAuto(type, config) {
  const mode = providerModeForType(type, config);
  return mode === "auto_only" || mode === "auto_and_composer";
}

export function providerSupportsComposer(type, config) {
  const mode = providerModeForType(type, config);
  return mode === "composer_only" || mode === "auto_and_composer";
}

export function getRemoteTopicProvider(config) {
  return getPreviewProvider(config, "remotetopic");
}

export function getWikipediaProvider(config) {
  return getPreviewProvider(config, "wikipedia");
}

export function getTopicProviderConfig(config) {
  return getPreviewProvider(config, "topic");
}

export function providerKeyForTarget(target, preview = null) {
  if (target?.providerKey) return target.providerKey;
  if (preview?.providerKey) return preview.providerKey;
  if (target?.type === "wikipedia" || preview?.type === "wikipedia") return "wikipedia";
  if (target?.type === "topic" && target?.isRemote) return "remotetopic";
  if (preview?.raw?.isRemoteDiscourseTopic) return "remotetopic";
  if (target?.type === "topic" || preview?.type === "topic") return "topic";
  if (target?.type === "external" || preview?.type === "external") return "external";
  return null;
}

const FALLBACK_GLYPHS = {
  topic: "↗",
  remotetopic: "↗",
  external: "↗",
  wikipedia: "Ⓦ",
};

export function renderProviderGlyph(providerKey, config) {
  const provider = getPreviewProvider(config, providerKey);
  if (!provider || provider.enabled === false) return "";

  const mode = String(provider.glyphMode ?? "emoji").trim().toLowerCase();

  if (mode === "none") {
    return "";
  }

  if (mode === "emoji") {
    const emoji = String(provider.emoji ?? FALLBACK_GLYPHS[providerKey] ?? "").trim();
    return emoji ? escapeHTML(emoji) : "";
  }

  const iconName = String(provider.icon ?? "").trim();
  if (!iconName) return "";

  try {
    return iconHTML(iconName) || "";
  } catch {
    return "";
  }
}

export function renderInlineProviderGlyph(providerKey, config) {
  const glyph = renderProviderGlyph(providerKey, config);
  if (!glyph) return "";
  return `<span class="thc-inline-glyph" aria-hidden="true">${glyph}</span>`;
}

export function normalizeTag(tag) {
  return String(tag ?? "").trim();
}

export function formatNumber(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat().format(n);
}

export function safeAvatarURL(template, size = 48) {
  if (!template) return "";
  return sanitizeURL(template.replace("{size}", size));
}

export function safeRemoteAvatarURL(url) {
  return sanitizeURL(url);
}

export function sanitizeExcerpt(htmlOrText, excludedSelectors = []) {
  const raw = String(htmlOrText ?? "").trim();
  if (!raw) return "";

  const hasTags = /<[^>]+>/.test(raw);
  if (!hasTags) {
    return raw.replace(/\s+/g, " ").trim();
  }

  const doc = new DOMParser().parseFromString(raw, "text/html");

  if (Array.isArray(excludedSelectors)) {
    excludedSelectors.forEach((selector) => {
      try {
        doc.querySelectorAll(selector).forEach((node) => node.remove());
      } catch {
      }
    });
  }

  return doc.body.textContent?.replace(/\s+/g, " ").trim() || "";
}

export async function getJSON(url, options = {}) {
  const response = await fetch(url, {
    method: "GET",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.json();
}

export function normalizedFieldKeyVariants(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];

  const variants = new Set([raw, raw.toLowerCase()]);

  const numeric = raw.match(/\d+/)?.[0];
  if (numeric) {
    variants.add(numeric);
    variants.add(`user_field_${numeric}`);
    variants.add(`user-field-${numeric}`);
    variants.add(`userField${numeric}`);
  }

  return [...variants];
}

export function findTruthyFieldMatch(fields, candidates = []) {
  if (!fields || !candidates.length) return null;

  for (const candidate of candidates) {
    const value = fields[candidate];
    if (
      value === true ||
      value === "true" ||
      value === "1" ||
      value === 1 ||
      value === "yes" ||
      value === "on"
    ) {
      return { key: candidate, value };
    }
  }

  return null;
}

export function currentUserIsStaffLike(user) {
  return !!(user?.admin || user?.moderator || user?.staff);
}

export function parseTopicUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin) {
      return null;
    }

    const match = parsed.pathname.match(/^\/t\/([^/]+)\/(\d+)(?:\/(\d+))?/);
    if (!match) return null;

    return {
      slug: match[1],
      topicId: Number.parseInt(match[2], 10),
      postNumber: match[3] ? Number.parseInt(match[3], 10) : null,
    };
  } catch {
    return null;
  }
}

export function parseRemoteDiscourseTopicUrl(url, config) {
  if (!url) return null;

  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin === window.location.origin) {
      return null;
    }

    const match = parsed.pathname.match(/^\/t\/([^/]+)\/(\d+)(?:\/(\d+))?(?:\.json)?$/);
    if (!match) return null;

    const remoteProvider = getRemoteTopicProvider(config);
    if (remoteProvider?.requireHttps !== false && parsed.protocol !== "https:") {
      return null;
    }

    return {
      origin: parsed.origin,
      hostname: parsed.hostname.toLowerCase(),
      slug: match[1],
      topicId: Number.parseInt(match[2], 10),
      postNumber: match[3] ? Number.parseInt(match[3], 10) : null,
      jsonUrl: `${parsed.origin}/t/${match[1]}/${match[2]}.json`,
    };
  } catch {
    return null;
  }
}

export function isWikipediaArticleLink(link) {
  try {
    const url = new URL(link.href, window.location.origin);
    return /\.wikipedia\.org$/i.test(url.hostname) && url.pathname.startsWith("/wiki/");
  } catch {
    return false;
  }
}

export function matchesExternalTarget(link, config) {
  if (!(link instanceof HTMLAnchorElement)) {
    return false;
  }

  const href = link.getAttribute("href");
  if (!href || href.startsWith("#")) {
    return false;
  }

  try {
    const url = new URL(link.href, window.location.origin);

    if (url.origin === window.location.origin) {
      return false;
    }

    if (!/^https?:$/i.test(url.protocol)) {
      return false;
    }

    const externalProvider = getPreviewProvider(config, "external");
    const requireHttps = externalProvider?.requireHttps !== false;

    if (requireHttps && url.protocol !== "https:") {
      return false;
    }

    if (/\.wikipedia\.org$/i.test(url.hostname)) {
      return false;
    }

    if (/^\/t\//.test(url.pathname) || /^\/t\//.test(href)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function matchesTagList(link, tags = []) {
  if (!(link instanceof Element) || !Array.isArray(tags) || !tags.length) {
    return null;
  }

  const lowered = tags.map((tag) => String(tag).toLowerCase());
  let node = link;

  while (node && node instanceof Element) {
    if (lowered.includes(node.tagName.toLowerCase())) {
      return node;
    }
    node = node.parentElement;
  }

  return null;
}

function matchesClassList(link, classes = []) {
  if (!(link instanceof Element) || !Array.isArray(classes) || !classes.length) {
    return null;
  }

  const lowered = classes.map((cls) => String(cls).toLowerCase());

  for (const className of lowered) {
    const selector = `.${cssEscape(className)}`;
    const ancestorMatch = selector ? link.closest(selector) : null;
    if (ancestorMatch) return ancestorMatch;
  }

  for (const cls of link.classList) {
    if (lowered.includes(String(cls).toLowerCase())) {
      return link;
    }
  }

  return null;
}

function matchesIncludedRules(link, config) {
  const includedTags = Array.isArray(config?.includedTags) ? config.includedTags : [];
  const includedClasses = Array.isArray(config?.includedClasses) ? config.includedClasses : [];

  if (!includedTags.length && !includedClasses.length) {
    return true;
  }

  return !!(matchesTagList(link, includedTags) || matchesClassList(link, includedClasses));
}

function matchesExcludedRules(link, config) {
  const excludedTags = Array.isArray(config?.excludedTags) ? config.excludedTags : [];
  const excludedClasses = Array.isArray(config?.excludedClasses) ? config.excludedClasses : [];

  const excludedTagMatch = matchesTagList(link, excludedTags);
  if (excludedTagMatch) {
    return { type: "tag", match: excludedTagMatch };
  }

  const excludedClassMatch = matchesClassList(link, excludedClasses);
  if (excludedClassMatch) {
    return { type: "class", match: excludedClassMatch };
  }

  return null;
}

export function autoPreviewEnabled(type, config) {
  return providerSupportsAuto(type, config);
}

export function composerPreviewEnabled(type, config) {
  return providerSupportsComposer(type, config);
}

export function previewTypeEnabled(type, config) {
  const providerKey =
    type === "topic"
      ? "topic"
      : type === "remotetopic"
        ? "remotetopic"
        : type === "external"
          ? "external"
          : type === "wikipedia"
            ? "wikipedia"
            : null;

  if (!providerKey) return false;
  if (providerModeForType(type, config) === "disabled") return false;
  return providerEnabled(config, providerKey);
}

export function composerButtonShouldShow(config) {
  return (
    previewTypeEnabled("topic", config) ||
    previewTypeEnabled("remotetopic", config) ||
    previewTypeEnabled("external", config) ||
    previewTypeEnabled("wikipedia", config)
  );
}

export function isManuallyWrapped(link) {
  return !!link?.closest?.('.rich-preview-wrap[data-rich-preview="true"]');
}

export function classifyLink(link, config) {
  if (isWikipediaArticleLink(link)) return "wikipedia";
  if (parseTopicUrl(link?.href)) return "topic";
  if (parseRemoteDiscourseTopicUrl(link?.href, config)) return "remotetopic";
  if (matchesExternalTarget(link, config)) return "external";
  return null;
}

export function isEligiblePreviewLink(link, config) {
  if (!(link instanceof HTMLAnchorElement)) return false;
  if (link.closest(".topic-hover-card, #discourse-rich-preview-tooltip")) return false;

  const type = classifyLink(link, config);
  if (!type) return false;
  if (!previewTypeEnabled(type, config)) return false;

  const manuallyWrapped = isManuallyWrapped(link);
  if (manuallyWrapped) {
    return composerPreviewEnabled(type, config);
  }

  if (!autoPreviewEnabled(type, config)) return false;

  if (!matchesIncludedRules(link, config)) {
    logDebug(config, "Skipping link due to include rules", { href: link.href });
    return false;
  }

  const excluded = matchesExcludedRules(link, config);
  if (excluded) {
    logDebug(config, "Skipping link due to exclude rules", {
      href: link.href,
      reason: excluded.type,
    });
    return false;
  }

  return true;
}

export function linkInSupportedArea(link, config) {
  return isEligiblePreviewLink(link, config);
}