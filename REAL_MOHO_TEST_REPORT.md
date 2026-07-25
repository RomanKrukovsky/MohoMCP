# Real Moho Pro 14 Verification Test Report (`REAL_MOHO_TEST_REPORT.md`)

**Unified System Status**: **Functional Alpha — live IPC and two read-only document operations verified in Moho Pro 14.0 on macOS Apple Silicon. Mutating tools, recovery, Windows, installers and production gates remain NOT TESTED.**

---

## Environment & Run Metadata

- **Git Commit SHA**: `6594f5f5d498cce1fc162f7b3ee6e901470880b8`
- **Moho Software Version**: Moho Pro 14.0 (macOS 15.3, Apple Silicon arm64)
- **Plugin Version**: `moho-mcp-plugin v0.1.0` (`server.lua` / `MohoMCP_Server.lua`)
- **Bridge Server Version**: `moho-mcp v0.1.0`
- **IPC Protocol Version**: `1.1.0`
- **Execution Timestamp**: `2026-07-24T20:51:08.617Z`
- **Correlation ID**: `corr_live_01`
- **Moho GUI Confirmation**: Moho GUI modal popup confirmed: `MohoMCP Server started! IPC directory: /tmp/moho-mcp`. Toolbar selection of `MohoMCP Poller` tool triggered continuous 4Hz background UI loop (`moho:UpdateUI()`).

---

## Live IPC Raw Message Exchange

### Raw Request JSON (`req_1.json`)

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

### Raw Response JSON (`resp_1.json`)

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

---

## Latency Measurements

- **Sample Size**: 5 consecutive round-trip IPC measurements against live Moho Pro 14 GUI
- **Measurements**: `18ms`, `21ms`, `17ms`, `19ms`, `18ms`
- **Average Round-Trip Latency**: **18.6 ms**

---

## Verification Scope Summary

- **Verified Live**: `document.getInfo`, `document.getLayers` (2 read-only operations) on macOS Apple Silicon in Moho Pro 14.0.
- **NOT TESTED**: Mutating tools (`layer.setTransform`, `bone.setTransform`, `animation.setKeyframe`), crash recovery under live kill, Windows platform (`%LOCALAPPDATA%`), packaging, installers, CI release gates.
