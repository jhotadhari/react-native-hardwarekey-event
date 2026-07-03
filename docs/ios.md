# iOS Support

iOS support is **partial** — only volume up/down keys are observable. This is a
platform limitation, not a library limitation: iOS does not expose a public API
for intercepting arbitrary hardware key events.

## What works

| Feature | Status |
|---|---|
| Volume up detection | ✅ |
| Volume down detection | ✅ |
| System volume HUD suppression | ✅ |
| Multiple concurrent listeners | ✅ |
| Audio session interruption handling | ✅ |
| Media services reset recovery | ✅ |
| TurboModule (New Architecture) | ✅ |
| Old Architecture (bridge) | ✅ |

## What doesn't work

| Feature | Reason |
|---|---|
| Non-volume keys (Home, Back, Media, D-Pad, …) | No public iOS API |
| Separate key-up events | iOS volume changes are instantaneous — every change is emitted as `action: "down"` |
| `KEYCODE_VOLUME_MUTE` | iOS has no mute key event |
| `metaState`, `repeatCount`, `deviceId`, `flags` | These are Android concepts — always `0` on iOS |
| `onLongPress` for volume keys | No separate down/up transition — long-press cannot be distinguished from a single press |

## How it works

### Volume observation

The library uses Key-Value Observing (KVO) on `AVAudioSession.outputVolume`:

1. When the first listener is registered, the audio session is activated with
   `AVAudioSessionCategoryPlayback` + `MixWithOthers` (so background audio is
   not interrupted).
2. An observer is added for `outputVolume` on the shared `AVAudioSession`.
3. When the user presses a physical volume button, iOS changes the system volume
   and the KVO callback fires.
4. The library compares `newVolume` to `previousVolume` to determine direction
   (up or down).
5. An event is dispatched to all listeners whose key set includes the changed
   key.

### Volume HUD suppression

iOS shows a system volume HUD by default when the volume changes. The library
suppresses it by adding an off-screen, nearly-transparent `MPVolumeView` to the
key window. This is a well-known technique used by many media apps.

### Audio session lifecycle

| Event | Behavior |
|---|---|
| First listener registered | Activate audio session, start KVO, add HUD suppression |
| Last listener unregistered | Deactivate audio session, stop KVO, remove HUD suppression |
| Phone call / Siri (interruption began) | Emit error event via `action: "error"` |
| Interruption ended | Re-activate audio session if `ShouldResume` flag is set |
| Media services reset | Tear down and re-create observation |

### Architecture (dual emission)

The iOS TurboModule supports both architectures:

- **New Architecture:** events travel via the codegen-generated
  `EventEmitterCallback` (JSI).
- **Old Architecture:** events travel via `-[RCTEventEmitter sendEventWithName:body:]`.

The module checks `_hasTurboEventCallback` at emit time to choose the correct path.

## Usage on iOS

The API is identical to Android. Use the same hook:

```tsx
import { useHardwareKeyEvent, KeyCode } from 'react-native-hardwarekey-event';

function VolumeHandler() {
  const { isRegistered, error } = useHardwareKeyEvent({
    keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN],
    onKeyDown: (event) => {
      // On iOS, every volume change fires this.
      // event.action is always "down".
      // event.keyCodeString is "KEYCODE_VOLUME_UP" or "KEYCODE_VOLUME_DOWN".
      console.log(event.keyCodeString);
    },
    // onKeyUp and onLongPress are never invoked on iOS.
  });

  if (error) return <Text>Error: {error.message}</Text>;
  return <Text>{isRegistered ? 'Listening…' : 'Idle'}</Text>;
}
```

### Feature detection

Use `useSupportedKeyCodes` to check what the platform supports:

```tsx
import { useSupportedKeyCodes, KeyCode } from 'react-native-hardwarekey-event';

function DeviceCapabilities() {
  const supported = useSupportedKeyCodes();

  // On iOS, this returns at most:
  // [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN]
  // On Android, this returns all KEYCODE_* constants the device knows about.

  const hasVolumeKeys = supported.includes(KeyCode.VOLUME_UP);

  return <Text>{hasVolumeKeys ? 'Volume keys available' : 'No volume keys'}</Text>;
}
```

### Platform-specific code

Use React Native's `Platform` module to conditionally enable iOS-only or
Android-only behavior:

```tsx
import { Platform } from 'react-native';

useHardwareKeyEvent({
  keys: [
    KeyCode.VOLUME_UP,
    KeyCode.VOLUME_DOWN,
    // These only work on Android — silently ignored on iOS:
    ...(Platform.OS === 'android'
      ? [KeyCode.MEDIA_PLAY_PAUSE, KeyCode.MEDIA_NEXT]
      : []),
  ],
  onKeyDown: (event) => {
    console.log(event.keyCodeString);
  },
});
```

## Known issues

### Volume returns to previous level after unregister

The library restores the audio session on teardown but does not restore the
volume level. This is by design — the library observes volume, it does not
control it.

### Volume HUD flashes briefly on first press

On some iOS versions, the `MPVolumeView` may not be added to the view hierarchy
quickly enough to suppress the very first volume HUD. This is a race condition
inherent to the technique. Subsequent presses are suppressed normally.

### No events while app is in background

iOS suspends the audio session when the app enters the background. Volume
events are not delivered. This matches iOS's general behavior for backgrounded
apps.

## Future direction

Full hardware key support on iOS is not possible with public APIs. The following
would improve iOS support within those constraints:

- **`AVAudioSession.interruptionType` handling for silent mode switch** — the
  ring/silent switch triggers an interruption notification on some devices.
- **MFi game controller support** — `GCController` framework can observe
  gamepad button presses, which map to D-pad and basic input keys.
- **Headset remote control** — `MPRemoteCommandCenter` can observe headset
  play/pause/next/previous buttons.

If you're interested in contributing any of these, see
[`CONTRIBUTING.md`](../CONTRIBUTING.md).
