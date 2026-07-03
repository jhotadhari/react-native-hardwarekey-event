# react-native-hardwarekey-event

React Native TurboModule for responding to Android hardware key events (volume
buttons, media keys, D-pad, and more) — no Activity inheritance required. iOS
volume keys supported via `AVAudioSession` KVO.

## Requirements

- React Native 0.72+ with **New Architecture** enabled (`newArchEnabled=true`)
- Android API 24+ (Android 7.0)
- iOS: volume keys only (platform limitation — [details](docs/ios.md))

## Install

```sh
npm install react-native-hardwarekey-event
```

**No Activity changes needed.** The library installs itself automatically via
`Window.Callback` interception.

## Quick start

```tsx
import {
  useHardwareKeyEvent,
  KeyCode,
} from 'react-native-hardwarekey-event';
import type { KeyEvent } from 'react-native-hardwarekey-event';

function VolumeButtonHandler() {
  const { isRegistered, error } = useHardwareKeyEvent({
    keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN],
    onKeyDown: (event: KeyEvent) => {
      console.log(`${event.keyCodeString} pressed`);
    },
    onLongPress: (event: KeyEvent) => {
      console.log(`${event.keyCodeString} held`);
    },
  });

  if (error) return <Text>Error: {error.message}</Text>;
  return <Text>{isRegistered ? 'Listening…' : 'Idle'}</Text>;
}
```

## Features

- **No Activity inheritance** — auto-installs via `Window.Callback` interception
- **Multi-listener** — multiple hooks/components can observe different key sets
- **Type-safe key codes** — `KeyCode` enum with 51 constants; TypeScript catches typos
- **Long-press detection** — built-in, configurable timeout
- **Rich event payload** — `listenerId`, `keyCode`, `action`, `metaState`,
  `repeatCount`, `deviceId`, `flags`
- **Feature detection** — `useSupportedKeyCodes()` queries device capabilities
- **Imperative API** — use outside React (Redux sagas, vanilla JS services)

## Documentation

| Document | Content |
|---|---|
| [API Reference](docs/api-reference.md) | Every export with signatures, options, and examples |
| [Key Codes Reference](docs/keycodes.md) | All 51 supported key codes grouped by category |
| [Android Setup](docs/android-setup.md) | New Architecture requirements, auto-install, troubleshooting |
| [iOS Support](docs/ios.md) | Current state, limitations, volume-key observation |
| [Architecture](docs/architecture.md) | Native interceptor chain, JS layer, data flow |
| [Testing](docs/testing.md) | Jest, example app, on-device checklist |
| [Migration Guide](MIGRATION.md) | 0.0.x → 1.0.0 step-by-step migration |

## Usage patterns

### Type-safe key codes

```ts
import { KeyCode, isKeyCode, ALL_KEY_CODES } from 'react-native-hardwarekey-event';

// Compile-time error on typos:
useHardwareKeyEvent({ keys: [KeyCode.VOLUME_UP], onKeyDown: fn });

// Validate dynamic strings:
if (isKeyCode(someUnknownString)) {
  // someUnknownString is now typed as KeyCode
}
```

### Multiple concurrent listeners

```tsx
function MediaController() {
  useHardwareKeyEvent({ keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN], onKeyDown: handleVolume });
  useHardwareKeyEvent({ keys: [KeyCode.MEDIA_NEXT, KeyCode.MEDIA_PREVIOUS], onKeyDown: handleTrack });
  // Both work independently — no interference
}
```

### Imperative API (non-React)

```ts
import { registerHardwareKeyEvent, KeyCode } from 'react-native-hardwarekey-event';

const listener = await registerHardwareKeyEvent({
  keys: [KeyCode.VOLUME_UP],
  onKeyDown: (event) => console.log(event.keyCodeString),
});

// Later:
await listener.unregister();
```

### Key event payload

Every callback receives a `KeyEvent`:

| Field | Type | Description |
|---|---|---|
| `listenerId` | `string` | Registration UUID |
| `keyCode` | `number` | Android key code integer |
| `keyCodeString` | `string` | Constant name (e.g. `"KEYCODE_VOLUME_UP"`) |
| `action` | `"down"` \| `"up"` \| `"multiple"` \| `"error"` \| `"unknown"` | Key action |
| `metaState` | `number` | Modifier key bitmask |
| `repeatCount` | `number` | Key repeats while held |
| `deviceId` | `number` | Input device ID |
| `flags` | `number` | KeyEvent flags bitmask |
| `errorMsg` | `string \| undefined` | Error description (only when `action: "error"`) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.

## License

MIT
