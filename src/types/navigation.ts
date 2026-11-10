/**
 * Navigation-related types for the app's routing structure.
 */

export type RootStackParamList = {
  Dashboard: undefined;
  Stats: { metric?: 'steps' | 'distance' | 'water' } | undefined;
  StepsDetails: undefined;
  DistanceDetails: undefined;
  WaterDetails: undefined;
  History: undefined;
  Settings: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
