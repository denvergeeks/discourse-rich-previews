import {
  parseTopicUrl,
  parseRemoteDiscourseTopicUrl,
} from "./rich-preview-utils";
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

  const local = parseTopicUrl(link.href);
  if (local?.topicId) {
    return {
      type: "topic",
      key: `topic:${window.location.origin}:${local.topicId}`,
      topicId: local.topicId,
      slug: local.slug || "",
      postNumber: local.postNumber ?? null,
      origin: window.location.origin,
      hostname: window.location.hostname,
      isRemote: false,
      link,
    };
  }

  const remote = parseRemoteDiscourseTopicUrl(link.href, config);
  if (remote?.topicId) {
    return {
      type: "topic",
      key: `topic:${remote.origin}:${remote.topicId}`,
      topicId: remote.topicId,
      slug: remote.slug || "",
      postNumber: remote.postNumber ?? null,
      origin: remote.origin,
      hostname: remote.hostname,
      isRemote: true,
      link,
    };
  }

  return null;
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