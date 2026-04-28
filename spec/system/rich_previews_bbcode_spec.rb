# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Rich preview BBCode", type: :system do
  fab!(:user) { Fabricate(:user) }
  fab!(:topic) { Fabricate(:topic) }
  fab!(:linked_topic) { Fabricate(:topic) }

  before do
    upload_theme_or_component
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
    expect(page).not_to have_text("[preview]")
    expect(page).not_to have_text("[/preview]")
  end
end
