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

  it("requires confirmation for destructive methods", () => {
    expect(() => safetyEngine.checkConfirmation("animation.deleteKeyframe", {}, false)).toThrow(MohoValidationError);
    expect(() => safetyEngine.checkConfirmation("animation.deleteKeyframe", {}, true)).not.toThrow();
  });

  it("creates valid execution plans for workflows", () => {
    const plan = safetyEngine.createExecutionPlan("corr_test_1", [
      { method: "document.getInfo", params: {}, description: "Get doc info" },
      { method: "animation.deleteKeyframe", params: { layerId: 1, channel: "translation", frame: 10 }, description: "Delete key" },
    ]);

    expect(plan.steps).toHaveLength(2);
    expect(plan.requiresConfirmation).toBe(true);
    expect(plan.steps[1].isDestructive).toBe(true);
  });

  it("validates path sandboxing correctly", () => {
    const tmpDir = os.tmpdir();
    const validPath = path.join(tmpDir, "test_output.png");
    expect(safetyEngine.validatePathSandbox(validPath, [tmpDir])).toBe(path.resolve(validPath));

    const invalidPath = "/etc/passwd";
    expect(() => safetyEngine.validatePathSandbox(invalidPath, [tmpDir])).toThrow(MohoSecurityError);
  });
});
