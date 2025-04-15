package com.jhotadhari.reactnative.hardwarekeyevent;

import android.view.KeyEvent;

public interface HardwareKeyListenerHandler {

	String getKeyEventKeyCodeString( KeyEvent event );

	boolean dispatchKeyEvent( KeyEvent event );

	String addHardwareKeyListener( HardwareKeyListener hardwareKeyListener );

	void removeHardwareKeyListener( String uuid );

}
