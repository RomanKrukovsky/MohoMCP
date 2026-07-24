# Upstream Comparison Matrix: MohoMCP vs. Legacy Enterprise Bridge

**Target Upstream Project**: [Kveto/MohoMCP](https://github.com/Kveto/MohoMCP.git) (Commit SHA: `d592a572d80d0de292b2b9c5866bdd0f058f8fd4`)  
**Legacy Project Branch**: `legacy/generated-enterprise`  
**Working Branch**: `integration/mohomcp-enterprise`

---

## Executive Summary

A comprehensive line-by-line and architectural comparison was performed between the upstream open-source project `MohoMCP` and the legacy generated enterprise codebase. `MohoMCP` provides a functional, battle-tested Lua integration base for Moho Pro 14 with polling hooks in tool callbacks (`DrawMe` / `IsEnabled`) and standard file IPC. The legacy enterprise project contributed strong safety abstractions (`MohoSafetyEngine`), atomic write spooling, correlation tracing, and transaction logging, but created a second redundant and incompatible Lua bridge layer.

This document establishes the official decision matrix for unifying both implementations.

---

## Component Comparison Matrix

| Component Area | Version in MohoMCP | Version in Legacy Project | Real-World Functional Implementation | Test Coverage & Quality | Missing / Unique Features in Each | Final Selection & Architectural Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. MCP Bootstrap** | `@modelcontextprotocol/sdk` v1.0.1 in `bridge/src/index.ts` | Custom Express / Stdio server setup in `src/mcp/server.ts` | **MohoMCP**: Standard `@modelcontextprotocol/sdk` stdio transport | **MohoMCP**: Validated via vitest & MCP Inspector | Enterprise had diagnostic tools; MohoMCP had standard MCP handlers | **Retain MohoMCP base**: Hardened with strict Zod schemas and enterprise capability handlers. |
| **2. Transport Layer** | Stdio Server Transport via MCP SDK | HTTP / Stdio mixed mode | **MohoMCP**: Native Stdio MCP Server | **MohoMCP**: Complies with official MCP protocol | Enterprise attempted HTTP spooling which adds overhead | **Retain MohoMCP Stdio**: Native integration for Claude Desktop and Claude Code. |
| **3. IPC Client** | File IPC (`req_<id>.json` / `resp_<id>.json`) in `bridge/src/moho-client.ts` | Spool IPC (`cmd_<id>.tmp` -> `json`) in `src/bridge/ipcSpoolClient.ts` | **Both work**, but MohoMCP matches actual Lua server expectations | **Legacy** had better timeout handling; **MohoMCP** is integrated with Lua server | Legacy had atomic rename; MohoMCP lacked TTL & path sandbox | **Merge Implementations**: Use MohoMCP protocol files (`req_<id>.json` / `resp_<id>.json`) with Legacy's `.tmp` atomic write, TTL, lock file, and queue bounds. |
| **4. JSON-RPC Protocol** | JSON-RPC 2.0 (`jsonrpc`, `id`, `method`, `params`, `result`, `error`) | Non-standard envelope (`id`, `method`, `params`, `timestamp`) | **MohoMCP**: True JSON-RPC 2.0 | **MohoMCP**: Fully tested with `moho_mcp.protocol` Lua module | Legacy lacked standard JSON-RPC 2.0 error codes | **Retain MohoMCP JSON-RPC 2.0**: Standardized format; add `protocolVersion: "1.1.0"`. |
| **5. Schemas** | JSON Schema draft-07 in `schema/tools.json` & Zod definitions | Ad-hoc TypeScript types | **MohoMCP**: Formal `schema/tools.json` and TypeScript types | **MohoMCP**: Verified schema definitions | Enterprise had runtime Zod validations for composite tools | **Merge**: Keep `schema/tools.json` as reference & validate all MCP tool parameters with Zod. |
| **6. Lua Server** | Modular `MohoMCP_Server.lua` + `moho_mcp/server.lua` | Monolithic `lua/moho_mcp_bridge.lua` | **MohoMCP**: Functional, modular, safely handles package pathing | **MohoMCP**: Has dedicated Lua unit tests (`moho-plugin/tests`) | Enterprise had monolithic script lacking helper modules | **Retain MohoMCP Lua Server**: Maintain modular structure in `moho-plugin/moho_mcp/`. |
| **7. Polling Mechanism** | Hooks into tool `DrawMe` callbacks + `IsEnabled` + `UpdateUI` throttle (~4Hz) | Static loop requiring active window focus | **MohoMCP**: Continuously polls even during viewport idle | **MohoMCP**: Verified inside real Moho GUI thread | Enterprise loop hung UI thread | **Retain MohoMCP Polling**: Native event-loop friendly polling. |
| **8. Keep-Alive** | System UI refresh trigger (JXA/AppleScript on macOS, PowerShell on Win32) | Simple timestamp ping | **MohoMCP**: Forces Moho UI thread wake-up | **MohoMCP**: Verified on macOS & Windows | Enterprise relied on active polling process | **Retain MohoMCP Keep-Alive**: Add explicit permission prompts, consent check, and Headless fallback mode. |
| **9. Document Tools** | `document.getInfo`, `document.setFrame` in `moho_mcp/tools/document.lua` | `moho_doc_info`, `moho_set_frame` | **MohoMCP**: Fully written with native Lua API calls | **MohoMCP**: Handlers implemented and tested | Enterprise lacked full frame property retrieval | **Retain MohoMCP**: Standardize on `document_getInfo` & `document_setFrame` with legacy aliases. |
| **10. Layer Tools** | `layer.getProperties`, `layer.getChildren`, `layer.getBones`, `layer.setTransform`, `layer.setVisibility`, `layer.setOpacity`, `layer.setName`, `layer.selectLayer` | Partial `moho_list_layers`, `moho_layer_props` | **MohoMCP**: Comprehensive layer manipulation | **MohoMCP**: Full coverage of vector, group, bone layer types | Enterprise layer tools were incomplete | **Retain MohoMCP**: Complete set of 8 layer tools. |
| **11. Bone Tools** | `bone.getProperties`, `bone.setTransform`, `bone.selectBone` | `moho_bone_props`, `moho_set_bone_transform` | **MohoMCP**: Real bone property and constraint reading | **MohoMCP**: Works with Moho bone layers | Enterprise lacked bone selection and child traversal | **Retain MohoMCP**: Standard bone tool handlers. |
| **12. Animation Tools** | `animation.getKeyframes`, `animation.getFrameState`, `animation.setKeyframe`, `animation.deleteKeyframe`, `animation.setInterpolation` | Simple keyframe setter | **MohoMCP**: Support for keyframe channels & interpolations | **MohoMCP**: Handlers for step, linear, smooth interpolations | Enterprise lacked channel listing & interpolation control | **Retain MohoMCP**: Full animation control suite. |
| **13. Mesh Tools** | `mesh.getPoints`, `mesh.getShapes` | None | **MohoMCP**: Inspects mesh point locations and shapes | **MohoMCP**: Native Lua vector mesh reading | Enterprise completely missing mesh inspection | **Retain MohoMCP**: Standard mesh inspection tools. |
| **14. Batch Execution** | `batch.execute` in `moho_mcp/tools/batch.lua` | Serial command execution loop | **MohoMCP**: Runs multiple operations within single Lua evaluation cycle | **MohoMCP**: Decreases IPC roundtrip latency dramatically | Enterprise had serial IPC roundtrips per sub-operation | **Retain MohoMCP Batch**: High-performance batch execution. |
| **15. Screenshots** | `document_screenshot` via OS window capture | None | **MohoMCP**: Captures active Moho window bounds via OS APIs | **MohoMCP**: Platform capture module (`platform-capture.ts`) | Enterprise lacked screen capture | **Retain MohoMCP**: Place under **Level 2 UI Control** (disabled by default, bounded to window). |
| **16. Keyboard/Mouse Input** | `input_mouseClick`, `input_mouseDrag`, `input_sendKeys` | None | **MohoMCP**: Native JXA / Win32 mouse & keyboard simulation | **MohoMCP**: `platform-input.ts`, `darwin-input.ts`, `win32-input.ts` | Enterprise lacked OS UI automation | **Retain MohoMCP**: Place under **Level 2 UI Control** (disabled by default, requires consent). |
| **17. Installers** | `install-plugin.sh`, `install-plugin.bat` | Ad-hoc bash script | **MohoMCP**: Autodetects Moho custom script directories across macOS & Windows | **MohoMCP**: Verified directory resolution | Enterprise hardcoded paths | **Retain MohoMCP Installers**: Add permission notices for UI automation tools. |
| **18. Tests** | Vitest unit tests in `bridge/` & Lua tests in `moho-plugin/tests/` | Mock typescript tests | **MohoMCP**: Real Lua validator/protocol unit tests + bridge tests | **MohoMCP**: Higher overall quality | Enterprise lacked Lua test suite | **Enhance MohoMCP Suite**: Add contract tests, IPC atomic safety tests, and E2E simulation. |
| **19. Security** | Basic path check | `MohoSafetyEngine` (sandbox, dry-run, whitelist, transaction log, confirmation) | **Legacy**: Highly robust safety engine | **Legacy**: Verified safety engine tests | MohoMCP lacked path sandboxing & destructive confirmation | **Port Enterprise Safety Engine**: Wrap MohoMCP tool execution in `MohoSafetyEngine`. |
| **20. Documentation** | `README.md`, `installation.md`, `tool-reference.md`, `vision-and-strategy.md` | Single Markdown file | **MohoMCP**: Well structured user documentation | **MohoMCP**: Accurate tool schemas | Enterprise documentation was minimal | **Expand Documentation**: Add `UPSTREAM.md`, `THIRD_PARTY_NOTICES.md`, `MIGRATION.md`, `ARCHITECTURE.md`, `SECURITY.md`, `CAPABILITY_MATRIX.md`, `REAL_MOHO_TEST_REPORT.md`, `RELEASE_READINESS.md`. |

---

## Action Plan & Architecture Summary

1. **Base**: Keep MohoMCP repo structure (`bridge/`, `moho-plugin/`, `schema/`).
2. **IPC**: Upgrade MohoMCP `moho-client.ts` with atomic temporary writes (`.tmp` -> `.json`), lock file check, TTL expiry, queue limits, and path traversal defense.
3. **Security**: Port `MohoSafetyEngine` to `bridge/src/security/mohoSafetyEngine.ts`.
4. **Tools**: Expose all 26 MohoMCP canonical tools + composite workflow tools + capability/diagnostic tools. Expose deprecated legacy tool aliases pointing to primary handlers.
5. **UI Automation**: Classify screenshots and input tools as Level 2 (disabled by default via `ENABLE_UI_AUTOMATION=false`).
6. **Licensing**: Maintain MIT license, create `THIRD_PARTY_NOTICES.md` with upstream SHA `d592a572d80d0de292b2b9c5866bdd0f058f8fd4`.
