package com.jhotadhari.reactnative.hardwarekeyevent

import android.app.Application
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import java.util.HashMap

class HardwareKeyEventPackage : BaseReactPackage() {

    companion object {
        @Volatile
        private var lifecycleObserverRegistered = false

        /** Dedicated lock for the double-checked-locking guard above. */
        private val observerLock = Any()
    }

    override fun getModule(
        name: String,
        reactContext: ReactApplicationContext
    ): NativeModule? {
        if (name != HardwareKeyListenerModule.NAME) {
            return null
        }

        val module = HardwareKeyListenerModule(reactContext)

        // Register the lifecycle observer exactly once per process so that
        // Window.Callback interceptors are installed automatically on every
        // Activity without requiring a custom base class.
        if (!lifecycleObserverRegistered) {
            synchronized(observerLock) {
                if (!lifecycleObserverRegistered) {
                    lifecycleObserverRegistered = true
                    val app = reactContext.applicationContext as? Application
                    app?.registerActivityLifecycleCallbacks(
                        HardwareKeyEventLifecycleObserver(module)
                    )
                }
            }
        }

        return module
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
            val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
            moduleInfos[HardwareKeyListenerModule.NAME] = ReactModuleInfo(
                HardwareKeyListenerModule.NAME,
                HardwareKeyListenerModule.NAME,
                false,  // canOverrideExistingModule
                false,  // needsEagerInit
                false,  // isCxxModule
                true    // isTurboModule
            )
            moduleInfos
        }
    }
}
