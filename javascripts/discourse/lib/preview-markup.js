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

function appendPreviewToken(base, preference = "preview") {
  const normalizedBase = normalizeText(base);
  const normalizedPreference = normalizeText(preference).toLowerCase();

  if (!normalizedBase) {
    return "";
  }

  if (normalizedPreference === "off") {
    return `${normalizedBase} {preview=off}`;
  }

  return `${normalizedBase} {preview}`;
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

export function buildPreviewMarkedLink(
  url,
  linkText = "",
  title = "",
  form = "preview",
  preference = "preview"
) {
  const normalizedUrl = normalizeUrl(url);

  if (!normalizedUrl) {
    return "";
  }

  const normalizedForm = String(form || "preview").trim().toLowerCase();

  if (normalizedForm === "bare_url") {
    return appendPreviewToken(buildBareUrl(normalizedUrl), preference);
  }

  return appendPreviewToken(
    buildMarkdownLink(normalizedUrl, linkText, title),
    preference
  );
}