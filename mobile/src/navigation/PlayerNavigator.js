import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import PlayerProfileScreen from '../features/player/screens/PlayerProfileScreen';
import CareerStatsScreen from '../features/player/screens/CareerStatsScreen';
import AchievementsScreen from '../features/player/screens/AchievementsScreen';
import RankingsScreen from '../features/player/screens/RankingsScreen';
import PlayerDetailScreen from '../features/player/screens/PlayerDetailScreen';
import TeamDetailScreen from '../features/team/screens/TeamDetailScreen';
import TeamListScreen from '../features/team/screens/TeamListScreen';
import TournamentDetailScreen from '../features/tournament/screens/TournamentDetailScreen';
import MatchSummaryScreen from '../features/match/screens/MatchSummaryScreen';
import CreateTicketScreen from '../features/support/screens/CreateTicketScreen';
import ScorecardScreen from '../features/match/screens/ScorecardScreen';
import SpectatorScreen from '../features/match/screens/SpectatorScreen';
import QualificationCalculatorScreen from '../features/tournament/screens/QualificationCalculatorScreen';

const Stack = createStackNavigator();

const PlayerNavigator = () => (
  <Stack.Navigator detachInactiveScreens={false} screenOptions={{ headerShown: false }}>
    <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />
    <Stack.Screen name="CareerStats" component={CareerStatsScreen} />
    <Stack.Screen name="Achievements" component={AchievementsScreen} />
    <Stack.Screen name="Rankings" component={RankingsScreen} />
    <Stack.Screen name="PlayerDetail" component={PlayerDetailScreen} />
    <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
    <Stack.Screen name="TeamList" component={TeamListScreen} />
    <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
    <Stack.Screen name="QualificationCalculator" component={QualificationCalculatorScreen} />
    <Stack.Screen name="MatchSummary" component={MatchSummaryScreen} options={{ gestureEnabled: false }} />
    <Stack.Screen name="Scorecard" component={ScorecardScreen} />
    <Stack.Screen name="Spectator" component={SpectatorScreen} />
    <Stack.Screen name="CreateTicketScreen" component={CreateTicketScreen} />
  </Stack.Navigator>
);

export default PlayerNavigator;
