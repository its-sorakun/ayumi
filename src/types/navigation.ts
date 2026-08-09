/**
 * Navigation-related types for the app's routing structure.
 */

export type RootStackParamList = {
  Dashboard: undefined;
  StepsDetails: undefined;
  History: undefined;
  Settings: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
