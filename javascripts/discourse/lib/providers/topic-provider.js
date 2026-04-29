import {
  getCachedValue,
  setCachedValue,
  getJSON,
  sanitizeExcerpt,
  safeRemoteAvatarURL,
} from "../rich-preview-utils";

const PROXY_ENDPOINT = "/discourse-proxy-safe";

async function fetchViaProxy(remoteJsonUrl, signal) {
  const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(remoteJsonUrl)}`;

  try {
    const response = await fetch(proxyUrl, {
      method: "GET",
      mode: "same-origin",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`Proxy error ${response.status} for ${remoteJsonUrl}`);
    }

    const text = await response.text();
    return JSON.parse(text);
  } catch (error) {
    if (error?.name === "AbortError" || signal?.aborted) {
      return null;
    }

    throw error;
  }
}

export function createTopicProvider(api, config, topicCache, inFlightFetches) {
  async function fetchTopic(target, signal) {
    const topicId = target?.topicId;
    const origin = target?.origin || window.location.origin;
    const isRemote = origin !== window.location.origin;

    if (!topicId) {
      return null;
    }

    if (signal?.aborted) {
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
      try {
        return await inFlightFetches.get(inflightKey);
      } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) {
          return null;
        }

        throw error;
      }
    }

    const jsonUrl = isRemote
      ? `${origin}/t/${topicId}.json`
      : `/t/${topicId}.json`;

    const promise = (async () => {
      try {
        const data = isRemote
          ? await fetchViaProxy(jsonUrl, signal)
          : await getJSON(jsonUrl, { signal });

        if (!data || signal?.aborted) {
          return null;
        }

        setCachedValue(topicCache, cacheKey, data, config.topicCacheMax);
        return data;
      } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) {
          return null;
        }

        throw error;
      } finally {
        inFlightFetches.delete(inflightKey);
      }
    })();

    inFlightFetches.set(inflightKey, promise);
    return await promise;
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
      if (!target?.topicId || signal?.aborted) {
        return null;
      }

      try {
        const topic = await fetchTopic(target, signal);

        if (!topic || signal?.aborted) {
          return null;
        }

        return normalizeTopic(topic, target);
      } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) {
          return null;
        }

        throw error;
      }
    },
  };
}