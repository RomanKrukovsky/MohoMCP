# Lua Handler Source Audit (`HANDLER_SOURCES.md`)

This document provides a comprehensive mapping of all MCP tool methods to their underlying Lua handler implementations in `moho-plugin/moho_mcp/tools/`.

---

## Handler Inventory

| Tool Method | Lua File & Function | Required / Optional Parameters | Return Signature / Output Fields | Moho API Compatibility & Notes | Safety / Shell Calls |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `document.getInfo` | `document.lua` -> `document.getInfo` | None | `{ name, filePath, width, height, fps, startFrame, endFrame, currentFrame, duration, totalLayers, topLevelLayers }` | Safe `pcall` guards around `doc:Name()`, `doc:Path()`, etc. | No shell calls |
| `document.getLayers` | `document.lua` -> `document.getLayers` | None | `Array<{ id, name, type, visible, locked, parentId, children }>` | Resolves `moho:LayerAbsoluteID(lyr)` with fallback to index `i` | No shell calls |
| `document.setFrame` | `document.lua` -> `document.setFrame` | `frame: number` | `{ success: boolean, currentFrame: number }` | `moho:SetCurFrame(math.floor(frame))` | No shell calls |
| `document.screenshot` | `document.lua` -> `document.screenshot` | `width?: number`, `height?: number` | `{ success: boolean, filePath: string, width: number, height: number }` | Uses `moho:Render(tempPath, w, h)`. | Directory creation uses explicit `/bin/mkdir -p` (Unix) or `cmd.exe /c mkdir` (Windows) |
| `layer.getProperties` | `layer.lua` -> `layer.getProperties` | `layerId: number` | `{ id, name, type, visible, locked, opacity, origin: {x,y}, scale: {x,y}, rotation: number, position: {x,y,z} }` | Resolves layer by `LayerAbsoluteID` or index | No shell calls |
| `layer.getChildren` | `layer.lua` -> `layer.getChildren` | `layerId: number` | `Array<{ id, name, type, visible, locked, parentId }>` | Group layer inspection via `moho:LayerAsGroup()` | No shell calls |
| `layer.getBones` | `layer.lua` -> `layer.getBones` | `layerId: number` | `Array<{ id, name, parentId, length, angle, position: {x,y}, scale: number }>` | Bone layer inspection via `moho:LayerAsBone()` and `Skeleton:CountBones()` | No shell calls |
| `layer.setTransform` | `layer.lua` -> `layer.setTransform` | `layerId: number`, `position?: {x,y,z}`, `rotation?: number`, `scale?: {x,y}` | `{ success: boolean, layerId: number }` | Keyframes transform at current frame | No shell calls |
| `layer.setVisibility` | `layer.lua` -> `layer.setVisibility` | `layerId: number`, `visible: boolean` | `{ success: boolean, layerId: number, visible: boolean }` | `layer:SetIsVisible(visible)` | No shell calls |
| `layer.setOpacity` | `layer.lua` -> `layer.setOpacity` | `layerId: number`, `opacity: number` (0.0 - 1.0) | `{ success: boolean, layerId: number, opacity: number }` | `layer.fAlpha:SetValue(frame, opacity)` | No shell calls |
| `layer.setName` | `layer.lua` -> `layer.setName` | `layerId: number`, `name: string` | `{ success: boolean, layerId: number, name: string }` | `layer:SetName(name)` | No shell calls |
| `layer.selectLayer` | `layer.lua` -> `layer.selectLayer` | `layerId: number` | `{ success: boolean, layerId: number }` | `moho:SetSelLayer(layer)` | No shell calls |
| `bone.getProperties` | `bone.lua` -> `bone.getProperties` | `layerId: number`, `boneId: number` | `{ id, name, parentId, length, angle, position: {x,y}, scale: number, strength: number }` | `skel:Bone(boneId)` | No shell calls |
| `bone.setTransform` | `bone.lua` -> `bone.setTransform` | `layerId: number`, `boneId: number`, `position?: {x,y}`, `angle?: number`, `scale?: number` | `{ success: boolean, boneId: number }` | Sets keyframes on `fPos`, `fAnimAngle`, `fScale` | No shell calls |
| `bone.selectBone` | `bone.lua` -> `bone.selectBone` | `layerId: number`, `boneId: number` | `{ success: boolean, boneId: number }` | `skel:SelectBone(boneId)` | No shell calls |
| `mesh.getPoints` | `mesh.lua` -> `mesh.getPoints` | `layerId: number` | `Array<{ id, pos: {x,y}, sel: boolean }>` | `mesh:Point(i)` | No shell calls |
| `mesh.getShapes` | `mesh.lua` -> `mesh.getShapes` | `layerId: number` | `Array<{ id, name, pointCount, selected }>` | `mesh:Shape(i)` | No shell calls |
| `animation.getKeyframes` | `animation.lua` -> `animation.getKeyframes` | `layerId: number`, `channel?: string` | `Array<{ frame, value, interp }>` | `AnimChannel:GetKeyWhen(i)` | No shell calls |
| `animation.getFrameState` | `animation.lua` -> `animation.getFrameState` | `frame: number` | `{ frame, layers: Array<{ id, transform }> }` | Evaluates document state at `frame` | No shell calls |
| `animation.setKeyframe` | `animation.lua` -> `animation.setKeyframe` | `layerId: number`, `channel: string`, `frame: number`, `value: number \| table` | `{ success: boolean, frame: number }` | `channel:SetValue(frame, val)` | No shell calls |
| `animation.deleteKeyframe` | `animation.lua` -> `animation.deleteKeyframe` | `layerId: number`, `channel: string`, `frame: number` | `{ success: boolean, frame: number }` | `channel:DeleteKey(frame)` | No shell calls |
| `animation.setInterpolation` | `animation.lua` -> `animation.setInterpolation` | `layerId: number`, `channel: string`, `frame: number`, `interp: string` | `{ success: boolean, frame: number, interp: string }` | Sets channel keyframe interpolation (Linear, Smooth, EaseIn, EaseOut, Step) | No shell calls |
| `batch.execute` | `batch.lua` -> `batch.execute` | `operations: Array<{ method: string, params: object }>`, `stopOnError?: boolean` | `{ results: Array<{ success: boolean, index: number, result?: any, error?: object }>, summary: object }` | Collapses up to 50 operations into a single IPC pass. Disallows recursive batching and screenshots. | No shell calls |

---

## Security Audit Verification

1. **No Arbitrary Code Execution**: Zero uses of `loadstring`, `load`, `dofile`, `eval`, or un-sanitized `os.execute`.
2. **Path Sanitization**: Directory creation in `document.screenshot` uses hardcoded `/bin/mkdir -p` or Windows `cmd.exe /c mkdir` with quotes.
3. **Pcall Wrapping**: All Moho C++ API interactions are wrapped in Lua `pcall` blocks to prevent Moho application crashes.
