import {
  TurboModuleRegistry,
  type TurboModule,
} from 'react-native';
import type { EventEmitter, Int32 } from 'react-native/Libraries/Types/CodegenTypes';

export interface KeyEventResponse {
keyCode: Int32;
  keyCodeString: string;                  // 'KEYCODE_VOLUME_UP' | 'KEYCODE_VOLUME_DOWN';
};

export interface EnableEventsParams {
  keyCodeStrings: ReadonlyArray<string>;  // 'KEYCODE_VOLUME_UP' | 'KEYCODE_VOLUME_DOWN';
};

export interface EnableEventsResponse {
  added: string;                          // uuid of HardwareKeyListener
  removed?: string;                       // uuid of HardwareKeyListener
};

export interface EventError {
  errorMsg: string;
};

export interface PromiseError {
  nativeStackAndroid?: any[];
  userInfo: {
      errorMsg: string;
  };
  code?: string;
};

export interface Spec extends TurboModule {
  enableEvents( params: EnableEventsParams ): Promise<EnableEventsResponse>;
  onKeyEvent: EventEmitter<KeyEventResponse>;
  onError: EventEmitter<EventError>;
};

export default TurboModuleRegistry.getEnforcing<Spec>( 'HardwareKeyEvent' );
