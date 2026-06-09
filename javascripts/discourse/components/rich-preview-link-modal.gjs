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
  clearDecoratedLink,
} from "../lib/link-decorator";

import {
  buildMarkdownLink,
  buildBareUrl,
  buildPreviewMarkedLink,
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

    if (!parsed.hostname?.toLowerCase()) {
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
  @tracked insertionMode = this.args.model?.initialInsertionMode || "preview";

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

  get previewSupported() {
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

  get enabledModes() {
    const modes = [];

    if (this.markdownSupported) {
      modes.push("markdown");
    }

    if (this.previewSupported) {
      modes.push("preview");
    }

    if (this.bareUrlSupported) {
      modes.push("bare_url");
    }

    return modes;
  }

  get normalizedInsertionMode() {
    return ["markdown", "preview", "bare_url"].includes(this.insertionMode)
      ? this.insertionMode
      : "preview";
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

  get isPreviewMode() {
    return this.effectiveInsertionMode === "preview";
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
        return "Preview-marked link";
    }
  }

  get insertionModeHint() {
    switch (this.effectiveInsertionMode) {
      case "markdown":
        return "Insert a normal markdown link without rich preview behavior.";
      case "bare_url":
        return "Insert the raw URL on its own line. Discourse core may onebox it depending on site settings and destination support.";
      default:
        return "Insert a link followed by {preview}, using this theme component’s preview rules and styling.";
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

    if (this.isPreviewMode && this.previewSupported) {
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
        return buildPreviewMarkedLink(
          this.trimmedUrl,
          this.linkText,
          this.title,
          this.linkText.trim() ? "markdown" : "bare_url",
          "preview"
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
        return "Insert preview-marked link";
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

    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    clearDecoratedLink(link);

    if (!this.isPreviewMode || !this.previewSupported) {
      return;
    }

    const target = matchPreviewTarget(link, this.config);

    if (!target) {
      return;
    }

    link.dataset.previewPreference = "force";
    decorateAutoDetectedLink(link, target, this.config);
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
        output = buildPreviewMarkedLink(
          this.trimmedUrl,
          this.linkText,
          this.title,
          this.linkText.trim() ? "markdown" : "bare_url",
          "preview"
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
          <div class="rplm-grid">
            <label class="rplm-field">
              <span class="rplm-label">URL</span>
              <input
                type="url"
                class="rplm-input"
                value={{this.url}}
                data-rplm-field="url"
                {{on "input" this.updateField}}
                placeholder="https://example.com/"
              />
            </label>

            <label class="rplm-field">
              <span class="rplm-label">Link text</span>
              <input
                type="text"
                class="rplm-input"
                value={{this.linkText}}
                data-rplm-field="linkText"
                {{on "input" this.updateField}}
                placeholder="Optional"
              />
            </label>

            <label class="rplm-field">
              <span class="rplm-label">Title attribute</span>
              <input
                type="text"
                class="rplm-input"
                value={{this.title}}
                data-rplm-field="title"
                {{on "input" this.updateField}}
                placeholder="Optional"
              />
            </label>

            <fieldset class="rplm-field">
              <legend class="rplm-label">Insertion format</legend>

              <label class="rplm-radio">
                <input
                  type="radio"
                  name="rplm-mode"
                  value="preview"
                  checked={{this.isPreviewMode}}
                  disabled={{not this.previewSupported}}
                  data-rplm-field="mode"
                  {{on "change" this.updateField}}
                />
                <span>Preview-marked link</span>
              </label>

              <label class="rplm-radio">
                <input
                  type="radio"
                  name="rplm-mode"
                  value="markdown"
                  checked={{this.isMarkdownMode}}
                  disabled={{not this.markdownSupported}}
                  data-rplm-field="mode"
                  {{on "change" this.updateField}}
                />
                <span>Markdown link</span>
              </label>

              <label class="rplm-radio">
                <input
                  type="radio"
                  name="rplm-mode"
                  value="bare_url"
                  checked={{this.isBareMode}}
                  disabled={{not this.bareUrlSupported}}
                  data-rplm-field="mode"
                  {{on "change" this.updateField}}
                />
                <span>Bare URL</span>
              </label>
            </fieldset>

            {{#if this.isValidUrl}}
              <div class="rplm-meta">
                <span class={{this.typeBadgeClass}}>{{this.typeLabel}}</span>
                <span class="rplm-hint">{{this.insertionModeHint}}</span>
              </div>
            {{/if}}

            {{#if this.urlError}}
              <p class="rplm-error">{{this.urlError}}</p>
            {{/if}}

            {{#if this.showUnsupportedWarning}}
              <p class="rplm-warning">
                This URL does not support any enabled insertion format for the
                current provider configuration.
              </p>
            {{/if}}

            {{#if this.showPreview}}
              <div class="rplm-preview-shell">
                <div class="rplm-preview-label">Insertion preview</div>
                <pre class="rplm-code">{{this.insertionPreview}}</pre>

                <div
                  id="rich-preview-link-modal-preview-root"
                  class="rplm-render-preview"
                >
                  <a href={{this.trimmedUrl}} class={{this.previewLinkClass}}>
                    {{this.displayText}}
                  </a>
                </div>
              </div>
            {{/if}}
          </div>
        </div>
      </:body>

      <:footer>
        <DButton
          @label={{this.insertLabel}}
          @action={{this.onInsert}}
          class="btn-primary"
          disabled={{this.cannotInsert}}
        />
        <DButton @label="Cancel" @action={{this.onCancel}} />
      </:footer>
    </DModal>
  </template>
}