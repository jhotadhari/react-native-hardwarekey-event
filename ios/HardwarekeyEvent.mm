// ---------------------------------------------------------------------------
// react-native-hardwarekey-event — iOS TurboModule implementation
// ---------------------------------------------------------------------------

#import "HardwarekeyEvent.h"
#import "RNHardwareKeyEvent.h"

// Core React Native TurboModule types (`EventEmitterCallback`,
// `EventEmitterCallbackWrapper`, `ObjCTurboModule::InitParams`).  This header
// ships with every React Native 0.72+ install and is always available.
#import <ReactCommon/RCTTurboModule.h>

// The codegen-generated ObjC spec (available when the pod is installed).
// It defines:
//   - JS::NativeHardwareKeyEvent::EnableEventsParams (C++ struct)
//   - NativeHardwareKeyEventSpecJSI (ObjCTurboModule subclass)
#if __has_include(<HardwareKeyEvent/RNHardwareKeyEventSpec.h>)
#import <HardwareKeyEvent/RNHardwareKeyEventSpec.h>
#define HWKEYEVENT_HAS_CODEGEN_SPEC 1
#endif

// ---------------------------------------------------------------------------
// Error domain & codes
// ---------------------------------------------------------------------------

static NSString * const kHardwareKeyEventErrorDomain = @"HardwareKeyEvent";

static NSInteger const kErrorCodeInvalidParams = 1;

// ---------------------------------------------------------------------------
// Event names (must match the JS spec)
// ---------------------------------------------------------------------------

static NSString * const kEventOnKeyEvent = @"onKeyEvent";
static NSString * const kEventOnError    = @"onError";

// ---------------------------------------------------------------------------
// Helper: reject a promise with an NSError
// ---------------------------------------------------------------------------

static inline void rejectWithMessage(RCTPromiseRejectBlock reject,
                                     NSInteger code,
                                     NSString *message) {
  NSError *err = [NSError errorWithDomain:kHardwareKeyEventErrorDomain
                                     code:code
                                 userInfo:@{ NSLocalizedDescriptionKey: message }];
  reject(@"error", message, err);
}

// ---------------------------------------------------------------------------
// HardwareKeyEvent
// ---------------------------------------------------------------------------

@implementation HardwareKeyEvent {
  // The TurboModule event-emitter callback supplied by the ObjCTurboModule
  // wrapper in the new architecture.  When non-null the new architecture is
  // active; otherwise we fall back to `sendEventWithName:body:`.
  //
  // The `EventEmitterCallback` type is declared in
  // <ReactCommon/RCTTurboModule.h>, which is available in React Native 0.72+.
  facebook::react::EventEmitterCallback _turboEventCallback;

  // `YES` after `setEventEmitterCallback:` has been invoked at least once.
  BOOL _hasTurboEventCallback;
}

RCT_EXPORT_MODULE()

#pragma mark - Lifecycle

- (instancetype)init {
  self = [super init];
  if (self) {
    _hasTurboEventCallback = NO;
    [self wireUpCallbacks];
  }
  return self;
}

- (void)dealloc {
  // Break the callback retain-cycle: our blocks capture `weak self`, but
  // clearing them is still good hygiene in case the singleton outlives us.
  [RNHardwareKeyEvent sharedInstance].onKeyEvent = nil;
  [RNHardwareKeyEvent sharedInstance].onError    = nil;
}

#pragma mark - Callback wiring

/**
 * Connect the singleton RNHardwareKeyEvent's callbacks to this module's
 * event-emission machinery so that every volume-button press is forwarded to
 * the JS layer via the correct architecture path.
 */
- (void)wireUpCallbacks {
  __weak typeof(self) weakSelf = self;

  [RNHardwareKeyEvent sharedInstance].onKeyEvent =
    ^(NSString *listenerId, NSString *keyCodeString, int keyCode) {
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (!strongSelf) { return; }

      NSDictionary *payload = @{
        @"listenerId"    : listenerId,
        @"keyCode"       : @(keyCode),
        @"keyCodeString" : keyCodeString,
        // iOS can only observe instantaneous volume changes; there is no
        // separate down/up transition — every change is emitted as "down".
        @"action"        : @"down",
        @"metaState"     : @0,
        @"repeatCount"   : @0,
        @"deviceId"      : @0,
        @"flags"         : @0,
      };

      [strongSelf emitKeyEvent:payload];
    };

  [RNHardwareKeyEvent sharedInstance].onError = ^(NSString *errorMsg) {
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) { return; }
    [strongSelf emitErrorEvent:@{ @"errorMsg": errorMsg }];
  };
}

#pragma mark - Event emission (dual-architecture)

/**
 * Emit an `onKeyEvent` through whichever architecture is currently active.
 *
 * - **New architecture** (TurboModule): the event travels via the
 *   AsyncEventEmitter that was wired up to `_turboEventCallback` by
 *   `setEventEmitterCallback:`.
 * - **Old architecture** (bridge): the event is enqueued on the bridge via
 *   `-[RCTEventEmitter sendEventWithName:body:]`.
 */
- (void)emitKeyEvent:(NSDictionary *)payload {
  if (_hasTurboEventCallback) {
    _turboEventCallback(kEventOnKeyEvent, payload);
  } else {
    [self sendEventWithName:kEventOnKeyEvent body:payload];
  }
}

- (void)emitErrorEvent:(NSDictionary *)payload {
  if (_hasTurboEventCallback) {
    _turboEventCallback(kEventOnError, payload);
  } else {
    [self sendEventWithName:kEventOnError body:payload];
  }
}

#pragma mark - RCTEventEmitter

/**
 * Declare the set of events this module may emit.
 *
 * Required by RCTEventEmitter.  Must match the event names used in
 * `sendEventWithName:body:` calls.
 */
- (NSArray<NSString *> *)supportedEvents {
  return @[kEventOnKeyEvent, kEventOnError];
}

/**
 * Called by React Native when the *first* JS-side listener is added for this
 * module's events (old architecture only).
 *
 * We do **not** start volume observation here — that is managed by explicit
 * `registerListener` / `enableEvents` calls so that observation only begins
 * when the caller actually wants volume-key events.
 */
- (void)startObserving {
  // No-op: observation is driven by listener registration, not JS listeners.
}

/**
 * Called by React Native when the *last* JS-side listener is removed.
 */
- (void)stopObserving {
  // No-op: observation is driven by listener registration, not JS listeners.
}

#pragma mark - RCT_EXPORT_METHOD (old architecture)

/**
 * Register a new hardware-key listener without disturbing existing listeners.
 *
 * If this is the first registration, volume KVO observation begins
 * automatically.
 *
 * @param params.keyCodeStrings – array of key-code constant names (e.g.
 *   `["KEYCODE_VOLUME_UP", "KEYCODE_VOLUME_DOWN"]`). Unrecognised strings
 *   are silently ignored.
 *
 * @returns `{ listenerId: string }`
 */
RCT_EXPORT_METHOD(registerListener:(NSDictionary *)params
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {

  id raw = params[@"keyCodeStrings"];
  if (![raw isKindOfClass:[NSArray class]]) {
    rejectWithMessage(reject, kErrorCodeInvalidParams,
                      @"\"keyCodeStrings\" must be an array");
    return;
  }

  NSString *listenerId =
    [[RNHardwareKeyEvent sharedInstance] registerListenerWithKeyCodeStrings:(NSArray *)raw];

  resolve(@{ @"listenerId": listenerId });
}

/**
 * Remove a previously registered listener.
 *
 * If the removed listener was the last one, volume KVO observation stops.
 *
 * @param listenerId – the opaque ID returned by `registerListener`.
 *
 * Calling with an unknown or already-removed ID is a safe no-op.
 */
RCT_EXPORT_METHOD(unregisterListener:(NSString *)listenerId
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {

  [[RNHardwareKeyEvent sharedInstance] unregisterListenerWithId:listenerId];
  resolve(nil);
}

/**
 * Return the set of hardware key codes the platform can detect.
 *
 * On iOS this always returns exactly two entries:
 * `KEYCODE_VOLUME_UP` (keyCode 24) and `KEYCODE_VOLUME_DOWN` (keyCode 25).
 *
 * Each entry is a `KeyCodeInfo` dictionary:
 *   `{ keyCode: number, keyCodeString: string, label: string | null,
 *      isGamepad: boolean, isSystem: boolean }`
 */
RCT_EXPORT_METHOD(getSupportedKeyCodes:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {

  resolve([[RNHardwareKeyEvent sharedInstance] getSupportedKeyCodes]);
}

// ---------------------------------------------------------------------------
// Codegen-spec / TurboModule methods
// (only compiled when the generated spec is present)
// ---------------------------------------------------------------------------

#ifdef HWKEYEVENT_HAS_CODEGEN_SPEC

#pragma mark - NativeHardwareKeyEventSpec (TurboModule protocol)

/**
 * Atomically replace the active key-event listener set.
 *
 * This is the **primary** method on the codegen-generated ObjC protocol.
 * Because `enableEvents` can only track a single listener (matching the
 * Android implementation), we tear down any previously registered listeners
 * before creating a new one.
 *
 * The response dictionary contains:
 * - `added`   – the new listener ID (always present)
 * - `removed` – the previous listener ID (present only when replaced)
 */
- (void)enableEvents:(JS::NativeHardwareKeyEvent::EnableEventsParams &)params
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject {

  RNHardwareKeyEvent *helper = [RNHardwareKeyEvent sharedInstance];

  // Gather the old listener IDs before replacing.
  NSArray<NSString *> *removedIds = [helper removeAllListeners];

  // Extract the key-code string vector into an NSArray.
  auto &keyCodeVec = params.keyCodeStrings();
  NSMutableArray<NSString *> *keys =
    [NSMutableArray arrayWithCapacity:keyCodeVec.size()];
  for (const auto &str : keyCodeVec) {
    [keys addObject:str];
  }

  // Register the new listener.
  NSString *addedId = [helper registerListenerWithKeyCodeStrings:keys];

  // Build the response.
  NSMutableDictionary *response = [NSMutableDictionary dictionaryWithCapacity:2];
  response[@"added"] = addedId;
  if (removedIds.count > 0) {
    response[@"removed"] = removedIds.firstObject; // single ID, per codegen spec
  }

  resolve(response);
}

#pragma mark - TurboModule callbacks

/**
 * Called by the ObjCTurboModule wrapper to supply the event-emitter callback
 * that talks to the JSI AsyncEventEmitter map.
 *
 * Once this is set, all event emission routes through the TurboModule layer
 * instead of the legacy bridge.
 */
- (void)setEventEmitterCallback:(EventEmitterCallbackWrapper *)wrapper {
  _turboEventCallback     = std::move(wrapper->_eventEmitterCallback);
  _hasTurboEventCallback  = YES;
}

#pragma mark - TurboModule factory

/**
 * Return the JSI TurboModule that wraps this ObjC instance.
 *
 * `NativeHardwareKeyEventSpecJSI` is the codegen-generated ObjCTurboModule
 * subclass that exposes `enableEvents` via JSI and wires up the
 * `onKeyEvent` / `onError` AsyncEventEmitter instances.
 */
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {

  return std::make_shared<facebook::react::NativeHardwareKeyEventSpecJSI>(params);
}

#endif // HWKEYEVENT_HAS_CODEGEN_SPEC

@end
