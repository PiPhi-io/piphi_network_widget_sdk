import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { createOptimisticControl } from "../dist/optimistic-control.js";

test("keeps an optimistic value through a slow command and stale telemetry", () => {
  const control = createOptimisticControl({ initial: false, now: () => 2_000_000_000_000 });
  control.begin(true);
  assert.equal(control.value, true);
  assert.equal(control.pending, true);
  control.observe(false, 1_999_999_999_000);
  assert.equal(control.value, true);
  control.accept();
  control.observe(false, 1_999_999_999_000);
  assert.equal(control.value, true);
  control.observe(true, 2_000_000_000_100);
  assert.equal(control.value, true);
  assert.equal(control.awaitingConfirmation, false);
  control.observe(false, 1_999_999_999_000);
  control.observe(false);
  assert.equal(control.value, true, "older or undated readings cannot replace a newer confirmation");
  control.destroy();
});

test("rolls back a rejected command and accepts a fresh contrary device reading", () => {
  const control = createOptimisticControl({ initial: 98, now: () => 2_000_000_000_000 });
  control.begin(60);
  control.reject();
  assert.equal(control.value, 98);
  control.begin(60);
  control.accept();
  control.observe(55, 2_000_000_001_000);
  assert.equal(control.value, 55);
  assert.equal(control.awaitingConfirmation, false);
  control.destroy();
});

test("silently restores the last reading when confirmation never arrives", async () => {
  const changes = [];
  const control = createOptimisticControl({ initial: 98, confirmationMs: 5, onChange: (value) => changes.push(value) });
  control.begin(60);
  control.accept();
  assert.equal(control.value, 60);
  await delay(20);
  assert.equal(control.value, 98);
  assert.deepEqual(changes.at(-1), 98);
  control.destroy();
});
