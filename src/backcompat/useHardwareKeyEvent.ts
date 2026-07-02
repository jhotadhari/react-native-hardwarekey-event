// ---------------------------------------------------------------------------
// react-native-hardwarekey-event v1.0.0 — backward-compat wrapper
//
// Import path: 'react-native-hardwarekey-event/compat'
//
// Maps the old 0.0.x API surface to the new 1.0.0 native primitives.
// Emits console.warn in development to help teams find unmigrated callsites.
//
// This wrapper will be REMOVED in v2.0.0.  Migrate each callsite to the
// new API as soon as practical.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
import type { EventSubscription } from 'react-native';

import HardwareKeyEvent, { type KeyEvent } from '../NativeHardwareKeyEvent';

// ---------------------------------------------------------------------------
// Old API types (re-exported for backward compatibility)
// ---------------------------------------------------------------------------

/** @deprecated Use `KeyEvent` from the main entry point instead. */
export interface KeyEventResponse {
	keyCode: number;
	keyCodeString: string;
}

/** @deprecated Errors now flow through Promise rejections and the hook's `error` state. */
export interface EventError {
	errorMsg: string;
}

// ---------------------------------------------------------------------------
// Compat hook
// ---------------------------------------------------------------------------

/**
 * @deprecated Use the new `useHardwareKeyEvent` from the main entry point.
 *
 * This compat wrapper accepts the old call signature and maps it to the
 * new native registration primitives under the hood.  It fires a console
 * warning in development to help you find remaining unmigrated callsites.
 *
 * Migration:
 *   Old:  useHardwareKeyEvent({ callbacks: { KEYCODE_VOLUME_UP: fn }, onError })
 *   New:  useHardwareKeyEvent({ keys: [KeyCode.VOLUME_UP], onKeyDown: fn })
 */
export function useHardwareKeyEvent({
	callbacks,
	onError,
}: {
	callbacks: {
		[keyCodeString: string]: (response?: KeyEventResponse) => void;
	};
	onError?: (error?: EventError) => void;
}): void {
	const deprecationWarned = useRef(false);

	useEffect(() => {
		if (__DEV__ && !deprecationWarned.current) {
			deprecationWarned.current = true;
			console.warn(
				'[react-native-hardwarekey-event] DEPRECATED: You are using the compat ' +
					"wrapper (import from 'react-native-hardwarekey-event/compat'). " +
					'This will be removed in v2.0.0. Please migrate to the new API: ' +
					'see MIGRATION.md for details.'
			);
		}

		let cancelled = false;
		let listenerId: string | null = null;
		let subscription: EventSubscription | null = null;

		const callbacksObj = callbacks ?? {};

		const keyCodeStrings = Object.keys(callbacksObj).filter((k) =>
			k.startsWith('KEYCODE_')
		);

		if (keyCodeStrings.length === 0) {
			return;
		}

		HardwareKeyEvent.registerListener({ keyCodeStrings })
			.then((response) => {
				if (cancelled) {
					HardwareKeyEvent.unregisterListener(
						response.listenerId
					).catch(() => {
						/* best-effort */
					});
					return;
				}

				listenerId = response.listenerId;

				subscription = HardwareKeyEvent.onKeyEvent(
					(event: KeyEvent) => {
						// Filter by listenerId so events from other (non-compat)
						// listeners do not cause double-firing of compat callbacks.
						if (event.listenerId !== listenerId) {
							return;
						}
						const cb = callbacksObj[event.keyCodeString];
						if (cb) {
							cb({
								keyCode: event.keyCode,
								keyCodeString: event.keyCodeString,
							});
						}
					}
				);
			})
			.catch((err: unknown) => {
				if (!cancelled && onError) {
					onError({
						errorMsg:
							err instanceof Error ? err.message : String(err),
					});
				}
			});

		return () => {
			cancelled = true;
			subscription?.remove();
			if (listenerId) {
				HardwareKeyEvent.unregisterListener(listenerId).catch(() => {
					/* best-effort */
				});
			}
		};
	}, [callbacks, onError]);
}
