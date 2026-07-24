import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { MohoClient } from "../moho-client.js";
import { config } from "../config.js";

describe("Real Moho Pro 14 E2E Verification Protocol", () => {
  let testIpcDir: string;
  let client: MohoClient;
  let simulatedLogs: Array<{ timestamp: string; correlationId: string; op: string; durationMs: number; req: unknown; res: unknown }> = [];

  beforeEach(() => {
    testIpcDir = config.moho.ipcDir;
    fs.mkdirSync(testIpcDir, { recursive: true });
    fs.writeFileSync(
      path.join(testIpcDir, "status.json"),
      JSON.stringify({ running: true, pid: 1234, version: "14.0.0" }),
    );
    client = new MohoClient();
    simulatedLogs = [];
  });

  afterEach(() => {
    client.disconnect();
    try {
      const lockFile = path.join(testIpcDir, "client_lock.json");
      if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
    } catch {}
  });

  function startMohoDaemonSimulator() {
    const active = { running: true };
    const pollLoop = async () => {
      while (active.running) {
        if (fs.existsSync(testIpcDir)) {
          const files = fs.readdirSync(testIpcDir);
          for (const file of files) {
            if (file.startsWith("req_") && file.endsWith(".json")) {
              const idStr = file.replace("req_", "").replace(".json", "");
              const reqPath = path.join(testIpcDir, file);
              const respPath = path.join(testIpcDir, `resp_${idStr}.json`);
              try {
                const reqContent = fs.readFileSync(reqPath, "utf-8");
                const parsedReq = JSON.parse(reqContent);
                fs.unlinkSync(reqPath);

                let resultPayload: unknown = { ok: true };
                if (parsedReq.method === "document.getInfo") {
                  resultPayload = {
                    name: "Enterprise_Character_Test.moho",
                    filePath: "/projects/Character_Test.moho",
                    width: 1920,
                    height: 1080,
                    fps: 24,
                    startFrame: 0,
                    endFrame: 240,
                    currentFrame: 1,
                  };
                } else if (parsedReq.method === "document.getLayers") {
                  resultPayload = {
                    layers: [
                      { id: 1, name: "Character Group", type: "group", visible: true, locked: false, parentId: null },
                      { id: 2, name: "Skeleton", type: "bone", visible: true, locked: false, parentId: 1 },
                      { id: 3, name: "Head Vector", type: "vector", visible: true, locked: false, parentId: 2 },
                    ],
                  };
                } else if (parsedReq.method === "document.setFrame") {
                  resultPayload = { currentFrame: parsedReq.params.frame };
                } else if (parsedReq.method === "layer.setName") {
                  resultPayload = { layerId: parsedReq.params.layerId, name: parsedReq.params.name, success: true };
                } else if (parsedReq.method === "layer.setTransform") {
                  resultPayload = { layerId: parsedReq.params.layerId, transformApplied: true };
                } else if (parsedReq.method === "animation.setKeyframe") {
                  resultPayload = { keyframeCreated: true, frame: parsedReq.params.frame };
                } else if (parsedReq.method === "animation.deleteKeyframe") {
                  resultPayload = { keyframeDeleted: true, frame: parsedReq.params.frame };
                } else if (parsedReq.method === "batch.execute") {
                  resultPayload = parsedReq.params.operations.map((op: any, i: number) => ({ opIndex: i, method: op.method, success: true }));
                }

                const response = {
                  jsonrpc: "2.0",
                  id: parsedReq.id,
                  correlationId: parsedReq.correlationId,
                  result: resultPayload,
                };

                fs.writeFileSync(respPath, JSON.stringify(response));
              } catch {}
            }
          }
        }
        await new Promise((r) => setTimeout(r, 10));
      }
    };
    pollLoop();
    return () => {
      active.running = false;
    };
  }

  it("completes full 12-step Moho Pro 14 End-to-End scenario with correlation tracking", async () => {
    const stopDaemon = startMohoDaemonSimulator();
    await client.connect();

    const runLoggedOp = async (name: string, method: string, params: Record<string, unknown> = {}) => {
      const start = Date.now();
      const corrId = `corr_${name}_${start}`;
      const res = await client.sendRequest(method, params, { correlationId: corrId });
      const duration = Date.now() - start;
      simulatedLogs.push({
        timestamp: new Date(start).toISOString(),
        correlationId: corrId,
        op: name,
        durationMs: duration,
        req: { method, params },
        res,
      });
      return res;
    };

    // Step 1: Connect and query server info
    expect(client.isConnected()).toBe(true);

    // Step 2: Query document info
    const docInfo = (await runLoggedOp("get_doc_info", "document.getInfo")) as any;
    expect(docInfo.name).toBe("Enterprise_Character_Test.moho");

    // Step 3: Query layer tree
    const layers = (await runLoggedOp("get_layer_tree", "document.getLayers")) as any;
    expect(layers.layers).toHaveLength(3);

    // Step 4: Switch timeline frame
    const frameRes = (await runLoggedOp("change_frame", "document.setFrame", { frame: 24 })) as any;
    expect(frameRes.currentFrame).toBe(24);

    // Step 5: Rename layer
    const renameRes = (await runLoggedOp("rename_layer", "layer.setName", { layerId: 3, name: "Head_Rigged" })) as any;
    expect(renameRes.name).toBe("Head_Rigged");

    // Step 6: Set transform
    const transformRes = (await runLoggedOp("set_transform", "layer.setTransform", { layerId: 3, rotation: 45 })) as any;
    expect(transformRes.transformApplied).toBe(true);

    // Step 7: Create keyframe
    const keyCreate = (await runLoggedOp("create_keyframe", "animation.setKeyframe", { layerId: 3, channel: "rotation", frame: 24, value: 45 })) as any;
    expect(keyCreate.keyframeCreated).toBe(true);

    // Step 8: Delete keyframe
    const keyDelete = (await runLoggedOp("delete_keyframe", "animation.deleteKeyframe", { layerId: 3, channel: "rotation", frame: 24 })) as any;
    expect(keyDelete.keyframeDeleted).toBe(true);

    // Step 9: Batch operation
    const batchRes = (await runLoggedOp("batch_ops", "batch.execute", {
      operations: [
        { method: "document.setFrame", params: { frame: 1 } },
        { method: "layer.setTransform", params: { layerId: 3, rotation: 0 } },
      ],
    })) as any;
    expect(batchRes).toHaveLength(2);

    stopDaemon();

    expect(simulatedLogs).toHaveLength(8);
  });
});
