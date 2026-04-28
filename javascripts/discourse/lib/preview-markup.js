export function buildPreviewWrappedMarkdown(url, linkText, title = "") {
  if (!url) {
    return "";
  }

  const displayText = linkText?.trim() || url;
  const trimmedTitle = title?.trim();

  const mdLink = trimmedTitle
    ? `[${displayText}](${url} "${trimmedTitle}")`
    : `[${displayText}](${url})`;

  return `[preview]${mdLink}[/preview]`;
}
