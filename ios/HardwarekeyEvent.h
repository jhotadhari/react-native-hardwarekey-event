#import <React/RCTEventEmitter.h>
#import <React/RCTBridgeModule.h>

#if __has_include(<HardwareKeyEvent/RNHardwareKeyEventSpec.h>)
#import <HardwareKeyEvent/RNHardwareKeyEventSpec.h>
#endif

@interface HardwareKeyEvent : RCTEventEmitter
#if __has_include(<HardwareKeyEvent/RNHardwareKeyEventSpec.h>)
<NativeHardwareKeyEventSpec>
#endif

@end
