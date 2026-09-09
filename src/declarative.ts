export type PiPhiDeclarativeMetricDomain =
  | "generic"
  | "temperature"
  | "humidity"
  | "air_quality"
  | "energy"
  | "power"
  | "battery";

export type PiPhiDeclarativeStatusDomain =
  | "generic"
  | "light"
  | "switch"
  | "lock"
  | "door"
  | "motion"
  | "connectivity";

export type PiPhiDeclarativeProgressDomain =
  | "generic"
  | "battery"
  | "energy"
  | "level";

export interface PiPhiDeclarativeInteraction {
  /** Core-executed, non-mutating interaction. Command actions remain host-governed. */
  type: "details" | "refresh";
  label?: string;
}

export type PiPhiDeclarativeRecipeLeafItem =
  | { type: "text"; text?: string; setting_id?: string; variant?: "title" | "body" | "caption" }
  | { type: "metric"; slot_id: string; label?: string; format?: "auto" | "number" | "percent" | "temperature"; domain?: PiPhiDeclarativeMetricDomain; emphasis?: "normal" | "hero" | "compact"; show_freshness?: boolean; action?: PiPhiDeclarativeInteraction }
  | { type: "status"; slot_id: string; label?: string; true_label?: string; false_label?: string; domain?: PiPhiDeclarativeStatusDomain; show_freshness?: boolean; action?: PiPhiDeclarativeInteraction }
  | { type: "progress"; slot_id: string; label?: string; minimum?: number; maximum?: number; domain?: PiPhiDeclarativeProgressDomain; show_value?: boolean; action?: PiPhiDeclarativeInteraction };

export type PiPhiDeclarativeRecipeItem =
  | PiPhiDeclarativeRecipeLeafItem
  | {
      type: "group";
      id: string;
      label?: string;
      description?: string;
      layout?: "stack" | "grid";
      columns?: number;
      items: PiPhiDeclarativeRecipeLeafItem[];
    };

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
  metric: new Set(["type", "slot_id", "label", "format", "domain", "emphasis", "show_freshness", "action"]),
  status: new Set(["type", "slot_id", "label", "true_label", "false_label", "domain", "show_freshness", "action"]),
  progress: new Set(["type", "slot_id", "label", "minimum", "maximum", "domain", "show_value", "action"]),
  group: new Set(["type", "id", "label", "description", "layout", "columns", "items"]),
} as const;

const METRIC_DOMAINS = new Set(["generic", "temperature", "humidity", "air_quality", "energy", "power", "battery"]);
const STATUS_DOMAINS = new Set(["generic", "light", "switch", "lock", "door", "motion", "connectivity"]);
const PROGRESS_DOMAINS = new Set(["generic", "battery", "energy", "level"]);

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
  let leafCount = 0;
  const groupIds = new Set<string>();
  const validateLeaf = (candidate: unknown, path: string) => {
    const item = record(candidate);
    const type = String(item?.type ?? "") as keyof typeof ITEM_KEYS;
    if (!item || !["text", "metric", "status", "progress"].includes(type)) {
      error(`${path}.type`, "invalid_item_type", "Use text, metric, status, or progress inside a group.");
      return;
    }
    leafCount += 1;
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
    if (item.action !== undefined) {
      const action = record(item.action);
      if (!action || Object.keys(action).some((key) => !["type", "label"].includes(key))) error(`${path}.action`, "invalid_action", "Use a bounded Core interaction.");
      else {
        if (!["details", "refresh"].includes(String(action.type))) error(`${path}.action.type`, "invalid_action", "Use details or refresh.");
        if (action.label !== undefined && (typeof action.label !== "string" || action.label.length > 80)) error(`${path}.action.label`, "invalid_action_label", "Action labels must be at most 80 characters.");
      }
    }
    if (type === "metric") {
      if (item.format !== undefined && !["auto", "number", "percent", "temperature"].includes(String(item.format))) error(`${path}.format`, "invalid_format", "Use a supported metric format.");
      if (item.domain !== undefined && !METRIC_DOMAINS.has(String(item.domain))) error(`${path}.domain`, "invalid_domain", "Use a supported smart-home metric domain.");
      if (item.emphasis !== undefined && !["normal", "hero", "compact"].includes(String(item.emphasis))) error(`${path}.emphasis`, "invalid_emphasis", "Use normal, hero, or compact emphasis.");
    }
    if (type === "status" && item.domain !== undefined && !STATUS_DOMAINS.has(String(item.domain))) error(`${path}.domain`, "invalid_domain", "Use a supported smart-home status domain.");
    if (type === "progress") {
      const minimum = Number(item.minimum ?? 0);
      const maximum = Number(item.maximum ?? 100);
      if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum <= minimum) error(path, "invalid_progress_range", "Progress maximum must exceed minimum.");
      if (item.domain !== undefined && !PROGRESS_DOMAINS.has(String(item.domain))) error(`${path}.domain`, "invalid_domain", "Use a supported smart-home progress domain.");
    }
  };
  recipe.items.forEach((candidate, index) => {
    const item = record(candidate);
    const path = `recipe.items.${index}`;
    if (item?.type !== "group") {
      validateLeaf(candidate, path);
      return;
    }
    for (const key of Object.keys(item)) if (!ITEM_KEYS.group.has(key)) error(`${path}.${key}`, "unknown_field", "Groups accept only bounded layout metadata and native items.");
    const groupId = String(item.id ?? "");
    if (!ID.test(groupId)) error(`${path}.id`, "invalid_group_id", "Use a stable lowercase group id.");
    else if (groupIds.has(groupId)) error(`${path}.id`, "duplicate_group_id", "Group ids must be unique within a recipe.");
    else groupIds.add(groupId);
    if (item.label !== undefined && (typeof item.label !== "string" || item.label.length > 80)) error(`${path}.label`, "invalid_label", "Group labels must be at most 80 characters.");
    if (item.description !== undefined && (typeof item.description !== "string" || item.description.length > 160)) error(`${path}.description`, "invalid_description", "Group descriptions must be at most 160 characters.");
    if (item.layout !== undefined && !["stack", "grid"].includes(String(item.layout))) error(`${path}.layout`, "invalid_layout", "Use stack or grid.");
    const groupColumns = Number(item.columns ?? 2);
    if (!Number.isInteger(groupColumns) || groupColumns < 1 || groupColumns > 4) error(`${path}.columns`, "invalid_columns", "Group columns must be an integer from 1 through 4.");
    if (!Array.isArray(item.items) || item.items.length < 1 || item.items.length > 8) {
      error(`${path}.items`, "invalid_group_items", "Declare between 1 and 8 native items in a group.");
      return;
    }
    item.items.forEach((leaf, leafIndex) => validateLeaf(leaf, `${path}.items.${leafIndex}`));
  });
  if (leafCount > 16) error("recipe.items", "too_many_leaf_items", "A stacked experience may contain at most 16 native items.");
  return diagnostics;
}

export function assertValidDeclarativeWidgetRecipe(
  value: unknown,
  options: { bindingSlotIds?: string[]; settingIds?: string[] } = {},
): asserts value is PiPhiDeclarativeWidgetRecipe {
  const diagnostics = validateDeclarativeWidgetRecipe(value, options);
  if (diagnostics.length) throw new Error(diagnostics.map((item) => `${item.path}: ${item.message}`).join("\n"));
}
