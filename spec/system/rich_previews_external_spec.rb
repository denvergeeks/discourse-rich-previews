# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Rich preview external links", type: :system do
  fab!(:user) { Fabricate(:user) }
  fab!(:topic) { Fabricate(:topic) }

  before do
    upload_theme_component
    sign_in(user)
  end

  def update_theme_setting(name, value)
    theme = Theme.last
    field = theme.theme_fields.find_by(name: "settings")
    settings = YAML.safe_load(field.value)
    settings[name.to_s] = value
    field.update!(value: settings.to_yaml)
    theme.save!
  end

  it "auto-detects eligible external links when external mode is autoonly" do
    update_theme_setting(:previewsexternalmode, "autoonly")

    create_post(
      topic: topic,
      raw: "See this external resource: https://example.com/articles/preview-target"
    )

    visit topic_path(topic)

    expect(page).to have_link(
      "https://example.com/articles/preview-target",
      href: "https://example.com/articles/preview-target"
    )
    expect(page).to have_css("a.rich-preview-link--external")
  end

  it "renders manual preview wraps for external links when external mode is composeronly" do
    update_theme_setting(:previewsexternalmode, "composeronly")

    create_post(
      topic: topic,
      raw: "preview[Example external site](https://example.com/articles/preview-target)preview"
    )

    visit topic_path(topic)

    expect(page).to have_css(".rich-preview-wrap[data-rich-preview='true']")
    expect(page).to have_css(".rich-preview-wrap--external")
    expect(page).to have_link(
      "Example external site",
      href: "https://example.com/articles/preview-target"
    )
    expect(page).not_to have_text("preview[")
  end

  it "does not auto-detect plain external links when external mode is composeronly" do
    update_theme_setting(:previewsexternalmode, "composeronly")

    create_post(
      topic: topic,
      raw: "See this external resource: https://example.com/articles/preview-target"
    )

    visit topic_path(topic)

    expect(page).to have_link(
      "https://example.com/articles/preview-target",
      href: "https://example.com/articles/preview-target"
    )
    expect(page).not_to have_css("a.rich-preview-link--external")
  end

  it "supports both auto and manual external previews when external mode is autoandcomposer" do
    update_theme_setting(:previewsexternalmode, "autoandcomposer")

    create_post(
      topic: topic,
      raw: <<~MD
        Plain external link: https://example.com/articles/preview-target

        preview[Wrapped external](https://example.com/articles/second-target)preview
      MD
    )

    visit topic_path(topic)

    expect(page).to have_css("a.rich-preview-link--external", minimum: 1)
    expect(page).to have_css(".rich-preview-wrap--external")
    expect(page).to have_link(
      "Wrapped external",
      href: "https://example.com/articles/second-target"
    )
  end

  it "disables both auto and manual external preview treatment when external mode is disabled" do
    update_theme_setting(:previewsexternalmode, "disabled")

    create_post(
      topic: topic,
      raw: <<~MD
        Plain external link: https://example.com/articles/preview-target

        preview[Wrapped external](https://example.com/articles/second-target)preview
      MD
    )

    visit topic_path(topic)

    expect(page).to have_link(
      "https://example.com/articles/preview-target",
      href: "https://example.com/articles/preview-target"
    )
    expect(page).to have_link(
      "Wrapped external",
      href: "https://example.com/articles/second-target"
    )
    expect(page).not_to have_css("a.rich-preview-link--external")
    expect(page).not_to have_css(".rich-preview-wrap--external")
  end
end