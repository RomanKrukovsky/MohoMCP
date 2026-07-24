# Comprehensive Capability & Tool Matrix (`CAPABILITY_MATRIX.md`)

This matrix provides a detailed audit of every MCP tool in **MohoMCP Enterprise**, including TypeScript bridge handlers, Lua server handlers, underlying Moho C++/Lua API calls, safety classifications, Undo capabilities, backup requirements, test statuses, and final readiness classification.

---

## Tool Capability Audit Table

| MCP Tool Name | TypeScript Handler | Lua Handler File & Function | Real Moho API Methods Used | Classification | Native Undo | Backup Rec. | Automated Test | Real Moho Test | Final Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `document_getInfo` | `tools.ts` | `moho_mcp/tools/document.lua:getInfo` | `moho:Document()`, `doc:Name()`, `doc:Width()`, `doc:Height()`, `doc:Fps()` | Read-Only | N/A | No | `tools.test.ts` | Not Executed | `simulated` |
| `document_getLayers` | `tools.ts` | `moho_mcp/tools/document.lua:getLayers` | `doc:CountLayers()`, `doc:Layer(i)`, `layer:Name()`, `layer:LayerType()` | Read-Only | N/A | No | `tools.test.ts` | Not Executed | `simulated` |
| `document_setFrame` | `tools.ts` | `moho_mcp/tools/document.lua:setFrame` | `moho:SetCurFrame(frame)` | Write | Yes (`moho:Undo()`) | No | `tools.test.ts` | Not Executed | `simulated` |
| `layer_getProperties` | `tools.ts` | `moho_mcp/tools/layer.lua:getProperties` | `layer:Name()`, `layer:Visible()`, `layer:SecondaryColor()` | Read-Only | N/A | No | `tools.test.ts` | Not Executed | `simulated` |
| `layer_getChildren` | `tools.ts` | `moho_mcp/tools/layer.lua:getChildren` | `groupLayer:CountLayers()`, `groupLayer:Layer(i)` | Read-Only | N/A | No | `tools.test.ts` | Not Executed | `simulated` |
| `layer_getBones` | `tools.ts` | `moho_mcp/tools/layer.lua:getBones` | `boneLayer:CountBones()`, `boneLayer:Bone(i)` | Read-Only | N/A | No | `tools.test.ts` | Not Executed | `simulated` |
| `layer_setTransform` | `tools.ts` | `moho_mcp/tools/layer.lua:setTransform` | `layer.fTranslation:SetValue()`, `layer.fRotation:SetValue()` | Write | Yes (`moho:Undo()`) | No | `tools.test.ts` | Not Executed | `simulated` |
| `layer_setVisibility` | `tools.ts` | `moho_mcp/tools/layer.lua:setVisibility` | `layer.fVisibility:SetValue()` | Write | Yes (`moho:Undo()`) | No | `tools.test.ts` | Not Executed | `simulated` |
| `layer_setOpacity` | `tools.ts` | `moho_mcp/tools/layer.lua:setOpacity` | `layer.fAlpha:SetValue()` | Write | Yes (`moho:Undo()`) | No | `tools.test.ts` | Not Executed | `simulated` |
| `layer_setName` | `tools.ts` | `moho_mcp/tools/layer.lua:setName` | `layer:SetName(name)` | Write | Yes (`moho:Undo()`) | No | `tools.test.ts` | Not Executed | `simulated` |
| `layer_selectLayer` | `tools.ts` | `moho_mcp/tools/layer.lua:selectLayer` | `moho:SetSelLayer(layer)` | Write | Yes (`moho:Undo()`) | No | `tools.test.ts` | Not Executed | `simulated` |
| `bone_getProperties` | `tools.ts` | `moho_mcp/tools/bone.lua:getProperties` | `bone.fPos`, `bone.fAngle`, `bone.fLength`, `bone.fParent` | Read-Only | N/A | No | `tools.test.ts` | Not Executed | `simulated` |
| `bone_setTransform` | `tools.ts` | `moho_mcp/tools/bone.lua:setTransform` | `bone.fPos:SetValue()`, `bone.fAngle:SetValue()` | Write | Yes (`moho:Undo()`) | No | `tools.test.ts` | Not Executed | `simulated` |
| `bone_selectBone` | `tools.ts` | `moho_mcp/tools/bone.lua:selectBone` | `skel:SetSelBone(boneId)` | Write | Yes (`moho:Undo()`) | No | `tools.test.ts` | Not Executed | `simulated` |
| `animation_getKeyframes` | `tools.ts` | `moho_mcp/tools/animation.lua:getKeyframes` | `channel:CountKeys()`, `channel:GetKeyWhen(i)` | Read-Only | N/A | No | `tools.test.ts` | Not Executed | `simulated` |
| `animation_getFrameState` | `tools.ts` | `moho_mcp/tools/animation.lua:getFrameState` | `channel:GetValue(frame)` | Read-Only | N/A | No | `tools.test.ts` | Not Executed | `simulated` |
| `animation_setKeyframe` | `tools.ts` | `moho_mcp/tools/animation.lua:setKeyframe` | `channel:SetValue(frame, val)` | Write | Yes (`moho:Undo()`) | No | `tools.test.ts` | Not Executed | `simulated` |
| `animation_deleteKeyframe` | `tools.ts` | `moho_mcp/tools/animation.lua:deleteKeyframe` | `channel:DeleteKey(frame)` | Destructive (Requires `previewHash`) | Yes (`moho:Undo()`) | Recommended | `safety_engine.test.ts` | Not Executed | `simulated` |
| `animation_setInterpolation` | `tools.ts` | `moho_mcp/tools/animation.lua:setInterpolation` | `channel:SetInterp(frame, mode)` | Write | Yes (`moho:Undo()`) | No | `tools.test.ts` | Not Executed | `simulated` |
| `mesh_getPoints` | `tools.ts` | `moho_mcp/tools/mesh.lua:getPoints` | `mesh:CountPoints()`, `mesh:Point(i)` | Read-Only | N/A | No | `tools.test.ts` | Not Executed | `simulated` |
| `mesh_getShapes` | `tools.ts` | `moho_mcp/tools/mesh.lua:getShapes` | `mesh:CountShapes()`, `mesh:Shape(i)` | Read-Only | N/A | No | `tools.test.ts` | Not Executed | `simulated` |
| `batch_execute` | `tools.ts` | `moho_mcp/tools/batch.lua:execute` | Atomic loop over sub-handlers | Mixed (Evaluated per op) | Dependent | Recommended | `simulated_moho_e2e.test.ts` | Not Executed | `simulated` |
| `document_screenshot` | `tools.ts` | `platform-capture.ts` | Window Screen Capture OS API | Read-Only (Gated) | N/A | No | `tools.test.ts` | Not Executed | `simulated` |
| `input_mouseClick` | `tools.ts` | `platform-input.ts` | JXA / Win32 Mouse Click | Input Automation (Gated) | No | Recommended | `tools.test.ts` | Not Executed | `simulated` |
| `input_mouseDrag` | `tools.ts` | `platform-input.ts` | JXA / Win32 Mouse Drag | Input Automation (Gated) | No | Recommended | `tools.test.ts` | Not Executed | `simulated` |
| `input_sendKeys` | `tools.ts` | `platform-input.ts` | JXA / Win32 Keystroke Event | Input Automation (Gated) | No | Recommended | `tools.test.ts` | Not Executed | `simulated` |
| `workflow_createCharacterRig` | `tools.ts` | None | None | Planning Only | N/A | No | `tools.test.ts` | Not Executed | `experimental` |
| `workflow_setupSmartBone` | `tools.ts` | None | None | Planning Only | N/A | No | `tools.test.ts` | Not Executed | `experimental` |
| `workflow_applyLipSync` | `tools.ts` | None | None | Planning Only | N/A | No | `tools.test.ts` | Not Executed | `experimental` |

---

## Status Definitions

- **verified**: Executed and validated inside live running Moho Pro 14 GUI.
- **simulated**: Verified via TypeScript build, Zod schemas, unit tests, and simulated IPC daemon fixtures.
- **experimental**: High-level workflow planning tool without proven atomic Lua API chain.
- **unsupported**: Legacy or non-functional tool placeholder.
