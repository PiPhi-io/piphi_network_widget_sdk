import test from "node:test";
import assert from "node:assert/strict";
import { validateWidgetManifest } from "../dist/manifest.js";

const valid = {
  id: "com.example.energy",
  name: "Energy",
  version: "1.0.0",
  entry: "./dist/widget.js",
  binding_modes: ["read"],
  value_kinds: ["numeric"],
  sdk_compatibility: { minimum: "0.3.0" },
  conformance: {
    accessibility: "wcag2.2-aa",
    keyboard: true,
    themes: ["light", "dark"],
    directions: ["ltr", "rtl"],
    states: ["loading", "live", "stale", "offline", "reconnecting", "denied", "error"],
  },
  layout: { min_height: 120, default_height: 180, max_height: 400 },
  previews: { light: "light.svg", dark: "dark.svg" },
  translations: { en: { title: "Energy" }, es: { title: "Energía" } },
  settings: [{ id: "title", type: "text", label: "Title" }],
  security: { permissions: [] },
};

test("validates a complete localized manifest", () => {
  assert.deepEqual(validateWidgetManifest(valid), []);
});

test("rejects unsafe or incomplete author contracts", () => {
  const diagnostics = validateWidgetManifest({ ...valid, id: "bad", version: "latest", entry: "../../private.js", settings: [{ id: "x", type: "script" }], security: { sandbox: ["allow-same-origin"], csp: { connect_src: ["*"] } } });
  assert.ok(diagnostics.some((item) => item.code === "invalid_id"));
  assert.ok(diagnostics.some((item) => item.code === "invalid_version"));
  assert.ok(diagnostics.some((item) => item.code === "invalid_setting_type"));
  assert.ok(diagnostics.some((item) => item.code === "unsafe_asset_path"));
  assert.ok(diagnostics.some((item) => item.code === "unsafe_sandbox_token"));
  assert.ok(diagnostics.some((item) => item.code === "unsafe_csp_source"));
});

test("validates bounded package themes and their default", () => {
  const themed = {
    ...valid,
    themes: [
      { id: "calm", name: "Calm", stylesheet: "themes/calm.css", color_scheme: "light" },
      { id: "night", name: "Night", stylesheet: "themes/night.css", color_scheme: "dark" },
    ],
    default_theme_id: "calm",
  };
  assert.deepEqual(validateWidgetManifest(themed), []);

  const diagnostics = validateWidgetManifest({
    ...valid,
    themes: [
      { id: "same", name: "One", stylesheet: "../theme.css" },
      { id: "same", name: "Two", stylesheet: "theme.js" },
    ],
    default_theme_id: "missing",
  });
  assert.ok(diagnostics.some((item) => item.code === "duplicate_theme_id"));
  assert.ok(diagnostics.some((item) => item.code === "unsafe_theme_stylesheet"));
  assert.ok(diagnostics.some((item) => item.code === "unknown_default_theme"));
});

test("validates Core shell ownership and semantic interaction targets", () => {
  const contracted = {
    ...valid,
    presentation: {
      contract_version: "1",
      shell: "core",
      content_surface: "transparent",
      typography: "core",
      appearance_controls: ["icon", "title", "surface", "opacity", "radius"],
    },
    interaction_targets: [{
      id: "temperature",
      label: "Temperature",
      kind: "binding",
      binding_slot_id: "temperature",
      allowed_actions: ["more-info", "history", "popout"],
      default_action: "more-info",
    }],
  };
  assert.deepEqual(validateWidgetManifest(contracted), []);

  const diagnostics = validateWidgetManifest({
    ...contracted,
    presentation: { ...contracted.presentation, content_surface: "opaque", appearance_controls: ["icon", "icon", "font"] },
    interaction_targets: [{ id: "command", label: "Run", kind: "control", allowed_actions: ["command"], default_action: "history" }],
  });
  assert.ok(diagnostics.some((item) => item.code === "core_shell_requires_transparency"));
  assert.ok(diagnostics.some((item) => item.code === "duplicate_appearance_control"));
  assert.ok(diagnostics.some((item) => item.code === "invalid_appearance_control"));
  assert.ok(diagnostics.some((item) => item.code === "invalid_default_interaction"));
  assert.ok(diagnostics.some((item) => item.code === "command_interaction_requires_permission"));

  const navigationDiagnostics = validateWidgetManifest({
    ...contracted,
    interaction_targets: [{
      id: "open-room",
      label: "Open room",
      kind: "card",
      allowed_actions: ["navigate"],
      default_action: "navigate",
    }],
  });
  assert.ok(navigationDiagnostics.some((item) => item.code === "navigation_interaction_requires_permission"));

  const unownedBinding = validateWidgetManifest({
    ...contracted,
    presentation: { ...contracted.presentation, appearance_controls: undefined },
    interaction_targets: [{ ...contracted.interaction_targets[0], kind: "card" }],
  });
  assert.ok(unownedBinding.some((item) => item.code === "missing_appearance_controls"));
  assert.ok(unownedBinding.some((item) => item.code === "unexpected_interaction_binding"));

  const excessiveTargets = validateWidgetManifest({
    ...contracted,
    interaction_targets: Array.from({ length: 17 }, (_, index) => ({
      id: `target-${index}`,
      label: `Target ${index}`,
      kind: "card",
      allowed_actions: ["more-info"],
      default_action: "more-info",
    })),
  });
  assert.ok(excessiveTargets.some((item) => item.code === "too_many_interaction_targets"));
});
