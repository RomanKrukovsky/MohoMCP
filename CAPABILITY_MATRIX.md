# Capability & Version Matrix (`CAPABILITY_MATRIX.md`)

This matrix details supported Moho animation software features and their target version capabilities.

---

## Capability Matrix

| Feature Area | Moho Pro 14 (Target Base) | Moho Pro 13 (Legacy) | Moho Pro 12 (Legacy) | API Implementation Level | Status in MohoMCP |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Document Query** | Fully Supported | Experimental | Unsupported | Level 1 Safe Lua API | Verified |
| **Layer Tree & Props** | Fully Supported | Supported | Supported | Level 1 Safe Lua API | Verified |
| **Bone Transform & Props** | Fully Supported | Supported | Supported | Level 1 Safe Lua API | Verified |
| **Animation Keyframes** | Fully Supported | Supported | Supported | Level 1 Safe Lua API | Verified |
| **Mesh Vector Inspection** | Fully Supported | Supported | Supported | Level 1 Safe Lua API | Verified |
| **Batch Operation Dispatch** | Fully Supported | Supported | Supported | Level 1 Safe Lua API | Verified |
| **Window Capture** | Fully Supported | Supported | Supported | Level 2 UI Automation | Opt-In Only |
| **Mouse / Keyboard Input** | Fully Supported | Supported | Supported | Level 2 UI Automation | Opt-In Only |
| **Composite Workflows** | Fully Supported | Experimental | Unsupported | Enterprise Planning Layer | Verified |

---

## Target Version Policy

- **Moho Pro 14 (Lua 5.4)**: Officially supported and fully verified canonical base.
- **Moho Pro 12 / 13 (Lua 5.2 / 5.3)**: Marked as `experimental` or `unsupported` until verified with dedicated capability adapters.
