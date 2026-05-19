# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Rich Previews BBCode", type: :system do
  fab!(:user) { Fabricate(:user) }
  fab!(:topic) { Fabricate(:topic) }
  fab!(:linked_topic) { Fabricate(:topic) }

  before do
    upload_theme_component
    sign_in(user)
  end

  it "renders preview-wrapped links without showing raw preview tags" do
    create_post(
      topic: topic,
      raw: "[preview][linked topic](#{linked_topic.url})[/preview]"
    )

    visit topic_path(topic)

    expect(page).to have_link("linked topic")
    expect(page).to have_css(".rich-preview-wrap[data-rich-preview='true']")
    expect(page).to have_no_text("[preview]")
    expect(page).to have_no_text("[/preview]")
  end

  it "renders a bare URL inside [preview] with one wrapped anchor and no raw preview tags" do
    create_post(
      topic: topic,
      raw: "[preview]https://denverit.com/[/preview]"
    )

    visit topic_path(topic)

    within(".topic-post .cooked") do
      expect(page).to have_css(
        ".rich-preview-wrap[data-rich-preview='true'] a[href='https://denverit.com/']",
        text: "https://denverit.com/"
      )
      expect(page).to have_css(".rich-preview-wrap[data-rich-preview='true']", count: 1)
      expect(page).to have_no_text("[preview]")
      expect(page).to have_no_text("[/preview]")
    end
  end

  it "renders a markdown link inside [preview] with one wrapped anchor and no raw preview tags" do
    create_post(
      topic: topic,
      raw: "[preview][Blog](https://blog.discourse.org)[/preview]"
    )

    visit topic_path(topic)

    within(".topic-post .cooked") do
      expect(page).to have_css(
        ".rich-preview-wrap[data-rich-preview='true'] a[href='https://blog.discourse.org']",
        text: "Blog"
      )
      expect(page).to have_css(".rich-preview-wrap[data-rich-preview='true']", count: 1)
      expect(page).to have_no_text("[preview]")
      expect(page).to have_no_text("[/preview]")
    end
  end
end