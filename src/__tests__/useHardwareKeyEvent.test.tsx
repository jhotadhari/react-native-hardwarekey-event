/**
 * Comprehensive tests for the redesigned hardware-key-event API.
 *
 * Covers:
 *   - useHardwareKeyEvent (hook)
 *   - registerHardwareKeyEvent (imperative)
 *   - useSupportedKeyCodes (feature detection)
 */

import { act, renderHook } from '@testing-library/react-native';

import {
	useHardwareKeyEvent,
	registerHardwareKeyEvent,
	useSupportedKeyCodes,
} from '../useHardwareKeyEvent';
import HardwareKeyEvent from '../NativeHardwareKeyEvent';
import { KeyCode } from '../keycodes';
import type { KeyEvent, KeyCodeInfo } from '../NativeHardwareKeyEvent';
import type { UseHardwareKeyEventOptions } from '../useHardwareKeyEvent';

// ---------------------------------------------------------------------------
// Jest mock — native TurboModule
// ---------------------------------------------------------------------------

jest.mock('../NativeHardwareKeyEvent', () => ({
	__esModule: true,
	default: {
		registerListener: jest.fn(),
		unregisterListener: jest.fn(),
		getSupportedKeyCodes: jest.fn(),
		onKeyEvent: jest.fn(),
	},
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type MockModule = {
	registerListener: jest.Mock;
	unregisterListener: jest.Mock;
	getSupportedKeyCodes: jest.Mock;
	onKeyEvent: jest.Mock;
};

function mock(): MockModule {
	return HardwareKeyEvent as unknown as MockModule;
}

/** Extract the most recent callback passed to `onKeyEvent`. */
function getLatestEventCallback(): ((event: KeyEvent) => void) | null {
	const calls = mock().onKeyEvent.mock.calls;
	if (calls.length === 0) return null;
	const last = calls[calls.length - 1];
	if (!last || last.length === 0) return null;
	return last[0] as (event: KeyEvent) => void;
}

/** Emit a synthetic key event to all currently "subscribed" callbacks. */
function emitKeyEvent(event: KeyEvent): void {
	getLatestEventCallback()?.(event);
}

function createKeyEvent(overrides: Partial<KeyEvent> = {}): KeyEvent {
	return {
		listenerId: 'listener-1',
		keyCode: 24,
		keyCodeString: KeyCode.VOLUME_UP,
		action: 'down',
		metaState: 0,
		repeatCount: 0,
		deviceId: 1,
		flags: 0,
		...overrides,
	};
}

function createKeyCodeInfo(overrides: Partial<KeyCodeInfo> = {}): KeyCodeInfo {
	return {
		keyCode: 24,
		keyCodeString: KeyCode.VOLUME_UP,
		label: 'Volume Up',
		isGamepad: false,
		isSystem: false,
		...overrides,
	};
}

const defaultOptions: UseHardwareKeyEventOptions = {
	keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN],
};

// ---------------------------------------------------------------------------
// useHardwareKeyEvent
// ---------------------------------------------------------------------------

describe('useHardwareKeyEvent', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mock().registerListener.mockResolvedValue({ listenerId: 'listener-1' });
		mock().unregisterListener.mockResolvedValue(undefined);
		mock().onKeyEvent.mockReturnValue({ remove: jest.fn() });
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	// -- registration -------------------------------------------------------

	describe('registration', () => {
		it('registers a listener with the native module on mount', async () => {
			await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: defaultOptions }
			);

			await act(async () => {
				await Promise.resolve();
			});

			expect(mock().registerListener).toHaveBeenCalledTimes(1);
			expect(mock().registerListener).toHaveBeenCalledWith({
				keyCodeStrings: ['KEYCODE_VOLUME_UP', 'KEYCODE_VOLUME_DOWN'],
			});
		});

		it('reports isRegistered = true after successful registration', async () => {
			const { result } = await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: defaultOptions }
			);

			await act(async () => {
				await Promise.resolve();
			});

			expect(result.current.isRegistered).toBe(true);
			expect(result.current.error).toBeNull();
		});

		it('does not register when enabled is false', async () => {
			await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: { ...defaultOptions, enabled: false } }
			);

			await act(async () => {
				await Promise.resolve();
			});

			expect(mock().registerListener).not.toHaveBeenCalled();
		});

		it('does not register when keys array is empty', async () => {
			const { result } = await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: { ...defaultOptions, keys: [] } }
			);

			await act(async () => {
				await Promise.resolve();
			});

			expect(mock().registerListener).not.toHaveBeenCalled();
			expect(result.current.isRegistered).toBe(false);
		});

		it('unregisters the listener on unmount', async () => {
			const { unmount } = await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: defaultOptions }
			);

			await act(async () => {
				await Promise.resolve();
			});

			await unmount();

			expect(mock().unregisterListener).toHaveBeenCalledWith(
				'listener-1'
			);
		});

		it('re-registers when keys change', async () => {
			const { rerender } = await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: defaultOptions }
			);

			await act(async () => {
				await Promise.resolve();
			});

			expect(mock().registerListener).toHaveBeenCalledTimes(1);

			await act(async () => {
				await rerender({
					keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_MUTE],
				});
			});

			await act(async () => {
				await Promise.resolve();
			});

			expect(mock().registerListener).toHaveBeenCalledTimes(2);
			expect(mock().unregisterListener).toHaveBeenCalledWith(
				'listener-1'
			);
			expect(mock().registerListener).toHaveBeenLastCalledWith({
				keyCodeStrings: ['KEYCODE_VOLUME_UP', 'KEYCODE_VOLUME_MUTE'],
			});
		});

		it('does not re-register when keys array reference changes but values are identical', async () => {
			const { rerender } = await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: defaultOptions }
			);

			await act(async () => {
				await Promise.resolve();
			});

			expect(mock().registerListener).toHaveBeenCalledTimes(1);

			await act(async () => {
				await rerender({
					keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN],
				});
			});

			await act(async () => {
				await Promise.resolve();
			});

			expect(mock().registerListener).toHaveBeenCalledTimes(1);
		});

		it('handles registration failure by setting error state', async () => {
			const testError = new Error('Native registration failed');
			mock().registerListener.mockRejectedValue(testError);

			const { result } = await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: defaultOptions }
			);

			await act(async () => {
				await Promise.resolve();
			});

			expect(result.current.isRegistered).toBe(false);
			expect(result.current.error).toEqual(testError);
		});
	});

	// -- event handling -----------------------------------------------------

	describe('event handling', () => {
		it('calls onKeyDown for matching key-down events', async () => {
			const onKeyDown = jest.fn();
			let emittedEvent: KeyEvent | null = null;

			await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: { ...defaultOptions, onKeyDown } }
			);

			await act(async () => {
				await Promise.resolve();
			});

			emittedEvent = createKeyEvent({
				listenerId: 'listener-1',
				keyCodeString: KeyCode.VOLUME_UP,
				action: 'down',
			});

			await act(async () => {
				emitKeyEvent(emittedEvent!);
			});

			expect(onKeyDown).toHaveBeenCalledTimes(1);
			expect(onKeyDown).toHaveBeenCalledWith(emittedEvent);
		});

		it('calls onKeyDown for key-repeat events', async () => {
			const onKeyDown = jest.fn();

			await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: { ...defaultOptions, onKeyDown } }
			);

			await act(async () => {
				await Promise.resolve();
			});

			const initialDown = createKeyEvent({
				listenerId: 'listener-1',
				action: 'down',
				repeatCount: 0,
			});
			const repeatDown = createKeyEvent({
				listenerId: 'listener-1',
				action: 'down',
				repeatCount: 3,
			});

			await act(async () => {
				emitKeyEvent(initialDown);
				emitKeyEvent(repeatDown);
			});

			expect(onKeyDown).toHaveBeenCalledTimes(2);
			expect(onKeyDown).toHaveBeenNthCalledWith(1, initialDown);
			expect(onKeyDown).toHaveBeenNthCalledWith(2, repeatDown);
		});

		it('calls onKeyUp for matching key-up events', async () => {
			const onKeyUp = jest.fn();
			let emittedEvent: KeyEvent | null = null;

			await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: { ...defaultOptions, onKeyUp } }
			);

			await act(async () => {
				await Promise.resolve();
			});

			emittedEvent = createKeyEvent({
				listenerId: 'listener-1',
				action: 'up',
			});

			await act(async () => {
				emitKeyEvent(emittedEvent!);
			});

			expect(onKeyUp).toHaveBeenCalledTimes(1);
			expect(onKeyUp).toHaveBeenCalledWith(emittedEvent);
		});

		it('fires callbacks for any event the native module dispatches with a matching listenerId', async () => {
			// Key filtering is the native module's responsibility.  The hook
			// trusts the native layer and forwards every event whose listenerId
			// matches the registration it created.
			const onKeyDown = jest.fn();

			await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{
					initialProps: {
						keys: [KeyCode.VOLUME_UP],
						onKeyDown,
					},
				}
			);

			await act(async () => {
				await Promise.resolve();
			});

			await act(async () => {
				emitKeyEvent(
					createKeyEvent({
						listenerId: 'listener-1',
						keyCodeString: KeyCode.VOLUME_UP,
						action: 'down',
					})
				);
			});

			expect(onKeyDown).toHaveBeenCalledTimes(1);
		});

		it('ignores events whose listenerId does not match', async () => {
			const onKeyDown = jest.fn();

			await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: { ...defaultOptions, onKeyDown } }
			);

			await act(async () => {
				await Promise.resolve();
			});

			await act(async () => {
				emitKeyEvent(
					createKeyEvent({
						listenerId: 'alien-listener',
						keyCodeString: KeyCode.VOLUME_UP,
						action: 'down',
					})
				);
			});

			expect(onKeyDown).not.toHaveBeenCalled();
		});

		it('ignores events with action "multiple"', async () => {
			const onKeyDown = jest.fn();
			const onKeyUp = jest.fn();
			const onLongPress = jest.fn();

			await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{
					initialProps: {
						...defaultOptions,
						onKeyDown,
						onKeyUp,
						onLongPress,
					},
				}
			);

			await act(async () => {
				await Promise.resolve();
			});

			await act(async () => {
				emitKeyEvent(
					createKeyEvent({
						listenerId: 'listener-1',
						action: 'multiple',
					})
				);
			});

			expect(onKeyDown).not.toHaveBeenCalled();
			expect(onKeyUp).not.toHaveBeenCalled();
			expect(onLongPress).not.toHaveBeenCalled();
		});
	});

	// -- long press ---------------------------------------------------------

	describe('long press', () => {
		it('fires onLongPress after the timeout when a key is held down', async () => {
			jest.useFakeTimers();
			const onLongPress = jest.fn();
			const onKeyDown = jest.fn();
			const onKeyUp = jest.fn();
			let downEvent: KeyEvent;

			await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{
					initialProps: {
						...defaultOptions,
						onKeyDown,
						onKeyUp,
						onLongPress,
						longPressTimeout: 300,
					},
				}
			);

			await act(async () => {
				await Promise.resolve();
			});

			downEvent = createKeyEvent({
				listenerId: 'listener-1',
				action: 'down',
				keyCodeString: KeyCode.VOLUME_UP,
			});

			await act(async () => {
				emitKeyEvent(downEvent);
			});

			expect(onKeyDown).toHaveBeenCalledTimes(1);
			expect(onLongPress).not.toHaveBeenCalled();

			await act(async () => {
				jest.advanceTimersByTime(300);
			});

			expect(onLongPress).toHaveBeenCalledTimes(1);
			expect(onLongPress).toHaveBeenCalledWith(
				expect.objectContaining({ keyCodeString: KeyCode.VOLUME_UP })
			);
			expect(onKeyUp).not.toHaveBeenCalled();
		});

		it('does not fire onLongPress if the key is released before the timeout', async () => {
			jest.useFakeTimers();
			const onLongPress = jest.fn();
			const onKeyUp = jest.fn();

			await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{
					initialProps: {
						...defaultOptions,
						onKeyUp,
						onLongPress,
						longPressTimeout: 500,
					},
				}
			);

			await act(async () => {
				await Promise.resolve();
			});

			await act(async () => {
				emitKeyEvent(
					createKeyEvent({ listenerId: 'listener-1', action: 'down' })
				);
			});

			await act(async () => {
				jest.advanceTimersByTime(200);
			});

			await act(async () => {
				emitKeyEvent(
					createKeyEvent({ listenerId: 'listener-1', action: 'up' })
				);
			});

			expect(onKeyUp).toHaveBeenCalledTimes(1);

			await act(async () => {
				jest.advanceTimersByTime(400);
			});

			expect(onLongPress).not.toHaveBeenCalled();
		});

		it('respects the custom longPressTimeout option', async () => {
			jest.useFakeTimers();
			const onLongPress = jest.fn();

			await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{
					initialProps: {
						...defaultOptions,
						onLongPress,
						longPressTimeout: 1000,
					},
				}
			);

			await act(async () => {
				await Promise.resolve();
			});

			await act(async () => {
				emitKeyEvent(
					createKeyEvent({ listenerId: 'listener-1', action: 'down' })
				);
			});

			await act(async () => {
				jest.advanceTimersByTime(500);
			});
			expect(onLongPress).not.toHaveBeenCalled();

			await act(async () => {
				jest.advanceTimersByTime(500);
			});
			expect(onLongPress).toHaveBeenCalledTimes(1);
		});

		it('uses the default 500 ms timeout', async () => {
			jest.useFakeTimers();
			const onLongPress = jest.fn();

			await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: { ...defaultOptions, onLongPress } }
			);

			await act(async () => {
				await Promise.resolve();
			});

			await act(async () => {
				emitKeyEvent(
					createKeyEvent({ listenerId: 'listener-1', action: 'down' })
				);
			});

			await act(async () => {
				jest.advanceTimersByTime(499);
			});
			expect(onLongPress).not.toHaveBeenCalled();

			await act(async () => {
				jest.advanceTimersByTime(1);
			});
			expect(onLongPress).toHaveBeenCalledTimes(1);
		});

		it('does not restart the timer on repeat down events', async () => {
			jest.useFakeTimers();
			const onLongPress = jest.fn();

			await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{
					initialProps: {
						...defaultOptions,
						onLongPress,
						longPressTimeout: 500,
					},
				}
			);

			await act(async () => {
				await Promise.resolve();
			});

			await act(async () => {
				emitKeyEvent(
					createKeyEvent({
						listenerId: 'listener-1',
						action: 'down',
						repeatCount: 0,
					})
				);
			});

			await act(async () => {
				jest.advanceTimersByTime(400);
			});

			await act(async () => {
				emitKeyEvent(
					createKeyEvent({
						listenerId: 'listener-1',
						action: 'down',
						repeatCount: 5,
					})
				);
			});

			await act(async () => {
				jest.advanceTimersByTime(100);
			});

			expect(onLongPress).toHaveBeenCalledTimes(1);
		});
	});

	// -- enabled toggle -----------------------------------------------------

	describe('enabled toggle', () => {
		it('registers when enabled transitions from false to true', async () => {
			const { rerender } = await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: { ...defaultOptions, enabled: false } }
			);

			await act(async () => {
				await Promise.resolve();
			});

			expect(mock().registerListener).not.toHaveBeenCalled();

			await act(async () => {
				await rerender({ ...defaultOptions, enabled: true });
			});

			await act(async () => {
				await Promise.resolve();
			});

			expect(mock().registerListener).toHaveBeenCalledTimes(1);
		});

		it('unregisters when enabled transitions from true to false', async () => {
			const { rerender } = await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: { ...defaultOptions, enabled: true } }
			);

			await act(async () => {
				await Promise.resolve();
			});

			expect(mock().registerListener).toHaveBeenCalledTimes(1);

			await act(async () => {
				await rerender({ ...defaultOptions, enabled: false });
			});

			await act(async () => {
				await Promise.resolve();
			});

			expect(mock().unregisterListener).toHaveBeenCalledWith(
				'listener-1'
			);
		});

		it('clears error state when re-enabled after a failure', async () => {
			const testError = new Error('fail');
			mock().registerListener.mockRejectedValueOnce(testError);

			const { result, rerender } = await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: defaultOptions }
			);

			await act(async () => {
				await Promise.resolve();
			});

			expect(result.current.error).toEqual(testError);

			mock().registerListener.mockResolvedValue({
				listenerId: 'listener-2',
			});

			await act(async () => {
				await rerender({ ...defaultOptions, enabled: false });
			});

			await act(async () => {
				await Promise.resolve();
			});

			expect(result.current.error).toBeNull();

			await act(async () => {
				await rerender({ ...defaultOptions, enabled: true });
			});

			await act(async () => {
				await Promise.resolve();
			});

			expect(result.current.isRegistered).toBe(true);
			expect(result.current.error).toBeNull();
		});

		it('sets isRegistered to false when enabled is false', async () => {
			const { result } = await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: { ...defaultOptions, enabled: false } }
			);

			await act(async () => {
				await Promise.resolve();
			});

			expect(result.current.isRegistered).toBe(false);
			expect(result.current.error).toBeNull();
		});
	});

	// -- lifecycle edge cases -----------------------------------------------

	describe('lifecycle edge cases', () => {
		it('cleans up long-press timers on unmount', async () => {
			jest.useFakeTimers();
			const onLongPress = jest.fn();

			const { unmount } = await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{
					initialProps: {
						...defaultOptions,
						onLongPress,
						longPressTimeout: 500,
					},
				}
			);

			await act(async () => {
				await Promise.resolve();
			});

			await act(async () => {
				emitKeyEvent(
					createKeyEvent({ listenerId: 'listener-1', action: 'down' })
				);
			});

			await unmount();

			await act(async () => {
				jest.advanceTimersByTime(600);
			});

			expect(onLongPress).not.toHaveBeenCalled();
		});

		it('handles rapid enable / disable without leaks', async () => {
			const { rerender } = await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: { ...defaultOptions, enabled: true } }
			);

			await act(async () => {
				await Promise.resolve();
			});

			await act(async () => {
				await rerender({ ...defaultOptions, enabled: false });
			});
			await act(async () => {
				await rerender({ ...defaultOptions, enabled: true });
			});
			await act(async () => {
				await rerender({ ...defaultOptions, enabled: false });
			});

			await act(async () => {
				await Promise.resolve();
			});

			expect(mock().unregisterListener).toHaveBeenCalled();
		});

		it('cancels pending registration when unmounted before promise resolves', async () => {
			let resolveRegister: (value: { listenerId: string }) => void;
			const registerPromise = new Promise<{ listenerId: string }>(
				(resolve) => {
					resolveRegister = resolve;
				}
			);
			mock().registerListener.mockReturnValue(registerPromise);

			const { unmount } = await renderHook(
				(opts: UseHardwareKeyEventOptions) => useHardwareKeyEvent(opts),
				{ initialProps: defaultOptions }
			);

			await unmount();

			await act(async () => {
				resolveRegister!({ listenerId: 'listener-1' });
				await Promise.resolve();
			});

			expect(mock().unregisterListener).toHaveBeenCalledWith(
				'listener-1'
			);
		});
	});
});

// ---------------------------------------------------------------------------
// registerHardwareKeyEvent (imperative API)
// ---------------------------------------------------------------------------

describe('registerHardwareKeyEvent', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mock().registerListener.mockResolvedValue({
			listenerId: 'listener-imp-1',
		});
		mock().unregisterListener.mockResolvedValue(undefined);
		mock().onKeyEvent.mockReturnValue({ remove: jest.fn() });
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('registers a listener and returns a handle with listenerId', async () => {
		const listener = await registerHardwareKeyEvent({
			keys: [KeyCode.VOLUME_UP],
		});

		expect(mock().registerListener).toHaveBeenCalledTimes(1);
		expect(mock().registerListener).toHaveBeenCalledWith({
			keyCodeStrings: ['KEYCODE_VOLUME_UP'],
		});
		expect(listener.listenerId).toBe('listener-imp-1');
		expect(typeof listener.unregister).toBe('function');
	});

	it('routes key-down events to onKeyDown', async () => {
		const onKeyDown = jest.fn();

		await registerHardwareKeyEvent({
			keys: [KeyCode.VOLUME_UP],
			onKeyDown,
		});

		await act(async () => {
			await Promise.resolve();
		});

		const event = createKeyEvent({
			listenerId: 'listener-imp-1',
			action: 'down',
		});

		await act(async () => {
			emitKeyEvent(event);
		});

		expect(onKeyDown).toHaveBeenCalledTimes(1);
		expect(onKeyDown).toHaveBeenCalledWith(event);
	});

	it('routes key-up events to onKeyUp', async () => {
		const onKeyUp = jest.fn();

		await registerHardwareKeyEvent({
			keys: [KeyCode.VOLUME_UP],
			onKeyUp,
		});

		await act(async () => {
			await Promise.resolve();
		});

		const event = createKeyEvent({
			listenerId: 'listener-imp-1',
			action: 'up',
		});

		await act(async () => {
			emitKeyEvent(event);
		});

		expect(onKeyUp).toHaveBeenCalledWith(event);
	});

	it('unregister() removes the listener and stops callbacks', async () => {
		const onKeyDown = jest.fn();

		const listener = await registerHardwareKeyEvent({
			keys: [KeyCode.VOLUME_UP],
			onKeyDown,
		});

		await act(async () => {
			await Promise.resolve();
		});

		await listener.unregister();

		expect(mock().unregisterListener).toHaveBeenCalledWith(
			'listener-imp-1'
		);

		await act(async () => {
			emitKeyEvent(
				createKeyEvent({ listenerId: 'listener-imp-1', action: 'down' })
			);
		});

		expect(onKeyDown).not.toHaveBeenCalled();
	});

	it('unregister() is safe to call multiple times', async () => {
		const listener = await registerHardwareKeyEvent({
			keys: [KeyCode.VOLUME_UP],
		});

		await listener.unregister();
		await listener.unregister();

		expect(mock().unregisterListener).toHaveBeenCalledTimes(1);
	});

	it('supports long-press detection', async () => {
		jest.useFakeTimers();
		const onLongPress = jest.fn();

		await registerHardwareKeyEvent({
			keys: [KeyCode.VOLUME_UP],
			onLongPress,
			longPressTimeout: 200,
		});

		await act(async () => {
			await Promise.resolve();
		});

		await act(async () => {
			emitKeyEvent(
				createKeyEvent({
					listenerId: 'listener-imp-1',
					action: 'down',
					repeatCount: 0,
				})
			);
		});

		await act(async () => {
			jest.advanceTimersByTime(200);
		});

		expect(onLongPress).toHaveBeenCalledTimes(1);
	});

	it('throws when registerListener rejects', async () => {
		const failure = new Error('native fail');
		mock().registerListener.mockRejectedValue(failure);

		await expect(
			registerHardwareKeyEvent({ keys: [KeyCode.VOLUME_UP] })
		).rejects.toThrow('native fail');
	});
});

// ---------------------------------------------------------------------------
// useSupportedKeyCodes
// ---------------------------------------------------------------------------

describe('useSupportedKeyCodes', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mock().getSupportedKeyCodes.mockResolvedValue([]);
	});

	it('returns an empty array before the native query resolves', async () => {
		mock().getSupportedKeyCodes.mockReturnValue(
			new Promise(() => {
				/* never resolves */
			})
		);

		const { result } = await renderHook(() => useSupportedKeyCodes());

		expect(result.current).toEqual([]);
	});

	it('returns KeyCode values that are in the known enum', async () => {
		mock().getSupportedKeyCodes.mockResolvedValue([
			createKeyCodeInfo({ keyCodeString: KeyCode.VOLUME_UP }),
			createKeyCodeInfo({ keyCodeString: KeyCode.VOLUME_DOWN }),
			createKeyCodeInfo({
				keyCode: 25,
				keyCodeString: 'KEYCODE_VOLUME_DOWN',
			}),
		]);

		const { result } = await renderHook(() => useSupportedKeyCodes());

		await act(async () => {
			await Promise.resolve();
		});

		expect(result.current).toEqual([
			KeyCode.VOLUME_UP,
			KeyCode.VOLUME_DOWN,
			KeyCode.VOLUME_DOWN,
		]);
	});

	it('filters out key-code strings not in the KeyCode enum', async () => {
		mock().getSupportedKeyCodes.mockResolvedValue([
			createKeyCodeInfo({
				keyCode: 999,
				keyCodeString: 'KEYCODE_SOME_OBSCURE_THING',
			}),
		]);

		const { result } = await renderHook(() => useSupportedKeyCodes());

		await act(async () => {
			await Promise.resolve();
		});

		expect(result.current).toEqual([]);
	});

	it('returns an empty array when the native query fails', async () => {
		mock().getSupportedKeyCodes.mockRejectedValue(
			new Error('Query not supported on this device')
		);

		const { result } = await renderHook(() => useSupportedKeyCodes());

		await act(async () => {
			await Promise.resolve();
		});

		expect(result.current).toEqual([]);
	});
});
