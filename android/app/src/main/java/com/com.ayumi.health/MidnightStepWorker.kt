package com.ayumi.health

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.Calendar
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class MidnightStepWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : Worker(context, workerParams) {

    override fun doWork(): Result {
        val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
            ?: return Result.success()

        var currentSteps = -1L
        val latch = CountDownLatch(1)

        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                if (event.sensor.type == Sensor.TYPE_STEP_COUNTER) {
                    currentSteps = event.values[0].toLong()
                    latch.countDown()
                }
            }
            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }

        // Register listener to get the current value
        sensorManager.registerListener(listener, stepSensor, SensorManager.SENSOR_DELAY_FASTEST)
        
        // Wait up to 5 seconds for a sensor reading
        latch.await(5, TimeUnit.SECONDS)
        sensorManager.unregisterListener(listener)

        if (currentSteps >= 0L) {
            val prefs = context.getSharedPreferences("ayumi_step_prefs", Context.MODE_PRIVATE)
            
            val prevBaseline = prefs.getLong("midnightBaseline", -1L)
            val prevBaselineDate = prefs.getLong("baselineDate", -1L)
            
            val cal = Calendar.getInstance()
            cal.set(Calendar.HOUR_OF_DAY, 0)
            cal.set(Calendar.MINUTE, 0)
            cal.set(Calendar.SECOND, 0)
            cal.set(Calendar.MILLISECOND, 0)
            val todayMidnight = cal.timeInMillis
            
            if (prevBaseline >= 0L && prevBaselineDate > 0L && prevBaselineDate != todayMidnight) {
                var stepsTaken = currentSteps - prevBaseline
                if (stepsTaken < 0) {
                    // device rebooted, step counter reset
                    stepsTaken = currentSteps
                }
                
                // Read existing history
                val historyStr = prefs.getString("stepHistory", "[]")
                try {
                    val jsonArray = org.json.JSONArray(historyStr)
                    val newObj = org.json.JSONObject()
                    
                    val df = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
                    val dateStr = df.format(java.util.Date(prevBaselineDate))
                    
                    newObj.put("date", dateStr)
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
            
            prefs.edit()
                .putLong("midnightBaseline", currentSteps)
                .putLong("baselineDate", todayMidnight)
                .apply()
        }

        // Schedule next midnight worker
        StepWorkerHelper.scheduleNextMidnightWorker(context)
        
        return Result.success()
    }
}
