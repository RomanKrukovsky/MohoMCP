import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

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
    // Batch & Workflows
    "batch.execute",
    "batch_execute",
    "workflow_createCharacterRig",
    "workflow_setupSmartBone",
    "workflow_applyLipSync",
    "workflow_duplicateLayerTree",
    "workflow_batchRender",
    // UI Automation (Level 2)
    "input.mouseClick",
    "input.mouseDrag",
    "input.sendKeys",
    "input_mouseClick",
    "input_mouseDrag",
    "input_sendKeys",
    // Diagnostics & Capabilities
    "system.getCapabilities",
    "system_getCapabilities",
    "system_diagnose",
  ]);

  private readonly destructiveMethods: Set<string> = new Set([
    "animation.deleteKeyframe",
    "animation_deleteKeyframe",
    "workflow_batchRender",
  ]);

  private transactions: Map<string, TransactionRecord> = new Map();

  public validateMethodWhitelist(method: string): void {
    if (!this.allowedMethods.has(method)) {
      throw new MohoSecurityError(
        `Method '${method}' is not in the allowed Moho safety whitelist. Arbitrary code execution is prohibited.`,
      );
    }
  }

  public createExecutionPlan(
    correlationId: string,
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

    return {
      planId,
      correlationId,
      steps: planSteps,
      requiresConfirmation,
      summary: `Planned ${planSteps.length} operations. ${
        requiresConfirmation ? "Requires explicit confirmation." : "Safe to auto-execute."
      }`,
    };
  }

  public checkConfirmation(method: string, params: Record<string, unknown>, confirmed?: boolean): void {
    const isDestructive = this.destructiveMethods.has(method);
    if (isDestructive && !confirmed) {
      throw new MohoValidationError(
        `Method '${method}' is a destructive operation. You must pass 'confirm: true' to proceed.`,
      );
    }
  }

  public async beginTransaction(
    correlationId: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<string> {
    const transactionId = `tx_${crypto.randomBytes(4).toString("hex")}`;
    const record: TransactionRecord = {
      transactionId,
      correlationId,
      timestamp: Date.now(),
      method,
      params,
      status: "PENDING",
    };
    this.transactions.set(transactionId, record);
    return transactionId;
  }

  public commitTransaction(transactionId: string): void {
    const tx = this.transactions.get(transactionId);
    if (tx) {
      tx.status = "COMMITTED";
    }
  }

  public rollbackTransaction(transactionId: string): void {
    const tx = this.transactions.get(transactionId);
    if (tx) {
      tx.status = "ROLLED_BACK";
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
        `Access denied: Path '${targetPath}' is outside the authorized sandbox directories.`,
      );
    }

    return resolvedPath;
  }
}

export const safetyEngine = new MohoSafetyEngine();
