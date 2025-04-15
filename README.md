# react-native-hardwarekey-event

Easily add JS callbacks to hardware KeyEvents

## Requirements

The library is using a TurboModule, so it requires to have react-native new architecture enabled.

`./android/gradle.properties`:
```properties
newArchEnabled=true
```

### Android only

Sorry, I personally don't care for iOS. If someone adds iOS support, I will be happy to merge the pull request.

## Installation

```sh
# Using npm
npm install react-native-hardwarekey-event

# Using yarn
yarn add react-native-hardwarekey-event
```

The KeyEvents are dispatched by the activity. Therefore the activity needs some modification. The activity has to implement the [`HardwareKeyListenerHandler`](https://github.com/jhotadhari/react-native-hardwarekey-event/blob/main/android/src/main/java/com/jhotadhari/reactnative/hardwarekeyevent/HardwareKeyListenerHandler.java) interface.

The easiest way to do this is to extend the [`HardwareKeyListenerActivity`](https://github.com/jhotadhari/react-native-hardwarekey-event/blob/main/android/src/main/java/com/jhotadhari/reactnative/hardwarekeyevent/HardwareKeyListenerActivity.java).
See the example application [`MainActivity`](https://github.com/jhotadhari/react-native-hardwarekey-event/blob/main/example/android/app/src/main/java/jhotadhari/reactnative/hardwarekeyevent/example/MainActivity.kt):
```diff
- class MainActivity : ReactActivity() {
+ class MainActivity : HardwareKeyListenerActivity() {

  // ...

}
```

If your activity can't extend the `HardwareKeyListenerActivity`, just implement the `HardwareKeyListenerHandler` interface and copy over the code from the `HardwareKeyListenerActivity`.

## Usage

Easiest way is to use the [`useHardwareKeyEvent`](https://github.com/jhotadhari/react-native-hardwarekey-event/blob/main/src/useHardwareKeyEvent.ts) hook:

```js
import {
  useHardwareKeyEvent,
  type KeyEventResponse,
  type EventError,
} from 'react-native-hardwarekey-event';

export default function App() {

  useHardwareKeyEvent( {
    callbacks: {
      'KEYCODE_VOLUME_UP': ( response?: KeyEventResponse ) => {
        console.log( response );
      },
      'KEYCODE_VOLUME_DOWN': ( response?: KeyEventResponse ) => {
        console.log( response );
      },
    },
    onError: ( error?: EventError ) => {
      console.log( error );
    }
  } );

  // ...

}
```

More advances usage would be to import the `HardwareKeyEvent` module and write your own implementation.

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
