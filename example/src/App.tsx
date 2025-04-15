import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import {
  useHardwareKeyEvent,
  type KeyEventResponse,
  type EventError,
} from 'react-native-hardwarekey-event';

export default function App() {

  const [pressed,setPressed] = useState<null | string>( null );

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
      console.log( 'error', error );
    }
  } );

  return (
    <View style={ styles.container }>

      { pressed && <View style={ styles.container }>
        <Text>Last pressed:</Text>
        <Text>{ pressed }</Text>
      </View> }

      { ! pressed && <Text>Press the volume buttons</Text>}

    </View>
  );
}

const styles = StyleSheet.create( {
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
} );
