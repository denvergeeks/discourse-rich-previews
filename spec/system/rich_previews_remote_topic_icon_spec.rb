# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Rich preview remote-topic indicators", type: :system do
  fab!(:user) { Fabricate(:user) }
  fab!(:topic) { Fabricate(:topic) }

  before do
    @theme = upload_theme_component
    sign_in(user)

    @theme.update_setting(:previews_show_icon, true)
    @theme.update_setting(:previews_icon_position, "after")
    @theme.save!
  end

  it "adds the remote_topic wrapper class for wrapped remote-topic links" do
    create_post(
      topic: topic,
      raw: <<~MD
        [preview][Remote discussion](https://meta.discourse.org/t/discourse-icon/143374)[/preview]
      MD
    )

    visit topic_path(topic)

    expect(page).to have_css(".rich-preview-wrap--remote_topic")
    expect(page).to have_css(".rich-preview-wrap--icon-after")
    expect(page).to have_link("Remote discussion")
  end
end
