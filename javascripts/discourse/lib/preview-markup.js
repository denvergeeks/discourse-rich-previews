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
  linkText = "",
  title = "",
  form = "markdown"
) {
  const normalizedForm = String(form || "markdown").trim().toLowerCase();

  switch (normalizedForm) {
    case "explicit":
    case "explicit-attr":
    case "attribute":
      return buildExplicitPreview(url, linkText);

    case "bare":
    case "bare-url":
      return buildBarePreview(url);

    case "markdown":
    default:
      return `[preview]${buildMarkdownLink(url, linkText, title)}[/preview]`;
  }
}