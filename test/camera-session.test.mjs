import assert from "node:assert/strict";
import test from "node:test";

import {
  BrokeredCameraSession,
  createWidgetHostCameraTransport,
  waitForCameraIceGathering,
} from "../dist/camera-session.js";

class FakePeerConnection {
  constructor(configuration) {
    this.configuration = configuration;
    this.iceGatheringState = "complete";
    this.localDescription = null;
    this.transceivers = [];
    this.listeners = new Map();
    this.closed = false;
  }

  addTransceiver(kind, options) {
    this.transceivers.push({ kind, options });
  }

  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }

  removeEventListener(name) {
    this.listeners.delete(name);
  }

  async createOffer() {
    return { type: "offer", sdp: "v=0\r\na=recvonly\r\n" };
  }

  async setLocalDescription(description) {
    this.localDescription = description;
  }

  async setRemoteDescription(description) {
    this.remoteDescription = description;
  }

  close() {
    this.closed = true;
  }
}

test("opens and closes a brokered recv-only camera session", async () => {
  const opened = [];
  const closed = [];
  const peer = new FakePeerConnection({});
  const session = new BrokeredCameraSession({
    includeAudio: true,
    onTrack() {},
    peerConnectionFactory: (configuration) => {
      peer.configuration = configuration;
      return peer;
    },
    transport: {
      async openSession(offer) {
        opened.push(offer);
        return { type: "answer", sdp: "v=0\r\na=sendonly\r\n", sessionId: "opaque-1" };
      },
      async closeSession(sessionId) {
        closed.push(sessionId);
      },
    },
  });

  assert.deepEqual(await session.start(), { sessionId: "opaque-1" });
  assert.deepEqual(peer.configuration, { bundlePolicy: "max-bundle" });
  assert.deepEqual(peer.transceivers.map(({ kind }) => kind), ["video", "audio"]);
  assert.deepEqual(opened, [{ type: "offer", sdp: "v=0\r\na=recvonly", includeAudio: true }]);
  assert.deepEqual(peer.remoteDescription, { type: "answer", sdp: "v=0\r\na=sendonly\r\n" });

  await session.close();
  await session.close();
  assert.equal(peer.closed, true);
  assert.deepEqual(closed, ["opaque-1"]);
});

test("closes the peer when the broker returns an invalid answer", async () => {
  const peer = new FakePeerConnection({});
  const session = new BrokeredCameraSession({
    onTrack() {},
    peerConnectionFactory: () => peer,
    transport: {
      async openSession() { return { sdp: "", sessionId: "opaque-1" }; },
      async closeSession() {},
    },
  });

  await assert.rejects(session.start(), /invalid WebRTC answer/);
  assert.equal(peer.closed, true);
});

test("adapts the trusted widget host without exposing camera source data", async () => {
  const calls = [];
  const transport = createWidgetHostCameraTransport({
    async openCameraSession(offer) {
      calls.push(["open", offer]);
      return { sdp: "answer", sessionId: "session-1" };
    },
    async closeCameraSession(sessionId) {
      calls.push(["close", sessionId]);
      return { ok: true };
    },
  }, "front-door");

  await transport.openSession({ type: "offer", sdp: "offer" });
  await transport.closeSession("session-1");
  assert.deepEqual(calls, [
    ["open", { type: "offer", sdp: "offer", slotId: "front-door" }],
    ["close", "session-1"],
  ]);
});

test("ICE gathering resolves on completion and removes its listener", async () => {
  const listeners = new Map();
  const peer = {
    iceGatheringState: "gathering",
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name) { listeners.delete(name); },
  };
  const waiting = waitForCameraIceGathering(peer, 100);
  peer.iceGatheringState = "complete";
  listeners.get("icegatheringstatechange")();
  await waiting;
  assert.equal(listeners.size, 0);
});
