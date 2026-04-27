## **Current Repo State --- `external-topics` Branch**

## **File Tree (relevant JS/config files)**

**`javascripts/discourse/`
`  api-initializers/`
`    discourse-rich-previews.gjs       ← main entry point`
`  lib/`
`    rich-preview-utils.js             ← shared utilities + readConfig`
`    preview-router.js                 ← matchPreviewTarget dispatcher`
`    preview-renderer.js               ← HTML builders for all preview types`
`    preview-bbcode.js                 ← BBCode [preview] tag registration`
`    preview-composer-button.js        ← composer toolbar button`
`    providers/`
`      topic-provider.js               ← local + remote Discourse topic fetch`
`      wikipedia-provider.js           ← Wikipedia REST API fetch`
`      external-provider.js            ← generic external link fetch via proxy`
`settings.yml`**

---

## **File-by-File Summary**

## **`settings.yml`**

Fully object-schema `preview_providers` (no longer flat). Key settings:

* **`preview_providers`** --- `type: objects` with 4 defaults: `topic`, `remote_topic`, `external`, `wikipedia`. Each has: `key`, `enabled`, `label`, `glyph_mode` (none/icon/emoji), `icon`, `emoji`, `remote_hosts`, `require_https`, `timeout_ms`.

* **`previews_remote_topic_mode`** --- newly added enum (auto_only / composer_only / auto_and_composer / disabled), mirrors the topic/external/wikipedia mode settings.

* **`svg_icons`** --- `"comment|up-right-from-square|wikipedia-w"` (compact list).

* Visual: underline, icon, color settings per type.

* Thumbnail: desktop + mobile placement/size/mode settings.

* Content: title, excerpt, category, tags, op, publish date, views, reply count, likes, activity --- all per desktop/mobile toggle.

* Area enables: topic list, latest, categories, tags, search, topic page, user profile, other, kanban boards.

* Filtering: included/excluded tags + classes, excerpt excluded selectors.

* Wikipedia: base URL, show image, use extract HTML, density desktop/mobile.

* User preference: `disable_topic_hover_cards` field, admin field resolution.

* Performance: prefetch enabled/margin, topic cache max.

* Debug mode.

---

## **`rich-preview-utils.js`**

The central utility and config module. Exports:

**Constants:** `DELAY_HIDE` (120ms), `VIEWPORT_MARGIN` (8px), `TOOLTIP_ID`, `TOOLTIP_SELECTOR`

**Config:** `readConfig(settings)` --- maps all settings into a normalized config object. Includes all desktop/mobile pairs, provider normalization via `normalizePreviewProviders()`.

**Provider helpers:** `getPreviewProvider`, `providerEnabled`, `getRemoteTopicProvider`, `getWikipediaProvider`, `providerKeyForTarget`, `renderProviderGlyph`

**URL parsing:** `parseTopicUrl`, `parseRemoteDiscourseTopicUrl`, `parsePreviewTopicUrl`

**Link eligibility:** `linkInSupportedArea`, `isEligiblePreviewLink`, `classifyLink`, `isManuallyWrapped`, `autoPreviewEnabled`, `composerPreviewEnabled`, `previewTypeEnabled`, `composerButtonShouldShow`

**Filtering:** `matchesTagList`, `matchesClassList` (included/excluded rules)

**Caching:** `getCachedValue`, `setCachedValue` (LRU Map)

**DOM/text:** `sanitizeURL`, `escapeHTML`, `sanitizeExcerpt`, `safeAvatarURL`, `safeRemoteAvatarURL`, `normalizeTag`, `formatNumber`

**Viewport:** `createViewportState` --- `isMobileLayout()`, `isMobileInteractionMode()`

**User fields:** `normalizedFieldKeyVariants`, `findTruthyFieldMatch`, `currentUserIsStaffLike`

**Other:** `getJSON`, `logDebug`, `clamp`, `isElementVisible`, `inCookedPost`, `isCookedPostFragmentLink`, `currentTopicIdFromPage`, `isCurrentTopicLink`

---

## **`preview-router.js`**

Single export: `matchPreviewTarget(link, config)`.

Priority order:

1. `matchWikipediaPreview` --- checks `matchesWikipediaTarget`, returns `{ type: "wikipedia", providerKey: "wikipedia", key: "wikipedia:{host}:{pageKey}", ... }`

2. `matchTopicPreview` --- local (`parseTopicUrl`) -> `{ type: "topic", providerKey: "topic" }`, then remote (`parseRemoteDiscourseTopicUrl`) -> `{ type: "topic", providerKey: "remote_topic" }`

3. `matchExternalPreview` --- checks `matchesExternalTarget`, returns `{ type: "external", providerKey: "external", ... }`

---

## **`preview-renderer.js`**

Exports: `buildPreviewHTML`, `buildLoadingPreviewHTML`, `buildErrorPreviewHTML`

**`buildPreviewHTML`** dispatches by `preview.type`:

* `"wikipedia"` -> `buildWikipediaPreviewHTML`

* `"external"` -> `buildExternalPreviewHTML`

* `"topic"` -> `buildTopicPreviewHTML`

Internal helpers: `densityFor`, `buildSharedThumbnailHTML` (placement-aware), `buildMetaRow`, `buildMetaItem`, `buildTopicCategoryHTML`, `buildTagsHTML`, `buildAuthorHTML`, `buildExcerptHTML`, `buildTitleHTML`

Each builder produces a `<article class="topic-hover-card ...">` HTML string. Density class is set per type/mobile.

---

## **`providers/topic-provider.js`**

`createTopicProvider(api, config, topicCache, inFlightFetches)`

* Checks Ember store for local topic first (`store.peekRecord`)

* For local: fetches `/t/{id}.json` via `getJSON`

* For remote: fetches `{origin}/t/{id}.json` via `fetchViaProxy` (`/discourse-proxy-safe?url=...`)

* Normalizes result via `normalizeTopic` --- extracts excerpt, image URL, author, sets `is_remote_discourse_topic` flag

* LRU cache keyed on `{origin}:topic:{id}`, in-flight deduplication

---

## **`providers/wikipedia-provider.js`**

`createWikipediaProvider(config, previewCache, inFlightFetches)`

* Two-step fetch: Wikipedia REST search -> `summary` API

* Cache key: `wikipedia:{host}:{title}`

* Returns: `{ type: "wikipedia", title, excerpt, html (extract_html), imageurl, url, raw }`

* `fetchWikipediaPreview` sends `Api-User-Agent` header

* `matchesWikipediaTarget` checks `WIKIPEDIA_HOST_RE` + `/wiki/` pathname

* `getWikipediaHost` extracts hostname from link href

* `getWikipediaTitle` decodes URL pathname, replaces underscores

---

## **`providers/external-provider.js`**

`createExternalProvider(config)`

* `matchesExternalTarget` --- excludes: same origin, non-http(s), Wikipedia, local `/t/` paths, non-HTTPS if `require_https`

* `fetch(target)` -> `buildProxyUrl` -> `/discourse-proxy-safe?url=...`

* Response parsed as JSON (if content-type is JSON) or HTML (via `parseExternalHTML` using DOMParser + og:/twitter: meta tags)

* `normalizeExternalPreview` normalizes title, siteName, excerpt, imageUrl from multiple possible field names

---

## **`api-initializers/discourse-rich-previews.gjs`**

The main initializer (\~800+ lines). Key structure:

**Imports:** All utils, `matchPreviewTarget`, `buildPreviewHTML/Loading/Error`, all three providers, `registerPreviewBBCode`, `registerPreviewComposerButton`

**Local HTML builders** (topic-specific, in-initializer):
`discourseIcon`, `joinMetadataGroups`, `getSiteCategories`, `findCategoryById`, `pick`, `buildThumbnailHTML`, `buildCategoryHTML`, `buildTagsHTML`, `buildBadgesHTML`, `buildTitleHTML`, `buildExcerptHTML`, `buildOpHTML`, `buildPublishDateHTML`, `buildStatsHTML`, `buildMetadataHTML`, `buildMobileActionsHTML`, `buildCardHTML`

**State:** tooltip DOM element, show/hide timers, abort controllers, caches (topicCache, renderCache, previewCache, inFlightFetches), providers

**Card lifecycle:**

* `showCard` -> `fetchPreview` -> `getRenderedCard` (uses `buildCardHTML` for topic type, `buildPreviewHTML` from renderer for others)

* `hideCard`, `scheduleShow`, `scheduleHide`

* `positionTooltip` --- desktop: gap-below/above viewport logic; mobile: centered

**Events:** mouseover/mouseout (desktop), touchstart (mobile), document click (mobile tap-dismiss), scroll, resize

**Prefetch:** `IntersectionObserver` on eligible links + `MutationObserver` for dynamically added content

**User opt-out:** `hoverCardsDisabledForUser` --- checks `currentUser.custom_fields`, `user_fields`, resolves numeric user field ID via admin API for staff

**Initialization flow:**

```
js
```

**`(async () => {`
`  if (await hoverCardsDisabledForUser()) return;`
`  bindEvents();`
`  applyBodyClasses();`
`  api.onPageChange(...);`
`})()`**

---

## **Key Architectural Notes**

1. **Dual renderer path**: Topic previews use the in-initializer `buildCardHTML` (rich, with stats/badges/thumbnail layout options). Wikipedia and external previews use `buildPreviewHTML` from `preview-renderer.js`.

2. **Provider system**: All three providers share the same `fetch(target, signal)` interface and in-flight deduplication Map pattern.

3. **Config normalization**: `readConfig` in `rich-preview-utils.js` is the single source of truth for all config shapes. `normalizePreviewProviders` merges settings object schema defaults with user overrides.

4. **Remote topics**: Routed through `remote_topic` provider key, fetched via `/discourse-proxy-safe` proxy, distinguished from local topics via `isRemote` flag.

5. **`settings.yml` is fully objects-schema**: `preview_providers` uses `type: objects` with a defined `schema:` block --- no flat legacy fields remain for provider config.

[details="Summary"]
Current Repo State --- external-topics Branch
File Tree (relevant JS/config files)
text
javascripts/discourse/
api-initializers/
discourse-rich-previews.gjs       <- main entry point
lib/
rich-preview-utils.js             <- shared utilities + readConfig
preview-router.js                 <- matchPreviewTarget dispatcher
preview-renderer.js               <- HTML builders for all preview types
preview-bbcode.js                 <- BBCode \[preview\] tag registration
preview-composer-button.js        <- composer toolbar button
providers/
topic-provider.js               <- local + remote Discourse topic fetch
wikipedia-provider.js           <- Wikipedia REST API fetch
external-provider.js            <- generic external link fetch via proxy
settings.yml
File-by-File Summary
settings.yml
Fully object-schema preview_providers (no longer flat). Key settings:

preview_providers --- type: objects with 4 defaults: topic, remote_topic, external, wikipedia. Each has: key, enabled, label, glyph_mode (none/icon/emoji), icon, emoji, remote_hosts, require_https, timeout_ms.

previews_remote_topic_mode --- newly added enum (auto_only / composer_only / auto_and_composer / disabled), mirrors the topic/external/wikipedia mode settings.

svg_icons --- "comment|up-right-from-square|wikipedia-w" (compact list).

Visual: underline, icon, color settings per type.

Thumbnail: desktop + mobile placement/size/mode settings.

Content: title, excerpt, category, tags, op, publish date, views, reply count, likes, activity --- all per desktop/mobile toggle.

Area enables: topic list, latest, categories, tags, search, topic page, user profile, other, kanban boards.

Filtering: included/excluded tags + classes, excerpt excluded selectors.

Wikipedia: base URL, show image, use extract HTML, density desktop/mobile.

User preference: disable_topic_hover_cards field, admin field resolution.

Performance: prefetch enabled/margin, topic cache max.

Debug mode.

rich-preview-utils.js
The central utility and config module. Exports:

Constants: DELAY_HIDE (120ms), VIEWPORT_MARGIN (8px), TOOLTIP_ID, TOOLTIP_SELECTOR

Config: readConfig(settings) --- maps all settings into a normalized config object. Includes all desktop/mobile pairs, provider normalization via normalizePreviewProviders().

Provider helpers: getPreviewProvider, providerEnabled, getRemoteTopicProvider, getWikipediaProvider, providerKeyForTarget, renderProviderGlyph

URL parsing: parseTopicUrl, parseRemoteDiscourseTopicUrl, parsePreviewTopicUrl

Link eligibility: linkInSupportedArea, isEligiblePreviewLink, classifyLink, isManuallyWrapped, autoPreviewEnabled, composerPreviewEnabled, previewTypeEnabled, composerButtonShouldShow

Filtering: matchesTagList, matchesClassList (included/excluded rules)

Caching: getCachedValue, setCachedValue (LRU Map)

DOM/text: sanitizeURL, escapeHTML, sanitizeExcerpt, safeAvatarURL, safeRemoteAvatarURL, normalizeTag, formatNumber

Viewport: createViewportState --- isMobileLayout(), isMobileInteractionMode()

User fields: normalizedFieldKeyVariants, findTruthyFieldMatch, currentUserIsStaffLike

Other: getJSON, logDebug, clamp, isElementVisible, inCookedPost, isCookedPostFragmentLink, currentTopicIdFromPage, isCurrentTopicLink

preview-router.js
Single export: matchPreviewTarget(link, config).

Priority order:

matchWikipediaPreview --- checks matchesWikipediaTarget, returns { type: "wikipedia", providerKey: "wikipedia", key: "wikipedia:{host}:{pageKey}", ... }

matchTopicPreview --- local (parseTopicUrl) -> { type: "topic", providerKey: "topic" }, then remote (parseRemoteDiscourseTopicUrl) -> { type: "topic", providerKey: "remote_topic" }

matchExternalPreview --- checks matchesExternalTarget, returns { type: "external", providerKey: "external", ... }

preview-renderer.js
Exports: buildPreviewHTML, buildLoadingPreviewHTML, buildErrorPreviewHTML

buildPreviewHTML dispatches by preview.type:

"wikipedia" -> buildWikipediaPreviewHTML

"external" -> buildExternalPreviewHTML

"topic" -> buildTopicPreviewHTML

Internal helpers: densityFor, buildSharedThumbnailHTML (placement-aware), buildMetaRow, buildMetaItem, buildTopicCategoryHTML, buildTagsHTML, buildAuthorHTML, buildExcerptHTML, buildTitleHTML

Each builder produces a  HTML string. Density class is set per type/mobile.

providers/topic-provider.js
createTopicProvider(api, config, topicCache, inFlightFetches)

Checks Ember store for local topic first (store.peekRecord)

For local: fetches /t/{id}.json via getJSON

For remote: fetches {origin}/t/{id}.json via fetchViaProxy (/discourse-proxy-safe?url=...)

Normalizes result via normalizeTopic --- extracts excerpt, image URL, author, sets is_remote_discourse_topic flag

LRU cache keyed on {origin}:topic:{id}, in-flight deduplication

providers/wikipedia-provider.js
createWikipediaProvider(config, previewCache, inFlightFetches)

Two-step fetch: Wikipedia REST search -> summary API

Cache key: wikipedia:{host}:{title}

Returns: { type: "wikipedia", title, excerpt, html (extract_html), imageurl, url, raw }

fetchWikipediaPreview sends Api-User-Agent header

matchesWikipediaTarget checks WIKIPEDIA_HOST_RE + /wiki/ pathname

getWikipediaHost extracts hostname from link href

getWikipediaTitle decodes URL pathname, replaces underscores

providers/external-provider.js
createExternalProvider(config)

matchesExternalTarget --- excludes: same origin, non-http(s), Wikipedia, local /t/ paths, non-HTTPS if require_https

fetch(target) -> buildProxyUrl -> /discourse-proxy-safe?url=...

Response parsed as JSON (if content-type is JSON) or HTML (via parseExternalHTML using DOMParser + og:/twitter: meta tags)

normalizeExternalPreview normalizes title, siteName, excerpt, imageUrl from multiple possible field names

api-initializers/discourse-rich-previews.gjs
The main initializer (\~800+ lines). Key structure:

Imports: All utils, matchPreviewTarget, buildPreviewHTML/Loading/Error, all three providers, registerPreviewBBCode, registerPreviewComposerButton

Local HTML builders (topic-specific, in-initializer):
discourseIcon, joinMetadataGroups, getSiteCategories, findCategoryById, pick, buildThumbnailHTML, buildCategoryHTML, buildTagsHTML, buildBadgesHTML, buildTitleHTML, buildExcerptHTML, buildOpHTML, buildPublishDateHTML, buildStatsHTML, buildMetadataHTML, buildMobileActionsHTML, buildCardHTML

State: tooltip DOM element, show/hide timers, abort controllers, caches (topicCache, renderCache, previewCache, inFlightFetches), providers

Card lifecycle:

showCard -> fetchPreview -> getRenderedCard (uses buildCardHTML for topic type, buildPreviewHTML from renderer for others)

hideCard, scheduleShow, scheduleHide

positionTooltip --- desktop: gap-below/above viewport logic; mobile: centered

Events: mouseover/mouseout (desktop), touchstart (mobile), document click (mobile tap-dismiss), scroll, resize

Prefetch: IntersectionObserver on eligible links + MutationObserver for dynamically added content

User opt-out: hoverCardsDisabledForUser --- checks currentUser.custom_fields, user_fields, resolves numeric user field ID via admin API for staff

Initialization flow:

js
(async () => {
if (await hoverCardsDisabledForUser()) return;
bindEvents();
applyBodyClasses();
api.onPageChange(...);
})()
Key Architectural Notes
Dual renderer path: Topic previews use the in-initializer buildCardHTML (rich, with stats/badges/thumbnail layout options). Wikipedia and external previews use buildPreviewHTML from preview-renderer.js.

Provider system: All three providers share the same fetch(target, signal) interface and in-flight deduplication Map pattern.

Config normalization: readConfig in rich-preview-utils.js is the single source of truth for all config shapes. normalizePreviewProviders merges settings object schema defaults with user overrides.

Remote topics: Routed through remote_topic provider key, fetched via /discourse-proxy-safe proxy, distinguished from local topics via isRemote flag.

settings.yml is fully objects-schema: preview_providers uses type: objects with a defined schema: block --- no flat legacy fields remain for provider config.

[/details]


<div data-theme-toc="true"> </div>
