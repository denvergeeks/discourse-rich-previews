/**
 * Builds the [preview]...[/preview] BBCode string that the composer
 * toolbar button inserts.
 *
 * Three forms are supported:
 *
 *   'markdown' (default) — form 2, composer-style markdown link:
 *     [preview][Link text](https://url/)[/preview]
 *
 *   'explicit' — form 1, explicit default attribute:
 *     [preview=https://url/]Link text[/preview]
 *
 *   'bare' — form 3, bare URL:
 *     [preview]https://url/[/preview]
 *
 * For forms 1 and 2 the label text is preserved.
 * For form 3 the URL is used as the visible text.
 *
 * The composer button uses 'markdown' (form 2) by default because it
 * is the most ergonomic for authors and mirrors standard Markdown link
 * conventions.
 */
export function buildPreviewWrappedMarkdown(
  url,
  linkText,
  title = "",
  form = "markdown"
) {
  if (!url) {
    return "";
  }

  const displayText = linkText?.trim() || url;
  const trimmedTitle = title?.trim();

  switch (form) {
    case "explicit":
      // [preview=https://url/]Label[/preview]
      return `[preview=${url}]${displayText}[/preview]`;

    case "bare":
      // [preview]https://url/[/preview]
      return `[preview]${url}[/preview]`;

    case "markdown":
    default: {
      // [preview][Label](https://url/ "optional title")[/preview]
      const mdLink = trimmedTitle
        ? `[${displayText}](${url} "${trimmedTitle}")`
        : `[${displayText}](${url})`;
      return `[preview]${mdLink}[/preview]`;
    }
  }
}
