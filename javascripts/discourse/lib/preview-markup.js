export function buildPreviewWrappedMarkdown(text, url) {
  return `[preview][${text}](${url})[/preview]`;
}
