import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useHardwareKeyEvent, KeyCode } from 'react-native-hardwarekey-event';
import type { KeyEvent } from 'react-native-hardwarekey-event';

export default function App() {
  const [pressed, setPressed] = useState<null | string>(null);

  const { isRegistered, error } = useHardwareKeyEvent({
    keys: [KeyCode.VOLUME_UP, KeyCode.VOLUME_DOWN],
    onKeyDown: (event: KeyEvent) => {
      console.log('Key down:', event.keyCodeString, event);
      setPressed(event.keyCodeString);
    },
  });

  return (
    <View style={styles.container}>
      {isRegistered && (
        <View style={styles.container}>
          <Text>Listening for hardware keys</Text>
          {pressed && <Text>Last pressed: {pressed}</Text>}
        </View>
      )}

      {!isRegistered && !error && <Text>Registering...</Text>}

      {error && <Text style={styles.error}>Error: {error.message}</Text>}

      {!pressed && isRegistered && <Text>Press the volume buttons</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: 'red',
  },
});
