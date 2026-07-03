package com.jhotadhari.reactnative.hardwarekeyevent

import android.app.Activity
import android.app.Application
import android.view.KeyCharacterMap
import android.view.KeyEvent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.lang.ref.WeakReference
import java.util.LinkedHashMap
import java.util.UUID

/**
 * TurboModule that manages hardware-key listeners via [Window.Callback]
 * interception.
 *
 * Each registration receives a UUID (returned to JS as `listenerId`).
 * Multiple registrations co-exist, and each independently fires
 * `onKeyEvent` with its own `listenerId` in the payload.
 *
 * The module maintains an ordered chain of [KeyEventInterceptor] instances
 * wrapping the current Activity's [Window.Callback]. When registrations
 * are added or removed the chain is rebuilt from scratch, guaranteeing a
 * correct delegation order without manual pointer patching.
 */
class HardwareKeyListenerModule(
    reactContext: ReactApplicationContext
) : NativeHardwareKeyEventSpec(reactContext),
    KeyEventInterceptor.KeyEventEmitter {

    companion object {
        const val NAME = "HardwareKeyEvent"
    }

    // -------------------------------------------------------------------
    // State (all guarded by synchronized(this) for mutation)
    // -------------------------------------------------------------------

    /**
     * All registrations that have not been unregistered, keyed by
     * listener UUID.  Insertion order is preserved so the interceptor
     * chain mirrors the registration order.
     */
    private val registrations = LinkedHashMap<String, Set<String>>()

    /**
     * Active [KeyEventInterceptor] instances, keyed by listener UUID.
     * Only non-empty while a chain is installed on the current Activity.
     */
    private val interceptors = LinkedHashMap<String, KeyEventInterceptor>()

    /** The Activity that currently owns the interceptor chain. */
    private var activeActivityRef: WeakReference<Activity>? = null

    /**
     * The [Window.Callback] that was in place on the active Activity
     * before any interceptors were installed.  Restored on detach.
     */
    private var originalCallback: android.view.Window.Callback? = null

    // -------------------------------------------------------------------
    // Public lifecycle hooks — called by HardwareKeyEventLifecycleObserver
    // -------------------------------------------------------------------

    /**
     * Installs the interceptor chain on a newly created Activity when
     * there are pending registrations.
     *
     * If a different Activity was previously active the chain is detached
     * from the old Activity first.
     */
    internal fun onActivityCreated(activity: Activity) {
        synchronized(this) {
            if (registrations.isEmpty()) return

            val prevActivity = activeActivityRef?.get()
            if (prevActivity != null && prevActivity !== activity) {
                detachFromActivity(prevActivity)
            }

            activeActivityRef = WeakReference(activity)
            installOnActivity(activity)
        }
    }

    /**
     * Removes the interceptor chain from a destroyed Activity if it was
     * the currently active one.
     */
    internal fun onActivityDestroyed(activity: Activity) {
        synchronized(this) {
            val activeActivity = activeActivityRef?.get()
            if (activeActivity === activity) {
                detachFromActivity(activity)
            }
        }
    }

    /**
     * Reinstalls the interceptor chain on a resumed Activity if pending
     * registrations exist but no chain is currently active (e.g. after
     * navigating A → B → back to A, where B's creation stole the chain
     * and B's destruction detached it).
     */
    internal fun onActivityResumed(activity: Activity) {
        synchronized(this) {
            if (registrations.isEmpty()) return

            val activeActivity = activeActivityRef?.get()
            // Reinstall if the chain was detached (stale or null reference).
            if (activeActivity == null || activeActivity !== activity) {
                if (activeActivity != null) {
                    detachFromActivity(activeActivity)
                }
                activeActivityRef = WeakReference(activity)
                installOnActivity(activity)
            }
        }
    }

    // -------------------------------------------------------------------
    // TurboModule overrides (methods match the codegen spec)
    //
    // IMPORTANT: The generated NativeHardwareKeyEventSpec.java must be
    // regenerated after updating src/NativeHardwareKeyEvent.ts.
    // The previous spec exposed `enableEvents`; the new spec exposes
    // `registerListener`, `unregisterListener`, and `getSupportedKeyCodes`.
    // -------------------------------------------------------------------

    override fun getName(): String = NAME

    /**
     * Registers a listener for one or more hardware key events.
     *
     * @param params.keyCodeStrings array of {@code KEYCODE_*} constant
     *                              names to observe (unknown entries are
     *                              silently ignored).
     * @return a promise that resolves with `{ listenerId: string }`.
     */
    override fun registerListener(params: ReadableMap, promise: Promise) {
        try {
            if (!params.hasKey("keyCodeStrings")) {
                promise.reject(
                    "INVALID_PARAMS",
                    "Missing required parameter 'keyCodeStrings'"
                )
                return
            }

            val arr: ReadableArray? = params.getArray("keyCodeStrings")
            if (arr == null) {
                promise.reject(
                    "INVALID_PARAMS",
                    "Unable to read parameter 'keyCodeStrings' as array"
                )
                return
            }

            // Filter to only known key codes (silently discard unknowns).
            val filteredSet = (0 until arr.size())
                .mapNotNull { arr.getString(it) }
                .filter { KeyCodeMapper.getKeyCodeInt(it) != -1 }
                .toSet()

            val listenerId = UUID.randomUUID().toString()

            // Build the response ahead of time so that the registration
            // commit and response construction are both guarded by the
            // same try-catch — a failure during WritableMap allocation
            // will reject the promise without leaving a leaked native
            // registration.
            val response = Arguments.createMap()
            response.putString("listenerId", listenerId)

            synchronized(this) {
                registrations[listenerId] = filteredSet

                // Install immediately if an Activity is already available.
                val activity = resolveCurrentActivity()
                if (activity != null) {
                    if (originalCallback == null) {
                        // First registration — save the original callback
                        // and install.
                        activeActivityRef = WeakReference(activity)
                        installOnActivity(activity)
                    } else {
                        rebuildAndInstall(activity)
                    }
                }
                // Otherwise the registration is pending; the lifecycle
                // observer will install when an Activity appears.
            }

            promise.resolve(response)
        } catch (e: Exception) {
            promise.reject("REGISTER_ERROR", e.message ?: "Failed to register listener")
        }
    }

    /**
     * Unregisters a previously registered listener.
     *
     * @param listenerId the registration ID returned by [registerListener].
     *                   Safe no-op when the ID is unknown or already
     *                   unregistered.
     */
    override fun unregisterListener(listenerId: String, promise: Promise) {
        try {
            synchronized(this) {
                val existed = registrations.remove(listenerId) != null
                interceptors.remove(listenerId)

                val activity = resolveCurrentActivity()
                if (activity != null) {
                    if (registrations.isEmpty()) {
                        detachFromActivity(activity)
                    } else if (existed) {
                        // Only rebuild if we actually removed something.
                        rebuildAndInstall(activity)
                    }
                }
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject(
                "UNREGISTER_ERROR",
                e.message ?: "Failed to unregister listener"
            )
        }
    }

    /**
     * Queries every {@code KEYCODE_*} constant known to the current
     * Android runtime, augmented with metadata (display label, gamepad
     * flag, system-key flag).
     *
     * @return a promise that resolves with an array of
     *         `{ keyCode, keyCodeString, label, isGamepad, isSystem }`
     *         objects.
     */
    override fun getSupportedKeyCodes(promise: Promise) {
        try {
            val result: WritableArray = Arguments.createArray()

            // Load the key character map once outside the loop — there is
            // no need to reload it from disk for every key code.
            val kcm: KeyCharacterMap? = try {
                KeyCharacterMap.load(KeyCharacterMap.VIRTUAL_KEYBOARD)
            } catch (_: Exception) {
                null
            }

            for (keyCodeString in KeyCodeMapper.getSupportedKeyCodes()) {
                val keyCode = KeyCodeMapper.getKeyCodeInt(keyCodeString)
                val entry: WritableMap = Arguments.createMap()
                entry.putInt("keyCode", keyCode)
                entry.putString("keyCodeString", keyCodeString)

                // Best-effort metadata.
                var label: String? = null
                var isGamepad = false
                var isSystem = false
                try {
                    isGamepad = KeyEvent.isGamepadButton(keyCode)
                    val displayChar = kcm?.getDisplayLabel(keyCode) ?: 0.toChar()
                    if (displayChar != 0.toChar()) {
                        label = displayChar.toString()
                    }
                } catch (_: Exception) {
                    // Metadata unavailable; leave label null and booleans
                    // at their defaults.
                }
                entry.putString("label", label)
                entry.putBoolean("isGamepad", isGamepad)
                entry.putBoolean("isSystem", isSystem)

                result.pushMap(entry)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject(
                "QUERY_ERROR",
                e.message ?: "Failed to query supported key codes"
            )
        }
    }

    // -------------------------------------------------------------------
    // KeyEventEmitter implementation (callback from interceptors)
    // -------------------------------------------------------------------

    /**
     * Called by [KeyEventInterceptor] on the UI thread when a registered
     * key event is intercepted.  Constructs the full [KeyEvent] payload
     * and emits it to JS via the codegen-generated event emitter.
     */
    override fun onKeyEvent(
        listenerId: String,
        keyCodeString: String,
        event: KeyEvent
    ) {
        val action = when (event.action) {
            KeyEvent.ACTION_DOWN -> "down"
            KeyEvent.ACTION_UP -> "up"
            KeyEvent.ACTION_MULTIPLE -> "multiple"
            else -> "unknown"
        }
        val payload: WritableMap = Arguments.createMap()
        payload.putString("listenerId", listenerId)
        payload.putInt("keyCode", event.keyCode)
        payload.putString("keyCodeString", keyCodeString)
        payload.putString("action", action)
        payload.putInt("metaState", event.metaState)
        payload.putInt("repeatCount", event.repeatCount)
        payload.putInt("deviceId", event.deviceId)
        payload.putInt("flags", event.flags)

        emitOnKeyEvent(payload)
    }

    /**
     * Called by [KeyEventInterceptor] when an unrecoverable error
     * occurs during event processing.  Emitted through the same
     * `onKeyEvent` channel with `action = "error"` so consumers can
     * observe it without a dedicated error emitter.
     */
    override fun onError(listenerId: String, errorMsg: String) {
        val payload: WritableMap = Arguments.createMap()
        payload.putString("listenerId", listenerId)
        payload.putInt("keyCode", 0)
        payload.putString("keyCodeString", "")
        payload.putString("action", "error")
        payload.putInt("metaState", 0)
        payload.putInt("repeatCount", 0)
        payload.putInt("deviceId", 0)
        payload.putInt("flags", 0)
        payload.putString("errorMsg", errorMsg)

        emitOnKeyEvent(payload)
    }

    // -------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------

    /**
     * Returns the most recently created Activity this module is aware of,
     * preferring the lifecycle-tracked reference and falling back to the
     * ReactContext.
     */
    private fun resolveCurrentActivity(): Activity? {
        activeActivityRef?.get()?.let { return it }
        return try {
            reactApplicationContext.currentActivity
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Saves the Activity's current [Window.Callback] as
     * [originalCallback] and builds the interceptor chain.
     *
     * Must be called inside [synchronized].
     */
    private fun installOnActivity(activity: Activity) {
        val window = activity.window ?: return
        originalCallback = window.callback
        rebuildAndInstall(activity)
    }

    /**
     * Restores [originalCallback] on the Activity's Window and clears
     * all interceptor state.
     *
     * Must be called inside [synchronized].
     */
    private fun detachFromActivity(activity: Activity) {
        val window = activity.window
        if (window != null && originalCallback != null) {
            window.callback = originalCallback
        }
        interceptors.clear()
        originalCallback = null
        if (activeActivityRef?.get() === activity) {
            activeActivityRef?.clear()
            activeActivityRef = null
        }
    }

    /**
     * Rebuilds the complete interceptor chain from [registrations] and
     * sets it as the Activity's [Window.Callback].
     *
     * The chain honours registration insertion order: the first
     * registration's interceptor is innermost (closest to the original
     * callback) and the most recent registration's interceptor is
     * outermost (set directly on the Window).
     *
     * Must be called inside [synchronized].
     */
    private fun rebuildAndInstall(activity: Activity) {
        val window = activity.window ?: return

        // Start the chain from the saved original callback.
        var chain: android.view.Window.Callback = originalCallback
            ?: return  // installOnActivity() not yet called — unexpected

        interceptors.clear()

        for ((listenerId, keyCodeSet) in registrations) {
            val interceptor = KeyEventInterceptor(chain, keyCodeSet, listenerId, this)
            interceptors[listenerId] = interceptor
            chain = interceptor
        }

        // Atomic swap — any in-flight dispatchKeyEvent on the old chain
        // completes safely before the old interceptors become unreachable.
        window.callback = chain
    }
}
