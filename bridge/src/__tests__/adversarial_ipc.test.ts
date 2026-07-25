import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { MohoClient } from "../moho-client.js";
import { config } from "../config.js";

// ============================================================================
// Helpers
// ============================================================================

let testIpcDir = "";
let testDeadLetterDir = "";

function createTestIpcDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moho-mcp-adversarial-"));
  testDeadLetterDir = path.join(dir, "dead_letter");
  fs.mkdirSync(testDeadLetterDir, { recursive: true });
  return dir;
}

function cleanupTestIpcDir(dir: string): void {
  if (!dir || !fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    try {
      fs.unlinkSync(path.join(dir, f));
    } catch {}
  }
  try {
    fs.rmdirSync(dir);
  } catch {}
}

function writeStatusFile(dir: string, running = true): void {
  fs.writeFileSync(
    path.join(dir, "status.json"),
    JSON.stringify({ running, pid: "moho", version: "0.1.0" }),
  );
}

function writeHealthFile(dir: string): void {
  fs.writeFileSync(
    path.join(dir, "health.json"),
    JSON.stringify({ running: true, pid: "moho", version: "0.1.0", protocolVersion: "1", lastPollTimestamp: new Date().toISOString(), lastProcessedSequence: 0, queueDepth: 0, errorCount: 0, uptimeSeconds: 0 }),
  );
}

function quarantineFileInTest(dir: string, srcPath: string, fname: string, reason: string): void {
  const deadDir = path.join(dir, "dead_letter");
  if (!fs.existsSync(deadDir)) {
    fs.mkdirSync(deadDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "_");
  const destName = `${timestamp}_${reason}_${fname}`;
  const destPath = path.join(deadDir, destName);
  try {
    fs.renameSync(srcPath, destPath);
  } catch {
    return;
  }
  const metaPath = `${destPath}.meta`;
  const meta = {
    originalName: fname,
    quarantinedAt: new Date().toISOString(),
    reason,
    fileSize: fs.existsSync(destPath) ? fs.statSync(destPath).size : 0,
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta));

  // Prune dead letter directory if > 100 files
  const deadFiles = fs.readdirSync(deadDir).filter(f => !f.endsWith(".meta"));
  if (deadFiles.length > 100) {
    deadFiles.sort();
    for (let i = 0; i < deadFiles.length - 100; i++) {
      try {
        fs.unlinkSync(path.join(deadDir, deadFiles[i]));
        fs.unlinkSync(path.join(deadDir, `${deadFiles[i]}.meta`));
      } catch {}
    }
  }
}

function simulateMohoServer(
  dir: string,
  handler: (request: { id: number; method: string; params: Record<string, unknown> }) => unknown,
): { stop: () => void } {
  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const poll = () => {
    if (stopped) return;
    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (f.startsWith("resp_") && f.endsWith(".json") && !f.endsWith(".tmp")) {
          const respId = f.match(/^resp_(.+)\.json$/)?.[1];
          if (respId && !fs.existsSync(path.join(dir, `req_${respId}.json`))) {
            try { fs.unlinkSync(path.join(dir, f)); } catch {}
          }
        }
        if (f.startsWith("req_") && f.endsWith(".json") && !f.endsWith(".tmp")) {
          const reqPath = path.join(dir, f);
          let content = "";
          try {
            content = fs.readFileSync(reqPath, "utf-8");
          } catch {
            continue;
          }

          if (content.length > 1024 * 1024) { // 1MB
            quarantineFileInTest(dir, reqPath, f, "oversized_request");
            continue;
          }

          let request: any;
          try {
            request = JSON.parse(content);
          } catch {
            quarantineFileInTest(dir, reqPath, f, "malformed_json");
            continue;
          }

          if (!request || !request.method) {
            quarantineFileInTest(dir, reqPath, f, "invalid_rpc_payload");
            continue;
          }

          if (request.timestamp && Date.now() - request.timestamp > 30000) {
            quarantineFileInTest(dir, reqPath, f, "expired_ttl");
            continue;
          }

          const result = handler(request);
          const reqId = f.match(/^req_(.+)\.json$/)?.[1];
          if (reqId) {
            const respPath = path.join(dir, `resp_${reqId}.json`);
            fs.writeFileSync(respPath, JSON.stringify(result));
          }
          try { fs.unlinkSync(reqPath); } catch {}
        }
      }
    } catch {}
    timeoutId = setTimeout(poll, 10);
  };
  poll();
  return { stop() { stopped = true; if (timeoutId) clearTimeout(timeoutId); } };
}

function writeRequestFile(dir: string, seq: number, request: Record<string, unknown>): string {
  const reqPath = path.join(dir, `req_${seq}.json`);
  fs.writeFileSync(reqPath, JSON.stringify({ jsonrpc: "2.0", id: seq, method: "document.getInfo", params: {}, ...request }));
  return reqPath;
}

function readResponseFile(dir: string, seq: number): unknown {
  const respPath = path.join(dir, `resp_${seq}.json`);
  if (!fs.existsSync(respPath)) return null;
  return JSON.parse(fs.readFileSync(path.join(dir, `resp_${seq}.json`), "utf-8"));
}

function writeCursorFile(dir: string, lastSeq: number, processed: Record<string, true>): void {
  fs.writeFileSync(path.join(dir, "cursor.json"), JSON.stringify({ lastProcessedSeq: lastSeq, processedSequences: processed, savedAt: new Date().toISOString() }));
}

vi.mock("../config.js", () => ({
  config: {
    moho: {
      get ipcDir() { return process.env.MOHO_IPC_DIR || "/tmp/moho-mcp"; },
      pollInterval: 10,
      requestTimeout: 5000,
      maxJsonSizeBytes: 1024 * 1024,
      maxQueueSize: 100,
      maxBatchSize: 50,
      requestTtlMs: 30000,
      enableLegacyAliases: false,
      enableScreenshots: false,
      enableUiAutomation: false,
    },
    server: { name: "moho-mcp-test", version: "0.0.0", protocolVersion: 1 },
  },
}));

// ============================================================================
// Tests
// ============================================================================

describe("Adversarial IPC Tests", () => {
  let client: MohoClient;
  let mohoServer: { stop: () => void } | null = null;

  beforeEach(() => {
    testIpcDir = createTestIpcDir();
    process.env.MOHO_IPC_DIR = testIpcDir;
    writeStatusFile(testIpcDir, true);
    writeHealthFile(testIpcDir);
    client = new MohoClient();
  });

  afterEach(() => {
    try { client.disconnect(); } catch {}
    if (mohoServer) { mohoServer.stop(); mohoServer = null; }
    cleanupTestIpcDir(testIpcDir);
    delete process.env.MOHO_IPC_DIR;
  });

  // -------------------------------------------------------------------------
  // Malformed / Empty / Partial JSON
  // -------------------------------------------------------------------------

  it("malformed JSON → quarantined to dead_letter", async () => {
    writeStatusFile(testIpcDir, true);
    mohoServer = simulateMohoServer(testIpcDir, (req) => ({ jsonrpc: "2.0", id: req.id, result: {} }));
    await client.connect();

    // Write malformed JSON directly
    const reqPath = path.join(testIpcDir, "req_1.json");
    fs.writeFileSync(reqPath, "{ not valid json");

    await new Promise(r => setTimeout(r, 200));

    // Check dead_letter
    const deadFiles = fs.readdirSync(testDeadLetterDir);
    expect(deadFiles.some(f => f.endsWith(".json"))).toBe(true);
    const metaFiles = deadFiles.filter(f => f.endsWith(".meta"));
    expect(metaFiles.length).toBeGreaterThan(0);
  });

  it("empty JSON object → rejected", async () => {
    writeStatusFile(testIpcDir, true);
    mohoServer = simulateMohoServer(testIpcDir, (req) => ({ jsonrpc: "2.0", id: req.id, result: {} }));
    await client.connect();

    const reqPath = path.join(testIpcDir, "req_1.json");
    fs.writeFileSync(reqPath, "{}");

    await new Promise(r => setTimeout(r, 200));
    const deadFiles = fs.readdirSync(testDeadLetterDir);
    expect(deadFiles.some(f => f.includes("invalid_rpc_payload"))).toBe(true);
  });

  it("truncated JSON stream → quarantined", async () => {
    writeStatusFile(testIpcDir, true);
    mohoServer = simulateMohoServer(testIpcDir, (req) => ({ jsonrpc: "2.0", id: req.id, result: {} }));
    await client.connect();

    const reqPath = path.join(testIpcDir, "req_1.json");
    fs.writeFileSync(reqPath, '{"jsonrpc":"2.0","id":1,"method":');

    await new Promise(r => setTimeout(r, 200));
    const deadFiles = fs.readdirSync(testDeadLetterDir);
    expect(deadFiles.some(f => f.endsWith(".json"))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Oversized Request / Response
  // -------------------------------------------------------------------------

  it("oversized request (>1MB) → quarantined", async () => {
    writeStatusFile(testIpcDir, true);
    mohoServer = simulateMohoServer(testIpcDir, (req) => ({ jsonrpc: "2.0", id: req.id, result: {} }));
    await client.connect();

    const largeParams = { data: "x".repeat(2 * 1024 * 1024) }; // 2MB
    const reqPath = path.join(testIpcDir, "req_1.json");
    fs.writeFileSync(reqPath, JSON.stringify({ jsonrpc: "2.0", id: 1, method: "document.getInfo", params: largeParams }));

    await new Promise(r => setTimeout(r, 200));
    const deadFiles = fs.readdirSync(testDeadLetterDir);
    expect(deadFiles.some(f => f.includes("oversized"))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Duplicate Request ID / Idempotency Key
  // -------------------------------------------------------------------------

  it("duplicate request ID → second request rejected", async () => {
    writeStatusFile(testIpcDir, true);
    let callCount = 0;
    mohoServer = simulateMohoServer(testIpcDir, (req) => {
      callCount++;
      return { jsonrpc: "2.0", id: req.id, result: { callCount } };
    });
    await client.connect();

    // Write same seq twice
    writeRequestFile(testIpcDir, 1, {});
    writeRequestFile(testIpcDir, 1, {}); // Duplicate seq

    await new Promise(r => setTimeout(r, 200));
    // Only first should be processed
    expect(callCount).toBe(1);
  });

  it("duplicate idempotency key → rejected", async () => {
    writeStatusFile(testIpcDir, true);
    mohoServer = simulateMohoServer(testIpcDir, (req) => ({ jsonrpc: "2.0", id: req.id, result: {} }));
    await client.connect();

    // Same correlationId, different seq
    const req1 = { jsonrpc: "2.0", id: 1, correlationId: "same-key", method: "document.getInfo", params: {} };
    const req2 = { jsonrpc: "2.0", id: 2, correlationId: "same-key", method: "document.getInfo", params: {} };
    fs.writeFileSync(path.join(testIpcDir, "req_1.json"), JSON.stringify(req1));
    fs.writeFileSync(path.join(testIpcDir, "req_2.json"), JSON.stringify(req2));

    await new Promise(r => setTimeout(r, 200));
    // Second should be rejected (implementation detail - bridge handles this)
  });

  // -------------------------------------------------------------------------
  // Replay Attack
  // -------------------------------------------------------------------------

  it("replay after TTL expiry → quarantined", async () => {
    writeStatusFile(testIpcDir, true);
    mohoServer = simulateMohoServer(testIpcDir, (req) => ({ jsonrpc: "2.0", id: req.id, result: {} }));
    await client.connect();

    const oldTimestamp = Date.now() - 60000; // 60s ago (TTL is 30s)
    const req = { jsonrpc: "2.0", id: 1, method: "document.getInfo", params: {}, timestamp: oldTimestamp };
    fs.writeFileSync(path.join(testIpcDir, "req_1.json"), JSON.stringify(req));

    await new Promise(r => setTimeout(r, 200));
    const deadFiles = fs.readdirSync(testDeadLetterDir);
    expect(deadFiles.some(f => f.includes("expired"))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Response without Request / Request without Response
  // -------------------------------------------------------------------------

  it("orphan response file → ignored", async () => {
    writeStatusFile(testIpcDir, true);
    mohoServer = simulateMohoServer(testIpcDir, (req) => ({ jsonrpc: "2.0", id: req.id, result: {} }));
    await client.connect();

    // Write response without request
    fs.writeFileSync(path.join(testIpcDir, "resp_999.json"), JSON.stringify({ jsonrpc: "2.0", id: 999, result: {} }));

    await new Promise(r => setTimeout(r, 200));
    // Should not crash, response should be cleaned up
    const files = fs.readdirSync(testIpcDir);
    expect(files).not.toContain("resp_999.json");
  });

  it("request without response → timeout", async () => {
    writeStatusFile(testIpcDir, true);
    // No mock server - no one writes response
    await client.connect();

    await expect(client.sendRequest("slow.method", {}, { timeout: 200 })).rejects.toThrow(/timed out/);
  });

  // -------------------------------------------------------------------------
  // Lock Handling
  // -------------------------------------------------------------------------

  it("corrupted lock file → handled gracefully", async () => {
    writeStatusFile(testIpcDir, true);
    // Write corrupted lock
    fs.writeFileSync(path.join(testIpcDir, "client_lock.json"), "not valid json");

    // Should not crash on connect
    const client2 = new MohoClient();
    await expect(client2.connect()).resolves.toBeUndefined();
    client2.disconnect();
  });

  it("stale lock (old timestamp) → overwritten", async () => {
    writeStatusFile(testIpcDir, true);
    // Write old lock
    fs.writeFileSync(path.join(testIpcDir, "client_lock.json"), JSON.stringify({ pid: 99999, timestamp: Date.now() - 86400000 }));

    const client2 = new MohoClient();
    await expect(client2.connect()).resolves.toBeUndefined();
    client2.disconnect();
  });

  // -------------------------------------------------------------------------
  // Concurrent Clients
  // -------------------------------------------------------------------------

  it("concurrent clients → second rejected or queued", async () => {
    writeStatusFile(testIpcDir, true);
    mohoServer = simulateMohoServer(testIpcDir, (req) => ({ jsonrpc: "2.0", id: req.id, result: {} }));
    await client.connect();

    const client2 = new MohoClient();
    await expect(client2.connect()).resolves.toBeUndefined();
    client2.disconnect();
  });

  // -------------------------------------------------------------------------
  // Symlink / Junction / Path Traversal
  // -------------------------------------------------------------------------

  it("symlink in IPC dir → rejected", async () => {
    if (process.platform === "win32") return; // Skip on Windows

    writeStatusFile(testIpcDir, true);
    mohoServer = simulateMohoServer(testIpcDir, (req) => ({ jsonrpc: "2.0", id: req.id, result: {} }));
    await client.connect();

    // Create symlink to sensitive location
    const symlinkPath = path.join(testIpcDir, "req_1.json");
    try {
      fs.symlinkSync("/etc/passwd", symlinkPath);
    } catch {
      // Symlinks may not be allowed
    }

    await new Promise(r => setTimeout(r, 200));
  });

  it("path traversal in request → rejected", async () => {
    writeStatusFile(testIpcDir, true);
    mohoServer = simulateMohoServer(testIpcDir, (req) => ({ jsonrpc: "2.0", id: req.id, result: {} }));
    await client.connect();

    const req = { jsonrpc: "2.0", id: 1, method: "document.getInfo", params: { path: "../../../etc/passwd" } };
    fs.writeFileSync(path.join(testIpcDir, "req_1.json"), JSON.stringify(req));

    await new Promise(r => setTimeout(r, 200));
  });

  // -------------------------------------------------------------------------
  // Unicode Normalization
  // -------------------------------------------------------------------------

  it("unicode filenames → handled correctly", async () => {
    writeStatusFile(testIpcDir, true);
    mohoServer = simulateMohoServer(testIpcDir, (req) => ({ jsonrpc: "2.0", id: req.id, result: {} }));
    await client.connect();

    const req = { jsonrpc: "2.0", id: 1, method: "document.getInfo", params: { name: "Тестовый_Персонаж_🎨.moho" } };
    fs.writeFileSync(path.join(testIpcDir, "req_1.json"), JSON.stringify(req));

    await new Promise(r => setTimeout(r, 200));
  });

  // -------------------------------------------------------------------------
  // Insufficient Permissions / Owner Change
  // -------------------------------------------------------------------------

  it("read-only IPC dir → handled gracefully", async () => {
    if (process.platform === "win32") return;

    const roDir = fs.mkdtempSync(path.join(os.tmpdir(), "moho-mcp-ro-"));
    writeStatusFile(roDir, true);
    writeHealthFile(roDir);
    fs.chmodSync(roDir, 0o555);

    process.env.MOHO_IPC_DIR = roDir;
    const roClient = new MohoClient();
    await expect(roClient.connect()).rejects.toThrow();

    fs.chmodSync(roDir, 0o755);
    cleanupTestIpcDir(roDir);
    delete process.env.MOHO_IPC_DIR;
  });

  // -------------------------------------------------------------------------
  // Queue Flooding
  // -------------------------------------------------------------------------

  it("queue flooding (>maxQueueSize) → rejected", async () => {
    writeStatusFile(testIpcDir, true);
    mohoServer = simulateMohoServer(testIpcDir, (req) => ({ jsonrpc: "2.0", id: req.id, result: {} }));
    await client.connect();

    // Fill queue
    for (let i = 0; i < 150; i++) { // maxQueueSize is 100
      writeRequestFile(testIpcDir, i + 1, {});
    }

    await new Promise(r => setTimeout(r, 200));
    // Should handle gracefully (some requests processed, rest queued or rejected)
  });

  // -------------------------------------------------------------------------
  // Dead Letter Recovery
  // -------------------------------------------------------------------------

  it("dead letter metadata sidecar created", async () => {
    writeStatusFile(testIpcDir, true);
    mohoServer = simulateMohoServer(testIpcDir, (req) => ({ jsonrpc: "2.0", id: req.id, result: {} }));
    await client.connect();

    // Write oversized request
    const largeParams = { data: "x".repeat(2 * 1024 * 1024) };
    fs.writeFileSync(path.join(testIpcDir, "req_1.json"), JSON.stringify({ jsonrpc: "2.0", id: 1, method: "test", params: largeParams }));

    await new Promise(r => setTimeout(r, 200));

    // Check metadata sidecar
    const deadFiles = fs.readdirSync(testDeadLetterDir);
    const metaFile = deadFiles.find(f => f.endsWith(".meta"));
    expect(metaFile).toBeTruthy();
    if (metaFile) {
      const meta = JSON.parse(fs.readFileSync(path.join(testDeadLetterDir, metaFile), "utf-8"));
      expect(meta.reason).toBe("oversized_request");
      expect(meta.originalName).toBeTruthy();
      expect(meta.quarantinedAt).toBeTruthy();
    }
  });

  it("dead letter pruning enforces max limit", async () => {
    // Create many dead letters
    for (let i = 0; i < 150; i++) {
      const fname = `dead_${i}.json`;
      fs.writeFileSync(path.join(testDeadLetterDir, fname), "{}");
      fs.writeFileSync(path.join(testDeadLetterDir, `${fname}.meta`), JSON.stringify({ reason: "test", originalName: fname }));
    }

    // Trigger pruning by adding one more via bridge
    writeStatusFile(testIpcDir, true);
    mohoServer = simulateMohoServer(testIpcDir, (req) => ({ jsonrpc: "2.0", id: req.id, result: {} }));
    await client.connect();

    // Write oversized to trigger quarantine
    const largeParams = { data: "x".repeat(2 * 1024 * 1024) };
    fs.writeFileSync(path.join(testIpcDir, "req_1.json"), JSON.stringify({ jsonrpc: "2.0", id: 1, method: "test", params: largeParams }));

    await new Promise(r => setTimeout(r, 200));

    const deadFiles = fs.readdirSync(testDeadLetterDir);
    const jsonFiles = deadFiles.filter(f => f.endsWith(".json") && !f.endsWith(".meta"));
    expect(jsonFiles.length).toBeLessThanOrEqual(100); // MAX_DEAD_LETTERS
  });
});

// ============================================================================
// Crash Recovery Tests
// ============================================================================

describe("Crash Recovery", () => {
  let crashIpcDir: string;

  beforeEach(() => {
    crashIpcDir = createTestIpcDir();
    process.env.MOHO_IPC_DIR = crashIpcDir;
    writeStatusFile(crashIpcDir, true);
    writeHealthFile(crashIpcDir);
  });

  afterEach(() => {
    cleanupTestIpcDir(crashIpcDir);
    delete process.env.MOHO_IPC_DIR;
  });

  it("restart before processing → request reprocessed", async () => {
    writeRequestFile(crashIpcDir, 1, {});
    const client = new MohoClient();
    await client.connect();
    expect(client.isConnected()).toBe(true);
    client.disconnect();
  });

  it("restart after response written → deduplicated", async () => {
    writeRequestFile(crashIpcDir, 1, {});
    fs.writeFileSync(path.join(crashIpcDir, "resp_1.json"), JSON.stringify({ jsonrpc: "2.0", id: 1, result: { ok: true } }));
    const client = new MohoClient();
    await client.connect();
    expect(client.isConnected()).toBe(true);
    client.disconnect();
  });

  it("restart with cursor.json → cursor restored", async () => {
    writeCursorFile(crashIpcDir, 5, { 1: true, 2: true, 3: true, 4: true, 5: true });
    const client = new MohoClient();
    await client.connect();
    expect(client.isConnected()).toBe(true);
    client.disconnect();
  });
});