import {
  classifyLink,
  parsePreviewTopicUrl,
  providerKeyForTarget,
  previewTypeEnabled,
  sanitizeURL,
} from "./rich-preview-utils";

function buildKey(type, url, extra = "") {
  return `${type}:${url || "unknown"}:${extra || ""}`;
}

function buildTopicTarget(link, config, parsed) {
  if (!parsed?.url || !parsed?.topicId) {
    return null;
  }

  const type = "topic";
  const providerKey = parsed.isRemote ? "remote_topic" : "topic";

  if (!previewTypeEnabled(providerKey, config)) {
    return null;
  }

  const href = sanitizeURL(parsed.url.toString());

  if (!href) {
    return null;
  }

  return {
    type,
    providerKey,
    key: buildKey(providerKey, href, String(parsed.topicId)),
    href,
    url: href,
    topicId: parsed.topicId,
    postNumber: parsed.postNumber || null,
    slug: parsed.slug || "",
    isRemote: !!parsed.isRemote,
    origin: parsed.origin || "",
    hostname: parsed.hostname || "",
    jsonUrl: parsed.jsonUrl || null,
  };
}

function buildWikipediaTarget(link, config) {
  const href = sanitizeURL(link?.href);

  if (!href || !previewTypeEnabled("wikipedia", config)) {
    return null;
  }

  return {
    type: "wikipedia",
    providerKey: "wikipedia",
    key: buildKey("wikipedia", href),
    href,
    url: href,
  };
}

function buildExternalTarget(link, config) {
  const href = sanitizeURL(link?.href);

  if (!href || !previewTypeEnabled("external", config)) {
    return null;
  }

  return {
    type: "external",
    providerKey: "external",
    key: buildKey("external", href),
    href,
    url: href,
  };
}

export function matchPreviewTarget(link, config) {
  if (!(link instanceof HTMLAnchorElement)) {
    return null;
  }

  const classifiedType = classifyLink(link, config);

  switch (classifiedType) {
    case "topic": {
      const parsed = parsePreviewTopicUrl(link.href, config);
      return buildTopicTarget(link, config, parsed);
    }

    case "remote_topic": {
      const parsed = parsePreviewTopicUrl(link.href, config);
      return buildTopicTarget(link, config, parsed);
    }

    case "wikipedia":
      return buildWikipediaTarget(link, config);

    case "external":
      return buildExternalTarget(link, config);

    default:
      return null;
  }
}

export function previewProviderKeyForLink(link, config) {
  const target = matchPreviewTarget(link, config);
  return providerKeyForTarget(target) || null;
}