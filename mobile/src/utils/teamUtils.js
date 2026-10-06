import React from 'react';
import { View, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

/**
 * Gets valid, active player entries from a team.
 * Filters out null/orphaned entries where player was deleted, missing, or null.
 */
export const getValidTeamPlayers = (team) => {
  if (!team) return [];
  const playersList = Array.isArray(team) ? team : (Array.isArray(team.players) ? team.players : []);
  return playersList.filter(entry => {
    if (!entry) return false;
    const p = entry.player !== undefined ? entry.player : entry;
    if (!p) return false;
    return Boolean(typeof p === 'object' ? (p.name || p._id || p.userId) : p);
  });
};

/**
 * Checks if all valid players in a team are verified.
 * A team is considered verified when:
 * 1. It has isVerified explicitly marked true from backend, OR
 * 2. It has at least 1 valid player and EVERY valid player has a linked user account or is verified.
 */
export const isTeamVerified = (team) => {
  if (!team) return false;
  if (team.isVerified === true) return true;
  const validPlayers = getValidTeamPlayers(team);
  if (validPlayers.length === 0) return false;
  return validPlayers.every(member => {
    const p = member && member.player !== undefined ? member.player : member;
    if (!p) return false;
    return !!(
      p?.userId?._id ||
      (typeof p?.userId === 'string' && p.userId) ||
      (p?.userId && typeof p.userId === 'object') ||
      p?.isClaimed ||
      p?.isVerified ||
      p?.verified
    );
  });
};

/**
 * Verified stamp badge component for teams (rosette check badge matching Cricheroes reference)
 */
export const TeamVerifiedBadge = ({ size = 16, style, top = -2, right = -2 }) => (
  <View
    style={[
      styles.badgeContainer,
      {
        top,
        right,
        borderRadius: size + 2,
      },
      style,
    ]}
  >
    <Icon name="check-decagram" size={size} color="#10B981" />
  </View>
);

const styles = StyleSheet.create({
  badgeContainer: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    padding: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    zIndex: 10,
  },
});
