function escapeMarkdownText(text) {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\r?\n/g, " ")
    .trim();
}

function escapeMarkdownLinkDestination(url) {
  return String(url ?? "")
    .replace(/[<>\r\n]/g, "")
    .trim();
}

function escapeMarkdownLinkTitle(title) {
  return String(title ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, " ")
    .trim();
}

function normalizeDisplayText(url, linkText) {
  const text = String(linkText ?? "").trim();
  return text || String(url ?? "").trim();
}

export function buildPreviewWrappedMarkdown(url, linkText = "", title = "") {
  const safeUrl = escapeMarkdownLinkDestination(url);
  if (!safeUrl) {
    return "";
  }

  const displayText = escapeMarkdownText(normalizeDisplayText(safeUrl, linkText));
  const safeTitle = escapeMarkdownLinkTitle(title);

  const markdownLink = safeTitle
    ? `[${displayText}](${safeUrl} "${safeTitle}")`
    : `[${displayText}](${safeUrl})`;

  return `[preview]${markdownLink}[/preview]`;
}