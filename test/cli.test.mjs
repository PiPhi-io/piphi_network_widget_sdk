import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

for (const template of ["data", "control", "chart", "camera", "multi-device"]) test(`CLI scaffolds a localized, conformant ${template} widget`, async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "piphi-widget-sdk-"));
  try {
    const created = spawnSync(process.execPath, [resolve("bin/piphi-widget.mjs"), "create", "Kitchen Climate", "--template", template], { cwd: directory, encoding: "utf8" });
    assert.equal(created.status, 0, created.stderr);
    const project = resolve(directory, "kitchen-climate");
    const manifest = JSON.parse(await readFile(resolve(project, "widget.manifest.json"), "utf8"));
    assert.equal(manifest.id, "com.example.kitchen.climate");
    assert.equal(manifest.translations.ar["widget.title"], "أداتي");
    assert.equal(manifest.conformance.accessibility, "wcag2.2-aa");
    assert.ok(manifest.conformance.states.includes("reconnecting"));
    if (["control", "multi-device"].includes(template)) assert.ok(manifest.security.allowed_commands.includes("toggle"));
    const checked = spawnSync(process.execPath, [resolve("bin/piphi-widget.mjs"), "validate", resolve(project, "widget.manifest.json")], { cwd: project, encoding: "utf8" });
    assert.equal(checked.status, 0, checked.stderr || checked.stdout);
    await import("node:fs/promises").then(({ mkdir, copyFile }) => mkdir(resolve(project, "dist"), { recursive: true }).then(() => copyFile(resolve(project, "src/widget.js"), resolve(project, "dist/widget.js"))));
    const conformance = spawnSync(process.execPath, [resolve("bin/piphi-widget.mjs"), "conformance"], { cwd: project, encoding: "utf8" });
    assert.equal(conformance.status, 0, conformance.stderr || conformance.stdout);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("conformance rejects private Core imports and host-unsafe browser APIs", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "piphi-widget-sdk-unsafe-"));
  try {
    const created = spawnSync(process.execPath, [resolve("bin/piphi-widget.mjs"), "create", "Unsafe Widget"], { cwd: directory, encoding: "utf8" });
    assert.equal(created.status, 0, created.stderr);
    const project = resolve(directory, "unsafe-widget");
    await import("node:fs/promises").then(async ({ mkdir, writeFile }) => {
      await mkdir(resolve(project, "dist"), { recursive: true });
      await writeFile(resolve(project, "dist/widget.js"), 'import x from "../../PiPhi-Network-Core/frontend-app/src/features/private.js"; document.cookie;\n');
    });
    const checked = spawnSync(process.execPath, [resolve("bin/piphi-widget.mjs"), "conformance"], { cwd: project, encoding: "utf8" });
    assert.notEqual(checked.status, 0);
    const output = `${checked.stdout}\n${checked.stderr}`;
    assert.match(output, /private_core_import/);
    assert.match(output, /cookie_access/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
