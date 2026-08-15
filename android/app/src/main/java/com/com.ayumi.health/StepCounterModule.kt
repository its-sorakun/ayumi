package com.ayumi.health

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Calendar

/**
 * StepCounterModule — a React Native native module that reads from Android's
 * hardware TYPE_STEP_COUNTER sensor via SensorManager.
 *
 * The hardware step counter is an always-on, ultra-low-power sensor
 * that counts steps since the last device reboot. We track a daily baseline
 * (steps at midnight) to report today's step count.
 *
 * Unlike Health Connect, this requires no user permissions and works on
 * any Android device with the TYPE_STEP_COUNTER sensor (most phones since Android 4.4).
 *
 * F-Droid compatible: uses only Android framework APIs, no external SDKs.
 */
class StepCounterModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), SensorEventListener {

    companion object {
        const val MODULE_NAME = "StepCounterModule"
        const val STEP_EVENT = "onStepCounterUpdate"
    }

    private val sensorManager: SensorManager by lazy {
        reactContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    }

    private val stepCounterSensor: Sensor? by lazy {
        sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    }

    private val prefs by lazy {
        reactContext.getSharedPreferences("ayumi_step_prefs", Context.MODE_PRIVATE)
    }

    /** Total cumulative steps since last reboot at the start of today (midnight baseline) */
    private var midnightBaseline: Long
        get() = prefs.getLong("midnightBaseline", -1L)
        set(value) {
            prefs.edit().putLong("midnightBaseline", value).apply()
        }

    /** The total cumulative steps since last device reboot (raw sensor value) */
    @Volatile private var totalStepsSinceReboot: Long = -1L

    /** Timestamp (epoch ms) when the midnight baseline was last set */
    private var baselineDate: Long
        get() = prefs.getLong("baselineDate", -1L)
        set(value) {
            prefs.edit().putLong("baselineDate", value).apply()
        }

    /** The last recorded sensor step count, persisted across app restarts */
    private var lastKnownTotalSteps: Long
        get() = prefs.getLong("lastKnownTotalSteps", -1L)
        set(value) {
            prefs.edit().putLong("lastKnownTotalSteps", value).apply()
        }

    /** 
     * Fallback to lastKnownTotalSteps if the sensor hasn't fired yet since reboot/restart 
     */
    private val currentTotalSteps: Long
        get() = if (totalStepsSinceReboot >= 0L) totalStepsSinceReboot else lastKnownTotalSteps

    override fun getName(): String = MODULE_NAME

    /**
     * Check if the TYPE_STEP_COUNTER sensor is available on this device.
     * Returns a WritableMap: { available: Boolean, hasDailyBaseline: Boolean }
     */
    @ReactMethod
    fun isAvailable(promise: Promise) {
        val map = Arguments.createMap()
        map.putBoolean("available", stepCounterSensor != null)
        map.putBoolean("hasDailyBaseline", midnightBaseline >= 0L)
        promise.resolve(map)
    }

    /**
     * Start listening to the step counter sensor.
     * Uses SENSOR_DELAY_NORMAL for battery efficiency — we don't need realtime updates.
     * The sensor fires ~1-2 times/second when walking.
     */
    @ReactMethod
    fun startListening(promise: Promise) {
        val sensor = stepCounterSensor
        if (sensor == null) {
            promise.reject("NO_SENSOR", "TYPE_STEP_COUNTER sensor not available on this device")
            return
        }

        // SENSOR_DELAY_NORMAL (200ms) — no need for faster polling for a step counter
        val registered = sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL)
        if (!registered) {
            promise.reject("SENSOR_ERROR", "Failed to register step counter listener")
            return
        }

        resetBaselineIfNewDay()
        promise.resolve(true)
    }

    /**
     * Stop listening to the step counter sensor.
     * Always call this when the component unmounts to prevent battery drain.
     */
    @ReactMethod
    fun stopListening() {
        sensorManager.unregisterListener(this)
    }

    /**
     * Get the current step count for today.
     * Returns a WritableMap: { stepsToday: Int, available: Boolean }
     */
    @ReactMethod
    fun getTodaySteps(promise: Promise) {
        val map = Arguments.createMap()

        // Eagerly check if the day has rolled over before returning steps
        resetBaselineIfNewDay()

        if (stepCounterSensor == null || currentTotalSteps < 0L) {
            map.putBoolean("available", false)
            map.putInt("stepsToday", 0)
            promise.resolve(map)
            return
        }

        val stepsToday = calculateTodaySteps()
        map.putBoolean("available", true)
        map.putInt("stepsToday", stepsToday.toInt())
        promise.resolve(map)
    }

    /**
     * Get the last 30 days of historical steps.
     * Returns a JSON string of array [{date: "YYYY-MM-DD", steps: number}]
     */
    @ReactMethod
    fun getHistoricalSteps(promise: Promise) {
        val historyStr = prefs.getString("stepHistory", "[]")
        promise.resolve(historyStr)
    }

    // ─── SensorEventListener ────────────────────────────────────────────────

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type != Sensor.TYPE_STEP_COUNTER) return

        totalStepsSinceReboot = event.values[0].toLong()
        lastKnownTotalSteps = totalStepsSinceReboot
        
        resetBaselineIfNewDay()

        val stepsToday = calculateTodaySteps()

        // Emit to JS only if we have a valid step count
        if (stepsToday >= 0 && reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(STEP_EVENT, stepsToday.toInt())
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // Not needed for step counter
    }

    // ─── Private helpers ────────────────────────────────────────────────────

    /**
     * If the date has changed since we last set the midnight baseline,
     * reset it to the current total steps (so today's count starts from zero).
     */
    private fun resetBaselineIfNewDay() {
        val todayMidnight = getMidnightEpochMs()
        val currentSteps = currentTotalSteps
        val prevDate = baselineDate

        if (prevDate != todayMidnight && prevDate > 0L && currentSteps >= 0L) {
            val prevBaseline = midnightBaseline
            var stepsTaken = currentSteps - prevBaseline
            if (stepsTaken < 0) {
                stepsTaken = currentSteps
            }
            
            // Push to history
            val historyStr = prefs.getString("stepHistory", "[]")
            try {
                val jsonArray = org.json.JSONArray(historyStr)
                val newObj = org.json.JSONObject()
                val df = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
                newObj.put("date", df.format(java.util.Date(prevDate)))
                newObj.put("steps", stepsTaken)
                jsonArray.put(newObj)
                
                // keep only last 30 days
                val trimmedArray = org.json.JSONArray()
                val startIndex = Math.max(0, jsonArray.length() - 30)
                for (i in startIndex until jsonArray.length()) {
                    trimmedArray.put(jsonArray.get(i))
                }
                prefs.edit().putString("stepHistory", trimmedArray.toString()).apply()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        if (prevDate != todayMidnight && currentSteps >= 0L) {
            midnightBaseline = currentSteps
            baselineDate = todayMidnight
        }
    }

    /**
     * Returns today's step count by subtracting the midnight baseline
     * from the current cumulative total.
     */
    private fun calculateTodaySteps(): Long {
        val currentSteps = currentTotalSteps
        return if (midnightBaseline >= 0L && currentSteps >= midnightBaseline) {
            currentSteps - midnightBaseline
        } else {
            0L
        }
    }

    /** Returns epoch milliseconds for today at 00:00:00.000 */
    private fun getMidnightEpochMs(): Long {
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }
}
