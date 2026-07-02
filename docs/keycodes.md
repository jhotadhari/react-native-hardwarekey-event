# Key Codes Reference

All 51 `KeyCode` constants supported by `react-native-hardwarekey-event`, grouped by category.

Use these with the `KeyCode` enum — TypeScript catches typos at compile time:

```ts
import { KeyCode } from 'react-native-hardwarekey-event';

useHardwareKeyEvent({
  keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN],
  onKeyDown: (event) => console.log(event.keyCodeString),
});
```

## Volume

| Enum | Android constant | Key code | iOS support |
|---|---|---|---|
| `KeyCode.VOLUME_UP` | `KEYCODE_VOLUME_UP` | 24 | ✅ |
| `KeyCode.VOLUME_DOWN` | `KEYCODE_VOLUME_DOWN` | 25 | ✅ |
| `KeyCode.VOLUME_MUTE` | `KEYCODE_VOLUME_MUTE` | 164 | — |

## Navigation / System

| Enum | Android constant | Key code |
|---|---|---|
| `KeyCode.HOME` | `KEYCODE_HOME` | 3 |
| `KeyCode.BACK` | `KEYCODE_BACK` | 4 |
| `KeyCode.MENU` | `KEYCODE_MENU` | 82 |
| `KeyCode.APP_SWITCH` | `KEYCODE_APP_SWITCH` | 187 |
| `KeyCode.SEARCH` | `KEYCODE_SEARCH` | 84 |
| `KeyCode.NOTIFICATION` | `KEYCODE_NOTIFICATION` | 83 |

## Call

| Enum | Android constant | Key code |
|---|---|---|
| `KeyCode.CALL` | `KEYCODE_CALL` | 5 |
| `KeyCode.ENDCALL` | `KEYCODE_ENDCALL` | 6 |
| `KeyCode.HEADSETHOOK` | `KEYCODE_HEADSETHOOK` | 79 |

## Camera

| Enum | Android constant | Key code |
|---|---|---|
| `KeyCode.CAMERA` | `KEYCODE_CAMERA` | 27 |
| `KeyCode.FOCUS` | `KEYCODE_FOCUS` | 80 |

## Power / Wake

| Enum | Android constant | Key code |
|---|---|---|
| `KeyCode.POWER` | `KEYCODE_POWER` | 26 |
| `KeyCode.SLEEP` | `KEYCODE_SLEEP` | 223 |
| `KeyCode.WAKEUP` | `KEYCODE_WAKEUP` | 224 |

## Media

| Enum | Android constant | Key code |
|---|---|---|
| `KeyCode.MEDIA_PLAY` | `KEYCODE_MEDIA_PLAY` | 126 |
| `KeyCode.MEDIA_PAUSE` | `KEYCODE_MEDIA_PAUSE` | 127 |
| `KeyCode.MEDIA_PLAY_PAUSE` | `KEYCODE_MEDIA_PLAY_PAUSE` | 85 |
| `KeyCode.MEDIA_STOP` | `KEYCODE_MEDIA_STOP` | 86 |
| `KeyCode.MEDIA_NEXT` | `KEYCODE_MEDIA_NEXT` | 87 |
| `KeyCode.MEDIA_PREVIOUS` | `KEYCODE_MEDIA_PREVIOUS` | 88 |
| `KeyCode.MEDIA_REWIND` | `KEYCODE_MEDIA_REWIND` | 89 |
| `KeyCode.MEDIA_FAST_FORWARD` | `KEYCODE_MEDIA_FAST_FORWARD` | 90 |
| `KeyCode.MEDIA_RECORD` | `KEYCODE_MEDIA_RECORD` | 130 |

## D-Pad

| Enum | Android constant | Key code |
|---|---|---|
| `KeyCode.DPAD_UP` | `KEYCODE_DPAD_UP` | 19 |
| `KeyCode.DPAD_DOWN` | `KEYCODE_DPAD_DOWN` | 20 |
| `KeyCode.DPAD_LEFT` | `KEYCODE_DPAD_LEFT` | 21 |
| `KeyCode.DPAD_RIGHT` | `KEYCODE_DPAD_RIGHT` | 22 |
| `KeyCode.DPAD_CENTER` | `KEYCODE_DPAD_CENTER` | 23 |

## Channel / Program

| Enum | Android constant | Key code |
|---|---|---|
| `KeyCode.CHANNEL_UP` | `KEYCODE_CHANNEL_UP` | 166 |
| `KeyCode.CHANNEL_DOWN` | `KEYCODE_CHANNEL_DOWN` | 167 |

## Text Navigation

| Enum | Android constant | Key code |
|---|---|---|
| `KeyCode.PAGE_UP` | `KEYCODE_PAGE_UP` | 92 |
| `KeyCode.PAGE_DOWN` | `KEYCODE_PAGE_DOWN` | 93 |
| `KeyCode.MOVE_HOME` | `KEYCODE_MOVE_HOME` | 122 |
| `KeyCode.MOVE_END` | `KEYCODE_MOVE_END` | 123 |

## Basic Input

| Enum | Android constant | Key code |
|---|---|---|
| `KeyCode.ENTER` | `KEYCODE_ENTER` | 66 |
| `KeyCode.DEL` | `KEYCODE_DEL` | 67 |
| `KeyCode.FORWARD_DEL` | `KEYCODE_FORWARD_DEL` | 112 |
| `KeyCode.TAB` | `KEYCODE_TAB` | 61 |
| `KeyCode.SPACE` | `KEYCODE_SPACE` | 62 |
| `KeyCode.ESCAPE` | `KEYCODE_ESCAPE` | 111 |

## TV / Set-top box

| Enum | Android constant | Key code |
|---|---|---|
| `KeyCode.TV` | `KEYCODE_TV` | 170 |
| `KeyCode.GUIDE` | `KEYCODE_GUIDE` | 172 |
| `KeyCode.DVR` | `KEYCODE_DVR` | 173 |
| `KeyCode.INFO` | `KEYCODE_INFO` | 165 |
| `KeyCode.SETTINGS` | `KEYCODE_SETTINGS` | 176 |
| `KeyCode.CAPTIONS` | `KEYCODE_CAPTIONS` | 175 |

## Assistants

| Enum | Android constant | Key code |
|---|---|---|
| `KeyCode.ASSIST` | `KEYCODE_ASSIST` | 219 |
| `KeyCode.VOICE_ASSIST` | `KEYCODE_VOICE_ASSIST` | 231 |

## Zoom

| Enum | Android constant | Key code |
|---|---|---|
| `KeyCode.ZOOM_IN` | `KEYCODE_ZOOM_IN` | 168 |
| `KeyCode.ZOOM_OUT` | `KEYCODE_ZOOM_OUT` | 169 |

## Utilities

These helpers work with the `KeyCode` constants:

```ts
import {
  KeyCode,
  type KeyCode,       // the union type of all value strings
  ALL_KEY_CODES,       // readonly KeyCode[] — all 51 values
  isKeyCode,           // (v: string) => v is KeyCode
  keyCodeToName,       // (keyCodeString: string) => string | undefined
} from 'react-native-hardwarekey-event';
```

| Export | Type | Description |
|---|---|---|
| `KeyCode` | `const` object | 51 `KEYCODE_*` string constants keyed by friendly name. |
| `KeyCode` (type) | `type` | Union of all 51 string literal values. |
| `ALL_KEY_CODES` | `readonly KeyCode[]` | Every key-code value as a flat array. |
| `isKeyCode` | `(v: string) => v is KeyCode` | Type guard for runtime validation. |
| `keyCodeToName` | `(s: string) => string \| undefined` | Reverse: `"KEYCODE_VOLUME_UP"` → `"VOLUME_UP"`. |

### Dynamic key code validation

```ts
import { isKeyCode, type KeyCode } from 'react-native-hardwarekey-event';

function toKeyCode(raw: string): KeyCode | null {
  return isKeyCode(raw) ? raw : null;
}
```
