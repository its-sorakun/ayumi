/**
 * StepWorkerHelper — WorkManager scheduler for midnight day-rollover snapshots and periodic
 * hardware step checkpoints.
 */
package com.ayumi.health

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.Calendar
import java.util.concurrent.TimeUnit

object StepWorkerHelper {
    private const val MIDNIGHT_WORK_NAME = "MidnightStepWorker"
    private const val CHECKPOINT_WORK_NAME = "StepCheckpointWorker"
    private const val CHECKPOINT_INTERVAL_HOURS = 2L

    fun scheduleStepWorkers(context: Context) {
        scheduleNextMidnightWorker(context)
        scheduleStepCheckpointWorker(context)
    }

    fun scheduleNextMidnightWorker(context: Context) {
        val calendar = Calendar.getInstance()
        calendar.add(Calendar.DAY_OF_YEAR, 1)
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 1) // 1 minute past midnight
        calendar.set(Calendar.SECOND, 0)

        val delayMs = maxOf(0L, calendar.timeInMillis - System.currentTimeMillis())

        val workRequest = OneTimeWorkRequestBuilder<MidnightStepWorker>()
            .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            MIDNIGHT_WORK_NAME,
            ExistingWorkPolicy.REPLACE,
            workRequest,
        )
    }

    fun scheduleStepCheckpointWorker(context: Context) {
        val periodicRequest = PeriodicWorkRequestBuilder<StepCheckpointWorker>(
            CHECKPOINT_INTERVAL_HOURS,
            TimeUnit.HOURS,
        ).build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            CHECKPOINT_WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            periodicRequest,
        )
    }
}
