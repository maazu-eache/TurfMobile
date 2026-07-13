import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PlayerProfileScreen from '../features/player/screens/PlayerProfileScreen';
import CareerStatsScreen from '../features/player/screens/CareerStatsScreen';
import AchievementsScreen from '../features/player/screens/AchievementsScreen';
import RankingsScreen from '../features/player/screens/RankingsScreen';
import PlayerDetailScreen from '../features/player/screens/PlayerDetailScreen';

const Stack = createNativeStackNavigator();

const PlayerNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />
    <Stack.Screen name="CareerStats" component={CareerStatsScreen} />
    <Stack.Screen name="Achievements" component={AchievementsScreen} />
    <Stack.Screen name="Rankings" component={RankingsScreen} />
    <Stack.Screen name="PlayerDetail" component={PlayerDetailScreen} />
  </Stack.Navigator>
);

export default PlayerNavigator;
