import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerTools } from "../tools.js";
import { MohoClient } from "../moho-client.js";

vi.mock("../moho-client.js", () => {
  const MohoClient = vi.fn();
  MohoClient.prototype.isConnected = vi.fn().mockReturnValue(true);
  MohoClient.prototype.connect = vi.fn().mockResolvedValue(undefined);
  MohoClient.prototype.sendRequest = vi.fn().mockResolvedValue({ ok: true });
  MohoClient.prototype.disconnect = vi.fn();
  return { MohoClient };
});

interface RegisteredTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: (...args: unknown[]) => Promise<unknown>;
}

function createMockMcpServer() {
  const tools: RegisteredTool[] = [];

  return {
    tools,
    tool(
      name: string,
      description: string,
      schema: Record<string, unknown>,
      handler: (...args: unknown[]) => Promise<unknown>,
    ) {
      tools.push({ name, description, schema, handler });
    },
  };
}

describe("registerTools", () => {
  let mockServer: ReturnType<typeof createMockMcpServer>;
  let client: MohoClient;

  beforeEach(() => {
    mockServer = createMockMcpServer();
    client = new MohoClient();
    vi.clearAllMocks();
  });

  it("registers tools without throwing", () => {
    expect(() =>
      registerTools(mockServer as unknown as Parameters<typeof registerTools>[0], client),
    ).not.toThrow();
  });

  it("registers canonical tools, experimental workflows, and diagnostics", () => {
    registerTools(mockServer as unknown as Parameters<typeof registerTools>[0], client);
    expect(mockServer.tools.length).toBeGreaterThanOrEqual(26);
  });

  it("registers canonical tool names by default", () => {
    registerTools(mockServer as unknown as Parameters<typeof registerTools>[0], client);

    const names = mockServer.tools.map((t) => t.name);

    // Read-only query tools
    expect(names).toContain("document_getInfo");
    expect(names).toContain("document_getLayers");
    expect(names).toContain("layer_getProperties");
    expect(names).toContain("layer_getChildren");
    expect(names).toContain("layer_getBones");
    expect(names).toContain("bone_getProperties");
    expect(names).toContain("animation_getKeyframes");
    expect(names).toContain("animation_getFrameState");
    expect(names).toContain("mesh_getPoints");
    expect(names).toContain("mesh_getShapes");

    // Mutation tools
    expect(names).toContain("bone_setTransform");
    expect(names).toContain("bone_selectBone");
    expect(names).toContain("animation_setKeyframe");
    expect(names).toContain("animation_deleteKeyframe");
    expect(names).toContain("animation_setInterpolation");
    expect(names).toContain("document_setFrame");
    expect(names).toContain("layer_setTransform");
    expect(names).toContain("layer_setVisibility");
    expect(names).toContain("layer_setOpacity");
    expect(names).toContain("layer_setName");
    expect(names).toContain("layer_selectLayer");

    // Enterprise system diagnostics
    expect(names).toContain("system_getCapabilities");
    expect(names).toContain("system_diagnose");
  });
});
