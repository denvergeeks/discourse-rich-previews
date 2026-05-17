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

  it "renders manual preview links when topic mode is composer_only" do
    @theme.update_setting(:previews_topic_mode, "composer_only")
    @theme.save!

    create_post(
      topic: topic,
      raw: "[preview][linked topic](#{linked_topic.url})[/preview]"
    )

    visit topic_path(topic)

    expect(page).to have_link("linked topic")
    expect(page).to have_css("a[data-rich-preview='true'][data-bbcode='true']")
  end

  it "does not expose raw preview tags when topic mode is composer_only" do
    @theme.update_setting(:previews_topic_mode, "composer_only")
    @theme.save!

    create_post(
      topic: topic,
      raw: "[preview][linked topic](#{linked_topic.url})[/preview]"
    )

    visit topic_path(topic)

    expect(page).not_to have_text("[preview]")
    expect(page).not_to have_text("[/preview]")
  end

  it "preserves markdown link title attributes inside preview bbcode" do
    @theme.update_setting(:previews_topic_mode, "composer_only")
    @theme.save!

    create_post(
      topic: topic,
      raw: %[ [preview][linked topic](#{linked_topic.url} "Hover title")[/preview] ]
    )

    visit topic_path(topic)

    expect(page).to have_css(
      "a[data-rich-preview='true'][data-bbcode='true'][title='Hover title']"
    )
    expect(page).to have_link("linked topic")
    expect(page).not_to have_text("[preview]")
    expect(page).not_to have_text("[/preview]")
  end
end