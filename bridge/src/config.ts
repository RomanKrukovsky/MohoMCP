import path from "node:path";
import os from "node:os";

function getDefaultIpcDir(): string {
  if (process.env.MOHO_IPC_DIR) {
    return process.env.MOHO_IPC_DIR;
  }
  const platform = os.platform();
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "MohoMCP", "ipc");
  } else if (platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    return path.join(localAppData, "MohoMCP", "ipc");
  } else {
    return path.join(os.homedir(), ".moho_mcp", "ipc");
  }
}

export const config = {
  moho: {
    ipcDir: getDefaultIpcDir(),
    pollInterval: 100,      // ms between checking for response files
    requestTimeout: 10000,  // ms before a request times out
    renderTimeout: 30000,   // ms timeout for render/screenshot requests
    batchTimeoutPerOp: 500, // additional ms per operation in a batch
    maxBatchSize: 50,       // maximum number of operations in a single batch
    maxQueueSize: 50,       // maximum pending requests in queue
    maxJsonSizeBytes: 10 * 1024 * 1024, // 10MB maximum JSON payload
    requestTtlMs: 30000,    // 30 second request TTL
    previewTtlMs: 60000,    // 60 second TTL for previewHash confirmation
    enableLegacyAliases: process.env.MOHO_MCP_ENABLE_LEGACY_ALIASES === "true",
    enableScreenshots: process.env.MOHO_MCP_ENABLE_SCREENSHOTS === "true",
    enableUiAutomation: process.env.MOHO_MCP_ENABLE_UI_AUTOMATION === "true",
  },
  server: {
    name: "moho-mcp",
    version: "0.1.0",
    protocolVersion: "1.1.0",
  },
} as const;
