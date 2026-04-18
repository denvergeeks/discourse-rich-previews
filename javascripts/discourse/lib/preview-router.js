import { topicIdFromHref } from "./hover-preview-utils";
import { matchesWikipediaTarget } from "./providers/wikipedia-provider";

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

  const topicId = topicIdFromHref(link.href);
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

  if (!matchesWikipediaTarget(link)) {
    return null;
  }

  try {
    const url = new URL(link.href, window.location.origin);
    const pageKey = decodeURIComponent(url.pathname.replace(/^\/wiki\//, ""));

    return {
      type: "wikipedia",
      key: `wikipedia:${url.hostname}:${pageKey}`,
      host: url.hostname,
      pageKey,
      link,
    };
  } catch {
    return null;
  }
}