import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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

const Stack = createNativeStackNavigator();

let hasShownInitialSplash = false;

const RootNavigator = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, isGuest, user, currentRole } = useSelector((state) => state.auth);
  const { colors } = useTheme();
  const [showSplash, setShowSplash] = React.useState(!hasShownInitialSplash);

  const bgColor = colors?.background || '#0D0D0D';

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

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Stack.Navigator 
        key={navKey} 
        screenOptions={{ 
          headerShown: false,
          contentStyle: { backgroundColor: bgColor },
          animation: 'fade',
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
    backgroundColor: '#0D0D0D',
  },
});

export default RootNavigator;
