/**
 * TypeScript type definition for the StepCounterModule native module.
 * This is the bridge between our Kotlin code and the TypeScript layer.
 */

import { NativeModules, NativeEventEmitter } from 'react-native';

interface StepCounterNativeModule {
  isAvailable(): Promise<{ available: boolean; hasDailyBaseline: boolean }>;
  startListening(): Promise<boolean>;
  stopListening(): void;
  getTodaySteps(): Promise<{ available: boolean; stepsToday: number }>;
}

const { StepCounterModule } = NativeModules as {
  StepCounterModule?: StepCounterNativeModule;
};

/** Event name emitted by the native module on each step update */
export const STEP_COUNTER_EVENT = 'onStepCounterUpdate';

/**
 * The native bridge to Android's TYPE_STEP_COUNTER sensor.
 * Will be undefined if the native module failed to link or the app
 * is running on a platform other than Android.
 */
export const StepCounter = StepCounterModule ?? null;

/**
 * Create a NativeEventEmitter for step counter events.
 * Only instantiated if the module is available.
 */
export const stepCounterEmitter =
  StepCounter != null
    ? new NativeEventEmitter(StepCounter as any)
    : null;
