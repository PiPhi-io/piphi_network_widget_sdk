import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("publishes the framework-neutral Experience Kit stylesheet", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const stylesheet = await readFile(new URL("../experience-kit.css", import.meta.url), "utf8");
  assert.equal(packageJson.exports["./experience-kit.css"], "./experience-kit.css");
  assert.ok(packageJson.files.includes("experience-kit.css"));
  assert.match(stylesheet, /\.piphi-control/);
  assert.match(stylesheet, /data-piphi-domain="light"/);
  assert.match(stylesheet, /--piphi-widget-accent/);
  assert.match(stylesheet, /color: var\(--piphi-widget-text\)/);
});

test("ships package-theme controls in the local host simulator", async () => {
  const simulator = await readFile(new URL("../simulator/index.html", import.meta.url), "utf8");
  assert.match(simulator, /Experience theme/);
  assert.match(simulator, /experienceTheme/);
  assert.match(simulator, /--piphi-widget-accent/);
});
