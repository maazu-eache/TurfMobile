import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';

import AuthNavigator from './AuthNavigator';
import CustomerNavigator from './CustomerNavigator';
import OwnerNavigator from './OwnerNavigator';
import PlayerNavigator from './PlayerNavigator';
import AdminNavigator from './AdminNavigator';
import SplashScreen from '../features/auth/screens/SplashScreen';
import NotificationService from '../services/NotificationService';

const Stack = createNativeStackNavigator();

let hasShownInitialSplash = false;

const RootNavigator = () => {
  const { isAuthenticated, isGuest, user } = useSelector((state) => state.auth);
  const [showSplash, setShowSplash] = React.useState(!hasShownInitialSplash);

  React.useEffect(() => {
    if (!hasShownInitialSplash) {
      const timer = setTimeout(() => {
        hasShownInitialSplash = true;
        setShowSplash(false);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, []);

  React.useEffect(() => {
    if (isAuthenticated && user?._id) {
      NotificationService.getFCMToken().catch(err => console.log('FCM Sync error:', err));
    }
  }, [isAuthenticated, user?._id]);

  const roles = user?.roles || (user?.role ? [user.role] : []);

  const getMainNavigator = () => {
    if (!user) return <Stack.Screen name="Customer" component={CustomerNavigator} />;

    if (roles.includes('admin') || user.role === 'admin') {
      return <Stack.Screen name="Admin" component={AdminNavigator} />;
    }
    
    if (roles.includes('owner') || user.role === 'owner') {
      return (
        <>
          <Stack.Screen name="Owner" component={OwnerNavigator} />
          <Stack.Screen name="Customer" component={CustomerNavigator} />
        </>
      );
    }

    // Default — customer + player
    return (
      <>
        <Stack.Screen name="Customer" component={CustomerNavigator} />
        <Stack.Screen name="Player" component={PlayerNavigator} />
      </>
    );
  };

  const navKey = isAuthenticated
    ? (roles.includes('admin') || user?.role === 'admin'
        ? 'admin-stack'
        : (roles.includes('owner') || user?.role === 'owner'
            ? 'owner-stack'
            : 'customer-stack'))
    : (isGuest ? 'guest-stack' : 'auth-stack');

  return (
    <View style={styles.container}>
      <Stack.Navigator key={navKey} screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          getMainNavigator()
        ) : isGuest ? (
          <>
            <Stack.Screen name="Customer" component={CustomerNavigator} />
            <Stack.Screen
              name="AuthModal"
              component={AuthNavigator}
              options={{ presentation: 'fullScreenModal' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Auth" component={AuthNavigator} />
            <Stack.Screen name="Customer" component={CustomerNavigator} />
          </>
        )}
      </Stack.Navigator>

      {showSplash && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <SplashScreen onFinished={() => setShowSplash(false)} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default RootNavigator;
