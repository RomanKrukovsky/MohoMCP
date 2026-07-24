# Enterprise Security Policy (`SECURITY.md`)

This document defines the security boundaries, path sandboxing policies, and UI automation controls enforced by `MohoSafetyEngine`.

---

## 1. Safety Principles & Threat Controls

1. **No Arbitrary Code Execution**:
   - Shell commands, AppleScript, PowerShell, and JXA scripts passed inside MCP request parameters are strictly prohibited.
   - All OS calls are statically defined within the codebase with parameterized inputs.

2. **Lua Method Whitelisting**:
   - `MohoSafetyEngine` verifies every incoming method against `allowedMethods`. Unwhitelisted methods throw `MohoSecurityError`.

3. **Destructive Operation Confirmations**:
   - Destructive operations (`animation_deleteKeyframe`, `workflow_batchRender`) require `confirm: true`. Unconfirmed requests throw `MohoValidationError`.

4. **Path Sandboxing (`validatePathSandbox`)**:
   - Target file paths for screenshot output, render output, and backups must reside within authorized project roots or OS temporary directories.
   - Symbolic links (`lstat.isSymbolicLink()`) and path traversal attempts (`../`) are blocked.

5. **Level 2 UI Automation Opt-In**:
   - Input simulation and window capture tools are disabled by default (`ENABLE_UI_AUTOMATION=false`).
   - Must never be used as a substitute for available Lua API methods.

---

## 2. Security Resource Endpoint

- Dynamic Resource: `moho://security/policy`
- Provides real-time query of active security bounds, active path sandboxes, and UI automation flags.
