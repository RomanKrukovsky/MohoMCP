import path from "node:path";
import os from "node:os";

const defaultIpcDir = process.env.MOHO_MCP_IPC_DIR ||
  path.join(os.tmpdir(), "moho-mcp");

export const config = {
  moho: {
    ipcDir: defaultIpcDir,
    pollInterval: 100,      // ms between checking for response files
    requestTimeout: 10000,  // ms before a request times out
    renderTimeout: 30000,   // ms timeout for render/screenshot requests
    batchTimeoutPerOp: 500, // additional ms per operation in a batch
    maxBatchSize: 50,       // maximum number of operations in a single batch
    maxQueueSize: 50,       // maximum pending requests in queue
    maxJsonSizeBytes: 10 * 1024 * 1024, // 10MB maximum JSON payload
    requestTtlMs: 30000,    // 30 second request TTL
    enableUiAutomation: process.env.ENABLE_UI_AUTOMATION === "true",
  },
  server: {
    name: "moho-mcp",
    version: "0.1.0",
    protocolVersion: "1.1.0",
  },
} as const;
