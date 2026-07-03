# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-07-03

## [1.0.0] - 2026-07-03

### Added

- New TurboModule spec with `registerListener`, `unregisterListener`, `getSupportedKeyCodes`.
- Type-safe `KeyCode` constants with union type, `isKeyCode()` guard, and `keyCodeToName()` reverse lookup.
- Redesigned `useHardwareKeyEvent` hook with `onKeyDown`, `onKeyUp`, `onLongPress` callbacks and `longPressTimeout` option.
- Imperative `registerHardwareKeyEvent()` API and `useSupportedKeyCodes()` feature-detection hook.
- Multi-listener support with interceptor chaining in Android native layer.
- Lifecycle-aware interceptor installation via `HardwareKeyEventLifecycleObserver`.
- Documentation: `docs/` directory with API reference, architecture overview, keycode catalog, Android setup, iOS state, testing guide, and migration guide.

### Changed

- Rich `KeyEvent` payload now includes action, metaState, repeatCount, deviceId, and flags.
- Errors flow through the `onKeyEvent` emitter with `action: "error"` instead of a separate emitter.
- `Window.Callback` wrapper replaces Activity inheritance for interceptor installation.

### Removed

- Backwards-compat `./compat` import path and `src/backcompat/` directory.

### Fixed

- Interceptor chain bug where inner listeners for the same key code were skipped.
- Native listener leak from `KeyCharacterMap.load()` inside hot loop.
- OEM `SecurityException` guard in `KeyCodeMapper` reflection.
- Double-checked locking fix in `HardwareKeyEventPackage`.
- Activity-resume chain reinstall for back-navigation scenarios.
- iOS NSNumber crash guard in argument validation.

## [0.0.3] - 2025-04-15

## [0.0.2] - 2025-04-15

First version

[Unreleased]: https://github.com/jhotadhari/react-native-hardwarekey-event/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jhotadhari/react-native-hardwarekey-event/compare/v1.0.0...v1.0.0
[1.0.0]: https://github.com/jhotadhari/react-native-hardwarekey-event/compare/v0.0.3...v1.0.0
[0.0.3]: https://github.com/jhotadhari/react-native-hardwarekey-event/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/jhotadhari/react-native-hardwarekey-event/releases/tag/v0.0.2
