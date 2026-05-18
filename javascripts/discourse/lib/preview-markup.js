export function buildPreviewWrappedMarkdown(
  url,
  linkText = "",
  title = "",
  form = "markdown"
) {
  const safeUrl = String(url || "").trim();
  const safeLinkText = String(linkText || "").trim();
  const safeTitle = String(title || "").trim();

  if (!safeUrl) {
    return "";
  }

  if (form === "explicit") {
    return `[preview=${safeUrl}]${safeLinkText || safeUrl}[/preview]`;
  }

  if (form === "bare") {
    return `[preview]${safeUrl}[/preview]`;
  }

  const titlePart = safeTitle ? ` "${safeTitle.replace(/"/g, "&quot;")}"` : "";
  const label = safeLinkText || safeUrl;

  return `[preview][${label}](${safeUrl}${titlePart})[/preview]`;
}