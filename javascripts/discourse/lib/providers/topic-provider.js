import {
  getCachedValue,
  setCachedValue,
  getJSON,
  sanitizeExcerpt,
} from "../hover-preview-utils";

export function createTopicProvider(api, config, topicCache, inFlightFetches) {
  async function fetchTopic(topicId, signal) {
    const store = api.container.lookup("service:store");
    const storeRecord = store?.peekRecord?.("topic", topicId);

    if (storeRecord) {
      return storeRecord;
    }

    const cached = getCachedValue(topicCache, topicId);
    if (cached) {
      return cached;
    }

    const inflightKey = `topic:${topicId}`;

    if (inFlightFetches.has(inflightKey)) {
      return inFlightFetches.get(inflightKey);
    }

    const promise = getJSON(`/t/${topicId}.json`, { signal })
      .then((data) => {
        setCachedValue(topicCache, topicId, data, config.topicCacheMax);
        return data;
      })
      .finally(() => {
        inFlightFetches.delete(inflightKey);
      });

    inFlightFetches.set(inflightKey, promise);
    return promise;
  }

  function normalizeTopic(topic) {
    const firstPost = topic.post_stream?.posts?.[0];
    const excerptSource =
      topic.excerpt || firstPost?.excerpt || firstPost?.cooked || "";

    return {
      type: "topic",
      id: `topic:${topic.id}`,
      title: topic.fancy_title ?? topic.title ?? "(no title)",
      excerpt: sanitizeExcerpt(excerptSource),
      html: null,
      image_url: topic.image_url || null,
      url: `${window.location.origin}/t/${topic.slug || topic.id}/${topic.id}`,
      raw: topic,
    };
  }

  return {
    async fetch(target, signal) {
      if (!target?.topicId) {
        return null;
      }

      const topic = await fetchTopic(target.topicId, signal);
      return normalizeTopic(topic);
    },
  };
}