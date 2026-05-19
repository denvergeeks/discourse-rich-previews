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

export function buildMarkdownLink(url, linkText = "", title = "") {
  const normalizedUrl = normalizeUrl(url);
  const normalizedText = normalizeText(linkText) || normalizedUrl;
  const normalizedTitle = normalizeText(title);

  if (!normalizedUrl) {
    return "";
  }

  const label = escapeMarkdownLabel(normalizedText);

  if (normalizedTitle) {
    return `[${label}](${normalizedUrl} "${escapeMarkdownTitle(normalizedTitle)}")`;
  }

  return `[${label}](${normalizedUrl})`;
}

export function buildBareUrl(url) {
  return normalizeUrl(url);
}

export function buildPreviewWrappedMarkdown(
  url,
  linkText = "",
  title = "",
  form = "rich_preview"
) {
  const normalizedUrl = normalizeUrl(url);

  if (!normalizedUrl) {
    return "";
  }

  const normalizedForm = String(form || "rich_preview").trim().toLowerCase();

  if (normalizedForm !== "rich_preview" && normalizedForm !== "markdown") {
    return "";
  }

  return `[preview]${buildMarkdownLink(normalizedUrl, linkText, title)}[/preview]`;
}