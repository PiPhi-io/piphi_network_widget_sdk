#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, watch } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, relative, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { validateWidgetManifest } from "../dist/manifest.js";

const [, , command = "help", ...args] = process.argv;
const cwd = process.cwd();
const slug = (value) => String(value || "my-widget").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-widget";
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

const TEMPLATE_TYPES = new Set(["data", "control", "chart", "camera", "multi-device"]);

function parseCreateArgs(values) {
  const templateIndex = values.indexOf("--template");
  const template = templateIndex >= 0 ? values[templateIndex + 1] : "data";
  if (!TEMPLATE_TYPES.has(template)) throw new Error(`Unknown template '${template}'. Use data, control, chart, camera, or multi-device.`);
  const name = values.filter((_value, index) => templateIndex < 0 || (index !== templateIndex && index !== templateIndex + 1)).join(" ") || "my-widget";
  return { name, template };
}

function templateContract(template) {
  if (template === "control") return { binding_modes: ["read-write"], value_kinds: ["boolean", "command"], permissions: ["host.executeCommand"], allowed_commands: ["set", "toggle"], capability_requirements: ["on_off"] };
  if (template === "chart") return { binding_modes: ["read"], value_kinds: ["numeric"], permissions: [], capability_requirements: ["history"] };
  if (template === "camera") return { binding_modes: ["read"], value_kinds: ["json"], permissions: ["host.camera.read"], capability_requirements: ["camera_snapshot"] };
  if (template === "multi-device") return { binding_modes: ["read-write"], value_kinds: ["numeric", "boolean", "enum", "command"], permissions: ["host.executeCommand"], allowed_commands: ["set", "toggle"], capability_requirements: ["multi_device"] };
  return { binding_modes: ["read"], value_kinds: ["numeric", "text", "boolean", "enum"], permissions: [], capability_requirements: [] };
}

async function createWidget(nameArg, template = "data") {
  const name = slug(nameArg);
  const target = resolve(cwd, name);
  if (existsSync(target)) throw new Error(`Target already exists: ${target}`);
  await mkdir(resolve(target, "src"), { recursive: true });
  await mkdir(resolve(target, "previews"), { recursive: true });
  await mkdir(resolve(target, "test"), { recursive: true });
  const contract = templateContract(template);
  const manifest = {
    id: `com.example.${name.replaceAll("-", ".")}`,
    name: nameArg || "My PiPhi Widget",
    version: "0.1.0",
    entry: "./dist/widget.js",
    binding_modes: contract.binding_modes,
    value_kinds: contract.value_kinds,
    capability_requirements: contract.capability_requirements,
    sdk_compatibility: { minimum: "0.3.0" },
    conformance: { accessibility: "wcag2.2-aa", keyboard: true, themes: ["light", "dark"], directions: ["ltr", "rtl"], states: ["loading", "live", "stale", "offline", "reconnecting", "denied", "error"] },
    settings_schema_version: "1",
    settings: [{ id: "title", type: "text", label: "Title", default: "My widget" }, { id: "fixture", type: template === "multi-device" ? "devices" : "device", label: template === "multi-device" ? "Devices" : "Device", required: true }],
    layout: { min_height: 120, default_height: 180, max_height: 420 },
    previews: { light: "./previews/light.svg", dark: "./previews/dark.svg" },
    translations: {
      en: { "widget.title": "My widget", "widget.waiting": "Waiting for live data" },
      es: { "widget.title": "Mi widget", "widget.waiting": "Esperando datos en vivo" },
      ar: { "widget.title": "أداتي", "widget.waiting": "في انتظار البيانات المباشرة" },
    },
    security: { permissions: contract.permissions, allowed_commands: contract.allowed_commands, sandbox: ["allow-scripts"], csp: { connect_src: [] } },
  };
  await writeFile(resolve(target, "widget.manifest.json"), json(manifest));
  await writeFile(resolve(target, "package.json"), json({
    name, version: "0.1.0", private: true, type: "module",
    scripts: { build: "mkdir -p dist && cp src/widget.js dist/widget.js", dev: "piphi-widget dev", validate: "piphi-widget validate", conformance: "piphi-widget conformance", test: "node --test test/*.test.mjs", pack: "piphi-widget pack" },
    dependencies: { "piphi-network-widget-sdk": "^0.3.0" },
  }));
  await writeFile(resolve(target, "src/widget.js"), referenceWidgetSource(template));
  await writeFile(resolve(target, "test/widget.test.mjs"), referenceTestSource());
  await writeFile(resolve(target, "previews/light.svg"), previewSvg(manifest.name, false));
  await writeFile(resolve(target, "previews/dark.svg"), previewSvg(manifest.name, true));
  await writeFile(resolve(target, ".gitignore"), "node_modules\ndist\n*.tgz\n");
  await writeFile(resolve(target, "README.md"), `# ${manifest.name}\n\n${template} reference widget generated from the public PiPhi Widget SDK.\n\nRun \`npm install\`, \`npm run validate\`, \`npm run conformance\`, then \`npm run dev\`.\n`);
  console.log(`Created ${template} widget at ${target}\nNext: cd ${name} && npm install && npm run dev`);
}

function referenceWidgetSource(template = "data") {
  const action = template === "control" || template === "multi-device"
    ? `\nbutton.addEventListener("click", async () => { button.disabled = true; try { await host.executeCommand({ command: "toggle", value: true }); } finally { button.disabled = false; } });`
    : "";
  const body = template === "chart" ? '<svg role="img" aria-label="Recent readings" viewBox="0 0 200 64"><polyline fill="none" stroke="currentColor" points="0,55 40,35 80,42 120,12 160,26 200,8"/></svg>'
    : template === "camera" ? '<figure><div role="img" aria-label="Camera snapshot fixture">Camera preview</div><figcaption>Local snapshot</figcaption></figure>'
    : '<output aria-live="polite">—</output>';
  const control = template === "control" || template === "multi-device" ? '<button type="button">Toggle</button>' : "";
  return `import { getInjectedPiPhiWidgetHost } from "piphi-network-widget-sdk";\n\nconst host = getInjectedPiPhiWidgetHost();\nconst root = document.querySelector("#piphi-widget-root") || document.body;\nconst context = await host.getContext();\nconst title = await host.translate("widget.title");\nroot.innerHTML = \`<main dir="\${context.localization?.direction || "ltr"}"><strong>\${title}</strong>${body}${control}<p role="status">loading</p></main>\`;\nconst output = root.querySelector("output");\nconst status = root.querySelector('[role="status"]');\nconst button = root.querySelector("button");\nconst stop = await host.subscribeState({}, (event) => {\n  status.textContent = event.status || event.kind;\n  if (event.kind !== "snapshot" && event.kind !== "point") return;\n  const data = event.data?.primaryState ?? event.data?.value ?? event.data;\n  if (output) output.textContent = String(data ?? "—");\n});${action}\nwindow.addEventListener("pagehide", stop, { once: true });\nawait host.ready({ height: 180 });\n`;
}

function referenceTestSource() {
  return `import test from "node:test";\nimport assert from "node:assert/strict";\nimport manifest from "../widget.manifest.json" with { type: "json" };\nimport { validateWidgetManifest } from "piphi-network-widget-sdk/manifest";\n\ntest("manifest is publishable", () => {\n  assert.equal(validateWidgetManifest(manifest).filter((item) => item.severity === "error").length, 0);\n});\n`;
}

function previewSvg(title, dark) {
  const background = dark ? "#0f172a" : "#ffffff";
  const text = dark ? "#f8fafc" : "#0f172a";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" role="img" aria-label="${title} preview"><rect width="100%" height="100%" rx="24" fill="${background}"/><circle cx="72" cy="72" r="24" fill="#2563eb"/><text x="112" y="82" font-family="system-ui" font-size="30" font-weight="700" fill="${text}">${title}</text><text x="48" y="190" font-family="system-ui" font-size="68" font-weight="750" fill="${text}">24.2</text><text x="48" y="242" font-family="system-ui" font-size="22" fill="#64748b">Live value</text></svg>`;
}

async function readManifest(pathArg = "widget.manifest.json") {
  const path = resolve(cwd, pathArg);
  return { path, value: JSON.parse(await readFile(path, "utf8")) };
}

async function validate(pathArg, quiet = false) {
  const { path, value } = await readManifest(pathArg);
  const diagnostics = validateWidgetManifest(value);
  if (!quiet) {
    if (!diagnostics.length) console.log(`✓ ${relative(cwd, path)} is valid`);
    for (const item of diagnostics) console.log(`${item.severity === "error" ? "✗" : "!"} ${item.path} [${item.code}] ${item.message}`);
  }
  if (diagnostics.some((item) => item.severity === "error")) process.exitCode = 1;
  return { path, value, diagnostics };
}

async function walkFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", ".git"].includes(entry.name)) continue;
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await walkFiles(resolve(directory, entry.name), relativePath));
    else files.push(relativePath);
  }
  return files;
}

const PRIVATE_IMPORT_PATTERNS = [
  /(?:from|import\s*\()\s*["'][^"']*(?:PiPhi-Network-Core|frontend-app\/src|src\/features|piphi_network_core)/i,
  /(?:\.\.\/){3,}.*(?:frontend-app|backend|src\/features)/i,
];
const UNSAFE_SOURCE_PATTERNS = [
  { code: "unsafe_eval", pattern: /\beval\s*\(|\bnew\s+Function\s*\(/ },
  { code: "cookie_access", pattern: /document\.cookie/ },
  { code: "host_storage_access", pattern: /\b(?:localStorage|sessionStorage)\b/ },
  { code: "top_navigation", pattern: /\b(?:top|parent)\.location\b/ },
];

async function conformance(pathArg, quiet = false) {
  const result = await validate(pathArg, true);
  const diagnostics = [...result.diagnostics];
  const add = (path, code, message) => diagnostics.push({ path, code, severity: "error", message });
  const assets = [result.value.entry, ...(result.value.styles || []), ...Object.values(result.value.previews || {})].filter(Boolean);
  for (const asset of assets) {
    const target = resolve(cwd, asset);
    if (!target.startsWith(cwd + sep) || !existsSync(target)) add(String(asset), "missing_asset", "Declared package asset does not exist.");
  }
  const files = await walkFiles(cwd);
  for (const file of files.filter((item) => /\.(?:[cm]?[jt]sx?|html)$/.test(item))) {
    const source = await readFile(resolve(cwd, file), "utf8");
    if (PRIVATE_IMPORT_PATTERNS.some((pattern) => pattern.test(source))) add(file, "private_core_import", "Widgets must depend only on the public Widget SDK contract.");
    for (const unsafe of UNSAFE_SOURCE_PATTERNS) if (unsafe.pattern.test(source)) add(file, unsafe.code, "Source uses a host-unsafe browser capability.");
  }
  if (!files.some((item) => /^test\/.*\.test\.mjs$/.test(item))) add("test", "missing_tests", "Provide at least one Node component or contract test.");
  if (!quiet) {
    if (!diagnostics.length) console.log("✓ accessibility, security, compatibility, assets, tests and public imports conform");
    for (const item of diagnostics) console.log(`${item.severity === "error" ? "✗" : "!"} ${item.path} [${item.code}] ${item.message}`);
  }
  if (diagnostics.some((item) => item.severity === "error")) process.exitCode = 1;
  return { ...result, diagnostics };
}

async function pack(pathArg) {
  const result = await conformance(pathArg, false);
  if (result.diagnostics.some((item) => item.severity === "error")) return;
  const entry = resolve(cwd, result.value.entry);
  if (!existsSync(entry)) throw new Error(`Build artifact missing: ${entry}. Run your build first.`);
  result.value.integrity = `sha256-${createHash("sha256").update(await readFile(entry)).digest("base64")}`;
  await writeFile(result.path, json(result.value));
  const child = spawn("npm", ["pack", "--json"], { cwd, stdio: "inherit", shell: false });
  await new Promise((done, reject) => child.once("exit", (code) => code === 0 ? done() : reject(new Error(`npm pack exited ${code}`))));
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml" };

async function dev(portArg = "4179") {
  await validate(undefined, false);
  if (process.exitCode) return;
  const port = Number(portArg) || 4179;
  const simulator = resolve(import.meta.dirname, "../simulator/index.html");
  const clients = new Set();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    if (url.pathname === "/__piphi__/events") {
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      clients.add(response); request.on("close", () => clients.delete(response)); return;
    }
    const requested = url.pathname === "/" || url.pathname === "/__piphi__/simulator" ? simulator : resolve(cwd, `.${decodeURIComponent(url.pathname)}`);
    if (!requested.startsWith(cwd + sep) && requested !== simulator) { response.writeHead(403); response.end("Forbidden"); return; }
    try {
      const info = await stat(requested); if (!info.isFile()) throw new Error("not file");
      response.writeHead(200, { "Content-Type": MIME[extname(requested)] || "application/octet-stream", "Cache-Control": "no-store" });
      response.end(await readFile(requested));
    } catch { response.writeHead(404); response.end("Not found"); }
  });
  const watcher = watch(cwd, { recursive: true }, (_event, filename) => {
    if (!filename || filename.includes("node_modules") || filename.includes(".git")) return;
    for (const client of clients) client.write(`event: reload\ndata: ${JSON.stringify(filename)}\n\n`);
  });
  server.listen(port, "127.0.0.1", () => console.log(`PiPhi widget simulator: http://127.0.0.1:${port}/`));
  const stop = () => { watcher.close(); for (const client of clients) client.end(); server.close(); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
}

function help() { console.log(`piphi-widget <command>\n\n  create <name> [--template data|control|chart|camera|multi-device]\n                      Scaffold a localized public-contract widget\n  validate [manifest] Validate settings, localization, layout and security\n  conformance         Gate compatibility, accessibility, security and public imports\n  dev [port]          Run the local host simulator with hot reload\n  pack [manifest]     Conformance-check, add entry integrity and npm-pack\n  preview [title]     Write light/dark SVG previews\n  doctor              Check the current widget project\n`); }

async function main() {
  if (command === "create") { const parsed = parseCreateArgs(args); return createWidget(parsed.name, parsed.template); }
  if (command === "validate") return validate(args[0]);
  if (command === "conformance") return conformance(args[0]);
  if (command === "dev") return dev(args[0]);
  if (command === "pack") return pack(args[0]);
  if (command === "preview") { await mkdir(resolve(cwd, "previews"), { recursive: true }); await writeFile(resolve(cwd, "previews/light.svg"), previewSvg(args.join(" ") || "PiPhi widget", false)); await writeFile(resolve(cwd, "previews/dark.svg"), previewSvg(args.join(" ") || "PiPhi widget", true)); return console.log("Wrote previews/light.svg and previews/dark.svg"); }
  if (command === "doctor") { const result = await conformance(args[0], false); const entry = resolve(cwd, result.value.entry || ""); console.log(`${existsSync(entry) ? "✓" : "✗"} entry ${relative(cwd, entry)}`); console.log(`${process.version} · ${process.platform} · ${process.arch}`); if (!existsSync(entry)) process.exitCode = 1; return; }
  help();
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
