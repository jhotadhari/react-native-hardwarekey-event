/**
 * External dependencies
 */
import { useEffect, useRef } from 'react';
import type { EventSubscription } from 'react-native';

/**
 * Internal dependencies
 */
import HardwareKeyEvent, {
    type EventError,
    type KeyEventResponse,
} from './NativeHardwareKeyEvent';

const useHardwareKeyEvent = ( {
    callbacks,
    onError,
} : {
    callbacks: { [value: string]: ( response?: KeyEventResponse ) => void };
    onError?: ( response?: EventError ) => void;
} ) => {

    const keyEventSubscription = useRef<null | EventSubscription>( null );
    const errorSubscription = useRef<null | EventSubscription>( null );

    useEffect( () => {
        // Update HardwareKeyEvent events.
        HardwareKeyEvent.enableEvents( {
            keyCodeStrings: Object.keys( callbacks ).filter( keyCodeString => keyCodeString.startsWith( 'KEYCODE_' ) ),
        } )
        // We don't need the response.
        // .then( ( response: EnableEventsResponse ) => console.log( response ) )
        .catch(
            // Just catch the error, but don't do anything.
            // The module emits the error as well. If someone needs the error, they can use the onError callback.
            () => null
            // ( error: PromiseError ) => console.log( error.userInfo.errorMsg )
        );

        // Update keyEventSubscription: Run callbacks on key events.
        keyEventSubscription.current = HardwareKeyEvent.onKeyEvent( ( response: KeyEventResponse ) => {
            if ( callbacks.hasOwnProperty( response.keyCodeString ) ) {
                const callback = callbacks[response.keyCodeString];
                callback && callback( response );
            }
        } );

        return  () => {
            // Remove keyEventSubscription.
            keyEventSubscription.current?.remove();
            keyEventSubscription.current = null;
        }
    }, [callbacks] );

    useEffect( () => {
        const removeErrorSubscription = () => {
            errorSubscription.current?.remove();
            errorSubscription.current = null;
        };

        // Update errorSubscription: Run onError callback on error event. Or remove subscription, if onError callback is undefined.
        if ( onError ) {
            errorSubscription.current = HardwareKeyEvent.onError( onError );
        } else {
            removeErrorSubscription();
        }

        // Remove keyEventSubscription.
        return removeErrorSubscription;
    }, [onError] );

};

export default useHardwareKeyEvent;