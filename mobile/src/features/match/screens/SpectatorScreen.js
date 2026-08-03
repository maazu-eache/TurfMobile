import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../../../theme/theme';
import api from '../../../api/axios';

const SpectatorScreen = ({ navigation, route }) => {
  const matchId = route.params?.matchId || route.params?.id;

  useEffect(() => {
    let isMounted = true;
    const checkMatch = async () => {
      try {
        if (!matchId) {
          navigation.goBack();
          return;
        }
        const res = await api.get(`/matches/${matchId}/live`);
        const status = res.data?.data?.match?.status || res.data?.data?.status;
        if (!isMounted) return;
        
        if (['in_progress', 'toss_done', 'innings_break', 'super_over'].includes(status)) {
          navigation.replace('MatchSummary', { matchId });
        } else {
          navigation.replace('MatchSummary', { matchId });
        }
      } catch (err) {
        if (isMounted) navigation.replace('MatchSummary', { matchId });
      }
    };
    checkMatch();
    return () => { isMounted = false; };
  }, [matchId, navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }
});

export default SpectatorScreen;
