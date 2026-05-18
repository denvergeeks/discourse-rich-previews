/**
 * Builds the [preview]...[/preview] markup that the composer toolbar inserts.
 *
 * Supported forms:
 *
 *   "markdown" (default) — form 2:
 *     [preview][Link text](https://url/)[/preview]
 *
 *   "explicit" — form 1:
 *     [preview=https://url/]Link text[/preview]
 *
 *   "bare" — form 3:
 *     [preview]https://url/[/preview]
 *
 * Behavior:
 * - Forms 1 and 2 preserve the label text.
 * - Form 3 uses the URL as the visible text.
 * - If the requested form is "markdown" but the label is empty or identical to
 *   the URL, the helper falls back to bare form for cleaner authoring.
 */

function normalizeText(value) {
  return String(value ?? "").trim();
}

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\/[^\s<>"']+$/i.test(normalizeText(value));
}

function escapeBbcodeText(value) {
  return String(value ?? "").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function escapeMarkdownLinkLabel(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

function escapeMarkdownLinkTitle(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildExplicitAttrPreview(url, linkText) {
  const normalizedUrl = normalizeText(url);
  const normalizedText = normalizeText(linkText) || normalizedUrl;

  return `[preview=${normalizedUrl}]${escapeBbcodeText(normalizedText)}[/preview]`;
}

function buildBareUrlPreview(url) {
  const normalizedUrl = normalizeText(url);
  return `[preview]${normalizedUrl}[/preview]`;
}

function buildMarkdownWrappedPreview(url, linkText, title = "") {
  const normalizedUrl = normalizeText(url);
  const normalizedText = normalizeText(linkText) || normalizedUrl;
  const normalizedTitle = normalizeText(title);

  const escapedLabel = escapeMarkdownLinkLabel(normalizedText);

  if (normalizedTitle) {
    const escapedTitle = escapeMarkdownLinkTitle(normalizedTitle);
    return `[preview][${escapedLabel}](${normalizedUrl} "${escapedTitle}")[/preview]`;
  }

  return `[preview][${escapedLabel}](${normalizedUrl})[/preview]`;
}

function shouldUseBareUrlForm(url, linkText) {
  const normalizedUrl = normalizeText(url);
  const normalizedText = normalizeText(linkText);

  return (
    isAbsoluteHttpUrl(normalizedUrl) &&
    (!normalizedText || normalizedText === normalizedUrl)
  );
}

export function buildPreviewWrappedMarkdown(
  url,
  linkText,
  title = "",
  form = "markdown"
) {
  const normalizedUrl = normalizeText(url);
  const normalizedText = normalizeText(linkText);

  if (!normalizedUrl) {
    return "";
  }

  switch (form) {
    case "explicit":
      return buildExplicitAttrPreview(normalizedUrl, normalizedText);

    case "bare":
      return buildBareUrlPreview(normalizedUrl);

    case "markdown":
    default:
      if (shouldUseBareUrlForm(normalizedUrl, normalizedText)) {
        return buildBareUrlPreview(normalizedUrl);
      }

      return buildMarkdownWrappedPreview(
        normalizedUrl,
        normalizedText,
        title
      );
  }
}