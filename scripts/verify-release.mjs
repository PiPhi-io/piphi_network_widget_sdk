import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function verifyReleaseTag(tag, version) {
  const normalizedTag = typeof tag === "string" ? tag.trim() : "";
  const normalizedVersion = typeof version === "string" ? version.trim() : "";
  const expectedTag = `v${normalizedVersion}`;

  if (!normalizedVersion) {
    throw new Error("package.json must declare a non-empty version.");
  }
  if (normalizedTag !== expectedTag) {
    throw new Error(
      `Release tag ${JSON.stringify(normalizedTag)} does not match package version ${JSON.stringify(normalizedVersion)}. Expected ${expectedTag}.`,
    );
  }
  return expectedTag;
}

function run() {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const verifiedTag = verifyReleaseTag(process.argv[2], packageJson.version);
  console.log(`Verified ${verifiedTag} for ${packageJson.name}@${packageJson.version}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
