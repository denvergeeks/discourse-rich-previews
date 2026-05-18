// Intentionally left inert.
//
// Rich preview BBCode registration is handled explicitly from
// javascripts/discourse/api-initializers/discourse-rich-previews.gjs
// via javascripts/discourse/lib/preview-bbcode.js.
//
// Keeping this file present avoids confusion during migration from the
// passive discourse-markdown loader path, which is not initializing in
// the current runtime.