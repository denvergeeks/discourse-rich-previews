import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { service } from "@ember/service";
import DModal from "discourse/components/d-modal";
import DButton from "discourse/components/d-button";
import { on } from "@ember/modifier";
import {
  parseTopicUrl,
  parseRemoteDiscourseTopicUrl,
  isWikipediaArticleLink,
} from "../lib/rich-preview-utils";

function classifyUrl(url, config) {
  if (!url) return null;

  try {
    const tempLink = document.createElement("a");
    tempLink.href = url;

    if (isWikipediaArticleLink(tempLink)) return "wikipedia";
    if (parseTopicUrl(url)) return "topic";
    if (parseRemoteDiscourseTopicUrl(url, config)) return "external";
    return "unsupported";
  } catch {
    return null;
  }
}

function buildBBCode(url, linkText, title, tagName) {
  if (!url) return "";

  const displayText = linkText?.trim() || url;
  const tag = tagName || "preview";

  const mdLink = title?.trim()
    ? `[${displayText}](${url} "${title.trim()}")`
    : `[${displayText}](${url})`;

  return `[${tag}]${mdLink}[/${tag}]`;
}

const TYPE_LABELS = {
  topic: "Internal Topic",
  external: "External Discourse",
  wikipedia: "Wikipedia",
  unsupported: "Not supported",
};

const TYPE_COLORS = {
  topic: "var(--success)",
  external: "var(--tertiary)",
  wikipedia: "#808080",
  unsupported: "var(--danger)",
};

export default class RichPreviewLinkModal extends Component {
  @service router;

  @tracked url = this.args.model?.initialUrl || "";
  @tracked linkText = this.args.model?.initialLinkText || "";
  @tracked title = "";
  @tracked urlError = "";

  get config() {
    return this.args.model?.config || {};
  }

  get tagName() {
    return this.config?.previewsTagName || "preview";
  }

  get detectedType() {
    return classifyUrl(this.url.trim(), this.config);
  }

  get isValidUrl() {
    if (!this.url.trim()) return false;
    try {
      new URL(this.url.trim());
      return true;
    } catch {
      return false;
    }
  }

  get typeLabel() {
    if (!this.url.trim()) return null;
    if (!this.isValidUrl) return null;
    return TYPE_LABELS[this.detectedType] || null;
  }

  get typeDot() {
    const dots = {
      topic: "🟢",
      external: "🔵",
      wikipedia: "⚪",
      unsupported: "🔴",
    };
    return dots[this.detectedType] || "";
  }

  get isSupported() {
    return (
      this.detectedType &&
      this.detectedType !== "unsupported"
    );
  }

  get canInsert() {
    return this.isValidUrl && this.isSupported;
  }

  get cannotInsert() {
    return !this.isValidUrl || !this.isSupported;
   }

  get showUnsupportedWarning() {
    return this.isValidUrl && !this.isSupported;
   }

  get displayText() {
    return this.linkText.trim() || this.url.trim() || "link text";
  }

  get bbcodePreview() {
    return buildBBCode(
      this.url.trim(),
      this.linkText,
      this.title,
      this.tagName
    );
  }

  get iconGlyph() {
    const icons = {
      topic: "⤴",
      external: "🌐",
      wikipedia: "📖",
    };
    return icons[this.detectedType] || "";
  }

  get showIconAfter() {
    return (
      this.config?.previewsShowIcon &&
      this.config?.previewsIconPosition === "after" &&
      this.isSupported
    );
  }

  get showIconBefore() {
    return (
      this.config?.previewsShowIcon &&
      this.config?.previewsIconPosition !== "after" &&
      this.isSupported
    );
  }

  @action
  onUrlInput(event) {
    this.url = event.target.value;
    this.urlError = "";
  }

  @action
  onLinkTextInput(event) {
    this.linkText = event.target.value;
  }

  @action
  onTitleInput(event) {
    this.title = event.target.value;
  }

  @action
  onInsert() {
    if (!this.canInsert) {
      this.urlError = "Please enter a supported URL before inserting.";
      return;
    }

    const bbcode = buildBBCode(
      this.url.trim(),
      this.linkText,
      this.title,
      this.tagName
    );

    this.args.model?.onInsert?.(bbcode);
    this.args.closeModal();
  }

  @action
  onCancel() {
    this.args.closeModal();
  }

  <template>
    <DModal
      @title="Insert Rich Preview Link"
      @closeModal={{this.onCancel}}
      class="rich-preview-link-modal"
    >
      <:body>
        <div class="rplm-field">
          abel class="rplm-label" for="rplm-url">
            URL
            <span class="rplm-required">*</span>
          </label>
          <input
            id="rplm-url"
            type="url"
            class="rplm-input"
            placeholder="https://..."
            value={{this.url}}
            {{on "input" this.onUrlInput}}
            autofocus
          />
          {{#if this.urlError}}
            <p class="rplm-error">{{this.urlError}}</p>
          {{/if}}
          {{#if this.typeLabel}}
            <div class="rplm-type-badge rplm-type-badge--{{this.detectedType}}">
              <span>{{this.typeDot}}</span>
              <span>{{this.typeLabel}}</span>
            </div>
          {{/if}}
          {{#if this.showUnsupportedWarning}}
            <p class="rplm-warning">
              This URL type is not supported for rich previews.
              Only internal topics, external Discourse forums in your
              allowlist, and Wikipedia links are supported.
            </p>
          {{/if}}
        </div>

        <div class="rplm-field">
          abel class="rplm-label" for="rplm-linktext">
            Link text
            <span class="rplm-optional">(optional — defaults to URL)</span>
          </label>
          <input
            id="rplm-linktext"
            type="text"
            class="rplm-input"
            placeholder="Display text for the link"
            value={{this.linkText}}
            {{on "input" this.onLinkTextInput}}
          />
        </div>

        <div class="rplm-field">
          abel class="rplm-label" for="rplm-title">
            Title attribute
            <span class="rplm-optional">(optional — shown on hover, helps SEO)</span>
          </label>
          <input
            id="rplm-title"
            type="text"
            class="rplm-input"
            placeholder="Brief description of the link destination"
            value={{this.title}}
            {{on "input" this.onTitleInput}}
          />
        </div>

        {{#if this.url}}
          <div class="rplm-preview-section">
            <p class="rplm-preview-label">Preview</p>

            <div class="rplm-visual-preview">
              {{#if this.showIconBefore}}
                <span class="rplm-icon" aria-hidden="true">{{this.iconGlyph}}</span>
              {{/if}}
              <a
                href={{this.url}}
                title={{this.title}}
                class="rplm-preview-link rplm-preview-link--{{this.detectedType}}"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{this.displayText}}
              </a>
              {{#if this.showIconAfter}}
                <span class="rplm-icon" aria-hidden="true">{{this.iconGlyph}}</span>
              {{/if}}
            </div>

            <div class="rplm-bbcode-preview">
              de>{{this.bbcodePreview}}</code>
            </div>
          </div>
        {{/if}}
      </:body>

      <:footer>
        <DButton
          @action={{this.onInsert}}
          @label="rich_previews.modal.insert"
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