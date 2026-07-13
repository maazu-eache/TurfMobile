import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AdminDashboardScreen from '../features/admin/screens/AdminDashboardScreen';
import UserManagerScreen from '../features/admin/screens/UserManagerScreen';
import TurfApprovalScreen from '../features/admin/screens/TurfApprovalScreen';
import OwnerApprovalScreen from '../features/admin/screens/OwnerApprovalScreen';
import BookingManagerScreen from '../features/admin/screens/BookingManagerScreen';
import AdminAnalyticsScreen from '../features/admin/screens/AdminAnalyticsScreen';
import CouponManagerScreen from '../features/admin/screens/CouponManagerScreen';
import AdminSettlementsScreen from '../features/admin/screens/AdminSettlementsScreen';
import NotificationsScreen from '../features/notification/screens/NotificationsScreen';

const Stack = createNativeStackNavigator();

const AdminNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
    <Stack.Screen name="UserManager" component={UserManagerScreen} />
    <Stack.Screen name="TurfApproval" component={TurfApprovalScreen} />
    <Stack.Screen name="OwnerApproval" component={OwnerApprovalScreen} />
    <Stack.Screen name="BookingManager" component={BookingManagerScreen} />
    <Stack.Screen name="AdminAnalytics" component={AdminAnalyticsScreen} />
    <Stack.Screen name="CouponManager" component={CouponManagerScreen} />
    <Stack.Screen name="AdminSettlements" component={AdminSettlementsScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
  </Stack.Navigator>
);

export default AdminNavigator;
