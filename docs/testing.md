# Testing

This guide covers running automated tests, using the example app, and manual
on-device testing.

## Automated tests (Jest)

```sh
yarn test              # run all Jest suites (37 tests, 2 suites)
yarn test --watch      # watch mode
yarn test --coverage   # with coverage report
```

Tests live in `__tests__/` directories alongside the source files. The Jest
preset is `react-native`.

## Type checking & linting

```sh
yarn typecheck   # TypeScript type-checking (tsc)
yarn lint        # ESLint across all JS/TS/TSX files
yarn lint --fix  # auto-fix formatting issues
```

Both run as pre-commit hooks via Lefthook.

## Library build

```sh
yarn prepare     # build JS with react-native-builder-bob → lib/
```

Verifies that the TypeScript compiles and the codegen spec generates correctly.

## Example app

The example app at `example/` is a Yarn workspace that consumes the local
library via workspace resolution. It demonstrates every feature.

```sh
yarn example start     # start Metro packager
yarn example android   # build and run on connected Android device / emulator
```

### Example app examples

The example app demonstrates:

| Screen | What it tests |
|---|---|
| Basic volume | `onKeyDown` / `onKeyUp` for volume keys |
| Long press | `onLongPress` with configurable timeout |
| Multi-listener | Two independent hooks for different key sets |
| Enable/disable toggle | `enabled` prop with a Switch |
| Supported keys | `useSupportedKeyCodes` display |
| Imperative API | `registerHardwareKeyEvent` outside React |

## On-device testing checklist

Run through these scenarios on a real Android device before releasing:

### Basic functionality

- [ ] Volume up press fires `onKeyDown` with `action: "down"` and correct `keyCodeString`
- [ ] Volume up release fires `onKeyUp` with `action: "up"`
- [ ] Volume down press/release behaves symmetrically
- [ ] `repeatCount` increments correctly while a key is held

### Long press

- [ ] Holding a key for > `longPressTimeout` ms fires `onLongPress` exactly once
- [ ] Releasing before the timeout does **not** fire `onLongPress`
- [ ] Changing `longPressTimeout` updates the threshold on the next registration
- [ ] Rapid key taps do not trigger long-press

### Multi-listener

- [ ] Two hooks with different key sets each receive only their own events
- [ ] Two hooks with overlapping key sets both receive the overlapping events
- [ ] Unregistering one hook does not affect the other
- [ ] Registration order matches interceptor chain order (first-registered receives events first)

### Lifecycle

- [ ] Putting the app in the background and returning preserves listeners
- [ ] Rotating the device (Activity recreation) preserves listeners
- [ ] Navigating to a new Activity and pressing back preserves listeners
- [ ] No crash when the Activity is destroyed while a key is held

### Edge cases

- [ ] `enabled=false` suppresses all event delivery; `enabled=true` resumes it
- [ ] Empty `keys: []` does not register a listener
- [ ] Unregistering an already-unregistered listener is a safe no-op
- [ ] Rapid register/unregister cycling does not leak listeners or crash
- [ ] Killing the app while a listener is registered does not leave the audio session active (iOS)
- [ ] `useSupportedKeyCodes` returns a non-empty array on the test device

### Platform-specific

#### Android

- [ ] App launches without `HardwareKeyListenerActivity` (plain `ReactActivity`)
- [ ] No crash when `newArchEnabled=false` (library is inert, not a hard crash)
- [ ] Works on API 24+ (Android 7.0)
- [ ] Works on a device with an OEM-rom that may block reflection (KeyCodeMapper guards against this)

#### iOS

- [ ] Volume up/down triggers `onKeyDown` (iOS only emits down, no up)
- [ ] System volume HUD is suppressed when a listener is registered
- [ ] Audio session is deactivated when all listeners are unregistered
- [ ] Interruption (phone call) fires an error event via `action: "error"`
- [ ] Media services reset re-establishes observation

### Performance

- [ ] Key events are delivered without perceptible latency (< 50ms)
- [ ] `getSupportedKeyCodes` returns in under 200ms on a cold call
- [ ] Memory does not grow with repeated register/unregister cycles
