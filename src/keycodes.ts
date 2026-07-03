/**
 * Type-safe constants for Android `KeyEvent.KEYCODE_*` values.
 *
 * Each property maps a friendly JavaScript identifier to the corresponding
 * Android key-code constant string understood by the native module.  Use
 * these values everywhere you would previously have written raw strings like
 * `'KEYCODE_VOLUME_UP'`.
 *
 * ## Usage
 *
 * ```ts
 * import { KeyCode } from 'react-native-hardwarekey-event';
 *
 * useHardwareKeyEvent({
 *   keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN],
 *   onKeyDown: (event) => console.log(event.keyCodeString),
 * });
 * ```
 *
 * The companion **`KeyCode` type** is the union of all value strings, so
 * TypeScript will flag typos and unsupported keys at compile time.
 */

export const KeyCode = {
	// ── Volume ──────────────────────────────────────────────────────────
	VOLUME_UP: 'KEYCODE_VOLUME_UP',
	VOLUME_DOWN: 'KEYCODE_VOLUME_DOWN',
	VOLUME_MUTE: 'KEYCODE_VOLUME_MUTE',

	// ── Navigation / System ────────────────────────────────────────────
	HOME: 'KEYCODE_HOME',
	BACK: 'KEYCODE_BACK',
	MENU: 'KEYCODE_MENU',
	APP_SWITCH: 'KEYCODE_APP_SWITCH',
	SEARCH: 'KEYCODE_SEARCH',
	NOTIFICATION: 'KEYCODE_NOTIFICATION',

	// ── Call ────────────────────────────────────────────────────────────
	CALL: 'KEYCODE_CALL',
	ENDCALL: 'KEYCODE_ENDCALL',
	HEADSETHOOK: 'KEYCODE_HEADSETHOOK',

	// ── Camera ──────────────────────────────────────────────────────────
	CAMERA: 'KEYCODE_CAMERA',
	FOCUS: 'KEYCODE_FOCUS',

	// ── Power / Wake ────────────────────────────────────────────────────
	POWER: 'KEYCODE_POWER',
	SLEEP: 'KEYCODE_SLEEP',
	WAKEUP: 'KEYCODE_WAKEUP',

	// ── Media ───────────────────────────────────────────────────────────
	MEDIA_PLAY: 'KEYCODE_MEDIA_PLAY',
	MEDIA_PAUSE: 'KEYCODE_MEDIA_PAUSE',
	MEDIA_PLAY_PAUSE: 'KEYCODE_MEDIA_PLAY_PAUSE',
	MEDIA_STOP: 'KEYCODE_MEDIA_STOP',
	MEDIA_NEXT: 'KEYCODE_MEDIA_NEXT',
	MEDIA_PREVIOUS: 'KEYCODE_MEDIA_PREVIOUS',
	MEDIA_REWIND: 'KEYCODE_MEDIA_REWIND',
	MEDIA_FAST_FORWARD: 'KEYCODE_MEDIA_FAST_FORWARD',
	MEDIA_RECORD: 'KEYCODE_MEDIA_RECORD',

	// ── D-Pad ───────────────────────────────────────────────────────────
	DPAD_UP: 'KEYCODE_DPAD_UP',
	DPAD_DOWN: 'KEYCODE_DPAD_DOWN',
	DPAD_LEFT: 'KEYCODE_DPAD_LEFT',
	DPAD_RIGHT: 'KEYCODE_DPAD_RIGHT',
	DPAD_CENTER: 'KEYCODE_DPAD_CENTER',

	// ── Channel / Program ───────────────────────────────────────────────
	CHANNEL_UP: 'KEYCODE_CHANNEL_UP',
	CHANNEL_DOWN: 'KEYCODE_CHANNEL_DOWN',

	// ── Text Navigation ─────────────────────────────────────────────────
	PAGE_UP: 'KEYCODE_PAGE_UP',
	PAGE_DOWN: 'KEYCODE_PAGE_DOWN',
	MOVE_HOME: 'KEYCODE_MOVE_HOME',
	MOVE_END: 'KEYCODE_MOVE_END',

	// ── Basic Input ─────────────────────────────────────────────────────
	ENTER: 'KEYCODE_ENTER',
	DEL: 'KEYCODE_DEL',
	FORWARD_DEL: 'KEYCODE_FORWARD_DEL',
	TAB: 'KEYCODE_TAB',
	SPACE: 'KEYCODE_SPACE',
	ESCAPE: 'KEYCODE_ESCAPE',

	// ── TV / Set-top box ────────────────────────────────────────────────
	TV: 'KEYCODE_TV',
	GUIDE: 'KEYCODE_GUIDE',
	DVR: 'KEYCODE_DVR',
	INFO: 'KEYCODE_INFO',
	SETTINGS: 'KEYCODE_SETTINGS',
	CAPTIONS: 'KEYCODE_CAPTIONS',

	// ── Assistants ──────────────────────────────────────────────────────
	ASSIST: 'KEYCODE_ASSIST',
	VOICE_ASSIST: 'KEYCODE_VOICE_ASSIST',

	// ── Zoom ────────────────────────────────────────────────────────────
	ZOOM_IN: 'KEYCODE_ZOOM_IN',
	ZOOM_OUT: 'KEYCODE_ZOOM_OUT',
} as const;

/**
 * Union of all supported key-code string literals.
 *
 * Use this as the type for any parameter or variable that must hold a
 * recognised Android key-code constant.
 */
export type KeyCode = (typeof KeyCode)[keyof typeof KeyCode];

/**
 * All key-code values as a plain string array.
 *
 * Convenient when you need to iterate over every known key constant
 * (e.g. for feature detection or testing).
 */
export const ALL_KEY_CODES: readonly KeyCode[] = Object.values(
	KeyCode
) as readonly KeyCode[];

/**
 * Reverse lookup: given an Android key-code string (e.g.
 * `"KEYCODE_VOLUME_UP"`), return the friendly property name
 * (`"VOLUME_UP"`) or `undefined` when the string is unknown.
 */
export function keyCodeToName(keyCodeString: string): string | undefined {
	for (const [name, value] of Object.entries(KeyCode)) {
		if (value === keyCodeString) {
			return name;
		}
	}
	return undefined;
}

/**
 * Check whether an arbitrary string is one of the recognised
 * `KeyCode` constants.
 */
export function isKeyCode(value: string): value is KeyCode {
	return (ALL_KEY_CODES as readonly string[]).includes(value);
}
