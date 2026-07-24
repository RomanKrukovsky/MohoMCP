# Real Moho Pro 14 Verification Test Report (`REAL_MOHO_TEST_REPORT.md`)

**Status**: **NOT EXECUTED**  
**Reason**: Live Moho Pro 14 application runtime execution was not performed in this session. All automated verification was performed via unit tests and simulated IPC daemon fixtures (see `SIMULATED_E2E_TEST_REPORT.md`). No mock responses or artificial latency metrics are placed in this live verification report.

---

## Required Manual Setup Steps for Live Verification

To execute live end-to-end verification inside a real Moho Pro 14 application instance:

1. **Install Plugin**:
   Run `./install-plugin.sh` (macOS) or `install-plugin.bat` (Windows) to install `MohoMCP_Server.lua` and `MohoMCP_Poller.lua` into your custom Moho scripts folder:
   - macOS: `~/Library/Application Support/Lost Marble/Moho Pro 14/scripts/menu/MohoMCP_Server.lua`
   - Windows: `%APPDATA%\Lost Marble\Moho Pro 14\scripts\menu\MohoMCP_Server.lua`

2. **Launch Moho Pro 14**:
   Open Moho Pro 14 and create or open a `.moho` project document.

3. **Start MohoMCP Server Script**:
   From Moho's top menu bar, select **Scripts > MohoMCP Server**. A dialog box will confirm:
   `MohoMCP Server started! IPC directory: ~/Library/Application Support/MohoMCP/ipc`

4. **Connect MCP Bridge**:
   In your terminal, launch the bridge server:
   ```bash
   cd bridge
   npm start
   ```

5. **Execute E2E Command Sequence**:
   Execute the live verification sequence via Claude Desktop, Claude Code, or MCP Inspector:
   - `document_getInfo`
   - `document_getLayers`
   - `document_setFrame(frame: 12)`
   - `layer_setName(layerId: 1, name: "Test_Layer")`
   - `layer_setTransform(layerId: 1, rotation: 15)`
   - `animation_setKeyframe(layerId: 1, channel: "rotation", frame: 12, value: 15)`

6. **Log Results**:
   Record actual execution latency, IPC file creation times, and verify the resulting `.moho` document state.
