import { module, test } from "qunit";
import {
  classifyLink,
  previewTypeEnabled,
  providerSupportsComposer,
} from "../../lib/rich-preview-utils";

module("Rich previews | utils", function () {
  const config = {
    enabled: true,
    previewsTopicMode: "auto_and_composer",
    previewsRemoteTopicMode: "auto_and_composer",
    previewsExternalMode: "auto_and_composer",
    previewsWikipediaMode: "auto_and_composer",
    previewProviders: {
      topic: { key: "topic", enabled: true },
      remote_topic: { key: "remote_topic", enabled: true },
      external: { key: "external", enabled: true },
      wikipedia: { key: "wikipedia", enabled: true },
    },
  };

  test("previewTypeEnabled respects disabled wikipedia mode", function (assert) {
    const localConfig = {
      ...config,
      previewsWikipediaMode: "disabled",
    };

    assert.false(previewTypeEnabled("wikipedia", localConfig));
    assert.true(previewTypeEnabled("external", localConfig));
  });

  test("previewTypeEnabled returns false for unknown type", function (assert) {
    assert.false(previewTypeEnabled("unknown_type", config));
  });

  test("providerSupportsComposer returns true for auto_and_composer mode", function (assert) {
    assert.true(providerSupportsComposer("topic", config));
    assert.true(providerSupportsComposer("remote_topic", config));
    assert.true(providerSupportsComposer("external", config));
    assert.true(providerSupportsComposer("wikipedia", config));
  });

  test("providerSupportsComposer returns false for auto_only mode", function (assert) {
    const localConfig = {
      ...config,
      previewsExternalMode: "auto_only",
    };

    assert.false(providerSupportsComposer("external", localConfig));
    assert.true(providerSupportsComposer("topic", localConfig));
  });

  test("classifyLink identifies wikipedia links", function (assert) {
    const link = document.createElement("a");
    link.href = "https://en.wikipedia.org/wiki/Discourse";

    assert.strictEqual(classifyLink(link, config), "wikipedia");
  });

  test("classifyLink identifies external links", function (assert) {
    const link = document.createElement("a");
    link.href = "https://example.com/page";

    assert.strictEqual(classifyLink(link, config), "external");
  });

  test("classifyLink identifies local topic links", function (assert) {
    const link = document.createElement("a");
    link.href = `${window.location.origin}/t/example-topic/123`;

    assert.strictEqual(classifyLink(link, config), "topic");
  });

  test("classifyLink identifies allowed remote discourse topic links", function (assert) {
    const localConfig = {
      ...config,
      previewProviders: {
        ...config.previewProviders,
        remote_topic: {
          key: "remote_topic",
          enabled: true,
          remote_hosts: ["meta.discourse.org"],
          require_https: true,
        },
      },
    };

    const link = document.createElement("a");
    link.href = "https://meta.discourse.org/t/discourse-icon/143374";

    assert.strictEqual(classifyLink(link, localConfig), "remote_topic");
  });

  test("classifyLink returns null for disallowed remote discourse topic hosts", function (assert) {
    const localConfig = {
      ...config,
      previewProviders: {
        ...config.previewProviders,
        remote_topic: {
          key: "remote_topic",
          enabled: true,
          remote_hosts: ["forum.example.com"],
          require_https: true,
        },
      },
    };

    const link = document.createElement("a");
    link.href = "https://meta.discourse.org/t/discourse-icon/143374";

    assert.strictEqual(classifyLink(link, localConfig), "external");
  });
});
