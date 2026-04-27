# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Discourse Rich Previews settings", type: :system do
  before do
    upload_theme_or_component
  end

  it "uploads without breaking core site features" do
    visit "/"
    expect(page).to have_css("body")
  end

  it "exposes the remote topic mode setting in theme settings" do
    visit "/admin/customize/themes"

    expect(page).to have_content("Discourse Rich Previews")
  end
end
