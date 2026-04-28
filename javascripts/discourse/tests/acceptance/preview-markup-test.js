import { module, test } from "qunit";
import { buildPreviewWrappedMarkdown } from "../../lib/preview-markup";

module("Rich previews | preview markup", function () {
  test("builds wrapped markdown with explicit link text", function (assert) {
    assert.strictEqual(
      buildPreviewWrappedMarkdown("https://example.com", "Example"),
      '[preview][Example](https://example.com)[/preview]'
    );
  });

  test("falls back to url when link text is blank", function (assert) {
    assert.strictEqual(
      buildPreviewWrappedMarkdown("https://example.com", ""),
      '[preview][https://example.com](https://example.com)[/preview]'
    );
  });

  test("includes markdown title when provided", function (assert) {
    assert.strictEqual(
      buildPreviewWrappedMarkdown(
        "https://example.com",
        "Example",
        "Example title"
      ),
      '[preview][Example](https://example.com "Example title")[/preview]'
    );
  });

  test("returns empty string when url is missing", function (assert) {
    assert.strictEqual(buildPreviewWrappedMarkdown("", "Example"), "");
  });
});
