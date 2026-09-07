import React, { useEffect, useRef } from 'react';
import { View, Animated, TouchableOpacity, Text, StyleSheet, Image } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { fetchOwnerDashboard } from '../features/owner/ownerSlice';
import { getImageUrl } from '../api/axios';

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
import ChangePasswordScreen from '../features/auth/screens/ChangePasswordScreen';
import EditProfileScreen from '../features/user/screens/EditProfileScreen';
import PrivacyPolicyScreen from '../features/user/screens/PrivacyPolicyScreen';
import HelpSupportScreen from '../features/user/screens/HelpSupportScreen';

// Support Screens
import TicketListScreen from '../features/support/screens/TicketListScreen';
import CreateTicketScreen from '../features/support/screens/CreateTicketScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const DashboardStack = () => (
  <Stack.Navigator detachInactiveScreens={false} screenOptions={{ headerShown: false }}>
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
    
    {/* Support */}
    <Stack.Screen name="TicketListScreen" component={TicketListScreen} />
    <Stack.Screen name="CreateTicketScreen" component={CreateTicketScreen} />
  </Stack.Navigator>
);

const OwnerBookingsStack = () => (
  <Stack.Navigator detachInactiveScreens={false} screenOptions={{ headerShown: false }}>
    <Stack.Screen name="OwnerBookingsMain" component={OwnerBookingsScreen} />
    <Stack.Screen name="CreateTicketScreen" component={CreateTicketScreen} />
    <Stack.Screen name="TicketListScreen" component={TicketListScreen} />
  </Stack.Navigator>
);

const AnalyticsStack = () => (
  <Stack.Navigator detachInactiveScreens={false} screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Analytics" component={OwnerAnalyticsScreen} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator detachInactiveScreens={false} screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileMain" component={ProfileScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
    
    {/* Support */}
    <Stack.Screen name="TicketListScreen" component={TicketListScreen} />
    <Stack.Screen name="CreateTicketScreen" component={CreateTicketScreen} />
  </Stack.Navigator>
);

const tabIcons = { Dashboard: 'view-dashboard', Bookings: 'calendar-clock', Analytics: 'chart-bar', Profile: 'account' };

/* ── Animated single tab item ──────────────────────────────────────────── */
const TabItem = ({ route, isFocused, onPress, onLongPress, colors, isDark, insets, badgeCount }) => {
  const { user } = useSelector((state) => state.auth);
  const scaleAnim = useRef(new Animated.Value(isFocused ? 1.15 : 1)).current;
  const dotAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(isFocused ? -3 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isFocused ? 1.18 : 1,
        useNativeDriver: true,
        damping: 12,
        stiffness: 160,
      }),
      Animated.spring(translateY, {
        toValue: isFocused ? -4 : 0,
        useNativeDriver: true,
        damping: 12,
        stiffness: 160,
      }),
      Animated.spring(dotAnim, {
        toValue: isFocused ? 1 : 0,
        useNativeDriver: true,
        damping: 14,
        stiffness: 200,
      }),
    ]).start();
  }, [isFocused]);

  const iconName = tabIcons[route.name] || 'circle';
  const isProfileTab = route.name === 'Profile';
  const avatarUrl = (isProfileTab && user?.photo) ? getImageUrl(user.photo) : null;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      onPress={onPress}
      onLongPress={onLongPress}
      style={tabStyles.tabItem}
      activeOpacity={0.7}
    >
      <Animated.View style={[tabStyles.iconWrap, { transform: [{ scale: scaleAnim }, { translateY }] }]}>
        {avatarUrl ? (
          <View
            style={[
              tabStyles.avatarWrap,
              {
                borderColor: isFocused ? (isDark ? '#FFD400' : colors.primaryDark) : colors.border,
              },
            ]}
          >
            <Image
              source={{ uri: avatarUrl }}
              style={tabStyles.avatarImg}
              resizeMode="cover"
            />
          </View>
        ) : (
          <View>
            <Icon 
              name={iconName} 
              size={22} 
              color={isFocused ? (isDark ? '#FFD400' : colors.primaryDark) : colors.textTertiary} 
            />
            {badgeCount > 0 && (
              <View style={[tabStyles.badge, { backgroundColor: colors.error }]}>
                <Text style={tabStyles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
              </View>
            )}
          </View>
        )}
      </Animated.View>

      {/* Yellow dot indicator below the icon */}
      <Animated.View
        style={[
          tabStyles.dot,
          {
            backgroundColor: isDark ? '#FFD400' : colors.primaryDark,
            opacity: dotAnim,
            transform: [{ scaleX: dotAnim }],
          },
        ]}
      />

      <Text
        style={[
          tabStyles.label,
          { 
            color: isFocused ? (isDark ? '#FFD400' : colors.primaryDark) : colors.textTertiary,
            fontWeight: isFocused ? '700' : '500'
          },
        ]}
      >
        {route.name}
      </Text>
    </TouchableOpacity>
  );
};

/* ── Custom full tab bar ─────────────────────────────────────────────────── */
const CustomTabBar = ({ state, descriptors, navigation, insets }) => {
  const { colors, isDark } = useTheme();
  // Check if tab bar should be hidden for the current focused route
  const focusedOptions = descriptors[state.routes[state.index].key].options;
  const tabBarStyle = focusedOptions.tabBarStyle;
  if (tabBarStyle?.display === 'none') return null;

  return (
    <View style={[
      tabStyles.container, 
      { 
        backgroundColor: colors.surface, 
        borderTopColor: colors.border,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 10 
      }
    ]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };
        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };
        return (
          <TabItem
            key={route.key}
            route={route}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
            colors={colors}
            isDark={isDark}
            insets={insets}
            badgeCount={route.name === 'Bookings' ? descriptors[route.key].options.badgeCount : 0}
          />
        );
      })}
    </View>
  );
};

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    gap: 4,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  dot: {
    width: 18,
    height: 3,
    borderRadius: 2,
  },
  label: {
    fontSize: 9.5,
    fontFamily: 'Outfit-Medium',
    letterSpacing: 0.2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: 'Outfit-Bold',
  }
});

const OwnerNavigator = () => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { dashboard } = useSelector((state) => state.owner);
  const pendingCancellationsCount = dashboard?.stats?.pendingCancellationsCount || 0;

  useEffect(() => {
    dispatch(fetchOwnerDashboard());
  }, [dispatch]);

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} insets={insets} />}
    >
      <Tab.Screen name="Dashboard" component={DashboardStack} />
      <Tab.Screen 
        name="Bookings" 
        component={OwnerBookingsStack} 
        options={{ badgeCount: pendingCancellationsCount }}
      />
      <Tab.Screen name="Analytics" component={AnalyticsStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
};

export default OwnerNavigator;
