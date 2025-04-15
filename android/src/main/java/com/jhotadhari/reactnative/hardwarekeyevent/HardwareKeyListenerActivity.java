package com.jhotadhari.reactnative.hardwarekeyevent;

import android.view.KeyEvent;

import com.facebook.react.ReactActivity;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public abstract class HardwareKeyListenerActivity extends ReactActivity implements HardwareKeyListenerHandler {

    protected Map<String, HardwareKeyListener> hardwareKeyListeners = new HashMap<>();

	public String getKeyEventKeyCodeString( KeyEvent event ) {
        String keyCodeString = null;
        for ( Field field : KeyEvent.class.getFields() ) {
            if ( null == keyCodeString && field.getName().startsWith( "KEYCODE_" ) ) {
                try {
					Object fieldVal = field.get( event );
					if ( null != fieldVal ) {
						int fieldKeyCode = (int) fieldVal;
						if ( fieldKeyCode == event.getKeyCode() ) {
							keyCodeString = field.getName();
						}
                    }
                } catch ( IllegalAccessException e ) {
					if ( ! hardwareKeyListeners.isEmpty() ) {
						for ( HardwareKeyListener hardwareKeyListener : hardwareKeyListeners.values() ) {
							hardwareKeyListener.onError( e.getMessage() );
						}
					}
                }
            }
        }
        return keyCodeString;
    }

    @Override
    public boolean dispatchKeyEvent( KeyEvent event ) {
        if ( ! hardwareKeyListeners.isEmpty() ) {
			for ( HardwareKeyListener hardwareKeyListener : hardwareKeyListeners.values() ) {
				String keyCodeString = getKeyEventKeyCodeString( event );
				if ( null != keyCodeString && hardwareKeyListener.getKeyCodeStrings().contains( keyCodeString ) ) {
					if ( event.getDownTime() != event.getEventTime() ) { // only on up events
						hardwareKeyListener.onKeyUp( keyCodeString, event );
					}
					return true;
				}
            }
        }
        return super.dispatchKeyEvent(event);
    }

    public String addHardwareKeyListener( HardwareKeyListener hardwareKeyListener ) {
        String uuid = UUID.randomUUID().toString();
        hardwareKeyListeners.put( uuid, hardwareKeyListener );
        return uuid;
    }

    public void removeHardwareKeyListener( String uuid ) {
        hardwareKeyListeners.remove( uuid );
    }

}

