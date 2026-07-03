#import "RNHardwareKeyEvent.h"

#import <AVFoundation/AVFoundation.h>
#import <MediaPlayer/MediaPlayer.h>
#import <UIKit/UIKit.h>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

NSString * const kVolumeUpKeyCodeString   = @"KEYCODE_VOLUME_UP";
NSString * const kVolumeDownKeyCodeString = @"KEYCODE_VOLUME_DOWN";
const int kVolumeUpKeyCode   = 24;
const int kVolumeDownKeyCode = 25;

/// Context pointer used to distinguish our KVO observation from superclass
/// or external observations.
static void * const kVolumeKVOContext = (void *)&kVolumeKVOContext;

/// Smallest volume delta we treat as a genuine button press.  On iPhone the
/// hardware volume rocker adjusts in steps of ~0.0625 (1/16).
static const float kMinVolumeDelta = 0.0001f;

// ---------------------------------------------------------------------------
// RNHardwareKeyEvent (private)
// ---------------------------------------------------------------------------

@interface RNHardwareKeyEvent () {
  /// Serialises access to `_registeredListeners`.  KVO callbacks arrive on
  /// the main thread (the observer was added from the main thread), but
  /// register / unregister may come from any JS thread.
  NSLock *_listenersLock;
}

/// MPVolumeView added to the key window to suppress the system volume HUD.
/// Placed off-screen at 1x1 px and nearly-transparent.
@property (nonatomic, strong, nullable) MPVolumeView *volumeView;

/// listenerId -> set of keyCodeStrings that listener cares about.
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSSet<NSString *> *> *mutableListeners;

/// Previous volume level used for direction detection.
@property (nonatomic, assign) float previousVolume;

/// `YES` after we have received at least one valid KVO callback with an
/// initialised volume value.
@property (nonatomic, assign) BOOL hasInitialVolume;

@property (atomic, assign, readwrite) BOOL isObserving;

@end

// ---------------------------------------------------------------------------
// RNHardwareKeyEvent
// ---------------------------------------------------------------------------

@implementation RNHardwareKeyEvent

#pragma mark - Singleton

+ (instancetype)sharedInstance {
  static RNHardwareKeyEvent *instance = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    instance = [[RNHardwareKeyEvent alloc] init];
  });
  return instance;
}

#pragma mark - Lifecycle

- (instancetype)init {
  self = [super init];
  if (self) {
    _listenersLock = [[NSLock alloc] init];
    _mutableListeners = [NSMutableDictionary dictionary];
    _previousVolume = 0.0f;
    _hasInitialVolume = NO;
    _isObserving = NO;
  }
  return self;
}

- (void)dealloc {
  // Belt-and-suspenders cleanup.  The module should have called
  // removeAllListeners (which stops observation) before we are deallocated,
  // but guard anyway.
  [self stopObserving];
}

#pragma mark - Public: Registration

- (NSString *)registerListenerWithKeyCodeStrings:(NSArray<NSString *> *)keyCodeStrings {
  NSString *listenerId = [[NSUUID UUID] UUIDString];

  // Filter to only the key codes iOS can actually observe.
  NSMutableSet<NSString *> *matchingKeys = [NSMutableSet setWithCapacity:2];
  for (id code in keyCodeStrings) {
    if (![code isKindOfClass:[NSString class]]) {
      continue; // Skip non-string values (e.g. numbers from JS)
    }
    if ([code isEqualToString:kVolumeUpKeyCodeString] ||
        [code isEqualToString:kVolumeDownKeyCodeString]) {
      [matchingKeys addObject:code];
    }
  }

  BOOL shouldStart = NO;
  [_listenersLock lock];
  _mutableListeners[listenerId] = [matchingKeys copy];
  shouldStart = (_mutableListeners.count == 1);
  [_listenersLock unlock];

  // Start KVO on the first registration.
  if (shouldStart) {
    // UIKit + KVO setup must happen on the main thread.
    if ([NSThread isMainThread]) {
      [self startObserving];
    } else {
      dispatch_sync(dispatch_get_main_queue(), ^{
        [self startObserving];
      });
    }
  }

  return listenerId;
}

- (void)unregisterListenerWithId:(NSString *)listenerId {
  if (listenerId.length == 0) { return; }

  BOOL shouldStop = NO;
  [_listenersLock lock];
  [_mutableListeners removeObjectForKey:listenerId];
  shouldStop = (_mutableListeners.count == 0);
  [_listenersLock unlock];

  if (shouldStop) {
    if ([NSThread isMainThread]) {
      [self stopObserving];
    } else {
      dispatch_async(dispatch_get_main_queue(), ^{
        [self stopObserving];
      });
    }
  }
}

- (NSArray<NSString *> *)removeAllListeners {
  NSArray<NSString *> *removed;
  [_listenersLock lock];
  removed = [_mutableListeners.allKeys copy];
  [_mutableListeners removeAllObjects];
  [_listenersLock unlock];

  if (removed.count > 0) {
    if ([NSThread isMainThread]) {
      [self stopObserving];
    } else {
      dispatch_async(dispatch_get_main_queue(), ^{
        [self stopObserving];
      });
    }
  }

  return removed;
}

#pragma mark - Public: Introspection

- (NSArray<NSDictionary *> *)getSupportedKeyCodes {
  return @[
    @{
      @"keyCode"       : @(kVolumeUpKeyCode),
      @"keyCodeString" : kVolumeUpKeyCodeString,
      @"label"         : @"Volume Up",
      @"isGamepad"     : @NO,
      @"isSystem"      : @YES,
    },
    @{
      @"keyCode"       : @(kVolumeDownKeyCode),
      @"keyCodeString" : kVolumeDownKeyCodeString,
      @"label"         : @"Volume Down",
      @"isGamepad"     : @NO,
      @"isSystem"      : @YES,
    },
  ];
}

#pragma mark - Volume observation

- (void)startObserving {
  if (self.isObserving) { return; }

  AVAudioSession *session = [AVAudioSession sharedInstance];

  // ------------------------------------------------------------------
  // 1. Activate the audio session so outputVolume KVO fires reliably.
  //    Using MixWithOthers so we don't interrupt background music.
  // ------------------------------------------------------------------
  NSError *error = nil;
  BOOL ok = [session setCategory:AVAudioSessionCategoryPlayback
                     withOptions:AVAudioSessionCategoryOptionMixWithOthers
                           error:&error];
  if (!ok && error) {
    NSLog(@"[HardwareKeyEvent] setCategory failed: %@", error.localizedDescription);
  }

  ok = [session setActive:YES error:&error];
  if (!ok && error) {
    NSLog(@"[HardwareKeyEvent] setActive failed: %@", error.localizedDescription);
  }

  // ------------------------------------------------------------------
  // 2. Snapshot the initial volume BEFORE adding the observer so that
  //    the first KVO notificaton (which may carry oldValue=0) does not
  //    trigger a spurious event.
  // ------------------------------------------------------------------
  self.previousVolume = (float)session.outputVolume;
  self.hasInitialVolume = YES;

  // ------------------------------------------------------------------
  // 3. KVO on outputVolume.
  // ------------------------------------------------------------------
  [session addObserver:self
            forKeyPath:@"outputVolume"
               options:(NSKeyValueObservingOptionNew | NSKeyValueObservingOptionOld)
               context:kVolumeKVOContext];

  // ------------------------------------------------------------------
  // 4. Notification observers.
  // ------------------------------------------------------------------
  NSNotificationCenter *nc = [NSNotificationCenter defaultCenter];

  // Audio session interruption (phone calls, Siri, alarms, …).
  [nc addObserver:self
         selector:@selector(handleAudioSessionInterruption:)
             name:AVAudioSessionInterruptionNotification
           object:session];

  // Media-services reset (rare — e.g. dock disconnect).
  // When this fires we must re-create the audio session state.
  [nc addObserver:self
         selector:@selector(handleMediaServicesWereReset:)
             name:AVAudioSessionMediaServicesWereResetNotification
           object:session];

  // ------------------------------------------------------------------
  // 5. Invisible MPVolumeView (suppresses the system volume HUD).
  // ------------------------------------------------------------------
  [self addInvisibleVolumeView];

  self.isObserving = YES;
}

- (void)stopObserving {
  if (!self.isObserving) { return; }

  AVAudioSession *session = [AVAudioSession sharedInstance];

  // Remove KVO observer (safe to call even if already removed).
  @try {
    [session removeObserver:self forKeyPath:@"outputVolume" context:kVolumeKVOContext];
  } @catch (NSException *ignored) {
    // Observer was never added or was already torn down.
  }

  NSNotificationCenter *nc = [NSNotificationCenter defaultCenter];
  [nc removeObserver:self name:AVAudioSessionInterruptionNotification object:session];
  [nc removeObserver:self name:AVAudioSessionMediaServicesWereResetNotification object:session];

  // Remove the invisible volume view.
  [self removeInvisibleVolumeView];

  // Deactivate the audio session so other apps can resume playback.
  NSError *error = nil;
  [session setActive:NO
         withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation
               error:&error];
  if (error) {
    NSLog(@"[HardwareKeyEvent] Deactivating audio session failed: %@",
          error.localizedDescription);
  }

  self.isObserving = NO;
  self.hasInitialVolume = NO;
}

#pragma mark - KVO callback

- (void)observeValueForKeyPath:(NSString *)keyPath
                      ofObject:(id)object
                        change:(NSDictionary<NSKeyValueChangeKey,id> *)change
                       context:(void *)context {

  // Only handle our own observation; forward anything else up the chain.
  if (context != kVolumeKVOContext) {
    [super observeValueForKeyPath:keyPath ofObject:object change:change context:context];
    return;
  }

  if (![keyPath isEqualToString:@"outputVolume"]) { return; }

  float newVolume = [change[NSKeyValueChangeNewKey] floatValue];
  float prev = self.previousVolume;

  // Update our stored volume level for the next comparison.
  self.previousVolume = newVolume;

  // Guard: ignore callbacks that fire before startObserving has captured the
  // initial value, or where the volume did not change meaningfully.
  if (!self.hasInitialVolume) {
    self.hasInitialVolume = YES;
    return;
  }

  if (fabsf(newVolume - prev) < kMinVolumeDelta) {
    return;
  }

  // Determine direction.
  BOOL isVolumeUp = (newVolume > prev);
  NSString *keyCodeString = isVolumeUp ? kVolumeUpKeyCodeString : kVolumeDownKeyCodeString;
  int      keyCode       = isVolumeUp ? kVolumeUpKeyCode       : kVolumeDownKeyCode;

  [self dispatchEventToListenersWithKeyCodeString:keyCodeString keyCode:keyCode];
}

#pragma mark - Audio session notifications

- (void)handleAudioSessionInterruption:(NSNotification *)notification {
  NSDictionary *userInfo = notification.userInfo;
  NSNumber *typeNumber = userInfo[AVAudioSessionInterruptionTypeKey];
  if (!typeNumber) { return; }

  AVAudioSessionInterruptionType type = (AVAudioSessionInterruptionType)[typeNumber unsignedIntegerValue];

  switch (type) {
    case AVAudioSessionInterruptionTypeBegan:
      // Phone call, Siri, alarm, etc. started — volume events during the
      // interruption are unreliable at best.
      if (self.onError) {
        self.onError(@"Audio session interrupted (e.g. phone call)");
      }
      break;

    case AVAudioSessionInterruptionTypeEnded: {
      // Interruption ended — attempt to re-activate the session.
      NSNumber *optionsNumber = userInfo[AVAudioSessionInterruptionOptionKey];
      AVAudioSessionInterruptionOptions options =
        (AVAudioSessionInterruptionOptions)[optionsNumber unsignedIntegerValue];

      if (options & AVAudioSessionInterruptionOptionShouldResume) {
        NSError *error = nil;
        BOOL ok = [[AVAudioSession sharedInstance] setActive:YES error:&error];
        if (!ok && self.onError) {
          self.onError([NSString stringWithFormat:
            @"Failed to re-activate audio session after interruption: %@",
            error.localizedDescription]);
        }
      }
      break;
    }
  }
}

- (void)handleMediaServicesWereReset:(NSNotification *)notification {
  (void)notification;
  // The entire audio subsystem was reset (debug / dock events).
  // Tear down and re-create our observation.
  [self stopObserving];
  // Only restart if we still have listeners.
  [_listenersLock lock];
  BOOL hasListeners = (_mutableListeners.count > 0);
  [_listenersLock unlock];
  if (hasListeners) {
    if ([NSThread isMainThread]) {
      [self startObserving];
    } else {
      dispatch_async(dispatch_get_main_queue(), ^{
        [self startObserving];
      });
    }
  }
}

#pragma mark - MPVolumeView (HUD suppression)

- (void)addInvisibleVolumeView {
  if (self.volumeView) { return; }

  // MPVolumeView must be added on the main thread.
  if (![NSThread isMainThread]) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self addInvisibleVolumeView];
    });
    return;
  }

  MPVolumeView *volumeView = [[MPVolumeView alloc] initWithFrame:CGRectMake(-1000, -1000, 1, 1)];

  // On some iOS versions the view must NOT be marked `hidden` for HUD
  // suppression to take effect.  Instead we place it far off-screen and
  // make it nearly transparent.
  volumeView.hidden = NO;
  volumeView.alpha = 0.01f;
  volumeView.userInteractionEnabled = NO;

  UIWindow *window = [self findKeyWindow];
  if (window) {
    [window addSubview:volumeView];
    self.volumeView = volumeView;
  } else {
    // No window is available yet (e.g. the app is still launching).
    // Retry after a short delay.
    __weak typeof(self) weakSelf = self;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (strongSelf && strongSelf.isObserving && !strongSelf.volumeView) {
        [strongSelf addInvisibleVolumeView];
      }
    });
  }
}

- (void)removeInvisibleVolumeView {
  if (!self.volumeView) { return; }

  if (![NSThread isMainThread]) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self removeInvisibleVolumeView];
    });
    return;
  }

  [self.volumeView removeFromSuperview];
  self.volumeView = nil;
}

#pragma mark - Window lookup

- (nullable UIWindow *)findKeyWindow {
  if (@available(iOS 13.0, *)) {
    for (UIScene *scene in [UIApplication sharedApplication].connectedScenes) {
      if (![scene isKindOfClass:[UIWindowScene class]]) { continue; }
      UIWindowScene *windowScene = (UIWindowScene *)scene;
      if (windowScene.activationState != UISceneActivationStateForegroundActive) {
        continue;
      }
      for (UIWindow *window in windowScene.windows) {
        if (window.isKeyWindow) { return window; }
      }
      // Fallback: return the first window of the foreground scene.
      if (windowScene.windows.count > 0) {
        return windowScene.windows.firstObject;
      }
    }
  } else {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    return [UIApplication sharedApplication].keyWindow;
#pragma clang diagnostic pop
  }
  return nil;
}

#pragma mark - Event dispatch

- (void)dispatchEventToListenersWithKeyCodeString:(NSString *)keyCodeString
                                          keyCode:(int)keyCode {
  if (!self.onKeyEvent) { return; }

  // Snapshot under the lock so we don't block the main thread if a listener
  // callback takes a long time.
  NSDictionary<NSString *, NSSet<NSString *> *> *snapshot = nil;
  [_listenersLock lock];
  snapshot = [_mutableListeners copy];
  [_listenersLock unlock];

  for (NSString *listenerId in snapshot) {
    NSSet<NSString *> *interestedKeys = snapshot[listenerId];
    if ([interestedKeys containsObject:keyCodeString]) {
      self.onKeyEvent(listenerId, keyCodeString, keyCode);
    }
  }
}

@end
