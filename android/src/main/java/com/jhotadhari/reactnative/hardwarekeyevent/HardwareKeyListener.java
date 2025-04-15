package com.jhotadhari.reactnative.hardwarekeyevent;

import android.view.KeyEvent;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;

import java.util.List;

public class HardwareKeyListener {

    protected final HardwareKeyEventModule hardwareKeyListenerModule;

	public HardwareKeyListener( HardwareKeyEventModule hardwareKeyListenerModule ) {
		this.hardwareKeyListenerModule = hardwareKeyListenerModule;
	}

	public void onKeyUp( String keyCodeString, KeyEvent event ) {
		WritableMap payload = Arguments.createMap();
		payload.putInt( "keyCode", event.getKeyCode() );
		payload.putString( "keyCodeString", keyCodeString );
		hardwareKeyListenerModule.emitEvent( payload );
	}

	public void onError( String errorMsg ) {
		WritableMap payload = Arguments.createMap();
		payload.putString( "errorMsg", errorMsg );
		hardwareKeyListenerModule.emitError( payload );
	}

	public List<String> getKeyCodeStrings() {
		return hardwareKeyListenerModule.getKeyCodeStrings();
	}
}
