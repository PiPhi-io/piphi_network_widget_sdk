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
