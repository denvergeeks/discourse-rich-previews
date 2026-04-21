import {
  getCachedValue,
  setCachedValue,
  getJSON,
  sanitizeExcerpt,
  safeRemoteAvatarURL,
} from "../rich-preview-utils";

export function createTopicProvider(api, config, topicCache, inFlightFetches) {
  async function fetchTopic(target, signal) {
    const topicId = target?.topicId;
    const origin = target?.origin || window.location.origin;
    const isRemote = origin !== window.location.origin;

    if (!topicId) {
      return null;
    }

    if (!isRemote) {
      const store = api.container.lookup("service:store");
      const storeRecord = store?.peekRecord?.("topic", topicId);

      if (storeRecord) {
        return storeRecord;
      }
    }

    const cacheKey = `${origin}:topic:${topicId}`;
    const cached = getCachedValue(topicCache, cacheKey);
    if (cached) {
      return cached;
    }

    const inflightKey = `topic:${origin}:${topicId}`;
    if (inFlightFetches.has(inflightKey)) {
      return inFlightFetches.get(inflightKey);
    }

    const jsonUrl = isRemote
      ? `${origin}/t/${topicId}.json`
      : `/t/${topicId}.json`;

    const promise = getJSON(jsonUrl, {
      signal,
    })
      .then((data) => {
        setCachedValue(topicCache, cacheKey, data, config.topicCacheMax);
        return data;
      })
      .finally(() => {
        inFlightFetches.delete(inflightKey);
      });

    inFlightFetches.set(inflightKey, promise);
    return promise;
  }

  function extractFirstImageURLFromCooked(cooked) {
    if (!cooked) {
      return "";
    }

    const temp = document.createElement("div");
    temp.innerHTML = String(cooked);
    const img = temp.querySelector("img");
    return img?.getAttribute("src") || "";
  }

  function normalizeTopic(topic, target) {
    const firstPost = topic?.post_stream?.posts?.[0];
    const origin = target?.origin || window.location.origin;
    const isRemote = origin !== window.location.origin;

    const excerptSource =
      topic?.excerpt || firstPost?.excerpt || firstPost?.cooked || "";

    const imageUrl =
      topic?.image_url ||
      topic?.topic_image ||
      extractFirstImageURLFromCooked(firstPost?.cooked) ||
      null;

    return {
      type: "topic",
      id: `${isRemote ? origin : "local"}:topic:${topic.id}`,
      title: topic?.fancy_title ?? topic?.title ?? "(no title)",
      excerpt: sanitizeExcerpt(
        excerptSource,
        config.excerptExcludedSelectors
      ),
      html: null,
      image_url: imageUrl,
      url: `${origin}/t/${topic?.slug || topic?.id}/${topic?.id}`,
      raw: {
        ...topic,
        op_avatar_url: isRemote
          ? safeRemoteAvatarURL(origin, firstPost?.avatar_template, 24)
          : null,
        op_username: firstPost?.username || "",
        external_source_host: isRemote ? target?.hostname || "" : "",
        is_remote_discourse_topic: isRemote,
      },
    };
  }

  return {
    async fetch(target, signal) {
      if (!target?.topicId) {
        return null;
      }

      const topic = await fetchTopic(target, signal);
      if (!topic) {
        return null;
      }

      return normalizeTopic(topic, target);
    },
  };
}