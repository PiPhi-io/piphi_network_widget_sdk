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

export interface PiPhiWidgetThemeDefinition {
  id: string;
  name: string;
  description?: string;
  stylesheet: string;
  color_scheme?: "auto" | "light" | "dark";
}

export type PiPhiWidgetShellMode = "core" | "full-bleed";
export type PiPhiWidgetContentSurface = "transparent" | "opaque";
export type PiPhiWidgetAppearanceControl = "icon" | "title" | "surface" | "opacity" | "radius" | "shadow";

/** Declares the visual boundary between Core's card shell and package content. */
export interface PiPhiWidgetPresentationContract {
  contract_version: "1";
  shell: PiPhiWidgetShellMode;
  content_surface: PiPhiWidgetContentSurface;
  typography: "core";
  appearance_controls: PiPhiWidgetAppearanceControl[];
}

export type PiPhiWidgetInteractionTargetKind = "card" | "binding" | "control";
export type PiPhiWidgetInteractionAction = "none" | "more-info" | "history" | "popout" | "navigate" | "command" | "refresh";
export type PiPhiWidgetInteractionSemanticRole = "details" | "primary-control" | "secondary-control" | "drill-down" | "media" | "navigation";
export type PiPhiWidgetInteractionInput = "pointer" | "touch" | "keyboard";
export type PiPhiWidgetInteractionAffordance = "none" | "details" | "inline" | "overflow" | "content";
export type PiPhiWidgetInteractionDetailsTab = "overview" | "controls" | "history" | "activity";
export type PiPhiWidgetInteractionRisk = "none" | "low" | "confirmation" | "privileged";
export type PiPhiWidgetInteractionProtection = "none" | "confirmation" | "pin";
export type PiPhiWidgetInteractionUnavailableBehavior = "hide" | "disable";

/** A semantic, user-configurable hit target exposed by the widget. */
export interface PiPhiWidgetInteractionTargetDefinition {
  id: string;
  label: string;
  kind: PiPhiWidgetInteractionTargetKind;
  binding_slot_id?: string;
  allowed_actions: PiPhiWidgetInteractionAction[];
  default_action: PiPhiWidgetInteractionAction;
  semantic_role?: PiPhiWidgetInteractionSemanticRole;
  supported_inputs?: PiPhiWidgetInteractionInput[];
  affordance?: PiPhiWidgetInteractionAffordance;
  details_tab?: PiPhiWidgetInteractionDetailsTab;
  capability_requirements?: string[];
  risk?: PiPhiWidgetInteractionRisk;
  protection?: PiPhiWidgetInteractionProtection;
  accessibility_label?: string;
  unavailable?: PiPhiWidgetInteractionUnavailableBehavior;
}

export interface PiPhiWidgetManifest {
  id: string;
  name: string;
  description?: string;
  version: string;
  entry: string;
  artifact?: { release_asset: string; integrity?: string | null };
  integrity?: string;
  styles?: string[];
  style_integrities?: Record<string, string>;
  themes?: PiPhiWidgetThemeDefinition[];
  default_theme_id?: string;
  presentation?: PiPhiWidgetPresentationContract;
  interaction_contract_version?: "2";
  interaction_targets?: PiPhiWidgetInteractionTargetDefinition[];
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
  marketplace?: Record<string, unknown>;
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
const LOCAL_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const SETTING_TYPES = new Set(["text", "number", "boolean", "select", "device", "devices"]);
const BINDING_MODES = new Set(["read", "write", "read-write"]);
const VALUE_KINDS = new Set(["numeric", "text", "boolean", "enum", "json", "command"]);
const SAFE_SANDBOX_TOKENS = new Set(["allow-scripts"]);
const REQUIRED_STATES = ["loading", "live", "stale", "offline", "reconnecting", "denied", "error"];
const ARCHIVE_INTEGRITY = /^sha256:[a-f0-9]{64}$/;
const APPEARANCE_CONTROLS = new Set(["icon", "title", "surface", "opacity", "radius", "shadow"]);
const INTERACTION_TARGET_KINDS = new Set(["card", "binding", "control"]);
const INTERACTION_ACTIONS = new Set(["none", "more-info", "history", "popout", "navigate", "command", "refresh"]);
const INTERACTION_SEMANTIC_ROLES = new Set(["details", "primary-control", "secondary-control", "drill-down", "media", "navigation"]);
const INTERACTION_INPUTS = new Set(["pointer", "touch", "keyboard"]);
const INTERACTION_AFFORDANCES = new Set(["none", "details", "inline", "overflow", "content"]);
const INTERACTION_DETAILS_TABS = new Set(["overview", "controls", "history", "activity"]);
const INTERACTION_RISKS = new Set(["none", "low", "confirmation", "privileged"]);
const INTERACTION_PROTECTIONS = new Set(["none", "confirmation", "pin"]);
const INTERACTION_UNAVAILABLE_BEHAVIORS = new Set(["hide", "disable"]);
const V2_INTERACTION_FIELDS = ["semantic_role", "supported_inputs", "affordance", "details_tab", "capability_requirements", "risk", "protection", "accessibility_label", "unavailable"] as const;
const V2_INTERACTION_TARGET_KEYS = new Set(["id", "label", "kind", "binding_slot_id", "allowed_actions", "default_action", ...V2_INTERACTION_FIELDS]);

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
  if (manifest.artifact !== undefined) {
    const artifact = manifest.artifact && typeof manifest.artifact === "object" && !Array.isArray(manifest.artifact)
      ? manifest.artifact as Record<string, unknown> : {};
    if (!isSafeAssetPath(artifact.release_asset)) error("artifact.release_asset", "unsafe_release_asset", "Release asset must be a safe package-relative filename.");
    if (artifact.integrity != null && !ARCHIVE_INTEGRITY.test(String(artifact.integrity))) error("artifact.integrity", "invalid_archive_integrity", "Archive integrity must use sha256:<64 lowercase hex characters>.");
  }
  if (!Array.isArray(manifest.binding_modes) || manifest.binding_modes.length === 0) error("binding_modes", "missing_binding_modes", "Declare at least one binding mode.");
  else manifest.binding_modes.forEach((mode, index) => { if (!BINDING_MODES.has(String(mode))) error(`binding_modes.${index}`, "invalid_binding_mode", "Use read, write, or read-write."); });
  if (!Array.isArray(manifest.value_kinds) || manifest.value_kinds.length === 0) error("value_kinds", "missing_value_kinds", "Declare at least one value kind.");
  else manifest.value_kinds.forEach((kind, index) => { if (!VALUE_KINDS.has(String(kind))) error(`value_kinds.${index}`, "invalid_value_kind", "Use a supported public value kind."); });
  if (!manifest.security || typeof manifest.security !== "object") error("security", "missing_security", "A security policy is required.");
  const styles = Array.isArray(manifest.styles) ? manifest.styles : [];
  styles.forEach((path, index) => { if (!isSafeAssetPath(path)) error(`styles.${index}`, "unsafe_asset_path", "Style assets must be package-relative paths."); });
  const themes = Array.isArray(manifest.themes) ? manifest.themes : [];
  if (themes.length > 8) error("themes", "too_many_themes", "Declare no more than eight package themes.");
  const themeIds = new Set<string>();
  const themeStylesheets = new Set<string>();
  themes.forEach((candidate, index) => {
    const theme = candidate && typeof candidate === "object" && !Array.isArray(candidate)
      ? candidate as Record<string, unknown> : {};
    const id = String(theme.id ?? "").trim();
    const stylesheet = String(theme.stylesheet ?? "").trim();
    if (!LOCAL_ID.test(id)) error(`themes.${index}.id`, "invalid_theme_id", "Use a lowercase theme id.");
    if (themeIds.has(id)) error(`themes.${index}.id`, "duplicate_theme_id", `Theme '${id}' is duplicated.`);
    themeIds.add(id);
    if (!String(theme.name ?? "").trim()) error(`themes.${index}.name`, "missing_theme_name", "Each theme needs a user-facing name.");
    if (!isSafeAssetPath(stylesheet) || !stylesheet.toLowerCase().endsWith(".css")) error(`themes.${index}.stylesheet`, "unsafe_theme_stylesheet", "Theme stylesheets must be package-relative CSS assets.");
    if (themeStylesheets.has(stylesheet)) error(`themes.${index}.stylesheet`, "duplicate_theme_stylesheet", "Each theme must use its own stylesheet.");
    themeStylesheets.add(stylesheet);
    if (theme.color_scheme !== undefined && !["auto", "light", "dark"].includes(String(theme.color_scheme))) error(`themes.${index}.color_scheme`, "invalid_theme_color_scheme", "Use auto, light, or dark.");
  });
  if (manifest.default_theme_id !== undefined && !themeIds.has(String(manifest.default_theme_id))) error("default_theme_id", "unknown_default_theme", "Default theme must reference a declared theme.");
  if (manifest.presentation !== undefined) {
    const presentation = manifest.presentation && typeof manifest.presentation === "object" && !Array.isArray(manifest.presentation)
      ? manifest.presentation as Record<string, unknown> : {};
    if (presentation.contract_version !== "1") error("presentation.contract_version", "invalid_presentation_contract", "Use presentation contract version 1.");
    if (!["core", "full-bleed"].includes(String(presentation.shell))) error("presentation.shell", "invalid_shell_mode", "Use core or full-bleed shell ownership.");
    if (!["transparent", "opaque"].includes(String(presentation.content_surface))) error("presentation.content_surface", "invalid_content_surface", "Use transparent or opaque content surface.");
    if (presentation.typography !== "core") error("presentation.typography", "invalid_typography_policy", "Widget typography must inherit Core's type system.");
    if (!Array.isArray(presentation.appearance_controls)) error("presentation.appearance_controls", "missing_appearance_controls", "Declare the Core appearance controls this widget supports.");
    const controls = Array.isArray(presentation.appearance_controls) ? presentation.appearance_controls.map(String) : [];
    if (controls.length !== new Set(controls).size) error("presentation.appearance_controls", "duplicate_appearance_control", "Appearance controls must be unique.");
    controls.forEach((control, index) => { if (!APPEARANCE_CONTROLS.has(control)) error(`presentation.appearance_controls.${index}`, "invalid_appearance_control", "Use a supported Core appearance control."); });
    if (presentation.shell === "core" && presentation.content_surface !== "transparent") error("presentation.content_surface", "core_shell_requires_transparency", "Core-shell widgets must keep their content root transparent.");
  }
  const interactionTargets = Array.isArray(manifest.interaction_targets) ? manifest.interaction_targets : [];
  if (manifest.interaction_contract_version !== undefined && manifest.interaction_contract_version !== "2") error("interaction_contract_version", "invalid_interaction_contract_version", "Use interaction contract version 2.");
  if (manifest.interaction_targets !== undefined && !Array.isArray(manifest.interaction_targets)) error("interaction_targets", "invalid_interaction_targets", "Interaction targets must be an array.");
  if (interactionTargets.length > 16) error("interaction_targets", "too_many_interaction_targets", "Declare no more than sixteen semantic interaction targets.");
  const interactionTargetIds = new Set<string>();
  interactionTargets.forEach((candidate, index) => {
    const target = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate as Record<string, unknown> : {};
    const id = String(target.id ?? "").trim();
    if (!LOCAL_ID.test(id)) error(`interaction_targets.${index}.id`, "invalid_interaction_target_id", "Use a lowercase interaction target id.");
    if (interactionTargetIds.has(id)) error(`interaction_targets.${index}.id`, "duplicate_interaction_target_id", `Interaction target '${id}' is duplicated.`);
    interactionTargetIds.add(id);
    const label = String(target.label ?? "").trim();
    if (!label) error(`interaction_targets.${index}.label`, "missing_interaction_target_label", "Each interaction target needs a user-facing label.");
    if (label.length > 80) error(`interaction_targets.${index}.label`, "interaction_target_label_too_long", "Interaction target labels must be 80 characters or fewer.");
    if (!INTERACTION_TARGET_KINDS.has(String(target.kind ?? ""))) error(`interaction_targets.${index}.kind`, "invalid_interaction_target_kind", "Use card, binding, or control.");
    if (target.kind === "binding" && !LOCAL_ID.test(String(target.binding_slot_id ?? ""))) error(`interaction_targets.${index}.binding_slot_id`, "missing_interaction_binding", "Binding targets must reference a binding slot.");
    if (target.kind !== "binding" && target.binding_slot_id !== undefined) error(`interaction_targets.${index}.binding_slot_id`, "unexpected_interaction_binding", "Only binding targets may reference a binding slot.");
    const actions = Array.isArray(target.allowed_actions) ? target.allowed_actions.map(String) : [];
    if (actions.length === 0) error(`interaction_targets.${index}.allowed_actions`, "missing_interaction_actions", "Declare at least one allowed action.");
    if (actions.length !== new Set(actions).size) error(`interaction_targets.${index}.allowed_actions`, "duplicate_interaction_action", "Allowed actions must be unique.");
    actions.forEach((action, actionIndex) => { if (!INTERACTION_ACTIONS.has(action)) error(`interaction_targets.${index}.allowed_actions.${actionIndex}`, "invalid_interaction_action", "Use a supported Core interaction action."); });
    if (!actions.includes(String(target.default_action ?? ""))) error(`interaction_targets.${index}.default_action`, "invalid_default_interaction", "Default action must be included in allowed actions.");
    const hasV2Contract = manifest.interaction_contract_version === "2";
    if (!hasV2Contract) {
      for (const field of V2_INTERACTION_FIELDS) {
        if (target[field] !== undefined) error(`interaction_targets.${index}.${field}`, "v2_interaction_metadata_requires_contract", "V2 interaction metadata requires interaction_contract_version '2'.");
      }
      return;
    }
    const unknownKeys = Object.keys(target).filter((key) => !V2_INTERACTION_TARGET_KEYS.has(key));
    if (unknownKeys.length) error(`interaction_targets.${index}`, "invalid_v2_interaction_target_schema", `V2 targets contain unsupported fields: ${unknownKeys.join(", ")}.`);
    for (const field of ["id", "label", "kind", "default_action", "semantic_role", "affordance", "risk", "protection", "accessibility_label", "unavailable"] as const) {
      if (typeof target[field] !== "string") error(`interaction_targets.${index}.${field}`, "invalid_v2_interaction_field_type", `V2 target field '${field}' must be a string.`);
    }
    if (target.binding_slot_id !== undefined && typeof target.binding_slot_id !== "string") error(`interaction_targets.${index}.binding_slot_id`, "invalid_v2_interaction_field_type", "V2 binding_slot_id must be a string.");
    if (!Array.isArray(target.allowed_actions)) error(`interaction_targets.${index}.allowed_actions`, "invalid_v2_interaction_field_type", "V2 allowed_actions must be an array.");
    if (!INTERACTION_SEMANTIC_ROLES.has(String(target.semantic_role ?? ""))) error(`interaction_targets.${index}.semantic_role`, "missing_interaction_semantic_role", "V2 targets require a supported semantic role.");
    const inputs = Array.isArray(target.supported_inputs) ? target.supported_inputs.map(String) : [];
    if (inputs.length === 0) error(`interaction_targets.${index}.supported_inputs`, "missing_interaction_inputs", "V2 targets require at least one supported input.");
    if (inputs.length !== new Set(inputs).size) error(`interaction_targets.${index}.supported_inputs`, "duplicate_interaction_input", "Supported inputs must be unique.");
    inputs.forEach((input, inputIndex) => { if (!INTERACTION_INPUTS.has(input)) error(`interaction_targets.${index}.supported_inputs.${inputIndex}`, "invalid_interaction_input", "Use pointer, touch, or keyboard."); });
    if (target.default_action !== "none" && !inputs.includes("keyboard")) error(`interaction_targets.${index}.supported_inputs`, "interactive_target_requires_keyboard", "Interactive v2 targets require a keyboard input route.");
    if (!INTERACTION_AFFORDANCES.has(String(target.affordance ?? ""))) error(`interaction_targets.${index}.affordance`, "missing_interaction_affordance", "V2 targets require a supported affordance.");
    if (target.details_tab !== undefined && !INTERACTION_DETAILS_TABS.has(String(target.details_tab))) error(`interaction_targets.${index}.details_tab`, "invalid_interaction_details_tab", "Use overview, controls, history, or activity.");
    const requirements = Array.isArray(target.capability_requirements) ? target.capability_requirements.map(String) : [];
    if (target.capability_requirements !== undefined && !Array.isArray(target.capability_requirements)) error(`interaction_targets.${index}.capability_requirements`, "invalid_interaction_capabilities", "Capability requirements must be an array.");
    if (Array.isArray(target.capability_requirements) && target.capability_requirements.some((requirement) => typeof requirement !== "string")) error(`interaction_targets.${index}.capability_requirements`, "invalid_v2_interaction_field_type", "V2 capability requirements must be strings.");
    if (requirements.length !== new Set(requirements).size) error(`interaction_targets.${index}.capability_requirements`, "duplicate_interaction_capability", "Capability requirements must be unique.");
    requirements.forEach((requirement, requirementIndex) => { if (!LOCAL_ID.test(requirement)) error(`interaction_targets.${index}.capability_requirements.${requirementIndex}`, "invalid_interaction_capability", "Use a lowercase capability id."); });
    if (!INTERACTION_RISKS.has(String(target.risk ?? ""))) error(`interaction_targets.${index}.risk`, "missing_interaction_risk", "V2 targets require a supported risk classification.");
    if (!INTERACTION_PROTECTIONS.has(String(target.protection ?? ""))) error(`interaction_targets.${index}.protection`, "missing_interaction_protection", "V2 targets require a supported protection policy.");
    if (target.risk === "privileged" && target.protection !== "pin") error(`interaction_targets.${index}.protection`, "privileged_interaction_requires_pin", "Privileged interaction targets require PIN protection.");
    if (target.risk === "confirmation" && !["confirmation", "pin"].includes(String(target.protection))) error(`interaction_targets.${index}.protection`, "confirmation_interaction_requires_protection", "Confirmation-risk targets require confirmation or PIN protection.");
    const accessibilityLabel = String(target.accessibility_label ?? "").trim();
    if (!accessibilityLabel) error(`interaction_targets.${index}.accessibility_label`, "missing_interaction_accessibility_label", "V2 targets require an accessibility label.");
    if (accessibilityLabel.length > 120) error(`interaction_targets.${index}.accessibility_label`, "interaction_accessibility_label_too_long", "Accessibility labels must be 120 characters or fewer.");
    if (!INTERACTION_UNAVAILABLE_BEHAVIORS.has(String(target.unavailable ?? ""))) error(`interaction_targets.${index}.unavailable`, "missing_interaction_unavailable_behavior", "V2 targets require hide or disable behavior when unavailable.");
  });
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
  if (interactionTargets.some((candidate) => candidate && typeof candidate === "object" && Array.isArray((candidate as Record<string, unknown>).allowed_actions) && ((candidate as Record<string, unknown>).allowed_actions as unknown[]).includes("command")) && !permissions.includes("host.executeCommand")) error("interaction_targets", "command_interaction_requires_permission", "Command interactions require host.executeCommand permission and an explicit command allow-list.");
  if (interactionTargets.some((candidate) => candidate && typeof candidate === "object" && Array.isArray((candidate as Record<string, unknown>).allowed_actions) && ((candidate as Record<string, unknown>).allowed_actions as unknown[]).includes("navigate")) && !permissions.includes("host.navigate")) error("interaction_targets", "navigation_interaction_requires_permission", "Navigation interactions require host.navigate permission.");
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
