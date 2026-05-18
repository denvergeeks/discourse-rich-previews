import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import DModal from "discourse/components/d-modal";
import DButton from "discourse/components/d-button";
import { on } from "@ember/modifier";
import {
  parseTopicUrl,
  parseRemoteDiscourseTopicUrl,
  isWikipediaArticleLink,
  providerSupportsComposer,
  previewTypeEnabled,
  providerColor,
  renderProviderGlyph,
} from "../lib/rich-preview-utils";
import { buildPreviewWrappedMarkdown } from "../lib/preview-markup";

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

const TYPE_LABELS = {
  topic: "Internal Topic",
  remote_topic: "Remote Discourse Topic",
  external: "External Link",
  wikipedia: "Wikipedia",
};

const FORMAT_LABELS = {
  markdown: "Markdown link",
  explicit: "Explicit preview attribute",
  bare: "Bare URL",
};

export default class RichPreviewLinkModal extends Component {
  @tracked url = this.args.model?.initialUrl || "";
  @tracked linkText = this.args.model?.initialLinkText || "";
  @tracked title = this.args.model?.initialTitle || "";
  @tracked format = this.args.model?.initialFormat || "markdown";
  @tracked urlError = "";

  get config() {
    return this.args.model?.config || {};
  }

  get detectedType() {
    return classifyUrl(this.url.trim(), this.config);
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
    if (!this.url.trim()) {
      return false;
    }

    try {
      new URL(this.url.trim());
      return true;
    } catch {
      return false;
    }
  }

  get isSupported() {
    return (
      this.isValidUrl &&
      this.detectedType !== null &&
      this.providerEnabledForDetectedType &&
      this.composerAllowedForDetectedType
    );
  }

  get cannotInsert() {
    return !this.isValidUrl || !this.isSupported;
  }

  get showUnsupportedWarning() {
    return this.isValidUrl && !this.isSupported;
  }

  get typeLabel() {
    if (!this.isValidUrl) {
      return "";
    }

    return TYPE_LABELS[this.detectedType] || "";
  }

  get typeBadgeClass() {
    return `rplm-type-badge rplm-type-badge--${this.detectedType || "unsupported"}`;
  }

  get providerGlyphText() {
    if (!this.detectedType || !this.isValidUrl) {
      return "";
    }

    const provider = this.config?.previewProviders?.[this.detectedType] || {};

    if (provider.glyph_mode === "emoji" && provider.emoji) {
      return provider.emoji;
    }

    const fallbackGlyphs = {
      topic: "🔗",
      remote_topic: "🌐",
      external: "↗",
      wikipedia: "📖",
    };

    return fallbackGlyphs[this.detectedType] || "";
  }

  get showIconAfter() {
    return (
      this.config?.previewsShowIcon &&
      this.config?.previewsIconPosition !== "before" &&
      this.isSupported
    );
  }

  get showIconBefore() {
    return (
      this.config?.previewsShowIcon &&
      this.config?.previewsIconPosition === "before" &&
      this.isSupported
    );
  }

  get effectiveFormat() {
    if (this.format === "bare") {
      return "bare";
    }

    if (this.format === "explicit") {
      return "explicit";
    }

    return "markdown";
  }

  get displayText() {
    if (this.effectiveFormat === "bare") {
      return this.url.trim() || "link text";
    }

    return this.linkText.trim() || this.url.trim() || "link text";
  }

  get previewLinkClass() {
    return `rplm-preview-link rplm-preview-link--${this.detectedType || "unsupported"}`;
  }

  get bbcodePreview() {
    return buildPreviewWrappedMarkdown(
      this.url.trim(),
      this.effectiveFormat === "bare" ? "" : this.linkText,
      this.title,
      this.effectiveFormat
    );
  }

  get showPreview() {
    return !!this.url.trim();
  }

  get insertLabel() {
    return "Insert link";
  }

  get modalProviderColorStyle() {
    if (!this.detectedType || !this.isValidUrl) {
      return "";
    }

    const color = providerColor(this.detectedType, this.config);

    return color ? `--thc-provider-color: ${color};` : "";
  }

  get showLinkTextField() {
    return this.effectiveFormat !== "bare";
  }

  get showTitleField() {
    return this.effectiveFormat === "markdown";
  }

  get formatOptions() {
    return [
      { id: "markdown", label: FORMAT_LABELS.markdown },
      { id: "explicit", label: FORMAT_LABELS.explicit },
      { id: "bare", label: FORMAT_LABELS.bare },
    ];
  }

  @action
  updateUrl(event) {
    this.url = event.target.value;
    this.urlError = "";
  }

  @action
  updateLinkText(event) {
    this.linkText = event.target.value;
  }

  @action
  updateTitle(event) {
    this.title = event.target.value;
  }

  @action
  updateFormat(event) {
    this.format = event.target.value;
  }

  @action
  onKeydown(event) {
    if (event.key === "Enter" && !this.cannotInsert) {
      event.preventDefault();
      this.insert();
    }
  }

  @action
  insert() {
    const trimmedUrl = this.url.trim();

    if (!trimmedUrl) {
      this.urlError = "URL is required.";
      return;
    }

    if (!this.isValidUrl) {
      this.urlError = "Please enter a valid URL.";
      return;
    }

    if (!this.isSupported) {
      this.urlError = "This link type is not enabled for composer previews.";
      return;
    }

    const bbcode = buildPreviewWrappedMarkdown(
      trimmedUrl,
      this.effectiveFormat === "bare" ? "" : this.linkText,
      this.title,
      this.effectiveFormat
    );

    this.args.model?.onInsert?.(bbcode);
    this.args.closeModal?.();
  }

  <template>
    <DModal
      @closeModal={{@closeModal}}
      @title="Preview Link"
      class="rich-preview-link-modal"
    >
      <:body>
        <div
          class="rich-preview-link-modal__content"
          style={{this.modalProviderColorStyle}}
          {{on "keydown" this.onKeydown}}
        >
          <div class="rplm-field">
            <label class="rplm-label" for="rplm-url">
              URL
              <span class="rplm-required">*</span>
            </label>

            <input
              id="rplm-url"
              class={{if this.urlError "rplm-input rplm-input--error" "rplm-input"}}
              type="url"
              value={{this.url}}
              placeholder="https://example.com/page"
              {{on "input" this.updateUrl}}
            />

            {{#if this.urlError}}
              <p class="rplm-error">{{this.urlError}}</p>
            {{/if}}

            {{#if this.typeLabel}}
              <div class={{this.typeBadgeClass}}>
                {{~renderProviderGlyph this.detectedType this.config~}}
                <span>{{this.typeLabel}}</span>
              </div>
            {{/if}}

            {{#if this.showUnsupportedWarning}}
              <p class="rplm-warning">
                This preview type is not currently enabled for composer insertion.
              </p>
            {{/if}}
          </div>

          <div class="rplm-field">
            <label class="rplm-label" for="rplm-format">
              Output format
            </label>

            <select
              id="rplm-format"
              class="rplm-input"
              value={{this.format}}
              {{on "change" this.updateFormat}}
            >
              {{#each this.formatOptions as |option|}}
                <option value={{option.id}} selected={{eq this.format option.id}}>
                  {{option.label}}
                </option>
              {{/each}}
            </select>
          </div>

          {{#if this.showLinkTextField}}
            <div class="rplm-field">
              <label class="rplm-label" for="rplm-link-text">
                Link text
                <span class="rplm-optional">(preserved as visible label)</span>
              </label>

              <input
                id="rplm-link-text"
                class="rplm-input"
                type="text"
                value={{this.linkText}}
                placeholder="Text for the link"
                {{on "input" this.updateLinkText}}
              />
            </div>
          {{/if}}

          {{#if this.showTitleField}}
            <div class="rplm-field">
              <label class="rplm-label" for="rplm-title">
                Title
                <span class="rplm-optional">(optional markdown title)</span>
              </label>

              <input
                id="rplm-title"
                class="rplm-input"
                type="text"
                value={{this.title}}
                placeholder="Optional title attribute"
                {{on "input" this.updateTitle}}
              />
            </div>
          {{/if}}

          {{#if this.showPreview}}
            <div class="rplm-preview-section">
              <p class="rplm-preview-label">Preview</p>

              <div class="rplm-visual-preview">
                {{#if this.showIconBefore}}
                  <span class="rplm-icon" aria-hidden="true">
                    {{this.providerGlyphText}}
                  </span>
                {{/if}}

                <a href={{this.url}} class={{this.previewLinkClass}}>
                  {{this.displayText}}
                </a>

                {{#if this.showIconAfter}}
                  <span class="rplm-icon" aria-hidden="true">
                    {{this.providerGlyphText}}
                  </span>
                {{/if}}
              </div>

              <div class="rplm-bbcode-preview">
                <pre class="rplm-bbcode-pre">{{this.bbcodePreview}}</pre>
              </div>
            </div>
          {{/if}}
        </div>
      </:body>

      <:footer>
        <DButton
          @action={{this.insert}}
          @label={{this.insertLabel}}
          class="btn btn-primary"
          disabled={{this.cannotInsert}}
        />
        <DButton
          @action={{@closeModal}}
          @label="Cancel"
          class="btn btn-default"
        />
      </:footer>
    </DModal>
  </template>
}