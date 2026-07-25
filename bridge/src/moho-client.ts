/**
 * File-based IPC client that communicates with the MOHO Lua server.
 *
 * Security & IPC Spooling:
 * - Default IPC directory: Private Application Support / LocalAppData folder
 * - Strict permissions (0700), canonical path verification, symlink & junction rejection
 * - Atomic write (.tmp -> .json)
 * - Request TTL expiration & stale file cleanup
 * - Queue depth bounds (maxQueueSize)
 * - JSON size limits (maxJsonSizeBytes)
 * - Single-consumer client lock
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { config } from "./config.js";
import { parseResponse } from "./protocol.js";
import { startKeepAlive, stopKeepAlive } from "./keep-alive.js";

export class MohoClient {
  private nextId = 1;
  private connected = false;
  private pendingRequests = 0;
  private executedRequestIds = new Set<string>();

  /**
   * Validates directory safety (ensures non-symlink, owner matching).
   */
  private async validateDirectorySafety(dirPath: string): Promise<void> {
    const lstat = await fs.promises.lstat(dirPath);
    if (lstat.isSymbolicLink()) {
      throw new Error(`Security Violation: IPC directory ${dirPath} cannot be a symbolic link.`);
    }

    // Check file owner on Unix platforms
    if (os.platform() !== "win32" && typeof process.getuid === "function") {
      const currentUid = process.getuid();
      if (lstat.uid !== currentUid) {
        throw new Error(`Security Violation: IPC directory ${dirPath} is owned by UID ${lstat.uid}, expected UID ${currentUid}.`);
      }
    }
  }

  /**
   * Detects legacy temp IPC directory and prints security notice if present.
   */
  private async detectLegacyTempDir(): Promise<void> {
    const legacyTempDir = path.join(os.tmpdir(), "moho-mcp");
    try {
      if (fs.existsSync(legacyTempDir) && path.resolve(config.moho.ipcDir) !== path.resolve(legacyTempDir)) {
        process.stderr.write(
          `[moho-mcp] SECURITY NOTICE: Found legacy temporary IPC directory at ${legacyTempDir}. ` +
          `Primary secure IPC directory is set to ${config.moho.ipcDir}.\n`,
        );
      }
    } catch {
      // Ignore detection errors
    }
  }

  /**
   * Cleans up stale request/response files older than request TTL.
   */
  private async cleanupStaleFiles(ipcDir: string): Promise<void> {
    try {
      const files = await fs.promises.readdir(ipcDir);
      const now = Date.now();
      const ttlMs = config.moho.requestTtlMs;

      for (const file of files) {
        if (file.startsWith("req_") || file.startsWith("resp_") || file.endsWith(".tmp")) {
          const filePath = path.join(ipcDir, file);
          try {
            const stat = await fs.promises.stat(filePath);
            if (now - stat.mtimeMs > ttlMs) {
              await fs.promises.unlink(filePath).catch(() => {});
            }
          } catch {
            // File might have been processed/removed concurrently
          }
        }
      }
    } catch {
      // Ignore directory read errors during startup
    }
  }

  public get ipcDir(): string {
    return config.moho.ipcDir;
  }

  /**
   * "Connect" by verifying the IPC directory exists and MOHO's status file
   * indicates the server is running.
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const ipcDir = this.ipcDir;

    await this.detectLegacyTempDir();

    // Ensure the IPC directory exists with private permissions (mode 0700)
    try {
      await fs.promises.mkdir(ipcDir, { recursive: true, mode: 0o700 });
    } catch {
      // Directory may already exist
    }

    await this.validateDirectorySafety(ipcDir);
    await this.cleanupStaleFiles(ipcDir);

    // Check for MOHO's status file
    const statusPath = path.join(ipcDir, "status.json");
    try {
      const content = await fs.promises.readFile(statusPath, "utf-8");
      const status = JSON.parse(content);
      if (!status.running) {
        throw new Error("MOHO MCP server is not running (status.running=false)");
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(
          `MOHO MCP server is not running. No status file found at ${statusPath}. ` +
          "Start the MohoMCP Server from MOHO's Scripts menu first.",
        );
      }
      throw err;
    }

    // Single-consumer client lock file
    const lockPath = path.join(ipcDir, "client_lock.json");
    const lockData = {
      pid: process.pid,
      timestamp: Date.now(),
    };
    await fs.promises.writeFile(lockPath, JSON.stringify(lockData), "utf-8");

    this.connected = true;
    startKeepAlive();
    process.stderr.write(
      `[moho-mcp] Connected to MOHO via secure file IPC at ${ipcDir} (Protocol v${config.server.protocolVersion})\n`,
    );
  }

  /**
   * Disconnect — cleans up lock file and resets state.
   */
  disconnect(): void {
    stopKeepAlive();
    if (this.connected) {
      const lockPath = path.join(this.ipcDir, "client_lock.json");
      fs.promises.unlink(lockPath).catch(() => {});
    }
    this.connected = false;
  }

  /**
   * Returns whether the client is "connected" (IPC dir verified).
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Send a JSON-RPC request to MOHO via file IPC and await the response.
   */
  async sendRequest(
    method: string,
    params: Record<string, unknown> = {},
    options?: { timeout?: number; correlationId?: string },
  ): Promise<unknown> {
    if (!this.connected) {
      throw new Error(
        "Not connected to MOHO. Is the MOHO application running with the MCP plugin loaded?",
      );
    }

    if (this.pendingRequests >= config.moho.maxQueueSize) {
      throw new Error(
        `IPC queue limit exceeded (${this.pendingRequests}/${config.moho.maxQueueSize}). Rejecting request '${method}'.`,
      );
    }

    const id = this.nextId++;
    const correlationId = options?.correlationId || `corr_${crypto.randomBytes(4).toString("hex")}`;
    const uniqueReqKey = `${method}:${correlationId}:${id}`;

    if (this.executedRequestIds.has(uniqueReqKey)) {
      throw new Error(`Duplicate request key rejected: ${uniqueReqKey}`);
    }
    this.executedRequestIds.add(uniqueReqKey);
    if (this.executedRequestIds.size > 1000) {
      const firstItem = this.executedRequestIds.values().next().value;
      if (firstItem) this.executedRequestIds.delete(firstItem);
    }

    const ipcDir = this.ipcDir;
    const { pollInterval, requestTimeout, maxJsonSizeBytes } = config.moho;
    const timeout = options?.timeout ?? requestTimeout;

    const request = {
      jsonrpc: "2.0",
      protocolVersion: config.server.protocolVersion,
      id,
      correlationId,
      method,
      params,
      timestamp: Date.now(),
    };

    const serializedPayload = JSON.stringify(request);
    if (Buffer.byteLength(serializedPayload, "utf-8") > maxJsonSizeBytes) {
      throw new Error(`JSON request payload exceeds maximum limit of ${maxJsonSizeBytes} bytes.`);
    }

    const reqFileName = `req_${id}.json`;
    const respFileName = `resp_${id}.json`;
    const reqPath = path.join(ipcDir, reqFileName);
    const respPath = path.join(ipcDir, respFileName);

    this.pendingRequests++;
    try {
      const tmpPath = reqPath + ".tmp";
      await fs.promises.writeFile(tmpPath, serializedPayload, "utf-8");
      await fs.promises.rename(tmpPath, reqPath);

      const startTime = Date.now();

      while (true) {
        try {
          const content = await fs.promises.readFile(respPath, "utf-8");
          await fs.promises.unlink(respPath).catch(() => {});

          const response = parseResponse(content);

          if (response.error) {
            throw new Error(
              `MOHO error [${response.error.code}]: ${response.error.message}${
                response.error.data
                  ? ` (${JSON.stringify(response.error.data)})`
                  : ""
              }`,
            );
          }

          return response.result;
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            if (Date.now() - startTime > timeout) {
              await fs.promises.unlink(reqPath).catch(() => {});
              throw new Error(
                `Request ${method} (id=${id}, corrId=${correlationId}) timed out after ${timeout}ms. ` +
                "Is the MOHO MCP server running and polling?",
              );
            }
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
            continue;
          }
          throw err;
        }
      }
    } finally {
      this.pendingRequests = Math.max(0, this.pendingRequests - 1);
    }
  }
}
