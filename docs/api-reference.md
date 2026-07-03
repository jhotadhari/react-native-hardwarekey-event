# API Reference

Complete reference for every public export of `react-native-hardwarekey-event`.

## Table of contents

- [Hooks](#hooks)
  - [`useHardwareKeyEvent`](#usehardwarekeyevent)
  - [`useSupportedKeyCodes`](#usesupportedkeycodes)
- [Imperative API](#imperative-api)
  - [`registerHardwareKeyEvent`](#registerhardwarekeyevent)
- [Key codes](#key-codes)
  - [`KeyCode` constants](#keycode-constants)
  - [`KeyCode` type](#keycode-type)
  - [`isKeyCode`](#iskeycode)
  - [`keyCodeToName`](#keycodetoname)
  - [`ALL_KEY_CODES`](#all_key_codes)
- [Types](#types)
  - [`KeyEvent`](#keyevent)
  - [`KeyAction`](#keyaction)
  - [`KeyCodeInfo`](#keycodeinfo)
- [TurboModule (advanced)](#turbomodule-advanced)
  - [`HardwareKeyEvent.registerListener`](#hardwarekeyeventregisterlistener)
  - [`HardwareKeyEvent.unregisterListener`](#hardwarekeyeventunregisterlistener)
  - [`HardwareKeyEvent.getSupportedKeyCodes`](#hardwarekeyeventgetsupportedkeycodes)
  - [`HardwareKeyEvent.onKeyEvent`](#hardwarekeyeventonkeyevent)

---

## Hooks

### `useHardwareKeyEvent`

```ts
function useHardwareKeyEvent(
  options: UseHardwareKeyEventOptions
): UseHardwareKeyEventResult;
```

Register for hardware key events from a React component. Each call creates an
independent native listener — multiple components can observe different key sets
concurrently.

#### Options

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `keys` | `KeyCode[]` | yes | — | Key codes to observe. For stable identity between renders, wrap in `useMemo` or declare outside the component. The hook compares by sorted value — reordering does not trigger re-registration. |
| `onKeyDown` | `(event: KeyEvent) => void` | no | — | Called for every key-down event and key-repeat event. |
| `onKeyUp` | `(event: KeyEvent) => void` | no | — | Called for every key-up event. |
| `onLongPress` | `(event: KeyEvent) => void` | no | — | Called once when a key is held down for at least `longPressTimeout` ms without being released. The event payload is the most recent down event for that key. |
| `longPressTimeout` | `number` | no | `500` | Duration in ms before `onLongPress` fires. |
| `enabled` | `boolean` | no | `true` | When `false`, the hook does not register with the native module and all callbacks are inert. Toggle to pause/resume without losing the key set. |

#### Return value

| Property | Type | Description |
|---|---|---|
| `isRegistered` | `boolean` | `true` when the native listener is currently active. |
| `error` | `Error \| null` | The most recent registration error, or `null` when the last registration succeeded or none was attempted. |

#### Lifecycle

1. On mount (and when `keyFingerprint`, `enabled`, or `longPressTimeout` change):
   calls `HardwareKeyEvent.registerListener({ keyCodeStrings })`.
2. While registered, subscribes to the shared `onKeyEvent` stream and filters
   by `listenerId`.
3. On cleanup (unmount or deps change): calls `unregisterListener` and removes
   the subscription.
4. If `enabled` becomes `false` or `keys` is empty, the listener is torn down
   and `isRegistered` returns `false`.

#### Cancellation

If the component unmounts or dependencies change before `registerListener`
resolves, the pending registration is cancelled and the returned `listenerId`
is immediately unregistered (best-effort).

#### Example

```tsx
const { isRegistered, error } = useHardwareKeyEvent({
  keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN],
  onKeyDown: (event) => console.log('Down:', event.keyCodeString),
  onKeyUp: (event) => console.log('Up:', event.keyCodeString),
  onLongPress: (event) => console.log('Long press:', event.keyCodeString),
  longPressTimeout: 500,
  enabled: true,
});
```

---

### `useSupportedKeyCodes`

```ts
function useSupportedKeyCodes(): KeyCode[];
```

Query the native module for the set of hardware key codes the current device
reports as supported.

- Returns an empty array (`[]`) while the query is in flight or when it fails.
- Only returns values that are members of the `KeyCode` enum — unknown strings
  reported by the device are silently filtered out.
- The query runs once on mount; the result never changes for the lifetime of
  the process.

#### Example

```tsx
function DeviceCapabilities() {
  const supported = useSupportedKeyCodes();

  return (
    <View>
      {supported.map((code) => (
        <Text key={code}>{code}</Text>
      ))}
    </View>
  );
}
```

---

## Imperative API

### `registerHardwareKeyEvent`

```ts
async function registerHardwareKeyEvent(
  options: RegisterHardwareKeyEventOptions
): Promise<HardwareKeyEventListener>;
```

Register for hardware key events **outside of a React component** — useful in
Redux sagas, vanilla-JS services, navigation guards, or any non-React context.

#### Options

Same as `UseHardwareKeyEventOptions` minus `enabled`:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `keys` | `KeyCode[]` | yes | — | Key codes to observe. |
| `onKeyDown` | `(event: KeyEvent) => void` | no | — | Called for every key-down / repeat event. |
| `onKeyUp` | `(event: KeyEvent) => void` | no | — | Called for every key-up event. |
| `onLongPress` | `(event: KeyEvent) => void` | no | — | Called once when a key is held for `longPressTimeout` ms. |
| `longPressTimeout` | `number` | no | `500` | Long-press detection threshold in ms. |

#### Return value

`Promise<HardwareKeyEventListener>`:

| Property | Type | Description |
|---|---|---|
| `listenerId` | `string` | Opaque ID assigned by the native layer. Every `KeyEvent` carries a matching `listenerId`. |
| `unregister` | `() => Promise<void>` | Permanently remove this listener. Safe to call multiple times (subsequent calls are no-ops). |

#### Example

```ts
const listener = await registerHardwareKeyEvent({
  keys: [KeyCode.VOLUME_UP],
  onKeyDown: (event) => console.log('Down:', event.keyCodeString),
  onLongPress: (event) => console.log('Long press:', event.keyCodeString),
});

// Later …
await listener.unregister();
```

---

## Key codes

### `KeyCode` constants

```ts
const KeyCode: {
  VOLUME_UP: 'KEYCODE_VOLUME_UP';
  VOLUME_DOWN: 'KEYCODE_VOLUME_DOWN';
  // … 49 more
} as const;
```

A `const` object mapping friendly JavaScript identifiers to Android key-code
constant strings. Use these values everywhere you would previously have written
raw strings like `'KEYCODE_VOLUME_UP'`.

All 51 constants are listed in the [Key Codes Reference](./keycodes.md).

### `KeyCode` type

```ts
type KeyCode = (typeof KeyCode)[keyof typeof KeyCode];
```

The union of all supported key-code string literals. Use this as the type for
any parameter or variable that must hold a recognised key-code constant.

### `isKeyCode`

```ts
function isKeyCode(value: string): value is KeyCode;
```

Type guard that checks whether an arbitrary string is one of the recognised
`KeyCode` constants. Useful for validating dynamic strings (e.g. from a config
file or user input).

```ts
const raw = 'KEYCODE_VOLUME_UP';
if (isKeyCode(raw)) {
  // raw is narrowed to KeyCode
  console.log(raw); // TypeScript knows this is a KeyCode
}
```

### `keyCodeToName`

```ts
function keyCodeToName(keyCodeString: string): string | undefined;
```

Reverse lookup: given an Android key-code string (e.g. `"KEYCODE_VOLUME_UP"`),
returns the friendly property name (`"VOLUME_UP"`) or `undefined` when the
string is unknown.

```ts
keyCodeToName('KEYCODE_VOLUME_UP'); // "VOLUME_UP"
keyCodeToName('SOMETHING_ELSE');   // undefined
```

### `ALL_KEY_CODES`

```ts
const ALL_KEY_CODES: readonly KeyCode[];
```

All key-code values as a plain string array. Convenient for iteration:

```ts
for (const keyCode of ALL_KEY_CODES) {
  console.log(keyCode); // "KEYCODE_VOLUME_UP", …
}
```

---

## Types

### `KeyEvent`

Payload delivered to every registered callback.

```ts
interface KeyEvent {
  listenerId: string;
  keyCode: number;
  keyCodeString: string;
  action: KeyAction;
  metaState: number;
  repeatCount: number;
  deviceId: number;
  flags: number;
  errorMsg?: string;
}
```

| Field | Type | Description |
|---|---|---|
| `listenerId` | `string` | Registration UUID that matched this event. |
| `keyCode` | `number` | Android `KeyEvent.getKeyCode()` value (e.g. `24` for `KEYCODE_VOLUME_UP`). |
| `keyCodeString` | `string` | Human-readable constant name (e.g. `"KEYCODE_VOLUME_UP"`). |
| `action` | `KeyAction` | Whether the key went down, went up, is repeating, or represents an error. |
| `metaState` | `number` | Android `KeyEvent.getMetaState()` bitmask — modifier keys held at the time of the event. |
| `repeatCount` | `number` | Android `KeyEvent.getRepeatCount()` — number of times the key repeated while held. |
| `deviceId` | `number` | Android `KeyEvent.getDeviceId()` — ID of the input device. |
| `flags` | `number` | Android `KeyEvent.getFlags()` bitmask. |
| `errorMsg` | `string \| undefined` | Human-readable error description. Only set when `action` is `"error"`. |

#### Usage patterns

```ts
// Distinguish long-press repeats from the initial press
if (event.repeatCount > 0) {
  console.log(`Held for ${event.repeatCount} repeats`);
}

// React differently when a modifier is held
if (event.metaState & 1) { // META_SHIFT_ON
  console.log('Shift is held');
}

// React differently per input device
if (event.deviceId === 0) {
  console.log('Built-in key');
} else {
  console.log(`External device ${event.deviceId}`);
}
```

### `KeyAction`

```ts
type KeyAction = 'down' | 'up' | 'multiple' | 'error' | 'unknown';
```

| Value | Meaning |
|---|---|
| `"down"` | Key was pressed down. |
| `"up"` | Key was released. |
| `"multiple"` | Key repeat — rare for hardware keys, semantics vary across Android versions. |
| `"error"` | An error occurred during event processing. Check `event.errorMsg`. |
| `"unknown"` | A future or unrecognised Android KeyEvent action was received. |

### `KeyCodeInfo`

Metadata about a single key code the device reports as supported. Returned by
`getSupportedKeyCodes`.

```ts
interface KeyCodeInfo {
  keyCode: number;
  keyCodeString: string;
  label: string | null;
  isGamepad: boolean;
  isSystem: boolean;
}
```

| Field | Type | Description |
|---|---|---|
| `keyCode` | `number` | Numeric Android key code. |
| `keyCodeString` | `string` | Human-readable constant name. |
| `label` | `string \| null` | `KeyCharacterMap.getDisplayLabel(keyCode)` — null when unavailable. |
| `isGamepad` | `boolean` | `true` when `KeyEvent.isGamepadButton(keyCode)`. |
| `isSystem` | `boolean` | `true` when `KeyEvent.isSystemKey(keyCode)`. |

---

## TurboModule (advanced)

The `HardwareKeyEvent` TurboModule is available for advanced use cases
(vanilla-JS environments, custom abstractions). Prefer the hook or imperative
API above unless you need direct control.

```ts
import HardwareKeyEvent from 'react-native-hardwarekey-event';
```

### `HardwareKeyEvent.registerListener`

```ts
registerListener(params: {
  keyCodeStrings: string[];
}): Promise<{ listenerId: string }>;
```

Register a listener for one or more hardware-key events. Returns an opaque
`listenerId` that must be used to unregister later.

- Unknown/unsupported entries in `keyCodeStrings` are silently ignored.
- Multiple concurrent registrations are supported.
- Rejects with a platform error when registration fails (e.g. native module
  cannot start listening).

### `HardwareKeyEvent.unregisterListener`

```ts
unregisterListener(listenerId: string): Promise<void>;
```

Remove a previously registered listener. Once resolved, the listener will no
longer receive key events.

- Safe to call with an unknown or already-removed ID (no-op).
- Rejects with a platform error when native unregistration fails.

### `HardwareKeyEvent.getSupportedKeyCodes`

```ts
getSupportedKeyCodes(): Promise<KeyCodeInfo[]>;
```

Query the set of hardware key codes the current device reports as supported.
Returns a `KeyCodeInfo` array for every `KEYCODE_*` constant known to the
Android runtime.

### `HardwareKeyEvent.onKeyEvent`

```ts
onKeyEvent: EventEmitter<KeyEvent>;
```

A shared event stream that fires for every hardware key event matching any
currently registered listener. Each event includes a `listenerId` so consumers
can route events to the correct handler.

**There is no separate `onError` event emitter.** Errors are surfaced through
the promise rejections of `registerListener`/`unregisterListener` and through
`onKeyEvent` payloads with `action: "error"`.

```ts
const subscription = HardwareKeyEvent.onKeyEvent((event) => {
  if (event.listenerId !== myListenerId) return;
  if (event.action === 'error') {
    console.error(event.errorMsg);
    return;
  }
  // handle normal event …
});

// Later:
subscription.remove();
```
