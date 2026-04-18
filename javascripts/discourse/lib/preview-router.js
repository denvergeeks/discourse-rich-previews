import { parseTopicUrl } from "./hover-preview-utils";
import { matchesWikipediaTarget } from "./providers/wikipedia-provider";

function normalizeWikipediaPageKey(pathname) {
  return decodeURIComponent(pathname.replace(/^\/wiki\//, ""))
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchPreviewTarget(link, config) {
  if (!(link instanceof HTMLAnchorElement)) {
    return null;
  }

  const wikipediaTarget = matchWikipediaPreview(link, config);
  if (wikipediaTarget) {
    return wikipediaTarget;
  }

  const topicTarget = matchTopicPreview(link, config);
  if (topicTarget) {
    return topicTarget;
  }

  return null;
}

function matchTopicPreview(link, config) {
  if (!config?.enabled) {
    return null;
  }

  const parsed = parseTopicUrl(link.href);
  const topicId = parsed?.topicId;

  if (!topicId) {
    return null;
  }

  return {
    type: "topic",
    key: `topic:${topicId}`,
    topicId,
    link,
  };
}

function matchWikipediaPreview(link, config) {
  if (!config?.enabled) {
    return null;
  }

  if (!matchesWikipediaTarget(link, config)) {
    return null;
  }

  try {
    const url = new URL(link.href, window.location.origin);
    const host = url.hostname.toLowerCase();
    const pageKey = normalizeWikipediaPageKey(url.pathname);

    if (!pageKey) {
      return null;
    }

    return {
      type: "wikipedia",
      key: `wikipedia:${host}:${pageKey}`,
      host,
      pageKey,
      link,
    };
  } catch {
    return null;
  }
}