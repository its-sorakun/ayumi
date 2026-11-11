/**
 * Navigation-related types for the app's routing structure.
 */

export type RootStackParamList = {
  Dashboard: { initialPage?: number; metric?: 'steps' | 'distance' | 'water' } | undefined;
  Stats: { initialPage?: number; metric?: 'steps' | 'distance' | 'water' } | undefined;
  Water: { initialPage?: number } | undefined;
  StepsDetails: undefined;
  DistanceDetails: undefined;
  WaterDetails: undefined;
  History: undefined;
  Settings: { initialPage?: number } | undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
