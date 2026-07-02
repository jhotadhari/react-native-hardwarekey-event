package com.jhotadhari.reactnative.hardwarekeyevent

import android.app.Activity
import android.app.Application
import android.os.Bundle

/**
 * Registers itself as an [Application.ActivityLifecycleCallbacks] so that
 * the hardware-key interceptor chain is automatically installed on newly
 * created Activities and torn down when the owning Activity is destroyed.
 *
 * This means consumers do **not** need to extend a special Activity base
 * class — the interceptor is injected purely via the [Window.Callback]
 * interception mechanism.
 *
 * ### Lifecycle contract
 *
 * | Callback              | Action                                                      |
 * |-----------------------|-------------------------------------------------------------|
 * | [onActivityCreated]   | Install the interceptor chain if registrations are pending. |
 * | [onActivityDestroyed] | Detach the chain (preserving registrations for the next     |
 * |                       | Activity).                                                  |
 *
 * All other lifecycle callbacks are no-ops.
 *
 * This class is **internal** — it is instantiated and registered by
 * [HardwareKeyEventPackage] and should not be used directly by consumers.
 */
internal class HardwareKeyEventLifecycleObserver(
    private val module: HardwareKeyListenerModule
) : Application.ActivityLifecycleCallbacks {

    /**
     * Called when any Activity enters the `onCreate` state.
     *
     * If [module] holds pending registrations and either no Activity is
     * currently active or the active Activity differs, the interceptor
     * chain is installed on this Activity's [Window].
     */
    override fun onActivityCreated(
        activity: Activity,
        savedInstanceState: Bundle?
    ) {
        module.onActivityCreated(activity)
    }

    /**
     * Called when any Activity is being destroyed.
     *
     * If the destroyed Activity is the one currently holding the
     * interceptor chain the chain is detached and the original
     * [Window.Callback] is restored.  The registrations themselves are
     * preserved so they can be reinstalled on the next Activity.
     */
    override fun onActivityDestroyed(activity: Activity) {
        module.onActivityDestroyed(activity)
    }

    // -------------------------------------------------------------------
    // Unused lifecycle callbacks
    // -------------------------------------------------------------------

    override fun onActivityStarted(activity: Activity) {}

    override fun onActivityResumed(activity: Activity) {
        module.onActivityResumed(activity)
    }

    override fun onActivityPaused(activity: Activity) {}

    override fun onActivityStopped(activity: Activity) {}

    override fun onActivitySaveInstanceState(
        activity: Activity,
        outState: Bundle
    ) {
    }
}
