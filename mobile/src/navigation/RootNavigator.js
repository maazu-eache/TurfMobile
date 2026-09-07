import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { useDispatch, useSelector } from 'react-redux';
import { logoutLocal, setGuestMode } from '../features/auth/authSlice';
import { showCustomAlert } from '../components/CustomAlert';
import socketService from '../services/socketService';
import { reset } from './navigationRef';

import AuthNavigator from './AuthNavigator';
import CustomerNavigator from './CustomerNavigator';
import OwnerNavigator from './OwnerNavigator';
import PlayerNavigator from './PlayerNavigator';
import AdminNavigator from './AdminNavigator';
import SplashScreen from '../features/auth/screens/SplashScreen';
import NotificationService from '../services/NotificationService';
import { useTheme } from '../theme/theme';

const Stack = createStackNavigator();

// Session-scoped flag — survives re-renders but resets on full app restart only
let _splashHasPlayed = false;

const RootNavigator = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, isGuest, user, currentRole } = useSelector((state) => state.auth);
  const { colors } = useTheme();

  // Use a ref so this never resets when the component re-renders or remounts due to navKey change
  const splashPlayedRef = React.useRef(_splashHasPlayed);
  const [showSplash, setShowSplash] = React.useState(!_splashHasPlayed);

  const bgColor = colors?.background || '#0D0D0D';

  const handleSplashFinished = React.useCallback(() => {
    _splashHasPlayed = true;
    splashPlayedRef.current = true;
    setShowSplash(false);
  }, []);

  React.useEffect(() => {
    if (!splashPlayedRef.current) {
      // Safety fallback: only fires if video stalls/errors — 30s gives full video time
      const timer = setTimeout(handleSplashFinished, 8000);
      return () => clearTimeout(timer);
    }
  }, [handleSplashFinished]);

  React.useEffect(() => {
    if (isAuthenticated && user?._id) {
      NotificationService.getFCMToken().catch(err => console.log('FCM Sync error:', err));

      // Connect to personal socket room and listen for real-time role change / force logout
      try {
        const socket = socketService.getSocket();
        socket.emit('join_user', { userId: user._id });
        socket.emit('join_user_room', { userId: user._id });

        const handleForceLogout = (data) => {
          if (!data || !user?._id) return;
          // STRICT CHECK: only log out if this event is specifically targeted to this logged-in user
          if (data.userId && String(data.userId) !== String(user._id)) {
            return;
          }
          dispatch(logoutLocal());
          dispatch(setGuestMode(true));
          showCustomAlert(
            'Session Expired',
            data?.message || 'Your account role has been updated by an administrator. Please log in again.'
          );
        };

        socket.on('USER_FORCE_LOGOUT', handleForceLogout);
        return () => {
          socket.off('USER_FORCE_LOGOUT', handleForceLogout);
        };
      } catch (err) {
        console.log('Socket listener error:', err);
      }
    }
  }, [isAuthenticated, user?._id, dispatch]);

  const roles = user?.roles || (user?.role ? [user.role] : []);
  const isAdmin = roles.includes('admin') || user?.role === 'admin';
  const isOwner = currentRole === 'owner' || (!currentRole && user?.role === 'owner');

  const getMainNavigator = () => {
    if (!user) return <Stack.Screen name="Customer" component={CustomerNavigator} />;

    if (isAdmin) {
      return <Stack.Screen name="Admin" component={AdminNavigator} />;
    }
    
    if (isOwner) {
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
    ? (isAdmin ? 'admin-stack' : (isOwner ? 'owner-stack' : 'customer-stack'))
    : (isGuest ? 'guest-stack' : 'auth-stack');

  console.log('🧭 [RootNavigator] RENDERING...', {
    isAuthenticated,
    isGuest,
    roles,
    isAdmin,
    isOwner,
    navKey,
    showSplash,
  });

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {showSplash ? (
        /* Show ONLY the splash — navigator is not mounted yet, no dashboard flash */
        <SplashScreen onFinished={handleSplashFinished} />
      ) : (
        <Stack.Navigator
          key={navKey}
          detachInactiveScreens={false}
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: bgColor },
            cardStyleInterpolator: CardStyleInterpolators.forFadeFromBottomAndroid,
          }}
        >
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
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
});

export default RootNavigator;
