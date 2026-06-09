# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Rich previews token syntax", type: :system do
  let!(:topic) { Fabricate(:topic) }
  let!(:linked_topic) { Fabricate(:topic) }

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

  it "renders a markdown link followed by {preview} without showing the raw token" do
    post = PostCreator.create!(
      Fabricate(:user),
      topic_id: topic.id,
      raw: "[linked topic](#{linked_topic.url}) {preview}"
    )

    visit(post.full_url)

    expect(page).to have_link("linked topic", href: linked_topic.url)
    expect(page).to have_no_text("{preview}")
  end

  it "renders a bare URL followed by {preview} without showing the raw token" do
    post = PostCreator.create!(
      Fabricate(:user),
      topic_id: topic.id,
      raw: "https://denverit.com/ {preview}"
    )

    visit(post.full_url)

    expect(page).to have_link(
      "https://denverit.com/",
      href: "https://denverit.com/"
    )
    expect(page).to have_no_text("{preview}")
  end

  it "suppresses rich preview decoration when {preview=off} is present" do
    post = PostCreator.create!(
      Fabricate(:user),
      topic_id: topic.id,
      raw: "[linked topic](#{linked_topic.url}) {preview=off}"
    )

    visit(post.full_url)

    expect(page).to have_link("linked topic", href: linked_topic.url)
    expect(page).to have_no_text("{preview=off}")
  end
end