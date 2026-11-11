/**
 * StepCounterModule — React Native native module exposing Android's hardware `TYPE_STEP_COUNTER`
 * sensor via SensorManager and delegating all reboot banking, day rollovers, and 30-day history
 * persistence to StepPersistenceManager.
 */
package com.ayumi.health

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class StepCounterModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), SensorEventListener {

    companion object {
        const val MODULE_NAME = "StepCounterModule"
        const val STEP_EVENT = "onStepCounterUpdate"
        private const val FRESH_READ_TIMEOUT_MS = 400L
    }

    private val sensorManager: SensorManager by lazy {
        reactContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    }

    private val stepCounterSensor: Sensor? by lazy {
        sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    }

    @Volatile
    private var totalStepsSinceReboot: Long = -1L

    override fun getName(): String = MODULE_NAME

    @ReactMethod
    fun isAvailable(promise: Promise) {
        val map = Arguments.createMap()
        map.putBoolean("available", stepCounterSensor != null)
        map.putBoolean("hasDailyBaseline", StepPersistenceManager.hasDailyBaseline(reactContext))
        promise.resolve(map)
    }

    @ReactMethod
    fun startListening(promise: Promise) {
        val sensor = stepCounterSensor
        if (sensor == null) {
            promise.reject("NO_SENSOR", "TYPE_STEP_COUNTER sensor not available on this device")
            return
        }

        val handler = Handler(Looper.getMainLooper())
        val registered =
            sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL, handler)
        if (!registered) {
            promise.reject("SENSOR_ERROR", "Failed to register step counter listener")
            return
        }

        promise.resolve(true)
    }

    @ReactMethod
    fun stopListening() {
        sensorManager.unregisterListener(this)
        // Clear cached runtime reading when detaching so the next resume fetches fresh FIFO steps.
        totalStepsSinceReboot = -1L
    }

    @ReactMethod
    fun getTodaySteps(promise: Promise) {
        val map = Arguments.createMap()

        if (stepCounterSensor == null) {
            map.putBoolean("available", false)
            map.putInt("stepsToday", 0)
            promise.resolve(map)
            return
        }

        val liveOrFresh = if (totalStepsSinceReboot >= 0L) {
            totalStepsSinceReboot
        } else {
            StepPersistenceManager.readStepSensorOnce(reactContext, FRESH_READ_TIMEOUT_MS)?.also {
                totalStepsSinceReboot = it
            }
        }

        val (available, stepsToday) =
            StepPersistenceManager.resolveTodaySteps(reactContext, liveOrFresh)

        map.putBoolean("available", available)
        map.putInt("stepsToday", stepsToday.coerceIn(0L, Int.MAX_VALUE.toLong()).toInt())
        promise.resolve(map)
    }

    @ReactMethod
    fun getHistoricalSteps(promise: Promise) {
        promise.resolve(StepPersistenceManager.getHistoricalStepsJson(reactContext))
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type != Sensor.TYPE_STEP_COUNTER) return

        val rawSteps = event.values[0].toLong()
        totalStepsSinceReboot = rawSteps

        val stepsToday = StepPersistenceManager.recordSensorSample(reactContext, rawSteps)
        if (stepsToday >= 0L && reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(STEP_EVENT, stepsToday.coerceIn(0L, Int.MAX_VALUE.toLong()).toInt())
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // Not needed for hardware step counter.
    }
}
