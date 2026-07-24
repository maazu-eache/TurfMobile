import React from 'react';
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
import FavouritesScreen from '../features/user/screens/FavouritesScreen';
import MyCricketScreen from '../features/match/screens/MyCricketScreen';
import SpectatorScreen from '../features/match/screens/SpectatorScreen';
import EditProfileScreen from '../features/user/screens/EditProfileScreen';

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

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const tabIcons = {
  Home: 'home',
  Search: 'magnify',
  'My Cricket': 'cricket',
  Bookings: 'calendar-check',
  Profile: 'account-circle',
};

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
    <Stack.Screen name="PlayerDetail" component={PlayerDetailScreen} />
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
      screenOptions={({ route }) => {
        const routeName = getFocusedRouteNameFromRoute(route) ?? '';
        const hiddenRoutes = ['MatchSetup', 'MatchTeamSelection', 'Toss', 'PlayingXI', 'LiveScorer', 'MatchPlayerSelection', 'SuperOver', 'AddPlayer', 'SelectBowler', 'Scorecard', 'MatchSummary', 'TournamentDetail', 'AuctionLiveOrganiser', 'AuctionLivePublic', 'AuctionLiveTeamOwner'];
        const isHidden = hiddenRoutes.includes(routeName);
        
        return {
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Icon name={tabIcons[route.name] || 'circle'} color={color} size={size} />
          ),
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textTertiary,
          tabBarStyle: isHidden ? { display: 'none' } : {
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
