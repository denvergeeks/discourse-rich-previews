# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Rich preview BBCode", type: :system do
  fab!(:user) { Fabricate(:user) }

  let!(:theme) { upload_theme_component }

  before do
    theme.update_setting(:providers, <<~JSON)
      {
        "topic": {
          "enabled": true,
          "icon": "comment",
          "glyphMode": "auto"
        },
        "remote_topic": {
          "enabled": true,
          "icon": "fab-discourse",
          "glyphMode": "auto",
          "remoteHosts": ["noobish.me", "meta.discourse.org"]
        },
        "external": {
          "enabled": true,
          "icon": "eye",
          "glyphMode": "auto"
        },
        "wikipedia": {
          "enabled": true,
          "icon": "fab-wikipedia-w",
          "glyphMode": "auto"
        }
      }
    JSON

    theme.update_setting(:previews_show_icon, true)
    theme.update_setting(:previews_icon_position, "after")
    theme.update_setting(:previews_show_underline, true)
    theme.update_setting(:previews_underline_always, true)

    sign_in(user)
  end

  def cooked_html_for(post)
    post.reload
    post.cooked
  end

  def expect_no_preview_literals(cooked)
    expect(cooked).not_to include("[preview]")
    expect(cooked).not_to include("[/preview]")
  end

  def expect_wrapped_preview(cooked, href:, text: nil, title: nil)
    expect(cooked).to include('class="rich-preview-wrap')
    expect(cooked).to include(%(data-preview-href="#{href}"))

    if text
      expect(cooked).to include(%(data-preview-text="#{text}"))
    end

    if title
      expect(cooked).to include(%(data-preview-title="#{title}"))
    end
  end

  shared_examples "wrapped preview bbcode syntax" do |raw:, href:, text:, title: nil|
    it "cooks without visible bbcode literals for #{raw.inspect}" do
      post = create_post(user: user, raw: raw)
      cooked = cooked_html_for(post)

      expect_no_preview_literals(cooked)
      expect_wrapped_preview(cooked, href: href, text: text, title: title)
    end

    it "renders a decorated wrapped link for #{raw.inspect}" do
      post = create_post(user: user, raw: raw)

      visit(post.topic.url)

      within(".topic-post:first-of-type .cooked") do
        expect(page).to have_no_text("[preview]")
        expect(page).to have_no_text("[/preview]")

        expect(page).to have_css(
          ".rich-preview-wrap .rich-preview-link",
          text: text
        )
      end
    end
  end

  include_examples(
    "wrapped preview bbcode syntax",
    raw: '[preview=https://denverit.com/ title="Brief Description"]Text for the Link[/preview]',
    href: "https://denverit.com/",
    text: "Text for the Link",
    title: "Brief Description"
  )

  include_examples(
    "wrapped preview bbcode syntax",
    raw: "[preview][Text for the Link](https://denverit.com/)[/preview]",
    href: "https://denverit.com/",
    text: "Text for the Link"
  )

  include_examples(
    "wrapped preview bbcode syntax",
    raw: "[preview]https://denverit.com/[/preview]",
    href: "https://denverit.com/",
    text: "https://denverit.com/"
  )

  it "supports remote topic preview bbcode without leaking literals" do
    post = create_post(
      user: user,
      raw: '[preview=https://noobish.me/t/html-kitchen-sink/770 title="Brief description of the link on hover"]Text for the Link[/preview]'
    )

    cooked = cooked_html_for(post)

    expect_no_preview_literals(cooked)
    expect_wrapped_preview(
      cooked,
      href: "https://noobish.me/t/html-kitchen-sink/770",
      text: "Text for the Link",
      title: "Brief description of the link on hover"
    )
  end

  it "supports wikipedia preview bbcode without leaking literals" do
    post = create_post(
      user: user,
      raw: "[preview][Wikipedia - Discourse](https://en.wikipedia.org/wiki/Discourse)[/preview]"
    )

    cooked = cooked_html_for(post)

    expect_no_preview_literals(cooked)
    expect_wrapped_preview(
      cooked,
      href: "https://en.wikipedia.org/wiki/Discourse",
      text: "Wikipedia - Discourse"
    )
  end

  it "keeps auto-detected plain links working" do
    post = create_post(
      user: user,
      raw: "https://denverit.com/"
    )

    visit(post.topic.url)

    within(".topic-post:first-of-type .cooked") do
      expect(page).to have_css("a.rich-preview-link.rich-preview-link--external")
      expect(page).to have_no_text("[preview]")
      expect(page).to have_no_text("[/preview]")
    end
  end
end