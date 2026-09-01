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

const linking = {
  prefixes: [
    'scoreverse://',
    'roughturf://',
    'https://scoreverse.in',
    'https://www.scoreverse.in',
    'http://scoreverse.in',
    'http://www.scoreverse.in',
  ],

  async getInitialURL() {
    const url = await Linking.getInitialURL();
    console.log('🔗 [Linking] Cold-start URL from Linking.getInitialURL():', url);

    if (url) {
      return url;
    }

    const message = await NotificationService.getInitialNotification();
    console.log('🔔 [Linking] Cold-start notification payload:', message?.data);

    if (message?.data) {
      if (message.data.url) {
        return message.data.url;
      }
      if (message.data.matchId) {
        return `https://www.scoreverse.in/match/${message.data.matchId}`;
      }
      if (message.data.playerId) {
        return `https://www.scoreverse.in/player/${message.data.playerId}`;
      }
      if (message.data.turfId) {
        return `https://www.scoreverse.in/turf/${message.data.turfId}`;
      }
      if (message.data.tournamentId) {
        return `https://www.scoreverse.in/tournament/${message.data.tournamentId}`;
      }
      if (message.data.type) {
        return `https://www.scoreverse.in/notifications`;
      }
    }

    return null;
  },

  subscribe(listener) {
    const onReceiveURL = ({ url }) => {
      console.log('🔗 [Linking] Warm/Foreground URL received:', url);
      listener(url);
    };

    const linkingSubscription = Linking.addEventListener('url', onReceiveURL);

    const unsubscribeNotification =
      NotificationService.onNotificationOpenedApp(message => {
        if (!message?.data) return;
        console.log('🔔 [Linking] Notification opened app:', message.data);

        if (message.data.url) {
          listener(message.data.url);
        } else if (message.data.matchId) {
          listener(`https://www.scoreverse.in/match/${message.data.matchId}`);
        } else if (message.data.playerId) {
          listener(`https://www.scoreverse.in/player/${message.data.playerId}`);
        } else if (message.data.turfId) {
          listener(`https://www.scoreverse.in/turf/${message.data.turfId}`);
        } else if (message.data.tournamentId) {
          listener(`https://www.scoreverse.in/tournament/${message.data.tournamentId}`);
        } else if (message.data.type) {
          listener(`https://www.scoreverse.in/notifications`);
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
        initialRouteName: 'Home',
        screens: {
          Home: {
            initialRouteName: 'HomeMain',
            screens: {
              TurfDetail: 'turf/:id',
              PlayerDetail: 'player/:id',
              Notifications: 'notifications',
            },
          },
          'My Cricket': {
            initialRouteName: 'MyCricketMain',
            screens: {
              TournamentDetail: 'tournament/:tournamentId',
              MatchSummary: 'match/:id',
              AuctionRegistration: 'tournament/:tournamentId/register',
            },
          },
        },
      },
      Auth: {
        initialRouteName: 'Onboarding',
        screens: {
          Onboarding: 'onboarding',
          Login: 'login',
        },
      },
    },
  },
};

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <PersistGate
          loading={null}
          persistor={persistor}
          onBeforeLift={() => {
            const auth = store.getState().auth;
            console.log('💾 [PersistGate] Redux Persist rehydration complete:', {
              isAuthenticated: auth?.isAuthenticated,
              isGuest: auth?.isGuest,
              userId: auth?.user?._id,
              roles: auth?.user?.roles || auth?.user?.role,
            });
          }}
        >
          <SafeAreaProvider>
            <PaperProvider theme={darkTheme}>
              <NavigationContainer
                linking={linking}
                ref={navigationRef}
                theme={darkTheme}
                onReady={() => {
                  const currentRoute = navigationRef.getCurrentRoute();
                  const rootState = navigationRef.getRootState();
                  console.log('🧭 [Navigation] NavigationContainer is READY.');
                  console.log('🧭 [Navigation] Current Active Route:', currentRoute?.name);
                  console.log('🧭 [Navigation] Current Active Params:', JSON.stringify(currentRoute?.params));
                  console.log('🧭 [Navigation] Full Resolved State Tree:', JSON.stringify(rootState));
                }}
                onStateChange={(state) => {
                  const currentRoute = navigationRef.getCurrentRoute();
                  console.log('🧭 [Navigation] Navigation state changed -> Active Route:', currentRoute?.name, 'Params:', JSON.stringify(currentRoute?.params));
                }}
              >
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
