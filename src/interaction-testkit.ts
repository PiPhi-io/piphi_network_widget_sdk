/** Portable, privacy-safe certification contract for package-owned interactions. */
export const PIPHI_WIDGET_INTERACTION_TESTKIT_SCHEMA_VERSION = "1" as const;

export const PIPHI_WIDGET_INTERACTION_TESTKIT_CASES = [
  "target-activation",
  "permission-denial",
  "missing-capability",
  "command-allow-list-rejection",
  "confirmation-approve",
  "confirmation-cancel",
  "pin-approve",
  "pin-cancel",
  "nested-control-isolation",
  "input-pointer",
  "input-touch",
  "input-keyboard",
  "details-destination",
  "state-loading",
  "state-empty",
  "state-stale",
  "state-error",
  "responsive-compact",
  "responsive-expanded",
  "theme-light",
  "theme-dark",
  "direction-ltr",
  "direction-rtl",
  "reduced-motion",
  "accessible-name-and-focus",
] as const;

export type PiPhiWidgetInteractionTestKitCase = typeof PIPHI_WIDGET_INTERACTION_TESTKIT_CASES[number];

export interface PiPhiWidgetInteractionTestKitResult {
  case_id: PiPhiWidgetInteractionTestKitCase;
  passed: true;
  evidence: string;
}

export interface PiPhiWidgetInteractionTestKitReport {
  schema_version: typeof PIPHI_WIDGET_INTERACTION_TESTKIT_SCHEMA_VERSION;
  package_id: string;
  widget_id: string;
  results: PiPhiWidgetInteractionTestKitResult[];
}

export interface PiPhiWidgetInteractionTestKitDiagnostic {
  path: string;
  code: string;
  severity: "error";
  message: string;
}

const REPORT_KEYS = new Set(["schema_version", "package_id", "widget_id", "results"]);
const RESULT_KEYS = new Set(["case_id", "passed", "evidence"]);
const PACKAGE_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/;
const WIDGET_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const EVIDENCE_REFERENCE = /^(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+(?:#[A-Za-z0-9._:-]+)?$/;
const REQUIRED_CASES = new Set<string>(PIPHI_WIDGET_INTERACTION_TESTKIT_CASES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: Set<string>): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.size && actual.every((key) => keys.has(key));
}

export function validateWidgetInteractionTestKitReport(
  value: unknown,
  expectedIdentity?: { package_id: string; widget_id: string },
): PiPhiWidgetInteractionTestKitDiagnostic[] {
  const diagnostics: PiPhiWidgetInteractionTestKitDiagnostic[] = [];
  const error = (path: string, code: string, message: string) => diagnostics.push({ path, code, severity: "error", message });
  if (!isRecord(value) || !hasExactKeys(value, REPORT_KEYS)) {
    error("$", "invalid_testkit_report_schema", "The report must contain only schema_version, package_id, widget_id, and results.");
    return diagnostics;
  }
  if (value.schema_version !== PIPHI_WIDGET_INTERACTION_TESTKIT_SCHEMA_VERSION) error("schema_version", "invalid_testkit_schema_version", "Use Widget interaction TestKit schema version 1.");
  const packageId = typeof value.package_id === "string" ? value.package_id : "";
  const widgetId = typeof value.widget_id === "string" ? value.widget_id : "";
  if (!PACKAGE_ID.test(packageId) || packageId.length > 120) error("package_id", "invalid_testkit_package_id", "Use a bounded canonical publisher.package identity.");
  if (!WIDGET_ID.test(widgetId) || widgetId.length > 80) error("widget_id", "invalid_testkit_widget_id", "Use a bounded lowercase widget id.");
  if (expectedIdentity && packageId !== expectedIdentity.package_id) error("package_id", "testkit_package_identity_mismatch", "The report package id does not match its signed owner.");
  if (expectedIdentity && widgetId !== expectedIdentity.widget_id) error("widget_id", "testkit_widget_identity_mismatch", "The report widget id does not match its signed owner.");
  if (!Array.isArray(value.results)) {
    error("results", "invalid_testkit_results", "Results must be an array containing every required case exactly once.");
    return diagnostics;
  }
  if (value.results.length !== PIPHI_WIDGET_INTERACTION_TESTKIT_CASES.length) error("results", "invalid_testkit_case_count", `Expected exactly ${PIPHI_WIDGET_INTERACTION_TESTKIT_CASES.length} results.`);
  const seen = new Set<string>();
  value.results.forEach((candidate, index) => {
    const path = `results.${index}`;
    if (!isRecord(candidate) || !hasExactKeys(candidate, RESULT_KEYS)) {
      error(path, "invalid_testkit_result_schema", "Each result must contain only case_id, passed, and evidence.");
      return;
    }
    const caseId = typeof candidate.case_id === "string" ? candidate.case_id : "";
    if (!REQUIRED_CASES.has(caseId)) error(`${path}.case_id`, "unknown_testkit_case", "Use a required Widget interaction TestKit case id.");
    else if (seen.has(caseId)) error(`${path}.case_id`, "duplicate_testkit_case", `Case '${caseId}' is duplicated.`);
    seen.add(caseId);
    if (candidate.passed !== true) error(`${path}.passed`, "failed_testkit_case", `Case '${caseId || index}' must pass before certification.`);
    const evidence = typeof candidate.evidence === "string" ? candidate.evidence : "";
    if (evidence.length > 240 || !EVIDENCE_REFERENCE.test(evidence)) error(`${path}.evidence`, "unsafe_testkit_evidence", "Evidence must be a bounded package-relative reference; URLs, traversal, freeform text, and Core profiles are forbidden.");
  });
  const missing = PIPHI_WIDGET_INTERACTION_TESTKIT_CASES.filter((caseId) => !seen.has(caseId));
  if (missing.length) error("results", "missing_testkit_cases", `Missing required cases: ${missing.join(", ")}.`);
  return diagnostics;
}

export function assertValidWidgetInteractionTestKitReport(
  value: unknown,
  expectedIdentity?: { package_id: string; widget_id: string },
): asserts value is PiPhiWidgetInteractionTestKitReport {
  const diagnostics = validateWidgetInteractionTestKitReport(value, expectedIdentity);
  if (diagnostics.length) throw new Error(diagnostics.map((item) => `${item.path}: ${item.message}`).join("\n"));
}
