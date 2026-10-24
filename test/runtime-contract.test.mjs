import assert from "node:assert/strict";
import test from "node:test";

import { PIPHI_WIDGET_RUNTIME_CONTRACT, isPiPhiWidgetRuntimeContract } from "../dist/index.js";

test("widget runtime contract explicitly excludes listener ports", () => {
  assert.deepEqual(PIPHI_WIDGET_RUNTIME_CONTRACT, { version: 1, port_binding: "not_applicable" });
  assert.equal(isPiPhiWidgetRuntimeContract(PIPHI_WIDGET_RUNTIME_CONTRACT), true);
  assert.equal(isPiPhiWidgetRuntimeContract({ ...PIPHI_WIDGET_RUNTIME_CONTRACT, port_env: "PORT" }), false);
});
