# Documentation

This directory holds the full documentation for `react-native-hardwarekey-event`.
The README at the repo root is the entry point; files here go deeper.

## Documentation inventory

| File | Audience | Status | Content |
|---|---|---|---|
| `api-reference.md` | Consumers | ✅ done | Every export with signatures, options, return types, and edge cases |
| `architecture.md` | Contributors | ✅ done | Native interceptor chain, JS layer, data flow, multi-listener design |
| `keycodes.md` | Consumers | ✅ done | All 51 `KeyCode` constants with numeric values, labels, categories |
| `android-setup.md` | Consumers | ✅ done | New-architecture requirements, auto-install, troubleshooting |
| `ios.md` | Consumers | ✅ done | Current state (volume-only KVO), limitations, future direction |
| `testing.md` | Contributors | ✅ done | Jest suite, example app, on-device testing checklist |

## Existing root-level docs (do not duplicate)

| File | Covers |
|---|---|
| `../README.md` | Landing page — install, quick-start, feature list, links to docs/ |
| `../MIGRATION.md` | 0.0.x → 1.0.0 step-by-step guide, breaking changes, codemod ideas |
| `../CHANGELOG.md` | Per-version changes (keep-a-changelog format) |
| `../CONTRIBUTING.md` | Dev workflow, commit conventions, PR process |
| `../LICENSE` | MIT |
| `../CLAUDE.md` | AI-assistant guidance (architecture overview, commands, structure) |

## File details

### `api-reference.md`

Comprehensive reference for every public export from the package:

- **`useHardwareKeyEvent(options)`** — full `UseHardwareKeyEventOptions` table, return value, lifecycle diagram, cancellation semantics, `enabled` toggle behavior, `keyFingerprint` dedup logic
- **`registerHardwareKeyEvent(options)`** — imperative API, Promise lifecycle, `unregister()` idempotency, non-React usage patterns
- **`useSupportedKeyCodes()`** — return value, loading state, error behavior, filtering of unknown codes
- **`KeyEvent`** — every field with type, Android source, and meaning
- **`KeyCodeInfo`** — fields returned by `getSupportedKeyCodes()`
- **`KeyCode` enum & utilities** — `isKeyCode()`, `keyCodeToName()`, `ALL_KEY_CODES`, the `KeyCode` type
- **`HardwareKeyEvent` (TurboModule)** — direct native module methods for advanced/vanilla-JS use

### `architecture.md`

Human-readable architecture doc (complements the AI-focused `CLAUDE.md`):

- **Data flow diagram** (text/ASCII): JS `registerListener` → Native module → interceptor chain → `Window.Callback` → KeyEvent → emitter → JS `onKeyEvent`
- **Android native layer**
  - `KeyCodeMapper` — static reflection at class-load, thread-safe maps
  - `KeyEventInterceptor` — `Window.Callback` wrapper, chain delegation, error guard
  - `HardwareKeyListenerModule` — TurboModule, `LinkedHashMap` registrations, chain rebuild
  - `HardwareKeyEventLifecycleObserver` — auto-install on Activity create/destroy/resume
  - `HardwareKeyEventPackage` — registration, double-checked locking
- **JS layer**
  - `NativeHardwareKeyEvent.ts` — TurboModule spec + codegen contract
  - `useHardwareKeyEvent.ts` — hook, long-press state machine, stable refs, fingerprint dedup
  - `keycodes.ts` — const object, type guard, reverse lookup
  - `backcompat/` — compat shim internals
- **iOS layer** — KVO-based volume observation, singleton, dual-architecture emission
- **Multi-listener design** — why `LinkedHashMap`, why per-listener interceptor, how events fan-out

### `keycodes.md`

Quick-reference table of all 51 supported key codes:

| Constant | Android value | Category | Typical device |
|---|---|---|---|
| `KeyCode.VOLUME_UP` | `KEYCODE_VOLUME_UP` | Volume | All |
| ... | ... | ... | ... |

Grouped by category: Volume, Navigation/System, Call, Camera, Power/Wake, Media, D-Pad, Channel/Program, Text Navigation, Basic Input, TV/Set-top box, Assistants, Zoom.

### `android-setup.md`

- New Architecture requirement (`newArchEnabled=true` in `gradle.properties`)
- Why no Activity inheritance is needed
- How `Window.Callback` auto-install works
- Minimum SDK version, compile SDK
- ProGuard / R8 notes (if any)
- Common issues: `newArchEnabled` not set, conflicting `Window.Callback` wrappers, key events not firing

### `ios.md`

- Current state: volume up/down only via `AVAudioSession.outputVolume` KVO
- `MPVolumeView` HUD suppression technique
- Audio session interruption handling
- Why full hardware key support isn't possible on iOS (no public API for non-volume keys)
- Codegen spec conformance status
- What a future iOS contributor would need to do

### `testing.md`

- Running Jest: `yarn test`
- Test structure: `__tests__/` directories
- Example app: `yarn example start` + `yarn example android`
- On-device testing checklist:
  - Volume keys fire events
  - Long-press fires after timeout
  - Multiple listeners coexist
  - `enabled=false` suppresses events
  - App background/foreground preserves listeners
  - Activity recreation (rotate) preserves listeners
  - No crash on rapid register/unregister
- Manual test scenarios for the example app examples
