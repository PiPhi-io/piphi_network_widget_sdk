export type PiPhiWidgetSettingType = "text" | "number" | "boolean" | "select" | "device" | "devices";

export interface PiPhiWidgetSettingDefinition {
  id: string;
  type: PiPhiWidgetSettingType;
  label: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  options?: Array<{ label: string; value: unknown }>;
}

export interface PiPhiWidgetManifest {
  id: string;
  name: string;
  version: string;
  entry: string;
  integrity?: string;
  styles?: string[];
  style_integrities?: Record<string, string>;
  framework?: string;
  binding_modes: Array<"read" | "write" | "read-write">;
  value_kinds: Array<"numeric" | "text" | "boolean" | "enum" | "json" | "command">;
  capability_requirements?: string[];
  settings?: PiPhiWidgetSettingDefinition[];
  settings_schema_version?: string;
  sdk_compatibility?: {
    minimum: string;
    maximum?: string;
  };
  conformance?: {
    accessibility: "wcag2.2-aa";
    keyboard: boolean;
    themes: Array<"light" | "dark">;
    directions: Array<"ltr" | "rtl">;
    states: Array<"loading" | "live" | "stale" | "offline" | "reconnecting" | "denied" | "error">;
  };
  layout?: {
    default_height?: number;
    min_height?: number;
    max_height?: number;
    transparent?: boolean;
  };
  previews?: { light?: string; dark?: string };
  translations?: Record<string, Record<string, string>>;
  security: {
    permissions?: string[];
    allowed_commands?: string[];
    sandbox?: string[];
    csp?: Record<string, string[]>;
  };
}

export interface PiPhiWidgetManifestDiagnostic {
  path: string;
  code: string;
  severity: "error" | "warning";
  message: string;
}

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/;
const SETTING_TYPES = new Set(["text", "number", "boolean", "select", "device", "devices"]);
const BINDING_MODES = new Set(["read", "write", "read-write"]);
const VALUE_KINDS = new Set(["numeric", "text", "boolean", "enum", "json", "command"]);
const SAFE_SANDBOX_TOKENS = new Set(["allow-scripts"]);
const REQUIRED_STATES = ["loading", "live", "stale", "offline", "reconnecting", "denied", "error"];

function isSafeAssetPath(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  const normalized = value.replaceAll("\\\\", "/");
  return !/^(?:[a-z][a-z0-9+.-]*:|\/|\\\\)/i.test(normalized)
    && !normalized.split("/").includes("..");
}

export function validateWidgetManifest(value: unknown): PiPhiWidgetManifestDiagnostic[] {
  const diagnostics: PiPhiWidgetManifestDiagnostic[] = [];
  const manifest = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const error = (path: string, code: string, message: string) => diagnostics.push({ path, code, severity: "error", message });
  const warning = (path: string, code: string, message: string) => diagnostics.push({ path, code, severity: "warning", message });
  if (!ID.test(String(manifest.id ?? ""))) error("id", "invalid_id", "Use a reverse-domain widget id such as com.example.energy.");
  if (!String(manifest.name ?? "").trim()) error("name", "missing_name", "A user-facing widget name is required.");
  if (!SEMVER.test(String(manifest.version ?? ""))) error("version", "invalid_version", "Use semantic versioning, for example 1.0.0.");
  if (!String(manifest.entry ?? "").trim()) error("entry", "missing_entry", "An entry asset is required.");
  else if (!isSafeAssetPath(manifest.entry)) error("entry", "unsafe_asset_path", "Entry must be a package-relative path without traversal or a URL.");
  if (!Array.isArray(manifest.binding_modes) || manifest.binding_modes.length === 0) error("binding_modes", "missing_binding_modes", "Declare at least one binding mode.");
  else manifest.binding_modes.forEach((mode, index) => { if (!BINDING_MODES.has(String(mode))) error(`binding_modes.${index}`, "invalid_binding_mode", "Use read, write, or read-write."); });
  if (!Array.isArray(manifest.value_kinds) || manifest.value_kinds.length === 0) error("value_kinds", "missing_value_kinds", "Declare at least one value kind.");
  else manifest.value_kinds.forEach((kind, index) => { if (!VALUE_KINDS.has(String(kind))) error(`value_kinds.${index}`, "invalid_value_kind", "Use a supported public value kind."); });
  if (!manifest.security || typeof manifest.security !== "object") error("security", "missing_security", "A security policy is required.");
  const styles = Array.isArray(manifest.styles) ? manifest.styles : [];
  styles.forEach((path, index) => { if (!isSafeAssetPath(path)) error(`styles.${index}`, "unsafe_asset_path", "Style assets must be package-relative paths."); });
  const settings = Array.isArray(manifest.settings) ? manifest.settings : [];
  const settingIds = new Set<string>();
  settings.forEach((candidate, index) => {
    const setting = candidate && typeof candidate === "object" ? candidate as Record<string, unknown> : {};
    const id = String(setting.id ?? "").trim();
    if (!id) error(`settings.${index}.id`, "missing_setting_id", "Each setting needs an id.");
    if (settingIds.has(id)) error(`settings.${index}.id`, "duplicate_setting_id", `Setting '${id}' is duplicated.`);
    settingIds.add(id);
    if (!SETTING_TYPES.has(String(setting.type ?? ""))) error(`settings.${index}.type`, "invalid_setting_type", "Use a supported declarative setting type.");
    if (!String(setting.label ?? "").trim()) error(`settings.${index}.label`, "missing_setting_label", "Each setting needs a label.");
  });
  const translations = manifest.translations && typeof manifest.translations === "object" && !Array.isArray(manifest.translations)
    ? manifest.translations as Record<string, unknown>
    : {};
  const englishKeys = Object.keys((translations.en && typeof translations.en === "object") ? translations.en as Record<string, unknown> : {});
  for (const [locale, candidate] of Object.entries(translations)) {
    if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale)) error(`translations.${locale}`, "invalid_locale", "Use a BCP-47 language tag.");
    const catalog = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate as Record<string, unknown> : {};
    for (const key of englishKeys) if (!(key in catalog)) warning(`translations.${locale}.${key}`, "missing_translation", `Missing '${key}', so English will be used.`);
  }
  const layout = manifest.layout && typeof manifest.layout === "object" ? manifest.layout as Record<string, unknown> : {};
  const min = Number(layout.min_height ?? 120);
  const max = Number(layout.max_height ?? 1200);
  const preferred = Number(layout.default_height ?? 180);
  if (!(min > 0 && min <= preferred && preferred <= max)) error("layout", "invalid_height_contract", "Require 0 < min_height <= default_height <= max_height.");
  const previews = manifest.previews && typeof manifest.previews === "object" ? manifest.previews as Record<string, unknown> : {};
  if (!previews.light || !previews.dark) warning("previews", "missing_previews", "Provide light and dark preview assets for the card picker.");
  for (const key of ["light", "dark"]) if (previews[key] && !isSafeAssetPath(previews[key])) error(`previews.${key}`, "unsafe_asset_path", "Preview assets must be package-relative paths.");

  const compatibility = manifest.sdk_compatibility && typeof manifest.sdk_compatibility === "object"
    ? manifest.sdk_compatibility as Record<string, unknown> : {};
  if (!SEMVER.test(String(compatibility.minimum ?? ""))) error("sdk_compatibility.minimum", "missing_sdk_compatibility", "Declare the minimum compatible SDK version.");
  if (compatibility.maximum && !SEMVER.test(String(compatibility.maximum))) error("sdk_compatibility.maximum", "invalid_sdk_compatibility", "Maximum SDK compatibility must be semantic versioning.");

  const conformance = manifest.conformance && typeof manifest.conformance === "object"
    ? manifest.conformance as Record<string, unknown> : {};
  if (conformance.accessibility !== "wcag2.2-aa") error("conformance.accessibility", "missing_accessibility_contract", "Declare WCAG 2.2 AA conformance.");
  if (conformance.keyboard !== true) error("conformance.keyboard", "missing_keyboard_contract", "Declare keyboard operability.");
  for (const theme of ["light", "dark"]) if (!Array.isArray(conformance.themes) || !conformance.themes.includes(theme)) error("conformance.themes", "missing_theme_contract", `Declare ${theme} theme support.`);
  for (const direction of ["ltr", "rtl"]) if (!Array.isArray(conformance.directions) || !conformance.directions.includes(direction)) error("conformance.directions", "missing_direction_contract", `Declare ${direction} direction support.`);
  for (const state of REQUIRED_STATES) if (!Array.isArray(conformance.states) || !conformance.states.includes(state)) error("conformance.states", "missing_lifecycle_state", `Declare the ${state} lifecycle state.`);

  const security = manifest.security && typeof manifest.security === "object" ? manifest.security as Record<string, unknown> : {};
  const sandbox = Array.isArray(security.sandbox) ? security.sandbox : [];
  for (const token of sandbox) if (!SAFE_SANDBOX_TOKENS.has(String(token))) error("security.sandbox", "unsafe_sandbox_token", `Sandbox token '${String(token)}' is not permitted.`);
  const permissions = Array.isArray(security.permissions) ? security.permissions.map(String) : [];
  if (permissions.includes("host.executeCommand") && (!Array.isArray(security.allowed_commands) || security.allowed_commands.length === 0)) error("security.allowed_commands", "missing_command_allowlist", "Command widgets must explicitly allowlist commands.");
  const csp = security.csp && typeof security.csp === "object" && !Array.isArray(security.csp) ? security.csp as Record<string, unknown> : {};
  for (const [directive, sources] of Object.entries(csp)) {
    if (!Array.isArray(sources)) { error(`security.csp.${directive}`, "invalid_csp_sources", "CSP sources must be an array."); continue; }
    for (const source of sources) if (/^(?:\*|data:|blob:|http:)/i.test(String(source))) error(`security.csp.${directive}`, "unsafe_csp_source", `CSP source '${String(source)}' is not permitted.`);
  }
  return diagnostics;
}

export function assertValidWidgetManifest(value: unknown): asserts value is PiPhiWidgetManifest {
  const errors = validateWidgetManifest(value).filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length) throw new Error(errors.map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`).join("\n"));
}
