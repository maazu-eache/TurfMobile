import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PlayerProfileScreen from '../features/player/screens/PlayerProfileScreen';
import CareerStatsScreen from '../features/player/screens/CareerStatsScreen';
import AchievementsScreen from '../features/player/screens/AchievementsScreen';
import RankingsScreen from '../features/player/screens/RankingsScreen';
import PlayerDetailScreen from '../features/player/screens/PlayerDetailScreen';
import TeamDetailScreen from '../features/team/screens/TeamDetailScreen';
import TournamentDetailScreen from '../features/tournament/screens/TournamentDetailScreen';
import MatchSummaryScreen from '../features/match/screens/MatchSummaryScreen';
import ScorecardScreen from '../features/match/screens/ScorecardScreen';
import SpectatorScreen from '../features/match/screens/SpectatorScreen';

const Stack = createNativeStackNavigator();

const PlayerNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />
    <Stack.Screen name="CareerStats" component={CareerStatsScreen} />
    <Stack.Screen name="Achievements" component={AchievementsScreen} />
    <Stack.Screen name="Rankings" component={RankingsScreen} />
    <Stack.Screen name="PlayerDetail" component={PlayerDetailScreen} />
    <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
    <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
    <Stack.Screen name="MatchSummary" component={MatchSummaryScreen} />
    <Stack.Screen name="Scorecard" component={ScorecardScreen} />
    <Stack.Screen name="Spectator" component={SpectatorScreen} />
  </Stack.Navigator>
);

export default PlayerNavigator;
