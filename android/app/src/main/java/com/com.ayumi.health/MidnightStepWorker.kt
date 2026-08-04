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
            val cal = Calendar.getInstance()
            cal.set(Calendar.HOUR_OF_DAY, 0)
            cal.set(Calendar.MINUTE, 0)
            cal.set(Calendar.SECOND, 0)
            cal.set(Calendar.MILLISECOND, 0)
            
            prefs.edit()
                .putLong("midnightBaseline", currentSteps)
                .putLong("baselineDate", cal.timeInMillis)
                .apply()
        }

        // Schedule next midnight worker
        StepWorkerHelper.scheduleNextMidnightWorker(context)
        
        return Result.success()
    }
}
