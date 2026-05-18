// Intentionally unused in the current theme runtime.
//
// Theme-side markdown BBCode registration is handled from:
//   javascripts/discourse-markdown/rich-previews.js
//
// Keeping this file as a no-op avoids accidental imports against unsupported
// theme API methods such as api.registerMarkdownItPlugin(...).

export function registerPreviewBBCode() {}