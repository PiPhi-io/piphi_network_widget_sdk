import test from "node:test";
import assert from "node:assert/strict";
import {
  PIPHI_WIDGET_INTERACTION_TESTKIT_CASES,
  validateWidgetInteractionTestKitReport,
} from "../dist/interaction-testkit.js";

const report = {
  schema_version: "1",
  package_id: "com.example.package",
  widget_id: "climate-card",
  results: PIPHI_WIDGET_INTERACTION_TESTKIT_CASES.map((caseId) => ({
    case_id: caseId,
    passed: true,
    evidence: `evidence/${caseId}.json#verified`,
  })),
};

test("accepts the exact portable interaction certification matrix", () => {
  assert.equal(PIPHI_WIDGET_INTERACTION_TESTKIT_CASES.length, 25);
  assert.deepEqual(validateWidgetInteractionTestKitReport(report, {
    package_id: "com.example.package",
    widget_id: "climate-card",
  }), []);
});

test("rejects missing, duplicate, failed, unsafe, and foreign evidence", () => {
  const missing = structuredClone(report);
  missing.results.pop();
  assert.ok(validateWidgetInteractionTestKitReport(missing).some((item) => item.code === "missing_testkit_cases"));

  const duplicate = structuredClone(report);
  duplicate.results[1].case_id = duplicate.results[0].case_id;
  assert.ok(validateWidgetInteractionTestKitReport(duplicate).some((item) => item.code === "duplicate_testkit_case"));

  const failed = structuredClone(report);
  failed.results[0].passed = false;
  assert.ok(validateWidgetInteractionTestKitReport(failed).some((item) => item.code === "failed_testkit_case"));

  for (const evidence of ["core-profile:trusted/interactions", "https://example.test/evidence", "../private/evidence.json", "freeform note"]) {
    const unsafe = structuredClone(report);
    unsafe.results[0].evidence = evidence;
    assert.ok(validateWidgetInteractionTestKitReport(unsafe).some((item) => item.code === "unsafe_testkit_evidence"));
  }

  const mismatch = validateWidgetInteractionTestKitReport(report, {
    package_id: "com.other.package",
    widget_id: "other-widget",
  });
  assert.ok(mismatch.some((item) => item.code === "testkit_package_identity_mismatch"));
  assert.ok(mismatch.some((item) => item.code === "testkit_widget_identity_mismatch"));
});

test("rejects extra report and result properties", () => {
  assert.ok(validateWidgetInteractionTestKitReport({ ...report, notes: "not signed" }).some((item) => item.code === "invalid_testkit_report_schema"));
  const extraResult = structuredClone(report);
  extraResult.results[0].notes = "not signed";
  assert.ok(validateWidgetInteractionTestKitReport(extraResult).some((item) => item.code === "invalid_testkit_result_schema"));
});
