/**
 * Platform-dispatch wrapper for window capture.
 * Routes to window-capture.ts on Windows or darwin-capture.ts on macOS.
 * Strict Level 2 UI Automation guard enforced.
 */

import os from "node:os";
import { config } from "./config.js";

let _captureAppWindow: typeof import("./window-capture.js").captureAppWindow;
let _loaded = false;

function checkUiAutomationEnabled(): void {
  if (!config.moho.enableUiAutomation) {
    throw new Error(
      "SECURITY WARNING: Level 2 UI Automation is disabled by default. " +
      "Set ENABLE_UI_AUTOMATION=true in your environment to allow window screenshot capture. " +
      "Always prefer deterministic Lua API tools over UI automation.",
    );
  }
}

async function loadBackend(): Promise<void> {
  checkUiAutomationEnabled();
  if (_loaded) return;
  const platform = os.platform();
  if (platform === "win32") {
    const mod = await import("./window-capture.js");
    _captureAppWindow = mod.captureAppWindow;
  } else if (platform === "darwin") {
    const mod = await import("./darwin-capture.js");
    _captureAppWindow = mod.captureAppWindow;
  } else {
    throw new Error(
      `Window capture is not supported on ${platform}. ` +
      `Supported platforms: Windows (win32), macOS (darwin).`,
    );
  }
  _loaded = true;
}

export async function captureAppWindow(
  outputPath: string,
): Promise<{ width: number; height: number }> {
  await loadBackend();
  return _captureAppWindow(outputPath);
}
