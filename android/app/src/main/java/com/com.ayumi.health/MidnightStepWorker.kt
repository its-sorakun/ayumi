/**
 * MidnightStepWorker — scheduled shortly after local midnight to finalize the ending day's
 * step total into 30-day history and anchor the next day's hardware baseline via
 * StepPersistenceManager.
 */
package com.ayumi.health

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

class MidnightStepWorker(
    private val context: Context,
    workerParams: WorkerParameters,
) : Worker(context, workerParams) {

    companion object {
        private const val MIDNIGHT_SENSOR_TIMEOUT_MS = 5000L
    }

    override fun doWork(): Result {
        if (StepPersistenceManager.isDeviceUnlocked(context) &&
            StepPersistenceManager.hasInitializedBaseline(context)
        ) {
            val currentSteps =
                StepPersistenceManager.readStepSensorOnce(context, MIDNIGHT_SENSOR_TIMEOUT_MS)
            if (currentSteps != null) {
                StepPersistenceManager.recordSensorSample(context, currentSteps, flushSync = true)
            } else {
                // Roll over stationary overnight progress even if sensor FIFO didn't emit at midnight.
                StepPersistenceManager.resolveTodaySteps(context, null)
            }
        }

        StepWorkerHelper.scheduleNextMidnightWorker(context)
        return Result.success()
    }
}
