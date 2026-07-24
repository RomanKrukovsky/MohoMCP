import { describe, it, expect } from "vitest";
import { safetyEngine, MohoSecurityError, MohoValidationError } from "../security/mohoSafetyEngine.js";
import os from "node:os";
import path from "node:path";

describe("MohoSafetyEngine", () => {
  it("allows whitelisted Lua API methods", () => {
    expect(() => safetyEngine.validateMethodWhitelist("document.getInfo")).not.toThrow();
    expect(() => safetyEngine.validateMethodWhitelist("layer.setTransform")).not.toThrow();
    expect(() => safetyEngine.validateMethodWhitelist("batch.execute")).not.toThrow();
  });

  it("blocks non-whitelisted arbitrary methods", () => {
    expect(() => safetyEngine.validateMethodWhitelist("os.execute")).toThrow(MohoSecurityError);
    expect(() => safetyEngine.validateMethodWhitelist("system.evalCode")).toThrow(MohoSecurityError);
  });

  it("requires cryptographic previewHash for destructive methods", () => {
    expect(() => safetyEngine.validatePreviewConfirmation("animation.deleteKeyframe", {})).toThrow(MohoValidationError);
  });

  it("creates execution plans with 60s TTL and previewHash", () => {
    const plan = safetyEngine.createExecutionPlan("corr_test_1", "rev_100", [
      { method: "document.getInfo", params: {}, description: "Get doc info" },
      { method: "animation.deleteKeyframe", params: { layerId: 1, channel: "translation", frame: 10 }, description: "Delete key" },
    ]);

    expect(plan.steps).toHaveLength(2);
    expect(plan.requiresConfirmation).toBe(true);
    expect(plan.previewHash).toBeDefined();
    expect(plan.expiresAt).toBeGreaterThan(Date.now());

    // Validating with correct previewHash succeeds
    expect(() => safetyEngine.validatePreviewConfirmation("animation.deleteKeyframe", {}, plan.previewHash)).not.toThrow();
  });

  it("validates nested batch_execute safety", () => {
    expect(() =>
      safetyEngine.validateBatchSafety(
        [
          { method: "document.getInfo", params: {} },
          { method: "os.execute", params: {} },
        ],
        [os.tmpdir()],
      ),
    ).toThrow(MohoSecurityError);
  });

  it("validates path sandboxing correctly", () => {
    const tmpDir = os.tmpdir();
    const validPath = path.join(tmpDir, "test_output.png");
    expect(safetyEngine.validatePathSandbox(validPath, [tmpDir])).toBe(path.resolve(validPath));

    const invalidPath = "/etc/passwd";
    expect(() => safetyEngine.validatePathSandbox(invalidPath, [tmpDir])).toThrow(MohoSecurityError);
  });
});
