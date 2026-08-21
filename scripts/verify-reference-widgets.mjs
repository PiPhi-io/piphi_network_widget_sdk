import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const cli = resolve(root, "bin/piphi-widget.mjs");
const templates = ["data", "control", "chart", "camera", "multi-device"];
const workspace = await mkdtemp(resolve(tmpdir(), "piphi-reference-widgets-"));

try {
  for (const template of templates) {
    const name = `Reference ${template}`;
    const created = spawnSync(process.execPath, [cli, "create", name, "--template", template], { cwd: workspace, encoding: "utf8" });
    assert.equal(created.status, 0, created.stderr);
    const project = resolve(workspace, `reference-${template}`);
    await mkdir(resolve(project, "dist"), { recursive: true });
    await copyFile(resolve(project, "src/widget.js"), resolve(project, "dist/widget.js"));
    const manifest = JSON.parse(await readFile(resolve(project, "widget.manifest.json"), "utf8"));
    assert.equal(manifest.sdk_compatibility.minimum, "0.3.0");
    const checked = spawnSync(process.execPath, [cli, "conformance"], { cwd: project, encoding: "utf8" });
    assert.equal(checked.status, 0, checked.stderr || checked.stdout);
    console.log(`✓ ${template} reference widget`);
  }
} finally {
  await rm(workspace, { recursive: true, force: true });
}
