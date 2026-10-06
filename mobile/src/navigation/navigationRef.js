import React from 'react';
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

let pendingDeepLinkUrl = null;

export const setPendingDeepLink = (url) => {
  if (url && typeof url === 'string') {
    pendingDeepLinkUrl = url;
    console.log('📌 [DeepLink] Saved pending deep link:', url);
  }
};

export const getPendingDeepLink = () => pendingDeepLinkUrl;

export const clearPendingDeepLink = () => {
  pendingDeepLinkUrl = null;
};

/**
 * Extracts entity type and ID from any supported ScoreVerse deep link format:
 * - https://scoreverse.in/match/:id
 * - https://www.scoreverse.in/match/:id
 * - scoreverse://match/:id
 * - https://scoreverse.in/team/:id
 * - https://scoreverse.in/player/:id
 * - https://scoreverse.in/tournament/:id
 * - https://scoreverse.in/turf/:id
 */
export const parseDeepLinkUrl = (url) => {
  if (!url || typeof url !== 'string') return null;

  try {
    const cleanUrl = url.split('?')[0].split('#')[0].trim();

    // 1. Match: match/:id or matches/:id
    const matchM = cleanUrl.match(/(?:match|matches)\/([a-zA-Z0-9_-]+)/i);
    if (matchM && matchM[1]) {
      return { type: 'match', id: matchM[1] };
    }

    // 2. Team: team/:id or teams/:id
    const teamM = cleanUrl.match(/(?:team|teams)\/([a-zA-Z0-9_-]+)/i);
    if (teamM && teamM[1]) {
      return { type: 'team', id: teamM[1] };
    }

    // 3. Player: player/:id or players/:id
    const playerM = cleanUrl.match(/(?:player|players)\/([a-zA-Z0-9_-]+)/i);
    if (playerM && playerM[1]) {
      return { type: 'player', id: playerM[1] };
    }

    // 4. Tournament: tournament/:id or tournaments/:id
    const tournM = cleanUrl.match(/(?:tournament|tournaments)\/([a-zA-Z0-9_-]+)/i);
    if (tournM && tournM[1]) {
      return { type: 'tournament', id: tournM[1] };
    }

    // 5. Turf: turf/:id or turfs/:id
    const turfM = cleanUrl.match(/(?:turf|turfs)\/([a-zA-Z0-9_-]+)/i);
    if (turfM && turfM[1]) {
      return { type: 'turf', id: turfM[1] };
    }
  } catch (err) {
    console.error('Error parsing deep link url:', err);
  }
  return null;
};

export const navigateToDeepLink = (url) => {
  if (!url) return false;
  const parsed = parseDeepLinkUrl(url);
  if (!parsed || !parsed.id) {
    console.log('⚠️ [DeepLink] Could not parse URL into known route:', url);
    return false;
  }

  const { type, id } = parsed;
  console.log(`🧭 [DeepLink] Routing to ${type} with ID ${id}`);

  if (!navigationRef.isReady()) {
    console.log('⏳ [DeepLink] navigationRef not ready yet, queuing pending link:', url);
    setPendingDeepLink(url);
    return false;
  }

  try {
    if (type === 'match') {
      try {
        navigationRef.navigate('Customer', {
          screen: 'My Cricket',
          params: {
            screen: 'MatchSummary',
            params: { id, matchId: id },
          },
        });
      } catch {
        navigationRef.navigate('MatchSummary', { id, matchId: id });
      }
      clearPendingDeepLink();
      return true;
    }

    if (type === 'team') {
      try {
        navigationRef.navigate('Customer', {
          screen: 'Home',
          params: {
            screen: 'TeamDetail',
            params: { id, teamId: id },
          },
        });
      } catch {
        navigationRef.navigate('TeamDetail', { id, teamId: id });
      }
      clearPendingDeepLink();
      return true;
    }

    if (type === 'player') {
      try {
        navigationRef.navigate('Customer', {
          screen: 'Home',
          params: {
            screen: 'PlayerDetail',
            params: { id, playerId: id },
          },
        });
      } catch {
        navigationRef.navigate('PlayerDetail', { id, playerId: id });
      }
      clearPendingDeepLink();
      return true;
    }

    if (type === 'tournament') {
      try {
        navigationRef.navigate('Customer', {
          screen: 'My Cricket',
          params: {
            screen: 'TournamentDetail',
            params: { id, tournamentId: id },
          },
        });
      } catch {
        navigationRef.navigate('TournamentDetail', { id, tournamentId: id });
      }
      clearPendingDeepLink();
      return true;
    }

    if (type === 'turf') {
      try {
        navigationRef.navigate('Customer', {
          screen: 'Home',
          params: {
            screen: 'TurfDetail',
            params: { id, turfId: id },
          },
        });
      } catch {
        navigationRef.navigate('TurfDetail', { id, turfId: id });
      }
      clearPendingDeepLink();
      return true;
    }
  } catch (err) {
    console.error('Failed to navigate to deep link:', err);
    setPendingDeepLink(url);
    return false;
  }

  return false;
};

export const checkAndExecutePendingDeepLink = () => {
  if (pendingDeepLinkUrl && navigationRef.isReady()) {
    const url = pendingDeepLinkUrl;
    console.log('🚀 [DeepLink] Executing pending deep link:', url);
    navigateToDeepLink(url);
  }
};

export const navigate = (name, params) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
};

export const goBack = () => {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
};

export const reset = (name, params) => {
  if (navigationRef.isReady()) {
    try {
      navigationRef.reset({ index: 0, routes: [{ name, params }] });
    } catch (e) {
      // Ignored if navigator is currently transitioning or remounting
    }
  }
};
