#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

// ---------------------------------------------------------------------------
// Volume key code constants (matching Android's KeyEvent values)
// ---------------------------------------------------------------------------

FOUNDATION_EXPORT NSString * const kVolumeUpKeyCodeString;
FOUNDATION_EXPORT NSString * const kVolumeDownKeyCodeString;
FOUNDATION_EXPORT const int kVolumeUpKeyCode;
FOUNDATION_EXPORT const int kVolumeDownKeyCode;

// ---------------------------------------------------------------------------
// Callbacks
// ---------------------------------------------------------------------------

/**
 * Called on the main thread whenever a volume change is detected that matches
 * one or more registered listeners.
 *
 * @param listenerId   The opaque registration ID that matched this event.
 * @param keyCodeString "KEYCODE_VOLUME_UP" or "KEYCODE_VOLUME_DOWN".
 * @param keyCode      24 for VOLUME_UP, 25 for VOLUME_DOWN.
 */
typedef void (^RNHardwareKeyEventCallback)(NSString *listenerId,
                                           NSString *keyCodeString,
                                           int keyCode);

// ---------------------------------------------------------------------------
// RNHardwareKeyEvent
// ---------------------------------------------------------------------------

/**
 * Singleton helper that monitors iOS hardware volume button presses.
 *
 * ## How it works
 *
 * 1. Adds an invisible MPVolumeView to the view hierarchy to suppress the
 *    system volume HUD overlay.
 * 2. Uses KVO on `[AVAudioSession sharedInstance].outputVolume` to detect
 *    volume changes.
 * 3. Compares the new volume level against the previous one to determine
 *    whether "volume up" or "volume down" was pressed.
 * 4. Dispatches matching events to all registered listeners.
 *
 * ## iOS limitations
 *
 * - **Only volume keys** are observable on iOS. There is no public API for
 *   detecting other hardware buttons.
 * - Volume observation **does not work in the background** (iOS restriction).
 * - On the **simulator** the volume buttons are non-functional, so no events
 *   will fire.
 * - Volume-KVO delivery may be unreliable when audio is not actively playing
 *   (iOS 16+ behaviour).  Activating the shared audio session mitigates this.
 */
@interface RNHardwareKeyEvent : NSObject

+ (instancetype)sharedInstance;

// -----------------------------------------------------------------------
// Listener registration
// -----------------------------------------------------------------------

/**
 * Register interest in one or more key code constant strings.
 *
 * Only `"KEYCODE_VOLUME_UP"` and `"KEYCODE_VOLUME_DOWN"` are actually
 * observable on iOS; other strings are silently ignored for this listener.
 *
 * KVO observation starts automatically when the first listener is added.
 *
 * @returns An opaque `listenerId` used to unregister later.
 */
- (NSString *)registerListenerWithKeyCodeStrings:(NSArray<NSString *> *)keyCodeStrings;

/**
 * Remove a previously registered listener.
 *
 * Safe to call multiple times or with an unknown ID (no-op).
 * KVO observation stops when the last listener is removed.
 */
- (void)unregisterListenerWithId:(NSString *)listenerId;

/**
 * Remove all currently registered listeners and return their IDs.
 *
 * Used by the `enableEvents` TurboModule method to atomically replace the
 * active listener set.
 *
 * @returns Array of removed listener IDs (empty when none were registered).
 */
- (NSArray<NSString *> *)removeAllListeners;

// -----------------------------------------------------------------------
// Introspection
// -----------------------------------------------------------------------

/**
 * Return metadata for every key code iOS can detect.
 *
 * On a real device this is `KEYCODE_VOLUME_UP` and `KEYCODE_VOLUME_DOWN`;
 * the result **does not** change depending on the current device — it is a
 * static declaration of what the platform supports at the API level.
 *
 * Each dictionary conforms to the `KeyCodeInfo` shape:
 *   { keyCode: Int32, keyCodeString: string, label: string | null,
 *     isGamepad: bool, isSystem: bool }
 */
- (NSArray<NSDictionary *> *)getSupportedKeyCodes;

// -----------------------------------------------------------------------
// Callbacks (set by the React Native module)
// -----------------------------------------------------------------------

/** Invoked for each listener that matched a volume event. */
@property (nonatomic, copy, nullable) RNHardwareKeyEventCallback onKeyEvent;

/** Invoked on audio session interruptions or other non-fatal errors. */
@property (nonatomic, copy, nullable) void (^onError)(NSString *errorMsg);

// -----------------------------------------------------------------------
// Observation state
// -----------------------------------------------------------------------

/** `YES` while KVO and the invisible MPVolumeView are active. */
@property (nonatomic, readonly) BOOL isObserving;

@end

NS_ASSUME_NONNULL_END
