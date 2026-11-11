/**
 * StepCounterStateMachineTest — JVM unit tests verifying reboot persistence, multi-reboot banking,
 * OEM-skipped boot broadcast recovery via `BOOT_COUNT`, hardware drop fallback, and midnight
 * history rollover in StepCounterStateMachine.
 */
package com.ayumi.health

import org.junit.Assert.assertEquals
import org.junit.Test
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

class StepCounterStateMachineTest {

    private fun epochDay(year: Int, monthZeroBased: Int, day: Int): Long {
        val cal = Calendar.getInstance()
        cal.set(year, monthZeroBased, day, 0, 0, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }

    private val fmt: (Long) -> String = { ms ->
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(ms))
    }

    @Test
    fun sameDayReboot_preservesPreRebootStepsWhenSensorStartsAtZeroAndAddsNewSteps() {
        val nov11 = epochDay(2026, Calendar.NOVEMBER, 11)
        var state = StepState()

        // Morning start: sensor already at 10,000 since earlier boot (bootCount = 42)
        state = StepCounterStateMachine.recordSensorReading(state, 10_000L, nov11, 42, fmt)
        assertEquals(0L, StepCounterStateMachine.computeTodaySteps(state, nov11))

        // Walk 3,000 steps before restart
        state = StepCounterStateMachine.recordSensorReading(state, 13_000L, nov11, 42, fmt)
        assertEquals(3_000L, StepCounterStateMachine.computeTodaySteps(state, nov11))

        // Device reboots (BOOT_COMPLETED, bootCount increments to 43)
        state = StepCounterStateMachine.applyBootTransition(state, nov11, 43, fmt)
        assertEquals(3_000L, state.bankedTodaySteps)
        assertEquals(0L, state.midnightBaseline)
        assertEquals(0L, state.lastKnownTotalSteps)
        assertEquals(3_000L, StepCounterStateMachine.computeTodaySteps(state, nov11))

        // Stationary app open right after reboot (no new sensor event yet) keeps 3,000 steps
        state = StepCounterStateMachine.syncWithoutFreshSample(state, nov11, 43, fmt)
        assertEquals(3_000L, StepCounterStateMachine.computeTodaySteps(state, nov11))

        // Walk 250 steps after reboot
        state = StepCounterStateMachine.recordSensorReading(state, 250L, nov11, 43, fmt)
        assertEquals(3_250L, StepCounterStateMachine.computeTodaySteps(state, nov11))
    }

    @Test
    fun multipleRebootsSameDay_accumulatesAllSegmentsWithoutLoss() {
        val nov11 = epochDay(2026, Calendar.NOVEMBER, 11)
        var state = StepState()

        state = StepCounterStateMachine.recordSensorReading(state, 5_000L, nov11, 10, fmt)
        state = StepCounterStateMachine.recordSensorReading(state, 7_000L, nov11, 10, fmt) // +2,000

        // Reboot #1
        state = StepCounterStateMachine.applyBootTransition(state, nov11, 11, fmt)
        state = StepCounterStateMachine.recordSensorReading(state, 1_500L, nov11, 11, fmt) // +1,500
        assertEquals(3_500L, StepCounterStateMachine.computeTodaySteps(state, nov11))

        // Reboot #2
        state = StepCounterStateMachine.applyBootTransition(state, nov11, 12, fmt)
        state = StepCounterStateMachine.recordSensorReading(state, 400L, nov11, 12, fmt) // +400
        assertEquals(3_900L, StepCounterStateMachine.computeTodaySteps(state, nov11))
    }

    @Test
    fun skippedBootReceiver_recoversViaBootCountEvenWhenPostBootStepsExceedPreReboot() {
        val nov11 = epochDay(2026, Calendar.NOVEMBER, 11)
        var state = StepState()

        // First boot segment: walk 3,000 steps cleanly from 0 baseline
        state = StepCounterStateMachine.recordSensorReading(state, 0L, nov11, 20, fmt)
        state = StepCounterStateMachine.recordSensorReading(state, 3_000L, nov11, 20, fmt)

        // Device reboots (bootCount 20 -> 21), OEM blocks BOOT_COMPLETED, user walks 5,000 steps (> 3,000!)
        state = StepCounterStateMachine.recordSensorReading(state, 5_000L, nov11, 21, fmt)
        assertEquals(3_000L, state.bankedTodaySteps)
        assertEquals(0L, state.midnightBaseline)
        assertEquals(8_000L, StepCounterStateMachine.computeTodaySteps(state, nov11))
    }

    @Test
    fun skippedBootReceiver_withoutBootCountInitialized_recoversViaMonotonicDrop() {
        val nov11 = epochDay(2026, Calendar.NOVEMBER, 11)
        // Simulate upgraded user prefs before lastBootCount existed (-1)
        var state = StepState(
            baselineDate = nov11,
            midnightBaseline = 10_000L,
            lastKnownTotalSteps = 13_000L,
            bankedTodaySteps = 0L,
            lastBootCount = -1,
        )

        // Reboot occurred before BOOT_COMPLETED arrived; first sensor reading is 120
        state = StepCounterStateMachine.recordSensorReading(state, 120L, nov11, 45, fmt)
        assertEquals(3_000L, state.bankedTodaySteps)
        assertEquals(45, state.lastBootCount)
        assertEquals(3_120L, StepCounterStateMachine.computeTodaySteps(state, nov11))
    }

    @Test
    fun lateBootCompletedAfterAppSynced_doesNotDoubleBankOrWipePostBootSteps() {
        val nov11 = epochDay(2026, Calendar.NOVEMBER, 11)
        var state = StepState()

        state = StepCounterStateMachine.recordSensorReading(state, 10_000L, nov11, 30, fmt)
        state = StepCounterStateMachine.recordSensorReading(state, 12_500L, nov11, 30, fmt) // +2,500

        // User opens app right after reboot before delayed BOOT_COMPLETED arrives (bootCount = 31)
        state = StepCounterStateMachine.syncWithoutFreshSample(state, nov11, 31, fmt)
        state = StepCounterStateMachine.recordSensorReading(state, 400L, nov11, 31, fmt)
        assertEquals(2_900L, StepCounterStateMachine.computeTodaySteps(state, nov11))

        // Delayed BOOT_COMPLETED guard: StepPersistenceManager skips applyBootTransition when lastBootCount == 31,
        // and even direct repeat on identical state remains exact if hardware baseline stays 0.
        assertEquals(31, state.lastBootCount)
        assertEquals(400L, state.lastKnownTotalSteps)
        assertEquals(2_500L, state.bankedTodaySteps)
    }

    @Test
    fun crossMidnightReboot_archivesPreRebootYesterdayTotalAndResetsTodayFromBootZero() {
        val nov11 = epochDay(2026, Calendar.NOVEMBER, 11)
        val nov12 = epochDay(2026, Calendar.NOVEMBER, 12)
        var state = StepState()

        state = StepCounterStateMachine.recordSensorReading(state, 10_000L, nov11, 50, fmt)
        state = StepCounterStateMachine.recordSensorReading(state, 13_400L, nov11, 50, fmt) // +3,400 on Nov 11

        // Device shuts down at night on Nov 11 and turns back on morning of Nov 12 (bootCount = 51)
        state = StepCounterStateMachine.applyBootTransition(state, nov12, 51, fmt)
        assertEquals(listOf(DailyStepRecord("2026-11-11", 3_400L)), state.history)
        assertEquals(0L, state.bankedTodaySteps)
        assertEquals(0L, state.midnightBaseline)
        assertEquals(nov12, state.baselineDate)

        // Post-reboot morning steps credit exclusively to Nov 12
        state = StepCounterStateMachine.recordSensorReading(state, 75L, nov12, 51, fmt)
        assertEquals(75L, StepCounterStateMachine.computeTodaySteps(state, nov12))
    }

    @Test
    fun sameDayRebootFollowedByMidnightRollover_combinesBankedAndPostRebootInHistory() {
        val nov11 = epochDay(2026, Calendar.NOVEMBER, 11)
        val nov12 = epochDay(2026, Calendar.NOVEMBER, 12)
        var state = StepState()

        state = StepCounterStateMachine.recordSensorReading(state, 2_000L, nov11, 60, fmt)
        state = StepCounterStateMachine.recordSensorReading(state, 5_000L, nov11, 60, fmt) // +3,000
        state = StepCounterStateMachine.applyBootTransition(state, nov11, 61, fmt)
        state = StepCounterStateMachine.recordSensorReading(state, 700L, nov11, 61, fmt) // +700

        // Midnight arrives without reboot; raw counter keeps rising slightly to 750
        state = StepCounterStateMachine.recordSensorReading(state, 750L, nov12, 61, fmt)
        assertEquals(listOf(DailyStepRecord("2026-11-11", 3_750L)), state.history)
        assertEquals(750L, state.midnightBaseline)
        assertEquals(0L, StepCounterStateMachine.computeTodaySteps(state, nov12))
    }

    @Test
    fun rebootWithoutSensorInitialization_preservesUninitializedBaseline() {
        val nov11 = epochDay(2026, Calendar.NOVEMBER, 11)
        val initial = StepState()

        val afterBoot = StepCounterStateMachine.applyBootTransition(initial, nov11, 12, fmt)
        assertEquals(-1L, afterBoot.baselineDate)
        assertEquals(-1L, afterBoot.midnightBaseline)
        assertEquals(12, afterBoot.lastBootCount)
    }
}

