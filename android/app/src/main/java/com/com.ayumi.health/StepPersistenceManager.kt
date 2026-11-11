/**
 * StepPersistenceManager — unified step counter state machine and SharedPreferences storage
 * shared across StepCounterModule, BootReceiver, MidnightStepWorker, and StepCheckpointWorker.
 *
 * Preserves Device Sensor steps, distances, and derived activity totals across device restarts by
 * separating pre-reboot accumulated steps (`bankedTodaySteps`) from the current boot segment's
 * hardware counter (`currentSensorSteps - midnightBaseline`). Reboots are detected deterministically
 * via Android `BOOT_COMPLETED`, `Settings.Global.BOOT_COUNT`, and monotonic hardware counter drops,
 * while `ACTION_SHUTDOWN` / periodic checkpoints capture recent background steps prior to restart.
 */
package com.ayumi.health

import android.content.Context
import android.content.SharedPreferences
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.HandlerThread
import android.os.UserManager
import android.provider.Settings
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

data class DailyStepRecord(
    val date: String,
    val steps: Long,
)

data class StepState(
    val baselineDate: Long = -1L,
    val midnightBaseline: Long = -1L,
    val lastKnownTotalSteps: Long = -1L,
    val bankedTodaySteps: Long = 0L,
    val lastBootCount: Int = -1,
    val history: List<DailyStepRecord> = emptyList(),
)

/**
 * Pure, framework-free state transitions for Android `TYPE_STEP_COUNTER` daily tracking across
 * device restarts, multi-reboot days, skipped boot broadcasts, and midnight rollovers.
 */
object StepCounterStateMachine {

    private const val MAX_HISTORY_DAYS = 30

    /** Steps recorded in the currently active continuous boot segment. */
    fun activeSegmentSteps(state: StepState, rawOverride: Long? = null): Long {
        if (state.midnightBaseline < 0L) {
            return 0L
        }
        val raw = rawOverride ?: state.lastKnownTotalSteps
        if (raw < 0L) {
            return 0L
        }
        return maxOf(0L, raw - state.midnightBaseline)
    }

    /** Total accumulated steps for the active day (prior boot segments + current boot segment). */
    fun computeTodaySteps(
        state: StepState,
        todayMidnight: Long,
        rawOverride: Long? = null,
    ): Long {
        if (state.baselineDate <= 0L || state.baselineDate != todayMidnight) {
            return 0L
        }
        return maxOf(0L, state.bankedTodaySteps) + activeSegmentSteps(state, rawOverride)
    }

    /**
     * Handles a confirmed device reboot by banking completed steps from the pre-reboot segment into
     * `bankedTodaySteps` (same day) or `history` (across midnight) and resetting the current-boot
     * hardware offset cleanly to `0L`.
     */
    fun applyBootTransition(
        state: StepState,
        todayMidnight: Long,
        currentBootCount: Int,
        formatDateFn: (Long) -> String,
    ): StepState {
        val bootCountToStore = if (currentBootCount >= 0) currentBootCount else state.lastBootCount

        // Do not synthesize a daily baseline for devices that have never activated Device Sensor.
        if (state.baselineDate <= 0L) {
            return state.copy(lastBootCount = bootCountToStore)
        }

        val totalBeforeReboot =
            maxOf(0L, state.bankedTodaySteps) + activeSegmentSteps(state)

        return if (state.baselineDate == todayMidnight) {
            // Preserve pre-reboot steps in bankedTodaySteps; post-reboot hardware counter starts at 0.
            state.copy(
                baselineDate = todayMidnight,
                midnightBaseline = 0L,
                lastKnownTotalSteps = 0L,
                bankedTodaySteps = totalBeforeReboot,
                lastBootCount = bootCountToStore,
            )
        } else {
            // Restarted after crossing midnight: flush finalized prior-day steps to history first.
            val prevDateKey = formatDateFn(state.baselineDate)
            val updatedHistory = upsertHistoryEntry(state.history, prevDateKey, totalBeforeReboot)
            state.copy(
                baselineDate = todayMidnight,
                midnightBaseline = 0L,
                lastKnownTotalSteps = 0L,
                bankedTodaySteps = 0L,
                lastBootCount = bootCountToStore,
                history = updatedHistory,
            )
        }
    }

    /**
     * Reconciles a boot change when `ACTION_BOOT_COMPLETED` was delayed/blocked by OEM power
     * policies, and rolls over prior-day data when a stationary day change occurs without reboot.
     */
    fun syncWithoutFreshSample(
        state: StepState,
        todayMidnight: Long,
        currentBootCount: Int,
        formatDateFn: (Long) -> String,
    ): StepState {
        val bootCounterChanged =
            state.lastBootCount >= 0 && currentBootCount >= 0 && currentBootCount != state.lastBootCount

        var working = if (bootCounterChanged) {
            applyBootTransition(state, todayMidnight, currentBootCount, formatDateFn)
        } else {
            state
        }

        if (working.lastBootCount < 0 && currentBootCount >= 0) {
            working = working.copy(lastBootCount = currentBootCount)
        }

        if (working.baselineDate > 0L && working.baselineDate != todayMidnight) {
            val anchorRaw = maxOf(0L, working.lastKnownTotalSteps)
            val priorDayTotal =
                maxOf(0L, working.bankedTodaySteps) + activeSegmentSteps(working, anchorRaw)
            val prevDateKey = formatDateFn(working.baselineDate)
            val updatedHistory = upsertHistoryEntry(working.history, prevDateKey, priorDayTotal)
            working = working.copy(
                baselineDate = todayMidnight,
                midnightBaseline = if (working.lastKnownTotalSteps >= 0L) working.lastKnownTotalSteps else -1L,
                bankedTodaySteps = 0L,
                history = updatedHistory,
            )
        }

        return working
    }

    /**
     * Applies a newly sampled `TYPE_STEP_COUNTER` cumulative value, checking reboot conditions
     * (`BOOT_COUNT` delta or hardware reset drop) before updating `lastKnownTotalSteps`.
     */
    fun recordSensorReading(
        state: StepState,
        rawSteps: Long,
        todayMidnight: Long,
        currentBootCount: Int,
        formatDateFn: (Long) -> String,
    ): StepState {
        val cleanRaw = maxOf(0L, rawSteps)

        val bootCounterChanged =
            state.lastBootCount >= 0 && currentBootCount >= 0 && currentBootCount != state.lastBootCount
        val hardwareCounterDropped =
            (state.lastKnownTotalSteps >= 0L && cleanRaw < state.lastKnownTotalSteps) ||
                (state.midnightBaseline >= 0L && cleanRaw < state.midnightBaseline)

        var working = if (bootCounterChanged || hardwareCounterDropped) {
            applyBootTransition(state, todayMidnight, currentBootCount, formatDateFn)
        } else {
            state
        }

        if (working.lastBootCount < 0 && currentBootCount >= 0) {
            working = working.copy(lastBootCount = currentBootCount)
        }

        if (working.baselineDate <= 0L) {
            return working.copy(
                baselineDate = todayMidnight,
                midnightBaseline = cleanRaw,
                lastKnownTotalSteps = cleanRaw,
                bankedTodaySteps = 0L,
            )
        }

        if (working.baselineDate != todayMidnight) {
            val priorDayTotal =
                maxOf(0L, working.bankedTodaySteps) + activeSegmentSteps(working, cleanRaw)
            val prevDateKey = formatDateFn(working.baselineDate)
            val updatedHistory = upsertHistoryEntry(working.history, prevDateKey, priorDayTotal)
            return working.copy(
                baselineDate = todayMidnight,
                midnightBaseline = cleanRaw,
                lastKnownTotalSteps = cleanRaw,
                bankedTodaySteps = 0L,
                history = updatedHistory,
            )
        }

        val resolvedBaseline =
            if (working.midnightBaseline >= 0L) working.midnightBaseline else cleanRaw
        val resolvedLastKnown =
            if (working.lastKnownTotalSteps >= 0L) {
                maxOf(working.lastKnownTotalSteps, cleanRaw)
            } else {
                cleanRaw
            }

        return working.copy(
            midnightBaseline = resolvedBaseline,
            lastKnownTotalSteps = resolvedLastKnown,
        )
    }

    fun upsertHistoryEntry(
        history: List<DailyStepRecord>,
        dateStr: String,
        steps: Long,
    ): List<DailyStepRecord> {
        val sanitizedSteps = maxOf(0L, steps)
        val mutable = history.toMutableList()
        val existingIdx = mutable.indexOfFirst { it.date == dateStr }
        if (existingIdx >= 0) {
            val prev = mutable[existingIdx]
            mutable[existingIdx] = prev.copy(steps = maxOf(prev.steps, sanitizedSteps))
        } else {
            mutable.add(DailyStepRecord(dateStr, sanitizedSteps))
        }
        return if (mutable.size > MAX_HISTORY_DAYS) {
            mutable.subList(mutable.size - MAX_HISTORY_DAYS, mutable.size).toList()
        } else {
            mutable.toList()
        }
    }
}

object StepPersistenceManager {

    private const val PREFS_NAME = "ayumi_step_prefs"
    private const val KEY_MIDNIGHT_BASELINE = "midnightBaseline"
    private const val KEY_BASELINE_DATE = "baselineDate"
    private const val KEY_LAST_KNOWN_TOTAL = "lastKnownTotalSteps"
    private const val KEY_BANKED_TODAY = "bankedTodaySteps"
    private const val KEY_LAST_BOOT_COUNT = "lastBootCount"
    private const val KEY_STEP_HISTORY = "stepHistory"

    private val lock = Any()

    fun isDeviceUnlocked(context: Context): Boolean {
        val userManager = context.getSystemService(Context.USER_SERVICE) as? UserManager
        return userManager?.isUserUnlocked ?: true
    }

    fun hasInitializedBaseline(context: Context): Boolean {
        if (!isDeviceUnlocked(context)) {
            return false
        }
        synchronized(lock) {
            val prefs = getPrefs(context)
            return prefs.getLong(KEY_BASELINE_DATE, -1L) > 0L
        }
    }

    fun hasDailyBaseline(context: Context): Boolean {
        if (!isDeviceUnlocked(context)) {
            return false
        }
        synchronized(lock) {
            val prefs = getPrefs(context)
            return prefs.getLong(KEY_BASELINE_DATE, -1L) > 0L &&
                prefs.getLong(KEY_MIDNIGHT_BASELINE, -1L) >= 0L
        }
    }

    /**
     * Handles `ACTION_BOOT_COMPLETED`. Uses `BOOT_COUNT` idempotency so a late system boot
     * broadcast cannot overwrite post-boot steps if the app already opened and synced this boot.
     */
    fun onBootCompleted(context: Context) {
        if (!isDeviceUnlocked(context)) {
            return
        }
        val currentBootCount = readBootCount(context)
        val todayMidnight = getMidnightEpochMs()
        synchronized(lock) {
            val prefs = getPrefs(context)
            val currentState = loadStateLocked(prefs)
            if (currentState.lastBootCount >= 0 &&
                currentBootCount >= 0 &&
                currentState.lastBootCount == currentBootCount
            ) {
                return
            }
            val nextState = StepCounterStateMachine.applyBootTransition(
                state = currentState,
                todayMidnight = todayMidnight,
                currentBootCount = currentBootCount,
                formatDateFn = ::formatDateKey,
            )
            saveStateLocked(prefs, nextState, commitSync = true)
        }
    }

    /**
     * Persists a newly sampled cumulative `TYPE_STEP_COUNTER` reading and returns today's steps.
     * Callers on shutdown paths pass `flushSync = true` so SharedPreferences is flushed to disk.
     */
    fun recordSensorSample(
        context: Context,
        rawSteps: Long,
        flushSync: Boolean = false,
    ): Long {
        if (!isDeviceUnlocked(context)) {
            return 0L
        }
        val currentBootCount = readBootCount(context)
        val todayMidnight = getMidnightEpochMs()
        synchronized(lock) {
            val prefs = getPrefs(context)
            val currentState = loadStateLocked(prefs)
            val nextState = StepCounterStateMachine.recordSensorReading(
                state = currentState,
                rawSteps = rawSteps,
                todayMidnight = todayMidnight,
                currentBootCount = currentBootCount,
                formatDateFn = ::formatDateKey,
            )
            val stateChanged = nextState != currentState
            if (stateChanged) {
                // Force synchronous disk commit on day boundaries or detected boot changes.
                val needsSync = flushSync ||
                    nextState.bankedTodaySteps != currentState.bankedTodaySteps ||
                    nextState.baselineDate != currentState.baselineDate ||
                    nextState.lastBootCount != currentState.lastBootCount
                saveStateLocked(prefs, nextState, commitSync = needsSync)
            }
            return StepCounterStateMachine.computeTodaySteps(nextState, todayMidnight)
        }
    }

    /**
     * Resolves today's availability & step count when reading `getTodaySteps()`.
     * Even if `freshRawSteps` is `null` (sensor hasn't emitted yet right after reboot), a
     * confirmed reboot (`BOOT_COUNT` or persisted baseline/bank) still surfaces preserved steps.
     */
    fun resolveTodaySteps(
        context: Context,
        freshRawSteps: Long?,
    ): Pair<Boolean, Long> {
        if (!isDeviceUnlocked(context)) {
            return Pair(false, 0L)
        }
        if (freshRawSteps != null && freshRawSteps >= 0L) {
            val stepsToday = recordSensorSample(context, freshRawSteps, flushSync = false)
            return Pair(true, stepsToday)
        }

        val currentBootCount = readBootCount(context)
        val todayMidnight = getMidnightEpochMs()
        synchronized(lock) {
            val prefs = getPrefs(context)
            val currentState = loadStateLocked(prefs)
            val syncedState = StepCounterStateMachine.syncWithoutFreshSample(
                state = currentState,
                todayMidnight = todayMidnight,
                currentBootCount = currentBootCount,
                formatDateFn = ::formatDateKey,
            )
            if (syncedState != currentState) {
                saveStateLocked(prefs, syncedState, commitSync = true)
            }
            val hasKnownOrBanked = syncedState.lastKnownTotalSteps >= 0L ||
                (syncedState.baselineDate == todayMidnight && syncedState.bankedTodaySteps > 0L)
            if (!hasKnownOrBanked) {
                return Pair(false, 0L)
            }
            val stepsToday = StepCounterStateMachine.computeTodaySteps(syncedState, todayMidnight)
            return Pair(true, stepsToday)
        }
    }

    fun getHistoricalStepsJson(context: Context): String {
        if (!isDeviceUnlocked(context)) {
            return "[]"
        }
        synchronized(lock) {
            return getPrefs(context).getString(KEY_STEP_HISTORY, "[]") ?: "[]"
        }
    }

    /**
     * Registers a one-shot `TYPE_STEP_COUNTER` listener on an isolated `HandlerThread` so calls
     * never deadlock the main thread (safe from MainLooper receivers, WorkManager, and RN threads).
     */
    fun readStepSensorOnce(context: Context, timeoutMs: Long): Long? {
        val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
            ?: return null
        val stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
            ?: return null

        var sampledSteps = -1L
        val latch = CountDownLatch(1)
        val handlerThread = HandlerThread("ayumi-step-read").apply { start() }
        val handler = Handler(handlerThread.looper)

        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                if (event.sensor.type == Sensor.TYPE_STEP_COUNTER) {
                    sampledSteps = event.values[0].toLong()
                    latch.countDown()
                }
            }

            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }

        return try {
            val registered = sensorManager.registerListener(
                listener,
                stepSensor,
                SensorManager.SENSOR_DELAY_FASTEST,
                handler,
            )
            if (registered) {
                latch.await(timeoutMs, TimeUnit.MILLISECONDS)
            }
            if (sampledSteps >= 0L) sampledSteps else null
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
            if (sampledSteps >= 0L) sampledSteps else null
        } finally {
            sensorManager.unregisterListener(listener)
            handlerThread.quitSafely()
        }
    }

    fun getMidnightEpochMs(): Long {
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }

    private fun readBootCount(context: Context): Int {
        return try {
            Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, -1)
        } catch (_: SecurityException) {
            -1
        }
    }

    private fun formatDateKey(epochMs: Long): String {
        val df = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        return df.format(Date(epochMs))
    }

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    private fun loadStateLocked(prefs: SharedPreferences): StepState {
        return StepState(
            baselineDate = prefs.getLong(KEY_BASELINE_DATE, -1L),
            midnightBaseline = prefs.getLong(KEY_MIDNIGHT_BASELINE, -1L),
            lastKnownTotalSteps = prefs.getLong(KEY_LAST_KNOWN_TOTAL, -1L),
            bankedTodaySteps = prefs.getLong(KEY_BANKED_TODAY, 0L),
            lastBootCount = prefs.getInt(KEY_LAST_BOOT_COUNT, -1),
            history = parseHistoryJson(prefs.getString(KEY_STEP_HISTORY, "[]")),
        )
    }

    private fun saveStateLocked(
        prefs: SharedPreferences,
        state: StepState,
        commitSync: Boolean,
    ) {
        val editor = prefs.edit()
            .putLong(KEY_BASELINE_DATE, state.baselineDate)
            .putLong(KEY_MIDNIGHT_BASELINE, state.midnightBaseline)
            .putLong(KEY_LAST_KNOWN_TOTAL, state.lastKnownTotalSteps)
            .putLong(KEY_BANKED_TODAY, state.bankedTodaySteps)
            .putInt(KEY_LAST_BOOT_COUNT, state.lastBootCount)
            .putString(KEY_STEP_HISTORY, serializeHistoryJson(state.history))
        if (commitSync) {
            editor.commit()
        } else {
            editor.apply()
        }
    }

    private fun parseHistoryJson(rawJson: String?): List<DailyStepRecord> {
        if (rawJson.isNullOrBlank()) {
            return emptyList()
        }
        val array = try {
            JSONArray(rawJson)
        } catch (e: org.json.JSONException) {
            e.printStackTrace()
            return emptyList()
        }
        val parsed = ArrayList<DailyStepRecord>(array.length())
        for (i in 0 until array.length()) {
            val obj = array.optJSONObject(i) ?: continue
            val date = obj.optString("date", "")
            if (date.isEmpty()) continue
            parsed.add(DailyStepRecord(date = date, steps = maxOf(0L, obj.optLong("steps", 0L))))
        }
        return parsed
    }

    private fun serializeHistoryJson(history: List<DailyStepRecord>): String {
        val array = JSONArray()
        for (entry in history) {
            val obj = JSONObject()
            obj.put("date", entry.date)
            obj.put("steps", entry.steps)
            array.put(obj)
        }
        return array.toString()
    }
}
