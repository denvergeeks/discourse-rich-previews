# frozen_string_literal: true

require "rails_helper"

describe "Rich previews remote topic icon placement", type: :system do
  let(:theme_id) { upload_theme_component }

  before do
    theme.update_setting(theme_id, :enabled, true)
    theme.update_setting(theme_id, :previews_show_icon, true)
    theme.update_setting(theme_id, :previews_icon_position, "after")
    theme.update_setting(theme_id, :previews_show_underline, true)
    theme.update_setting(theme_id, :previews_underline_always, true)
    theme.update_setting(theme_id, :remote_hosts, "noobish.me")

    sign_in(Fabricate(:admin))
  end

  it "renders remote topic preview bbcode as a single decorated anchor with inline icon" do
    topic = Fabricate(:topic)
    post =
      create_post(
        topic: topic,
        raw:
          '[preview="https://noobish.me/t/html-kitchen-sink/770" title="Brief description of the link on hover"]Text for the Link[/preview]'
      )

    visit post.url

    within(".cooked") do
      expect(page).to have_css(
        'a.rich-preview-link.rich-preview-link--remote_topic[href="https://noobish.me/t/html-kitchen-sink/770"]'
      )
      expect(page).to have_css(
        'a.rich-preview-link.rich-preview-link--remote_topic[title="Brief description of the link on hover"]',
        text: "Text for the Link"
      )
      expect(page).to have_css(
        "a.rich-preview-link.rich-preview-link--icon-after > .thc-inline-glyph"
      )
      expect(page).to have_no_css(".rich-preview-wrap")
      expect(page).to have_no_text("[preview]")
      expect(page).to have_no_text("[/preview]")
    end
  end
end