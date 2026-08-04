package com.ayumi.health

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val prefs = context.getSharedPreferences("ayumi_step_prefs", Context.MODE_PRIVATE)
            prefs.edit().putLong("midnightBaseline", 0L).apply()
            prefs.edit().putLong("lastKnownTotalSteps", 0L).apply()
            
            StepWorkerHelper.scheduleNextMidnightWorker(context)
        }
    }
}
