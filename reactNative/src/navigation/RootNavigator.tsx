import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import { useAuth }       from '@/hooks/useAuth';
import { LoginScreen }   from '@/screens/LoginScreen';
import { AppNavigator }  from './AppNavigator';
import { palette }       from '@/theme';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { user } = useAuth();

  if (user === undefined) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.indigo500} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="App"   component={AppNavigator} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen}  />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.gray50 },
});
