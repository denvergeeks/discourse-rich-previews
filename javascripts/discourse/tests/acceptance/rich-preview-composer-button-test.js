import { module, test } from "qunit";
import { buildPreviewWrappedMarkdown } from "../../lib/preview-composer-button";

module("Rich previews | composer button", function () {
  test("builds fixed preview wrapper markdown", function (assert) {
    assert.strictEqual(
      buildPreviewWrappedMarkdown("Example", "https://example.com"),
      "[preview][Example](https://example.com)[/preview]"
    );
  });
});
