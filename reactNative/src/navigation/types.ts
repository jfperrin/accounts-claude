import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type AuthStackParamList = {
  Login: undefined;
};

export type AppTabParamList = {
  Dashboard: undefined;
  Banks:     undefined;
  Recurring: undefined;
  Profile:   undefined;
};

export type AuthStackProps<S extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, S>;

export type AppTabProps<S extends keyof AppTabParamList> =
  BottomTabScreenProps<AppTabParamList, S>;
