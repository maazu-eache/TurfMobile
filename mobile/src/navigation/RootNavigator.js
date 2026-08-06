import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';

import { Linking } from 'react-native';
import AuthNavigator from './AuthNavigator';
import CustomerNavigator from './CustomerNavigator';
import OwnerNavigator from './OwnerNavigator';
import PlayerNavigator from './PlayerNavigator';
import AdminNavigator from './AdminNavigator';
import SplashScreen from '../features/auth/screens/SplashScreen';

import NotificationService from '../services/NotificationService';

const Stack = createNativeStackNavigator();

const RootNavigator = () => {
  const { isAuthenticated, isGuest, user } = useSelector((state) => state.auth);
  const [showSplash, setShowSplash] = React.useState(true);

  React.useEffect(() => {
    // If opened via shared deep link, skip splash video delay for instant navigation
    Linking.getInitialURL().then((url) => {
      if (url) {
        setShowSplash(false);
      }
    }).catch(() => {});

    const timer = setTimeout(() => setShowSplash(false), 7000); // Wait for the 6s video to finish
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (isAuthenticated && user?._id) {
      NotificationService.getFCMToken().catch(err => console.log('FCM Sync error:', err));
    }
  }, [isAuthenticated, user?._id]);

  const getMainNavigator = () => {
    if (!user) return <Stack.Screen name="Customer" component={CustomerNavigator} />;

    const roles = user.roles || [user.role];

    if (roles.includes('admin')) return <Stack.Screen name="Admin" component={AdminNavigator} />;
    
    if (roles.includes('owner')) {
      return <Stack.Screen name="Owner" component={OwnerNavigator} />;
    }

    // Default — customer + player
    return (
      <>
        <Stack.Screen name="Customer" component={CustomerNavigator} />
        <Stack.Screen name="Player" component={PlayerNavigator} />
      </>
    );
  };

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {showSplash ? (
        <Stack.Screen name="Splash" component={SplashScreen} />
      ) : isAuthenticated ? (
        getMainNavigator()
      ) : isGuest ? (
        <>
          <Stack.Screen name="Customer" component={CustomerNavigator} />
          <Stack.Screen name="AuthModal" component={AuthNavigator} options={{ presentation: 'fullScreenModal' }} />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;
