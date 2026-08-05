import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import { Colors } from '../theme/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Customer Screens
import HomeScreen from '../features/customer/screens/HomeScreen';
import SearchScreen from '../features/turf/screens/SearchScreen';
import TurfDetailScreen from '../features/turf/screens/TurfDetailScreen';
import TurfMapScreen from '../features/turf/screens/TurfMapScreen';
import TurfGalleryScreen from '../features/turf/screens/TurfGalleryScreen';
import SlotPickerScreen from '../features/booking/screens/SlotPickerScreen';
import BookingConfirmScreen from '../features/booking/screens/BookingConfirmScreen';

import BookingHistoryScreen from '../features/booking/screens/BookingHistoryScreen';
import BookingDetailScreen from '../features/booking/screens/BookingDetailScreen';
// Removing duplicate FavouritesScreen import
import WalletScreen from '../features/wallet/screens/WalletScreen';
import NotificationsScreen from '../features/notification/screens/NotificationsScreen';
import ProfileScreen from '../features/user/screens/ProfileScreen';
import ChangePasswordScreen from '../features/auth/screens/ChangePasswordScreen';
import FavouritesScreen from '../features/user/screens/FavouritesScreen';
import MyCricketScreen from '../features/match/screens/MyCricketScreen';
import SpectatorScreen from '../features/match/screens/SpectatorScreen';
import EditProfileScreen from '../features/user/screens/EditProfileScreen';
import HelpSupportScreen from '../features/user/screens/HelpSupportScreen';
import PrivacyPolicyScreen from '../features/user/screens/PrivacyPolicyScreen';

// Support Screens
import TicketListScreen from '../features/support/screens/TicketListScreen';
import CreateTicketScreen from '../features/support/screens/CreateTicketScreen';

// Match Screens (accessible from Customer)
import MatchSetupScreen from '../features/match/screens/MatchSetupScreen';
import MatchTeamSelectionScreen from '../features/match/screens/MatchTeamSelectionScreen';
import TossScreen from '../features/match/screens/TossScreen';
import PlayingXIScreen from '../features/match/screens/PlayingXIScreen';
import LiveScorerScreen from '../features/match/screens/LiveScorerScreen';
import SelectBowlerScreen from '../features/match/screens/SelectBowlerScreen';
import AddPlayerScreen from '../features/match/screens/AddPlayerScreen';
import MatchPlayerSelectionScreen from '../features/match/screens/MatchPlayerSelectionScreen';
import ScorecardScreen from '../features/match/screens/ScorecardScreen';
import MatchSummaryScreen from '../features/match/screens/MatchSummaryScreen';
import SuperOverScreen from '../features/match/screens/SuperOverScreen';
import SquadSelectionScreen from '../features/match/screens/SquadSelectionScreen';

// Team & Tournament
import TeamListScreen from '../features/team/screens/TeamListScreen';
import TeamDetailScreen from '../features/team/screens/TeamDetailScreen';
import TeamCreateScreen from '../features/team/screens/TeamCreateScreen';
import TournamentListScreen from '../features/tournament/screens/TournamentListScreen';
import TournamentDetailScreen from '../features/tournament/screens/TournamentDetailScreen';
import TournamentCreateScreen from '../features/tournament/screens/TournamentCreateScreen';
import FixturesScreen from '../features/tournament/screens/FixturesScreen';
import PointsTableScreen from '../features/tournament/screens/PointsTableScreen';
import QualificationCalculatorScreen from '../features/tournament/screens/QualificationCalculatorScreen';

// Auction
import AuctionRegistrationScreen from '../features/tournament/screens/AuctionRegistrationScreen';
import AuctionCreateSetsScreen from '../features/tournament/screens/AuctionCreateSetsScreen';
import AuctionLiveOrganiserScreen from '../features/tournament/screens/AuctionLiveOrganiserScreen';
import AuctionLiveTeamOwnerScreen from '../features/tournament/screens/AuctionLiveTeamOwnerScreen';
import AuctionLivePublicScreen from '../features/tournament/screens/AuctionLivePublicScreen';

// Player
import PlayerProfileScreen from '../features/player/screens/PlayerProfileScreen';
import CareerStatsScreen from '../features/player/screens/CareerStatsScreen';
import AchievementsScreen from '../features/player/screens/AchievementsScreen';
import RankingsScreen from '../features/player/screens/RankingsScreen';
import PlayerDetailScreen from '../features/player/screens/PlayerDetailScreen';
import GlobalLeaderboardScreen from '../features/player/screens/GlobalLeaderboardScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const tabIcons = {
  Home: 'home',
  Search: 'magnify',
  'My Cricket': 'cricket',
  Bookings: 'calendar-check',
  Profile: 'account-circle',
};

/* ── Animated single tab item ──────────────────────────────────────────── */
const TabItem = ({ route, isFocused, onPress, onLongPress, color, insets }) => {
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

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      onPress={onPress}
      onLongPress={onLongPress}
      style={tabStyles.tabItem}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          tabStyles.iconWrap,
          { transform: [{ scale: scaleAnim }, { translateY }] }
        ]}
      >
        <Icon
          name={iconName}
          size={22}
          color={isFocused ? Colors.primary : Colors.textTertiary}
        />
      </Animated.View>

      {/* Yellow dot indicator below the icon */}
      <Animated.View
        style={[
          tabStyles.dot,
          {
            opacity: dotAnim,
            transform: [{ scaleX: dotAnim }],
          },
        ]}
      />

      <Text
        style={[
          tabStyles.label,
          { color: isFocused ? Colors.primary : Colors.textTertiary },
        ]}
      >
        {route.name}
      </Text>
    </TouchableOpacity>
  );
};

/* ── Custom full tab bar ─────────────────────────────────────────────────── */
const CustomTabBar = ({ state, descriptors, navigation, insets }) => {
  // Check if tab bar should be hidden for the current focused route
  const focusedOptions = descriptors[state.routes[state.index].key].options;
  const tabBarStyle = focusedOptions.tabBarStyle;
  if (tabBarStyle?.display === 'none') return null;

  return (
    <View style={[tabStyles.container, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}>
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
            insets={insets}
          />
        );
      })}
    </View>
  );
};

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
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
  dot: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  label: {
    fontSize: 9.5,
    fontFamily: 'Outfit-Medium',
    letterSpacing: 0.2,
  },
});


const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="HomeMain" component={HomeScreen} />
    <Stack.Screen name="TurfDetail" component={TurfDetailScreen} />
    <Stack.Screen name="TurfMap" component={TurfMapScreen} />
    <Stack.Screen name="TurfGallery" component={TurfGalleryScreen} />
    <Stack.Screen name="SlotPicker" component={SlotPickerScreen} />
    <Stack.Screen name="BookingConfirm" component={BookingConfirmScreen} />

    <Stack.Screen name="Wallet" component={WalletScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="Favourites" component={FavouritesScreen} />
    <Stack.Screen name="GlobalLeaderboard" component={GlobalLeaderboardScreen} />
    <Stack.Screen name="PlayerDetail" component={PlayerDetailScreen} />
    <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
    <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
    <Stack.Screen name="MatchSummary" component={MatchSummaryScreen} />
    <Stack.Screen name="Scorecard" component={ScorecardScreen} />
    <Stack.Screen name="Spectator" component={SpectatorScreen} />
  </Stack.Navigator>
);

const SearchStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="SearchMain" component={SearchScreen} />
    <Stack.Screen name="TurfDetail" component={TurfDetailScreen} />
    <Stack.Screen name="TurfMap" component={TurfMapScreen} />
    <Stack.Screen name="SlotPicker" component={SlotPickerScreen} />
    <Stack.Screen name="BookingConfirm" component={BookingConfirmScreen} />

    <Stack.Screen name="PlayerDetail" component={PlayerDetailScreen} />
    <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
    <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
    <Stack.Screen name="Scorecard" component={ScorecardScreen} />
    <Stack.Screen name="MatchSummary" component={MatchSummaryScreen} />
    <Stack.Screen name="Spectator" component={SpectatorScreen} />
  </Stack.Navigator>
);

const BookingStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="BookingHistory" component={BookingHistoryScreen} />
    <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />

    <Stack.Screen name="SlotPicker" component={SlotPickerScreen} />

    {/* Support */}
    <Stack.Screen name="CreateTicketScreen" component={CreateTicketScreen} />
    <Stack.Screen name="TicketListScreen" component={TicketListScreen} />
  </Stack.Navigator>
);

const MatchStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MyCricketMain" component={MyCricketScreen} />
    <Stack.Screen name="MatchSetup" component={MatchSetupScreen} />
    <Stack.Screen name="MatchTeamSelection" component={MatchTeamSelectionScreen} />
    <Stack.Screen name="Toss" component={TossScreen} />
    <Stack.Screen name="PlayingXI" component={PlayingXIScreen} />
    <Stack.Screen name="LiveScorer" component={LiveScorerScreen} />
    <Stack.Screen name="MatchPlayerSelection" component={MatchPlayerSelectionScreen} />
    <Stack.Screen name="Spectator" component={SpectatorScreen} />
    <Stack.Screen name="Scorecard" component={ScorecardScreen} />
    <Stack.Screen name="MatchSummary" component={MatchSummaryScreen} />
    <Stack.Screen name="SuperOver" component={SuperOverScreen} />
    <Stack.Screen name="SquadSelection" component={SquadSelectionScreen} />
    <Stack.Screen name="AddPlayer" component={AddPlayerScreen} />
    <Stack.Screen name="SelectBowler" component={SelectBowlerScreen} />
    <Stack.Screen name="TeamList" component={TeamListScreen} />
    <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
    <Stack.Screen name="TeamCreate" component={TeamCreateScreen} />
    <Stack.Screen name="TournamentList" component={TournamentListScreen} />
    <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
    <Stack.Screen name="TournamentCreate" component={TournamentCreateScreen} />
    <Stack.Screen name="Fixtures" component={FixturesScreen} />
    <Stack.Screen name="PointsTable" component={PointsTableScreen} />
    <Stack.Screen name="QualificationCalculator" component={QualificationCalculatorScreen} />

    {/* Auction Screens */}
    <Stack.Screen name="AuctionRegistration" component={AuctionRegistrationScreen} />
    <Stack.Screen name="AuctionCreateSets" component={AuctionCreateSetsScreen} />
    <Stack.Screen name="AuctionLiveOrganiser" component={AuctionLiveOrganiserScreen} />
    <Stack.Screen name="AuctionLiveTeamOwner" component={AuctionLiveTeamOwnerScreen} />
    <Stack.Screen name="AuctionLivePublic" component={AuctionLivePublicScreen} />

    <Stack.Screen name="PlayerDetail" component={PlayerDetailScreen} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileMain" component={ProfileScreen} />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />
    <Stack.Screen name="Favourites" component={FavouritesScreen} />
    <Stack.Screen name="CareerStats" component={CareerStatsScreen} />
    <Stack.Screen name="Achievements" component={AchievementsScreen} />
    <Stack.Screen name="Rankings" component={RankingsScreen} />
    <Stack.Screen name="Wallet" component={WalletScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    <Stack.Screen name="TeamList" component={TeamListScreen} />
    <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
    <Stack.Screen name="TeamCreate" component={TeamCreateScreen} />
    <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
    <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    
    {/* Support */}
    <Stack.Screen name="TicketListScreen" component={TicketListScreen} />
    <Stack.Screen name="CreateTicketScreen" component={CreateTicketScreen} />
    
    {/* Turf Booking Flow from Favourites */}
    <Stack.Screen name="TurfDetail" component={TurfDetailScreen} />
    <Stack.Screen name="TurfMap" component={TurfMapScreen} />
    <Stack.Screen name="TurfGallery" component={TurfGalleryScreen} />
    <Stack.Screen name="SlotPicker" component={SlotPickerScreen} />
    <Stack.Screen name="BookingConfirm" component={BookingConfirmScreen} />

    <Stack.Screen name="PlayerDetail" component={PlayerDetailScreen} />
    <Stack.Screen name="MatchSummary" component={MatchSummaryScreen} />
    <Stack.Screen name="Scorecard" component={ScorecardScreen} />
    <Stack.Screen name="Spectator" component={SpectatorScreen} />
  </Stack.Navigator>
);

const CustomerNavigator = ({ navigation }) => {
  const { isAuthenticated } = useSelector((state) => state.auth);
  const insets = useSafeAreaInsets();

  const authGuard = (e) => {
    if (!isAuthenticated) {
      e.preventDefault();
      navigation.navigate('AuthModal', { screen: 'Login' });
    }
  };

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} insets={insets} />}
      screenOptions={({ route }) => {
        const routeName = getFocusedRouteNameFromRoute(route) ?? '';
        const hiddenRoutes = ['MatchSetup', 'MatchTeamSelection', 'Toss', 'PlayingXI', 'LiveScorer', 'MatchPlayerSelection', 'SuperOver', 'AddPlayer', 'SelectBowler', 'Scorecard', 'MatchSummary', 'TournamentDetail', 'AuctionLiveOrganiser', 'AuctionLivePublic', 'AuctionLiveTeamOwner', 'GlobalLeaderboard', 'QualificationCalculator', 'AuctionRegistration'];
        const isHidden = hiddenRoutes.includes(routeName);
        return {
          headerShown: false,
          tabBarStyle: isHidden ? { display: 'none' } : {},
        };
      }}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen 
        name="Search" 
        component={SearchStack} 
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('Search', { screen: 'SearchMain', params: { tab: 'players' } });
          }
        })}
      />
      <Tab.Screen 
        name="My Cricket" 
        component={MatchStack} 
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('My Cricket', { screen: 'MyCricketMain', params: { tab: 'Matches' } });
          }
        })}
      />
      <Tab.Screen 
        name="Bookings" 
        component={BookingStack} 
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            authGuard(e);
            if (!e.defaultPrevented) {
              e.preventDefault();
              navigation.navigate('Bookings', { screen: 'BookingHistory' });
            }
          }
        })} 
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileStack} 
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            authGuard(e);
            if (!e.defaultPrevented) {
              e.preventDefault();
              navigation.navigate('Profile', { screen: 'ProfileMain' });
            }
          }
        })}
      />
    </Tab.Navigator>
  );
};

export default CustomerNavigator;
