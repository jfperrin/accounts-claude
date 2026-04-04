import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider }       from 'react-native-paper';
import { SafeAreaProvider }    from 'react-native-safe-area-context';
import { StatusBar }           from 'expo-status-bar';

import { AuthProvider }    from './src/store/AuthContext';
import { RootNavigator }   from './src/navigation/RootNavigator';
import { theme }           from './src/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
          <StatusBar style="dark" />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
