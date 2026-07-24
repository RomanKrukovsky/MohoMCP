# MohoMCP Enterprise System Architecture (`ARCHITECTURE.md`)

This document describes the unified system architecture of the enterprise **MohoMCP** bridge for Moho Pro 14.

---

## 1. System Overview & Dataflow Diagram

```
+-------------------+        Stdio (MCP Protocol)       +------------------------+
|  Claude Desktop / | <===============================> |  MohoMCP Bridge        |
|  Claude Code      |                                   |  (TypeScript Node.js)  |
+-------------------+                                   +------------------------+
                                                                    |
                                                                    | File-Based IPC
                                                                    | (Atomic req_<id>.json.tmp -> req_<id>.json)
                                                                    v
                                                        +------------------------+
                                                        |  Moho Pro 14           |
                                                        |  (Lua Event Loop)      |
                                                        |  DrawMe & IsEnabled    |
                                                        +------------------------+
```

---

## 2. Hardened File-Based IPC Spooling Protocol

1. **Request Dispatch**:
   - The TypeScript bridge validates arguments with Zod and checks method whitelisting via `MohoSafetyEngine`.
   - The request payload is constructed:
     ```json
     {
       "jsonrpc": "2.0",
       "protocolVersion": "1.1.0",
       "id": 42,
       "correlationId": "corr_abc123",
       "method": "layer.setTransform",
       "params": { "layerId": 3, "rotation": 45 },
       "timestamp": 1721850000000
     }
     ```
   - Written to `req_42.json.tmp` and atomically renamed to `req_42.json`.

2. **Lua Event Loop Polling**:
   - `MohoMCP_Server.lua` injects hooks into tool `DrawMe` callbacks and `IsEnabled` callbacks.
   - Throttled `moho:UpdateUI()` calls (~4Hz) trigger viewport repaints, ensuring continuous polling even when the application is idle.

3. **Atomic Response**:
   - The Lua server processes `req_42.json`, unlinks `req_42.json`, and writes `resp_42.json`.
   - The TypeScript bridge reads `resp_42.json`, unlinks it, and returns formatted result to MCP client.

---

## 3. Two-Tiered Control Architecture

- **Tier 1: Safe Deterministic Lua API Control (Default)**:
  - Direct calls to Moho's C++/Lua scripting API (`document`, `layer`, `bone`, `animation`, `mesh`).
  - Completely deterministic, safe, zero risk of UI displacement.

- **Tier 2: UI Automation Control (Opt-In)**:
  - Screenshots (`document_screenshot`) and mouse/keyboard input (`input_mouseClick`, `input_mouseDrag`, `input_sendKeys`).
  - **Disabled by default** (`ENABLE_UI_AUTOMATION=false`).
  - Requires explicit opt-in, window boundary validation, and displays explicit security log warnings.
