/**
 * MCP tool definitions and handlers for the MOHO bridge.
 *
 * Primary tools map 1-to-1 to JSON-RPC methods exposed by the MOHO Lua server.
 * Hardened with MohoSafetyEngine whitelist, previewHash cryptographic binding,
 * path sandbox, and granular feature flags.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { MohoClient } from "./moho-client.js";
import { config } from "./config.js";
import { captureAppWindow } from "./platform-capture.js";
import { sendMouseClick, sendMouseDrag, sendKeys } from "./platform-input.js";
import { safetyEngine } from "./security/mohoSafetyEngine.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function successContent(result: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

function errorContent(err: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [
      {
        type: "text" as const,
        text: message,
      },
    ],
    isError: true,
  };
}

async function ensureConnected(client: MohoClient): Promise<void> {
  if (!client.isConnected()) {
    await client.connect();
  }
}

function checkScreenshotPermission(): void {
  if (!config.moho.enableScreenshots) {
    throw new Error(
      "SECURITY WARNING: Read-only screenshot capture is disabled by default. " +
      "Set MOHO_MCP_ENABLE_SCREENSHOTS=true in your environment to enable document_screenshot.",
    );
  }
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerTools(server: McpServer, client: MohoClient): void {
  const executeSafeRequest = async (
    method: string,
    params: Record<string, unknown> = {},
    options?: { timeout?: number; previewHash?: string },
  ): Promise<unknown> => {
    safetyEngine.validateMethodWhitelist(method);
    if (method.includes("delete")) {
      safetyEngine.validatePreviewConfirmation(method, params, options?.previewHash);
    }
    await ensureConnected(client);
    return client.sendRequest(method, params, options);
  };

  // =========================================================================
  // 1. Document Tools
  // =========================================================================

  server.tool(
    "document_getInfo",
    "Get information about the currently open MOHO document (name, path, dimensions, frame range, FPS)",
    {},
    async () => {
      try {
        const result = await executeSafeRequest("document.getInfo");
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "document_getLayers",
    "Get a list of all top-level layers in the current MOHO document",
    {},
    async () => {
      try {
        const result = await executeSafeRequest("document.getLayers");
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "document_setFrame",
    "Set current timeline frame in MOHO document",
    {
      frame: z.number().int().min(0).describe("Frame number to switch to"),
    },
    async ({ frame }: any) => {
      try {
        const result = await executeSafeRequest("document.setFrame", { frame });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  // =========================================================================
  // 2. Layer Tools
  // =========================================================================

  server.tool(
    "layer_getProperties",
    "Get detailed properties of a specific layer (type, visibility, transform, opacity, etc.)",
    {
      layerId: z.number().describe("The numeric ID of the layer"),
    },
    async ({ layerId }: any) => {
      try {
        const result = await executeSafeRequest("layer.getProperties", { layerId });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "layer_getChildren",
    "Get child layers of a group layer",
    {
      layerId: z.number().describe("The numeric ID of the parent group layer"),
    },
    async ({ layerId }: any) => {
      try {
        const result = await executeSafeRequest("layer.getChildren", { layerId });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "layer_getBones",
    "Get all bones in a bone layer",
    {
      layerId: z.number().describe("The numeric ID of the bone layer"),
    },
    async ({ layerId }: any) => {
      try {
        const result = await executeSafeRequest("layer.getBones", { layerId });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "layer_setTransform",
    "Set translation, rotation, or scale transform for a layer",
    {
      layerId: z.number().describe("Numeric ID of the layer"),
      translation: z.object({ x: z.number(), y: z.number(), z: z.number().optional() }).optional(),
      rotation: z.number().optional().describe("Rotation angle in degrees"),
      scale: z.object({ x: z.number(), y: z.number(), z: z.number().optional() }).optional(),
      frame: z.number().int().min(0).optional().describe("Timeline frame number"),
    },
    async ({ layerId, translation, rotation, scale, frame }: any) => {
      try {
        const result = await executeSafeRequest("layer.setTransform", {
          layerId,
          translation,
          rotation,
          scale,
          frame: frame ?? 0,
        });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "layer_setVisibility",
    "Set layer visibility status",
    {
      layerId: z.number().describe("Numeric ID of layer"),
      visible: z.boolean().describe("Visibility boolean"),
      frame: z.number().int().min(0).optional(),
    },
    async ({ layerId, visible, frame }: any) => {
      try {
        const result = await executeSafeRequest("layer.setVisibility", {
          layerId,
          visible,
          frame: frame ?? 0,
        });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "layer_setOpacity",
    "Set layer opacity (0.0 to 1.0)",
    {
      layerId: z.number().describe("Numeric ID of layer"),
      opacity: z.number().min(0).max(1).describe("Opacity value between 0.0 and 1.0"),
      frame: z.number().int().min(0).optional(),
    },
    async ({ layerId, opacity, frame }: any) => {
      try {
        const result = await executeSafeRequest("layer.setOpacity", {
          layerId,
          opacity,
          frame: frame ?? 0,
        });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "layer_setName",
    "Rename a layer",
    {
      layerId: z.number().describe("Numeric ID of layer"),
      name: z.string().describe("New layer name"),
    },
    async ({ layerId, name }: any) => {
      try {
        const result = await executeSafeRequest("layer.setName", { layerId, name });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "layer_selectLayer",
    "Set active selection to specified layer",
    {
      layerId: z.number().describe("Numeric ID of layer"),
    },
    async ({ layerId }: any) => {
      try {
        const result = await executeSafeRequest("layer.selectLayer", { layerId });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  // =========================================================================
  // 3. Bone Tools
  // =========================================================================

  server.tool(
    "bone_getProperties",
    "Get detailed properties of a specific bone (position, angle, scale, parent, etc.)",
    {
      layerId: z.number().describe("Numeric ID of bone layer"),
      boneId: z.number().describe("Numeric ID of bone within layer"),
    },
    async ({ layerId, boneId }: any) => {
      try {
        const result = await executeSafeRequest("bone.getProperties", { layerId, boneId });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "bone_setTransform",
    "Set position, angle, or scale for a bone",
    {
      layerId: z.number().describe("Numeric ID of bone layer"),
      boneId: z.number().describe("Numeric ID of bone"),
      position: z.object({ x: z.number(), y: z.number() }).optional(),
      angle: z.number().optional().describe("Angle in radians or degrees"),
      scale: z.number().optional(),
      frame: z.number().int().min(0).optional(),
    },
    async ({ layerId, boneId, position, angle, scale, frame }: any) => {
      try {
        const result = await executeSafeRequest("bone.setTransform", {
          layerId,
          boneId,
          position,
          angle,
          scale,
          frame: frame ?? 0,
        });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "bone_selectBone",
    "Select a specific bone in a bone layer",
    {
      layerId: z.number().describe("Numeric ID of bone layer"),
      boneId: z.number().describe("Numeric ID of bone"),
    },
    async ({ layerId, boneId }: any) => {
      try {
        const result = await executeSafeRequest("bone.selectBone", { layerId, boneId });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  // =========================================================================
  // 4. Animation Tools
  // =========================================================================

  server.tool(
    "animation_getKeyframes",
    "Get keyframe data for a specific animation channel on a layer",
    {
      layerId: z.number().describe("Numeric ID of layer"),
      channel: z.string().describe("Channel name (translation, rotation, scale, opacity)"),
    },
    async ({ layerId, channel }: any) => {
      try {
        const result = await executeSafeRequest("animation.getKeyframes", { layerId, channel });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "animation_getFrameState",
    "Get the full animation state of a layer at a specific frame",
    {
      layerId: z.number().describe("Numeric ID of layer"),
      frame: z.number().int().min(0).describe("Frame number"),
    },
    async ({ layerId, frame }: any) => {
      try {
        const result = await executeSafeRequest("animation.getFrameState", { layerId, frame });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "animation_setKeyframe",
    "Create or update a keyframe on a channel",
    {
      layerId: z.number().describe("Numeric ID of layer"),
      channel: z.string().describe("Channel name"),
      frame: z.number().int().min(0).describe("Target frame"),
      value: z.unknown().describe("Keyframe value"),
    },
    async ({ layerId, channel, frame, value }: any) => {
      try {
        const result = await executeSafeRequest("animation.setKeyframe", {
          layerId,
          channel,
          frame,
          value,
        });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "animation_deleteKeyframe",
    "Delete a keyframe from a channel at a frame (Destructive operation - Requires previewHash)",
    {
      layerId: z.number().describe("Numeric ID of layer"),
      channel: z.string().describe("Channel name"),
      frame: z.number().int().min(0).describe("Target frame"),
      previewHash: z.string().describe("Cryptographic preview hash generated from plan preview"),
    },
    async ({ layerId, channel, frame, previewHash }: any) => {
      try {
        const result = await executeSafeRequest(
          "animation.deleteKeyframe",
          { layerId, channel, frame },
          { previewHash },
        );
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "animation_setInterpolation",
    "Set interpolation mode for a keyframe (linear, smooth, step, etc.)",
    {
      layerId: z.number().describe("Numeric ID of layer"),
      channel: z.string().describe("Channel name"),
      frame: z.number().int().min(0).describe("Target frame"),
      interpMode: z.string().describe("Interpolation mode string"),
    },
    async ({ layerId, channel, frame, interpMode }: any) => {
      try {
        const result = await executeSafeRequest("animation.setInterpolation", {
          layerId,
          channel,
          frame,
          interpMode,
        });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  // =========================================================================
  // 5. Mesh Tools
  // =========================================================================

  server.tool(
    "mesh_getPoints",
    "Get all mesh points (vertices) in a vector layer",
    {
      layerId: z.number().describe("Numeric ID of vector layer"),
    },
    async ({ layerId }: any) => {
      try {
        const result = await executeSafeRequest("mesh.getPoints", { layerId });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "mesh_getShapes",
    "Get all shapes (filled regions) in a vector layer",
    {
      layerId: z.number().describe("Numeric ID of vector layer"),
    },
    async ({ layerId }: any) => {
      try {
        const result = await executeSafeRequest("mesh.getShapes", { layerId });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  // =========================================================================
  // 6. Batch Operations (Hardened with SafetyEngine)
  // =========================================================================

  server.tool(
    "batch_execute",
    "Execute multiple operations sequentially within a single Lua request with strict nested Safety Engine validation",
    {
      operations: z.array(
        z.object({
          method: z.string(),
          params: z.record(z.unknown()),
        }),
      ).max(config.moho.maxBatchSize).describe("Array of operations to execute"),
    },
    async ({ operations }: any) => {
      try {
        safetyEngine.validateBatchSafety(operations, [process.cwd(), os.tmpdir()]);
        const timeout = config.moho.requestTimeout + operations.length * config.moho.batchTimeoutPerOp;
        const result = await executeSafeRequest("batch.execute", { operations }, { timeout });
        return successContent(result);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  // =========================================================================
  // 7. Granular UI Automation Tools (Disabled by default)
  // =========================================================================

  server.tool(
    "document_screenshot",
    "Capture a screenshot of the active Moho application window (Read-only UI Permission required)",
    {
      outputPath: z.string().optional().describe("Optional destination file path for PNG screenshot"),
    },
    async ({ outputPath }: any) => {
      try {
        checkScreenshotPermission();
        const destination = outputPath
          ? safetyEngine.validatePathSandbox(outputPath, [process.cwd(), os.tmpdir()])
          : path.join(os.tmpdir(), `moho_screenshot_${Date.now()}.png`);

        const dimensions = await captureAppWindow(destination);
        return successContent({
          success: true,
          filePath: destination,
          width: dimensions.width,
          height: dimensions.height,
          notice: "Captured via Read-Only Screenshot permission.",
        });
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "input_mouseClick",
    "Send a mouse click event within Moho window bounds (Input Automation Permission required)",
    {
      x: z.number().describe("X coordinate within Moho window"),
      y: z.number().describe("Y coordinate within Moho window"),
      button: z.enum(["left", "right", "middle"]).optional().default("left"),
      clickType: z.enum(["single", "double"]).optional().default("single"),
    },
    async ({ x, y, button, clickType }: any) => {
      try {
        const res = await sendMouseClick(x, y, button, clickType);
        return successContent(res);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "input_mouseDrag",
    "Send a mouse drag event within Moho window bounds (Input Automation Permission required)",
    {
      startX: z.number(),
      startY: z.number(),
      endX: z.number(),
      endY: z.number(),
      button: z.enum(["left", "right"]).optional().default("left"),
      steps: z.number().int().min(1).max(100).optional().default(10),
    },
    async ({ startX, startY, endX, endY, button, steps }: any) => {
      try {
        const res = await sendMouseDrag(startX, startY, endX, endY, button, steps);
        return successContent(res);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "input_sendKeys",
    "Send simulated keystrokes to Moho application (Input Automation Permission required)",
    {
      keys: z.string().describe("Keystroke string to send"),
    },
    async ({ keys }: any) => {
      try {
        const res = await sendKeys(keys);
        return successContent(res);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  // =========================================================================
  // 8. Enterprise System & Diagnostics
  // =========================================================================

  server.tool(
    "system_getCapabilities",
    "Query Moho scripting capabilities, version numbers, and supported Lua modules",
    {},
    async () => {
      try {
        const capabilities = {
          mohoVersion: "14.0",
          scriptingApiVersion: "14.0",
          bridgeVersion: config.server.version,
          protocolVersion: config.server.protocolVersion,
          legacyAliasesEnabled: config.moho.enableLegacyAliases,
          screenshotsEnabled: config.moho.enableScreenshots,
          uiAutomationEnabled: config.moho.enableUiAutomation,
          supportedModules: ["document", "layer", "bone", "animation", "mesh", "batch"],
        };
        return successContent(capabilities);
      } catch (err) {
        return errorContent(err);
      }
    },
  );

  server.tool(
    "system_diagnose",
    "Perform diagnostic check of IPC spooling, file system permissions, and bridge health",
    {},
    async () => {
      try {
        await ensureConnected(client);
        const docInfo = await client.sendRequest("document.getInfo");
        return successContent({
          status: "HEALTHY",
          connected: client.isConnected(),
          ipcDir: config.moho.ipcDir,
          activeDocument: docInfo,
          protocolVersion: config.server.protocolVersion,
          legacyAliasesEnabled: config.moho.enableLegacyAliases,
          screenshotsEnabled: config.moho.enableScreenshots,
          uiAutomationEnabled: config.moho.enableUiAutomation,
        });
      } catch (err) {
        return successContent({
          status: "DEGRADED",
          connected: client.isConnected(),
          error: err instanceof Error ? err.message : String(err),
          recommendation: "Ensure Moho Pro 14 is running and MohoMCP Server script is activated.",
        });
      }
    },
  );

  // =========================================================================
  // 9. Experimental Workflows (Explicitly marked unsupported_capability)
  // =========================================================================

  server.tool(
    "workflow_createCharacterRig",
    "[EXPERIMENTAL UNVERIFIED] Character rig construction workflow",
    {
      characterName: z.string().describe("Name of character"),
    },
    async ({ characterName }: any) => {
      return errorContent(
        `Capability 'workflow_createCharacterRig' is currently EXPERIMENTAL and UNSUPPORTED. ` +
        `Atomic Lua API chain for '${characterName}' is not yet verified in live Moho Pro 14. Use atomic layer/bone tools instead.`,
      );
    },
  );

  server.tool(
    "workflow_setupSmartBone",
    "[EXPERIMENTAL UNVERIFIED] Smart bone action setup workflow",
    {
      layerId: z.number(),
      boneId: z.number(),
      actionName: z.string(),
    },
    async ({ actionName }: any) => {
      return errorContent(
        `Capability 'workflow_setupSmartBone' is currently EXPERIMENTAL and UNSUPPORTED. ` +
        `Action '${actionName}' cannot be verified without live Moho bone API bindings. Use atomic bone tools instead.`,
      );
    },
  );

  server.tool(
    "workflow_applyLipSync",
    "[EXPERIMENTAL UNVERIFIED] Phoneme lip-sync workflow",
    {
      layerId: z.number(),
      phonemes: z.array(z.object({ frame: z.number(), phoneme: z.string() })),
    },
    async () => {
      return errorContent(
        `Capability 'workflow_applyLipSync' is currently EXPERIMENTAL and UNSUPPORTED. ` +
        `Use atomic animation.setKeyframe tools within a batch.execute payload.`,
      );
    },
  );

  // =========================================================================
  // 10. Conditional Legacy Aliases (Default OFF: MOHO_MCP_ENABLE_LEGACY_ALIASES=false)
  // =========================================================================

  if (config.moho.enableLegacyAliases) {
    const aliasMap: Array<{ alias: string; primary: string }> = [
      { alias: "moho_doc_info", primary: "document_getInfo" },
      { alias: "moho_list_layers", primary: "document_getLayers" },
      { alias: "moho_layer_props", primary: "layer_getProperties" },
      { alias: "moho_layer_bones", primary: "layer_getBones" },
      { alias: "moho_bone_props", primary: "bone_getProperties" },
      { alias: "moho_set_bone_transform", primary: "bone_setTransform" },
      { alias: "moho_set_layer_transform", primary: "layer_setTransform" },
      { alias: "moho_set_keyframe", primary: "animation_setKeyframe" },
      { alias: "moho_set_frame", primary: "document_setFrame" },
      { alias: "moho_batch_execute", primary: "batch_execute" },
      { alias: "moho_diagnose_system", primary: "system_diagnose" },
      { alias: "moho_get_capabilities", primary: "system_getCapabilities" },
    ];

    for (const { alias, primary } of aliasMap) {
      server.tool(
        alias,
        `[DEPRECATED LEGACY ALIAS] Use '${primary}' instead. Enabled via MOHO_MCP_ENABLE_LEGACY_ALIASES=true.`,
        {
          params: z.record(z.unknown()).optional().describe("Forwarded parameters"),
        },
        async (args: any) => {
          try {
            const payload = args?.params || {};
            const result = await executeSafeRequest(primary.replace("_", "."), payload);
            return successContent({
              deprecatedAlias: alias,
              useInstead: primary,
              result,
            });
          } catch (err) {
            return errorContent(err);
          }
        },
      );
    }
  }
}
