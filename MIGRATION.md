# Migration Guide: 0.0.x to 1.0.0

This document describes how to migrate from the **0.0.x API** (v0.0.2, v0.0.3) to the
**1.0.0 API** of `react-native-hardwarekey-event`. The 1.0.0 release is a complete
rewrite that replaces the Activity-inheritance model with a `Window.Callback`
interception mechanism, adds type-safe key codes, rich event payloads, multi-listener
support, and built-in long-press detection.

---

## Table of Contents

1. [Versioning Strategy](#1-versioning-strategy)
2. [Step-by-Step Migration Guide](#2-step-by-step-migration-guide)
   - [2.1 Remove Activity Inheritance](#21-remove-activity-inheritance)
   - [2.2 Update the Hook Call Signature](#22-update-the-hook-call-signature)
   - [2.3 Switch from Raw Key-Code Strings to the `KeyCode` Enum](#23-switch-from-raw-key-code-strings-to-the-keycode-enum)
   - [2.4 Replace Direct Module Usage](#24-replace-direct-module-usage)
   - [2.5 Update Error Handling](#25-update-error-handling)
   - [2.6 Adopt the Richer `KeyEvent` Payload](#26-adopt-the-richer-keyevent-payload)
3. [Breaking Changes Summary](#3-breaking-changes-summary)
4. [Automated Codemod Candidates](#4-automated-codemod-candidates)
5. [Documentation Updates Needed](#5-documentation-updates-needed)
6. [Example App Update Plan](#6-example-app-update-plan)

---

## 1. Versioning Strategy

| Aspect | Decision |
|---|---|
| **Semver bump** | **Major** — `1.0.0`.  Every public API surface changes.  TypeScript signatures are incompatible; the native registration mechanism is completely replaced; the Activity contract is removed. |
| **Deprecation timeline** | The old API is **removed** in 1.0.0. A compatibility wrapper was shipped as a separate import (`./compat`) through the 1.x line and removed in 2.0.0. |
| **Pre-release channel** | Publish `1.0.0-rc.0` first.  Let it bake for at least 2 weeks while the community tests the migration guide before cutting the stable `1.0.0`. |
| **Branch strategy** | Maintain a `0.x` branch for critical bugfixes to the legacy API until `1.0.0` is stable and widely adopted. |

---

## 2. Step-by-Step Migration Guide

> **Note:** A backward-compatibility wrapper (`react-native-hardwarekey-event/compat`)
> was available in v1.x but has been removed in v2.0.0. If you still rely on the old
> `{ callbacks, onError }` API, migrate to the new hook signature described below.

### 2.1 Remove Activity Inheritance

This is the **first** and **most impactful** change, because it touches native
(Android) code rather than JavaScript.

#### Before (0.0.x)

```kotlin
// android/app/src/main/java/.../MainActivity.kt
import com.jhotadhari.reactnative.hardwarekeyevent.HardwareKeyListenerActivity

class MainActivity : HardwareKeyListenerActivity() {
    override fun getMainComponentName(): String = "MyApp"
    // ...
}
```

If you had a custom base activity that implemented `HardwareKeyListenerHandler`
manually instead of extending `HardwareKeyListenerActivity`, that code must also
be removed:

```java
// REMOVE THIS ENTIRE PATTERN — no longer needed
public class MyActivity extends ReactActivity implements HardwareKeyListenerHandler {
    private Map<String, HardwareKeyListener> hardwareKeyListeners = new HashMap<>();

    @Override
    public String getKeyEventKeyCodeString(KeyEvent event) { /* ... */ }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) { /* ... */ }

    @Override
    public String addHardwareKeyListener(HardwareKeyListener listener) { /* ... */ }

    @Override
    public void removeHardwareKeyListener(String uuid) { /* ... */ }
}
```

#### After (1.0.0)

```kotlin
// android/app/src/main/java/.../MainActivity.kt
import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String = "MyApp"
    // ...
}
```

**That is all.**  The library automatically installs a `Window.Callback` interceptor
chain via `Application.ActivityLifecycleCallbacks` — no custom base class, no
interface implementation, no boilerplate.

#### Why the change?

| 0.0.x (Activity inheritance) | 1.0.0 (Window.Callback) |
|---|---|
| Must extend `HardwareKeyListenerActivity` | Works with any `ReactActivity` |
| Conflicts with other libraries that also require a custom base | Composable interceptor chain — multiple libraries can each wrap `Window.Callback` |
| Only one listener per process | Many independent listeners (each gets a UUID) |
| Manual lifecycle management in the Activity | Injected automatically via `ActivityLifecycleCallbacks` |

#### Rebuild after removing

After editing `MainActivity.kt`, rebuild the Android project:

```sh
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

---

### 2.2 Update the Hook Call Signature

#### Before (0.0.x)

```tsx
import { useHardwareKeyEvent } from 'react-native-hardwarekey-event';

function MyComponent() {
  useHardwareKeyEvent({
    callbacks: {
      'KEYCODE_VOLUME_UP': (response) => {
        console.log('Volume up pressed');
      },
      'KEYCODE_VOLUME_DOWN': (response) => {
        console.log('Volume down pressed');
      },
    },
    onError: (error) => {
      console.error('Key event error:', error?.errorMsg);
    },
  });
}
```

#### After (1.0.0)

```tsx
import { useHardwareKeyEvent, KeyCode } from 'react-native-hardwarekey-event';

function MyComponent() {
  const { isRegistered, error } = useHardwareKeyEvent({
    keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN],
    onKeyDown: (event) => {
      console.log(`${event.keyCodeString} pressed`);
    },
    onKeyUp: (event) => {
      console.log(`${event.keyCodeString} released`);
    },
    onLongPress: (event) => {
      console.log(`${event.keyCodeString} long-pressed`);
    },
    longPressTimeout: 500,    // optional, defaults to 500 ms
    enabled: true,            // optional, defaults to true
  });

  if (error) {
    console.error(error.message);
  }
}
```

#### Key differences

| Old | New |
|---|---|
| `callbacks: { [keyCodeString]: callback }` | `keys: KeyCode[]` + `onKeyDown` / `onKeyUp` / `onLongPress` |
| One callback fires for every action (down, up, repeat) | Three separate callbacks, each fires only for its action |
| `onError` callback parameter | `error` returned from the hook (React state) |
| No enable/disable toggle | `enabled` boolean for pause/resume |
| No long-press | Built-in long-press with configurable timeout |
| Implicit single listener | Multiple calls to `useHardwareKeyEvent` create independent listeners |

#### Mapping old callbacks to new callbacks

If you relied on the fact that the old callback fired on **every** key action
(down, up, and repeat), pass the same handler to all three new callbacks:

```tsx
const handleVolume = (event: KeyEvent) => {
  console.log(event.keyCodeString, event.action);
};

useHardwareKeyEvent({
  keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN],
  onKeyDown: handleVolume,
  onKeyUp: handleVolume,
  onLongPress: handleVolume,
});
```

---

### 2.3 Switch from Raw Key-Code Strings to the `KeyCode` Enum

The old API used raw string literals like `'KEYCODE_VOLUME_UP'`.  The new API
provides a type-safe `KeyCode` enum.

#### Before (0.0.x)

```ts
// No compile-time safety — typos are runtime bugs
useHardwareKeyEvent({
  callbacks: {
    'KEYCODE_VOLUME_UP': handleVolumeUp,
    'KEYCODE_VOLUME_DOWN': handleVolumeDown,
    'KEYCODE_VOLUM_DOWN': handleVolumeDown, // typo — silently ignored!
  },
});
```

#### After (1.0.0)

```ts
import { KeyCode } from 'react-native-hardwarekey-event';

useHardwareKeyEvent({
  keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN],
  onKeyDown: (event) => {
    // TypeScript catches typos at compile time
    if (event.keyCodeString === KeyCode.VOLUME_UP) {
      /* ... */
    }
  },
});
```

#### Available KeyCode constants

The full set of supported keys is available via the `KeyCode` enum and the
`ALL_KEY_CODES` array:

```ts
import { KeyCode, ALL_KEY_CODES, isKeyCode, keyCodeToName } from 'react-native-hardwarekey-event';

// Iterate all known key codes
for (const keyCode of ALL_KEY_CODES) {
  console.log(keyCode); // "KEYCODE_VOLUME_UP", etc.
}

// Check whether a string is a valid KeyCode
if (isKeyCode(someString)) {
  // someString is typed as KeyCode here
}

// Reverse lookup: "KEYCODE_VOLUME_UP" → "VOLUME_UP"
keyCodeToName('KEYCODE_VOLUME_UP'); // "VOLUME_UP"
```

#### String-to-enum migration table

If you have dynamic key-code strings (e.g. from a config file), convert them at
the boundary:

```ts
import { type KeyCode, isKeyCode } from 'react-native-hardwarekey-event';

function toKeyCode(raw: string): KeyCode | null {
  return isKeyCode(raw) ? raw : null; // null for unknown values
}
```

---

### 2.4 Replace Direct Module Usage

If your code imported `HardwareKeyEvent` directly (the TurboModule), you must
update to the new method signatures.

#### `enableEvents` → `registerListener` + `unregisterListener`

**Before (0.0.x):**

```ts
import HardwareKeyEvent from 'react-native-hardwarekey-event';

const response = await HardwareKeyEvent.enableEvents({
  keyCodeStrings: ['KEYCODE_VOLUME_UP'],
});
// response: { added: 'some-uuid', removed?: 'previous-uuid' }

const subscription = HardwareKeyEvent.onKeyEvent((event) => {
  // event has only: keyCode, keyCodeString
});

const errorSub = HardwareKeyEvent.onError((err) => {
  // err has only: errorMsg
});
```

**After (1.0.0):**

```ts
import HardwareKeyEvent from 'react-native-hardwarekey-event';

const response = await HardwareKeyEvent.registerListener({
  keyCodeStrings: ['KEYCODE_VOLUME_UP'],
});
// response: { listenerId: 'uuid' }

const subscription = HardwareKeyEvent.onKeyEvent((event) => {
  // Only process events for this listener
  if (event.listenerId !== response.listenerId) return;
  // event has: listenerId, keyCode, keyCodeString, action,
  //            metaState, repeatCount, deviceId, flags
});

// Later:
await HardwareKeyEvent.unregisterListener(response.listenerId);
subscription.remove();
```

**There is no `onError` event emitter in the new API.**  Errors are surfaced
through the promise rejections of `registerListener` and `unregisterListener`.
Process-level errors (e.g. interceptor failure) are emitted through `onKeyEvent`
with `action: "error"`.

For non-React contexts, use the imperative `registerHardwareKeyEvent` helper:

```ts
import { registerHardwareKeyEvent } from 'react-native-hardwarekey-event';

const listener = await registerHardwareKeyEvent({
  keys: [KeyCode.VOLUME_UP],
  onKeyDown: (event) => console.log(event),
});

// Later:
await listener.unregister();
```

#### New: `getSupportedKeyCodes`

The new API adds device introspection:

```ts
import HardwareKeyEvent from 'react-native-hardwarekey-event';

const keyCodes = await HardwareKeyEvent.getSupportedKeyCodes();
// keyCodes: KeyCodeInfo[]
// Each entry: { keyCode, keyCodeString, label, isGamepad, isSystem }
```

Use this for feature detection — check whether the current device has volume
keys, a D-pad, gamepad buttons, etc. — before registering listeners for keys
that may not exist:

```tsx
import { useSupportedKeyCodes, useHardwareKeyEvent, KeyCode } from 'react-native-hardwarekey-event';

function VolumeHandler() {
  const supported = useSupportedKeyCodes();
  const hasVolumeUp = supported.includes(KeyCode.VOLUME_UP);

  const volumeKeys = hasVolumeUp ? [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN] : [];

  useHardwareKeyEvent({
    keys: volumeKeys,
    onKeyDown: (e) => console.log(e),
  });
}
```

---

### 2.5 Update Error Handling

#### Before (0.0.x)

```tsx
useHardwareKeyEvent({
  callbacks: { 'KEYCODE_VOLUME_UP': () => {} },
  onError: (error) => {
    console.error(error?.errorMsg);
  },
});
```

Errors were delivered via a dedicated `onError` event emitter.  Any runtime
error — registration failure, missing Activity interface, reflection error —
would fire `onError` asynchronously.

#### After (1.0.0)

```tsx
const { isRegistered, error } = useHardwareKeyEvent({
  keys: [KeyCode.VOLUME_UP],
  onKeyDown: () => {},
});

if (error) {
  console.error(error.message);
}
```

Errors are now React state returned from the hook.  The `error` property is:

- `null` when the last registration succeeded or no registration was attempted.
- An `Error` instance when registration failed or an error occurred during
  event processing.

The `isRegistered` boolean tracks whether a native listener is currently active,
which is useful for showing loading or fallback UI:

```tsx
if (!isRegistered) {
  return <ActivityIndicator />;
}
```

#### Error-handling mapping

| Old error source | New error source |
|---|---|
| `enableEvents` rejection | `registerListener` rejection → `error` state |
| `onError` emitter | Captured as `error` state in the hook |
| Activity doesn't implement `HardwareKeyListenerHandler` | **Cannot happen** — no interface requirement |
| Reflection failures in getKeyCodeString | **Cannot happen** — `KeyCodeMapper` does not use reflection |

---

### 2.6 Adopt the Richer `KeyEvent` Payload

The old `KeyEventResponse` carried only two fields:

```ts
// 0.0.x
interface KeyEventResponse {
  keyCode: number;
  keyCodeString: string;
}
```

The new `KeyEvent` carries the full Android `KeyEvent` metadata:

```ts
// 1.0.0
interface KeyEvent {
  listenerId: string;      // Registration UUID that matched this event
  keyCode: number;         // Android key code integer (e.g. 24)
  keyCodeString: string;   // "KEYCODE_VOLUME_UP"
  action: KeyAction;       // "down" | "up" | "multiple"
  metaState: number;       // Modifier key bitmask (Ctrl, Alt, Shift, Meta)
  repeatCount: number;     // Number of repeats while held
  deviceId: number;        // Input device ID
  flags: number;           // KeyEvent flags bitmask
}
```

This enables patterns that were impossible before:

```tsx
useHardwareKeyEvent({
  keys: [KeyCode.VOLUME_UP],
  onKeyDown: (event) => {
    // Distinguish long-press repeats from initial press
    if (event.repeatCount > 0) {
      console.log(`Held for ${event.repeatCount} repeats`);
    }

    // React differently when Shift is held
    if (event.metaState & 1) { // META_SHIFT_ON
      console.log('Volume up + Shift');
    }

    // React differently per input device
    if (event.deviceId === 0) {
      console.log('Built-in key');
    } else {
      console.log(`External device ${event.deviceId}`);
    }
  },
});
```

---

## 3. Breaking Changes Summary

### Changes requiring manual migration

| # | Change | Impact |
|---|---|---|
| 1 | **Remove `HardwareKeyListenerActivity`** from `MainActivity` | Must edit `MainActivity.kt` (or `.java`), rebuild Android |
| 2 | **Replace `callbacks` with `keys` + `onKeyDown`/`onKeyUp`/`onLongPress`** | Every `useHardwareKeyEvent` callsite must be updated |
| 3 | **Replace raw key-code strings with `KeyCode` enum** | String literals `'KEYCODE_*'` must be updated (or validated via `isKeyCode()`) |
| 4 | **Replace `onError` callback with `error` state** | Error handling moves from callback to returned React state |
| 5 | **Replace `enableEvents` with `registerListener`/`unregisterListener`** | Direct module usage must adopt new method names and signatures |
| 6 | **Remove `onError` event emitter usage** | No more `HardwareKeyEvent.onError()` — errors on `onKeyEvent` or promise rejections |
| 7 | **Adopt multi-listener awareness** | If you called `useHardwareKeyEvent` multiple times, the old API only supported one listener; the new API supports many — each call is independent |

### Changes that are automated via codemods

| Change | Automation |
|---|---|
| `callbacks` → `keys` + `onKeyDown` | Codemod can transform the call signature |
| `onError` callback | Codemod can bridge to the hook's `error` state |
| Raw strings → `KeyCode` enum | Codemod can replace known string literals |
| Activity inheritance | **Not automatable** — must be done manually |

### Removals (no replacement)

| Removed | Reason |
|---|---|
| `HardwareKeyListenerActivity` | Replaced by `Window.Callback` auto-install |
| `HardwareKeyListenerHandler` interface | No longer needed |
| `HardwareKeyListener` class | Replaced by `KeyEventInterceptor` |
| `onError` event emitter on the TurboModule | Errors flow through promise rejections instead |
| `enableEvents` method | Replaced by `registerListener`/`unregisterListener` |
| `PromiseError` / `EventError` types | Replaced by standard `Error` instances |

---

## 4. Automated Codemod Candidates

The following transformations are straightforward enough to automate with a
jscodeshift codemod:

### 4.1 Hook signature transform

```ts
// INPUT (0.0.x)
useHardwareKeyEvent({
  callbacks: { 'KEYCODE_VOLUME_UP': handleUp, 'KEYCODE_VOLUME_DOWN': handleDown },
  onError: handleError,
});

// OUTPUT (1.0.0, naive transform)
useHardwareKeyEvent({
  keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN],
  onKeyDown: (event) => { handleUp(event); handleDown(event); },
});
```

**Caveat:** The codemod cannot know which callback should map to which key
without also inspecting the callback bodies.  A reasonable first pass emits a
single `onKeyDown` that dispatches to the appropriate callback based on
`event.keyCodeString`, annotated with an ESLint-disable comment and a
`// TODO: split into separate onKeyDown/onKeyUp/onLongPress handlers` comment.

### 4.2 Import transform

```ts
// INPUT
import { useHardwareKeyEvent } from 'react-native-hardwarekey-event';

// OUTPUT
import { useHardwareKeyEvent, KeyCode } from 'react-native-hardwarekey-event';
```

### 4.3 String literal to KeyCode

```ts
// INPUT
callbacks: { 'KEYCODE_VOLUME_UP': fn }

// OUTPUT (codemod can auto-replace known strings)
keys: [KeyCode.VOLUME_UP]
```

A codemod can replace any of the ~50 known `'KEYCODE_*'` string literals with
their `KeyCode.*` enum equivalents.

### Codemod limitations

The codemod **cannot** handle:

- Dynamic key-code construction (e.g. `` `KEYCODE_${suffix}` ``)
- Activity class changes (requires manual edit of `MainActivity.kt`)
- Callback logic that differentiates between down/up/repeat (requires domain
  knowledge)
- TypeScript `satisfies` or `as const` patterns that depend on the old API
  shape

---

## 5. Documentation Updates Needed

| Document | Action |
|---|---|
| `README.md` | Rewrite entirely.  Replace the old API examples with the new hook signature, remove the "extend `HardwareKeyListenerActivity`" instructions, add the "no Activity changes needed" note, document `KeyCode` enum, document multi-listener pattern, add `useSupportedKeyCodes` example. |
| `CHANGELOG.md` | Add a `[1.0.0]` entry detailing every breaking change, every new feature, and a link to this migration guide. |
| `CONTRIBUTING.md` | Update the architecture overview to describe `Window.Callback` interception, the interceptor chain, `KeyEventInterceptor`, `HardwareKeyListenerModule`, and `HardwareKeyEventLifecycleObserver`. |
| `MIGRATION.md` | This file.  Keep it in the repo root so GitHub renders it automatically. |
| TypeScript doc comments | Already up-to-date in the 1.0.0 codebase (JSDoc on every export).  Verify nothing references `enableEvents`, `KeyEventResponse`, or `EventError`. |
| Example app README | Update or remove if it reflects the old `HardwareKeyListenerActivity` setup. |
| `package.json` keywords | Add `"ios"` once iOS support for volume buttons is complete (framework already in place at `ios/`). |

---

## 6. Example App Update Plan

The example app (`example/`) currently still extends `HardwareKeyListenerActivity`
and likely uses the old API.  Update it to:

### 6.1 Android: remove Activity inheritance

```diff
// example/android/app/src/main/java/.../MainActivity.kt
- import com.jhotadhari.reactnative.hardwarekeyevent.HardwareKeyListenerActivity
+ import com.facebook.react.ReactActivity

- class MainActivity : HardwareKeyListenerActivity() {
+ class MainActivity : ReactActivity() {
```

### 6.2 JavaScript: update `App.tsx`

Rewrite `App.tsx` to demonstrate **all** new features:

1. **Basic `useHardwareKeyEvent`** with `onKeyDown`, `onKeyUp`, and `onLongPress`
2. **`useSupportedKeyCodes`** showing device capability introspection
3. **Multi-listener example** showing two independent `useHardwareKeyEvent` calls
   (e.g. one for volume keys, one for media keys) coexisting
4. **`enabled` toggle** with a Switch component to demonstrate pause/resume
5. **Imperative API** example using `registerHardwareKeyEvent` outside React
6. **Error state display** when `isRegistered` is false or `error` is set

### 6.3 Example app structure (proposed)

```
example/src/
  App.tsx                        # Tab navigator shell
  examples/
    BasicVolumeExample.tsx       # Simple onKeyDown/onKeyUp
    LongPressExample.tsx         # onLongPress with configurable timeout
    MultiListenerExample.tsx     # Two independent hooks
    EnabledToggleExample.tsx     # enabled prop with Switch
    SupportedKeysExample.tsx     # useSupportedKeyCodes display
    ImperativeApiExample.tsx     # registerHardwareKeyEvent
```

### 6.4 Testing checklist for the example app

- [ ] App launches without `HardwareKeyListenerActivity`
- [ ] Volume up/down presses are logged in the basic example
- [ ] Long-press fires after the configured timeout
- [ ] Two independent listeners both receive events for their respective key sets
- [ ] Toggling `enabled` to `false` stops event delivery; toggling back resumes
- [ ] `useSupportedKeyCodes` returns a populated array on the test device
- [ ] Imperative listener registers and unregisters correctly
- [ ] Killing and relaunching the app (Activity recreation) preserves listeners
- [ ] No crash when all listeners are unregistered and a key is pressed

---

## Quick-Reference Diff

### Hook usage

```diff
- useHardwareKeyEvent({
-   callbacks: {
-     'KEYCODE_VOLUME_UP': (r) => console.log(r),
-     'KEYCODE_VOLUME_DOWN': (r) => console.log(r),
-   },
-   onError: (e) => console.error(e?.errorMsg),
- });
+ const { isRegistered, error } = useHardwareKeyEvent({
+   keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN],
+   onKeyDown: (event) => console.log(event),
+   onKeyUp: (event) => console.log(event),
+   onLongPress: (event) => console.log(event),
+ });
+ if (error) console.error(error.message);
```

### Direct module usage

```diff
- const { added } = await HardwareKeyEvent.enableEvents({
-   keyCodeStrings: ['KEYCODE_VOLUME_UP'],
- });
- HardwareKeyEvent.onError((err) => { /* ... */ });
+ const { listenerId } = await HardwareKeyEvent.registerListener({
+   keyCodeStrings: ['KEYCODE_VOLUME_UP'],
+ });
+ await HardwareKeyEvent.unregisterListener(listenerId);
```

### Activity

```diff
- class MainActivity : HardwareKeyListenerActivity() {
+ class MainActivity : ReactActivity() {
```

---

## Support

If you encounter issues during migration, please file a GitHub issue at
<https://github.com/jhotadhari/react-native-hardwarekey-event/issues> with:

- Your current `package.json` version
- The relevant code snippet (before and after)
- The error message or unexpected behaviour observed
- Android device / emulator API level
