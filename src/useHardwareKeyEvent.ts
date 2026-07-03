/**
 * External dependencies
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EventSubscription } from 'react-native';

/**
 * Internal dependencies
 */
import HardwareKeyEvent, { type KeyEvent } from './NativeHardwareKeyEvent';
import { type KeyCode, isKeyCode } from './keycodes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default long-press detection threshold (ms). */
const DEFAULT_LONG_PRESS_TIMEOUT = 500;

// ---------------------------------------------------------------------------
// Long-press tracker (shared by hook and imperative API)
// ---------------------------------------------------------------------------

/**
 * Minimal state machine that tracks per-key long-press timers.
 *
 * - On the first `down` event (repeatCount === 0) a timer is started.
 * - An `up` event cancels the timer.
 * - When the timer fires, `onLongPress` is invoked with the most recent
 *   down event seen for that key.
 * - Repeat events (repeatCount > 0) do **not** restart the timer.
 *
 * The tracker is intentionally decoupled from React so it can be reused by
 * the imperative `registerHardwareKeyEvent` API.
 */
function createLongPressTracker(options: {
	getOnKeyDown: () => ((event: KeyEvent) => void) | undefined;
	getOnKeyUp: () => ((event: KeyEvent) => void) | undefined;
	getOnLongPress: () => ((event: KeyEvent) => void) | undefined;
	longPressTimeout: number;
	onError?: (error: Error) => void;
}) {
	const { getOnKeyDown, getOnKeyUp, getOnLongPress, longPressTimeout } =
		options;
	const timers = new Map<string, ReturnType<typeof setTimeout>>();
	const lastDownEvents = new Map<string, KeyEvent>();

	function handleEvent(event: KeyEvent): void {
		if (event.action === 'down') {
			// Always fire the immediate down callback.
			getOnKeyDown()?.(event);

			// Long-press bookkeeping.
			if (getOnLongPress()) {
				lastDownEvents.set(event.keyCodeString, event);

				// Only start a fresh timer on the initial down, not on repeats.
				if (event.repeatCount === 0) {
					const existing = timers.get(event.keyCodeString);
					if (existing) {
						clearTimeout(existing);
					}

					const timer = setTimeout(() => {
						const lastEvent = lastDownEvents.get(
							event.keyCodeString
						);
						if (lastEvent) {
							try {
								getOnLongPress()?.(lastEvent);
							} catch (error: unknown) {
								options.onError?.(
									error instanceof Error
										? error
										: new Error(String(error))
								);
							}
						}
						timers.delete(event.keyCodeString);
						lastDownEvents.delete(event.keyCodeString);
					}, longPressTimeout);

					timers.set(event.keyCodeString, timer);
				}
			}
		} else if (event.action === 'up') {
			// Cancel any pending long-press timer for this key.
			const timer = timers.get(event.keyCodeString);
			if (timer) {
				clearTimeout(timer);
				timers.delete(event.keyCodeString);
			}
			lastDownEvents.delete(event.keyCodeString);

			// Fire the up callback.
			getOnKeyUp()?.(event);
		} else if (event.action === 'error') {
			// Forward native error events to the consumer's error handler
			// (or log them if no handler is available).
			const msg = event.errorMsg ?? 'Unknown native error';
			options.onError?.(new Error(msg));
		}
		// The 'multiple' action is deliberately ignored — it is rare for
		// hardware-key events and its semantics vary across Android versions.
		// The 'unknown' action is also silently ignored — it represents a
		// future Android KeyEvent action that the library does not yet
		// recognise.
	}

	function destroy(): void {
		for (const timer of timers.values()) {
			clearTimeout(timer);
		}
		timers.clear();
		lastDownEvents.clear();
	}

	return { handleEvent, destroy };
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Options accepted by {@link useHardwareKeyEvent}.
 */
export interface UseHardwareKeyEventOptions {
	/**
	 * Key codes to observe.
	 *
	 * **Important:** For stable identity between renders, memoise this array
	 * (e.g. with `useMemo`) or declare it outside the component.  The hook
	 * compares keys by sorted value so re-ordering does not trigger a
	 * re-registration.
	 */
	keys: KeyCode[];

	/** Called immediately for every key-down (and key-repeat) event. */
	onKeyDown?: (event: KeyEvent) => void;

	/** Called for every key-up event. */
	onKeyUp?: (event: KeyEvent) => void;

	/**
	 * Called once when a key has been held down for at least
	 * `longPressTimeout` ms without being released.
	 */
	onLongPress?: (event: KeyEvent) => void;

	/**
	 * Duration (in ms) the key must be held before `onLongPress` fires.
	 *
	 * @default 500
	 */
	longPressTimeout?: number;

	/**
	 * When `false` the hook does **not** register with the native module
	 * and all callbacks are inert.  Toggle to pause / resume key handling
	 * without losing the current key set.
	 *
	 * @default true
	 */
	enabled?: boolean;
}

/**
 * Return value of {@link useHardwareKeyEvent}.
 */
export interface UseHardwareKeyEventResult {
	/** `true` when the native listener is currently active. */
	isRegistered: boolean;

	/**
	 * The most recent native-registration error, or `null` when the last
	 * registration succeeded or no registration was attempted.
	 */
	error: Error | null;
}

/**
 * Return value of {@link registerHardwareKeyEvent}.
 */
export interface HardwareKeyEventListener {
	/**
	 * Opaque identifier assigned by the native layer.
	 *
	 * Useful for debugging — every {@link KeyEvent} carries a matching
	 * `listenerId`.
	 */
	listenerId: string;

	/**
	 * Permanently remove this listener.  After calling this, the handler
	 * callbacks will never fire again.
	 *
	 * Safe to call multiple times (subsequent calls are no-ops).
	 */
	unregister: () => Promise<void>;
}

/**
 * Options accepted by the imperative {@link registerHardwareKeyEvent}.
 */
export interface RegisterHardwareKeyEventOptions {
	/** Key codes to observe. */
	keys: KeyCode[];

	/** Called immediately for every key-down (and key-repeat) event. */
	onKeyDown?: (event: KeyEvent) => void;

	/** Called for every key-up event. */
	onKeyUp?: (event: KeyEvent) => void;

	/**
	 * Called once when a key has been held down for at least
	 * `longPressTimeout` ms without being released.
	 */
	onLongPress?: (event: KeyEvent) => void;

	/**
	 * Duration (in ms) the key must be held before `onLongPress` fires.
	 *
	 * @default 500
	 */
	longPressTimeout?: number;
}

// ---------------------------------------------------------------------------
// Hook: useHardwareKeyEvent
// ---------------------------------------------------------------------------

/**
 * Register for hardware key events with the Android native layer.
 *
 * Supports **multiple independent registrations** — each call manages its
 * own native listener, so different parts of your app can observe different
 * key sets concurrently.
 *
 * @example
 * ```tsx
 * function VolumeHandler() {
 *   const { isRegistered, error } = useHardwareKeyEvent({
 *     keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN],
 *     onKeyDown: (e) => console.log('Key down:', e.keyCodeString),
 *     onKeyUp:   (e) => console.log('Key up:',   e.keyCodeString),
 *     onLongPress: (e) => alert(`Long press: ${e.keyCodeString}`),
 *   });
 *
 *   if (error) return <Text>Error: {error.message}</Text>;
 *   return <Text>{isRegistered ? 'Listening' : 'Idle'}</Text>;
 * }
 * ```
 */
export function useHardwareKeyEvent(
	options: UseHardwareKeyEventOptions
): UseHardwareKeyEventResult {
	const {
		keys,
		onKeyDown,
		onKeyUp,
		onLongPress,
		longPressTimeout = DEFAULT_LONG_PRESS_TIMEOUT,
		enabled = true,
	} = options;

	const [isRegistered, setIsRegistered] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	// ------------------------------------------------------------------
	// Stable references to user callbacks (avoids stale closures)
	// ------------------------------------------------------------------
	const onKeyDownRef = useRef(onKeyDown);
	const onKeyUpRef = useRef(onKeyUp);
	const onLongPressRef = useRef(onLongPress);

	onKeyDownRef.current = onKeyDown;
	onKeyUpRef.current = onKeyUp;
	onLongPressRef.current = onLongPress;

	// ------------------------------------------------------------------
	// Stable key fingerprint — only changes when key *values* change,
	// not when the array reference changes.
	// ------------------------------------------------------------------
	const keyFingerprint = useMemo(
		() =>
			keys
				.filter((k) => {
					if (!isKeyCode(k)) {
						if (__DEV__) {
							console.warn(
								`[react-native-hardwarekey-event] "${k}" is not a known ` +
									'KeyCode — it will be silently ignored by the native layer.'
							);
						}
						return false;
					}
					return true;
				})
				.sort()
				.join('|'),
		[keys]
	);

	// ------------------------------------------------------------------
	// Main effect: register → listen → cleanup
	// ------------------------------------------------------------------
	useEffect(() => {
		// Nothing to do when disabled or no keys are requested.
		if (!enabled || keys.length === 0) {
			setIsRegistered(false);
			setError(null);
			return;
		}

		let cancelled = false;
		let listenerId: string | null = null;
		let subscription: EventSubscription | null = null;

		const tracker = createLongPressTracker({
			getOnKeyDown: () => onKeyDownRef.current,
			getOnKeyUp: () => onKeyUpRef.current,
			getOnLongPress: () => onLongPressRef.current,
			longPressTimeout,
			onError: (err: Error) => {
				if (!cancelled) {
					setError(err);
				}
			},
		});

		// Register with the native module.
		HardwareKeyEvent.registerListener({
			keyCodeStrings: keys.map((k) => k as string),
		})
			.then((response) => {
				if (cancelled) {
					// Component unmounted / deps changed before registration resolved.
					HardwareKeyEvent.unregisterListener(
						response.listenerId
					).catch(() => {
						/* best-effort */
					});
					return;
				}

				listenerId = response.listenerId;

				// Subscribe to the shared event stream.
				subscription = HardwareKeyEvent.onKeyEvent(
					(event: KeyEvent) => {
						// Only process events targeted at this listener.
						if (event.listenerId !== listenerId) {
							return;
						}
						tracker.handleEvent(event);
					}
				);

				setIsRegistered(true);
				setError(null);
			})
			.catch((err: unknown) => {
				if (!cancelled) {
					setError(
						err instanceof Error ? err : new Error(String(err))
					);
					setIsRegistered(false);
				}
			});

		return () => {
			cancelled = true;
			tracker.destroy();

			if (subscription) {
				subscription.remove();
			}

			if (listenerId) {
				HardwareKeyEvent.unregisterListener(listenerId).catch(() => {
					/* best-effort */
				});
			}

			setIsRegistered(false);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		keyFingerprint,
		enabled,
		longPressTimeout,
	]);

	return { isRegistered, error };
}

// ---------------------------------------------------------------------------
// Imperative API: registerHardwareKeyEvent
// ---------------------------------------------------------------------------

/**
 * Register for hardware key events **outside of a React component**
 * (e.g. in a Redux saga, a vanilla-JS service, or a navigation guard).
 *
 * Returns a handle whose `unregister()` method permanently removes the
 * listener.
 *
 * @example
 * ```ts
 * const listener = await registerHardwareKeyEvent({
 *   keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN],
 *   onKeyDown: (e) => console.log(e.keyCodeString),
 * });
 *
 * // Later …
 * await listener.unregister();
 * ```
 */
export async function registerHardwareKeyEvent(
	options: RegisterHardwareKeyEventOptions
): Promise<HardwareKeyEventListener> {
	const {
		keys,
		onKeyDown,
		onKeyUp,
		onLongPress,
		longPressTimeout = DEFAULT_LONG_PRESS_TIMEOUT,
	} = options;

	const keyCodeStrings = keys.map((k) => k as string);

	// Create the long-press tracker ahead of time so it is ready when events
	// arrive — even if they arrive before registration resolves.
	const tracker = createLongPressTracker({
		getOnKeyDown: () => onKeyDown,
		getOnKeyUp: () => onKeyUp,
		getOnLongPress: () => onLongPress,
		longPressTimeout,
		onError: (err: Error) => {
			// Log long-press callback exceptions so they are not silently
			// swallowed.  The imperative API has no React state to update.
			console.error(
				'[react-native-hardwarekey-event] onLongPress error:',
				err
			);
		},
	});

	const response = await HardwareKeyEvent.registerListener({
		keyCodeStrings,
	});
	const listenerId = response.listenerId;

	let unregistered = false;

	const subscription = HardwareKeyEvent.onKeyEvent((event: KeyEvent) => {
		if (unregistered || event.listenerId !== listenerId) {
			return;
		}
		tracker.handleEvent(event);
	});

	const unregister = async (): Promise<void> => {
		if (unregistered) {
			return;
		}
		unregistered = true;
		subscription.remove();
		tracker.destroy();
		await HardwareKeyEvent.unregisterListener(listenerId);
	};

	return { listenerId, unregister };
}

// ---------------------------------------------------------------------------
// Hook: useSupportedKeyCodes
// ---------------------------------------------------------------------------

/**
 * Query the native module for the set of hardware key codes the current
 * device reports as supported.
 *
 * The returned array only contains values that are members of the
 * {@link KeyCode} enum — unknown key-code strings reported by the device
 * are silently filtered out.
 *
 * Returns an empty array while the native query is in flight or when the
 * query fails.
 *
 * @example
 * ```tsx
 * function AvailableKeys() {
 *   const supported = useSupportedKeyCodes();
 *
 *   return (
 *     <View>
 *       {supported.map((code) => (
 *         <Text key={code}>{code}</Text>
 *       ))}
 *     </View>
 *   );
 * }
 * ```
 */
export function useSupportedKeyCodes(): KeyCode[] {
	const [keyCodes, setKeyCodes] = useState<KeyCode[]>([]);

	useEffect(() => {
		let cancelled = false;

		HardwareKeyEvent.getSupportedKeyCodes()
			.then((infos) => {
				if (cancelled) {
					return;
				}
				const codes: KeyCode[] = [];
				for (const info of infos) {
					if (isKeyCode(info.keyCodeString)) {
						codes.push(info.keyCodeString);
					}
				}
				setKeyCodes(codes);
			})
			.catch(() => {
				// Silently ignore — keep whatever we already have.
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return keyCodes;
}
