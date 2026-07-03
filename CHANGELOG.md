# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Rewritten

Complete library rewrite from `v0.0.3`:

- **JS layer** — new TurboModule spec with `registerListener` / `unregisterListener` / `getSupportedKeyCodes`, single `onKeyEvent` emitter (errors via `action: "error"`), rich `KeyEvent` payload (action, metaState, repeatCount, deviceId, flags), and type-safe `KeyCode` constants (51 keys with union type, `isKeyCode()` guard, `keyCodeToName()` reverse lookup).
- **Hook API** — redesigned `useHardwareKeyEvent({ keys, onKeyDown, onKeyUp, onLongPress, longPressTimeout, enabled })` with ref-based callback stability, sorted-key fingerprinting, cancellation-safe registration, shared long-press state machine, imperatival `registerHardwareKeyEvent()`, and feature-detection via `useSupportedKeyCodes()`.
- **Android native layer** — `HardwareKeyListenerModule` renamed to `HardwareKeyListenerModule`, multi-listener support with interceptor chaining, `KeyEventEmitter` decoupling, `Window.Callback` wrapper (no Activity inheritance), lifecycle-aware installation via `HardwareKeyEventLifecycleObserver`.
- **15 bug fixes** — correctness fixes in Kotlin/Java/iOS stubs (interceptor chain bug, native listener leak, OEM SecurityException guard, DCL fix, Activity-resume chain reinstall, iOS NSNumber crash guard, error-channel unification), plus TypeScript fixes (action types, error forwarding, keycode validation, long-press error handling).
- **Documentation** — `docs/` directory with API reference, architecture overview, keycode catalog, Android setup, iOS state, testing guide, and `MIGRATION.md` (0.0.x → 1.0.0).
- **Release tooling** — replaced `release.sh` with Commander-based JS pipeline (`release-kit`), modularized into checks / version / changelog / git / GitHub / npm modules, with `--dry-run`, `--no-test`, `--no-lint`, and npm `--tag` support.
- **Cleanup** — removed backwards-compat `./compat` shim, aligned prettier/eslint config, and updated CI/test/docs accordingly.

## [0.0.3] - 2025-04-15

## [0.0.2] - 2025-04-15
First version

[Unreleased]: https://github.com/jhotadhari/react-native-hardwarekey-event/compare/v0.0.3...HEAD
[0.0.3]: https://github.com/jhotadhari/react-native-hardwarekey-event/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/jhotadhari/react-native-hardwarekey-event/releases/tag/v0.0.2
