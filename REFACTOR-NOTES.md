# discourse-hover-previews — Refactor Notes

## What Changed and Why

### File Structure

```
Before (original):
  javascripts/discourse/api-initializers/discourse-hover-previews.gjs   (~850 lines, everything in one file)

After (refactored):
  javascripts/discourse/api-initializers/discourse-hover-previews.gjs   (~270 lines — only init/event logic)
  javascripts/discourse/components/topic-hover-card.gjs                 (~350 lines — Glimmer component)
  javascripts/discourse/lib/hover-preview-utils.js                      (~280 lines — pure utilities)
```

---

## Issue-by-Issue Changes

### 1. ✅ Removed `initialized` singleton guard
The module-level `let initialized = false` flag has been removed. `apiInitializer("1.0", ...)` handles
lifecycle idempotency correctly on its own. The version string `"1.0"` passed to apiInitializer is the
recommended current approach for theme components.

### 2. ✅ Migrated to Glimmer component (`topic-hover-card.gjs`)
The entire card HTML is now rendered by a proper Glimmer component using `<template>` syntax and
`@glimmer/component`. This means:
  - All display logic uses Ember's reactive system (`@tracked`, getters)
  - Text content is safely escaped by Glimmer's template engine (no more manual escapeHTML)
  - `@service site` injects site categories instead of a manual container lookup
  - `iconNode` replaces `iconHTML` string injection for proper Ember icon rendering
  - The `<template>` block uses `{{on}}` modifiers for event handlers (no inline onclick)

### 3. ✅ `renderComponent` for Glimmer-into-DOM mounting
The card is mounted into the tooltip DOM node via `renderComponent` from `discourse/lib/render-glimmer`.
This is the Discourse-approved pattern for mounting Glimmer components into non-Glimmer-managed DOM
(e.g. a manually created `div` appended to `document.body`). Each state change calls mountCard() which
teardowns the previous render and mounts a fresh one with updated args.

### 4. ✅ Fixed `discourse-common` deprecated import
```js
// Before (deprecated shim path):
import { iconHTML } from "discourse-common/lib/icon-library";

// After (correct 2026.x path):
import { iconNode } from "discourse/lib/icon-library";
```
`iconNode` returns a DOM node (used inside Glimmer templates), whereas `iconHTML` returned a string.
In the Glimmer template we use `{{iconNode "heart"}}` etc.

### 5. ✅ Timer cancellation on teardown
All three timers (`showTimer`, `hideTimer`, `clearSuppressionTimer`) are now explicitly cancelled in
`runCleanup()`. Additionally, `api.cleanupStream(runCleanup)` is called so Discourse's own lifecycle
management triggers cleanup when the theme is disabled or the user navigates away.

### 6. ✅ Discourse store peek before raw fetch
`fetchTopic` now checks `store.peekRecord("topic", topicId)` before issuing a network request. This
avoids redundant fetches for topics already loaded in the Discourse SPA session.

### 7. ✅ Admin API call guard
`resolveUserFieldIdForAdmins` now short-circuits with `return null` when the configured field name is
already a numeric string — since `normalizedFieldKeyVariants` already handles numeric→user_field_N
mapping without any API call needed.

### 8. ✅ ARIA `aria-describedby` linking
Each time a card is shown, the triggering `<a>` element receives `aria-describedby="topic-hover-card-tooltip"`.
On hide, all such attributes are removed. The tooltip element uses `id="topic-hover-card-tooltip"` instead
of a class selector to make the ARIA reference valid.

### 9. ✅ CSS: `contain: layout paint` → `contain: layout`
Removed `paint` from the `contain` property on `.topic-hover-card`. `layout` alone is sufficient to
establish a layout containment context without the paint-clipping side effects.

### 10. ✅ CSS: Hardcoded colors replaced with CSS variables
```scss
// Before:
color: #fff;
background: var(--danger, #b31b1b);

// After:
color: var(--secondary);
background: var(--danger);
```

### 11. ✅ `is-above` transition fix
The CSS for `.topic-hover-card-tooltip` now uses `will-change: transform, opacity` to pre-composite
the layer. The `is-above` transform origin is handled by ensuring the class is toggled in the same
animation frame as `is-visible` via `positionNextFrame`.

---

## How to Apply

1. Replace `javascripts/discourse/api-initializers/discourse-hover-previews.gjs` with the refactored version.
2. Create `javascripts/discourse/components/topic-hover-card.gjs` (new file).
3. Create `javascripts/discourse/lib/hover-preview-utils.js` (new file).
4. Update `common/common.scss`:
   - Change `.topic-hover-card { contain: layout paint }` → `contain: layout`
   - Change `.topic-hover-card__close { color: #fff }` → `color: var(--secondary)`
   - Change `.topic-hover-card-tooltip` to use `id` selector: `#topic-hover-card-tooltip`
   - Add `will-change: transform, opacity` to `.topic-hover-card-tooltip`
5. Update `about.json`: `"minimum_discourse_version": "3.3.0"`
6. Populate `.discourse-compatibility` with a pre-3.3 commit pin if needed.

---

## Minimum Discourse Version

The `renderComponent` helper from `discourse/lib/render-glimmer` requires Discourse ≥ 3.3.
The `.gjs` Glimmer format with `<template>` requires the same minimum.
Set `about.json` → `"minimum_discourse_version": "3.3.0"`.
