package com.ayumi.health

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
              // StepCounterModule: reads Android's hardware TYPE_STEP_COUNTER sensor
              // for use when Health Connect is unavailable (de-Googled/custom ROM devices)
              add(StepCounterPackage())
            },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
