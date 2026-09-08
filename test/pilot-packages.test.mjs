import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { validateDeclarativeWidgetRecipe } from "../dist/declarative.js";

for (const packageName of ["whole-home-energy", "home-health"]) {
  test(`${packageName} is a valid SDK 0.5 declarative package`, async () => {
    const source = JSON.parse(await readFile(
      resolve(import.meta.dirname, "..", "pilot-packages", packageName, "package.source.json"),
      "utf8",
    ));
    assert.equal(source.sdk_version_range, ">=0.5,<0.6");
    const slots = new Set(source.widgets[0].binding_slots.map((slot) => slot.id));
    assert.deepEqual(validateDeclarativeWidgetRecipe(source.widgets[0].recipe, {
      bindingSlotIds: [...slots],
      settingIds: [],
    }), []);
    for (const item of source.widgets[0].recipe.items) {
      if (item.slot_id) assert.equal(slots.has(item.slot_id), true);
    }
  });
}
