import {
  getPreviewProvider,
  sanitizeExcerpt,
  sanitizeURL,
} from "../rich-preview-utils";

function textValue(value) {
  return String(value ?? "").trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = textValue(value);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function externalProviderConfig(config) {
  return getPreviewProvider(config, "external") || {};
}

function externalRequireHttps(config) {
  return externalProviderConfig(config)?.require_https !== false;
}

function externalTimeoutMs(config) {
  return externalProviderConfig(config)?.timeout_ms || 3000;
}

function normalizedHostname(url) {
  try {
    return new URL(url, window.location.origin).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function buildProxyUrl(target) {
  const url = new URL("/discourse-proxy-safe/fetch.json", window.location.origin);
  url.searchParams.set("url", target.url);
  return url.toString();
}

function normalizeImageUrl(rawUrl, baseUrl) {
  const safe = sanitizeURL(rawUrl);
  if (safe) {
    return safe;
  }

  if (!rawUrl || !baseUrl) {
    return "";
  }

  try {
    return sanitizeURL(new URL(rawUrl, baseUrl).toString());
  } catch {
    return "";
  }
}

function parseExternalHTML(html, target) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const meta = (selector) =>
    doc.querySelector(selector)?.getAttribute("content")?.trim() || "";

  return {
    title:
      meta('meta[property="og:title"]') ||
      meta('meta[name="twitter:title"]') ||
      doc.querySelector("title")?.textContent?.trim() ||
      doc.querySelector("h1")?.textContent?.trim() ||
      "",
    description:
      meta('meta[property="og:description"]') ||
      meta('meta[name="twitter:description"]') ||
      meta('meta[name="description"]') ||
      "",
    siteName:
      meta('meta[property="og:site_name"]') || normalizedHostname(target.url),
    image:
      meta('meta[property="og:image"]') ||
      meta('meta[name="twitter:image"]') ||
      "",
  };
}

function parseExternalText(text, target) {
  const trimmed = textValue(text);

  return {
    title: target?.hostname || normalizedHostname(target?.url),
    description: trimmed,
    siteName: target?.hostname || normalizedHostname(target?.url),
    image: "",
  };
}

async function parseProxyResponse(response, target) {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const raw = await response.text();

  if (!raw.trim()) {
    return {};
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return parseExternalHTML(raw, target);
    }
  }

  if (contentType.includes("text/html")) {
    return parseExternalHTML(raw, target);
  }

  if (contentType.includes("text/plain")) {
    return parseExternalText(raw, target);
  }

  return parseExternalHTML(raw, target);
}

function normalizeExternalPreview(target, payload, config) {
  const title = firstNonEmpty(
    payload?.title,
    payload?.ogTitle,
    payload?.twitterTitle,
    target?.hostname
  );

  const siteName = firstNonEmpty(
    payload?.siteName,
    payload?.ogSiteName,
    payload?.publisher,
    target?.hostname
  );

  const excerpt = sanitizeExcerpt(
    firstNonEmpty(
      payload?.description,
      payload?.excerpt,
      payload?.ogDescription,
      payload?.twitterDescription,
      payload?.metaDescription
    ),
    config?.excerptExcludedSelectors || []
  );

  const imageUrl = firstNonEmpty(
    normalizeImageUrl(payload?.imageUrl, target?.url),
    normalizeImageUrl(payload?.image, target?.url),
    normalizeImageUrl(payload?.ogImage, target?.url),
    normalizeImageUrl(payload?.twitterImage, target?.url),
    normalizeImageUrl(payload?.thumbnail, target?.url)
  );

  return {
    type: "external",
    providerKey: "external",
    key: target.key,
    url: target.url,
    displayUrl: target.url,
    hostname: target.hostname || normalizedHostname(target.url),
    siteName,
    title,
    excerpt,
    description: excerpt,
    imageUrl,
    thumbnail: imageUrl,
    fetchedAt: Date.now(),
    raw: payload || {},
  };
}

export function matchesExternalTarget(link, config) {
  if (!(link instanceof HTMLAnchorElement)) {
    return false;
  }

  const href = link.getAttribute("href") || "";
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

    if (externalRequireHttps(config) && url.protocol !== "https:") {
      return false;
    }

    if (/(^|\.)wikipedia\.org$/i.test(url.hostname)) {
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

export function createExternalProvider(config) {
  return {
    key: "external",

    matches(link) {
      return matchesExternalTarget(link, config);
    },

    async fetch(target, signal) {
      if (!target?.url) {
        throw new Error("Missing external preview target URL.");
      }

      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(new DOMException("Timed out", "AbortError")),
        externalTimeoutMs(config)
      );

      const abortHandler = () =>
        controller.abort(new DOMException("Aborted", "AbortError"));

      signal?.addEventListener?.("abort", abortHandler, { once: true });

      try {
        const response = await fetch(buildProxyUrl(target), {
          method: "GET",
          credentials: "same-origin",
          headers: {
            Accept: "application/json, text/html;q=0.9, text/plain;q=0.8",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${target.url}`);
        }

        const payload = await parseProxyResponse(response, target);
        return normalizeExternalPreview(target, payload, config);
      } catch (error) {
        if (error?.name === "AbortError") {
          throw error;
        }

        throw error;
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener?.("abort", abortHandler);
      }
    },
  };
}
