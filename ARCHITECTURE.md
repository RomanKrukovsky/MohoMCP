# MohoMCP Enterprise System Architecture (`ARCHITECTURE.md`)

This document describes the system architecture of the enterprise **MohoMCP** bridge for Moho Pro 14.

---

## 1. System Overview & Dataflow Diagram

```
+-------------------+        Stdio (MCP Protocol)       +------------------------+
|  Claude Desktop / | <===============================> |  MohoMCP Bridge        |
|  Claude Code      |                                   |  (TypeScript Node.js)  |
+-------------------+                                   +------------------------+
                                                                    |
                                                                    | Private File IPC
                                                                    | (~/Library/Application Support/MohoMCP/ipc)
                                                                    | (Atomic req_<id>.json.tmp -> req_<id>.json)
                                                                    v
                                                        +------------------------+
                                                        |  Moho Pro 14           |
                                                        |  (Lua Event Loop)      |
                                                        |  DrawMe & IsEnabled    |
                                                        +------------------------+
```

---

## 2. Secure File-Based IPC Spooling Protocol

1. **Default IPC Directory**:
   - macOS: `~/Library/Application Support/MohoMCP/ipc`
   - Windows: `%LOCALAPPDATA%\MohoMCP\ipc`
   - Overridden via `MOHO_IPC_DIR`, enforced mode 0700, owner validation, canonical non-symlink/non-junction verification.

2. **Atomic Request & Cryptographic Confirmation**:
   - Destructive operations require a cryptographic `previewHash` generated from a prior plan preview, valid for a 60-second TTL.
   - Request written to `req_<id>.json.tmp` and atomically renamed to `req_<id>.json`.

3. **Lua Event Loop Polling & Keep-Alive Analysis**:
   - Polling is implemented in `moho-plugin/MohoMCP_Server.lua`:
     - Line 175: Injects `DrawMe` hooks into standard Moho tool globals.
     - Line 207: Implements `IsEnabled` callback.
   - **Architectural Fact**: Polling inside Moho relies on viewport repaint events or `moho:UpdateUI()` calls (~4Hz throttle). When the Moho application GUI is completely idle and unfocused, polling frequency decreases. External keep-alive triggers (OS window focus/refresh) wake up the Moho UI thread to maintain request processing.

---

## 3. Two-Tiered Control Architecture & Granular Permissions

- **Tier 1: Safe Deterministic Lua API Control (Default, Enabled)**:
  - Direct calls to Moho's scripting API (`document`, `layer`, `bone`, `animation`, `mesh`).
- **Tier 2: Granular UI Automation (Disabled by default)**:
  - Read-Only Screenshot Permission (`MOHO_MCP_ENABLE_SCREENSHOTS=false` by default).
  - Input Automation Permission (`MOHO_MCP_ENABLE_UI_AUTOMATION=false` by default).
  - Arbitrary shell, PowerShell, AppleScript, or JXA execution from request parameters is strictly prohibited.

---

## 4. Distinct Recovery & Audit Architecture

We strictly distinguish four separate recovery and logging mechanisms:

1. **Moho Native Undo (`document.undo` / `moho:Undo()`)**:
   - Invokes Moho's internal C++ undo stack. Undoes the single last user or script action within the Moho GUI session.

2. **Compensating Operations**:
   - Programmatically generated inverse operations (e.g., re-creating a deleted keyframe with previous value, or resetting layer transform to prior coordinates).

3. **Project File Backup Restoration**:
   - System snapshot `.moho` file copies created prior to heavy composite operations. Restored by opening the backup file.

4. **Audit Transaction Log**:
   - Chronological, append-only record of all dispatched IPC commands, correlation IDs, timestamps, and responses (`MohoSafetyEngine.beginTransaction`). This is an audit trail, **NOT** an automatic Undo mechanism.
