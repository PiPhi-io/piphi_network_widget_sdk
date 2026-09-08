export type PiPhiDeclarativeRecipeItem =
  | { type: "text"; text?: string; setting_id?: string; variant?: "title" | "body" | "caption" }
  | { type: "metric"; slot_id: string; label?: string; format?: "auto" | "number" | "percent" | "temperature"; show_freshness?: boolean }
  | { type: "status"; slot_id: string; label?: string; true_label?: string; false_label?: string; show_freshness?: boolean }
  | { type: "progress"; slot_id: string; label?: string; minimum?: number; maximum?: number; show_value?: boolean };

export interface PiPhiDeclarativeWidgetRecipe {
  schema_version: "1";
  layout?: "stack" | "grid";
  columns?: number;
  items: PiPhiDeclarativeRecipeItem[];
}

export interface PiPhiDeclarativeRecipeDiagnostic {
  path: string;
  code: string;
  message: string;
}

const ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const ROOT_KEYS = new Set(["schema_version", "layout", "columns", "items"]);
const ITEM_KEYS = {
  text: new Set(["type", "text", "setting_id", "variant"]),
  metric: new Set(["type", "slot_id", "label", "format", "show_freshness"]),
  status: new Set(["type", "slot_id", "label", "true_label", "false_label", "show_freshness"]),
  progress: new Set(["type", "slot_id", "label", "minimum", "maximum", "show_value"]),
} as const;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function validateDeclarativeWidgetRecipe(
  value: unknown,
  options: { bindingSlotIds?: string[]; settingIds?: string[] } = {},
): PiPhiDeclarativeRecipeDiagnostic[] {
  const diagnostics: PiPhiDeclarativeRecipeDiagnostic[] = [];
  const error = (path: string, code: string, message: string) => diagnostics.push({ path, code, message });
  const recipe = record(value);
  if (!recipe) return [{ path: "recipe", code: "invalid_recipe", message: "Recipe must be an object." }];
  for (const key of Object.keys(recipe)) if (!ROOT_KEYS.has(key)) error(`recipe.${key}`, "unknown_field", "Declarative recipes cannot contain arbitrary fields.");
  if (recipe.schema_version !== "1") error("recipe.schema_version", "unsupported_version", "Use declarative recipe schema version 1.");
  if (recipe.layout !== undefined && !["stack", "grid"].includes(String(recipe.layout))) error("recipe.layout", "invalid_layout", "Use stack or grid.");
  const columns = Number(recipe.columns ?? 2);
  if (!Number.isInteger(columns) || columns < 1 || columns > 4) error("recipe.columns", "invalid_columns", "Columns must be an integer from 1 through 4.");
  if (!Array.isArray(recipe.items) || recipe.items.length < 1 || recipe.items.length > 12) {
    error("recipe.items", "invalid_item_count", "Declare between 1 and 12 native recipe items.");
    return diagnostics;
  }
  const bindingSlots = new Set(options.bindingSlotIds ?? []);
  const settings = new Set(options.settingIds ?? []);
  const validateBindingReferences = options.bindingSlotIds !== undefined;
  const validateSettingReferences = options.settingIds !== undefined;
  recipe.items.forEach((candidate, index) => {
    const item = record(candidate);
    const path = `recipe.items.${index}`;
    const type = String(item?.type ?? "") as keyof typeof ITEM_KEYS;
    if (!item || !(type in ITEM_KEYS)) {
      error(`${path}.type`, "invalid_item_type", "Use text, metric, status, or progress.");
      return;
    }
    for (const key of Object.keys(item)) if (!(ITEM_KEYS[type] as ReadonlySet<string>).has(key)) error(`${path}.${key}`, "unknown_field", "Executable, HTML, CSS, URL, and arbitrary fields are not allowed.");
    if (type === "text") {
      const hasText = item.text !== undefined;
      const hasSetting = item.setting_id !== undefined;
      if (hasText === hasSetting) error(path, "invalid_text_source", "Text requires exactly one text or setting_id source.");
      if (hasText && (typeof item.text !== "string" || item.text.length > 240)) error(`${path}.text`, "invalid_text", "Text must be at most 240 characters.");
      if (hasSetting && (!ID.test(String(item.setting_id)) || (validateSettingReferences && !settings.has(String(item.setting_id))))) error(`${path}.setting_id`, "unknown_setting", "Reference a declared setting id.");
      return;
    }
    const slotId = String(item.slot_id ?? "");
    if (!ID.test(slotId) || (validateBindingReferences && !bindingSlots.has(slotId))) error(`${path}.slot_id`, "unknown_binding_slot", "Reference a declared binding slot id.");
    if (item.label !== undefined && (typeof item.label !== "string" || item.label.length > 80)) error(`${path}.label`, "invalid_label", "Labels must be at most 80 characters.");
    if (type === "metric" && item.format !== undefined && !["auto", "number", "percent", "temperature"].includes(String(item.format))) error(`${path}.format`, "invalid_format", "Use a supported metric format.");
    if (type === "progress") {
      const minimum = Number(item.minimum ?? 0);
      const maximum = Number(item.maximum ?? 100);
      if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum <= minimum) error(path, "invalid_progress_range", "Progress maximum must exceed minimum.");
    }
  });
  return diagnostics;
}

export function assertValidDeclarativeWidgetRecipe(
  value: unknown,
  options: { bindingSlotIds?: string[]; settingIds?: string[] } = {},
): asserts value is PiPhiDeclarativeWidgetRecipe {
  const diagnostics = validateDeclarativeWidgetRecipe(value, options);
  if (diagnostics.length) throw new Error(diagnostics.map((item) => `${item.path}: ${item.message}`).join("\n"));
}
