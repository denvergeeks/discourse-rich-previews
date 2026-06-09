import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { on } from "@ember/modifier";
import { scheduleOnce } from "@ember/runloop";
import { service } from "@ember/service";

import DModal from "discourse/components/d-modal";
import DButton from "discourse/components/d-button";

function safeTrim(value) {
  return String(value ?? "").trim();
}

function normalizeMode(value) {
  return value === "markdown" || value === "bare_url" ? value : "preview";
}

function buildMarkdownLink({ url, linkText, title }) {
  const href = safeTrim(url);
  const text = safeTrim(linkText) || href;
  const normalizedTitle = safeTrim(title);

  if (!href) {
    return "";
  }

  return normalizedTitle
    ? `[${text}](${href} "${normalizedTitle.replace(/"/g, "&quot;")}")`
    : `[${text}](${href})`;
}

function buildBareUrl({ url }) {
  return safeTrim(url);
}

function buildPreviewToken({ url, linkText, title }) {
  const href = safeTrim(url);
  const text = safeTrim(linkText) || href;
  const normalizedTitle = safeTrim(title);

  if (!href) {
    return "";
  }

  const markdown = normalizedTitle
    ? `[${text}](${href} "${normalizedTitle.replace(/"/g, "&quot;")}")`
    : `[${text}](${href})`;

  return `${markdown} {preview}`;
}

export default class RichPreviewLinkModal extends Component {
  @service modal;

  @tracked url = safeTrim(this.args.model?.initialUrl);
  @tracked linkText = safeTrim(this.args.model?.initialLinkText);
  @tracked title = safeTrim(this.args.model?.initialTitle);
  @tracked insertionMode = normalizeMode(
    this.args.model?.initialInsertionMode
  );

  get config() {
    return this.args.model?.config || {};
  }

  get previewSupported() {
    return this.config.previewsEnabled !== false;
  }

  get markdownSupported() {
    return this.config.markdownLinksEnabled !== false;
  }

  get bareUrlSupported() {
    return this.config.bareUrlsEnabled !== false;
  }

  get isValidUrl() {
    return /^https?:\/\/[^\s<>"']+$/i.test(this.url);
  }

  get isPreviewMode() {
    return this.insertionMode === "preview";
  }

  get isMarkdownMode() {
    return this.insertionMode === "markdown";
  }

  get isBareUrlMode() {
    return this.insertionMode === "bare_url";
  }

  get canInsertPreview() {
    return this.previewSupported && this.isValidUrl;
  }

  get canInsertMarkdown() {
    return this.markdownSupported && this.isValidUrl;
  }

  get canInsertBareUrl() {
    return this.bareUrlSupported && this.isValidUrl;
  }

  get insertDisabled() {
    if (this.isPreviewMode) {
      return !this.canInsertPreview;
    }

    if (this.isMarkdownMode) {
      return !this.canInsertMarkdown;
    }

    return !this.canInsertBareUrl;
  }

  get previewOutput() {
    return buildPreviewToken({
      url: this.url,
      linkText: this.linkText,
      title: this.title,
    });
  }

  get markdownOutput() {
    return buildMarkdownLink({
      url: this.url,
      linkText: this.linkText,
      title: this.title,
    });
  }

  get bareUrlOutput() {
    return buildBareUrl({
      url: this.url,
    });
  }

  get outputPreviewText() {
    if (this.isPreviewMode) {
      return this.previewOutput;
    }

    if (this.isMarkdownMode) {
      return this.markdownOutput;
    }

    return this.bareUrlOutput;
  }

  get modalTitle() {
    return "Insert Link";
  }

  get showLinkTextField() {
    return this.isPreviewMode || this.isMarkdownMode;
  }

  get showTitleField() {
    return this.isPreviewMode || this.isMarkdownMode;
  }

  @action
  didInsertForm(element) {
    scheduleOnce("afterRender", this, this.focusFirstInput, element);
  }

  focusFirstInput(element) {
    const input = element?.querySelector?.('input[name="rich-preview-url"]');
    input?.focus?.();
    input?.select?.();
  }

  @action
  updateUrl(event) {
    this.url = safeTrim(event?.target?.value);
  }

  @action
  updateLinkText(event) {
    this.linkText = safeTrim(event?.target?.value);
  }

  @action
  updateTitle(event) {
    this.title = safeTrim(event?.target?.value);
  }

  @action
  choosePreviewMode() {
    if (this.previewSupported) {
      this.insertionMode = "preview";
    }
  }

  @action
  chooseMarkdownMode() {
    if (this.markdownSupported) {
      this.insertionMode = "markdown";
    }
  }

  @action
  chooseBareUrlMode() {
    if (this.bareUrlSupported) {
      this.insertionMode = "bare_url";
    }
  }

  @action
  insert(event) {
    event?.preventDefault?.();

    if (this.insertDisabled) {
      return;
    }

    const insertedText = this.outputPreviewText;
    const onInsert = this.args.model?.onInsert;

    if (typeof onInsert === "function" && insertedText) {
      onInsert(insertedText);
    }

    this.modal.close();
  }

  @action
  cancel() {
    this.modal.close();
  }

  <template>
    <DModal
      @title={{this.modalTitle}}
      @closeModal={{this.cancel}}
      class="rich-preview-link-modal"
    >
      <:body>
        <div class="rich-preview-link-modal__body">
          <form
            class="rich-preview-link-modal__form"
            {{on "submit" this.insert}}
            {{on "did-insert" this.didInsertForm}}
          >
            <div class="rich-preview-link-modal__field">
              <label for="rich-preview-url">URL</label>
              <input
                id="rich-preview-url"
                name="rich-preview-url"
                class="rich-preview-link-modal__input"
                type="url"
                value={{this.url}}
                placeholder="https://example.com/topic/123"
                {{on "input" this.updateUrl}}
              />
            </div>

            {{#if this.showLinkTextField}}
              <div class="rich-preview-link-modal__field">
                <label for="rich-preview-link-text">Link text</label>
                <input
                  id="rich-preview-link-text"
                  name="rich-preview-link-text"
                  class="rich-preview-link-modal__input"
                  type="text"
                  value={{this.linkText}}
                  placeholder="Optional link text"
                  {{on "input" this.updateLinkText}}
                />
              </div>
            {{/if}}

            {{#if this.showTitleField}}
              <div class="rich-preview-link-modal__field">
                <label for="rich-preview-title">Title attribute</label>
                <input
                  id="rich-preview-title"
                  name="rich-preview-title"
                  class="rich-preview-link-modal__input"
                  type="text"
                  value={{this.title}}
                  placeholder="Optional title"
                  {{on "input" this.updateTitle}}
                />
              </div>
            {{/if}}

            <fieldset class="rich-preview-link-modal__modes">
              <legend>Insertion mode</legend>

              {{#if this.previewSupported}}
                <label class="rich-preview-link-modal__choice">
                  <input
                    type="radio"
                    name="rich-preview-mode"
                    checked={{this.isPreviewMode}}
                    {{on "change" this.choosePreviewMode}}
                  />
                  <span>Preview token</span>
                </label>
              {{/if}}

              {{#if this.markdownSupported}}
                <label class="rich-preview-link-modal__choice">
                  <input
                    type="radio"
                    name="rich-preview-mode"
                    checked={{this.isMarkdownMode}}
                    {{on "change" this.chooseMarkdownMode}}
                  />
                  <span>Markdown link</span>
                </label>
              {{/if}}

              {{#if this.bareUrlSupported}}
                <label class="rich-preview-link-modal__choice">
                  <input
                    type="radio"
                    name="rich-preview-mode"
                    checked={{this.isBareUrlMode}}
                    {{on "change" this.chooseBareUrlMode}}
                  />
                  <span>Bare URL</span>
                </label>
              {{/if}}
            </fieldset>

            <div class="rich-preview-link-modal__preview">
              <label for="rich-preview-output">Output</label>
              <textarea
                id="rich-preview-output"
                class="rich-preview-link-modal__output"
                rows="4"
                readonly
              >{{this.outputPreviewText}}</textarea>
            </div>
          </form>
        </div>
      </:body>

      <:footer>
        <DButton
          @label="modal.cancel"
          @action={{this.cancel}}
          class="btn-flat"
        />
        <DButton
          @label="modal.insert"
          @action={{this.insert}}
          class="btn-primary"
          @disabled={{this.insertDisabled}}
        />
      </:footer>
    </DModal>
  </template>
}
