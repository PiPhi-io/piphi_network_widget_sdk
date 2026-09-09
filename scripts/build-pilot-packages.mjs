import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import process from "node:process";

import { zipSync, strToU8 } from "fflate";

const root = resolve(import.meta.dirname, "..");
const packageNames = process.argv.slice(2).filter((value) => !value.startsWith("--"));
const selected = packageNames.length ? packageNames : ["whole-home-energy", "home-health"];
const check = process.argv.includes("--check");
const outputDirectory = check
  ? await mkdtemp(resolve(tmpdir(), "piphi-widget-pilots-"))
  : resolve(root, "dist-pilots");
const signingContext = Buffer.from("piphi-widget-package-manifest-v1\0");

function signingKey() {
  if (check) return generateKeyPairSync("ed25519");
  const encoded = String(process.env.PIPHI_WIDGET_SIGNING_KEY_PEM_BASE64 || "").trim();
  if (!encoded) throw new Error("PIPHI_WIDGET_SIGNING_KEY_PEM_BASE64 is required");
  return { privateKey: createPrivateKey(Buffer.from(encoded, "base64")) };
}

function normalized(source) {
  const payload = structuredClone(source);
  payload.description ??= null;
  payload.owning_integration_id ??= null;
  payload.requires_integrations ??= [];
  payload.requires_packages ??= [];
  payload.recommended_for_integrations ??= [];
  payload.lifecycle ??= "active";
  for (const requirement of payload.requires_integrations) {
    requirement.version_range ??= null;
    requirement.optional ??= false;
  }
  for (const widget of payload.widgets) {
    widget.description ??= null;
    widget.entry ??= null;
    widget.binding_slots ??= [];
    widget.permissions ??= [];
    widget.settings ??= [];
    widget.settings_schema_version ??= "1";
    widget.settings_migrations ??= [];
    widget.default_column_span ??= 3;
    widget.default_row_span ??= 3;
    for (const slot of widget.binding_slots) {
      slot.required ??= true;
      slot.multiple ??= false;
      slot.binding_modes ??= ["read"];
      slot.value_kinds ??= [];
      slot.capability_requirements ??= [];
      slot.compatible_integration_ids ??= [];
      slot.data_delivery ??= {
        mode: "stream_preferred",
        stale_after_seconds: null,
      };
    }
    if (widget.recipe) {
      widget.recipe.schema_version ??= "1";
      widget.recipe.layout ??= "stack";
      widget.recipe.columns ??= 2;
      for (const item of widget.recipe.items) {
        if (item.type === "metric") {
          item.label ??= null;
          item.format ??= "auto";
          item.show_freshness ??= true;
        } else if (item.type === "status") {
          item.label ??= null;
          item.true_label ??= "On";
          item.false_label ??= "Off";
          item.show_freshness ??= false;
        } else if (item.type === "progress") {
          item.label ??= null;
          item.minimum ??= 0;
          item.maximum ??= 100;
          item.show_value ??= true;
        } else if (item.type === "text") {
          item.text ??= null;
          item.setting_id ??= null;
          item.variant ??= "body";
        }
      }
    }
  }
  return payload;
}

await mkdir(outputDirectory, { recursive: true });
for (const packageName of selected) {
  const sourcePath = resolve(root, "pilot-packages", packageName, "package.source.json");
  const sourceText = await readFile(sourcePath, "utf8");
  const source = normalized(JSON.parse(sourceText));
  const recipe = source.widgets?.[0]?.recipe;
  if (!recipe || recipe.schema_version !== "1") throw new Error(`${packageName} has no v1 recipe`);
  const archive = zipSync(
    { "package.source.json": strToU8(`${JSON.stringify(source, null, 2)}\n`) },
    { level: 9, mtime: new Date("2026-01-01T00:00:00Z") },
  );
  const keys = signingKey();
  const manifest = {
    ...source,
    artifact: {
      digest: `sha256:${createHash("sha256").update(archive).digest("hex")}`,
      size_bytes: archive.byteLength,
      media_type: "application/vnd.piphi.widget-package+zip",
      key_id: "piphi-release-1",
      signature: null,
    },
  };
  // Core signs recursively key-sorted canonical JSON with the signature set to null.
  const canonicalize = (value, fieldName = "") => Array.isArray(value)
    ? `[${value.map((item) => canonicalize(item)).join(",")}]`
    : value && typeof value === "object"
      ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], key)}`).join(",")}}`
      : typeof value === "number" && Number.isInteger(value) && ["minimum", "maximum"].includes(fieldName)
        ? `${value}.0`
      : JSON.stringify(value);
  const signedPayload = Buffer.concat([signingContext, Buffer.from(canonicalize(manifest))]);
  const signature = sign(
    null,
    signedPayload,
    keys.privateKey,
  );
  const publicKey = keys.publicKey || createPublicKey(keys.privateKey);
  if (!verify(null, signedPayload, publicKey, signature)) {
    throw new Error(`${packageName} signature self-check failed`);
  }
  manifest.artifact.signature = signature.toString("base64");
  const version = source.identity.version;
  const archivePath = resolve(outputDirectory, `${packageName}-${version}.zip`);
  const manifestPath = resolve(outputDirectory, `${packageName}-${version}.manifest.json`);
  await writeFile(archivePath, archive);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${basename(archivePath)} ${manifest.artifact.digest}\n`);
}
if (check) await rm(outputDirectory, { recursive: true, force: true });
