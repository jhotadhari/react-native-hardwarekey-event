// ---------------------------------------------------------------------------
// Native TurboModule (internal — prefer the typed helpers below)
// ---------------------------------------------------------------------------
export { default as HardwareKeyEvent } from './NativeHardwareKeyEvent';

// ---------------------------------------------------------------------------
// Type-safe key-code constants
// ---------------------------------------------------------------------------
export { KeyCode, ALL_KEY_CODES, isKeyCode, keyCodeToName } from './keycodes';

// ---------------------------------------------------------------------------
// React hook (primary public API)
// ---------------------------------------------------------------------------
export {
  useHardwareKeyEvent,
  useSupportedKeyCodes,
} from './useHardwareKeyEvent';

// ---------------------------------------------------------------------------
// Imperative (non-React) API
// ---------------------------------------------------------------------------
export { registerHardwareKeyEvent } from './useHardwareKeyEvent';

// ---------------------------------------------------------------------------
// Re-export public types
// ---------------------------------------------------------------------------
export type { KeyCode as KeyCodeType } from './keycodes';
export type {
  UseHardwareKeyEventOptions,
  UseHardwareKeyEventResult,
  RegisterHardwareKeyEventOptions,
  HardwareKeyEventListener,
} from './useHardwareKeyEvent';
export type {
  KeyEvent,
  KeyAction,
  KeyCodeInfo,
  RegisterListenerParams,
  RegisterListenerResponse,
} from './NativeHardwareKeyEvent';
