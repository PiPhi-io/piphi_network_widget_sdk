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

test("requests named bindings and scopes state to a slot", async () => {
  const harness = createWindowHarness();
  const client = createPiPhiWidgetClient({ window: harness.window });
  const bindingsPromise = client.getBindings();
  const bindingsRequest = harness.requests[0].payload;
  assert.equal(bindingsRequest.method, "host.getBindings");
  harness.dispatch({
    protocol: PIPHI_WIDGET_HOST_PROTOCOL,
    version: PIPHI_WIDGET_HOST_VERSION,
    type: "piphi.widget.response",
    requestId: bindingsRequest.requestId,
    success: true,
    result: { bindings: [{ id: "solar:1", role: "solar", label: "Solar", binding: { configId: "cfg-solar" } }] },
  });
  assert.equal((await bindingsPromise).bindings[0].role, "solar");

  const statePromise = client.getCapabilityState({ slotId: "solar:1", capabilityId: "production" });
  const stateRequest = harness.requests[1].payload;
  assert.deepEqual(stateRequest.params, { slotId: "solar:1", capabilityId: "production" });
  harness.dispatch({
    protocol: PIPHI_WIDGET_HOST_PROTOCOL,
    version: PIPHI_WIDGET_HOST_VERSION,
    type: "piphi.widget.response",
    requestId: stateRequest.requestId,
    success: true,
    result: { value: 4200 },
  });
  assert.deepEqual(await statePromise, { value: 4200 });
  client.destroy();
});

test("brokers camera sessions without accepting camera targets or credentials", async () => {
  const harness = createWindowHarness();
  const client = createPiPhiWidgetClient({ window: harness.window });
  const sessionPromise = client.openCameraSession({ type: "offer", sdp: "v=0", includeAudio: false });
  const openRequest = harness.requests[0].payload;
  assert.equal(openRequest.method, "host.openCameraSession");
  assert.deepEqual(openRequest.params, { type: "offer", sdp: "v=0", includeAudio: false });
  harness.dispatch({
    protocol: PIPHI_WIDGET_HOST_PROTOCOL,
    version: PIPHI_WIDGET_HOST_VERSION,
    type: "piphi.widget.response",
    requestId: openRequest.requestId,
    success: true,
    result: { sdp: "answer", sessionId: "camera-1" },
  });
  assert.deepEqual(await sessionPromise, { sdp: "answer", sessionId: "camera-1" });

  const closePromise = client.closeCameraSession("camera-1");
  const closeRequest = harness.requests[1].payload;
  assert.equal(closeRequest.method, "host.closeCameraSession");
  assert.deepEqual(closeRequest.params, { sessionId: "camera-1" });
  harness.dispatch({
    protocol: PIPHI_WIDGET_HOST_PROTOCOL,
    version: PIPHI_WIDGET_HOST_VERSION,
    type: "piphi.widget.response",
    requestId: closeRequest.requestId,
    success: true,
    result: { ok: true },
  });
  assert.deepEqual(await closePromise, { ok: true });
  client.destroy();
});

test("reports a clear error outside the PiPhi widget host", () => {
  assert.throws(
    () => getInjectedPiPhiWidgetHost(),
    /requires a browser window/,
  );
});

test("subscribes to typed state events and unsubscribes cleanly", async () => {
  const harness = createWindowHarness();
  const client = createPiPhiWidgetClient({ window: harness.window });
  const received = [];
  const subscriptionPromise = client.subscribeState(
    { capabilityIds: ["temperature", "humidity"] },
    (event) => received.push(event),
  );
  const subscribeRequest = harness.requests[0].payload;
  assert.equal(subscribeRequest.method, "host.subscribeState");
  harness.dispatch({
    protocol: PIPHI_WIDGET_HOST_PROTOCOL,
    version: PIPHI_WIDGET_HOST_VERSION,
    type: "piphi.widget.response",
    requestId: subscribeRequest.requestId,
    success: true,
    result: { subscriptionId: "state-1" },
  });
  const unsubscribe = await subscriptionPromise;
  harness.dispatch({
    protocol: PIPHI_WIDGET_HOST_PROTOCOL,
    version: PIPHI_WIDGET_HOST_VERSION,
    type: "piphi.widget.event",
    event: "state",
    subscriptionId: "state-1",
    payload: { kind: "point", data: { capabilityId: "temperature", value: 22 } },
  });
  assert.deepEqual(received, [{ kind: "point", data: { capabilityId: "temperature", value: 22 } }]);

  const unsubscribePromise = unsubscribe();
  const unsubscribeRequest = harness.requests[1].payload;
  assert.equal(unsubscribeRequest.method, "host.unsubscribeState");
  harness.dispatch({
    protocol: PIPHI_WIDGET_HOST_PROTOCOL,
    version: PIPHI_WIDGET_HOST_VERSION,
    type: "piphi.widget.response",
    requestId: unsubscribeRequest.requestId,
    success: true,
    result: { ok: true },
  });
  await unsubscribePromise;
  client.destroy();
});
