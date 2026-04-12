/**
 * hover-preview-utils.js
 *
 * Pure utilities shared between the API initializer and the Glimmer component.
 * No Ember dependencies — safe to import anywhere, easy to unit-test.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

export const TOOLTIP_ID = "topic-hover-card-tooltip";
export const TOOLTIP_SELECTOR = `#${TOOLTIP_ID}`;
export const DELAY_HIDE = 280;
export const VIEWPORT_MARGIN = 8;
export const MOBILE_BREAKPOINT = 768;

// ─── Config reader ────────────────────────────────────────────────────────────

/**
 * Reads and normalises all theme settings into a typed config object.
 * Keeps the initializer free of settings string-parsing.
 *
 * @param {object} settings - Discourse theme settings proxy
 * @returns {object}
 */
export function readConfig(settings) {
  const s = settings;
  return {
    // Core
    enabled: !!s.enabled,
    debugMode: !!s.debug_mode,
    delayShow: intSetting(s.delay_show, 300, 0, 2000),
    cardWidth: strSetting(s.card_width, "32rem"),

    // Mobile
    mobileEnabled: !!s.mobile_enabled,
    mobileWidthPercent: intSetting(s.mobile_width_percent, 90, 20, 100),

    // Caches
    topicCacheMax: intSetting(s.topic_cache_max, 100, 10, 1000),
    excerptCacheMax: intSetting(s.excerpt_cache_max, 200, 10, 2000),

    // User preference opt-out
    userPreferenceFieldName: strSetting(s.user_preference_field_name, ""),
    resolveUserFieldIdForAdmins: !!s.resolve_user_field_id_for_admins,

    // Area enable flags (read by linkInSupportedArea)
    enableOnTopicList: !!s.enable_on_topic_list,
    enableOnLatest: !!s.enable_on_latest,
    enableOnCategories: !!s.enable_on_categories,
    enableOnTags: !!s.enable_on_tags,
    enableOnSearch: !!s.enable_on_search,
    enableOnTopicPage: !!s.enable_on_topic_page,
    enableOnUserProfile: !!s.enable_on_user_profile,
    enableOnOther: !!s.enable_on_other,
  };
}

function intSetting(raw, fallback, min, max) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function strSetting(raw, fallback) {
  return typeof raw === "string" && raw.trim() ? raw.trim() : fallback;
}

// ─── Debug logging ─────────────────────────────────────────────────────────────

export function logDebug(config, ...args) {
  if (config?.debugMode) {
    // eslint-disable-next-line no-console
    console.log("[topic-hover-cards]", ...args);
  }
}

// ─── LRU cache helpers ────────────────────────────────────────────────────────

export function getCachedValue(map, key) {
  if (!map.has(key)) return undefined;
  const value = map.get(key);
  // Refresh insertion order for LRU behaviour
  map.delete(key);
  map.set(key, value);
  return value;
}

export function setCachedValue(map, key, value, maxSize) {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  if (maxSize > 0) {
    while (map.size > maxSize) {
      map.delete(map.keys().next().value);
    }
  }
}

// ─── Network ──────────────────────────────────────────────────────────────────

/**
 * Thin fetch wrapper that reuses Discourse's CSRF token and returns parsed JSON.
 * Throws on non-2xx responses.
 *
 * @param {string} path
 * @param {{ signal?: AbortSignal, params?: object }} options
 */
export async function getJSON(path, { signal, params } = {}) {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const csrfToken =
    document.querySelector("meta[name='csrf-token']")?.getAttribute("content") || "";

  const res = await fetch(url.toString(), {
    method: "GET",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    },
    signal,
  });

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

// ─── URL parsing ──────────────────────────────────────────────────────────────

const TOPIC_ID_RE = /\/t\/(?:[^/]+\/)?(\d+)/;

/**
 * Extracts a Discourse topic ID from a full URL string.
 * Returns null if the URL does not look like a topic link.
 *
 * @param {string} href
 * @returns {number|null}
 */
export function topicIdFromHref(href) {
  if (!href || typeof href !== "string") return null;
  try {
    const url = new URL(href, window.location.origin);
    // Must be same-origin
    if (url.origin !== window.location.origin) return null;
    const match = TOPIC_ID_RE.exec(url.pathname);
    if (!match) return null;
    const id = parseInt(match[1], 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

// ─── Area / context detection ─────────────────────────────────────────────────

/**
 * Returns true if the given link element is inside a DOM area where hover cards
 * are enabled according to config.
 *
 * @param {Element} link
 * @param {object} config  - readConfig() result
 * @param {object} settings - raw settings proxy (for area-specific extra flags)
 */
export function linkInSupportedArea(link, config) {
  const node = link.closest(
    [
      config.enableOnTopicList     && "[class*='topic-list']",
      config.enableOnLatest        && ".latest-topic-list",
      config.enableOnCategories    && ".category-list",
      config.enableOnTags          && ".tag-list",
      config.enableOnSearch        && ".search-results",
      config.enableOnTopicPage     && ".topic-post, .suggested-topics",
      config.enableOnUserProfile   && ".user-content",
      config.enableOnOther         && ".cooked, .d-editor-preview",
    ]
      .filter(Boolean)
      .join(", ")
  );
  return !!node;
}

// ─── Viewport helpers ─────────────────────────────────────────────────────────

/**
 * Creates a closure over the current viewport width.
 * Call site code caches this object rather than reading window.innerWidth directly.
 */
export function createViewportState() {
  return {
    isMobileLayout() {
      return window.innerWidth <= MOBILE_BREAKPOINT;
    },
    isMobileInteractionMode() {
      return (
        window.matchMedia("(hover: none)").matches ||
        window.matchMedia("(pointer: coarse)").matches ||
        this.isMobileLayout()
      );
    },
  };
}

// ─── User-field key helpers ───────────────────────────────────────────────────

/**
 * Given a raw field key (name string, numeric ID, or "user_field_N" string),
 * returns the set of candidate key variants to check.
 *
 * @param {string|number} rawKey
 * @returns {string[]}
 */
export function normalizedFieldKeyVariants(rawKey) {
  if (!rawKey) return [];
  const s = String(rawKey).trim();
  if (/^\d+$/.test(s)) {
    return [`user_field_${s}`, s];
  }
  if (/^user_field_\d+$/i.test(s)) {
    const id = s.replace(/^user_field_/i, "");
    return [s.toLowerCase(), id];
  }
  return [s.toLowerCase()];
}

/**
 * Returns true if any key in `candidates` exists as a truthy field in `fields`.
 *
 * @param {object} fields
 * @param {string[]} candidates
 */
export function findTruthyFieldMatch(fields, candidates) {
  if (!fields || !candidates?.length) return false;
  return candidates.some((k) => {
    const v = fields[k];
    return v !== undefined && v !== null && v !== false && v !== "false" && v !== "0" && v !== "";
  });
}

/**
 * Returns true if the currentUser looks like a staff or admin user.
 * Avoids an extra API call to determine role.
 *
 * @param {object|null} currentUser
 */
export function currentUserIsStaffLike(currentUser) {
  return !!(currentUser?.staff || currentUser?.admin || currentUser?.moderator);
}

// ─── Content sanitisation helpers ─────────────────────────────────────────────

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" };

/** Basic HTML-entity escaper for plain-text insertion contexts. */
export function escapeHTML(str) {
  return typeof str === "string" ? str.replace(/[&<>"']/g, (c) => ESC[c]) : "";
}

/** Strips HTML tags, collapses whitespace, trims to a safe length. */
export function sanitizeExcerpt(raw, maxLen = 400) {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .replace(/<[^>]*>/g, " ")   // strip tags
    .replace(/&[a-z#0-9]+;/gi, (m) => {
      try { return new DOMParser().parseFromString(m, "text/html").body.textContent || m; }
      catch { return m; }
    })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/** Validates a URL string for use in src= / href=. Returns null for unsafe values. */
export function sanitizeURL(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url, window.location.origin);
    if (!["https:", "http:", ""].includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Builds a safe avatar URL from a Discourse avatar template string.
 *
 * @param {string|null} template  e.g. "/user_avatar/domain/username/{size}/..."
 * @param {number}      size      e.g. 24, 48
 * @returns {string|null}
 */
export function safeAvatarURL(template, size = 24) {
  if (!template || typeof template !== "string") return null;
  const base = template.replace("{size}", String(size));
  return sanitizeURL(base);
}

/** Finds a category object by numeric ID from a flat categories array. */
export function findCategoryById(categories, id) {
  if (!Array.isArray(categories) || !id) return null;
  return categories.find((c) => String(c.id) === String(id)) || null;
}

/** Normalises a Discourse tag value (string, {id, text} object, etc.) to a plain string. */
export function normalizeTag(raw) {
  if (!raw) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object") {
    const v = raw.name || raw.id || raw.text || raw.value || "";
    return String(v).trim();
  }
  return "";
}

/** Formats a number for display (e.g. 1200 → "1.2k"). */
export function formatNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 0) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}m`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(Math.round(num));
}
