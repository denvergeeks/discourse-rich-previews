import {
  getCachedValue,
  setCachedValue,
  getJSON,
  sanitizeExcerpt,
  safeRemoteAvatarURL,
} from "../rich-preview-utils";

const PROXY_ENDPOINT = "/discourse-proxy-safe/fetch.json";

function buildProxyUrl(remoteJsonUrl) {
  const url = new URL(PROXY_ENDPOINT, window.location.origin);
  url.searchParams.set("url", remoteJsonUrl);
  return url.toString();
}

async function fetchViaProxy(remoteJsonUrl, signal) {
  const proxyUrl = buildProxyUrl(remoteJsonUrl);

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

    if (!text.trim()) {
      return null;
    }

    return JSON.parse(text);
  } catch (error) {
    if (error?.name === "AbortError" || signal?.aborted) {
      return null;
    }

    throw error;
  }
}

function extractFirstImageURLFromCooked(cooked) {
  if (!cooked) {
    return null;
  }

  const temp = document.createElement("div");
  temp.innerHTML = String(cooked);

  const img = temp.querySelector("img");
  return img?.getAttribute("src") || null;
}

function normalizeTopic(topic, target, config) {
  const firstPost =
    topic?.post_stream?.posts?.[0] || topic?.postStream?.posts?.[0];
  const origin = target?.origin || window.location.origin;
  const isRemote = origin !== window.location.origin;

  const excerptSource =
    topic?.excerpt || firstPost?.excerpt || firstPost?.cooked || "";

  const imageUrl =
    topic?.image_url ||
    topic?.imageUrl ||
    topic?.topic_image ||
    topic?.topicImage ||
    extractFirstImageURLFromCooked(firstPost?.cooked) ||
    null;

  const topicId = topic?.id ?? target?.topicId ?? null;
  const slug = topic?.slug || target?.slug || topicId;
  const url = topicId ? `${origin}/t/${slug}/${topicId}` : target?.url || null;

  const replyCount =
    topic?.reply_count ??
    topic?.replyCount ??
    Math.max((topic?.posts_count ?? topic?.postsCount ?? 1) - 1, 0);

  const likeCount =
    topic?.like_count ??
    topic?.likeCount ??
    topic?.like_score ??
    topic?.likeScore ??
    topic?.topic_post_like_count ??
    topic?.topicPostLikeCount ??
    0;

  const createdAt =
    topic?.created_at ??
    topic?.createdAt ??
    firstPost?.created_at ??
    firstPost?.createdAt ??
    null;

  const lastPostedAt =
    topic?.last_posted_at ??
    topic?.lastPostedAt ??
    topic?.bumped_at ??
    topic?.bumpedAt ??
    null;

  const bumpedAt = topic?.bumped_at ?? topic?.bumpedAt ?? null;

  const username =
    firstPost?.username ||
    topic?.details?.created_by?.username ||
    topic?.details?.createdBy?.username ||
    null;

  const avatarTemplate =
    firstPost?.avatar_template ||
    firstPost?.avatarTemplate ||
    topic?.details?.created_by?.avatar_template ||
    topic?.details?.createdBy?.avatarTemplate ||
    null;

  const avatarUrl = isRemote
    ? safeRemoteAvatarURL(origin, avatarTemplate, 24)
    : null;

  const categoryId = topic?.category_id ?? topic?.categoryId ?? null;

  const category =
    topic?.category ||
    (categoryId
      ? {
          id: categoryId,
          name: topic?.category_name || topic?.categoryName || null,
          slug: topic?.category_slug || topic?.categorySlug || null,
          color: topic?.category_color || topic?.categoryColor || null,
          textColor:
            topic?.category_text_color || topic?.categoryTextColor || null,
        }
      : null);

  const tags = Array.isArray(topic?.tags) ? topic.tags : [];

  return {
    type: "topic",
    providerKey: target?.providerKey || (isRemote ? "remote_topic" : "topic"),
    glyphProviderKey:
      target?.glyphProviderKey || (isRemote ? "remote_topic" : "topic"),
    id: isRemote ? `${origin}:${topicId}` : topicId,
    key: isRemote ? `${origin}:${topicId}` : String(topicId),
    topicId,
    slug,
    url,
    title:
      topic?.fancy_title ||
      topic?.fancyTitle ||
      topic?.title ||
      "Untitled topic",
    excerpt: sanitizeExcerpt(
      excerptSource,
      config?.excerptExcludedSelectors || []
    ),
    html: null,
    imageUrl,
    thumbnail: imageUrl,
    thumbnailUrl: imageUrl,
    views: topic?.views ?? 0,
    replyCount,
    likeCount,
    createdAt,
    lastPostedAt,
    bumpedAt,
    username,
    avatarUrl,
    avatarTemplate,
    author: username
      ? {
          username,
          avatarUrl,
          avatarTemplate,
        }
      : null,
    categoryId,
    categoryName: category?.name || null,
    categorySlug: category?.slug || null,
    categoryColor: category?.color || null,
    categoryTextColor: category?.textColor || null,
    category,
    tags,
    origin,
    hostname: target?.hostname || new URL(origin).hostname,
    isRemote,
    postNumber: target?.postNumber ?? null,
    externalSourceHost: isRemote ? target?.hostname || null : null,
    isRemoteDiscourseTopic: isRemote,
    raw: {
      ...topic,
      category: category
        ? {
            ...category,
            text_color: category?.textColor ?? null,
          }
        : null,
      tags,
      username,
      avatar_template: avatarTemplate,
      op_avatar_url: avatarUrl,
      is_remote_discourse_topic: isRemote,
    },
  };
}

export function createTopicProvider(api, config, topicCache, inFlightFetches) {
  async function fetchTopic(target, signal) {
    const topicId = target?.topicId;
    const origin = target?.origin || window.location.origin;
    const isRemote = origin !== window.location.origin;

    if (!topicId || signal?.aborted) {
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

        return normalizeTopic(topic, target, config);
      } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) {
          return null;
        }

        throw error;
      }
    },
  };
}
