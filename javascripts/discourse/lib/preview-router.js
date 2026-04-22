import {
  parseTopicUrl,
  parseRemoteDiscourseTopicUrl,
  providerEnabled,
} from "./rich-preview-utils";
import { matchesWikipediaTarget } from "./providers/wikipedia-provider";
import { matchesExternalTarget } from "./providers/external-provider";

function normalizeWikipediaPageKey(pathname) {
  return decodeURIComponent(pathname.replace(/^\/wiki\//, ""))
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchPreviewTarget(link, config) {
  if (!(link instanceof HTMLAnchorElement) || !config?.enabled) {
    return null;
  }

  return (
    matchWikipediaPreview(link, config) ||
    matchTopicPreview(link, config) ||
    matchExternalPreview(link, config) ||
    null
  );
}

function matchTopicPreview(link, config) {
  const local = parseTopicUrl(link.href);

  if (local?.topicId && providerEnabled(config, "topic")) {
    return {
      type: "topic",
      providerKey: "topic",
      glyphProviderKey: "topic",
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

  if (remote?.topicId && providerEnabled(config, "remote_topic")) {
    return {
      type: "topic",
      providerKey: "remote_topic",
      glyphProviderKey: "remote_topic",
      key: `topic:${remote.origin}:${remote.topicId}`,
      topicId: remote.topicId,
      slug: remote.slug || "",
      postNumber: remote.postNumber ?? null,
      origin: remote.origin,
      hostname: remote.hostname,
      isRemote: true,
      jsonUrl: remote.jsonUrl,
      link,
    };
  }

  return null;
}

function matchWikipediaPreview(link, config) {
  if (!providerEnabled(config, "wikipedia")) {
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
      providerKey: "wikipedia",
      glyphProviderKey: "wikipedia",
      key: `wikipedia:${host}:${pageKey}`,
      host,
      pageKey,
      url: url.toString(),
      link,
    };
  } catch {
    return null;
  }
}

function matchExternalPreview(link, config) {
  if (!providerEnabled(config, "external")) {
    return null;
  }

  if (!matchesExternalTarget(link, config)) {
    return null;
  }

  try {
    const url = new URL(link.href, window.location.origin);

    return {
      type: "external",
      providerKey: "external",
      glyphProviderKey: "external",
      key: `external:${url.toString()}`,
      url: url.toString(),
      origin: url.origin,
      hostname: url.hostname.toLowerCase(),
      protocol: url.protocol,
      link,
    };
  } catch {
    return null;
  }
}