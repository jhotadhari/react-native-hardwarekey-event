package com.jhotadhari.reactnative.hardwarekeyevent

import android.view.ActionMode
import android.view.KeyEvent
import android.view.Menu
import android.view.MenuItem
import android.view.MotionEvent
import android.view.SearchEvent
import android.view.View
import android.view.Window
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent

/**
 * Wraps an Activity's [Window.Callback] to intercept hardware key events.
 *
 * Only [dispatchKeyEvent] is intercepted — all other [Window.Callback]
 * methods delegate directly to the wrapped callback so that the host
 * Activity's normal touch, menu, and focus behaviour is undisturbed.
 *
 * This class is **internal** (Kotlin module-private). It is not part of the
 * public API surface and is managed exclusively by
 * [HardwareKeyListenerModule].
 *
 * @property delegate the next [Window.Callback] in the chain (may be
 *                    the Activity's original callback or another
 *                    [KeyEventInterceptor]). Marked [Volatile] so that
 *                    chain-rebuild writes are visible to the UI thread
 *                    on every [dispatchKeyEvent] invocation.
 * @property keyCodeStrings immutable set of {@code KEYCODE_*} string
 *                          constants this interceptor is interested in.
 * @property listenerId the registration UUID that created this
 *                      interceptor — included in every emitted event
 *                      payload so JS consumers can route events.
 * @property emitter callback invoked when a matching key event is
 *                   intercepted (or an error occurs).
 */
internal class KeyEventInterceptor(
    @Volatile
    private var delegate: Window.Callback,
    private val keyCodeStrings: Set<String>,
    private val listenerId: String,
    private val emitter: KeyEventEmitter
) : Window.Callback {

    // -------------------------------------------------------------------
    // Emitter interface (decouples interceptor from the TurboModule)
    // -------------------------------------------------------------------

    /**
     * Callback interface through which the interceptor reports key events
     * and errors up to [HardwareKeyListenerModule].
     */
    internal interface KeyEventEmitter {
        /**
         * A registered key event was intercepted.
         *
         * @param listenerId    the registration UUID
         * @param keyCodeString the resolved {@code KEYCODE_*} constant name
         * @param event         the raw Android [KeyEvent]
         */
        fun onKeyEvent(listenerId: String, keyCodeString: String, event: KeyEvent)

        /**
         * An error occurred while processing a key event for the given
         * registration.
         *
         * @param listenerId the registration UUID
         * @param errorMsg   human-readable error description
         */
        fun onError(listenerId: String, errorMsg: String)
    }

    // -------------------------------------------------------------------
    // Intercepted method
    // -------------------------------------------------------------------

    /**
     * Resolves the key code to a string via [KeyCodeMapper], checks
     * membership in [keyCodeStrings], and if matched emits the event to JS
     * and consumes it (returns `true`).
     *
     * Unmatched events fall through to the delegate.
     */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val keyCodeString = KeyCodeMapper.getKeyCodeString(event.keyCode)
        if (keyCodeString != null && keyCodeString in keyCodeStrings) {
            try {
                emitter.onKeyEvent(listenerId, keyCodeString, event)
            } catch (e: Exception) {
                try {
                    emitter.onError(
                        listenerId,
                        "Failed to emit key event for $keyCodeString: ${e.message}"
                    )
                } catch (_: Exception) {
                    // emitOnKeyEvent inside onError also failed — the bridge
                    // is likely dead.  There is nothing more we can do.
                }
            }
            // Delegate to inner interceptors so other listeners for the same
            // key code also receive this event, then consume it to prevent the
            // original Window.Callback from processing it a second time.
            delegate.dispatchKeyEvent(event)
            return true
        }
        return delegate.dispatchKeyEvent(event)
    }

    // -------------------------------------------------------------------
    // Delegated Window.Callback methods
    // -------------------------------------------------------------------

    override fun dispatchKeyShortcutEvent(event: KeyEvent): Boolean =
        delegate.dispatchKeyShortcutEvent(event)

    override fun dispatchTouchEvent(event: MotionEvent): Boolean =
        delegate.dispatchTouchEvent(event)

    override fun dispatchTrackballEvent(event: MotionEvent): Boolean =
        delegate.dispatchTrackballEvent(event)

    override fun dispatchGenericMotionEvent(event: MotionEvent): Boolean =
        delegate.dispatchGenericMotionEvent(event)

    override fun dispatchPopulateAccessibilityEvent(event: AccessibilityEvent): Boolean =
        delegate.dispatchPopulateAccessibilityEvent(event)

    override fun onCreatePanelView(featureId: Int): View? =
        delegate.onCreatePanelView(featureId)

    override fun onCreatePanelMenu(featureId: Int, menu: Menu): Boolean =
        delegate.onCreatePanelMenu(featureId, menu)

    override fun onPreparePanel(featureId: Int, view: View?, menu: Menu): Boolean =
        delegate.onPreparePanel(featureId, view, menu)

    override fun onMenuOpened(featureId: Int, menu: Menu): Boolean =
        delegate.onMenuOpened(featureId, menu)

    override fun onMenuItemSelected(featureId: Int, item: MenuItem): Boolean =
        delegate.onMenuItemSelected(featureId, item)

    override fun onWindowAttributesChanged(attrs: WindowManager.LayoutParams) =
        delegate.onWindowAttributesChanged(attrs)

    override fun onContentChanged() =
        delegate.onContentChanged()

    override fun onWindowFocusChanged(hasFocus: Boolean) =
        delegate.onWindowFocusChanged(hasFocus)

    override fun onAttachedToWindow() =
        delegate.onAttachedToWindow()

    override fun onDetachedFromWindow() =
        delegate.onDetachedFromWindow()

    override fun onPanelClosed(featureId: Int, menu: Menu) =
        delegate.onPanelClosed(featureId, menu)

    override fun onSearchRequested(): Boolean =
        delegate.onSearchRequested()

    override fun onSearchRequested(searchEvent: SearchEvent): Boolean =
        delegate.onSearchRequested(searchEvent)

    override fun onWindowStartingActionMode(callback: ActionMode.Callback): ActionMode? =
        delegate.onWindowStartingActionMode(callback)

    override fun onWindowStartingActionMode(callback: ActionMode.Callback, type: Int): ActionMode? =
        delegate.onWindowStartingActionMode(callback, type)

    override fun onActionModeStarted(mode: ActionMode) =
        delegate.onActionModeStarted(mode)

    override fun onActionModeFinished(mode: ActionMode) =
        delegate.onActionModeFinished(mode)

    // -------------------------------------------------------------------
    // Package-private helpers for chain management
    // -------------------------------------------------------------------

    /**
     * Replaces the delegate [Window.Callback] this interceptor forwards to.
     * Used by [HardwareKeyListenerModule] when rebuilding the interceptor
     * chain after a registration change.
     */
    internal fun setDelegate(newDelegate: Window.Callback) {
        delegate = newDelegate
    }

    /**
     * Returns the current delegate so the module can traverse the chain
     * during removal.
     */
    internal fun getDelegate(): Window.Callback = delegate
}
