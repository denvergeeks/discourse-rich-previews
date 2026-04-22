import {
  getCachedValue,
  setCachedValue,
  logDebug,
  sanitizeExcerpt,
  sanitizeURL,
} from "../rich-preview-utils";

const PROXY_ENDPOINT = "/discourse-proxy-safe";

function getExternalProvider(config) {
  return config?.previewProviders?.external || null;
}

function externalProviderEnabled(config) {
  return getExternalProvider(config)?.enabled !== false;
}

function externalRequireHttps(config) {
  return getExternalProvider(config)?.require_https !== false;
}

function isDiscourseTopicPathname(pathname) {
  return /^\/t\/(?:[^/]+\/)?\d+(?:\/\d+)?\/?$/.test(pathname || "");
}

export function matchesExternalTarget(link, config) {
  if (!externalProviderEnabled(config)) {
    return false;
  }

  if (!(link instanceof HTMLAnchorElement)) {
    return false;
  }

  try {
    const url = new URL(link.href, window.location.origin);

    if (!/^https?:$/.test(url.protocol)) {
      return false;
    }

    if (externalRequireHttps(config) && url.protocol !== "https:") {
      return false;
    }

    if (url.origin === window.location.origin) {
      return false;
    }

    if (
      /(^|\\.)wikipedia\\.org$/i.test(url.hostname) &&
      url.pathname.startsWith("/wiki/")
    ) {
      return false;
    }

    if (isDiscourseTopicPathname(url.pathname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function extractMeta(doc, key, attr = "property") {
  return (
    doc.querySelector(`meta[${attr}="${key}"]`)?.getAttribute("content") || ""
  ).trim();
}

function extractTitle(doc) {
  return (
    extractMeta(doc, "og:title") ||
    extractMeta(doc, "twitter:title", "name") ||
    doc.querySelector("title")?.textContent ||
    ""
  ).trim();
}

function extractDescription(doc) {
  return sanitizeExcerpt(
    extractMeta(doc, "og:description") ||
      extractMeta(doc, "twitter:description", "name") ||
      extractMeta(doc, "description", "name") ||
      ""
  );
}

function extractImage(doc, baseUrl) {
  const raw =
    extractMeta(doc, "og:image") ||
    extractMeta(doc, "twitter:image", "name") ||
    "";

  if (!raw) {
    return null;
  }

  try {
    return sanitizeURL(new URL(raw, baseUrl).toString()) || null;
  } catch {
    return null;
  }
}

async function fetchViaProxy(targetUrl, signal) {
  const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(targetUrl)}`;
  const response = await fetch(proxyUrl, {
    method: "GET",
    mode: "same-origin",
    credentials: "same-origin",
    headers: {
      Accept: "text/html,application/xhtml+xml",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Proxy error ${response.status} for ${targetUrl}`);
  }

  return response.text();
}

function parseExternalPreview(html, targetUrl) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const title = extractTitle(doc);
  const excerpt = extractDescription(doc);
  const image_url = extractImage(doc, targetUrl);

  if (!title && !excerpt && !image_url) {
    return null;
  }

  return {
    type: "external",
    id: `external:${targetUrl}`,
    title: title || targetUrl,
    excerpt,
    html: null,
    image_url,
    url: targetUrl,
    raw: {
      site_name:
        extractMeta(doc, "og:site_name") ||
        new URL(targetUrl).hostname.replace(/^www\\./, ""),
      hostname: new URL(targetUrl).hostname,
    },
  };
}

export function createExternalProvider(config, previewCache, inFlightFetches) {
  return {
    async fetch(target, signal) {
      const url = target?.url;
      if (!url) return null;

      const cacheKey = `external:${url}`;
      const cached = getCachedValue(previewCache, cacheKey);
      if (cached) return cached;

      if (inFlightFetches.has(cacheKey)) {
        return inFlightFetches.get(cacheKey);
      }

      const promise = fetchViaProxy(url, signal)
        .then((html) => parseExternalPreview(html, url))
        .then((preview) => {
          if (preview) {
            setCachedValue(
              previewCache,
              cacheKey,
              preview,
              config?.topicCacheMax || 100
            );
            logDebug(config, "External preview fetched", preview);
          }
          return preview;
        })
        .finally(() => {
          inFlightFetches.delete(cacheKey);
        });

      inFlightFetches.set(cacheKey, promise);
      return promise;
    },
  };
}