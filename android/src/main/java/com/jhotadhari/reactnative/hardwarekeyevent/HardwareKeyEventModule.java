package com.jhotadhari.reactnative.hardwarekeyevent;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

public class HardwareKeyEventModule extends NativeHardwareKeyEventSpec {

	public static final String NAME = "HardwareKeyEvent";

	protected String hardwareKeyListenerUuid = null;

	protected List<String> keyCodeStrings;

	public HardwareKeyEventModule( ReactApplicationContext reactContext ) {
		super( reactContext );
	}

	@NonNull
	@Override
	public String getName() {
		return NAME;
	}

	@Override
	public void enableEvents( ReadableMap params, Promise promise ) {
		if ( ! params.hasKey( "keyCodeStrings" ) ) {
			promiseReject( promise, "Undefined parameter \"keyCodeStrings\"" ); return;
		}
		ReadableArray keyCodeStringsArr = params.getArray( "keyCodeStrings" );
		if ( null == keyCodeStringsArr ) {
			promiseReject( promise, "Unable to read parameter \"keyCodeStrings\"" ); return;
		}
		WritableMap response = new WritableNativeMap();
		keyCodeStrings = new ArrayList<String>();
		for ( int i = 0; i < keyCodeStringsArr.size(); i++ ) {
			keyCodeStrings.add( keyCodeStringsArr.getString( i ) );
		}
		removeHardwareKeyListener( promise, response );
		addHardwareKeyListener( promise, response );
		promise.resolve( response );
	}

	public List<String> getKeyCodeStrings() {
		return keyCodeStrings;
	}

	protected void addHardwareKeyListener( Promise promise, WritableMap response ) {
		try {
			if ( HardwareKeyListenerHandler.class.isAssignableFrom( getReactApplicationContext().getCurrentActivity().getClass() ) ) {
				HardwareKeyListener hardwareKeyListener = new HardwareKeyListener( this );
				Class[] cArg = new Class[1];
				cArg[0] = HardwareKeyListener.class;
				Method meth = getReactApplicationContext().getCurrentActivity().getClass().getMethod(
					"addHardwareKeyListener",
					cArg
				);
				Object value = meth.invoke(
					getReactApplicationContext().getCurrentActivity(),
					hardwareKeyListener
				);
				hardwareKeyListenerUuid = (String) value;
				response.putString( "added", hardwareKeyListenerUuid );
			} else {
				promiseReject( promise, "Activity does not implement interface \"HardwareKeyListenerHandler\"" );
			}
		} catch ( NullPointerException | NoSuchMethodException | IllegalAccessException | InvocationTargetException e ) {
			e.printStackTrace();
			promiseReject( promise, e.getMessage() );
		}
	}

	protected void removeHardwareKeyListener( Promise promise, WritableMap response ) {
		try {
			if ( HardwareKeyListenerHandler.class.isAssignableFrom( getReactApplicationContext().getCurrentActivity().getClass() ) ) {
				if ( null != hardwareKeyListenerUuid ) {
					Class[] cArg = new Class[1];
					cArg[0] = String.class;
					Method method = getReactApplicationContext().getCurrentActivity().getClass().getMethod(
						"removeHardwareKeyListener",
						cArg
					);
					method.invoke(
						getReactApplicationContext().getCurrentActivity(),
						hardwareKeyListenerUuid
					);
					response.putString( "removed", hardwareKeyListenerUuid );
					hardwareKeyListenerUuid = null;
				}
			} else {
				promiseReject( promise, "Activity does not implement interface \"HardwareKeyListenerHandler\"" );
			}
		} catch ( NullPointerException | NoSuchMethodException | IllegalAccessException | InvocationTargetException e ) {
			e.printStackTrace();
			promiseReject( promise, e.getMessage() );
		}
	}

	public void emitEvent( WritableMap payload ) {
		emitOnKeyEvent( payload );
	}

	public void emitError( WritableMap payload ) {
		emitOnError( payload );
	}

	protected void promiseReject( Promise promise, String errorMsg ) {
		// emit error.
		WritableMap payload = Arguments.createMap();
		payload.putString( "errorMsg", errorMsg );
		emitError( payload );
		// reject promise.
		WritableMap error = Arguments.createMap();
		error.putString( "errorMsg", errorMsg );
		promise.reject( "error", error );
	}

}
