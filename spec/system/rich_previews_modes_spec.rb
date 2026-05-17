# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Rich preview modes", type: :system do
  fab!(:user) { Fabricate(:user) }
  fab!(:topic) { Fabricate(:topic) }
  fab!(:linked_topic) { Fabricate(:topic) }

  before do
    @theme = upload_theme_component
    sign_in(user)
  end

  it "still renders manual preview links when topic mode is composer_only" do
    @theme.update_setting(:previews_topic_mode, "composer_only")
    @theme.save!

    create_post(
      topic: topic,
      raw: "[preview][Linked topic](#{linked_topic.url})[/preview]"
    )

    visit topic_path(topic)

    expect(page).to have_css(
      "a.rich-preview-link.rich-preview-link--topic[data-bbcode='true']",
      text: "Linked topic"
    )
    expect(page).to have_no_text("[preview]")
    expect(page).to have_no_text("[/preview]")
  end
end