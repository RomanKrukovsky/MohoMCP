# Tool Migration & Compatibility Guide (`MIGRATION.md`)

This document provides mapping for migrating legacy enterprise tool names to the canonical **MohoMCP** standard tool naming convention, protocol version `1.1.0` changes, and backward compatibility aliases.

---

## 1. Tool Migration Table

| Legacy Enterprise Tool Name | Canonical MohoMCP Tool Name | Protocol Version | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `moho_doc_info` | `document_getInfo` | `1.1.0` | Deprecated Alias Active | Queries open document dimensions, FPS, frame range. |
| `moho_list_layers` | `document_getLayers` | `1.1.0` | Deprecated Alias Active | Returns hierarchical layer tree. |
| `moho_layer_props` | `layer_getProperties` | `1.1.0` | Deprecated Alias Active | Returns detailed layer parameters. |
| `moho_layer_bones` | `layer_getBones` | `1.1.0` | Deprecated Alias Active | Returns bones inside a bone layer. |
| `moho_bone_props` | `bone_getProperties` | `1.1.0` | Deprecated Alias Active | Returns position, angle, scale, and parent bone ID. |
| `moho_set_bone_transform` | `bone_setTransform` | `1.1.0` | Deprecated Alias Active | Modifies bone position, rotation, and scale. |
| `moho_set_layer_transform` | `layer_setTransform` | `1.1.0` | Deprecated Alias Active | Modifies layer position, rotation, and scale. |
| `moho_set_keyframe` | `animation_setKeyframe` | `1.1.0` | Deprecated Alias Active | Sets animation keyframe at specific frame. |
| `moho_set_frame` | `document_setFrame` | `1.1.0` | Deprecated Alias Active | Changes active timeline frame. |
| `moho_batch_execute` | `batch_execute` | `1.1.0` | Deprecated Alias Active | Executes array of atomic Lua operations in 1 IPC cycle. |
| `moho_duplicate_layer_tree` | `workflow_duplicateLayerTree` | `1.1.0` | Deprecated Alias Active | Analyzes and duplicates layer subtrees. |
| `moho_batch_render` | `workflow_batchRender` | `1.1.0` | Deprecated Alias Active | Queues render range (requires `confirm: true`). |
| `moho_create_character_rig` | `workflow_createCharacterRig` | `1.1.0` | Deprecated Alias Active | Generates structured execution plan for character rig. |
| `moho_setup_smart_bone` | `workflow_setupSmartBone` | `1.1.0` | Deprecated Alias Active | Sets up smart bone action keyframes. |
| `moho_apply_lipsync` | `workflow_applyLipSync` | `1.1.0` | Deprecated Alias Active | Applies phoneme timings to switch layer. |
| `moho_diagnose_system` | `system_diagnose` | `1.1.0` | Deprecated Alias Active | Runs IPC and system health check. |
| `moho_get_capabilities` | `system_getCapabilities` | `1.1.0` | Deprecated Alias Active | Returns supported Moho modules and version numbers. |

---

## 2. Protocol Version 1.1.0 Changes

1. **Atomic File Renaming**: Requests are written as `req_<id>.json.tmp` and atomically renamed to `req_<id>.json`.
2. **Correlation ID Header**: Every JSON-RPC request includes `correlationId` (e.g. `corr_1721850000`).
3. **Protocol Field**: Requests specify `protocolVersion: "1.1.0"`.
4. **Queue Limits**: Maximum 50 pending IPC requests before rejection.
5. **Path Sandboxing**: Target file paths are strictly validated against project workspace and OS temporary directories.
