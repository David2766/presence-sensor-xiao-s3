export const ZONE_SELECTION_PRESERVE_SELECTOR = [
  "[data-zone-id]",
  "[data-zone-drag]",
  "[data-zone-edge]",
  "[data-zone-point]",
  "[data-zone-select]",
  "[data-calibration-info]",
  "[data-calibration-select]"
].join(", ");

export const APP_SELECTION_PRESERVE_SELECTOR = [
  "button",
  "input",
  "textarea",
  "select",
  "option",
  "a",
  ZONE_SELECTION_PRESERVE_SELECTOR,
  "[data-calibration-dialog]",
  "[data-protected-zone-dialog]",
  "[data-shrink-confirm-dialog]",
  ".target"
].join(", ");
