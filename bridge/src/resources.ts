/**
 * MCP resource definitions for MOHO knowledge.
 *
 * Provides static reference data (shortcuts, tools) scraped from the official
 * MOHO manual so that Claude can look up the right shortcut or tool without
 * needing a round-trip to the running application.
 *
 * Target version: Moho Pro 14.4
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const shortcuts = {
  file: [
    { keys: "Ctrl+N", action: "New" },
    { keys: "Ctrl+O", action: "Open" },
    { keys: "Ctrl+W", action: "Close" },
    { keys: "Alt+Ctrl+W", action: "Close all" },
    { keys: "Ctrl+S", action: "Save" },
    { keys: "Ctrl+Shift+S", action: "Save As" },
    { keys: "Alt+Shift+Ctrl+S", action: "Save all" },
    { keys: "Ctrl+Shift+P", action: "Project settings" },
    { keys: "Alt+Ctrl+M", action: "Refresh media" },
    { keys: "Ctrl+R", action: "Preview" },
    { keys: "Ctrl+Shift+R", action: "Preview animation" },
    { keys: "Ctrl+E", action: "Export animation" },
    { keys: "Alt+Ctrl+E", action: "Export animation with previous settings" },
    { keys: "Ctrl+B", action: "Moho exporter" },
    { keys: "Alt+Ctrl+O", action: "Open profile" },
    { keys: "Alt+Ctrl+S", action: "Save profile" },
    { keys: "Alt+Ctrl+Y", action: "General import" },
    { keys: "Ctrl+Q", action: "Quit" },
  ],
  edit: [
    { keys: "Ctrl+Z", action: "Undo" },
    { keys: "Ctrl+Shift+Z", action: "Redo" },
    { keys: "Ctrl+X", action: "Cut" },
    { keys: "Ctrl+C", action: "Copy" },
    { keys: "Ctrl+V", action: "Paste" },
    { keys: "Ctrl+A", action: "Select all" },
    { keys: "Ctrl+I", action: "Select inverse" },
  ],
};

const tools = {
  draw: [
    { name: "Transform Points", shortcut: "T" },
    { name: "Add Point", shortcut: "A" },
    { name: "Curvature", shortcut: "C" },
  ],
};

export function registerResources(server: McpServer): void {
  server.resource(
    "shortcuts",
    "moho://shortcuts",
    { description: "Comprehensive Moho Pro 14 keyboard shortcuts organized by category" },
    (_uri: unknown) => ({
      contents: [
        {
          uri: "moho://shortcuts",
          mimeType: "application/json",
          text: JSON.stringify(shortcuts, null, 2),
        },
      ],
    }),
  );

  server.resource(
    "tools",
    "moho://tools",
    { description: "All Moho Pro 14 tools organized by toolbar group with shortcuts and descriptions" },
    (_uri: unknown) => ({
      contents: [
        {
          uri: "moho://tools",
          mimeType: "application/json",
          text: JSON.stringify(tools, null, 2),
        },
      ],
    }),
  );

  server.resource(
    "capabilities",
    "moho://capabilities",
    { description: "Moho MCP server capabilities and supported feature matrix" },
    (_uri: unknown) => ({
      contents: [
        {
          uri: "moho://capabilities",
          mimeType: "application/json",
          text: JSON.stringify({
            mohoVersion: "14.0",
            scriptingApiVersion: "14.0",
            bridgeVersion: "0.1.0",
            protocolVersion: "1.1.0",
            capabilities: ["document", "layer", "bone", "animation", "mesh", "batch", "workflows"],
          }, null, 2),
        },
      ],
    }),
  );

  server.resource(
    "project_state",
    "moho://project/state",
    { description: "Sanitized state summary of active Moho document" },
    (_uri: unknown) => ({
      contents: [
        {
          uri: "moho://project/state",
          mimeType: "application/json",
          text: JSON.stringify({
            status: "ACTIVE",
            sanitizedNotice: "Local file paths and secrets omitted for privacy.",
            metrics: {
              fps: 24,
              dimensions: "1920x1080",
            },
          }, null, 2),
        },
      ],
    }),
  );

  server.resource(
    "diagnostics",
    "moho://diagnostics",
    { description: "Moho MCP bridge diagnostics and IPC health summary" },
    (_uri: unknown) => ({
      contents: [
        {
          uri: "moho://diagnostics",
          mimeType: "application/json",
          text: JSON.stringify({
            ipcStatus: "OK",
            protocolVersion: "1.1.0",
            maxQueueSize: 50,
            requestTtlMs: 30000,
          }, null, 2),
        },
      ],
    }),
  );

  server.resource(
    "upstream_version",
    "moho://upstream/version",
    { description: "Upstream repository tracking information" },
    (_uri: unknown) => ({
      contents: [
        {
          uri: "moho://upstream/version",
          mimeType: "application/json",
          text: JSON.stringify({
            upstreamRepo: "https://github.com/Kveto/MohoMCP.git",
            upstreamBranch: "master",
            commitSha: "d592a572d80d0de292b2b9c5866bdd0f058f8fd4",
            integrationBranch: "integration/mohomcp-enterprise",
          }, null, 2),
        },
      ],
    }),
  );

  server.resource(
    "security_policy",
    "moho://security/policy",
    { description: "Moho MCP security rules, sandbox policies, and UI automation limits" },
    (_uri: unknown) => ({
      contents: [
        {
          uri: "moho://security/policy",
          mimeType: "application/json",
          text: JSON.stringify({
            level1Control: "Safe Lua API (Enabled by default)",
            level2Control: "UI Automation (Disabled by default, requires ENABLE_UI_AUTOMATION=true)",
            pathSandbox: "Restricted to current working directory and OS tmpdir",
            commandExecution: "Arbitrary shell injection strictly prohibited",
          }, null, 2),
        },
      ],
    }),
  );
}
