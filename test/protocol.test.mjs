import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_WIDGET_LAYOUT_CONTRACT,
  PIPHI_WIDGET_HOST_PROTOCOL,
  PIPHI_WIDGET_HOST_VERSION,
  isPiPhiWidgetBootstrap,
  normalizeWidgetLayoutContract,
  normalizeWidgetRuntimeHeight,
  normalizeWidgetSdkSettings,
} from "../dist/index.js";

test("exports the stable v1 protocol", () => {
  assert.equal(PIPHI_WIDGET_HOST_PROTOCOL, "piphi.widget.host");
  assert.equal(PIPHI_WIDGET_HOST_VERSION, "1");
});

test("normalizes settings and layout at the trust boundary", () => {
  assert.deepEqual(normalizeWidgetSdkSettings({ room: "Kitchen" }), { room: "Kitchen" });
  assert.deepEqual(normalizeWidgetSdkSettings(["invalid"]), {});
  assert.deepEqual(normalizeWidgetLayoutContract(undefined), DEFAULT_WIDGET_LAYOUT_CONTRACT);
  assert.deepEqual(
    normalizeWidgetLayoutContract({ minHeight: 160, defaultHeight: 240, maxHeight: 480 }),
    { minHeight: 160, defaultHeight: 240, maxHeight: 480 },
  );
  assert.equal(normalizeWidgetRuntimeHeight(40, { minHeight: 160, maxHeight: 480 }), 160);
  assert.equal(normalizeWidgetRuntimeHeight(900, { minHeight: 160, maxHeight: 480 }), 480);
  assert.equal(normalizeWidgetRuntimeHeight("invalid", undefined), null);
});

test("only accepts compatible bootstrap messages", () => {
  assert.equal(
    isPiPhiWidgetBootstrap({
      protocol: PIPHI_WIDGET_HOST_PROTOCOL,
      version: PIPHI_WIDGET_HOST_VERSION,
      type: "piphi.widget.bootstrap",
      instanceId: "widget-1",
    }),
    true,
  );
  assert.equal(
    isPiPhiWidgetBootstrap({
      protocol: PIPHI_WIDGET_HOST_PROTOCOL,
      version: "2",
      type: "piphi.widget.bootstrap",
      instanceId: "widget-1",
    }),
    false,
  );
});
