import React, { useEffect } from 'react';
import { StatusBar, Linking, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import messaging from '@react-native-firebase/messaging';

import { store, persistor } from './src/store';
import RootNavigator from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/theme/theme';
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
    try {
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
    } catch (e) {
      console.log('Linking getInitialURL error:', e);
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

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null, errorInfo: null };
  static getDerivedStateFromError(error) {
    console.error('💥 [ErrorBoundary] getDerivedStateFromError:', error);
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('💥 [ErrorBoundary] CAUGHT ERROR:', error, errorInfo);
  }
  render() {
    console.log('🛡️ [ErrorBoundary] RENDERING children, hasError:', this.state.hasError);
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#1A0000', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: '#FF5555', fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>Rendering Error</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 14, textAlign: 'center' }}>{this.state.error?.toString()}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const ThemedAppContent = () => {
  console.log('🚀 [App] ThemedAppContent STARTING...');
  const themeContext = useTheme();
  console.log('🚀 [App] useTheme() returned:', !!themeContext);
  const { theme, isDark } = themeContext;
  console.log('🚀 [App] ThemedAppContent RENDERING... isDark:', isDark);

  useEffect(() => {
    StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
  }, [isDark]);

  return (
    <PaperProvider theme={theme}>
      <NavigationContainer
        linking={linking}
        ref={navigationRef}
        theme={theme}
        onReady={() => {
          StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
          const currentRoute = navigationRef.getCurrentRoute();
          const rootState = navigationRef.getRootState();
          console.log('🧭 [Navigation] NavigationContainer is READY!');
          console.log('🧭 [Navigation] Current Active Route:', currentRoute?.name);
          console.log('🧭 [Navigation] Current Active Params:', JSON.stringify(currentRoute?.params));
          console.log('🧭 [Navigation] Full Resolved State Tree:', JSON.stringify(rootState));
        }}
        onStateChange={(state) => {
          StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
          const currentRoute = navigationRef.getCurrentRoute();
          console.log('🧭 [Navigation] Navigation state changed -> Active Route:', currentRoute?.name, 'Params:', JSON.stringify(currentRoute?.params));
        }}
      >
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent
        />
        <RootNavigator />
        <CustomAlert ref={customAlertRef} />
      </NavigationContainer>
    </PaperProvider>
  );
};

const App = () => {
  const [rehydrated, setRehydrated] = React.useState(persistor.getState().bootstrapped);

  console.log('⚡ [App] ROOT APP COMPONENT RENDERING... persistor bootstrapped:', persistor.getState().bootstrapped, 'local rehydrated:', rehydrated);

  useEffect(() => {
    const checkBootstrapped = () => {
      const state = persistor.getState();
      console.log('💾 [Persistor State Update]:', state);
      if (state.bootstrapped) {
        setRehydrated(true);
      }
    };

    const unsubscribe = persistor.subscribe(checkBootstrapped);
    checkBootstrapped();

    // Safety timeout: force rehydration after 1.5s so screen is NEVER stuck blank
    const safetyTimer = setTimeout(() => {
      console.log('⏰ [Safety Timeout] Forcing rehydrated=true to unblock render');
      setRehydrated(true);
    }, 1500);

    try {
      NotificationService.requestUserPermission();
      const unsubNotify = NotificationService.listenToForegroundMessages();
      return () => {
        unsubscribe?.();
        clearTimeout(safetyTimer);
        unsubNotify?.();
      };
    } catch (err) {
      console.log('App initialization error:', err.message);
      return () => {
        unsubscribe?.();
        clearTimeout(safetyTimer);
      };
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics} style={{ flex: 1 }}>
          <ThemeProvider>
            <ThemedAppContent />
          </ThemeProvider>
        </SafeAreaProvider>
      </Provider>
    </GestureHandlerRootView>
  );
};

export default App;
