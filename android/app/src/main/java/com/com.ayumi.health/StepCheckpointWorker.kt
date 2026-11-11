/**
 * StepCheckpointWorker — periodic background WorkManager task that snapshots the hardware
 * `TYPE_STEP_COUNTER` value when Device Sensor tracking is active.
 *
 * Ensures background steps accumulated while the UI is closed are periodically flushed to
 * `StepPersistenceManager` so abrupt power loss or skipped shutdown broadcasts cannot discard an
 * entire day of activity.
 */
package com.ayumi.health

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

class StepCheckpointWorker(
    private val context: Context,
    workerParams: WorkerParameters,
) : Worker(context, workerParams) {

    companion object {
        private const val CHECKPOINT_TIMEOUT_MS = 500L
    }

    override fun doWork(): Result {
        if (!StepPersistenceManager.isDeviceUnlocked(context) ||
            !StepPersistenceManager.hasInitializedBaseline(context)
        ) {
            return Result.success()
        }

        val currentSteps = StepPersistenceManager.readStepSensorOnce(context, CHECKPOINT_TIMEOUT_MS)
        if (currentSteps != null) {
            StepPersistenceManager.recordSensorSample(context, currentSteps, flushSync = true)
        } else {
            StepPersistenceManager.resolveTodaySteps(context, null)
        }

        return Result.success()
    }
}

