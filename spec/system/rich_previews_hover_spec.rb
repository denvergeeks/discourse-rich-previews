# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Rich preview hover behavior", type: :system do
  fab!(:user) { Fabricate(:user) }
  fab!(:topic) { Fabricate(:topic) }
  fab!(:linked_topic) { Fabricate(:topic) }

  before do
    upload_theme_or_component
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

  it "does not break topic page rendering" do
    visit topic_path(topic)
    expect(page).to have_css("body")
  end

  it "respects auto_only topic mode for eligible topic links" do
    update_theme_setting("previews_topic_mode", "auto_only")

    post =
      create_post(
        topic: topic,
        raw: "See [linked topic](#{linked_topic.url}) for more details"
      )

    visit topic_path(topic)

    expect(page).to have_link("linked topic")
  end

  it "can suppress automatic topic previews when composer_only is selected" do
    update_theme_setting("previews_topic_mode", "composer_only")

    create_post(
      topic: topic,
      raw: "See [linked topic](#{linked_topic.url}) for more details"
    )

    visit topic_path(topic)

    expect(page).to have_link("linked topic")
  end
end
