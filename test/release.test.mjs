import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { verifyReleaseTag, versionSatisfiesRange } from "../scripts/verify-release.mjs";

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

test("understands the bounded SDK ranges used by bundled packages", () => {
  assert.equal(versionSatisfiesRange("0.6.0", ">=0.5,<0.7"), true);
  assert.equal(versionSatisfiesRange("0.7.0", ">=0.5,<0.7"), false);
  assert.equal(versionSatisfiesRange("0.4.9", ">=0.5,<0.7"), false);
  assert.throws(() => versionSatisfiesRange("0.6.0", "^0.6"), /Unsupported SDK version clause/);
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

test("simulator emits and injects the complete light and dark design-token contract", async () => {
  const simulator = await readFile(new URL("../simulator/index.html", import.meta.url), "utf8");
  const tokenVariables = {
    accent: "accent", positive: "positive", warning: "warning", danger: "danger",
    canvas: "canvas", surface: "surface", surfaceMuted: "surface-muted",
    surfaceStrong: "surface-strong", border: "border", text: "text",
    textMuted: "text-muted", textOnAccent: "text-on-accent", fontFamily: "font-family",
    fontSize: "font-size", fontSizeLabel: "font-size-label", fontSizeTitle: "font-size-title",
    fontSizeValue: "font-size-value", fontSizeHero: "font-size-hero", lineHeight: "line-height",
    radius: "radius", controlRadius: "control-radius", shadow: "shadow",
    shadowRaised: "shadow-raised", space1: "space-1", space2: "space-2",
    space3: "space-3", space4: "space-4", contentGap: "content-gap",
    metricHeight: "metric-height", controlHeight: "control-height", focusRing: "focus-ring",
    motionDuration: "motion-duration",
  };
  for (const [key, suffix] of Object.entries(tokenVariables)) {
    assert.match(simulator, new RegExp(`${key}:\\s*["']--piphi-widget-${suffix}["']`), `${key} must be injected`);
    assert.match(simulator, new RegExp(`${key}:`), `${key} must be emitted`);
  }
  assert.match(simulator, /surfaceStrong:dark\?"#22304a":"#f8fafc"/);
  assert.match(simulator, /border:dark\?"#334155":"#d7e0eb"/);
  assert.match(simulator, /textMuted:dark\?"#bdc9d9":"#52647a"/);
  assert.match(simulator, /Object\.entries\(parent\.__piphiTokenVariables\)/);
  assert.match(simulator, /bootstrap\.host\.tokens\[name\]/);
});
