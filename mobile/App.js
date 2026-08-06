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
  const navigateUrl = (url, retries = 0) => {
    if (!url) return;
    
    let cleanPath = url
      .replace('scoreverse://', '')
      .replace('roughturf://', '')
      .replace('https://scoreverse.com/', '')
      .replace('https://www.scoreverse.com/', '')
      .replace('https://scoreverse.maazibrahimoo0.workers.dev/', '')
      .replace('https://roughturf.com/', '')
      .replace('https://scoreverse.app/', '');

    let queryParams = {};
    if (cleanPath.includes('?')) {
      const [pathPart, queryPart] = cleanPath.split('?');
      cleanPath = pathPart;
      if (queryPart) {
        queryPart.split('&').forEach(pair => {
          const [key, val] = pair.split('=');
          if (key) queryParams[key] = decodeURIComponent(val || '');
        });
      }
    }

    const parts = cleanPath.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const route = parts[0];
      const id = parts[1];

      const isReady = navigationRef.isReady();
      const currentRoute = isReady ? navigationRef.getCurrentRoute() : null;

      if (isReady && currentRoute) {
        if (route === 'turf') {
          navigate('Customer', {
            screen: 'Home',
            params: {
              screen: 'TurfDetail',
              params: { id, ...queryParams }
            }
          });
        } else if (route === 'tournament' || route === 'auction') {
          if (parts[2] === 'register' || parts[1] === 'register') {
            navigate('Customer', {
              screen: 'AuctionRegistration',
              params: { tournamentId: id, ...queryParams }
            });
          } else {
            navigate('Customer', {
              screen: 'My Cricket',
              params: {
                screen: 'TournamentDetail',
                params: { tournamentId: id, ...queryParams }
              }
            });
          }
        } else if (route === 'match') {
          navigate('Customer', {
            screen: 'My Cricket',
            params: {
              screen: 'MatchSummary',
              params: { matchId: id, ...queryParams }
            }
          });
        }
      } else {
        if (retries < 15) {
          setTimeout(() => navigateUrl(url, retries + 1), 1000);
        }
      }
    }
  };

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

      // Handle deep linking
      const handleDeepLink = (event) => {
        navigateUrl(event.url);
      };

      Linking.getInitialURL().then((url) => {
        if (url) {
          navigateUrl(url);
        }
      });

      const subscription = Linking.addEventListener('url', handleDeepLink);

      return () => {
        unsubscribe?.();
        subscription.remove();
      };
    } catch (err) {
      console.log('App initialization error:', err.message);
    }
  }, []);
  const linking = {
    prefixes: [
      'scoreverse://',
      'roughturf://', 
      'https://scoreverse.com',
      'https://www.scoreverse.com',
      'https://scoreverse.maazibrahimoo0.workers.dev',
      'https://roughturf.com', 
      'https://scoreverse.app'
    ],
    config: {
      screens: {
        Customer: {
          screens: {
            Home: {
              screens: {
                TurfDetail: 'turf/:id',
              }
            },
            'My Cricket': {
              screens: {
                TournamentDetail: 'tournament/:tournamentId',
                MatchSummary: 'match/:matchId',
              }
            },
            AuctionRegistration: 'tournament/:tournamentId/register',
          }
        },
        Player: {
          screens: {
            'My Cricket': {
              screens: {
                TournamentDetail: 'tournament/:tournamentId',
                MatchSummary: 'match/:matchId',
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
