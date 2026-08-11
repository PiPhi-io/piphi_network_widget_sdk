import assert from "node:assert/strict";
import test from "node:test";

import {
  PIPHI_WIDGET_HOST_PROTOCOL,
  PIPHI_WIDGET_HOST_VERSION,
  PiPhiWidgetHostRequestError,
  createPiPhiWidgetClient,
  getInjectedPiPhiWidgetHost,
} from "../dist/index.js";

function createWindowHarness() {
  const listeners = new Set();
  const requests = [];
  const parent = {
    postMessage(payload, targetOrigin) {
      requests.push({ payload, targetOrigin });
    },
  };
  const window = {
    parent,
    setTimeout,
    clearTimeout,
    addEventListener(type, listener) {
      if (type === "message") listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === "message") listeners.delete(listener);
    },
  };
  return {
    window,
    requests,
    dispatch(data) {
      for (const listener of listeners) listener({ source: parent, data });
    },
    listenerCount: () => listeners.size,
  };
}

test("sends a versioned request and resolves the matching response", async () => {
  const harness = createWindowHarness();
  const client = createPiPhiWidgetClient({ window: harness.window, targetOrigin: "https://host.test" });

  const settingsPromise = client.getSettings();
  assert.equal(harness.requests.length, 1);
  const { payload, targetOrigin } = harness.requests[0];
  assert.equal(targetOrigin, "https://host.test");
  assert.equal(payload.protocol, PIPHI_WIDGET_HOST_PROTOCOL);
  assert.equal(payload.version, PIPHI_WIDGET_HOST_VERSION);
  assert.equal(payload.method, "host.getSettings");

  harness.dispatch({
    protocol: PIPHI_WIDGET_HOST_PROTOCOL,
    version: PIPHI_WIDGET_HOST_VERSION,
    type: "piphi.widget.response",
    requestId: payload.requestId,
    success: true,
    result: { compact: true },
  });

  assert.deepEqual(await settingsPromise, { compact: true });
  client.destroy();
  assert.equal(harness.listenerCount(), 0);
});

test("preserves structured host failures", async () => {
  const harness = createWindowHarness();
  const client = createPiPhiWidgetClient({ window: harness.window });
  const request = client.executeCommand({ commandName: "turn_on" });
  const { payload } = harness.requests[0];

  harness.dispatch({
    protocol: PIPHI_WIDGET_HOST_PROTOCOL,
    version: PIPHI_WIDGET_HOST_VERSION,
    type: "piphi.widget.response",
    requestId: payload.requestId,
    success: false,
    error: { code: "PERMISSION_DENIED", message: "Command permission is required." },
  });

  await assert.rejects(request, (error) => {
    assert.ok(error instanceof PiPhiWidgetHostRequestError);
    assert.equal(error.code, "PERMISSION_DENIED");
    return true;
  });
  client.destroy();
});

test("publishes compatible bootstrap updates to subscribers", () => {
  const harness = createWindowHarness();
  const client = createPiPhiWidgetClient({ window: harness.window });
  const received = [];
  const unsubscribe = client.subscribe((bootstrap) => received.push(bootstrap.instanceId));

  harness.dispatch({
    protocol: PIPHI_WIDGET_HOST_PROTOCOL,
    version: PIPHI_WIDGET_HOST_VERSION,
    type: "piphi.widget.bootstrap",
    instanceId: "widget-42",
    settings: {},
    binding: null,
    layout: { defaultHeight: 180, minHeight: 120, maxHeight: 1200 },
  });

  assert.deepEqual(received, ["widget-42"]);
  assert.equal(client.getBootstrap()?.instanceId, "widget-42");
  unsubscribe();
  client.destroy();
});

test("reports a clear error outside the PiPhi widget host", () => {
  assert.throws(
    () => getInjectedPiPhiWidgetHost(),
    /requires a browser window/,
  );
});
