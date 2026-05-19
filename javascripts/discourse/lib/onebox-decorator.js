import {
  providerEnabled,
  providerModeForType,
  logDebug,
} from "./rich-preview-utils";

function oneboxPreviewsEnabled(config) {
  if (!config?.enabled) {
    return false;
  }

  if (!providerEnabled(config, "onebox")) {
    return false;
  }

  return providerModeForType("onebox", config) !== "disabled";
}

function shouldDecorateInComposerPreview(onebox) {
  return !!onebox.closest(".d-editor-preview, .composer-preview, .preview");
}

function shouldDecorateInCookedPost(onebox) {
  return !!onebox.closest(".cooked");
}

export function applyOneboxMode(root, config) {
  if (!(root instanceof Element)) {
    return;
  }

  if (!oneboxPreviewsEnabled(config)) {
    return;
  }

  const oneboxMode = providerModeForType("onebox", config);
  const useFullLayout = config?.previewLayout === "onebox";

  root.querySelectorAll("aside.onebox[data-onebox-src]").forEach((onebox) => {
    const inComposerPreview = shouldDecorateInComposerPreview(onebox);
    const inCookedPost = shouldDecorateInCookedPost(onebox);

    if (!inComposerPreview && !inCookedPost) {
      return;
    }

    if (oneboxMode === "composer_only" && !inComposerPreview) {
      return;
    }

    if (oneboxMode === "auto_only" && !inCookedPost) {
      return;
    }

    if (onebox.dataset.richPreviewOnebox === "true") {
      onebox.classList.toggle("rich-preview-onebox--full", useFullLayout);
      onebox.classList.toggle("rich-preview-onebox--compact", !useFullLayout);
      return;
    }

    onebox.dataset.richPreviewOnebox = "true";
    onebox.dataset.richPreviewProvider = "onebox";

    onebox.classList.add("rich-preview-onebox");
    onebox.classList.toggle("rich-preview-onebox--full", useFullLayout);
    onebox.classList.toggle("rich-preview-onebox--compact", !useFullLayout);
  });

  logDebug(config, "Applied onebox decoration to cooked content", {
    oneboxMode,
    previewLayout: config?.previewLayout || "hover_card",
  });
}