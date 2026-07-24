# Third-Party Notices & Attribution

This repository incorporates open-source software under the terms of their respective licenses.

---

## 1. Upstream Project: MohoMCP

- **Original Project**: [MohoMCP](https://github.com/Kveto/MohoMCP)
- **Author**: Kveto / MohoMCP Project
- **License**: MIT License (see `LICENSE` file)
- **Upstream Repository URL**: `https://github.com/Kveto/MohoMCP.git`
- **Upstream Commit SHA**: `d592a572d80d0de292b2b9c5866bdd0f058f8fd4`
- **Integration Branch**: `integration/mohomcp-enterprise`

### Modified / Enhanced Files

| File Path | Original Status | Description of Enterprise Modifications |
| :--- | :--- | :--- |
| `bridge/src/moho-client.ts` | Upstream | Added atomic file rename (`.tmp -> .json`), request TTL, lock file single-consumer checks, queue bounds, payload size limit, symlink sandbox, correlation IDs, and `protocolVersion: "1.1.0"`. |
| `bridge/src/tools.ts` | Upstream | Hardened all 26 canonical tools with `MohoSafetyEngine`, added Zod validation, composite workflow tools, diagnostic tools, and legacy alias handlers. |
| `bridge/src/config.ts` | Upstream | Added `protocolVersion`, `maxQueueSize`, `maxJsonSizeBytes`, `requestTtlMs`, and `enableUiAutomation` flag. |
| `bridge/src/platform-input.ts` | Upstream | Added Level 2 UI Automation security guard enforcing explicit opt-in (`ENABLE_UI_AUTOMATION=true`). |
| `bridge/src/platform-capture.ts` | Upstream | Added Level 2 UI Automation security guard enforcing explicit opt-in (`ENABLE_UI_AUTOMATION=true`). |
| `bridge/src/resources.ts` | Upstream | Added dynamic resources: `moho://capabilities`, `moho://project/state`, `moho://diagnostics`, `moho://upstream/version`, `moho://security/policy`. |
| `install-plugin.sh` | Upstream | Added installer notice regarding Level 2 UI Automation permissions. |
| `install-plugin.bat` | Upstream | Added installer notice regarding Level 2 UI Automation permissions. |

---

## 2. Lua JSON Library: json.lua

- **File**: `moho-plugin/json.lua`
- **Author**: Jeffrey Friedl
- **License**: MIT License / Public Domain
- **Notice**: Embedded Lua JSON parser for Moho Lua runtime compatibility. Copyright notices retained in header.

---

## 3. Node.js NPM Dependencies

All npm dependencies installed in `bridge/package.json` are pinned to exact versions:
- `@modelcontextprotocol/sdk`: MIT License
- `zod`: MIT License
- `vitest`: MIT License
- `typescript`: Apache-2.0 License

---

## License Text (MohoMCP - MIT License)

```
MIT License

Copyright (c) 2024 MohoMCP Project

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR A PARTICULAR PURPOSE AND OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
