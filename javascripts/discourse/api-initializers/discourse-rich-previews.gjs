import { later, cancel } from "@ember/runloop";
import { apiInitializer } from "discourse/lib/api";

import {
  DELAY_HIDE,
  VIEWPORT_MARGIN,
  TOOLTIP_ID,
  TOOLTIP_SELECTOR,
  readConfig,
  logDebug,
  providerColor,
  providerTimeoutMs,
  createViewportState,
  getCachedValue,
  setCachedValue,
  getJSON,
  linkInSupportedArea,
  normalizedFieldKeyVariants,
  findTruthyFieldMatch,
  currentUserIsStaffLike,
  composerButtonShouldShow,
} from "../lib/rich-preview-utils";

import { matchPreviewTarget } from "../lib/preview-router";

import {
  buildPreviewHTML,
  buildLoadingPreviewHTML,
  buildErrorPreviewHTML,
  buildRootAttrsForTarget,
} from "../lib/preview-renderer";

import { createTopicProvider } from "../lib/providers/topic-provider";
import { createWikipediaProvider } from "../lib/providers/wikipedia-provider";
import { createExternalProvider } from "../lib/providers/external-provider";

import { registerPreviewBBCode } from "../lib/preview-bbcode";
import { registerPreviewComposerButton } from "../lib/preview-composer-button";

function getSiteCategories(api) {
  return api.container.lookup("service:site")?.categories || [];
}

export default apiInitializer(async (api) => {
  let cleanupFns = [];
  let tooltip = null;
  let showTimer = null;
  let hideTimer = null;
  let clearSuppressionTimer = null;
  let currentAbortController = null;

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

  try {
    const config = readConfig(settings);

    if (!config.enabled) {
      return;
    }

    registerPreviewBBCode(api, config);

    if (composerButtonShouldShow(config)) {
      registerPreviewComposerButton(api, config);
    }

    const categories = getSiteCategories(api);
    const currentUser = api.getCurrentUser?.() || null;
    const viewport = createViewportState();

    let currentPreviewKey = null;
    let currentRequestId = 0;
    let currentAnchor = null;
    let currentTarget = null;
    let isInsideCard = false;
    let mouseIsOverAnchor = false;
    let suppressNextClick = false;
    let resolvedUserFieldId = null;
    let resolvedUserFieldIdPromise = null;

    const topicCache = new Map();
    const renderCache = new Map();
    const previewCache = new Map();
    const inFlightFetches = new Map();

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
    const externalProvider = createExternalProvider(
      config,
      previewCache,
      inFlightFetches
    );

    function providerForTarget(target) {
      switch (target?.providerKey) {
        case "topic":
        case "remote_topic":
          return topicProvider;
        case "wikipedia":
          return wikipediaProvider;
        case "external":
          return externalProvider;
        default:
          return null;
      }
    }

    function ensureTooltip() {
      if (tooltip?.isConnected) {
        return;
      }

      tooltip = document.querySelector(TOOLTIP_SELECTOR);

      if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.id = TOOLTIP_ID;
        tooltip.setAttribute("role", "tooltip");
        tooltip.setAttribute("aria-live", "polite");
        document.body.appendChild(tooltip);

        cleanupFns.push(() => {
          if (tooltip?.isConnected) {
            tooltip.remove();
          }
          tooltip = null;
        });
      }

      tooltip.style.setProperty("--thc-width", config.cardWidth);
      tooltip.style.setProperty(
        "--thc-mobile-width",
        `${config.mobileWidthPercent}vw`
      );
    }

    function setTooltipVisible(visible) {
      ensureTooltip();

      tooltip.classList.toggle("is-visible", visible);

      if (!visible) {
        tooltip.style.removeProperty("--thc-provider-color");
      }
    }

    function applyTooltipProviderColor(providerKey) {
      ensureTooltip();

      const color = providerColor(providerKey, config, "var(--tertiary)");

      if (color) {
        tooltip.style.setProperty("--thc-provider-color", color);
      } else {
        tooltip.style.setProperty("--thc-provider-color", "var(--tertiary)");
      }
    }

    function positionTooltip(anchorRect) {
      if (!tooltip) {
        return;
      }

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
      const id =
        preview?.id ?? preview?.key ?? preview?.url ?? preview?.title ?? "";
      return `${preview?.type || "unknown"}:${id}:${isMobile ? "mobile" : "desktop"}`;
    }

    function getRenderedCard(preview, isMobile) {
      const key = getRenderCacheKey(preview, isMobile);
      const cached = getCachedValue(renderCache, key);

      if (cached) {
        return cached;
      }

      const html = buildPreviewHTML(preview, categories, config, isMobile);
      setCachedValue(renderCache, key, html, config.topicCacheMax * 2);

      return html;
    }

    function abortCurrentRequest() {
      if (!currentAbortController) {
        return;
      }

      const controller = currentAbortController;
      currentAbortController = null;

      if (!controller.signal.aborted) {
        controller.abort(
          new DOMException("Preview request canceled", "AbortError")
        );
      }
    }

    function clearCurrentAnchorDescription() {
      if (currentAnchor?.removeAttribute) {
        currentAnchor.removeAttribute("aria-describedby");
      }

      currentAnchor = null;
      currentTarget = null;
    }

    function linkStillOwnsPreview(link, target) {
      if (!link?.matches?.("a[href]") || !target) {
        return false;
      }

      const freshTarget = matchPreviewTarget(link, config);
      return freshTarget?.key === target.key;
    }

    function hideCard() {
      abortCurrentRequest();

      if (!tooltip) {
        return;
      }

      setTooltipVisible(false);
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
        if (!isInsideCard && !mouseIsOverAnchor) {
          hideCard();
        }
        suppressNextClick = false;
      }, DELAY_HIDE);
    }

    function scheduleShow(target, anchorRect, anchorEl) {
      cancel(showTimer);
      cancel(hideTimer);

      showTimer = later(() => {
        currentAnchor = anchorEl || null;
        currentTarget = target || null;
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
      if (!target) {
        return null;
      }

      const provider = providerForTarget(target);

      if (!provider) {
        throw new Error(
          `No provider for target: ${target?.providerKey || "unknown"}`
        );
      }

      return provider.fetch(target, signal);
    }

    async function showCard(target, anchorRect) {
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

      const controller = new AbortController();
      currentAbortController = controller;
      currentPreviewKey = target.key;
      currentTarget = target;
      const requestId = ++currentRequestId;

      applyTooltipProviderColor(target?.providerKey || target?.type || "topic");

      const loadingAttrs = buildRootAttrsForTarget(
        target,
        config,
        target?.type || "topic"
      );

      tooltip.innerHTML = buildLoadingPreviewHTML(loadingAttrs);
      setTooltipVisible(true);
      positionTooltipNextFrame(anchorRect);

      try {
        const preview = await fetchPreview(target, controller.signal);

        if (
          controller.signal.aborted ||
          !tooltip ||
          currentAbortController !== controller ||
          currentPreviewKey !== target.key ||
          requestId !== currentRequestId
        ) {
          return;
        }

        if (
          !viewport.isMobileInteractionMode() &&
          !mouseIsOverAnchor &&
          !isInsideCard &&
          !linkStillOwnsPreview(currentAnchor, currentTarget)
        ) {
          hideCard();
          return;
        }

        if (!preview) {
          applyTooltipProviderColor(
            target?.providerKey || target?.type || "topic"
          );

          const errorAttrs = buildRootAttrsForTarget(
            target,
            config,
            target?.type || "topic"
          );

          tooltip.innerHTML = buildErrorPreviewHTML(
            "No preview available.",
            errorAttrs
          );
          positionTooltipNextFrame(anchorRect);
          return;
        }

        applyTooltipProviderColor(
          preview?.providerKey ||
            preview?.type ||
            target?.providerKey ||
            "topic"
        );

        tooltip.innerHTML = getRenderedCard(
          preview,
          viewport.isMobileLayout()
        );
        positionTooltipNextFrame(anchorRect);
      } catch (error) {
        if (error?.name === "AbortError" || controller.signal.aborted) {
          return;
        }

        console.error("[discourse-rich-previews] Could not load preview", {
          target,
          error,
        });

        logDebug(config, "Could not load preview", { target, error });

        if (
          !tooltip ||
          currentAbortController !== controller ||
          currentPreviewKey !== target.key ||
          requestId !== currentRequestId
        ) {
          return;
        }

        applyTooltipProviderColor(target?.providerKey || target?.type || "topic");

        const errorAttrs = buildRootAttrsForTarget(
          target,
          config,
          target?.type || "topic"
        );

        tooltip.innerHTML = buildErrorPreviewHTML(
          "Could not load preview.",
          errorAttrs
        );
        positionTooltipNextFrame(anchorRect);
      }
    }

    async function resolveUserFieldIdForAdmins() {
      if (!config.resolveUserFieldIdForAdmins) {
        return null;
      }

      if (!currentUserIsStaffLike(currentUser)) {
        return null;
      }

      if (!config.userPreferenceFieldName) {
        return null;
      }

      const raw = String(config.userPreferenceFieldName).trim();

      if (/^\d+$/.test(raw)) {
        return raw;
      }

      if (/^user_field_\d+$/i.test(raw)) {
        return raw.match(/\d+/)?.[0] ?? null;
      }

      if (resolvedUserFieldId !== null) {
        return resolvedUserFieldId;
      }

      if (resolvedUserFieldIdPromise) {
        return resolvedUserFieldIdPromise;
      }

      resolvedUserFieldIdPromise = getJSON("/admin/config/user-fields.json")
        .then((result) => {
          const fields = Array.isArray(result)
            ? result
            : result?.user_fields || [];

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
      if (!currentUser?.username) {
        return null;
      }

      try {
        const store = api.container.lookup("service:store");
        return (await store.find("user", currentUser.username)) || null;
      } catch (error) {
        logDebug(config, "Could not fetch full current user record", error);
        return null;
      }
    }

    async function hoverCardsDisabledForUser() {
      if (!currentUser || !config.userPreferenceFieldName) {
        return false;
      }

      const directCandidates = normalizedFieldKeyVariants(
        config.userPreferenceFieldName
      );

      const currentUserCustomFields = currentUser?.custom_fields || {};
      const currentUserUserFields = currentUser?.user_fields || {};

      let match =
        findTruthyFieldMatch(currentUserCustomFields, directCandidates) ||
        findTruthyFieldMatch(currentUserUserFields, directCandidates);

      if (match) {
        return true;
      }

      const resolvedId = await resolveUserFieldIdForAdmins();
      const resolvedCandidates = resolvedId
        ? normalizedFieldKeyVariants(resolvedId)
        : [];

      if (resolvedCandidates.length) {
        match =
          findTruthyFieldMatch(currentUserCustomFields, resolvedCandidates) ||
          findTruthyFieldMatch(currentUserUserFields, resolvedCandidates);

        if (match) {
          return true;
        }
      }

      const fullUser = await fetchFullCurrentUser();
      const fullUserFields = fullUser?.user_fields || {};
      const fullUserCustomFields = fullUser?.custom_fields || {};

      match =
        findTruthyFieldMatch(fullUserFields, directCandidates) ||
        findTruthyFieldMatch(fullUserCustomFields, directCandidates);

      if (match) {
        return true;
      }

      if (resolvedCandidates.length) {
        match =
          findTruthyFieldMatch(fullUserFields, resolvedCandidates) ||
          findTruthyFieldMatch(fullUserCustomFields, resolvedCandidates);

        if (match) {
          return true;
        }
      }

      return false;
    }

    function onTooltipMouseEnter() {
      isInsideCard = true;
      mouseIsOverAnchor = false;
      cancel(hideTimer);
    }

    function onTooltipMouseLeave() {
      isInsideCard = false;
      scheduleHide();
    }

    function onTooltipClick(event) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const inCard = target.closest(".topic-hover-card");
      if (!inCard) {
        return;
      }

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
      if (viewport.isMobileInteractionMode()) {
        return;
      }

      if (!(event.target instanceof Element)) {
        return;
      }

      const link = event.target.closest("a[href]");
      if (!link || !linkInSupportedArea(link, config)) {
        return;
      }

      const related = event.relatedTarget;
      if (related instanceof Element && link.contains(related)) {
        return;
      }

      const target = matchPreviewTarget(link, config);
      if (!target) {
        return;
      }

      mouseIsOverAnchor = true;
      currentAnchor = link;
      currentTarget = target;
      scheduleShow(target, link.getBoundingClientRect(), link);
    }

    function onMouseOut(event) {
      if (viewport.isMobileInteractionMode()) {
        return;
      }

      if (!(event.target instanceof Element)) {
        return;
      }

      const link = event.target.closest("a[href]");
      if (!link || !linkInSupportedArea(link, config)) {
        return;
      }

      const related = event.relatedTarget;

      if (related instanceof Element) {
        if (link.contains(related)) {
          return;
        }

        if (currentAnchor?.contains?.(related)) {
          return;
        }

        if (related.closest?.(TOOLTIP_SELECTOR)) {
          return;
        }
      }

      mouseIsOverAnchor = false;
      cancel(showTimer);
      scheduleHide();
    }

    function onTouchStart(event) {
      if (!viewport.isMobileInteractionMode() || !config.mobileEnabled) {
        return;
      }

      if (!(event.target instanceof Element)) {
        return;
      }

      if (event.target.closest(TOOLTIP_SELECTOR)) {
        return;
      }

      const link = event.target.closest("a[href]");
      if (!link || !linkInSupportedArea(link, config)) {
        return;
      }

      const target = matchPreviewTarget(link, config);
      if (!target) {
        return;
      }

      currentAnchor = link;
      currentTarget = target;
      event.preventDefault();
      event.stopPropagation();
      suppressNextClick = true;
      resetSuppressedClickSoon();
      showCard(target, link.getBoundingClientRect());
    }

    function onDocumentClick(event) {
      if (!viewport.isMobileInteractionMode() || !config.mobileEnabled) {
        return;
      }

      if (!(event.target instanceof Element)) {
        return;
      }

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

      if (event.target.closest(TOOLTIP_SELECTOR)) {
        return;
      }

      if (tooltip?.classList.contains("is-visible")) {
        hideCard();
      }

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

    function setupPrefetch() {
      if (!config.prefetchEnabled) {
        return;
      }

      const prefetched = new Set(); // hrefs we've already attempted
      const queue = [];
      let inFlight = 0;

      const maxConcurrent = config.prefetchMaxConcurrent || 3;
      const maxPerPage = config.prefetchMaxPerPage || 30;

      function processQueue() {
        if (!queue.length || inFlight >= maxConcurrent) {
          return;
        }

        while (queue.length && inFlight < maxConcurrent) {
          const target = queue.shift();
          if (!target) {
            continue;
          }

          const controller = new AbortController();
          const timeoutMs = providerTimeoutMs(
            target.providerKey,
            config,
            3000
          );
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          inFlight += 1;

          fetchPreview(target, controller.signal)
            .catch(() => {
              // swallow prefetch errors; hover will still try later
            })
            .finally(() => {
              clearTimeout(timeoutId);
              inFlight -= 1;
              processQueue();
            });
        }
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) {
              continue;
            }

            const link = entry.target;
            const href = link?.href;

            if (!href) {
              continue;
            }

            if (prefetched.has(href)) {
              observer.unobserve(link);
              continue;
            }

            if (prefetched.size >= maxPerPage) {
              // Don't prefetch more links on this page
              observer.unobserve(link);
              continue;
            }

            if (!linkInSupportedArea(link, config)) {
              observer.unobserve(link);
              continue;
            }

            const target = matchPreviewTarget(link, config);
            if (!target) {
              observer.unobserve(link);
              continue;
            }

            prefetched.add(href);
            observer.unobserve(link);

            queue.push(target);
          }

          processQueue();
        },
        {
          rootMargin: config.prefetchViewportMargin,
          threshold: 0,
        }
      );

      function observeLinks(root = document) {
        root.querySelectorAll("a[href]").forEach((link) => {
          if (linkInSupportedArea(link, config)) {
            observer.observe(link);
          }
        });
      }

      observeLinks();

      const mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof Element)) {
              continue;
            }

            if (
              node.matches?.("a[href]") &&
              linkInSupportedArea(node, config)
            ) {
              observer.observe(node);
            }

            node.querySelectorAll?.("a[href]").forEach((link) => {
              if (linkInSupportedArea(link, config)) {
                observer.observe(link);
              }
            });
          }
        }
      });

      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });

      cleanupFns.push(() => {
        observer.disconnect();
        mutationObserver.disconnect();
        queue.length = 0;
      });
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
      addCleanup(document, "scroll", onScroll, {
        passive: true,
        capture: true,
      });
      addCleanup(window, "resize", onResize, { passive: true });

      setupPrefetch();
    }

    function applyBodyClasses() {
      const body = document.body;
      if (!body) {
        return;
      }

      body.classList.remove(
        "previews-underline-always",
        "previews-underline-hover",
        "previews-icon-before",
        "previews-icon-after"
      );

      if (config.previewsShowUnderline) {
        body.classList.add(
          config.previewsUnderlineAlways
            ? "previews-underline-always"
            : "previews-underline-hover"
        );
      }

      if (config.previewsShowIcon) {
        body.classList.add(
          config.previewsIconPosition === "before"
            ? "previews-icon-before"
            : "previews-icon-after"
        );
      }
    }

    const disabledForUser = await hoverCardsDisabledForUser();

    if (disabledForUser) {
      logDebug(config, "Hover cards disabled for current user");
      return;
    }

    bindEvents();
    applyBodyClasses();

    api.onPageChange(() => {
      cancel(showTimer);
      cancel(hideTimer);
      cancel(clearSuppressionTimer);

      hideCard();
      currentPreviewKey = null;
      suppressNextClick = false;
      mouseIsOverAnchor = false;
      isInsideCard = false;
      clearCurrentAnchorDescription();
      applyBodyClasses();
    });

    logDebug(config, "Hover cards initialized", {
      mobileEnabled: config.mobileEnabled,
      topicCacheMax: config.topicCacheMax,
      configuredField: config.userPreferenceFieldName,
      currentViewportIsMobile: viewport.isMobileInteractionMode(),
      densityDesktop: config.densityDesktop,
      densityMobile: config.densityMobile,
      previewLayout: config.previewLayout,
      thumbnailPlacementDesktop: config.thumbnailPlacementDesktop,
      thumbnailPlacementMobile: config.thumbnailPlacementMobile,
      thumbnailSizeModeDesktop: config.thumbnailSizeModeDesktop,
      thumbnailSizeModeMobile: config.thumbnailSizeModeMobile,
      thumbnailSizePercentDesktop: config.thumbnailSizePercentDesktop,
      thumbnailSizePercentMobile: config.thumbnailSizePercentMobile,
      previewsTopicMode: config.previewsTopicMode,
      previewsRemoteTopicMode: config.previewsRemoteTopicMode,
      previewsExternalMode: config.previewsExternalMode,
      previewsWikipediaMode: config.previewsWikipediaMode,
      wikipediaBaseUrl: config.wikipediaBaseUrl,
      wikipediaShowImage: config.wikipediaShowImage,
      wikipediaUseExtractHtml: config.wikipediaUseExtractHtml,
    });
  } catch (error) {
    console.error("[discourse-rich-previews] Fatal init error:", error);
    runCleanup();
  }
});