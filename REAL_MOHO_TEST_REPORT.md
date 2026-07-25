# Real Moho Pro 14 Verification Test Report (`REAL_MOHO_TEST_REPORT.md`)

**Unified System Status**: **Functional Alpha — live IPC and two read-only document operations verified in Moho Pro 14.0 on macOS Apple Silicon. Mutating tools, recovery, Windows, installers and production gates remain NOT TESTED.**
**Stage 0 Live IPC Status**: **PARTIALLY VERIFIED**

---

## Environment & Run Metadata

- **Git Commit SHA**: `87ddabbb610a5970f4cc52369a0aba3e3aac8b14`
- **Moho Software Version**: Moho Pro 14.0 (macOS 15.3, Apple Silicon arm64)
- **Plugin Version**: `moho-mcp-plugin v0.1.0` (`server.lua` / `MohoMCP_Server.lua`)
- **Bridge Server Version**: `moho-mcp v0.1.0`
- **IPC Protocol Version**: `1.1.0`
- **Execution Timestamp**: `2026-07-24T20:51:08.617Z`
- **Correlation ID**: `corr_live_01`
- **Moho GUI Confirmation**: Moho GUI modal popup confirmed: `MohoMCP Server started! IPC directory: /tmp/moho-mcp`. Toolbar selection of `MohoMCP Poller` tool triggered continuous 4Hz background UI loop (`moho:UpdateUI()`).

---

## Stage 0 Live IPC Recovery Verification

This section documents the live verification status of Stage 0 IPC hardening features against current HEAD (`87ddabb`) in real Moho Pro 14.

### Execution Category Summary

- **VERIFIED LIVE IN MOHO**: 2 read-only operations (`document.getInfo`, `document.getLayers`) and plugin installer script (`./install-plugin.sh`).
- **SIMULATED IN NODE.JS**: 82 Vitest unit & adversarial tests in Node.js test harness.
- **NOT EXECUTED**: Live GUI crash recovery, pending request restart, duplicate ID rejection, malformed request quarantine, expired request cleanup, and live `health.json` polling against a restarted Moho GUI instance.

---

## Detailed Test Verification Matrix

### Test 1 — Current HEAD Smoke Test

- **Status**: **VERIFIED LIVE IN MOHO** (Read-Only)
- **Plugin Re-installation**: Verified via `./install-plugin.sh` sync to `~/Library/Application Support/Moho/scripts/menu/MohoMCP/`.
- **Method Executed**: `document.getInfo` & `document.getLayers`
- **Raw Request JSON (`req_1.json`)**:
  ```json
  {
    "jsonrpc": "2.0",
    "protocolVersion": "1.1.0",
    "id": 1,
    "correlationId": "corr_live_01",
    "method": "document.getInfo",
    "params": {},
    "timestamp": 1784926268617
  }
  ```
- **Raw Response JSON (`resp_1.json`)**:
  ```json
  {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
      "name": "Untitled 2.moho",
      "filePath": "",
      "width": 1280,
      "height": 720,
      "fps": 24,
      "startFrame": 0,
      "endFrame": 240,
      "currentFrame": 0,
      "duration": 10,
      "totalLayers": 1,
      "topLevelLayers": 1
    }
  }
  ```
- **Latency**: 5 round-trip measurements (`18ms`, `21ms`, `17ms`, `19ms`, `18ms` — Avg `18.6ms`).

---

### Test 2 — Cursor Persistence (`cursor.json`)

- **Status**: **NOT EXECUTED** (Requires live Moho GUI application restart)
- **Simulated Status**: **SIMULATED IN NODE.JS** (`adversarial_ipc.test.ts` passes)
- **Manual Verification Steps for User**:
  1. Open Moho Pro 14 GUI and start `Scripts > MohoMCP Server`.
  2. Send 3 sequential read-only requests (`document.getInfo`).
  3. Inspect `cursor.json` in IPC directory (`~/Library/Application Support/MohoMCP/ipc/cursor.json`).
  4. Fully quit Moho Pro 14 (`Cmd+Q`).
  5. Restart Moho Pro 14 and start `Scripts > MohoMCP Server`.
  6. Verify `cursor.json` is loaded and `lastProcessedSeq` equals 3.

---

### Test 3 — Pending Request Recovery

- **Status**: **NOT EXECUTED** (Requires live Moho GUI restart with pending file)
- **Simulated Status**: **SIMULATED IN NODE.JS** (`adversarial_ipc.test.ts` passes)
- **Manual Verification Steps for User**:
  1. Write `req_10.json` into IPC directory while Moho server is stopped.
  2. Start Moho Pro 14 GUI and select `Scripts > MohoMCP Server`.
  3. Verify `req_10.json` is processed and `resp_10.json` is generated exactly once.

---

### Test 4 — Duplicate Request Protection

- **Status**: **NOT EXECUTED** (Requires live Moho GUI duplicate request submission)
- **Simulated Status**: **SIMULATED IN NODE.JS** (`adversarial_ipc.test.ts` passes)
- **Manual Verification Steps for User**:
  1. Write `req_5.json` twice with identical sequence ID `5`.
  2. Observe Lua server log or `cursor.json`.
  3. Verify only first request executes and second is ignored or rejected as duplicate.

---

### Test 5 — Malformed Request Isolation (`dead_letter/`)

- **Status**: **NOT EXECUTED** (Requires live Moho GUI handling malformed JSON)
- **Simulated Status**: **SIMULATED IN NODE.JS** (`adversarial_ipc.test.ts` passes)
- **Manual Verification Steps for User**:
  1. Write malformed text `{ invalid json` to `req_99.json` in IPC directory.
  2. Verify Moho Pro 14 GUI remains running without Lua script error popup.
  3. Check `dead_letter/` directory for `*_malformed_json_req_99.json` and sidecar `.meta` file.
  4. Submit valid `document.getInfo` request and verify it succeeds.

---

### Test 6 — Expired Request Cleanup (TTL Expiry)

- **Status**: **NOT EXECUTED** (Requires live Moho GUI processing expired timestamp)
- **Simulated Status**: **SIMULATED IN NODE.JS** (`adversarial_ipc.test.ts` passes)
- **Manual Verification Steps for User**:
  1. Write request `req_88.json` with timestamp older than 30,000ms.
  2. Verify Lua server quarantines file to `dead_letter/` with reason `expired_ttl`.

---

### Test 7 — Health File (`health.json`)

- **Status**: **NOT EXECUTED** (Requires live Moho GUI polling cycle inspection)
- **Simulated Status**: **SIMULATED IN NODE.JS**
- **Manual Verification Steps for User**:
  1. Start `Scripts > MohoMCP Server` in Moho Pro 14.
  2. Inspect `health.json` in IPC directory.
  3. Verify fields: `running: true`, `lastPollTimestamp`, `queueDepth`, `lastProcessedSeq`, `version: "0.1.0"`.
