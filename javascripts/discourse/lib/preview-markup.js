function escapeMarkdownLabel(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");
}

function escapeMarkdownTitle(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"');
}

function normalizeUrl(value) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return "";
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    return trimmed;
  }
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function buildMarkdownLink(url, linkText, title = "") {
  const normalizedUrl = normalizeUrl(url);
  const normalizedText = normalizeText(linkText) || normalizedUrl;
  const normalizedTitle = normalizeText(title);

  if (!normalizedUrl) {
    return "";
  }

  const label = escapeMarkdownLabel(normalizedText);

  if (normalizedTitle) {
    return `[${label}](${normalizedUrl} "${escapeMarkdownTitle(
      normalizedTitle
    )}")`;
  }

  return `[${label}](${normalizedUrl})`;
}

function buildExplicitPreview(url, linkText) {
  const normalizedUrl = normalizeUrl(url);
  const normalizedText = normalizeText(linkText) || normalizedUrl;

  if (!normalizedUrl) {
    return "";
  }

  return `[preview=${normalizedUrl}]${normalizedText}[/preview]`;
}

function buildBarePreview(url) {
  const normalizedUrl = normalizeUrl(url);

  if (!normalizedUrl) {
    return "";
  }

  return `[preview]${normalizedUrl}[/preview]`;
}

export function buildPreviewWrappedMarkdown(
  url,
  linkText,
  title = "",
  form = "markdown"
) {
  if (!url) {
    return "";
  }

  const trimmedUrl = url.trim();
  const trimmedText = linkText?.trim() || "";
  const trimmedTitle = title?.trim();

  if (form === "explicit") {
    const visibleText = trimmedText || trimmedUrl;
    return `[preview=${trimmedUrl}]${visibleText}[/preview]`;
  }

  if (form === "bare") {
    return `[preview]${trimmedUrl}[/preview]`;
  }

  const displayText = trimmedText || trimmedUrl;
  const mdLink = trimmedTitle
    ? `[${displayText}](${trimmedUrl} "${trimmedTitle}")`
    : `[${displayText}](${trimmedUrl})`;

  return `[preview]${mdLink}[/preview]`;
}