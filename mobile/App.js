import React, { useEffect } from 'react';
import { StatusBar, Linking } from 'react-native';
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

      return () => {
        unsubscribe?.();
      };
    } catch (err) {
      console.log('App initialization error:', err.message);
    }
  }, []);

  const linking = {
    prefixes: [
      'scoreverse://',
      'roughturf://', 
      'https://scoreverse.in',
      'http://scoreverse.in',
      'https://www.scoreverse.in',
      'http://www.scoreverse.in'
    ],
    async getInitialURL() {
      // First, check if app was opened from a deep link
      const url = await Linking.getInitialURL();
      if (url != null) return url;

      // Check if there is an initial firebase notification
      const message = await NotificationService.getInitialNotification();
      if (message?.data) {
        if (message.data.url) return message.data.url;
        if (message.data.matchId) return `scoreverse://match/${message.data.matchId}`;
        if (message.data.playerId) return `scoreverse://player/${message.data.playerId}`;
        if (message.data.turfId) return `scoreverse://turf/${message.data.turfId}`;
        if (message.data.tournamentId) return `scoreverse://tournament/${message.data.tournamentId}`;
        if (message.data.type) return `scoreverse://notifications`;
      }
      return null;
    },
    subscribe(listener) {
      const onReceiveURL = ({ url }) => listener(url);
      const linkingSubscription = Linking.addEventListener('url', onReceiveURL);

      const unsubscribeNotification = NotificationService.onNotificationOpenedApp(message => {
        if (message?.data) {
          if (message.data.url) listener(message.data.url);
          else if (message.data.matchId) listener(`scoreverse://match/${message.data.matchId}`);
          else if (message.data.playerId) listener(`scoreverse://player/${message.data.playerId}`);
          else if (message.data.turfId) listener(`scoreverse://turf/${message.data.turfId}`);
          else if (message.data.tournamentId) listener(`scoreverse://tournament/${message.data.tournamentId}`);
          else if (message.data.type) listener(`scoreverse://notifications`);
        }
      });

      return () => {
        linkingSubscription.remove();
        unsubscribeNotification?.();
      };
    },
    config: {
      screens: {
        Customer: {
          screens: {
            Home: {
              screens: {
                TurfDetail: 'turf/:id',
                PlayerDetail: 'player/:id',
                Notifications: 'notifications',
              }
            },
            'My Cricket': {
              screens: {
                TournamentDetail: 'tournament/:tournamentId',
                MatchSummary: 'match/:id',
              }
            },
            AuctionRegistration: 'tournament/:tournamentId/register',
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
