/**
 * BootReceiver — system broadcast receiver that preserves Device Sensor step totals across
 * device restarts and shutdowns.
 *
 * On `ACTION_BOOT_COMPLETED`, banks pre-reboot steps safely and reschedules background workers.
 * On `ACTION_SHUTDOWN` / `QUICKBOOT_POWEROFF`, captures a quick asynchronous hardware step
 * snapshot and flushes it synchronously to SharedPreferences before power-off.
 */
package com.ayumi.health

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.util.concurrent.Executors

class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val ACTION_QUICKBOOT_POWEROFF = "android.intent.action.QUICKBOOT_POWEROFF"
        private const val SHUTDOWN_SENSOR_TIMEOUT_MS = 300L
        private val shutdownExecutor = Executors.newSingleThreadExecutor()
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val appContext = context.applicationContext

        when (action) {
            Intent.ACTION_BOOT_COMPLETED -> {
                if (StepPersistenceManager.isDeviceUnlocked(appContext)) {
                    StepPersistenceManager.onBootCompleted(appContext)
                }
                StepWorkerHelper.scheduleStepWorkers(appContext)
            }

            Intent.ACTION_SHUTDOWN, ACTION_QUICKBOOT_POWEROFF -> {
                if (!StepPersistenceManager.isDeviceUnlocked(appContext) ||
                    !StepPersistenceManager.hasInitializedBaseline(appContext)
                ) {
                    return
                }

                // Wait briefly off the main thread to capture latest hardware step FIFO before reboot.
                val pendingResult = goAsync()
                shutdownExecutor.execute {
                    try {
                        val latestRaw = StepPersistenceManager.readStepSensorOnce(
                            appContext,
                            SHUTDOWN_SENSOR_TIMEOUT_MS,
                        )
                        if (latestRaw != null) {
                            StepPersistenceManager.recordSensorSample(
                                appContext,
                                latestRaw,
                                flushSync = true,
                            )
                        }
                    } finally {
                        pendingResult.finish()
                    }
                }
            }
        }
    }
}
