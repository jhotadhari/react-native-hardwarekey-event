# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`react-native-hardwarekey-event` is a React Native TurboModule library that lets JS code respond to Android hardware key events (volume buttons, etc.) via callbacks. Android-only — there is no iOS support. Requires React Native New Architecture (`newArchEnabled=true`).

Created with `create-react-native-library` (turbo-module template, Kotlin + ObjC).

## Common commands

```sh
yarn                  # install dependencies (Yarn 3.6.1 workspaces — npm is not supported)
yarn test             # run Jest unit tests
yarn typecheck        # TypeScript type-checking
yarn lint             # ESLint
yarn prepare          # build the library JS with react-native-builder-bob (output to lib/)
yarn example start    # start Metro packager for the example app
yarn example android  # run example app on Android
yarn clean            # remove build artifacts
yarn release <x.y.z>  # full publish workflow (must be on a release-* branch)
```

## Architecture

### JS layer (TypeScript)

```
src/
├── index.tsx                    # public entry point — re-exports everything
├── NativeHardwareKeyEvent.ts    # TurboModule spec + registry lookup
├── keycodes.ts                  # 51 type-safe KeyCode constants + type guard
├── useHardwareKeyEvent.ts       # main hook + imperative API + feature-detection hook
```

- **`NativeHardwareKeyEvent.ts`** defines the TurboModule spec (`Spec` interface) with:
  - `registerListener(params)` — takes `{ keyCodeStrings: string[] }`, returns `{ listenerId: string }`. Multiple concurrent registrations are supported.
  - `unregisterListener(listenerId)` — removes a registered listener (safe no-op on unknown IDs).
  - `getSupportedKeyCodes()` — returns metadata about every KEYCODE_* constant known to the device.
  - `onKeyEvent` — single `EventEmitter<KeyEvent>` stream (no separate `onError` emitter; errors flow through Promise rejections and an `action: "error"` key event).
  - The default export is `TurboModuleRegistry.getEnforcing<Spec>('HardwareKeyEvent')`.
- **`keycodes.ts`** exports a `KeyCode` const object (`as const`) with 51 `KEYCODE_*` values, a matching `KeyCode` union type, `ALL_KEY_CODES` array, `isKeyCode()` type guard, and `keyCodeToName()` reverse lookup.
- **`useHardwareKeyEvent.ts`** is the primary consumer surface:
  - `useHardwareKeyEvent({ keys, onKeyDown?, onKeyUp?, onLongPress?, longPressTimeout?, enabled? })` → `{ isRegistered, error }`. Uses refs for callback stability, a sorted-key fingerprint to avoid spurious re-registrations, a `createLongPressTracker` state machine, and cancellation-handling for in-flight registrations.
  - `registerHardwareKeyEvent(options)` — imperative (non-React) API returning `{ listenerId, unregister }`.
  - `useSupportedKeyCodes()` — feature-detection hook calling `getSupportedKeyCodes()` on mount.

### Android native layer

```
android/src/main/java/com/jhotadhari/reactnative/hardwarekeyevent/
├── KeyCodeMapper.java                     # static key-code lookup (builds once at class load)
├── KeyEventInterceptor.kt                 # Window.Callback wrapper (no Activity inheritance)
├── HardwareKeyListenerModule.kt           # TurboModule (multi-listener, chain management)
├── HardwareKeyEventLifecycleObserver.kt   # auto-installs interceptors on Activity create/destroy
└── HardwareKeyEventPackage.kt             # React Native package registration
```

**Flow**: `registerListener({ keyCodeStrings })` → module filters to known key codes via `KeyCodeMapper`, generates a UUID, stores the registration in a `LinkedHashMap`, and builds/rebuilds an interceptor chain on the current Activity's `Window.Callback`. The `HardwareKeyEventLifecycleObserver` (registered once in `HardwareKeyEventPackage`) calls `onActivityCreated`/`onActivityDestroyed` on the module so the chain follows Activity lifecycle automatically. When a key event matches a registered keycode, the `KeyEventInterceptor` resolves the keycode via `KeyCodeMapper.getKeyCodeString()` (O(1) map lookup, no per-event reflection), builds a full `WritableMap` payload with `{ listenerId, keyCode, keyCodeString, action, metaState, repeatCount, deviceId, flags }`, and emits it to JS via `emitOnKeyEvent`.

- **`KeyCodeMapper`** (Java) — static utility that reflects over `KeyEvent.class.getFields()` once at class-load, builds `Map<Integer,String>` + `Map<String,Integer>` + `List<String>`, and exposes them via thread-safe unmodifiable collections. Public API: `getKeyCodeString(int)`, `getKeyCodeInt(String)`, `getSupportedKeyCodes()`.
- **`KeyEventInterceptor`** (Kotlin) — `Window.Callback` wrapper. Only intercepts `dispatchKeyEvent`; all other 22 `Window.Callback` methods delegate directly. Uses `KeyCodeMapper` for O(1) lookup and checks membership in a `Set<String>` of registered keycodes. Holds a `@Volatile` delegate reference for safe chain-rebuild visibility. Decoupled from the TurboModule via an internal `KeyEventEmitter` interface.
- **`HardwareKeyListenerModule`** (Kotlin) — TurboModule extending the codegen-generated `NativeHardwareKeyEventSpec`, implementing `KeyEventEmitter`. Maintains `LinkedHashMap<String, Set<String>>` registrations + `LinkedHashMap<String, KeyEventInterceptor>` interceptors. Chain methods: `installOnActivity` (save original callback), `detachFromActivity` (restore original), `rebuildAndInstall` (rebuild from registrations preserving insertion order). `onKeyEvent` callback builds the full `WritableMap` payload; `onError` emits through the same `onKeyEvent` channel with `action: "error"`.
- **`HardwareKeyEventLifecycleObserver`** (Kotlin) — `Application.ActivityLifecycleCallbacks` implementation. `onActivityCreated` installs the chain if registrations are pending; `onActivityDestroyed` detaches the chain from the dying Activity. All other lifecycle callbacks are no-ops.
- **`HardwareKeyEventPackage`** (Kotlin) — registers `HardwareKeyListenerModule` as a TurboModule (`isTurboModule = true`) and lazily registers the lifecycle observer exactly once per process via double-checked locking.

### Codegen

The `codegenConfig` in `package.json` generates the `NativeHardwareKeyEventSpec` from the TypeScript spec in `src/`. Generated Java lands in `android/generated/`. The config uses `jsSrcsDir: "src"` and `includesGeneratedCode: true`.

### Build toolchain

- **react-native-builder-bob**: compiles TypeScript in `src/` → ESM JS + type declarations in `lib/`
- **Turborepo**: caches Android/iOS example builds (`turbo.json` pipelines: `build:android`, `build:ios`)
- **Lefthook**: pre-commit hooks run ESLint on staged files and `tsc` type-checking
- **CI** (`.github/workflows/ci.yml`): lint + typecheck, Jest with coverage, library build (`yarn prepare`), Android example build, iOS example build

## Repository structure (workspaces)

- **Root** — the library package (`react-native-hardwarekey-event`)
- **`example/`** — Yarn workspace with a React Native app that consumes the local library via workspace resolution

## Branching and release model

- Base branch for PRs: `development`
- Default branch: `main`
- Release workflow: create a `release-<version>` branch from `development` → run `yarn release <version>` → script bumps version, updates changelog, merges to `main` (with tag), publishes to npm, then merges back to `development` and adds a new `[Unreleased]` CHANGELOG section.
