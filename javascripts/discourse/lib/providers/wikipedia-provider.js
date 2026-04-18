import {
  logDebug,
  sanitizeExcerpt,
  getCachedValue,
  setCachedValue,
} from "../hover-preview-utils";

const WIKIPEDIA_HOST_RE = /(^|\.)wikipedia\.org$/i;

export function matchesWikipediaTarget(link, config) {
  if (config?.hoverPreviewsEnableWikipedia === false) {
    return false;
  }

  if (!(link instanceof HTMLAnchorElement)) {
    return false;
  }

  try {
    const url = new URL(link.href, window.location.origin);

    return (
      WIKIPEDIA_HOST_RE.test(url.hostname) &&
      url.pathname.startsWith("/wiki/")
    );
  } catch {
    return false;
  }
}

function getWikipediaHost(link, config) {
  try {
    const url = new URL(link.href, window.location.origin);

    return (
      url.hostname ||
      config?.hoverPreviewsWikipediaBaseUrl ||
      "en.wikipedia.org"
    );
  } catch {
    return config?.hoverPreviewsWikipediaBaseUrl || "en.wikipedia.org";
  }
}

function getWikipediaTitle(link) {
  try {
    const url = new URL(link.href, window.location.origin);
    return decodeURIComponent(url.pathname.replace(/^\/wiki\//, ""))
      .replaceAll("_", " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return (link?.textContent || "").replace(/\s+/g, " ").trim();
  }
}

export function createWikipediaProvider(config, previewCache, inFlightFetches) {
  return {
    async fetch(target, signal) {
      const link = target?.link;
      if (!link) {
        return null;
      }

      const host = getWikipediaHost(link, config);
      const title = getWikipediaTitle(link);

      if (!title) {
        return null;
      }

      const cacheKey = `wikipedia:${host}:${title}`;

      const cached = getCachedValue(previewCache, cacheKey);
      if (cached) {
        return cached;
      }

      if (inFlightFetches.has(cacheKey)) {
        return inFlightFetches.get(cacheKey);
      }

      const promise = fetchWikipediaPreview(host, title, config, signal)
        .then((data) => {
          if (data) {
            setCachedValue(
              previewCache,
              cacheKey,
              data,
              config?.topicCacheMax || 100
            );
          }
          return data;
        })
        .finally(() => {
          inFlightFetches.delete(cacheKey);
        });

      inFlightFetches.set(cacheKey, promise);
      return promise;
    },
  };
}

async function fetchWikipediaPreview(host, title, config, signal) {
  const headers = {
    "Api-User-Agent": "Discourse Rich Previews Wikipedia Provider",
  };

  const searchRes = await fetch(
    `https://${host}/w/rest.php/v1/search/page?q=${encodeURIComponent(title)}&limit=1`,
    { headers, signal }
  );

  if (!searchRes.ok) {
    throw new Error(`Wikipedia search failed: ${searchRes.status}`);
  }

  const searchData = await searchRes.json();
  const page = searchData?.pages?.[0];

  if (!page?.key) {
    return null;
  }

  const summaryRes = await fetch(
    `https://${host}/api/rest_v1/page/summary/${encodeURIComponent(page.key)}`,
    { headers, signal }
  );

  let summary = null;
  if (summaryRes.ok) {
    summary = await summaryRes.json();
  }

  const excerpt = sanitizeExcerpt(page.excerpt || summary?.extract || "");

  const result = {
    type: "wikipedia",
    id: `wikipedia:${host}:${page.key}`,
    title: summary?.title || page.title || title,
    excerpt,
    html:
      config?.wikipediaPreviewUseExtractHtml !== false
        ? summary?.extract_html || null
        : null,
    image_url:
      config?.wikipediaPreviewShowImage !== false
        ? summary?.thumbnail?.source || null
        : null,
    url:
      summary?.content_urls?.desktop?.page ||
      `https://${host}/wiki/${encodeURIComponent(page.key)}`,
    raw: {
      search: searchData,
      summary,
      page,
    },
  };

  logDebug(config, "Wikipedia preview fetched", result);
  return result;
}