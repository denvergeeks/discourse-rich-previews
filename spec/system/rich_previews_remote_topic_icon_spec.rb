# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Rich previews remote topic icon", type: :system do
  let!(:topic) { Fabricate(:topic) }

  fab!(:theme) do
    upload = Fabricate(:upload)

    Theme.create!(
      name: "Rich Previews",
      component: true,
      user: Discourse.system_user,
      remote_theme: RemoteTheme.new(remote_url: "https://example.com/repo"),
      theme_uploads: [
        ThemeUpload.new(
          upload: upload,
          theme_field: ThemeField.new(name: "about.json")
        ),
      ]
    )
  end

  before do
    SiteSetting.default_theme_id = theme.id
    theme.set_field(target: :common, name: "scss", value: "")
    theme.save!
  end

  it "renders a remote discourse topic preview-marked link without showing the raw token" do
    post = PostCreator.create!(
      Fabricate(:user),
      topic_id: topic.id,
      raw: "[Remote discussion](https://meta.discourse.org/t/discourse-icon/143374) {preview}"
    )

    visit(post.full_url)

    expect(page).to have_link(
      "Remote discussion",
      href: "https://meta.discourse.org/t/discourse-icon/143374"
    )
    expect(page).to have_no_text("{preview}")
  end
end