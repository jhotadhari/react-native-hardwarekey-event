# Android Setup

This library requires React Native **New Architecture** and works on Android
API 24+ (Android 7.0). No Activity inheritance is needed.

## Requirements

| Requirement | Detail |
|---|---|
| React Native | 0.72+ (New Architecture support) |
| `newArchEnabled` | `true` |
| Min SDK | 24 (Android 7.0) |
| Compile SDK | 34+ (recommended) |
| Kotlin | 1.8+ (ships with React Native 0.72+) |

## Installation

```sh
npm install react-native-hardwarekey-event
# or
yarn add react-native-hardwarekey-event
```

## Enable New Architecture

In `android/gradle.properties`:

```properties
newArchEnabled=true
```

## No Activity changes needed

This library installs itself automatically via `Window.Callback` interception.
Your `MainActivity` stays a plain `ReactActivity`:

```kotlin
import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String = "MyApp"
}
```

> **Migration from 0.x:** If you previously extended `HardwareKeyListenerActivity`,
> remove that inheritance and revert to `ReactActivity`. See
> [`MIGRATION.md`](../MIGRATION.md#31-remove-activity-inheritance) for details.

## How auto-install works

1. `HardwareKeyEventPackage` registers a `HardwareKeyEventLifecycleObserver`
   exactly once per process.
2. On `Activity.onCreate`, the observer calls `module.onActivityCreated(activity)`.
3. If there are pending listener registrations, the module saves the Activity's
   current `Window.Callback`, builds an interceptor chain, and sets it as the
   new callback.
4. On `Activity.onDestroy`, the chain is detached and the original callback is
   restored.
5. On `Activity.onResume`, the chain is reinstalled if it was lost during
   navigation.

This happens entirely automatically — no manual setup.

## ProGuard / R8

No special rules are needed. The library does not use reflection at runtime
(except `KeyCodeMapper`, which reflects only over public Android SDK fields
and is guarded against failure).

If you use aggressive minification, add this to `proguard-rules.pro`:

```
# Keep the TurboModule class name for lookup
-keep class com.jhotadhari.reactnative.hardwarekeyevent.HardwareKeyListenerModule { *; }
```

## Troubleshooting

### Key events are not firing

1. **Check `newArchEnabled`:** Must be `true` in `android/gradle.properties`.
2. **Check `isRegistered`:** The hook returns `isRegistered` — if it's `false`,
   check the `error` return value.
3. **Check the key code:** Unknown key code strings are silently ignored. Use
   the `KeyCode` enum to avoid typos.
4. **Check for conflicting `Window.Callback` wrappers:** If another library
   also wraps `Window.Callback`, the interceptor chain may be broken. This
   library is compatible with other chain-based interceptors as long as they
   use the same delegation pattern.
5. **Rebuild native code:**
   ```sh
   cd android && ./gradlew clean && cd ..
   npx react-native run-android
   ```

### `newArchEnabled` is true but the module isn't found

The codegen may not have run. Rebuild:

```sh
cd android && ./gradlew clean && cd ..
yarn prepare     # regenerates codegen specs + builds JS
npx react-native run-android
```

### `ExceptionInInitializerError` from KeyCodeMapper

This should not happen — `KeyCodeMapper` catches `RuntimeException` per-field
during static initialization. If it does occur, it indicates a deeply broken
Android runtime. File a bug with your device model and Android version.

### `enabled=false` still shows `isRegistered=true` briefly

The hook unregisters asynchronously. There may be a single render frame where
`isRegistered` is still `true` after setting `enabled=false`. This is expected
and resolves on the next frame.

### App crashes when the bridge is dead

Not a concern. `KeyEventInterceptor` wraps `emitter.onKeyEvent()` and
`emitter.onError()` in try-catch — if both throw (dead bridge), the exception
is silently swallowed.

## Manual testing

See the [Testing guide](./testing.md#android) for the Android on-device testing
checklist.
