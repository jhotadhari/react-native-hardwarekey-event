# Architecture

This document describes the internal architecture of `react-native-hardwarekey-event`
for contributors. It complements [`CLAUDE.md`](../CLAUDE.md), which covers the same
ground for AI assistants.

## Overview

```
┌──────────────────────────────────────────────────────────┐
│ JS layer (React / TypeScript)                            │
│                                                          │
│  useHardwareKeyEvent()  ←  registerHardwareKeyEvent()    │
│         │                        │                       │
│         ▼                        ▼                       │
│  NativeHardwareKeyEvent.ts  (TurboModule spec)           │
│         │                                                │
│  ─ ─ ─ ─│─ ─ JSI / Bridge  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
│         ▼                                                │
│  HardwareKeyListenerModule.kt  (TurboModule impl)        │
│         │                                                │
│         ▼                                                │
│  KeyEventInterceptor.kt  (Window.Callback chain)         │
│         │                                                │
│         ▼                                                │
│  Activity.window.callback  ←  original Window.Callback   │
└──────────────────────────────────────────────────────────┘
```

### Data flow: a key press

1. Android dispatches a `KeyEvent` to the Activity's `Window.Callback`.
2. The outermost `KeyEventInterceptor` receives `dispatchKeyEvent(event)`.
3. It looks up the key code string via `KeyCodeMapper.getKeyCodeString()` (O(1)).
4. If the key code matches the interceptor's registered set, it fires
   `emitter.onKeyEvent()` to the module and delegates to the next callback in
   the chain so other listeners also receive the event.
5. The module builds a `WritableMap` with the full event payload and calls
   `emitOnKeyEvent(payload)` — the codegen-generated emitter.
6. The event crosses the bridge/JSI to JS, where the shared `onKeyEvent`
   stream delivers it to every subscription.
7. Each subscription filters by `listenerId` and invokes its callbacks.

---

## Android native layer

### `KeyCodeMapper` (Java)

**File:** `android/src/main/java/…/KeyCodeMapper.java`

Static utility that builds bidirectional lookup tables **once** at class-load
time by reflecting over `android.view.KeyEvent` fields.

```
KeyEvent.class.getFields()
  → filter: name.startsWith("KEYCODE_")
  → filter: type == int.class
  → build: Map<Integer, String>  (keyCode → "KEYCODE_VOLUME_UP")
  → build: Map<String, Integer>  ("KEYCODE_VOLUME_UP" → keyCode)
  → build: List<String>          all supported constant names
```

- **Thread safety:** all collections are wrapped in `Collections.unmodifiable*`
  and populated during static initialization. No locks needed.
- **Resilience:** catches `IllegalAccessException` and `RuntimeException` (e.g.
  OEM `SecurityException`) per-field so one bad field doesn't brick the module.
- **Public API:** `getKeyCodeString(int)`, `getKeyCodeInt(String)`,
  `getSupportedKeyCodes()`.

### `KeyEventInterceptor` (Kotlin)

**File:** `android/src/main/java/…/KeyEventInterceptor.kt`

A `Window.Callback` wrapper that intercepts only `dispatchKeyEvent`. All other
22 `Window.Callback` methods delegate directly to the wrapped callback.

```
┌────────────────────────────┐
│ KeyEventInterceptor        │
│  dispatchKeyEvent() ──┐    │
│  dispatchTouchEvent() ─┼──→ delegate (next in chain)
│  dispatchTrackball()  ─┘    │
│  … (18 more)                │
└────────────────────────────┘
```

**Chain behavior:**

- On match: emits event → delegates to inner chain → returns `true` (consumed).
- On no match: delegates directly and returns whatever the delegate returns.
- The `delegate` reference is `@Volatile` so chain-rebuild writes are visible
  to the UI thread on every `dispatchKeyEvent` invocation.

**Error handling:** The `emitter.onKeyEvent()` call is wrapped in try-catch. If
it throws, `emitter.onError()` is called. If that also throws (dead bridge), the
exception is silently swallowed — there's nothing more to do.

**Decoupling:** The interceptor communicates with the module through an internal
`KeyEventEmitter` interface (`onKeyEvent`, `onError`), not by holding a direct
reference to the TurboModule. This keeps interceptors testable and prevents
accidental retain cycles.

### `HardwareKeyListenerModule` (Kotlin)

**File:** `android/src/main/java/…/HardwareKeyListenerModule.kt`

The TurboModule implementation. Extends the codegen-generated
`NativeHardwareKeyEventSpec` and implements `KeyEventEmitter`.

**State (all guarded by `synchronized(this)`):**

| Field | Type | Purpose |
|---|---|---|
| `registrations` | `LinkedHashMap<String, Set<String>>` | listenerId → set of key code strings |
| `interceptors` | `LinkedHashMap<String, KeyEventInterceptor>` | listenerId → active interceptor |
| `activeActivityRef` | `WeakReference<Activity>?` | Activity currently holding the chain |
| `originalCallback` | `Window.Callback?` | Saved original callback for restoration |

**Why `LinkedHashMap`?** Insertion order is preserved so the interceptor chain
mirrors registration order — the first registration's interceptor is innermost
(closest to the original callback), and the most recent is outermost (set
directly on the Window).

**Chain management:**

- `installOnActivity(activity)` — saves `originalCallback`, builds chain from
  scratch.
- `detachFromActivity(activity)` — restores `originalCallback`, clears
  interceptors.
- `rebuildAndInstall(activity)` — iterates `registrations` in insertion order,
  wrapping the previous callback in a new `KeyEventInterceptor`, atomically
  swaps the chain onto `window.callback`.

**Lifecycle hooks** (called by `HardwareKeyEventLifecycleObserver`):

- `onActivityCreated` — installs chain if registrations are pending.
- `onActivityDestroyed` — detaches chain if the destroyed Activity was the
  active one.
- `onActivityResumed` — reinstalls chain if a new Activity became active (e.g.
  navigation A → B → back to A).

**Key event emission:**

The `onKeyEvent` callback maps Android `KeyEvent` actions to JS strings:

| Android constant | JS `action` |
|---|---|
| `ACTION_DOWN` | `"down"` |
| `ACTION_UP` | `"up"` |
| `ACTION_MULTIPLE` | `"multiple"` |
| anything else | `"unknown"` |

The `onError` callback emits through the same `onKeyEvent` channel with
`action: "error"` and zeroed key event fields.

### `HardwareKeyEventLifecycleObserver` (Kotlin)

**File:** `android/src/main/java/…/HardwareKeyEventLifecycleObserver.kt`

An `Application.ActivityLifecycleCallbacks` implementation registered exactly
once per process. Bridges Android lifecycle events to module hooks:

| Lifecycle callback | Module hook | Behavior |
|---|---|---|
| `onActivityCreated` | `onActivityCreated` | Install chain if registrations pending |
| `onActivityDestroyed` | `onActivityDestroyed` | Detach chain from dying Activity |
| `onActivityResumed` | `onActivityResumed` | Reinstall if chain lost during navigation |
| All others | (no-op) | — |

### `HardwareKeyEventPackage` (Kotlin)

**File:** `android/src/main/java/…/HardwareKeyEventPackage.kt`

Standard React Native package. Registers `HardwareKeyListenerModule` as a
TurboModule (`isTurboModule = true`) and lazily registers the lifecycle
observer exactly once per process.

The lifecycle observer registration uses **double-checked locking** on a
dedicated `observerLock` object (not `synchronized(this)`, which is unreliable
on a `companion object`).

---

## JS layer

### `NativeHardwareKeyEvent.ts`

**File:** `src/NativeHardwareKeyEvent.ts`

Defines the TurboModule spec (`Spec` interface) and retrieves the native module
via `TurboModuleRegistry.getEnforcing<Spec>('HardwareKeyEvent')`.

The spec declares:
- `registerListener(params)` → `Promise<{ listenerId }>`
- `unregisterListener(listenerId)` → `Promise<void>`
- `getSupportedKeyCodes()` → `Promise<KeyCodeInfo[]>`
- `onKeyEvent: EventEmitter<KeyEvent>`

The codegen in `package.json` (`codegenConfig`) points to `src/` and generates
`NativeHardwareKeyEventSpec.java` and `NativeHardwareKeyEventSpec.h` from this
file.

### `useHardwareKeyEvent.ts`

**File:** `src/useHardwareKeyEvent.ts`

The primary consumer API. Contains:

**`createLongPressTracker`** — A state machine decoupled from React:
- On first `down` (repeatCount === 0): starts a timer.
- On `up`: cancels the timer.
- On timer fire: invokes `onLongPress` with the most recent down event.
- On repeat events (repeatCount > 0): does **not** restart the timer.
- `'multiple'` and `'unknown'` actions are deliberately ignored.
- Destroy clears all outstanding timers.

**`useHardwareKeyEvent` hook:**
- Uses refs for callback stability (`onKeyDownRef`, `onKeyUpRef`,
  `onLongPressRef`) — avoids stale closures.
- Computes a `keyFingerprint`: `keys.filter(isKeyCode).sort().join('|')`. Only
  changes when key *values* change, not array reference. Invalid key codes are
  silently filtered with a `console.warn` in `__DEV__`.
- Effect registers with native module, subscribes to `onKeyEvent`, filters by
  `listenerId`, delegates to the long-press tracker.
- Cleanup: cancels pending registration, removes subscription, unregisters,
  destroys tracker.

**`registerHardwareKeyEvent` (imperative):**
- Creates a long-press tracker synchronously (ready before registration
  resolves).
- Awaits `registerListener`, subscribes to `onKeyEvent`.
- Returns `{ listenerId, unregister }` — `unregister()` is a safe idempotent
  no-op.

**`useSupportedKeyCodes` hook:**
- Calls `getSupportedKeyCodes()` on mount.
- Filters results through `isKeyCode()` so only valid `KeyCode` values are
  stored in state.
- Returns empty array while loading or on error.

### `keycodes.ts`

**File:** `src/keycodes.ts`

A `const` object of 51 `KEYCODE_*` string constants (frozen via `as const`).
Derives:
- `KeyCode` type — union of all 51 string literals.
- `ALL_KEY_CODES` — `Object.values(KeyCode)` as a typed array.
- `isKeyCode(value)` — `ALL_KEY_CODES.includes(value)` as a type guard.
- `keyCodeToName(keyCodeString)` — linear scan of `Object.entries` for reverse
  lookup.

### `backcompat/useHardwareKeyEvent.ts`

**File:** `src/backcompat/useHardwareKeyEvent.ts`

Compatibility shim mapping the old `0.0.x` API to the new primitives. Exposed
via the `./compat` export path. Emits a `console.warn` in `__DEV__`. Will be
removed in v2.0.0.

---

## iOS layer

The iOS implementation is functional but limited to volume keys only — iOS does
not expose a public API for intercepting arbitrary hardware key events.

### `RNHardwareKeyEvent` (singleton)

**File:** `ios/RNHardwareKeyEvent.mm`

- KVO observer on `AVAudioSession.outputVolume`.
- Detects direction by comparing `newVolume` to `previousVolume`.
- Suppresses the system volume HUD via an off-screen `MPVolumeView`.
- Manages audio session lifecycle (activation, interruption, media-services
  reset, deactivation).
- Thread-safe registration storage via `NSLock`.
- Dispatches events to all registered listeners whose key set includes the
  changed volume key.

### `HardwareKeyEvent` (TurboModule)

**File:** `ios/HardwarekeyEvent.mm`

- Bridges the singleton's callbacks to JS via the codegen-spec event emitter.
- Dual-architecture emission: TurboModule callback (new arch) or
  `sendEventWithName:body:` (old arch).
- Error events emitted through the same `onKeyEvent` channel with
  `action: "error"`.
- Implements the codegen-generated ObjC protocol for `registerListener`,
  `unregisterListener`, and `getSupportedKeyCodes` with C++ types.

### Limitations

- Only `KEYCODE_VOLUME_UP` (24) and `KEYCODE_VOLUME_DOWN` (25) are observable.
- Every volume change is emitted as `action: "down"` — there is no separate
  up/down transition because iOS volume changes are instantaneous.
- `KEYCODE_VOLUME_MUTE` is not observable (iOS has no mute key event).
- All non-volume fields (`metaState`, `repeatCount`, `deviceId`, `flags`) are
  always `0`.

---

## Multi-listener design

The library supports **multiple independent listeners** — each call to
`useHardwareKeyEvent` or `registerHardwareKeyEvent` creates its own native
registration with a unique UUID.

### How it works

1. Each registration is stored in a `LinkedHashMap<String, Set<String>>`
   (listenerId → set of key code strings).
2. The interceptor chain is rebuilt from scratch on every register/unregister:
   iterating the `LinkedHashMap` in insertion order, wrapping the previous
   callback in a new `KeyEventInterceptor`.
3. Result: the first registration's interceptor is innermost, the most recent
   is outermost.
4. When an event arrives at the outermost interceptor and matches:
   - It emits to JS for that listener.
   - It calls `delegate.dispatchKeyEvent(event)` to pass the event inward.
   - Inner interceptors also get a chance to match and emit.
   - The innermost (original) callback is never reached — the event is consumed.

### Why this design

| Property | How it's achieved |
|---|---|
| No interference | Each interceptor checks only its own key set |
| Ordered delivery | `LinkedHashMap` preserves insertion order |
| Safe teardown | Rebuilt chain atomically; old chain is GC'd |
| No Activity inheritance | Chain injected via `Window.Callback`, not base class |
| Lifecycle-safe | `WeakReference<Activity>` + lifecycle observer |
