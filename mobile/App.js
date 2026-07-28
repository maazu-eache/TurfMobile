import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import messaging from '@react-native-firebase/messaging';

import { store, persistor } from './src/store';
import RootNavigator from './src/navigation/RootNavigator';
import { darkTheme } from './src/theme/theme';
import { navigationRef, navigate } from './src/navigation/navigationRef';
import NotificationService from './src/services/NotificationService';
import CustomAlert, { customAlertRef } from './src/components/CustomAlert';

const App = () => {
  useEffect(() => {
    try {
      NotificationService.requestUserPermission();

      // Handle FCM foreground messages
      const unsubscribe = NotificationService.listenToForegroundMessages();

      const handleNotificationNavigation = (remoteMessage) => {
        if (remoteMessage?.data?.type) {
          // Simply go to Notifications screen for now
          navigate('Notifications');
        }
      };

      NotificationService.onNotificationOpenedApp(remoteMessage => {
        handleNotificationNavigation(remoteMessage);
      });

      NotificationService.getInitialNotification().then(remoteMessage => {
        if (remoteMessage) handleNotificationNavigation(remoteMessage);
      });

      return unsubscribe;
    } catch (err) {
      console.log('Firebase messaging is not configured:', err.message);
    }
  }, []);
  const linking = {
    prefixes: ['roughturf://', 'https://roughturf.com', 'https://sportverse.maazibrahimoo0.workers.dev'],
    config: {
      screens: {
        Customer: {
          screens: {
            'My Cricket': {
              screens: {
                TournamentDetail: 'tournament/:tournamentId',
              }
            }
          }
        },
        Player: {
          screens: {
            'My Cricket': {
              screens: {
                TournamentDetail: 'tournament/:tournamentId',
              }
            }
          }
        }
      }
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <SafeAreaProvider>
            <PaperProvider theme={darkTheme}>
              <NavigationContainer linking={linking} ref={navigationRef} theme={darkTheme}>
                <StatusBar
                  barStyle="light-content"
                  backgroundColor="transparent"
                  translucent
                />
                <RootNavigator />
                <CustomAlert ref={customAlertRef} />
              </NavigationContainer>
            </PaperProvider>
          </SafeAreaProvider>
        </PersistGate>
      </Provider>
    </GestureHandlerRootView>
  );
};

export default App;
