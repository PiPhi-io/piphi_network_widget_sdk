import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function versionSatisfiesRange(version, range) {
  const parse = (value) => value.split(".").map((part) => Number.parseInt(part, 10));
  const compare = (left, right) => {
    const leftParts = parse(left);
    const rightParts = parse(right);
    for (let index = 0; index < 3; index += 1) {
      const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
      if (difference !== 0) return Math.sign(difference);
    }
    return 0;
  };
  return range.split(",").every((clause) => {
    const match = clause.trim().match(/^(>=|>|<=|<|=)?\s*(\d+(?:\.\d+){1,2})$/);
    if (!match) throw new Error(`Unsupported SDK version clause: ${clause}`);
    const comparison = compare(version, match[2]);
    return match[1] === ">=" ? comparison >= 0
      : match[1] === ">" ? comparison > 0
      : match[1] === "<=" ? comparison <= 0
      : match[1] === "<" ? comparison < 0
      : comparison === 0;
  });
}

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
  for (const packageName of ["whole-home-energy", "home-health"]) {
    const pilotPackage = JSON.parse(readFileSync(
      new URL(`../pilot-packages/${packageName}/package.source.json`, import.meta.url),
      "utf8",
    ));
    if (!versionSatisfiesRange(packageJson.version, pilotPackage.sdk_version_range)) {
      throw new Error(
        `${packageName} SDK range ${pilotPackage.sdk_version_range} excludes release ${packageJson.version}.`,
      );
    }
  }
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
