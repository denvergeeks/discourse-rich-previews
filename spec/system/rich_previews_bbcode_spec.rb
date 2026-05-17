# frozen_string_literal: true

require "rails_helper"

describe "Rich previews BBCode", type: :system do
  let(:theme_id) { upload_theme_component }

  before do
    theme.update_setting(theme_id, :enabled, true)
    theme.update_setting(theme_id, :previews_show_icon, true)
    theme.update_setting(theme_id, :previews_icon_position, "after")
    theme.update_setting(theme_id, :previews_show_underline, true)
    theme.update_setting(theme_id, :previews_underline_always, true)

    sign_in(Fabricate(:admin))
  end

  it "cooks preview bbcode to a decorated anchor without rendering bbcode delimiters" do
    topic = Fabricate(:topic)
    post =
      create_post(
        topic: topic,
        raw:
          '[preview="https://meta.discourse.org" title="Meta link"]Visit Meta[/preview]'
      )

    visit post.url

    within(".cooked") do
      expect(page).to have_link("Visit Meta", href: "https://meta.discourse.org")
      expect(page).to have_css(
        'a.rich-preview-link[data-bbcode="true"][data-rich-preview-type]'
      )
      expect(page).to have_css("a.rich-preview-link--external")
      expect(page).to have_css("a.rich-preview-link--underline-always")
      expect(page).to have_css("a.rich-preview-link--icon-after")
      expect(page).to have_css("a.rich-preview-link > .thc-inline-glyph")
      expect(page).to have_no_text("[preview]")
      expect(page).to have_no_text("[/preview]")
      expect(page).to have_no_css(".rich-preview-wrap")
    end
  end

  it "preserves the title attribute on preview bbcode links" do
    topic = Fabricate(:topic)
    post =
      create_post(
        topic: topic,
        raw:
          '[preview="https://meta.discourse.org" title="Brief description of the link on hover"]Text for the Link[/preview]'
      )

    visit post.url

    within(".cooked") do
      expect(page).to have_css(
        'a.rich-preview-link[title="Brief description of the link on hover"]',
        text: "Text for the Link"
      )
    end
  end
end