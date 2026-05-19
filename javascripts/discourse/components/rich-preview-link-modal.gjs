import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { scheduleOnce } from "@ember/runloop";
import DModal from "discourse/components/d-modal";
import DButton from "discourse/components/d-button";

import {
  parseTopicUrl,
  parseRemoteDiscourseTopicUrl,
  isWikipediaArticleLink,
  providerSupportsComposer,
  previewTypeEnabled,
  providerColor,
} from "../lib/rich-preview-utils";

import { matchPreviewTarget } from "../lib/preview-router";

import {
  decorateAutoDetectedLink,
  decorateWrappedPreviewLink,
  clearDecoratedLink,
} from "../lib/link-decorator";

import {
  buildMarkdownLink,
  buildBareUrl,
  buildPreviewWrappedMarkdown,
} from "../lib/preview-markup";

function classifyUrl(url, config) {
  if (!url) {
    return null;
  }

  try {
    const tempLink = document.createElement("a");
    tempLink.href = url;

    if (isWikipediaArticleLink(tempLink)) {
      return "wikipedia";
    }

    if (parseTopicUrl(url)) {
      return "topic";
    }

    if (parseRemoteDiscourseTopicUrl(url, config)) {
      return "remote_topic";
    }

    return "external";
  } catch {
    return null;
  }
}

function isPlausibleCoreOneboxCandidate(url, detectedType) {
  if (!url || !detectedType) {
    return false;
  }

  if (
    detectedType === "topic" ||
    detectedType === "remote_topic" ||
    detectedType === "wikipedia"
  ) {
    return false;
  }

  try {
    const parsed = new URL(url, window.location.origin);
    const hostname = parsed.hostname?.toLowerCase();

    if (!hostname) {
      return false;
    }

    if (!/^https?:$/.test(parsed.protocol)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

const TYPE_LABELS = {
  topic: "Internal Topic",
  remote_topic: "Remote Discourse Topic",
  external: "External Link",
  wikipedia: "Wikipedia",
};

export default class RichPreviewLinkModal extends Component {
  @tracked url = this.args.model?.initialUrl || "";
  @tracked linkText = this.args.model?.initialLinkText || "";
  @tracked title = this.args.model?.initialTitle || "";
  @tracked urlError = "";
  @tracked insertionMode =
    this.args.model?.initialInsertionMode || "rich_preview";

  constructor(owner, args) {
    super(owner, args);
    this.queuePreviewDecoration();
  }

  get config() {
    return this.args.model?.config || {};
  }

  get trimmedUrl() {
    return this.url.trim();
  }

  get detectedType() {
    return classifyUrl(this.trimmedUrl, this.config);
  }

  get providerEnabledForDetectedType() {
    if (!this.detectedType) {
      return false;
    }

    return previewTypeEnabled(this.detectedType, this.config);
  }

  get composerAllowedForDetectedType() {
    if (!this.detectedType) {
      return false;
    }

    return providerSupportsComposer(this.detectedType, this.config);
  }

  get isValidUrl() {
    if (!this.trimmedUrl) {
      return false;
    }

    try {
      new URL(this.trimmedUrl);
      return true;
    } catch {
      return false;
    }
  }

  get markdownSupported() {
    return this.isValidUrl;
  }

  get richPreviewSupported() {
    return (
      this.isValidUrl &&
      this.detectedType !== null &&
      this.providerEnabledForDetectedType &&
      this.composerAllowedForDetectedType
    );
  }

  get bareUrlSupported() {
    return (
      this.isValidUrl &&
      isPlausibleCoreOneboxCandidate(this.trimmedUrl, this.detectedType)
    );
  }

  get markdownDisabled() {
    return !this.markdownSupported;
  }

  get richPreviewDisabled() {
    return !this.richPreviewSupported;
  }

  get bareUrlDisabled() {
    return !this.bareUrlSupported;
  }

  get enabledModes() {
    const modes = [];

    if (this.markdownSupported) {
      modes.push("markdown");
    }

    if (this.richPreviewSupported) {
      modes.push("rich_preview");
    }

    if (this.bareUrlSupported) {
      modes.push("bare_url");
    }

    return modes;
  }

  get normalizedInsertionMode() {
    return ["markdown", "rich_preview", "bare_url"].includes(this.insertionMode)
      ? this.insertionMode
      : "rich_preview";
  }

  get selectedModeIsEnabled() {
    return this.enabledModes.includes(this.normalizedInsertionMode);
  }

  get effectiveInsertionMode() {
    if (this.selectedModeIsEnabled) {
      return this.normalizedInsertionMode;
    }

    return this.enabledModes[0] || "markdown";
  }

  get isMarkdownMode() {
    return this.effectiveInsertionMode === "markdown";
  }

  get isRichPreviewMode() {
    return this.effectiveInsertionMode === "rich_preview";
  }

  get isBareMode() {
    return this.effectiveInsertionMode === "bare_url";
  }

  get cannotInsert() {
    return !this.isValidUrl || !this.enabledModes.length;
  }

  get showUnsupportedWarning() {
    return this.isValidUrl && !this.enabledModes.length;
  }

  get typeLabel() {
    if (!this.isValidUrl) {
      return "";
    }

    return TYPE_LABELS[this.detectedType] || "";
  }

  get typeBadgeClass() {
    return `rplm-type-badge rplm-type-badge--${
      this.detectedType || "unsupported"
    }`;
  }

  get insertionModeLabel() {
    switch (this.effectiveInsertionMode) {
      case "markdown":
        return "Markdown link";
      case "bare_url":
        return "Bare URL (core onebox when supported)";
      default:
        return "Rich preview link";
    }
  }

  get insertionModeHint() {
    switch (this.effectiveInsertionMode) {
      case "markdown":
        return "Insert a normal markdown link without rich preview behavior.";
      case "bare_url":
        return "Insert the raw URL on its own line. Discourse core may onebox it depending on site settings and destination support.";
      default:
        return "Insert a [preview]...[/preview] link using this theme component’s provider rules and styling.";
    }
  }

  get displayText() {
    if (this.isBareMode) {
      return this.trimmedUrl || "https://example.com/";
    }

    return this.linkText.trim() || this.trimmedUrl || "link text";
  }

  get previewLinkClass() {
    const classes = ["rplm-preview-link"];

    if (this.detectedType) {
      classes.push(`rplm-preview-link--${this.detectedType}`);
    }

    if (this.isRichPreviewMode && this.richPreviewSupported) {
      classes.push("rich-preview-link");
    }

    return classes.join(" ");
  }

  get insertionPreview() {
    switch (this.effectiveInsertionMode) {
      case "markdown":
        return buildMarkdownLink(this.trimmedUrl, this.linkText, this.title);
      case "bare_url":
        return buildBareUrl(this.trimmedUrl);
      default:
        return buildPreviewWrappedMarkdown(
          this.trimmedUrl,
          this.linkText,
          this.title,
          "rich_preview"
        );
    }
  }

  get showPreview() {
    return !!this.trimmedUrl;
  }

  get insertLabel() {
    switch (this.effectiveInsertionMode) {
      case "markdown":
        return "Insert markdown link";
      case "bare_url":
        return "Insert bare URL";
      default:
        return "Insert rich preview link";
    }
  }

  get modalProviderColorStyle() {
    if (!this.detectedType || !this.isValidUrl) {
      return "";
    }

    const color = providerColor(this.detectedType, this.config);
    return color ? `--thc-provider-color: ${color};` : "";
  }

  ensureValidModeSelection() {
    if (!this.selectedModeIsEnabled) {
      this.insertionMode = this.enabledModes[0] || "markdown";
    }
  }

  queuePreviewDecoration() {
    scheduleOnce("afterRender", this, this.decorateRenderedPreview);
  }

  decorateRenderedPreview() {
    const container = document.getElementById(
      "rich-preview-link-modal-preview-root"
    );

    if (!(container instanceof Element)) {
      return;
    }

    const link = container.querySelector("a[href]");
    const wrapper = container.querySelector(".rich-preview-wrap");

    if (!link) {
      return;
    }

    clearDecoratedLink(link, wrapper);

    if (!this.isRichPreviewMode || !this.richPreviewSupported) {
      return;
    }

    const target = matchPreviewTarget(link, this.config);

    if (!target) {
      return;
    }

    if (wrapper) {
      decorateWrappedPreviewLink(wrapper, link, target, this.config);
    } else {
      decorateAutoDetectedLink(link, target, this.config);
    }
  }

  @action
  updateField(event) {
    const target = event?.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const field = target.dataset.rplmField;

    switch (field) {
      case "url":
        this.url = target.value || "";
        this.urlError = "";
        this.ensureValidModeSelection();
        break;
      case "linkText":
        this.linkText = target.value || "";
        break;
      case "title":
        this.title = target.value || "";
        break;
      case "mode":
        this.insertionMode = target.value || "markdown";
        this.urlError = "";
        break;
      default:
        return;
    }

    this.queuePreviewDecoration();
  }

  @action
  onInsert() {
    if (this.cannotInsert) {
      this.urlError =
        "Please enter a valid URL and choose an available insertion format.";
      return;
    }

    let output;

    switch (this.effectiveInsertionMode) {
      case "markdown":
        output = buildMarkdownLink(this.trimmedUrl, this.linkText, this.title);
        break;
      case "bare_url":
        output = buildBareUrl(this.trimmedUrl);
        break;
      default:
        output = buildPreviewWrappedMarkdown(
          this.trimmedUrl,
          this.linkText,
          this.title,
          "rich_preview"
        );
    }

    this.args.model?.onInsert?.(output);
    this.args.closeModal();
  }

  @action
  onCancel() {
    this.args.closeModal();
  }

  <template>
    <DModal
      @title="Insert Link"
      @closeModal={{this.onCancel}}
      class="rich-preview-link-modal"
    >
      <:body>
        <div style={{this.modalProviderColorStyle}}>
          <div class="rplm-field">
            <label class="rplm-label" for="rplm-url">URL</label>
            <input
              id="rplm-url"
              type="url"
              class="rplm-input"
              placeholder="https://..."
              value={{this.url}}
              data-rplm-field="url"
              oninput={{this.updateField}}
              autofocus
            />
            {{#if this.urlError}}
              <p class="rplm-error">{{this.urlError}}</p>
            {{/if}}
            {{#if this.typeLabel}}
              <div class={{this.typeBadgeClass}}>
                {{this.typeLabel}}
              </div>
            {{/if}}
            {{#if this.showUnsupportedWarning}}
              <p class="rplm-warning">
                This URL is valid, but no enabled insertion mode is currently
                available for it under your theme component settings.
              </p>
            {{/if}}
          </div>

          <div class="rplm-field">
            <fieldset class="rplm-mode-fieldset">
              <legend class="rplm-label">Insertion format</legend>

              <label class="rplm-mode-option" for="rplm-mode-markdown">
                <input
                  id="rplm-mode-markdown"
                  type="radio"
                  name="rplm-insertion-mode"
                  class="rplm-mode-radio"
                  value="markdown"
                  checked={{this.isMarkdownMode}}
                  disabled={{this.markdownDisabled}}
                  data-rplm-field="mode"
                  onchange={{this.updateField}}
                />
                <span class="rplm-mode-copy">
                  <span class="rplm-mode-title">Markdown link</span>
                  <span class="rplm-mode-hint">
                    Insert a normal markdown link without rich preview behavior.
                  </span>
                </span>
              </label>

              <label class="rplm-mode-option" for="rplm-mode-rich-preview">
                <input
                  id="rplm-mode-rich-preview"
                  type="radio"
                  name="rplm-insertion-mode"
                  class="rplm-mode-radio"
                  value="rich_preview"
                  checked={{this.isRichPreviewMode}}
                  disabled={{this.richPreviewDisabled}}
                  data-rplm-field="mode"
                  onchange={{this.updateField}}
                />
                <span class="rplm-mode-copy">
                  <span class="rplm-mode-title">Rich preview link</span>
                  <span class="rplm-mode-hint">
                    Insert a [preview]...[/preview] link using this theme
                    component’s provider rules and styling.
                  </span>
                </span>
              </label>

              <label class="rplm-mode-option" for="rplm-mode-bare-url">
                <input
                  id="rplm-mode-bare-url"
                  type="radio"
                  name="rplm-insertion-mode"
                  class="rplm-mode-radio"
                  value="bare_url"
                  checked={{this.isBareMode}}
                  disabled={{this.bareUrlDisabled}}
                  data-rplm-field="mode"
                  onchange={{this.updateField}}
                />
                <span class="rplm-mode-copy">
                  <span class="rplm-mode-title">
                    Bare URL (core onebox when supported)
                  </span>
                  <span class="rplm-mode-hint">
                    Insert the raw URL on its own line. Discourse core may
                    onebox it depending on site settings and destination support.
                  </span>
                </span>
              </label>
            </fieldset>
          </div>

          <div class="rplm-field">
            <label class="rplm-label" for="rplm-linktext">Link text</label>
            <p class="rplm-hint">
              Optional for markdown and rich preview modes. Bare URL mode
              ignores this field.
            </p>
            <input
              id="rplm-linktext"
              type="text"
              class="rplm-input"
              placeholder="Display text for the link"
              value={{this.linkText}}
              disabled={{this.isBareMode}}
              data-rplm-field="linkText"
              oninput={{this.updateField}}
            />
          </div>

          <div class="rplm-field">
            <label class="rplm-label" for="rplm-title">Title attribute</label>
            <p class="rplm-hint">
              Optional. Used for normal markdown links and preview output where
              supported.
            </p>
            <input
              id="rplm-title"
              type="text"
              class="rplm-input"
              placeholder="Brief description of the link destination"
              value={{this.title}}
              data-rplm-field="title"
              oninput={{this.updateField}}
            />
          </div>

          {{#if this.showPreview}}
            <div class="rplm-preview-section">
              <p class="rplm-preview-label">
                Preview — {{this.insertionModeLabel}}
              </p>
              <p class="rplm-hint">{{this.insertionModeHint}}</p>

              {{#if this.isBareMode}}
                <div
                  id="rich-preview-link-modal-preview-root"
                  class="rplm-visual-preview"
                  data-rich-preview-modal-host
                >
                  <span>{{this.trimmedUrl}}</span>
                </div>
              {{else}}
                <div
                  id="rich-preview-link-modal-preview-root"
                  class="rplm-visual-preview"
                  data-rich-preview-modal-host
                >
                  <a
                    href={{this.url}}
                    title={{this.title}}
                    class={{this.previewLinkClass}}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{this.displayText}}
                  </a>
                </div>
              {{/if}}

              <div class="rplm-bbcode-preview">
                <pre class="rplm-bbcode-pre">{{this.insertionPreview}}</pre>
              </div>
            </div>
          {{/if}}
        </div>
      </:body>

      <:footer>
        <DButton
          @action={{this.onInsert}}
          @translatedLabel={{this.insertLabel}}
          @disabled={{this.cannotInsert}}
          class="btn-primary"
        />
        <DButton
          @action={{this.onCancel}}
          @label="cancel"
          class="btn-flat"
        />
      </:footer>
    </DModal>
  </template>
}