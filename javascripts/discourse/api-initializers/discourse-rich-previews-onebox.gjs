import { apiInitializer } from "discourse/lib/api";
import { readConfig, logDebug } from "../lib/rich-preview-utils";
import { applyOneboxMode } from "../lib/onebox-decorator";

export default apiInitializer("1.0", (api) => {
  let config;

  try {
    config = readConfig(settings);
  } catch (error) {
    console.error(
      "[discourse-rich-previews] Onebox decorator config error:",
      error
    );
    return;
  }

  if (!config?.enabled) {
    return;
  }

  api.decorateCookedElement(
    (element) => {
      applyOneboxMode(element, config);
    },
    {
      id: "discourse-rich-previews-onebox-decorator",
      onlyStream: false,
    }
  );

  logDebug(config, "Onebox decorator initialized", {
    previewsOneboxMode: config?.previewsOneboxMode || "disabled",
    previewLayout: config?.previewLayout || "hover_card",
  });
});