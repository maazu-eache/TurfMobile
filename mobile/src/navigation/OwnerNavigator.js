import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { fetchOwnerDashboard } from '../features/owner/ownerSlice';
import { useEffect } from 'react';

import OwnerDashboardScreen from '../features/owner/screens/OwnerDashboardScreen';
import TurfRegistrationScreen from '../features/owner/screens/TurfRegistrationScreen';
import SlotManagerScreen from '../features/owner/screens/SlotManagerScreen';
import DynamicPricingScreen from '../features/owner/screens/DynamicPricingScreen';
import OfflineBookingScreen from '../features/owner/screens/OfflineBookingScreen';
import OwnerAnalyticsScreen from '../features/owner/screens/OwnerAnalyticsScreen';
import OwnerBookingsScreen from '../features/owner/screens/OwnerBookingsScreen';
import KYCUploadScreen from '../features/owner/screens/KYCUploadScreen';
import TurfListScreen from '../features/owner/screens/TurfListScreen';
import OwnerCustomersScreen from '../features/owner/screens/OwnerCustomersScreen';
import WalletScreen from '../features/owner/screens/WalletScreen';
import OwnerReviewsScreen from '../features/owner/screens/OwnerReviewsScreen';
import ProfileScreen from '../features/user/screens/ProfileScreen';
import NotificationsScreen from '../features/notification/screens/NotificationsScreen';
import EditProfileScreen from '../features/user/screens/EditProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const DashboardStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="OwnerDashboard" component={OwnerDashboardScreen} />
    <Stack.Screen name="TurfRegistration" component={TurfRegistrationScreen} />
    <Stack.Screen name="TurfList" component={TurfListScreen} />
    <Stack.Screen name="SlotManager" component={SlotManagerScreen} />
    <Stack.Screen name="DynamicPricing" component={DynamicPricingScreen} />
    <Stack.Screen name="OfflineBooking" component={OfflineBookingScreen} />
    <Stack.Screen name="OwnerCustomers" component={OwnerCustomersScreen} />
    <Stack.Screen name="KYCUpload" component={KYCUploadScreen} />
    <Stack.Screen name="Wallet" component={WalletScreen} />
    <Stack.Screen name="OwnerReviews" component={OwnerReviewsScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
  </Stack.Navigator>
);

// Removed BookingsStack as it only had one screen and we need route params to pass directly

const AnalyticsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Analytics" component={OwnerAnalyticsScreen} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileMain" component={ProfileScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="EditProfile" component={EditProfileScreen} />
  </Stack.Navigator>
);

const OwnerNavigator = () => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { dashboard } = useSelector((state) => state.owner);
  const turfs = dashboard?.owner?.turfs || [];
  const totalPendingActions = turfs.reduce((acc, turf) => acc + (turf.pendingActionsCount || 0), 0);

  useEffect(() => {
    dispatch(fetchOwnerDashboard());
  }, [dispatch]);

  const tabIcons = { Dashboard: 'view-dashboard', Bookings: 'calendar-clock', Analytics: 'chart-bar', Profile: 'account' };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => (
          <Icon name={tabIcons[route.name] || 'circle'} color={color} size={size} />
        ),
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.backgroundCard,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'Outfit-Medium',
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardStack} />
      <Tab.Screen 
        name="Bookings" 
        component={OwnerBookingsScreen} 
        options={{ tabBarBadge: totalPendingActions > 0 ? totalPendingActions : null }}
      />
      <Tab.Screen name="Analytics" component={AnalyticsStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
};

export default OwnerNavigator;
