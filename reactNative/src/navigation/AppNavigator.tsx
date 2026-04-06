import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { DashboardScreen } from '@/screens/DashboardScreen';
import { BanksScreen }     from '@/screens/BanksScreen';
import { RecurringScreen } from '@/screens/RecurringScreen';
import { ProfileScreen }   from '@/screens/ProfileScreen';
import type { AppTabParamList } from './types';
import { palette } from '@/theme';

const Tab = createBottomTabNavigator<AppTabParamList>();

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TABS: Array<{
  name: keyof AppTabParamList;
  label: string;
  icon: IconName;
  iconFocused: IconName;
  component: React.ComponentType<any>;
}> = [
  { name: 'Dashboard', label: 'Tableau de bord', icon: 'view-dashboard-outline', iconFocused: 'view-dashboard',   component: DashboardScreen },
  { name: 'Banks',     label: 'Banques',         icon: 'bank-outline',           iconFocused: 'bank',             component: BanksScreen },
  { name: 'Recurring', label: 'Récurrents',      icon: 'repeat',                 iconFocused: 'repeat',           component: RecurringScreen },
  { name: 'Profile',   label: 'Profil',          icon: 'account-outline',        iconFocused: 'account',          component: ProfileScreen },
];

export function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const tab = TABS.find((t) => t.name === route.name)!;
        return {
          headerShown:             false,
          tabBarActiveTintColor:   palette.indigo500,
          tabBarInactiveTintColor: palette.gray400,
          tabBarStyle: {
            backgroundColor: palette.white,
            borderTopColor:  palette.gray200,
            paddingBottom:   4,
            height:          60,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarIcon: ({ focused, color, size }) => (
            <MaterialCommunityIcons
              name={focused ? tab.iconFocused : tab.icon}
              size={size}
              color={color}
            />
          ),
        };
      }}
    >
      {TABS.map((t) => (
        <Tab.Screen
          key={t.name}
          name={t.name}
          component={t.component}
          options={{ tabBarLabel: t.label }}
        />
      ))}
    </Tab.Navigator>
  );
}
