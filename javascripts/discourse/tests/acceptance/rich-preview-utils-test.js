import { module, test } from "qunit";
import {
  classifyUrl,
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
    providers: [
      { key: "topic", enabled: true, composer: true },
      { key: "remote_topic", enabled: true, composer: true },
      { key: "external", enabled: true, composer: true },
      { key: "wikipedia", enabled: true, composer: true },
    ],
  };

  test("classifyUrl identifies wikipedia links", function (assert) {
    assert.strictEqual(
      classifyUrl("https://en.wikipedia.org/wiki/Discourse", config),
      "wikipedia"
    );
  });

  test("classifyUrl identifies external links", function (assert) {
    assert.strictEqual(
      classifyUrl("https://example.com/page", config),
      "external"
    );
  });

  test("previewTypeEnabled respects disabled wikipedia mode", function (assert) {
    const localConfig = {
      ...config,
      previewsWikipediaMode: "disabled",
    };

    assert.false(previewTypeEnabled("wikipedia", localConfig));
    assert.true(previewTypeEnabled("external", localConfig));
  });

  test("providerSupportsComposer returns true for enabled provider", function (assert) {
    assert.true(providerSupportsComposer("topic", config));
    assert.true(providerSupportsComposer("remote_topic", config));
    assert.true(providerSupportsComposer("external", config));
  });

  test("providerSupportsComposer returns false for missing provider", function (assert) {
    assert.false(providerSupportsComposer("does_not_exist", config));
  });
});
