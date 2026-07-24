# Upstream Integration & Synchronization Guide (`UPSTREAM.md`)

This repository is built directly on top of the open-source **[Kveto/MohoMCP](https://github.com/Kveto/MohoMCP)** repository as its canonical core base.

---

## 1. Upstream Origin & Tracking

- **Upstream Repository**: `https://github.com/Kveto/MohoMCP.git`
- **Tracked Upstream Branch**: `master`
- **Pinned Upstream Commit SHA**: `d592a572d80d0de292b2b9c5866bdd0f058f8fd4`
- **Working Integration Branch**: `integration/mohomcp-enterprise`
- **Legacy Reference Branch**: `legacy/generated-enterprise`

---

## 2. Upstream Architecture & Directory Layout

We strictly adopt the upstream MohoMCP directory layout:

```
.
├── LICENSE                      # Original MIT License from Kveto/MohoMCP
├── THIRD_PARTY_NOTICES.md       # Complete attribution, commit SHA, & change log
├── bridge/                      # Node.js TypeScript MCP Bridge Server
│   ├── package.json             # Pinned dependencies (no ^ or ~)
│   ├── src/
│   │   ├── config.ts            # Enterprise configuration & protocol versioning
│   │   ├── index.ts             # MCP Stdio transport entry point
│   │   ├── moho-client.ts       # Atomic file IPC client (.tmp -> .json rename)
│   │   ├── security/            # MohoSafetyEngine (whitelist, sandbox, dry-run)
│   │   ├── tools.ts             # Canonical tools + composite workflows + legacy aliases
│   │   └── resources.ts         # Static & dynamic MCP resources
│   └── src/__tests__/           # Vitest suite (unit, contract, E2E simulation)
├── moho-plugin/                 # Moho Pro 14 Lua Plugin
│   ├── MohoMCP_Server.lua       # Main server menu script & DrawMe/IsEnabled polling hooks
│   ├── MohoMCP_Poller.lua       # Passive tool poller script
│   ├── json.lua                 # Embedded Lua JSON library
│   └── moho_mcp/                # Modular Lua tool handlers
│       ├── protocol.lua         # JSON-RPC parser
│       ├── server.lua           # Lua request dispatcher
│       └── tools/               # Document, layer, bone, animation, mesh, batch modules
├── schema/                      # Tool JSON schemas
│   └── tools.json
└── docs/                        # Upstream & Enterprise documentation
    └── UPSTREAM_COMPARISON.md
```

---

## 3. Upstream Synchronization Workflow

To fetch and merge new upstream updates without destroying enterprise security enhancements:

```bash
# 1. Fetch latest upstream commits
git fetch upstream master

# 2. Check changes against pinned commit SHA (d592a572d80d0de292b2b9c5866bdd0f058f8fd4)
git log d592a572d80d0de292b2b9c5866bdd0f058f8fd4..upstream/master --oneline

# 3. Merge or rebase onto integration/mohomcp-enterprise
git rebase upstream/master

# 4. Verify test suite
cd bridge && npm test
```
