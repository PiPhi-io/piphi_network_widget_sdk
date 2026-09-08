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
