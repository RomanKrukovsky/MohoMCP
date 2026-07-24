# MohoMCP Master Execution Plan (`docs/MASTER_EXECUTION_PLAN.md`)

**Status**: living document, updated after every stage commit
**Branch**: `integration/mohomcp-enterprise`
**Current Release Status**: `Experimental Prototype` — prior project classification was `Functional Alpha`; downgraded because no real Moho tests executed and no atomic tools verified. This status will not change without real evidence.
**Last Updated**: 2026-07-25

---

## 0. Ground Rules (non-negotiable)

1. **Real evidence only.** No mock numbers, fake screenshots, fabricated latency statistics, or pretend Moho executions in any report or commit.
2. **Honest readiness ladder**: `Experimental Prototype → Functional Alpha → Verified Beta → Production Candidate → Production Ready → Enterprise Ready`. The current status is `Functional Alpha` and will not move higher without real proof.
3. **No fabricated Lua APIs.** Every Moho API call is either in the public Moho scripting docs, an upstream Moho script, or proven by a real run.
4. **No arbitrary code execution.** `loadstring`, `load`, `dofile(<user input>)`, shell/PowerShell/AppleScript/JXA/Python invocations from MCP parameters are strictly prohibited.
5. **Stdio purity.** When the MCP server runs over stdio, stdout carries only MCP protocol output; logs go to stderr and rotating files.
6. **Backward compatibility veto.** Nothing changes IPC wire format or registered tool names without a 60-day deprecation window and a working alias.
7. **IPC must not scan `1..maxId`.** Use directory listing, sort by sequence/timestamp, persistent cursor, atomic cleanup.

---

## 1. Stage Track

Each stage is its own commit (`stage-NN: <title>`). After each stage: `npm run typecheck && npm run build && npm test`. Any failure is fixed in that stage before moving on.

| # | Stage | Deliverable | Dependencies | Exit Criteria | Status |
|---|-------|-------------|--------------|---------------|--------|
| 0 | Lua IPC discovery rewrite | No `for id = 1, maxId` loop; persistent cursor + sorted enumeration | — | vitest + simulated Lua test pass | ⬜ Not Started |
| 1 | Bridge IPC hardening | Dead-letter dir, lock sanitizer, replay/oversize/poison isolation | 0 | vitest adversarial suite pass | ⬜ Not Started |
| 2 | Lua handler source audit | Per-file `HANDLER_SOURCES.md` + capability flags | 0 | grep + manual review clean | ⬜ Not Started |
| 3 | Lua/JS sandbox boundaries | Static command whitelist + Lua sandbox | 1 | vitest pass | ⬜ Not Started |
| 4 | Polling architecture + keep-alive separation | Documented invariants + opt-in keep-alive | 2 | vitest + docs pass | ⬜ Not Started |
| 5 | Adversarial IPC tests | Malformed/oversized/replay/lock/symlink/queue suites | 1,3 | npm test pass | ⬜ Not Started |
| 6 | Structured logging, error taxonomy, correlation/req IDs | `lib/errors.ts`, `lib/log.ts` + redact rules | 1 | vitest pass | ⬜ Not Started |
| 7 | Capability negotiation + version matrix | `moho://capabilities` + `--detect-moho` CLI | 0 | vitest + cli pass | ⬜ Not Started |
| 8 | Resources + prompts | `moho://*` resources, prompts list | 7 | mcp-inspector scheme pass | ⬜ Not Started |
| 9 | Workflows (rig, smart bone, lipsync, dup, render, diag) | Each with dry-run/preview/timeout/recovery | 5,8 | vitest workflow unit + integration pass | ⬜ Not Started |
| 10 | Real Moho fixture + test report | `fixtures/MCP_REAL_TEST.moho`, `REAL_MOHO_TEST_REPORT.md` | 9 | manual procedure documented | ⬜ Not Started |
| 11 | Performance / failure-injection / security tests | p50/p95/p99 from real runs | 10 | vitest pass | ⬜ Not Started |
| 12 | CLI surface | `moho-mcp {doctor,install,...}` | 7 | shell dry-run pass | ⬜ Not Started |
| 13 | Installer + updater + rollback | macOS .pkg + Win signed EXE + manifest w/ SHA-256 | 12 | documented signing flow | ⬜ Not Started |
| 14 | Local web panel | localhost-only, CSRF token, no `0.0.0.0` | 13 | smoke test pass | ⬜ Not Started |
| 15 | Docs + diagnostics bundle + demo | Full doc suite + encryption-stripped archive generator | 14 | file presence + size sanity | ⬜ Not Started |
| 16 | Final verdict | Honest release-readiness table | 15 | evidence chain complete | ⬜ Not Started |

---

## 2. Architecture & Security Requirements

### 1.1 Poison Request Isolation
- Dedicated dead-letter directory for malformed/unparseable requests
- Automatic quarantine of requests that fail JSON parsing, schema validation, or exceed size limits
- Retention policy with automatic cleanup after configurable TTL
- Per-request logging with correlation ID for forensic analysis

### 1.2 Health File
- Atomic write of `health.json` with server status, last poll timestamp, queue depth, error counts
- Used by external monitors and `moho-mcp doctor` CLI
- Schema versioned for backward compatibility

### 1.3 Protocol Migration
- Wire protocol version in every request/response (`protocolVersion` field)
- Capability negotiation on connect (`moho://capabilities` resource)
- Deprecation policy: 2-version overlap with alias support
- Automated migration scripts for config/storage layout changes

### 1.4 Backward Compatibility Policy
- IPC wire format v1.x preserved; any v2 requires 2-version deprecation cycle
- Tool name changes: `primary` + `alias` with `MOHO_MCP_ENABLE_LEGACY_ALIASES=true` opt-in
- Config keys never renamed in place; new keys added, old keys read with deprecation warning
- Storage layout canonical: `~/Library/Application Support/MohoMCP/ipc` (macOS) and `%LOCALAPPDATA%\MohoMCP\ipc` (Windows)

---

## 2. IPC Implementation Requirements

### 2.1 File Enumeration (No Linear Scan)
**CRITICAL**: Do not scan infinite IDs from 1 to maxId. Implement:
- Directory listing via `fs.readdir` / `os.listdir` / Lua `lfs.dir`
- Sort by timestamp (mtime) or embedded sequence number
- Persistent cursor stored in `cursor.json` tracking last processed file
- Atomic cleanup of processed files after response acknowledged
- Performance must not degrade linearly with total history size

### 2.2 Adversarial IPC Tests (All Must Pass)
| Test Case | Description |
|-----------|-------------|
| `malformed_json` | Invalid JSON syntax, truncated payloads, Unicode edge cases |
| `empty_json` | `{}` or `[]` without required fields |
| `partial_json` | Streaming/chunked writes that never complete |
| `oversized_request` | Payload > `maxJsonSizeBytes` (configurable, default 1MB) |
| `oversized_response` | Handler returns > limit; must truncate or reject |
| `duplicate_request_id` | Replay attack detection via idempotency key tracking |
| `duplicate_idempotency_key` | Client-side deduplication enforced |
| `replay_attack` | Captured request replayed after TTL expiry |
| `expired_request` | Request older than `requestTtlMs` rejected |
| `response_without_request` | Orphan response file handled gracefully |
| `request_without_response` | Stale request cleanup after TTL |
| `corrupted_lock` | Lock file with invalid JSON/wrong PID |
| `stale_lock` | Lock file older than heartbeat threshold |
| `concurrent_clients` | Multiple bridge processes attempting lock |
| `concurrent_batches` | Batch operations interleaved with single ops |
| `node_crash_during_write` | Simulated SIGKILL mid-write; atomic rename must survive |
| `moho_crash_during_op` | Lua error mid-handler; IPC state consistency |
| `moho_restart_with_queue` | Pending requests survive Moho restart |
| `bridge_restart_with_queue` | Pending requests survive bridge restart |
| `symlink_attack` | IPC dir symlinked to sensitive location |
| `junction_attack` | Windows junction to escape sandbox |
| `path_traversal` | `../../../etc/passwd` in params |
| `unicode_normalization` | NFD vs NFC filename collisions |
| `spaces_cyrillic_paths` | Filenames with spaces, Cyrillic, emoji |
| `insufficient_permissions` | IPC dir not writable/readable |
| `owner_change` | Directory ownership changed mid-session |
| `queue_flooding` | > `maxQueueSize` requests queued |
| `disk_full` | ENOSPC handling during write |
| `read_only_fs` | EROFS handling |
| `antivirus_quarantine` | File locked by AV scanner |
| `windows_long_paths` | Paths > 260 chars with `\\?\` prefix |

### 2.3 Lua Bridge API Verification
**CRITICAL**: Every Lua API call must have a verified source:
- Official Moho Scripting API documentation (lostmarble.com)
- Built-in Moho scripts (installed with Moho Pro)
- Upstream open-source Moho scripts (GitHub/LostMarble forums)
- Real test execution in Moho Pro 14

**Prohibited**: Invented APIs, guessed method signatures, assumed return types

### 2.4 No Arbitrary Code Execution (Enforced)
| Prohibited | Enforcement |
|------------|-------------|
| `loadstring` / `load` from user input | Static analysis + runtime guard |
| `dofile` with user-supplied path | Path sandbox validation |
| `os.execute` with user params | Command whitelist only |
| Shell / PowerShell / AppleScript / JXA / Python | Not in allowlist |
| External binaries from MCP params | Static binary list only |

All external commands: statically defined, minimal, separate security review

---

## 3. Polling Architecture Documentation

### 3.1 Required Documentation
For each polling mechanism, document:
- Which Lua script activates the bridge (`MohoMCP_Server.lua:Run` + `MohoMCP_Poller.lua:DrawMe`)
- Callbacks used: `DrawMe`, `IsEnabled`, `UpdateUI`
- Behavior during: idle, playback, render, modal dialog, document switch, document close, macOS/Windows sleep, app restore
- Keep-alive: explicit user opt-in, safe disable, documented invariants

### 3.2 Polling Invariants
- **No UI-blocking**: Polling must return within 1ms
- **Throttled UpdateUI**: ~4Hz max (250ms interval) to prevent CPU spin
- **Graceful degradation**: If `UpdateUI` fails, polling continues via next `DrawMe`/`IsEnabled`
- **Document isolation**: Polling pauses when no document open; resumes on new document

---

## 4. UI Automation Separation

### 4.1 Physical & Logical Separation
- **Lua API automation** (layer/bone/animation tools): Always available, no special permissions
- **UI Automation** (screenshot, mouse, keyboard): Separate feature flag, disabled by default

### 4.2 Default Settings
```
MOHO_MCP_ENABLE_SCREENSHOTS=false
MOHO_MCP_ENABLE_UI_AUTOMATION=false
```

### 4.3 UI Automation Requirements (When Enabled)
- Disabled by default, requires separate permission grant
- Works ONLY with Moho window and process (foreground check)
- Emergency stop hotkey (configurable, default: `Ctrl+Alt+Shift+X`)
- Rate limit: max 10 operations/second
- Detailed audit log: timestamp, operation, coordinates, target element
- No arbitrary coordinates outside Moho window bounds
- No shell commands from user parameters
- Never used instead of available Lua API

### 4.4 Core Product Works Without UI Automation
All professional workflows must function using Lua API only

---

## 5. Verified Tool Matrix (Must Pass Real Moho Pro 14 Tests)

Each tool verified via the 9-step validation:
1. State before operation
2. Command result
3. Visual Moho state
4. Re-read state
5. Save document
6. Re-open document
7. Undo
8. Re-read after Undo
9. Restore backup (if applicable)

| Category | Tools | Verified |
|----------|-------|----------|
| Document | `document_getInfo`, `document_getLayers`, `document_setFrame`, `document_save`, `document_saveAs`, `document_undo` | ❌ NOT TESTED |
| Layer | `layer_getProperties`, `layer_setName`, `layer_setVisibility`, `layer_setTransform`, `layer_create`, `layer_duplicate`, `layer_delete`, `layer_getChildren`, `layer_getBones`, `layer_selectLayer` | ❌ NOT TESTED |
| Bone | `bone_getProperties`, `bone_setTransform`, `bone_selectBone` | ❌ NOT TESTED |
| Animation | `animation_getKeyframes`, `animation_setKeyframe`, `animation_deleteKeyframe`, `animation_getFrameState`, `animation_setInterpolation` | ❌ NOT TESTED |
| Mesh | `mesh_getPoints`, `mesh_getShapes` | ❌ NOT TESTED |
| Batch | `batch_execute` | ❌ NOT TESTED |
| Screenshot | `document_screenshot` (if enabled) | ❌ NOT TESTED |
| Diagnostics | `system_diagnose`, `system_getCapabilities` | ❌ NOT TESTED |

**Test Fixture**: `fixtures/MCP_REAL_TEST.moho` containing:
- Group Layer
- Vector Layer
- Bone Layer with ≥2 bones
- Switch Layer
- Multiple keyframes (48-120 frames)
- Action
- Smart Bone test case
- Test image asset
- Test audio asset
- Safe-to-delete objects
- Expected structural snapshot

**No user project modification during testing**

---

## 6. Platform Testing Matrix

| Platform | Moho Pro 14 | Status |
|----------|-------------|--------|
| macOS Apple Silicon | ✅ Required | NOT TESTED |
| macOS Intel | If available | NOT TESTED |
| Windows 10 | ✅ Required | NOT TESTED |
| Windows 11 | ✅ Required | NOT TESTED |

**Moho 12/13**: Not claimed until real testing. Create compatibility layer + capability detection, mark as `experimental` / `unsupported`.

---

## 7. Professional Workflows (Built on Verified Atomic Tools Only)

Each workflow: dry-run, preview, confirmation, progress events, cancellation, timeout, structured result, recovery plan.

| # | Workflow | Description |
|---|----------|-------------|
| 1 | **Character Rig Assistant** | Analyze character structure → create bone hierarchy → name bones → parent relationships → IK → constraints → binding → validation → preview → rollback |
| 2 | **Smart Bone Workflow** | Verify API availability → create/select Action → create Smart Bone → map angles → preview affected channels → safe key recording → conflict diagnosis |
| 3 | **Lip Sync Workflow** | Import Papagayo/Rhubarb/custom JSON → phoneme mapping → Switch Layer detection → timeline preview → preserve existing keys → create keys → delete only transaction keys → verify result |
| 4 | **Duplicate Layer Tree** | Full hierarchy copy → styles → masks → transforms → animation → actions → references → collision-safe naming |
| 5 | **Batch Render** | Scene queue → quality profiles → output sandbox → progress → cancellation → retry → partial failure handling → result manifest → checksums → disk space check |
| 6 | **Project Diagnostics** | Missing files → broken refs → invalid layers → duplicate names → empty layers → orphan bones → conflicting actions → unsupported effects → oversized images → dangerous absolute paths → render config → portability |

---

## 8. MCP Resources (Professional)

| Resource | Purpose |
|----------|---------|
| `moho://capabilities` | Version matrix, supported features, API availability |
| `moho://project/state` | Current document state summary |
| `moho://project/summary` | Human-readable project overview |
| `moho://diagnostics` | Health check results |
| `moho://security/policy` | Current security config (redacted) |
| `moho://upstream/version` | Moho version, Lua version, plugin version |
| `moho://server/version` | Bridge version, protocol version |
| `moho://tool-registry` | All registered tools with schemas |
| `moho://recent-transactions` | Last N operations with correlation IDs |
| `moho://health` | Live health status |
| `moho://configuration` | Effective config (secrets redacted) |

**Never expose**: secrets, tokens, absolute paths, project content without consent

---

## 9. MCP Prompts (Safe Professional Scenarios Only)

| Prompt | Description |
|--------|-------------|
| `inspect project` | Read-only project analysis |
| `create change plan` | Plan modifications with preview |
| `rig character` | Guided rig creation |
| `prepare lip sync` | Phoneme import & mapping |
| `validate scene` | Diagnostic scan |
| `optimize project` | Cleanup suggestions |
| `prepare render` | Render queue setup |
| `diagnose failure` | Error analysis |

**Prompts never bypass Safety Engine**

---

## 10. Error Taxonomy (Standardized)

Every error: `code`, `message`, `correlationId`, `retryable`, `recoverySuggestion`, `safeDiagnosticDetails`

| Code | Category | Retryable |
|------|----------|-----------|
| `validation_error` | Input invalid | No |
| `permission_denied` | Feature flag off | No |
| `unsupported_capability` | Moho API missing | No |
| `moho_not_running` | App not running | Yes (after start) |
| `plugin_not_loaded` | Lua plugin inactive | Yes (after reload) |
| `no_active_document` | No doc open | Yes (after open) |
| `entity_not_found` | Layer/bone missing | No |
| `stale_execution_plan` | Plan expired | No (replan) |
| `confirmation_required` | Destructive op needs preview | No |
| `ipc_timeout` | No response in time | Yes |
| `ipc_protocol_error` | Wire format mismatch | No |
| `moho_api_error` | Lua handler error | Maybe |
| `operation_partially_completed` | Some batch ops failed | No |
| `rollback_failed` | Undo failed | No (manual) |
| `backup_failed` | Pre-op backup failed | No |
| `render_failed` | Export error | Maybe |
| `ui_automation_disabled` | Feature off | No |
| `path_not_allowed` | Sandbox violation | No |
| `queue_overflow` | Too many pending | Yes (backoff) |
| `version_incompatible` | Protocol mismatch | No |
| `internal_error` | Unexpected | Maybe |

---

## 11. Observability (Structured JSON Logs)

### 11.1 Required Fields
- Log level (trace/debug/info/warn/error)
- Correlation IDs (request → response chain)
- Transaction IDs (batch → individual ops)
- Operation duration (ms)
- Queue depth
- Success/failure counters
- Timeout counters
- Lua handler latency
- IPC latency (poll → response)
- Batch duration
- Render duration
- Backup duration
- Polling delay
- Keep-alive state
- Plugin version
- Moho version
- Platform

### 11.2 Redaction Rules (Never Log)
- Project content
- User audio files
- Images
- Tokens/secrets
- Full prompt text
- PII
- Absolute paths (without redaction)

---

## 12. Diagnostics Bundle Generator

Local command: `moho-mcp diagnostics`
Output: `moho-mcp-diagnostics-<timestamp>.zip` containing:
- Versions (Node, bridge, plugin, Moho, protocol, config schema)
- Config (secrets redacted)
- Last N structured errors
- Health state
- Installed components list
- **No project files without explicit consent**

---

## 13. Offline-First & Telemetry

- Zero internet required for local MCP server + Lua bridge
- Telemetry: opt-in only, disabled by default
- Enterprise: `MOHO_MCP_NO_OUTBOUND_TRAFFIC=true` blocks all egress

---

## 14. Configuration System

| Layer | Purpose |
|-------|---------|
| `.env` | Development only |
| `~/.config/moho-mcp/config.yaml` | Production user config |
| Schema validation | Zod/JSON Schema on load |
| Safe defaults | All security features ON |
| Migration | Auto-migrate with backup |
| `moho-mcp doctor --config` | Diagnostics |
| Env var docs | Every critical param documented |
| Unknown critical params | Rejected at startup |
| Redaction in logs | Automatic for sensitive keys |

---

## 15. CLI Surface

| Command | Description |
|---------|-------------|
| `moho-mcp doctor` | Full health check |
| `moho-mcp install` | Install Lua plugin + bridge |
| `moho-mcp uninstall` | Clean removal |
| `moho-mcp start` | Start bridge (background) |
| `moho-mcp inspect` | Show capabilities, config |
| `moho-mcp test-ipc` | IPC round-trip test |
| `moho-mcp test-live` | Live Moho integration test |
| `moho-mcp backup` | Create project backup |
| `moho-mcp restore` | Restore from backup |
| `moho-mcp logs` | View structured logs |
| `moho-mcp capabilities` | Show capability matrix |
| `moho-mcp version` | Version info |
| `moho-mcp update` | Check/apply updates |
| `moho-mcp rollback-update` | Rollback to previous |

**Exit codes**: 0=success, 1=error, 2=config, 3=permission, 4=not-found, 5=version-mismatch
**Modes**: JSON (`--json`) and human-readable

---

## 16. Installers (Professional Grade)

### 16.1 macOS
- Auto-detect Moho Pro 14 (standard locations + `mdfind`)
- **Platform-specific script folder discovery**: do NOT hardcode `~/Library/Application Support/Smith Micro/Moho/14/Scripts/`. Discover the script directory through verified Moho APIs when available; otherwise use documented platform-specific candidate paths with validation.
- No root required unless system-wide
- File verification (checksums)
- Backup existing installation
- Uninstall script
- Apple Silicon + Intel universal
- Code signing (Developer ID)
- Notarization ready
- Gatekeeper-friendly (no quarantine bypass)
- Accessibility permission check (only if UI automation enabled)

### 16.2 Windows
- Auto-detect Moho (registry + standard paths)
- **Platform-specific script folder discovery**: do NOT hardcode `%LOCALAPPDATA%\Smith Micro\Moho\14\Scripts\`. Discover the script directory through verified Moho APIs when available; otherwise use documented platform-specific candidate paths with validation.
- MSI or signed EXE
- Backup + uninstall via Add/Remove Programs
- Upgrade + rollback
- Windows 10/11
- SmartScreen ready
- Long path support (`\\?\` prefix)
- User-level install (no admin if possible)

### 16.3 Installer Requirements
- Show license
- Show upstream attribution (Moho, Lost Marble, etc.)
- Show privacy settings
- Create initial config
- Verify Node/runtime
- Install bridge + Lua plugin
- Run self-test
- No silent system modifications
- Silent mode for enterprise (`/quiet` or `--silent`)
- Generate installation report

### 16.4 Self-Contained Runtime
**Decision required**: Compare and choose:
- Bundled Node.js (via `pkg`/`sea`/`ncc`)
- Native launcher (Rust/Go/Zig) calling bundled bridge
- **Selection criteria**: Reproducibility, update support, bundle size, startup latency

---

## 17. Versioning & Compatibility Matrix

| Component | Versioning | Notes |
|-----------|------------|-------|
| MCP Server | SemVer | Independent |
| Lua Plugin | SemVer | Independent |
| IPC Protocol | SemVer | Wire format |
| Config Schema | SemVer | Breaking = major |
| Tool Registry | SemVer | Additive = minor |
| Installer | SemVer | Platform-specific |

**Compatibility Matrix**: Documented in `COMPATIBILITY_MATRIX.md`

---

## 18. Update System

| Feature | Requirement |
|---------|-------------|
| Channels | Stable, Beta |
| Manual offline | Signed package + manifest |
| Signed manifest | Ed25519 / ECDSA |
| SHA-256 checksums | Every artifact |
| Release signature | Verified before install |
| Rollback | One-click to previous |
| Migration preview | Dry-run before apply |
| Config backup | Automatic |
| Lua plugin backup | Automatic |
| Compatibility check | Refuse if Moho version unsupported |
| No auto-update during ops | Block if queue non-empty |

**Never load/execute without signature + checksum verification**

---

## 19. Dependency Management

- Exact versions pinned (no `^`, `~`, `latest`, unverified prerelease)
- Lockfile committed (`package-lock.json`)
- Required scripts:
  - `npm ci`
  - `npm run build`
  - `npm run typecheck` (`tsc --noEmit`)
  - `npm run lint`
  - `npm test`
  - Dependency audit (`npm audit` / `osv-scanner`)
  - Secret scanning (`trufflehog` / `gitleaks`)
  - License scanning (`license-checker`)
  - SBOM generation (`cyclonedx` / `syft`)
  - Reproducible build verification
  - Artifact checksums

- `esbuild` for fast production build; **not a replacement** for `tsc --noEmit`
- No `skipLibCheck`, `any`, `@ts-ignore`, or disabled strict mode without documented debt entry
- Technical debt budget: max 5 justified exceptions, tracked in `DEBT_REGISTRY.md`

---

## 20. Test Matrix

### 20.1 Unit Tests
- Schemas (Zod)
- Permissions (feature flags)
- Safety Engine (whitelist, previewHash)
- Preview hash verification
- Project revision tracking
- TTL expiration
- Path sandbox
- Config validation
- Error taxonomy
- Logging + redaction

### 20.2 Contract Tests
- Every MCP tool (schema, response shape)
- Every MCP resource (URI, content)
- Every MCP prompt (args, template)
- Aliases
- Structured errors
- Capability filtering

### 20.3 IPC Integration Tests
- Full request/response lifecycle
- Atomic writes (tmp → rename)
- Lock acquisition/release
- Cleanup on crash
- Crash recovery (orphaned files)
- Concurrency (multiple clients)
- Cancellation
- Timeouts

### 20.4 Lua Tests
- JSON serialization/deserialization
- Protocol parsing
- Handler dispatch
- Error conversion
- File operations (sandbox)
- Capability detection

### 20.5 Security Tests
- Arbitrary method injection
- Lua code injection
- Shell injection
- Path traversal
- Symlink/junction escape
- Replay attack
- Forged previewHash
- Stale revision
- Batch privilege bypass
- Oversized payload
- Log injection
- Malicious filenames

### 20.6 Failure Injection Tests
- Moho crash mid-operation
- Node crash mid-write
- Disk full (ENOSPC)
- Permissions revoked mid-session
- Response lost (network/FS)
- Lock corruption
- Plugin version mismatch
- Incompatible protocol
- Partial workflow failure
- Backup failure
- Undo failure

### 20.7 Performance Tests (Report p50/p95/p99) — **PROVISIONAL / NOT VALIDATED**
| Scenario | Target |
|----------|--------|
| 1 sequential read | < 100ms |
| 10 sequential reads | < 500ms |
| 50 sequential reads | < 2s |
| 100 sequential reads | < 4s |
| Batch 10 ops | < 500ms |
| Batch 50 ops | < 2s |
| Batch 100 ops | < 4s |
| Large project (1000+ layers) | < 1s for getLayers |
| Deep layer tree (50 depth) | < 1s |
| 500+ keyframes | < 1s |
| Large mesh (10k points) | < 2s |
| Long render (60s+) | Progress events |
| Idle polling (1hr) | < 1% CPU |
| Queue pressure (100 pending) | < 5s drain |

**No invented numbers. Measure and report.**

---

## 21. MCP Inspector Verification

- Initialization handshake
- Tool listing (all schemas valid)
- Resources listing
- Prompts listing
- Capability negotiation
- Concurrent calls (10 parallel)
- Cancellation propagation
- Timeout handling
- Graceful shutdown
- Malformed input handling
- **stdio purity**: stdout = MCP protocol only; all logs → stderr/files

---

## 22. Real E2E Test Runner

- CLI sends test sequence to running Moho Pro
- **Proof = actual Moho processing + actual project changes**
- No GUI automation substitutes
- Artifacts preserved per test:
  - Exact Moho version
  - Platform
  - Server version
  - Plugin version
  - Protocol version
  - Git commit
  - Request/response JSON
  - Correlation IDs
  - Timestamps
  - Latency
  - Screenshots
  - Project snapshots
  - Render outputs
  - Checksums
  - Undo result
  - Backup restoration result

### 22.1 `REAL_MOHO_TEST_REPORT.md` Rules
- Only real data
- `NOT EXECUTED` if not run
- **Zero mock data in real results**

---

## 23. Quality Gates (Production Release Blocked If)

- [ ] Critical/High security finding exists
- [ ] `tsc --noEmit` fails
- [ ] Any test fails
- [ ] MCP Inspector reports errors
- [ ] Lua plugin fails to load
- [ ] Base read/write tools not verified in real Moho
- [ ] Destructive recovery (Undo/backup) not proven
- [ ] Installer not reproducible
- [ ] No Windows test
- [ ] Mock handlers in production code
- [ ] Unjustified TODO/FIXME
- [ ] Licenses unverified
- [ ] No rollback update mechanism
- [ ] Documentation ≠ code behavior

---

## 24. SLOs (Measured, Not Marketing) — **PROVISIONAL / NOT VALIDATED**

| SLO | Target | Measurement |
|-----|--------|-------------|
| Read operation success rate | ≥ 99.9% | 30-day rolling |
| Write operation success rate | ≥ 99.5% | 30-day rolling |
| IPC timeout rate | < 0.1% | 30-day rolling |
| Crash-free sessions | ≥ 99.9% | 30-day rolling |
| Destructive op recovery | 100% (tested) | Per release |
| Installer success rate | ≥ 99% | Per release |
| Update rollback success | 100% | Per release |

---

## 25. Large Project Optimization

**Never**: Read entire project, serialize huge state per request

**Implement**:
- Pagination (`limit`, `cursor`)
- Depth limits (`maxDepth`)
- Field selection (`fields`)
- Incremental state (`sinceRevision`)
- Revision-based caching (ETag/If-None-Match)

---

## 26. Cancellation & Progress Notifications

Long operations (`batch_execute`, render, diagnostics, deep inspection, large duplication, workflows) must:
- Emit progress notifications (MCP `notifications/progress`)
- Accept cancellation (`CancellationToken` / abort signal)
- Clean up partial state on cancel

---

## 27. Commercial UX Requirements

### 27.1 User-Facing (No Manual JSON Editing)
- Clear onboarding flow
- Installer with guided setup
- Connection status indicator
- Moho plugin status
- Server status
- Capabilities panel
- Security settings
- Allowed directories management
- Screenshots toggle
- UI automation toggle
- Test connection button
- Diagnostics button
- Logs viewer
- Updates panel
- Backup settings

### 27.2 Fallback: Local Read-Only Web Panel
If full UI too risky:
- localhost-only binding (random port)
- CSRF token
- Random session token
- No external access (never `0.0.0.0`)
- Read-only (no mutations)

---

## 28. Enterprise Readiness

| Requirement | Implementation |
|-------------|----------------|
| Offline deployment | Self-contained installer |
| Proxy support | Configurable HTTP_PROXY |
| No-telemetry mode | `MOHO_MCP_NO_OUTBOUND_TRAFFIC=true` |
| Central config | `/etc/moho-mcp/config.yaml` (system) + user overlay |
| Policy file | `policy.yaml` (disabled tools, max batch, paths) |
| Allowed tools policy | Whitelist/blacklist by tool name |
| Disabled UI automation | Enforced by default |
| Deterministic logs | Structured JSON, fixed fields |
| Audit export | `moho-mcp audit-export --since <date>` |
| Reproducible installer | Fixed versions, checksums, signatures |
| SBOM | CycloneDX JSON |
| Third-party notices | `THIRD_PARTY_NOTICES.md` |
| License inventory | `LICENSES.md` |
| Security contact | `security@` in `SECURITY.md` |
| Vulnerability disclosure | `VULNERABILITY_DISCLOSURE.md` |
| Backup/restore docs | `BACKUP_AND_RECOVERY.md` |
| Update rollback | `moho-mcp rollback-update` |
| LTS strategy | Documented in `SUPPORT_POLICY.md` |

---

## 29. Documentation Suite (All Must Match Code Behavior)

| File | Purpose |
|------|---------|
| `README.md` | Quick start, badges, links |
| `QUICK_START.md` | 5-minute setup |
| `INSTALLATION.md` | Platform-specific install |
| `UNINSTALLATION.md` | Clean removal |
| `USER_GUIDE.md` | Daily usage |
| `ADMIN_GUIDE.md` | Enterprise deployment |
| `CLI_REFERENCE.md` | All commands |
| `CLIENT_INTEGRATION.md` | Claude, Cursor, Gemini, etc. |
| `ARCHITECTURE.md` | System design |
| `IPC_PROTOCOL.md` | Wire format, versioning |
| `TOOL_REGISTRY.md` | All tools with examples |
| `SECURITY.md` | Threat model, mitigations |
| `THREAT_MODEL.md` | STRIDE analysis |
| `PRIVACY.md` | Data handling |
| `UPSTREAM.md` | Moho API references |
| `UPSTREAM_COMPARISON.md` | vs other bridges |
| `THIRD_PARTY_NOTICES.md` | Attributions |
| `LICENSES.md` | License texts |
| `CAPABILITY_MATRIX.md` | Feature × Moho version |
| `COMPATIBILITY_MATRIX.md` | Version compatibility |
| `BACKUP_AND_RECOVERY.md` | Procedures |
| `TROUBLESHOOTING.md` | Common issues |
| `REAL_MOHO_TEST_REPORT.md` | **Real data only** |
| `SIMULATED_E2E_TEST_REPORT.md` | Simulated runs |
| `PERFORMANCE_REPORT.md` | p50/p95/p99 |
| `SECURITY_AUDIT_REPORT.md` | Findings |
| `RELEASE_READINESS.md` | Gate status |
| `CHANGELOG.md` | Per version |
| `SUPPORT_POLICY.md` | SLA, LTS |
| `VULNERABILITY_DISCLOSURE.md` | Process |

**Forbidden**: Documenting missing features as implemented

---

## 30. Commercial Product Specification

### 30.1 Target Audience
- Independent animators (solo)
- Small studios (2-10)
- Large studios (10+)
- Technical directors
- Pipeline engineers

### 30.2 Use Cases
- Rigging automation
- Batch scene processing
- Pipeline integration (render farm, asset management)
- Automated QC/diagnostics
- Lip-sync pipeline
- Version control integration

### 30.3 Editions
| Edition | Price | Features |
|---------|-------|----------|
| Community | Free | Core tools, 1 concurrent, no workflows |
| Professional | $XX/mo | Workflows, batch render, diagnostics, priority support |
| Studio | $XX/mo/seat | Team config, central policy, audit, SLA |
| Enterprise | Custom | Air-gapped, custom plugins, dedicated support |

### 30.4 Licensing
- Offline activation (challenge/response)
- Grace period for connectivity loss
- Emergency license recovery (signed token)
- **No aggressive DRM** that endangers projects

### 30.5 Support Cost Analysis
Identify top support drivers → add diagnostics, self-healing, clear errors, docs

### 30.6 UX Audit Perspectives
- Independent animator
- Small studio
- Large studio
- Technical director
- SysAdmin
- Security specialist
- Non-terminal user

---

## 31. Demo Package (Not a Product Substitute)

| Item | Description |
|------|-------------|
| Safe test project | `fixtures/MCP_REAL_TEST.moho` |
| Professional scenarios | 5+ pre-built workflows |
| Client integration guide | Claude, Cursor, Gemini, etc. |
| Dry-run demo | Preview without changes |
| Preview demo | Hash-bound preview |
| Backup demo | Create + restore |
| Undo demo | Operation → undo → verify |
| Diagnostics demo | Scan → report |
| Batch render demo | Queue → render → manifest |

**No unlicensed assets, voices, or protected content**

---

## 32. Independent Audit (Pre-Release)

| Auditor | Focus |
|---------|-------|
| 1 | Moho API correctness |
| 2 | MCP protocol compliance |
| 3 | IPC security |
| 4 | macOS specifics |
| 5 | Windows specifics |
| 6 | Installer + updater |
| 7 | Licenses + supply chain |
| 8 | Commercial UX |
| 9 | Disaster recovery |
| 10 | Hostile final review |

**Finding format**: ID, severity, component, evidence, reproduction, impact, remediation, test, status

**No finding closed without test**

---

## 33. Release Readiness Verdicts (Single Value)

| Status | Criteria |
|--------|----------|
| `Experimental Prototype` | Code exists, not tested |
| `Functional Alpha` | **Current** - basic tools work in real Moho |
| `Verified Beta` | All atomic tools verified, workflows draft |
| `Production Candidate` | All workflows verified, installer tested both platforms |
| `Production Ready` | **+** Real Moho Pro 14 verified, basic tools confirmed, Undo/backup proven, MCP Inspector clean, security audit passed, installer tested macOS+Windows, no Critical/High findings, docs match code |
| `Enterprise Ready` | **+** Reproducible signed builds, signed installer, update rollback, offline deploy, SBOM, license inventory, corp policy mode, audit export, support docs, recovery drills, soak tests, confirmed SLOs, final commercial audit |

---

## 34. Stage Execution Protocol

After each major stage:
1. Create intermediate report:
   - What changed
   - Files modified
   - Commits
   - Tests run
   - Real results
   - Issues found
   - Remaining risks
   - Current readiness status
2. Commit: `stage-NN: <title>`
3. Run: `npm run typecheck && npm run build && npm test`
4. Update `MASTER_EXECUTION_PLAN.md` status column
5. Update `CHANGELOG.md`

---

## 35. Forbidden Patterns (Zero Tolerance)

- `TODO` / `FIXME` in production code
- Mock handlers in production
- Empty success responses
- Disabled security checks
- Unjustified `any` / `@ts-ignore` / `skipLibCheck`
- Undocumented shell commands
- Floating dependencies
- Unverified compatibility claims
- "Fully complete" while gates fail
- Hidden limitations
- Mock tests replacing real tests
- Fabricated metrics/screenshots/reviews/Moho data

---

## 36. Honest Limitation Handling

If Moho Lua API cannot support a feature:
1. Document limitation in `CAPABILITY_MATRIX.md`
2. Disable corresponding tool (return `unsupported_capability`)
3. Provide safe alternative (workflow using available APIs)
4. **Never** simulate via hidden UI automation

---

## 37. Final Deliverables Checklist

| # | Deliverable | Status |
|---|-------------|--------|
| 1 | Working commercial MCP server | 🟡 In Progress |
| 2 | Real Lua plugin for Moho Pro 14 | 🟡 In Progress |
| 3 | Hardened file IPC | 🟡 In Progress |
| 4 | Safety Engine | 🟡 In Progress |
| 5 | Permission Engine | 🟡 In Progress |
| 6 | Dry-run + previewHash | 🟡 In Progress |
| 7 | Backup, Undo, recovery | 🟡 In Progress |
| 8 | Verified atomic tools | ❌ Not Started |
| 9 | Professional workflows | ❌ Not Started |
| 10 | Diagnostics | 🟡 In Progress |
| 11 | macOS installer | ❌ Not Started |
| 12 | Windows installer | ❌ Not Started |
| 13 | Updater + rollback | ❌ Not Started |
| 14 | CLI | 🟡 Partial |
| 15 | Config UI / Local panel | ❌ Not Started |
| 16 | Full test suite | 🟡 Partial |
| 17 | Real Moho test reports | ❌ Not Started |
| 18 | MCP Inspector report | ❌ Not Started |
| 19 | Security audit | ❌ Not Started |
| 20 | Performance report | ❌ Not Started |
| 21 | SBOM | ❌ Not Started |
| 22 | Third-party notices | ❌ Not Started |
| 23 | Complete documentation | 🟡 Partial |
| 24 | Demo package | ❌ Not Started |
| 25 | Release artifacts | ❌ Not Started |
| 26 | Honest readiness verdict | ❌ Not Started |

---

## 38. Immediate Next Steps (Stage 0)

1. **Audit current IPC**: Replace linear ID scan with directory listing + cursor in `moho_mcp/server.lua`
2. **Add dead-letter directory** for poison requests
3. **Add health file** (`health.json`) with atomic writes
4. **Document polling invariants** in `ARCHITECTURE.md`
5. **Create `HANDLER_SOURCES.md`** mapping every Lua handler to verified source
6. **Disable UI automation by default** (already done via config)
7. **Fix `protocolVersion` mismatch**: Bridge sends `1`, Lua expects `1` (verify)
8. **Run `npm run typecheck && npm run build && npm test`** - fix all failures

---

*This plan is a living document. Update after every stage commit. Never mark complete without evidence.*