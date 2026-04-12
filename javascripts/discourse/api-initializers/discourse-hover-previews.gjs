/**
 * discourse-hover-previews — API initializer
 *
 * Responsibilities of this file:
 *   1. Read config / check user preference opt-out
 *   2. Manage the single tooltip container element
 *   3. Wire DOM event listeners (hover, touch, scroll, resize)
 *   4. Fetch topic data (with LRU cache + AbortController)
 *   5. Mount / unmount the Glimmer <TopicHoverCard> into the tooltip container
 *      via renderComponent (Discourse's Glimmer renderer helper)
 *
 * All display logic lives in components/topic-hover-card.gjs
 * All pure utilities live in lib/hover-preview-utils.js
 */

import { later, cancel } from "@ember/runloop";
import { renderComponent } from "discourse/lib/render-glimmer";
import { apiInitializer } from "discourse/lib/api";
import TopicHoverCard from "../components/topic-hover-card";
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
  topicIdFromHref,
  linkInSupportedArea,
  normalizedFieldKeyVariants,
  findTruthyFieldMatch,
  currentUserIsStaffLike,
} from "../lib/hover-preview-utils";

export default apiInitializer("1.0", (api) => {
  // ─── Config & services ──────────────────────────────────────────────────────
  const config = readConfig(settings);
  const currentUser = api.getCurrentUser();

  // Use api.container.lookup only for services not injectable in initializer scope.
  // Glimmer components use @service injections instead (see topic-hover-card.gjs).
  const siteService = api.container.lookup("service:site");
  const viewport = createViewportState();

  // ─── State ──────────────────────────────────────────────────────────────────
  let tooltipEl = null;
  let cardRenderer = null;       // return value of renderComponent — call to teardown
  let showTimer = null;
  let hideTimer = null;
  let clearSuppressionTimer = null;
  let currentTopicId = null;
  let currentAbortController = null;
  let isInsideCard = false;
  let suppressNextClick = false;
  let resolvedUserFieldId = null;
  let resolvedUserFieldIdPromise = null;

  // Reactive card state — updated before each renderComponent call
  let cardState = {
    topic: null,
    isLoading: false,
    hasError: false,
    isMobile: false,
  };

  // Caches
  const topicCache = new Map();
  const excerptCache = new Map();
  const inFlightFetches = new Map();

  // Event cleanup registry
  const cleanupFns = [];

  function addCleanup(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    cleanupFns.push(() => target.removeEventListener(type, handler, options));
  }

  function runCleanup() {
    // Cancel all pending timers first
    cancel(showTimer);
    cancel(hideTimer);
    cancel(clearSuppressionTimer);
    showTimer = hideTimer = clearSuppressionTimer = null;

    while (cleanupFns.length) {
      try { cleanupFns.pop()?.(); } catch { /* no-op */ }
    }
  }

  // ─── Tooltip container lifecycle ────────────────────────────────────────────

  function ensureTooltip() {
    if (tooltipEl?.isConnected) return;

    tooltipEl = document.getElementById(TOOLTIP_ID);
    if (!tooltipEl) {
      tooltipEl = document.createElement("div");
      tooltipEl.id = TOOLTIP_ID;
      tooltipEl.className = "topic-hover-card-tooltip";
      tooltipEl.setAttribute("role", "tooltip");
      tooltipEl.setAttribute("aria-live", "polite");
      document.body.appendChild(tooltipEl);
    }

    tooltipEl.style.setProperty("--thc-width", config.cardWidth);
    tooltipEl.style.setProperty("--thc-mobile-width", `${config.mobileWidthPercent}vw`);

    cleanupFns.push(() => {
      cardRenderer?.();
      cardRenderer = null;
      tooltipEl?.remove();
      tooltipEl = null;
    });
  }

  // ─── renderComponent integration ────────────────────────────────────────────
  // renderComponent mounts a Glimmer component into a DOM node and returns a
  // teardown function.  We re-mount (teardown + re-mount) each time card state
  // changes so the component receives fresh @args.

  function mountCard() {
    if (!tooltipEl) return;

    // Teardown previous mount so we get a fresh component with new args
    cardRenderer?.();
    cardRenderer = null;

    cardRenderer = renderComponent(tooltipEl, {
      component: TopicHoverCard,
      args: {
        topic: cardState.topic,
        isLoading: cardState.isLoading,
        hasError: cardState.hasError,
        isMobile: cardState.isMobile,
        settingsObj: settings,
        excerptCache,
        onClose: hideCard,
        onOpenTopic: hideCard,
      },
    });
  }

  // ─── Positioning ─────────────────────────────────────────────────────────────

  function positionTooltip(anchorRect) {
    if (!tooltipEl || viewport.isMobileInteractionMode()) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardH = tooltipEl.offsetHeight || 320;
    const cardW = Math.min(tooltipEl.offsetWidth || 512, vw - VIEWPORT_MARGIN * 2);

    let top = anchorRect.bottom + 10;
    let isAbove = false;

    if (top + cardH > vh - VIEWPORT_MARGIN) {
      top = anchorRect.top - cardH - 10;
      isAbove = true;
    }

    top = Math.max(VIEWPORT_MARGIN, top);
    let left = anchorRect.left;
    if (left + cardW > vw - VIEWPORT_MARGIN) left = vw - cardW - VIEWPORT_MARGIN;
    left = Math.max(VIEWPORT_MARGIN, left);

    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.left = `${left}px`;
    tooltipEl.classList.toggle("is-above", isAbove);
  }

  function positionNextFrame(anchorRect) {
    requestAnimationFrame(() => positionTooltip(anchorRect));
  }

  // ─── Show / hide ─────────────────────────────────────────────────────────────

  function abortCurrentRequest() {
    try { currentAbortController?.abort(); } catch { /* no-op */ }
    currentAbortController = null;
  }

  function hideCard() {
    abortCurrentRequest();
    if (!tooltipEl) return;

    tooltipEl.classList.remove("is-visible");
    // Detach aria-describedby from any previously targeted link
    document
      .querySelectorAll(`[aria-describedby="${TOOLTIP_ID}"]`)
      .forEach((el) => el.removeAttribute("aria-describedby"));

    later(() => {
      if (!tooltipEl?.classList.contains("is-visible")) {
        currentTopicId = null;
      }
    }, 400);
  }

  function scheduleHide() {
    cancel(hideTimer);
    hideTimer = later(() => {
      if (!isInsideCard) hideCard();
      suppressNextClick = false;
    }, DELAY_HIDE);
  }

  function scheduleShow(topicId, anchorEl) {
    cancel(showTimer);
    cancel(hideTimer);
    showTimer = later(() => showCard(topicId, anchorEl), config.delayShow);
  }

  function resetSuppressedClickSoon() {
    cancel(clearSuppressionTimer);
    clearSuppressionTimer = later(() => { suppressNextClick = false; }, 700);
  }

  // ─── Fetch ───────────────────────────────────────────────────────────────────

  async function fetchTopic(topicId, signal) {
    // 1. LRU cache hit
    const cached = getCachedValue(topicCache, topicId);
    if (cached) return cached;

    // 2. Discourse store peek (avoids re-fetching already-loaded topics)
    try {
      const store = api.container.lookup("service:store");
      const inStore = store?.peekRecord?.("topic", topicId);
      if (inStore) {
        const raw = inStore.getProperties
          ? inStore.getProperties(
              "id", "title", "fancy_title", "slug", "excerpt",
              "image_url", "created_at", "last_posted_at", "views",
              "posts_count", "like_count", "category_id", "tags",
              "details", "posters", "post_stream"
            )
          : null;
        if (raw) {
          setCachedValue(topicCache, topicId, raw, config.topicCacheMax);
          return raw;
        }
      }
    } catch { /* store not available — fall through to fetch */ }

    // 3. Deduplicated in-flight fetch
    if (inFlightFetches.has(topicId)) return inFlightFetches.get(topicId);

    const promise = getJSON(`/t/${topicId}.json`, { signal })
      .then((data) => {
        setCachedValue(topicCache, topicId, data, config.topicCacheMax);
        return data;
      })
      .finally(() => { inFlightFetches.delete(topicId); });

    inFlightFetches.set(topicId, promise);
    return promise;
  }

  // ─── showCard ────────────────────────────────────────────────────────────────

  function showCard(topicId, anchorEl) {
    ensureTooltip();
    cancel(hideTimer);

    const anchorRect = anchorEl instanceof Element
      ? anchorEl.getBoundingClientRect()
      : anchorEl; // accept pre-computed rect for mobile path

    // Wire ARIA: link → tooltip
    if (anchorEl instanceof Element) {
      // Clear previous link's association
      document
        .querySelectorAll(`[aria-describedby="${TOOLTIP_ID}"]`)
        .forEach((el) => el.removeAttribute("aria-describedby"));
      anchorEl.setAttribute("aria-describedby", TOOLTIP_ID);
    }

    // Already showing same topic — just re-position
    if (currentTopicId === topicId && tooltipEl.classList.contains("is-visible")) {
      positionNextFrame(anchorRect);
      return;
    }

    abortCurrentRequest();
    currentAbortController = new AbortController();
    currentTopicId = topicId;

    const isMobile = viewport.isMobileLayout();
    const cachedTopic = getCachedValue(topicCache, topicId);

    cardState = {
      topic: cachedTopic || null,
      isLoading: !cachedTopic,
      hasError: false,
      isMobile,
    };

    mountCard();
    tooltipEl.classList.add("is-visible");
    positionNextFrame(anchorRect);

    if (!cachedTopic) {
      fetchTopic(topicId, currentAbortController.signal)
        .then((data) => {
          if (!tooltipEl || currentTopicId !== topicId) return;
          cardState = { topic: data, isLoading: false, hasError: false, isMobile };
          mountCard();
          positionNextFrame(anchorRect);
        })
        .catch((error) => {
          if (error?.name === "AbortError") return;
          logDebug(config, "Could not load topic", { topicId, error });
          if (!tooltipEl || currentTopicId !== topicId) return;
          cardState = { topic: null, isLoading: false, hasError: true, isMobile };
          mountCard();
          positionNextFrame(anchorRect);
        });
    }
  }

  // ─── User preference opt-out ─────────────────────────────────────────────────

  async function resolveUserFieldIdForAdmins() {
    if (!config.resolveUserFieldIdForAdmins) return null;
    if (!currentUserIsStaffLike(currentUser)) return null;
    if (!config.userPreferenceFieldName) return null;

    // Only call the admin endpoint when the field name is a non-numeric string
    // (numeric IDs are already resolved by normalizedFieldKeyVariants)
    if (/^\d+$/.test(String(config.userPreferenceFieldName).trim())) return null;

    if (resolvedUserFieldId !== null) return resolvedUserFieldId;
    if (resolvedUserFieldIdPromise) return resolvedUserFieldIdPromise;

    resolvedUserFieldIdPromise = getJSON("/admin/config/user-fields.json")
      .then((result) => {
        const fields = Array.isArray(result) ? result : result?.user_fields || [];
        const wanted = String(config.userPreferenceFieldName).trim().toLowerCase();
        const match = fields.find((f) => {
          const name = String(f?.name || "").trim().toLowerCase();
          return name === wanted || `user_field_${f?.id}` === wanted || String(f?.id) === wanted;
        });
        resolvedUserFieldId = match?.id ?? null;
        return resolvedUserFieldId;
      })
      .catch((error) => {
        logDebug(config, "Could not resolve user-field ID from admin endpoint", error);
        resolvedUserFieldId = null;
        return null;
      })
      .finally(() => { resolvedUserFieldIdPromise = null; });

    return resolvedUserFieldIdPromise;
  }

  async function fetchFullCurrentUser() {
    if (!currentUser?.username) return null;
    try {
      const store = api.container.lookup("service:store");
      return (await store?.find("user", currentUser.username)) || null;
    } catch (error) {
      logDebug(config, "Could not fetch full current user record", { error });
      return null;
    }
  }

  async function hoverCardsDisabledForUser() {
    if (!currentUser || !config.userPreferenceFieldName) return false;

    const directCandidates = normalizedFieldKeyVariants(config.userPreferenceFieldName);
    const cfCustom = currentUser?.custom_fields || {};
    const cfUser = currentUser?.user_fields || {};

    if (
      findTruthyFieldMatch(cfCustom, directCandidates) ||
      findTruthyFieldMatch(cfUser, directCandidates)
    ) return true;

    const resolvedId = await resolveUserFieldIdForAdmins();
    const resolvedCandidates = resolvedId ? normalizedFieldKeyVariants(resolvedId) : [];

    if (resolvedCandidates.length) {
      if (
        findTruthyFieldMatch(cfCustom, resolvedCandidates) ||
        findTruthyFieldMatch(cfUser, resolvedCandidates)
      ) return true;
    }

    const fullUser = await fetchFullCurrentUser();
    const fuFields = fullUser?.user_fields || {};
    const fuCustom = fullUser?.custom_fields || {};

    if (
      findTruthyFieldMatch(fuFields, directCandidates) ||
      findTruthyFieldMatch(fuCustom, directCandidates)
    ) return true;

    if (resolvedCandidates.length) {
      if (
        findTruthyFieldMatch(fuFields, resolvedCandidates) ||
        findTruthyFieldMatch(fuCustom, resolvedCandidates)
      ) return true;
    }

    return false;
  }

  // ─── Event handlers ──────────────────────────────────────────────────────────

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
    if (!target.closest(".topic-hover-card")) return;

    if (target.closest("[data-thc-close]")) {
      event.preventDefault();
      event.stopPropagation();
      hideCard();
      return;
    }

    if (target.closest("[data-thc-open-topic]")) {
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
    if (!link || !linkInSupportedArea(link, config, settings)) return;
    const topicId = topicIdFromHref(link.href);
    if (!topicId) return;
    scheduleShow(topicId, link);
  }

  function onMouseOut(event) {
    if (viewport.isMobileInteractionMode()) return;
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest("a[href]");
    if (!link || !linkInSupportedArea(link, config, settings)) return;
    scheduleHide();
  }

  function onTouchStart(event) {
    if (!viewport.isMobileInteractionMode() || !config.mobileEnabled) return;
    if (!(event.target instanceof Element)) return;
    if (event.target.closest(TOOLTIP_SELECTOR)) return;
    const link = event.target.closest("a[href]");
    if (!link || !linkInSupportedArea(link, config, settings)) return;
    const topicId = topicIdFromHref(link.href);
    if (!topicId) return;
    event.preventDefault();
    event.stopPropagation();
    suppressNextClick = true;
    resetSuppressedClickSoon();
    showCard(topicId, link);
  }

  function onDocumentClick(event) {
    if (!viewport.isMobileInteractionMode() || !config.mobileEnabled) return;
    if (!(event.target instanceof Element)) return;
    if (suppressNextClick) {
      const link = event.target.closest("a[href]");
      if (link && linkInSupportedArea(link, config, settings) && topicIdFromHref(link.href)) {
        event.preventDefault();
        event.stopPropagation();
        suppressNextClick = false;
        return;
      }
    }
    if (event.target.closest(TOOLTIP_SELECTOR)) return;
    if (tooltipEl?.classList.contains("is-visible")) hideCard();
    suppressNextClick = false;
  }

  function onScroll(event) {
    if (event.target?.closest?.(".topic-hover-card, .topic-hover-card-tooltip")) return;
    cancel(showTimer);
    hideCard();
    suppressNextClick = false;
  }

  function onResize() {
    if (tooltipEl?.classList.contains("is-visible")) hideCard();
    suppressNextClick = false;
  }

  // ─── Bind ────────────────────────────────────────────────────────────────────

  function bindEvents() {
    ensureTooltip();
    addCleanup(tooltipEl, "mouseenter", onTooltipMouseEnter);
    addCleanup(tooltipEl, "mouseleave", onTooltipMouseLeave);
    addCleanup(tooltipEl, "click", onTooltipClick);
    addCleanup(document, "mouseover", onMouseOver, { passive: true });
    addCleanup(document, "mouseout", onMouseOut, { passive: true });
    addCleanup(document, "touchstart", onTouchStart, { passive: false });
    addCleanup(document, "click", onDocumentClick, true);
    addCleanup(document, "scroll", onScroll, { passive: true, capture: true });
    addCleanup(window, "resize", onResize, { passive: true });
  }

  // ─── Boot ────────────────────────────────────────────────────────────────────

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
      currentTopicId = null;
      suppressNextClick = false;
    });

    // Cleanup on full teardown (e.g. user logs out, theme is toggled off)
    api.cleanupStream(runCleanup);

    logDebug(config, "Hover cards initialized", {
      mobileEnabled: config.mobileEnabled,
      topicCacheMax: config.topicCacheMax,
      configuredField: config.userPreferenceFieldName,
      currentViewportIsMobile: viewport.isMobileInteractionMode(),
    });
  })().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[topic-hover-cards] Fatal init error:", error);
    runCleanup();
  });
});
