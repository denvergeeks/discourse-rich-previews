import { logDebug, sanitizeExcerpt } from "../hover-preview-utils";

const WIKIPEDIA_HOST_RE = /(^|\.)wikipedia\.org$/i;

export function matchesWikipediaTarget(link) {
  if (!settings.hover_previews_enable_wikipedia) {
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

function getWikipediaHost(link) {
  try {
    const url = new URL(link.href, window.location.origin);

    return (
      url.hostname ||
      settings.hover_previews_wikipedia_base_url ||
      "en.wikipedia.org"
    );
  } catch {
    return settings.hover_previews_wikipedia_base_url || "en.wikipedia.org";
  }
}

function getWikipediaTitle(link) {
  try {
    const url = new URL(link.href, window.location.origin);
    return decodeURIComponent(url.pathname.replace(/^\/wiki\//, ""));
  } catch {
    return link.textContent?.trim() || "";
  }
}

export function createWikipediaProvider(config, previewCache, inFlightFetches) {
  return {
    async fetch(target, signal) {
      const link = target?.link;
      if (!link) {
        return null;
      }

      const host = getWikipediaHost(link);
      const title = getWikipediaTitle(link);

      if (!title) {
        return null;
      }

      const cacheKey = `wikipedia:${host}:${title}`;

      if (previewCache.has(cacheKey)) {
        return previewCache.get(cacheKey);
      }

      if (inFlightFetches.has(cacheKey)) {
        return inFlightFetches.get(cacheKey);
      }

      const promise = fetchWikipediaPreview(host, title, config, signal)
        .then((data) => {
          if (data) {
            previewCache.set(cacheKey, data);
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
      settings.wikipedia_preview_use_extract_html !== false
        ? summary?.extract_html || null
        : null,
    image_url:
      settings.wikipedia_preview_show_image !== false
        ? summary?.thumbnail?.source || null
        : null,
    url:
      summary?.content_urls?.desktop?.page ||
      `https://${host}/wiki/${page.key}`,
    raw: {
      search: searchData,
      summary,
      page,
    },
  };

  logDebug(config, "Wikipedia preview fetched", result);
  return result;
}