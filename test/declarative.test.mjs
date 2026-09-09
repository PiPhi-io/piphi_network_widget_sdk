import test from "node:test";
import assert from "node:assert/strict";

import { validateDeclarativeWidgetRecipe } from "../dist/declarative.js";

test("validates bounded native recipes against declared slots and settings", () => {
  const diagnostics = validateDeclarativeWidgetRecipe({
    schema_version: "1",
    layout: "grid",
    columns: 2,
    items: [
      { type: "text", setting_id: "heading" },
      { type: "metric", slot_id: "power", format: "number" },
      { type: "progress", slot_id: "battery", minimum: 0, maximum: 100 },
    ],
  }, { bindingSlotIds: ["power", "battery"], settingIds: ["heading"] });
  assert.deepEqual(diagnostics, []);
});

test("rejects scripts, arbitrary HTML, unknown references, and invalid ranges", () => {
  const diagnostics = validateDeclarativeWidgetRecipe({
    schema_version: "1",
    items: [
      { type: "script", code: "alert(1)" },
      { type: "text", text: "Unsafe", html: "<b>Unsafe</b>" },
      { type: "metric", slot_id: "unknown" },
      { type: "progress", slot_id: "battery", minimum: 5, maximum: 5 },
    ],
  }, { bindingSlotIds: ["battery"] });
  assert.ok(diagnostics.some((item) => item.code === "invalid_item_type"));
  assert.ok(diagnostics.some((item) => item.code === "unknown_field"));
  assert.ok(diagnostics.some((item) => item.code === "unknown_binding_slot"));
  assert.ok(diagnostics.some((item) => item.code === "invalid_progress_range"));
});

test("supports semantic primitives and bounded stacked device experiences", () => {
  const diagnostics = validateDeclarativeWidgetRecipe({
    schema_version: "1",
    layout: "stack",
    items: [
      {
        type: "group",
        id: "lighting",
        label: "Light",
        items: [
          { type: "status", slot_id: "power_state", domain: "light", true_label: "On", false_label: "Off" },
        ],
      },
      {
        type: "group",
        id: "energy",
        label: "Energy use",
        layout: "grid",
        columns: 2,
        items: [
          { type: "metric", slot_id: "power", domain: "power", emphasis: "hero" },
          { type: "progress", slot_id: "daily_energy", domain: "energy", minimum: 0, maximum: 10 },
        ],
      },
    ],
  }, { bindingSlotIds: ["power_state", "power", "daily_energy"] });
  assert.deepEqual(diagnostics, []);
});

test("accepts safe Core-executed interactions on declarative readings", () => {
  const diagnostics = validateDeclarativeWidgetRecipe({
    schema_version: "1",
    items: [
      { type: "metric", slot_id: "temperature", action: { type: "details", label: "View history" } },
      { type: "progress", slot_id: "battery", action: { type: "refresh" } },
    ],
  }, { bindingSlotIds: ["temperature", "battery"] });
  assert.deepEqual(diagnostics, []);
});

test("rejects executable or arbitrary declarative interactions", () => {
  const diagnostics = validateDeclarativeWidgetRecipe({
    schema_version: "1",
    items: [{ type: "metric", slot_id: "temperature", action: { type: "script", code: "alert(1)" } }],
  }, { bindingSlotIds: ["temperature"] });
  assert.ok(diagnostics.some((item) => item.code === "invalid_action"));
});

test("rejects nested custom UI and unsupported semantic domains", () => {
  const diagnostics = validateDeclarativeWidgetRecipe({
    schema_version: "1",
    items: [{
      type: "group",
      id: "device",
      items: [
        { type: "group", id: "nested", items: [{ type: "text", text: "No" }] },
        { type: "status", slot_id: "state", domain: "spaceship" },
      ],
    }],
  }, { bindingSlotIds: ["state"] });
  assert.ok(diagnostics.some((item) => item.code === "invalid_item_type"));
  assert.ok(diagnostics.some((item) => item.code === "invalid_domain"));
});
