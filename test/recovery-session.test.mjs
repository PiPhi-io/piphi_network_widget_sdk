import assert from "node:assert/strict";
import test from "node:test";
import {
  createRecoverySession,
  RecoverySessionStoppedError,
  resolveRecoveryStatus,
} from "../dist/recovery-session.js";

const copy = {
  updating: "Updating",
  stale: "Last known values",
  offline: "Offline",
  error: "Unable to update",
  waiting: "Waiting",
};

test("maps terminal lifecycle events to an actionable stale model", () => {
  for (const kind of ["error", "closed", "denied"]) {
    assert.deepEqual(resolveRecoveryStatus({ kind }, copy, true), {
      phase: "error",
      message: "Unable to update",
      stale: true,
      retry: true,
    });
  }
  assert.deepEqual(resolveRecoveryStatus({ kind: "reconnecting" }, copy, true), {
    phase: "loading",
    message: "Updating",
    stale: true,
    retry: false,
  });
});

test("deduplicates recovery and replaces a closed subscription exactly once", async () => {
  let listener;
  let reads = 0;
  let subscriptions = 0;
  let stops = 0;
  const events = [];
  let releaseRead;
  const delayedRead = new Promise((resolve) => { releaseRead = resolve; });
  const session = createRecoverySession({
    read: () => ++reads === 1 ? delayedRead : Promise.resolve({ value: 2 }),
    subscribe: async (next) => {
      subscriptions += 1;
      listener = next;
      return () => { stops += 1; };
    },
    onEvent: (event) => events.push(event.kind),
  });

  const first = session.recover();
  assert.equal(first, session.recover());
  releaseRead({ value: 1 });
  assert.deepEqual(await first, { ok: true });
  assert.equal(subscriptions, 1);
  assert.equal(session.hasSubscription(), true);

  listener({ kind: "closed" });
  assert.equal(session.hasSubscription(), false);
  assert.equal(stops, 1);
  assert.deepEqual(events, ["closed"]);

  const retry = session.recover();
  assert.equal(retry, session.recover());
  assert.deepEqual(await retry, { ok: true });
  assert.equal(reads, 2);
  assert.equal(subscriptions, 2);
  assert.equal(session.hasSubscription(), true);
  await session.stop();
  assert.equal(stops, 2);
});

test("fails recovery if a subscription closes before installation completes", async () => {
  let stops = 0;
  let failures = 0;
  const session = createRecoverySession({
    read: async () => ({ value: 1 }),
    subscribe: async (listener) => {
      listener({ status: "closed" });
      return () => { stops += 1; };
    },
    onError: () => { failures += 1; },
  });
  const result = await session.recover();
  assert.equal(session.hasSubscription(), false);
  assert.equal(stops, 1);
  assert.equal(failures, 1);
  assert.equal(result.ok, false);
});

test("a read failure resolves with an explicit error result and ordered callbacks", async () => {
  const error = new Error("read failed");
  const lifecycle = [];
  const session = createRecoverySession({
    read: async () => { lifecycle.push("read"); throw error; },
    subscribe: async () => { throw new Error("must not subscribe"); },
    onStart: () => lifecycle.push("start"),
    onError: (received) => { assert.equal(received, error); lifecycle.push("error"); },
    onSettled: () => lifecycle.push("settled"),
  });
  assert.deepEqual(await session.recover(), { ok: false, error });
  assert.deepEqual(lifecycle, ["start", "read", "error", "settled"]);
});

test("a subscribe failure resolves with an explicit error after the read", async () => {
  const error = new Error("subscribe failed");
  const lifecycle = [];
  const session = createRecoverySession({
    read: async () => { lifecycle.push("read"); return { value: 1 }; },
    subscribe: async () => { lifecycle.push("subscribe"); throw error; },
    onRead: () => lifecycle.push("onRead"),
    onError: () => lifecycle.push("error"),
    onSettled: () => lifecycle.push("settled"),
  });
  assert.deepEqual(await session.recover(), { ok: false, error });
  assert.deepEqual(lifecycle, ["read", "onRead", "subscribe", "error", "settled"]);
});

test("stop during a pending read permanently prevents subscription and recovery callbacks", async () => {
  let releaseRead;
  const pendingRead = new Promise((resolve) => { releaseRead = resolve; });
  let subscriptions = 0;
  let recovered = 0;
  let settled = 0;
  const session = createRecoverySession({
    read: () => pendingRead,
    subscribe: async () => { subscriptions += 1; return () => undefined; },
    onRecovered: () => { recovered += 1; },
    onSettled: () => { settled += 1; },
  });
  const recovery = session.recover();
  await session.stop();
  await session.stop();
  releaseRead({ value: 1 });
  const result = await recovery;
  assert.equal(result.ok, false);
  assert.ok(result.error instanceof RecoverySessionStoppedError);
  assert.equal(subscriptions, 0);
  assert.equal(recovered, 0);
  assert.equal(settled, 0);
  assert.equal((await session.recover()).ok, false);
});

test("stop during subscribe disposes the late subscription and remains idempotent", async () => {
  let releaseSubscribe;
  const pendingSubscribe = new Promise((resolve) => { releaseSubscribe = resolve; });
  let stops = 0;
  let recovered = 0;
  const session = createRecoverySession({
    read: async () => ({ value: 1 }),
    subscribe: () => pendingSubscribe,
    onRecovered: () => { recovered += 1; },
  });
  const recovery = session.recover();
  await new Promise(setImmediate);
  await session.stop();
  await session.stop();
  releaseSubscribe(() => { stops += 1; });
  const result = await recovery;
  await new Promise(setImmediate);
  assert.equal(result.ok, false);
  assert.ok(result.error instanceof RecoverySessionStoppedError);
  assert.equal(stops, 1);
  assert.equal(recovered, 0);
});
