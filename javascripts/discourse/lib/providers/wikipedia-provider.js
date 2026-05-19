import {
  logDebug,
  sanitizeExcerpt,
  getCachedValue,
  setCachedValue,
} from "../rich-preview-utils";

const WIKIPEDIA_HOST_RE = /(^|\.)wikipedia\.org$/i;

export function matchesWikipediaTarget(link, config) {
  if (config?.wikipediaEnabled === false) {
    return false;
  }

  if (!(link instanceof HTMLAnchorElement)) {
    return false;
  }

  try {
    const url = new URL(link.href, window.location.origin);

    return (
      WIKIPEDIA_HOST_RE.test(url.hostname) && url.pathname.startsWith("/wiki/")
    );
  } catch {
    return false;
  }
}

function getWikipediaUrl(target, config) {
  try {
    return new URL(
      target?.href || target?.url || "",
      window.location.origin
    );
  } catch {
    try {
      return new URL(`https://${config?.wikipediaBaseUrl || "en.wikipedia.org"}`);
    } catch {
      return null;
    }
  }
}

function getWikipediaHost(target, config) {
  const url = getWikipediaUrl(target, config);
  return url?.hostname || config?.wikipediaBaseUrl || "en.wikipedia.org";
}

function getWikipediaTitle(target, config) {
  const url = getWikipediaUrl(target, config);

  if (!url) {
    return "";
  }

  const path = url.pathname || "";

  if (!path.startsWith("/wiki/")) {
    return "";
  }

  try {
    return decodeURIComponent(path.replace(/^\/wiki\//, ""))
      .replaceAll("_", " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return path.replace(/^\/wiki\//, "").replaceAll("_", " ").trim();
  }
}

export function createWikipediaProvider(config, previewCache, inFlightFetches) {
  return {
    async fetch(target, signal) {
      if (!target || signal?.aborted) {
        return null;
      }

      const host = getWikipediaHost(target, config);
      const title = getWikipediaTitle(target, config);

      if (!title) {
        return null;
      }

      const cacheKey = `wikipedia:${host}:${title}`;
      const cached = getCachedValue(previewCache, cacheKey);

      if (cached) {
        return cached;
      }

      if (inFlightFetches.has(cacheKey)) {
        try {
          return await inFlightFetches.get(cacheKey);
        } catch (error) {
          if (error?.name === "AbortError" || signal?.aborted) {
            return null;
          }

          throw error;
        }
      }

      const promise = (async () => {
        try {
          const data = await fetchWikipediaPreview(host, title, config, signal);

          if (data) {
            setCachedValue(
              previewCache,
              cacheKey,
              data,
              config?.topicCacheMax || 100
            );
          }

          return data;
        } catch (error) {
          if (error?.name === "AbortError" || signal?.aborted) {
            return null;
          }

          throw error;
        } finally {
          inFlightFetches.delete(cacheKey);
        }
      })();

      inFlightFetches.set(cacheKey, promise);
      return await promise;
    },
  };
}

async function fetchWikipediaPreview(host, title, config, signal) {
  try {
    const headers = {
      "Api-User-Agent": "Discourse Rich Previews Wikipedia Provider",
    };

    const searchRes = await fetch(
      `https://${host}/w/rest.php/v1/search/page?q=${encodeURIComponent(
        title
      )}&limit=1`,
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
    const imageUrl =
      summary?.thumbnail?.source || summary?.originalimage?.source || null;

    return {
      type: "wikipedia",
      providerKey: "wikipedia",
      id: `wikipedia:${host}:${page.key}`,
      key: page.key,
      title: summary?.title || page.title || title,
      excerpt,
      imageUrl,
      url: `https://${host}/wiki/${encodeURIComponent(page.key)}`,
      source: host,
      raw: {
        page,
        summary,
      },
    };
  } catch (error) {
    if (error?.name === "AbortError" || signal?.aborted) {
      return null;
    }

    logDebug(config, "Wikipedia preview fetch failed", {
      host,
      title,
      error,
    });

    throw error;
  }
}