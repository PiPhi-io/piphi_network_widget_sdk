import assert from "node:assert/strict";
import test from "node:test";

import { verifyReleaseTag } from "../scripts/verify-release.mjs";

test("accepts a tag that exactly matches the package version", () => {
  assert.equal(verifyReleaseTag("v0.1.0", "0.1.0"), "v0.1.0");
  assert.equal(verifyReleaseTag("v1.2.3-beta.1", "1.2.3-beta.1"), "v1.2.3-beta.1");
});

test("rejects a tag that could publish the wrong package version", () => {
  assert.throws(
    () => verifyReleaseTag("v0.2.0", "0.1.0"),
    /does not match package version/,
  );
  assert.throws(() => verifyReleaseTag("0.1.0", "0.1.0"), /Expected v0.1.0/);
});
