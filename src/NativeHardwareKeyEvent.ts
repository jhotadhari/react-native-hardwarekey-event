import { TurboModuleRegistry, type TurboModule } from 'react-native';
import type {
  EventEmitter,
  Int32,
} from 'react-native/Libraries/Types/CodegenTypes';

// ---------------------------------------------------------------------------
// Key event action
// ---------------------------------------------------------------------------

/**
 * The action performed by a hardware key.
 *
 * - `"down"`  – the key was pressed down
 * - `"up"`    – the key was released
 * - `"multiple"` – the key was pressed repeatedly (key repeat)
 */
export type KeyAction = 'down' | 'up' | 'multiple';

// ---------------------------------------------------------------------------
// Core event payload
// ---------------------------------------------------------------------------

/**
 * Rich payload delivered on every registered hardware key event.
 *
 * @property listenerId  – The registration ID that matched this event.
 * @property keyCode     – Android `KeyEvent.getKeyCode()` value.
 * @property keyCodeString – Human-readable constant name (e.g.
 *                         `"KEYCODE_VOLUME_UP"`).
 * @property action      – Whether the key went down, went up, or is
 *                         repeating.
 * @property metaState   – Android `KeyEvent.getMetaState()` bitmask
 *                         (Modifier keys held at the time of the event).
 * @property repeatCount – Android `KeyEvent.getRepeatCount()`.
 * @property deviceId    – Android `KeyEvent.getDeviceId()`.
 * @property flags       – Android `KeyEvent.getFlags()` bitmask.
 */
export interface KeyEvent {
  /** Unique listener registration ID that matched this event. */
  listenerId: string;
  /** Numeric Android key code (e.g. 24 for KEYCODE_VOLUME_UP). */
  keyCode: Int32;
  /** Human-readable key code constant name. */
  keyCodeString: string;
  /** Whether the key went down, went up, or is repeating. */
  action: KeyAction;
  /** Bitmask of active meta / modifier keys (META_*, CTRL_*, ALT_*, SHIFT_*). */
  metaState: Int32;
  /** Number of times the key repeated while held down. */
  repeatCount: Int32;
  /** ID of the input device that generated this event. */
  deviceId: Int32;
  /** Android KeyEvent flags bitmask (FLAG_* constants). */
  flags: Int32;
}

// ---------------------------------------------------------------------------
// Listener registration
// ---------------------------------------------------------------------------

/**
 * Parameters for registering a hardware-key listener.
 *
 * @property keyCodeStrings – Array of key code constant names to observe
 *                            (e.g. `["KEYCODE_VOLUME_UP",
 *                            "KEYCODE_VOLUME_DOWN"]`).
 */
export interface RegisterListenerParams {
  /**
   * Android `KeyEvent.KEYCODE_*` constant names.
   * Unknown / unsupported entries are silently ignored by the native layer.
   */
  keyCodeStrings: ReadonlyArray<string>;
}

/**
 * Returned by `registerListener` on success.
 *
 * @property listenerId – Opaque registration ID. Pass it to
 *                        `unregisterListener` when you no longer need the
 *                        listener.
 */
export interface RegisterListenerResponse {
  /** Opaque registration identifier. */
  listenerId: string;
}

// ---------------------------------------------------------------------------
// Supported key-code introspection
// ---------------------------------------------------------------------------

/**
 * Metadata about a single key code the device reports as supported.
 *
 * @property keyCode     – Numeric Android key code.
 * @property keyCodeString – Human-readable constant name.
 * @property label       – Android `KeyCharacterMap.getDisplayLabel(keyCode)`
 *                         or null when not available.
 * @property isGamepad   – `true` when `KeyEvent.isGamepadButton(keyCode)`.
 * @property isSystem    – `true` when `KeyEvent.isSystemKey(keyCode)`.
 */
export interface KeyCodeInfo {
  /** Numeric Android key code. */
  keyCode: Int32;
  /** Human-readable key code constant name (e.g. "KEYCODE_VOLUME_UP"). */
  keyCodeString: string;
  /** Display label for the key, may be null. */
  label: string | null;
  /** True if this key code belongs to a gamepad button. */
  isGamepad: boolean;
  /** True if this is a system key (HOME, RECENT, etc.). */
  isSystem: boolean;
}

// ---------------------------------------------------------------------------
// TurboModule spec
// ---------------------------------------------------------------------------

export interface Spec extends TurboModule {
  /**
   * Register a listener for one or more hardware-key events.
   *
   * The returned `listenerId` must be used to unregister later. Multiple
   * registrations can co-exist; each registration independently fires
   * `onKeyEvent` with its own `listenerId` in the payload.
   *
   * @param params.keyCodeStrings – `KEYCODE_*` constant names to observe.
   * @returns A promise that resolves with the opaque listener ID, or rejects
   *          with a platform error when registration fails (e.g. the native
   *          module could not start listening).
   */
  registerListener(
    params: RegisterListenerParams
  ): Promise<RegisterListenerResponse>;

  /**
   * Unregister a previously registered listener.
   *
   * Once resolved the listener will no longer receive key events. Calling
   * this with an unknown or already-unregistered ID is a safe no-op.
   *
   * @param listenerId – The registration ID returned by `registerListener`.
   * @returns A promise that resolves on success, or rejects with a platform
   *          error when the native unregistration fails.
   */
  unregisterListener(listenerId: string): Promise<void>;

  /**
   * Query the set of hardware key codes the current device reports as
   * supported.
   *
   * This is useful for feature detection (e.g. does this device have
   * volume keys, a D-pad, or gamepad buttons?).
   *
   * @returns A promise that resolves with an array of `KeyCodeInfo` objects
   *          for every key code the native layer exposes, or rejects with a
   *          platform error when the query itself fails.
   */
  getSupportedKeyCodes(): Promise<ReadonlyArray<KeyCodeInfo>>;

  /**
   * Fires for every hardware key event that matches any currently registered
   * listener.
   *
   * The payload includes a `listenerId` field so consumers can route events
   * to the correct handler.
   *
   * Errors during event delivery are surfaced through the promise rejections
   * of the registration methods (`registerListener` /
   * `unregisterListener`) — there is no separate error event emitter.
   */
  onKeyEvent: EventEmitter<KeyEvent>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('HardwareKeyEvent');
