# Release Readiness Audit & Status (`RELEASE_READINESS.md`)

**Unified System Status**: **Functional Alpha — live IPC and two read-only document operations verified in Moho Pro 14.0 on macOS Apple Silicon. Mutating tools, recovery, Windows, installers and production gates remain NOT TESTED.**

---

## 1. Upstream Base & Architecture

- **Tracked Upstream Commit SHA**: `d592a572d80d0de292b2b9c5866bdd0f058f8fd4` (`Kveto/MohoMCP`)
- **Working Branch**: `integration/mohomcp-enterprise`
- **IPC Protocol**: Non-linear Directory Enumeration & Sequence Cursor Spooling (Zero $O(N)$ linear scanning degradation)
- **Lua Compatibility**: Moho 14 API (`MOHO.LT_*`, `moho:LayerAbsoluteID(lyr)` with index fallback)

---

## 2. Implementation & Security Audit Details

1. **Private User Application IPC Directory**:
   - macOS: `~/Library/Application Support/MohoMCP/ipc`
   - Windows: `%LOCALAPPDATA%\MohoMCP\ipc`
   - Mode `0700`, owner validation, canonical non-symlink / non-junction verification.
   - `os.tmpdir()` is NEVER used as production default.

2. **Poison Request Quarantine & Dead-Letter Storage**:
   - Malformed JSON, oversized payloads (>1MB), and expired requests (>30s TTL) are atomically moved to `dead_letter/` with a `.meta` sidecar file describing quarantine timestamp, reason, and size.
   - Automatic dead-letter pruning maintains max 100 entries.

3. **Atomic Health & Cursor Persistence**:
   - `health.json` is atomically updated via `.tmp` swap on every poll cycle.
   - `cursor.json` persists last processed sequence number across Moho restarts.

4. **Automated Unit & Adversarial Test Harness (SIMULATED)**:
   - Vitest test suite uses TypeScript simulated node.js servers (`simulateMohoServer`) to emulate file-spooling IPC. Factual `server.lua` execution is NOT performed inside Vitest (requires real Moho GUI runtime).

5. **Granular UI Automation Opt-In**:
   - Screenshots: `MOHO_MCP_ENABLE_SCREENSHOTS=false` (Read-Only permission).
   - Mouse/Keyboard: `MOHO_MCP_ENABLE_UI_AUTOMATION=false` (Input Automation permission).
   - Arbitrary code execution (`loadstring`/`dofile`/`os.execute`) strictly prohibited.

---

## 3. System Scope Audit Matrix

| Requirement Area | Implementation Method | Verified Status |
| :--- | :--- | :--- |
| **Upstream Code Core** | `Kveto/MohoMCP` base on `integration/mohomcp-enterprise` | **VERIFIED** |
| **Live Read-Only Verification** | Tested against running Moho Pro 14 GUI on macOS (`document.getInfo`, `document.getLayers`) | **VERIFIED (2 ops)** |
| **Mutating Tools (Write/Edit)** | `bone.setTransform`, `layer.setTransform`, `animation.setKeyframe`, etc. | **NOT TESTED LIVE** |
| **Recovery & Failover** | Crash recovery under live Moho crash | **NOT TESTED LIVE** |
| **Windows Platform** | `%LOCALAPPDATA%`, `install-plugin.bat` on Windows | **NOT TESTED** |
| **Installers & Packaging** | Packaging, installers, CI production release gates | **NOT TESTED** |
| **Simulated Vitest Test Suite** | 82 Vitest tests using simulated Node.js IPC mock | **SIMULATED** |
| **TypeScript Typecheck** | `tsc --noEmit` cross-platform check | **VERIFIED (0 errors)** |
| **Overall System Readiness** | **Functional Alpha — live IPC and two read-only document operations verified in Moho Pro 14.0 on macOS Apple Silicon. Mutating tools, recovery, Windows, installers and production gates remain NOT TESTED.** | **ALPHA** |
