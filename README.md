# react-native-hardwarekey-event

Easily add JS callbacks to hardware KeyEvents — no Activity inheritance required.

## Requirements

The library uses a TurboModule and requires React Native New Architecture enabled.

`./android/gradle.properties`:
```properties
newArchEnabled=true
```

### Android only

iOS is not currently supported. If someone adds iOS support, a pull request would be welcome.

## Installation

```sh
# Using npm
npm install react-native-hardwarekey-event

# Using yarn
yarn add react-native-hardwarekey-event
```

**No Activity changes needed.** The library installs itself automatically via
`Window.Callback` interception — your `MainActivity` stays a plain
`ReactActivity`.

## Usage

### Hook API (recommended)

```tsx
import {
  useHardwareKeyEvent,
  KeyCode,
} from 'react-native-hardwarekey-event';
import type { KeyEvent } from 'react-native-hardwarekey-event';

export default function App() {
  const { isRegistered, error } = useHardwareKeyEvent({
    keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN],
    onKeyDown: (event: KeyEvent) => {
      console.log('Key down:', event.keyCodeString);
    },
    onKeyUp: (event: KeyEvent) => {
      console.log('Key up:', event.keyCodeString);
    },
    onLongPress: (event: KeyEvent) => {
      console.log('Long press:', event.keyCodeString);
    },
    longPressTimeout: 500, // ms, default 500
    enabled: true,         // default true — set false to pause
  });

  if (error) return <Text>Error: {error.message}</Text>;
  return <Text>{isRegistered ? 'Listening…' : 'Idle'}</Text>;
}
```

### Imperative API (non-React contexts)

```ts
import { registerHardwareKeyEvent, KeyCode } from 'react-native-hardwarekey-event';

const listener = await registerHardwareKeyEvent({
  keys: [KeyCode.VOLUME_UP],
  onKeyDown: (event) => console.log('Down:', event.keyCodeString),
  onLongPress: (event) => console.log('Long press:', event.keyCodeString),
});

// Later…
await listener.unregister(); // safe to call multiple times
```

### Feature detection

```tsx
import { useSupportedKeyCodes, KeyCode } from 'react-native-hardwarekey-event';

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

### Type-safe key codes

Use the `KeyCode` enum instead of raw strings — TypeScript catches typos at
compile time:

```ts
import { KeyCode, isKeyCode, ALL_KEY_CODES } from 'react-native-hardwarekey-event';

// Compile-time error: 'KeyCode.VOLUME_UPP' does not exist
// Correct:
console.log(KeyCode.VOLUME_UP); // 'KEYCODE_VOLUME_UP'

// Validate dynamic strings:
if (isKeyCode(someUnknownString)) {
  // someUnknownString is narrowed to KeyCode
}
```

### Multiple concurrent listeners

Each call to `useHardwareKeyEvent` (or `registerHardwareKeyEvent`) creates an
independent listener. Different parts of your app can observe different key
sets without interfering:

```tsx
function VolumeControl() {
  useHardwareKeyEvent({
    keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN],
    onKeyDown: handleVolume,
  });
  // …
}

function MediaControl() {
  useHardwareKeyEvent({
    keys: [KeyCode.MEDIA_PLAY_PAUSE, KeyCode.MEDIA_NEXT],
    onKeyDown: handleMedia,
  });
  // …
}
```

### Key event payload

Every callback receives a `KeyEvent` object:

| Field           | Type     | Description                                               |
|-----------------|----------|-----------------------------------------------------------|
| `listenerId`    | `string` | Registration UUID that matched this event                 |
| `keyCode`       | `number` | Android `KeyEvent.getKeyCode()`                           |
| `keyCodeString` | `string` | Constant name (e.g. `'KEYCODE_VOLUME_UP'`)                |
| `action`        | `string` | `'down'`, `'up'`, or `'multiple'`                         |
| `metaState`     | `number` | Modifier key bitmask                                      |
| `repeatCount`   | `number` | Key repeat count while held                               |
| `deviceId`      | `number` | Input device ID                                           |
| `flags`         | `number` | Android `KeyEvent` flags bitmask                          |

## Migration from 0.x

If you're migrating from v0.0.x, a backward-compatible wrapper is available:

```ts
// Old API — works via the compat path, emits deprecation warning in dev
import { useHardwareKeyEvent } from 'react-native-hardwarekey-event/compat';

useHardwareKeyEvent({
  callbacks: {
    KEYCODE_VOLUME_UP: (response) => console.log(response),
  },
  onError: (error) => console.log(error),
});
```

The compat wrapper will be removed in v2.0.0. See [`MIGRATION.md`](./MIGRATION.md)
for the full migration guide.

### Quick migration checklist

1. Remove `HardwareKeyListenerActivity` from `MainActivity` — revert to `ReactActivity()`
2. Switch to the new hook signature: `{ keys: KeyCode[], onKeyDown?, onKeyUp?, onLongPress? }`
3. Replace raw key strings with `KeyCode` enum values
4. The `onError` callback is gone — check `error` from the hook return instead

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
