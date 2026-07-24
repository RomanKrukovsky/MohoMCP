import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { config } from "../config.js";

export interface PlanStep {
  stepNumber: number;
  method: string;
  params: Record<string, unknown>;
  description: string;
  isDestructive: boolean;
}

export interface ExecutionPlan {
  planId: string;
  correlationId: string;
  projectRevision: string;
  previewHash: string;
  expiresAt: number;
  steps: PlanStep[];
  requiresConfirmation: boolean;
  summary: string;
}

export interface TransactionRecord {
  transactionId: string;
  correlationId: string;
  timestamp: number;
  method: string;
  params: Record<string, unknown>;
  status: "PENDING" | "COMMITTED" | "ROLLED_BACK";
}

export class MohoSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MohoSecurityError";
  }
}

export class MohoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MohoValidationError";
  }
}

export class MohoSafetyEngine {
  private readonly allowedMethods: Set<string> = new Set([
    // Document
    "document.getInfo",
    "document.getLayers",
    "document.setFrame",
    "document.screenshot",
    "document_getInfo",
    "document_getLayers",
    "document_setFrame",
    "document_screenshot",
    // Layer
    "layer.getProperties",
    "layer.getChildren",
    "layer.getBones",
    "layer.setTransform",
    "layer.setVisibility",
    "layer.setOpacity",
    "layer.setName",
    "layer.selectLayer",
    "layer_getProperties",
    "layer_getChildren",
    "layer_getBones",
    "layer_setTransform",
    "layer_setVisibility",
    "layer_setOpacity",
    "layer_setName",
    "layer_selectLayer",
    // Bone
    "bone.getProperties",
    "bone.setTransform",
    "bone.selectBone",
    "bone_getProperties",
    "bone_setTransform",
    "bone_selectBone",
    // Animation
    "animation.getKeyframes",
    "animation.getFrameState",
    "animation.setKeyframe",
    "animation.deleteKeyframe",
    "animation.setInterpolation",
    "animation_getKeyframes",
    "animation_getFrameState",
    "animation_setKeyframe",
    "animation_deleteKeyframe",
    "animation_setInterpolation",
    // Mesh
    "mesh.getPoints",
    "mesh.getShapes",
    "mesh_getPoints",
    "mesh_getShapes",
    // Batch
    "batch.execute",
    "batch_execute",
    // Diagnostics & Capabilities
    "system.getCapabilities",
    "system_getCapabilities",
    "system_diagnose",
  ]);

  private readonly destructiveMethods: Set<string> = new Set([
    "animation.deleteKeyframe",
    "animation_deleteKeyframe",
  ]);

  private activePlans: Map<string, ExecutionPlan> = new Map();
  private transactions: Map<string, TransactionRecord> = new Map();

  public validateMethodWhitelist(method: string): void {
    if (!this.allowedMethods.has(method)) {
      throw new MohoSecurityError(
        `Method '${method}' is not in the allowed Moho safety whitelist. Arbitrary code execution is prohibited.`,
      );
    }
  }

  /**
   * Generates a plan with cryptographic previewHash and 60-second TTL.
   */
  public createExecutionPlan(
    correlationId: string,
    projectRevision: string,
    steps: Array<{ method: string; params: Record<string, unknown>; description: string }>,
  ): ExecutionPlan {
    const planSteps: PlanStep[] = steps.map((s, idx) => {
      this.validateMethodWhitelist(s.method);
      const isDestructive = this.destructiveMethods.has(s.method) || Boolean(s.params.confirmRequired);
      return {
        stepNumber: idx + 1,
        method: s.method,
        params: s.params,
        description: s.description,
        isDestructive,
      };
    });

    const requiresConfirmation = planSteps.some((st) => st.isDestructive);
    const planId = `plan_${crypto.randomBytes(4).toString("hex")}`;
    const expiresAt = Date.now() + config.moho.previewTtlMs;

    const hashPayload = JSON.stringify({ planId, correlationId, projectRevision, steps: planSteps, expiresAt });
    const previewHash = crypto.createHash("sha256").update(hashPayload).digest("hex").substring(0, 16);

    const plan: ExecutionPlan = {
      planId,
      correlationId,
      projectRevision,
      previewHash,
      expiresAt,
      steps: planSteps,
      requiresConfirmation,
      summary: `Planned ${planSteps.length} operations. ${
        requiresConfirmation ? "Requires explicit confirmation via previewHash." : "Safe to auto-execute."
      }`,
    };

    this.activePlans.set(previewHash, plan);
    return plan;
  }

  /**
   * Validates previewHash confirmation for destructive operations.
   */
  public validatePreviewConfirmation(
    method: string,
    params: Record<string, unknown>,
    previewHash?: string,
  ): void {
    const isDestructive = this.destructiveMethods.has(method);
    if (!isDestructive) return;

    if (!previewHash) {
      throw new MohoValidationError(
        `Destructive operation '${method}' requires a valid 'previewHash' generated from a prior plan preview. Passing 'confirm: true' alone is prohibited.`,
      );
    }

    const cachedPlan = this.activePlans.get(previewHash);
    if (!cachedPlan) {
      throw new MohoValidationError(
        `Invalid or unknown previewHash '${previewHash}'. Generate a fresh execution plan preview first.`,
      );
    }

    if (Date.now() > cachedPlan.expiresAt) {
      this.activePlans.delete(previewHash);
      throw new MohoValidationError(
        `Expired previewHash '${previewHash}'. Previews are valid for 60 seconds. Generate a fresh plan.`,
      );
    }
  }

  /**
   * Safety validation for nested batch_execute operations.
   */
  public validateBatchSafety(
    operations: Array<{ method: string; params: Record<string, unknown> }>,
    allowedDirs: string[],
  ): void {
    if (operations.length > config.moho.maxBatchSize) {
      throw new MohoValidationError(
        `Batch operation limit exceeded: ${operations.length} ops requested (max allowed: ${config.moho.maxBatchSize}).`,
      );
    }

    for (const op of operations) {
      this.validateMethodWhitelist(op.method);
      if (op.params.outputPath && typeof op.params.outputPath === "string") {
        this.validatePathSandbox(op.params.outputPath, allowedDirs);
      }
    }
  }

  public validatePathSandbox(targetPath: string, allowedDirs: string[]): string {
    const resolvedPath = path.resolve(targetPath);
    const isAllowed = allowedDirs.some((dir) => {
      const resolvedDir = path.resolve(dir);
      return resolvedPath === resolvedDir || resolvedPath.startsWith(resolvedDir + path.sep);
    });

    if (!isAllowed) {
      throw new MohoSecurityError(
        `Access denied: Path '${targetPath}' is outside authorized sandbox directories (${allowedDirs.join(", ")}).`,
      );
    }

    return resolvedPath;
  }
}

export const safetyEngine = new MohoSafetyEngine();
