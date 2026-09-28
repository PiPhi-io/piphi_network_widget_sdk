import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const stylesheet = await readFile(new URL("../experience-kit.css", import.meta.url), "utf8");

test("defines the complete Core-owned visual token foundation", () => {
  for (const token of [
    "accent", "positive", "warning", "danger", "canvas", "surface", "surface-muted",
    "surface-strong", "border", "text", "text-muted", "text-on-accent",
    "font-family", "font-size", "font-size-label", "font-size-title",
    "font-size-value", "font-size-hero", "line-height", "radius", "control-radius",
    "shadow", "shadow-raised", "space-1", "space-2", "space-3", "space-4",
    "content-gap", "metric-height", "control-height", "focus-ring", "motion-duration",
  ]) {
    assert.match(stylesheet, new RegExp(`--piphi-widget-${token}:`));
  }
});

function resolveFoundationVariables(css) {
  const tokens = new Map(
    [...css.matchAll(/(--piphi-[\w-]+):\s*([^;]+);/g)]
      .map(([, name, value]) => [name, value.trim()]),
  );
  let resolved = css;
  for (let pass = 0; pass < 3; pass += 1) {
    resolved = resolved.replace(/var\((--piphi-[\w-]+)(?:,\s*([^\)]+))?\)/g, (_, name, fallback) => (
      tokens.get(name) || fallback || "initial"
    ));
  }
  return resolved;
}

test("keeps readable type and every interactive primitive usable at Core's 14px root", () => {
  const dom = new JSDOM(`<!doctype html><html style="font-size:14px"><head><style>${resolveFoundationVariables(stylesheet)}</style></head><body>
    <p class="piphi-title">Title</p><p class="piphi-subtitle">Subtitle</p>
    <p class="piphi-label">Label</p><p class="piphi-meta">Meta</p>
    <button class="piphi-control">Control</button><button class="piphi-action">Action</button>
    <button class="piphi-switch" aria-checked="true">Switch</button>
  </body></html>`);
  const { document } = dom.window;
  const style = (selector) => dom.window.getComputedStyle(document.querySelector(selector));

  assert.equal(style(".piphi-title").fontSize, "14px");
  for (const selector of [".piphi-subtitle", ".piphi-label", ".piphi-meta"]) {
    assert.equal(style(selector).fontSize, "12px", `${selector} must stay readable`);
  }
  for (const selector of [".piphi-control", ".piphi-action", ".piphi-switch"]) {
    assert.ok(Number.parseFloat(style(selector).minHeight) >= 44, `${selector} must expose a 44px target`);
  }
  assert.ok(Number.parseFloat(style(".piphi-switch").minWidth) >= 44);
});

test("renders checked switch travel toward the logical end in LTR and RTL", () => {
  const dom = new JSDOM(`<!doctype html><html><head><style>${stylesheet}</style></head><body>
    <div dir="ltr"><button id="ltr" class="piphi-switch" aria-checked="true"></button></div>
    <div dir="rtl"><button id="rtl" class="piphi-switch" aria-checked="true"></button></div>
  </body></html>`);
  const { document } = dom.window;
  const travel = (selector) => dom.window.getComputedStyle(document.querySelector(selector))
    .getPropertyValue("--piphi-switch-checked-translate").trim();
  assert.equal(travel("#ltr"), "18px");
  assert.equal(travel("#rtl"), "-18px");
});

test("ships smart-home readings, controls, switches, actions, progress, and states", () => {
  for (const selector of [
    ".piphi-reading", ".piphi-control", ".piphi-switch", ".piphi-action",
    ".piphi-progress", ".piphi-icon", ".piphi-state", ".piphi-skeleton",
  ]) {
    assert.ok(stylesheet.includes(selector));
  }
  assert.match(stylesheet, /aria-checked="true"/);
  assert.match(stylesheet, /data-state="error"/);
  assert.match(stylesheet, /data-piphi-domain="light"/);
});

test("includes keyboard, responsive, contrast, and motion safeguards", () => {
  assert.match(stylesheet, /:focus-visible/);
  assert.match(stylesheet, /--piphi-widget-focus-ring/);
  assert.match(stylesheet, /@container \(max-width: 30rem\)/);
  assert.match(stylesheet, /prefers-contrast: more/);
  assert.match(stylesheet, /forced-colors: active/);
  assert.match(stylesheet, /prefers-reduced-motion: reduce/);
});
