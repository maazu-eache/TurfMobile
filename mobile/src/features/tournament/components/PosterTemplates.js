import React from 'react';
import { View, Text, StyleSheet, Image, ImageBackground } from 'react-native';
import moment from 'moment';
import { Colors, Typography, BorderRadius, Spacing } from '../../../theme/theme';
import { getImageUrl } from '../../../api/axios';
import LinearGradient from 'react-native-linear-gradient';

const SPORTVERSE_LOGO = require('../../../../SportVerse.png');
const STADIUM_BG = { uri: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=100&auto=format&fit=crop' };
const getSource = (url) => url ? { uri: getImageUrl(url) } : SPORTVERSE_LOGO;

const getThemeStyles = (theme) => {
  switch (theme) {
    case 'Chrome': 
      return {
        bgColor: '#1A1C1E',
        textColor: '#E5E4E2',
        secTextColor: '#A9A9A9',
        accentColor: '#C0C0C0',
        borderColor: 'rgba(192, 192, 192, 0.4)',
        cardBg: 'rgba(255, 255, 255, 0.05)',
        badgeBg: 'rgba(192, 192, 192, 0.2)',
        overlayBg: 'rgba(26, 28, 30, 0.9)',
        type: 'liquid_metal',
      };
    case 'Cyber':
      return {
        bgColor: '#050511',
        textColor: '#FFFFFF',
        secTextColor: '#00FFFF',
        accentColor: '#FF0055',
        borderColor: '#FF0055',
        cardBg: 'rgba(255, 0, 85, 0.05)',
        badgeBg: 'rgba(0, 255, 255, 0.15)',
        overlayBg: 'rgba(5, 5, 17, 0.85)',
        type: 'cyberpunk',
      };
    case 'Aura':
      return {
        bgColor: '#160B29',
        textColor: '#FFFFFF',
        secTextColor: '#D0C4E8',
        accentColor: '#A855F7',
        borderColor: 'rgba(168, 85, 247, 0.4)',
        cardBg: 'rgba(255, 255, 255, 0.05)',
        badgeBg: 'rgba(168, 85, 247, 0.25)',
        overlayBg: 'rgba(22, 11, 41, 0.85)',
        type: 'aura',
      };
    case 'Drip':
      return {
        bgColor: '#000000',
        textColor: '#FFFFFF',
        secTextColor: '#A0A0A0',
        accentColor: '#F5A623',
        borderColor: '#333333',
        cardBg: '#222222',
        badgeBg: '#333333',
        overlayBg: 'rgba(26,26,26,0.92)',
        type: 'skeuo',
      };
    case 'Hype':
      return {
        bgColor: '#0F0C29',
        textColor: '#FFFFFF',
        secTextColor: '#D8B4FE',
        accentColor: '#00F2FE',
        borderColor: 'rgba(0, 242, 254, 0.6)',
        cardBg: 'rgba(255, 255, 255, 0.08)',
        badgeBg: 'rgba(0, 242, 254, 0.25)',
        overlayBg: 'rgba(15, 12, 41, 0.7)',
        type: 'liquid',
      };
    case 'Aesthetic':
    default:
      return {
        bgColor: Colors.background || '#0B192C',
        textColor: Colors.textPrimary || '#FFFFFF',
        secTextColor: Colors.textSecondary || '#94A3B8',
        accentColor: Colors.primary || '#9ABC2F',
        borderColor: 'rgba(255,255,255,0.25)',
        cardBg: 'rgba(255,255,255,0.08)',
        badgeBg: 'rgba(154, 188, 47, 0.2)',
        overlayBg: 'rgba(11,25,44,0.65)',
        type: 'glass',
      };
  }
};

const getContainerStyle = (t, baseWidth) => {
  let style = [styles.posterContainer, { width: baseWidth }];
  if (t.type === 'liquid_metal') {
    style.push({ borderRadius: 16, borderWidth: 1.5, borderColor: t.borderColor });
  } else if (t.type === 'cyberpunk') {
    style.push({ borderRadius: 0, borderWidth: 2, borderColor: t.borderColor, borderRightWidth: 6, borderBottomWidth: 6 });
  } else if (t.type === 'aura') {
    style.push({ borderRadius: 32, borderWidth: 1.5, borderColor: t.borderColor });
  } else if (t.type === 'liquid') {
    style.push({ borderRadius: 24, borderWidth: 1.5, borderColor: t.borderColor });
  } else if (t.type === 'skeuo') {
    style.push({ borderRadius: 8, borderWidth: 2, borderColor: '#333' });
  } else {
    style.push({ borderRadius: 16, borderWidth: 1, borderColor: t.borderColor });
  }
  return style;
};

const getCardStyle = (t) => {
  if (t.type === 'liquid_metal') {
    return { backgroundColor: t.cardBg, borderRadius: 12, borderWidth: 1, borderColor: t.borderColor, padding: Spacing.md };
  } else if (t.type === 'cyberpunk') {
    return { backgroundColor: t.cardBg, borderRadius: 0, borderWidth: 1, borderColor: t.secTextColor, borderLeftWidth: 4, padding: Spacing.md };
  } else if (t.type === 'aura') {
    return { backgroundColor: t.cardBg, borderRadius: 24, borderWidth: 1, borderColor: t.borderColor, padding: Spacing.md };
  } else if (t.type === 'liquid') {
    return { backgroundColor: t.cardBg, borderRadius: 20, borderWidth: 1.5, borderColor: t.borderColor, padding: Spacing.md };
  } else if (t.type === 'skeuo') {
    return { backgroundColor: t.cardBg, borderRadius: 6, borderWidth: 1, borderColor: '#333', padding: Spacing.md };
  } else {
    return { backgroundColor: t.cardBg, borderRadius: 8, borderWidth: 1, borderColor: t.borderColor, padding: Spacing.md };
  }
};

const getBadgeStyle = (t, isFirst) => {
  if (t.type === 'liquid_metal') {
    return { backgroundColor: isFirst ? t.badgeBg : 'transparent', borderRadius: 12, borderWidth: isFirst ? 1 : 0, borderColor: isFirst ? t.borderColor : 'transparent', padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' };
  } else if (t.type === 'cyberpunk') {
    return { backgroundColor: isFirst ? t.badgeBg : 'transparent', borderRadius: 0, borderWidth: 1, borderColor: isFirst ? t.accentColor : 'transparent', borderLeftWidth: isFirst ? 4 : 0, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' };
  } else if (t.type === 'aura') {
    return { backgroundColor: isFirst ? t.badgeBg : 'transparent', borderRadius: 24, borderWidth: isFirst ? 1 : 0, borderColor: isFirst ? t.accentColor : 'transparent', padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' };
  } else if (t.type === 'liquid') {
    return { backgroundColor: isFirst ? t.badgeBg : 'transparent', borderRadius: 20, borderWidth: isFirst ? 1.5 : 0, borderColor: isFirst ? t.accentColor : 'transparent', padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' };
  } else if (t.type === 'skeuo') {
    return { backgroundColor: isFirst ? '#333' : '#222', borderRadius: 6, borderWidth: isFirst ? 1 : 0, borderColor: '#555', padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' };
  } else {
    return { backgroundColor: isFirst ? t.badgeBg : 'transparent', borderRadius: 8, borderWidth: isFirst ? 1 : 0, borderColor: isFirst ? t.accentColor : 'transparent', padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' };
  }
};

export const TournamentSummaryPoster = ({ tournament, theme }) => {
  const t = getThemeStyles(theme);
  const bgImage = STADIUM_BG;
  
  return (
    <ImageBackground source={bgImage} style={getContainerStyle(t, 320)}>
      <View style={{ width: '100%', backgroundColor: t.overlayBg }}>
      <Image 
        source={{ uri: tournament?.banner ? getImageUrl(tournament.banner) : 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&auto=format&fit=crop' }}
        style={styles.posterBanner}
        resizeMode="cover"
        blurRadius={tournament?.banner ? 0 : 3}
      />
      <View style={styles.posterContent}>
        <Text style={[styles.posterTitle, { color: t.textColor }]}>{tournament?.name}</Text>
        <Text style={[styles.posterSubtitle, { color: t.secTextColor }]}>
          {tournament?.city} • {tournament?.overs} Overs Match
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: t.textColor }]}>{tournament?.registeredTeams?.length || 0}</Text>
            <Text style={[styles.statLabel, { color: t.secTextColor }]}>Teams</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: t.textColor }]}>{tournament?.matches?.length || 0}</Text>
            <Text style={[styles.statLabel, { color: t.secTextColor }]}>Matches</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: t.textColor }]}>{tournament?.groundType || 'Open'}</Text>
            <Text style={[styles.statLabel, { color: t.secTextColor }]}>Ground</Text>
          </View>
        </View>
      </View>
      <View style={[styles.footer, t.type === 'liquid_metal' && { borderTopColor: t.borderColor }]}>
        <Text style={[styles.footerText, { color: t.secTextColor }]}>Powered by Decolz Sports</Text>
      </View>
      </View>
    </ImageBackground>
  );
};

export const FixturePoster = ({ match, tournamentName, theme, tournamentBanner }) => {
  const t = getThemeStyles(theme);
  const bgImage = STADIUM_BG;
  
  return (
    <ImageBackground source={bgImage} style={getContainerStyle(t, 340)}>
      <View style={{ width: '100%', backgroundColor: t.overlayBg }}>
      <View style={{ padding: Spacing.lg, alignItems: 'center' }}>
        <Text style={{ color: t.accentColor, fontSize: 12, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', marginBottom: 4 }}>
          {tournamentName}
        </Text>
        <Text style={{ color: t.textColor, fontSize: 16, fontFamily: Typography.fontFamily.bold, marginBottom: Spacing.lg }}>
          {match?.stage || 'Group Stage'} • {match?.format?.toUpperCase() || 'MATCH'}
        </Text>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: Spacing.md }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Image source={{ uri: match?.teamA?.logo ? getImageUrl(match.teamA.logo) : SPORTVERSE_LOGO }} style={{ width: 60, height: 60, borderRadius: t.type === 'cyberpunk' ? 0 : 30, marginBottom: 8, borderWidth: t.type === 'cyberpunk' ? 2 : 2, borderColor: t.type === 'cyberpunk' ? t.secTextColor : t.borderColor }} />
            <Text style={{ color: t.textColor, fontFamily: Typography.fontFamily.bold, textAlign: 'center' }} numberOfLines={2}>{match?.teamA?.name}</Text>
          </View>
          
          <View style={{ alignItems: 'center', paddingHorizontal: Spacing.md }}>
            <Text style={{ color: t.accentColor, fontSize: 18, fontFamily: Typography.fontFamily.bold, fontStyle: 'italic' }}>VS</Text>
          </View>
          
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Image source={{ uri: match?.teamB?.logo ? getImageUrl(match.teamB.logo) : SPORTVERSE_LOGO }} style={{ width: 60, height: 60, borderRadius: t.type === 'cyberpunk' ? 0 : 30, marginBottom: 8, borderWidth: t.type === 'cyberpunk' ? 2 : 2, borderColor: t.type === 'cyberpunk' ? t.secTextColor : t.borderColor }} />
            <Text style={{ color: t.textColor, fontFamily: Typography.fontFamily.bold, textAlign: 'center' }} numberOfLines={2}>{match?.teamB?.name}</Text>
          </View>
        </View>

        <View style={[{ marginTop: Spacing.xl, width: '100%', alignItems: 'center' }, getCardStyle(t)]}>
          <Text style={{ color: t.secTextColor, fontFamily: Typography.fontFamily.medium, fontSize: 14 }}>
             Date: {new Date(match?.scheduledAt || match?.createdAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
          <Text style={{ color: t.textColor, fontFamily: Typography.fontFamily.bold, fontSize: 16, marginTop: 4 }}>
             Time: {new Date(match?.scheduledAt || match?.createdAt || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {match?.venue && (
            <Text style={{ color: t.secTextColor, fontFamily: Typography.fontFamily.regular, fontSize: 12, marginTop: 8 }}>
              📍 {match.venue}
            </Text>
          )}
        </View>
      </View>
      <View style={[styles.footer, t.type === 'liquid_metal' && { borderTopColor: t.borderColor }]}>
        <Text style={[styles.footerText, { color: t.secTextColor }]}>Powered by Decolz Sports</Text>
      </View>
      </View>
    </ImageBackground>
  );
};

export const PointsTablePoster = ({ pointsTable, tournamentName, groupName, theme, tournamentBanner }) => {
  const t = getThemeStyles(theme);
  const bgImage = STADIUM_BG;
  
  return (
    <ImageBackground source={bgImage} style={getContainerStyle(t, 360)}>
      <View style={{ width: '100%', backgroundColor: t.overlayBg }}>
      <View style={{ padding: Spacing.lg, paddingBottom: Spacing.sm, alignItems: 'center' }}>
        <Text style={{ color: t.accentColor, fontSize: 12, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', marginBottom: 4 }}>
          {tournamentName}
        </Text>
        <Text style={{ color: t.textColor, fontSize: 18, fontFamily: Typography.fontFamily.bold, marginBottom: 2 }}>
          Points Table
        </Text>
        {groupName && <Text style={{ color: t.secTextColor, fontSize: 14, fontFamily: Typography.fontFamily.medium, marginBottom: Spacing.sm }}>{groupName}</Text>}
      </View>

      <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg }}>
        {/* Header Row */}
        <View style={{ flexDirection: 'row', borderBottomWidth: t.type === 'cyberpunk' ? 2 : 1, borderBottomColor: t.type === 'cyberpunk' ? t.accentColor : t.borderColor, paddingVertical: 8 }}>
          <Text style={{ flex: 3, color: t.secTextColor, fontFamily: Typography.fontFamily.semiBold, fontSize: 12 }}>TEAM</Text>
          <Text style={{ flex: 1, color: t.secTextColor, fontFamily: Typography.fontFamily.semiBold, fontSize: 12, textAlign: 'center' }}>M</Text>
          <Text style={{ flex: 1, color: t.secTextColor, fontFamily: Typography.fontFamily.semiBold, fontSize: 12, textAlign: 'center' }}>W</Text>
          <Text style={{ flex: 1, color: t.secTextColor, fontFamily: Typography.fontFamily.semiBold, fontSize: 12, textAlign: 'center' }}>L</Text>
          <Text style={{ flex: 1, color: t.textColor, fontFamily: Typography.fontFamily.bold, fontSize: 12, textAlign: 'center' }}>PTS</Text>
          <Text style={{ flex: 1.5, color: t.secTextColor, fontFamily: Typography.fontFamily.semiBold, fontSize: 12, textAlign: 'center' }}>NRR</Text>
        </View>

        {/* Data Rows */}
        {(pointsTable || []).slice(0, 10).map((row, index) => (
          <View key={row.teamId?._id || index} style={{ flexDirection: 'row', borderBottomWidth: t.type === 'cyberpunk' ? 1 : 1, borderBottomColor: t.type === 'cyberpunk' ? t.secTextColor : t.borderColor, paddingVertical: 10, alignItems: 'center' }}>
            <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: t.secTextColor, fontSize: 12, width: 16, marginRight: 4 }}>{index + 1}</Text>
              <Image source={{ uri: row.teamId?.logo ? getImageUrl(row.teamId.logo) : SPORTVERSE_LOGO }} style={{ width: 20, height: 20, borderRadius: t.type === 'cyberpunk' ? 0 : 10, marginRight: 6 }} />
              <Text style={{ color: t.textColor, fontFamily: Typography.fontFamily.semiBold, fontSize: 12 }} numberOfLines={1}>{row.teamId?.name || 'Unknown'}</Text>
            </View>
            <Text style={{ flex: 1, color: t.secTextColor, fontFamily: Typography.fontFamily.regular, fontSize: 12, textAlign: 'center' }}>{row.played}</Text>
            <Text style={{ flex: 1, color: t.secTextColor, fontFamily: Typography.fontFamily.regular, fontSize: 12, textAlign: 'center' }}>{row.won}</Text>
            <Text style={{ flex: 1, color: t.secTextColor, fontFamily: Typography.fontFamily.regular, fontSize: 12, textAlign: 'center' }}>{row.lost}</Text>
            <Text style={{ flex: 1, color: t.textColor, fontFamily: Typography.fontFamily.bold, fontSize: 13, textAlign: 'center' }}>{row.points}</Text>
            <Text style={{ flex: 1.5, color: t.secTextColor, fontFamily: Typography.fontFamily.regular, fontSize: 11, textAlign: 'center' }}>{row.nrr ? parseFloat(row.nrr).toFixed(3) : '0.000'}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.footer, t.type === 'liquid_metal' && { borderTopColor: t.borderColor }]}>
        <Text style={[styles.footerText, { color: t.secTextColor }]}>Powered by Decolz Sports</Text>
      </View>
      </View>
    </ImageBackground>
  );
};

export const LeaderboardPoster = ({ type, data, tournamentName, theme, tournamentBanner }) => {
  const t = getThemeStyles(theme);
  const bgImage = tournamentBanner ? { uri: getImageUrl(tournamentBanner) } : STADIUM_BG;
  
  const getTitle = () => {
    switch(type) {
      case 'runs': return 'Most Runs';
      case 'wickets': return 'Most Wickets';
      case 'sixes': return 'Most Sixes';
      case 'fours': return 'Most Fours';
      case 'strikeRate': return 'Highest Strike Rate';
      case 'economy': return 'Best Economy';
      case 'catches': return 'Best Fielders';
      case 'mvp': return 'MVP Rankings';
      default: return 'Leaderboard';
    }
  };

  const getValueKey = () => {
    switch(type) {
      case 'runs': return 'runs';
      case 'wickets': return 'wickets';
      case 'sixes': return 'sixes';
      case 'fours': return 'fours';
      case 'strikeRate': return 'strikeRate';
      case 'economy': return 'economy';
      case 'catches': return 'dismissals';
      case 'mvp': return 'points';
      default: return 'value';
    }
  };
  
  return (
    <ImageBackground source={bgImage} style={getContainerStyle(t, 340)}>
      <View style={{ width: '100%', backgroundColor: t.overlayBg }}>
      <View style={{ padding: Spacing.lg, paddingBottom: Spacing.md, alignItems: 'center' }}>
        <Text style={{ color: t.accentColor, fontSize: 12, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', marginBottom: 4 }}>
          {tournamentName}
        </Text>
        <Text style={{ color: t.textColor, fontSize: 20, fontFamily: Typography.fontFamily.bold, marginBottom: 2 }}>
          {getTitle()}
        </Text>
      </View>

      <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg }}>
        {(data || []).slice(0, 5).map((player, index) => (
          <View key={player.player?._id || index} style={getBadgeStyle(t, index === 0)}>
            <Text style={{ color: index === 0 ? t.accentColor : t.secTextColor, fontSize: 16, fontFamily: Typography.fontFamily.bold, width: 24 }}>
              #{index + 1}
            </Text>
            <Image source={{ uri: player.player?.avatar ? getImageUrl(player.player.avatar) : 'https://via.placeholder.com/40' }} style={{ width: 40, height: 40, borderRadius: t.type === 'cyberpunk' ? 0 : 20, marginRight: 12, borderWidth: t.type === 'cyberpunk' ? 1 : 0, borderColor: t.secTextColor }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.textColor, fontFamily: Typography.fontFamily.bold, fontSize: 14 }}>{player.player?.name || 'Player'}</Text>
              <Text style={{ color: t.secTextColor, fontFamily: Typography.fontFamily.medium, fontSize: 11, marginTop: 2 }}>
                {player.teamName || 'Unknown Team'} • {player.matches} Mat
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: t.textColor, fontFamily: Typography.fontFamily.bold, fontSize: 18 }}>
                {type === 'economy' || type === 'strikeRate' ? parseFloat(player[getValueKey()]).toFixed(2) : player[getValueKey()]}
              </Text>
              <Text style={{ color: t.secTextColor, fontFamily: Typography.fontFamily.regular, fontSize: 10 }}>
                {type === 'runs' ? 'Runs' : type === 'wickets' ? 'Wickets' : type === 'economy' ? 'Econ' : type === 'strikeRate' ? 'SR' : type === 'catches' ? 'Dismissals' : type === 'mvp' ? 'Pts' : type}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.footer, t.type === 'liquid_metal' && { borderTopColor: t.borderColor }]}>
        <Text style={[styles.footerText, { color: t.secTextColor }]}>Powered by Decolz Sports</Text>
      </View>
      </View>
    </ImageBackground>
  );
};

export const FullSchedulePoster = ({ matches, tournamentName, theme, tournamentBanner, pageInfo }) => {
  const t = getThemeStyles(theme);
  const bgImage = STADIUM_BG;
  // If pageInfo is present, render all passed matches, otherwise limit to 7
  const displayMatches = pageInfo ? (matches || []) : (matches || []).slice(0, 7);
  const totalMatchesCount = pageInfo?.totalMatches || matches?.length || 0;
  
  return (
    <ImageBackground source={bgImage} style={getContainerStyle(t, 350)}>
      <View style={{ width: '100%', backgroundColor: t.overlayBg }}>
      <View style={{ padding: Spacing.lg, paddingBottom: Spacing.xs, alignItems: 'center' }}>
        <Text style={{ color: t.accentColor, fontSize: 11, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
          {tournamentName || 'TOURNAMENT FIXTURES'}
        </Text>
        <Text style={{ color: t.textColor, fontSize: 20, fontFamily: Typography.fontFamily.bold, marginBottom: 2 }}>
          Match Schedule
        </Text>
        <Text style={{ color: t.secTextColor, fontSize: 12, fontFamily: Typography.fontFamily.medium, marginBottom: Spacing.sm }}>
          Total Fixtures: {totalMatchesCount}
        </Text>
        {pageInfo && (
          <View style={{ backgroundColor: t.badgeBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 4 }}>
            <Text style={{ color: t.textColor, fontSize: 10, fontFamily: Typography.fontFamily.bold }}>
              PAGE {pageInfo.current} OF {pageInfo.total}
            </Text>
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.md }}>
        {displayMatches.map((m, idx) => (
          <View key={m._id || idx} style={[getCardStyle(t), { marginBottom: 8, padding: 0, overflow: 'hidden' }]}>
            {/* Split Background Images */}
            <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, flexDirection: 'row', backgroundColor: '#050505' }}>
              <View style={{ flex: 1, position: 'relative' }}>
                <Image 
                  source={getSource(m.teamA?.logo)} 
                  style={{ width: '100%', height: '100%', opacity: 0.55 }} 
                  resizeMode="cover" 
                />
                <LinearGradient 
                  colors={['transparent', '#050505']} 
                  start={{ x: 0.3, y: 0 }} 
                  end={{ x: 1, y: 0 }} 
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
                />
              </View>
              <View style={{ flex: 1, position: 'relative' }}>
                <Image 
                  source={getSource(m.teamB?.logo)} 
                  style={{ width: '100%', height: '100%', opacity: 0.55 }} 
                  resizeMode="cover" 
                />
                <LinearGradient 
                  colors={['#050505', 'transparent']} 
                  start={{ x: 0, y: 0 }} 
                  end={{ x: 0.7, y: 0 }} 
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
                />
              </View>
            </View>

            {/* Content Container */}
            <View style={{ padding: Spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: t.accentColor, fontSize: 10, fontFamily: Typography.fontFamily.bold, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>
                  MATCH {idx + 1} • {m.format?.toUpperCase() || 'CUSTOM'}
                </Text>
                <Text style={{ color: '#E2E8F0', fontSize: 10, fontFamily: Typography.fontFamily.medium, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>
                  {moment(m.scheduledAt || m.createdAt).format('DD MMM, hh:mm A')}
                </Text>
              </View>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontFamily: Typography.fontFamily.bold, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }} numberOfLines={1}>
                    {m.teamA?.name || 'Team A'}
                  </Text>
                </View>

                <Text style={{ color: t.accentColor, fontSize: 12, fontFamily: Typography.fontFamily.bold, marginHorizontal: 12, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>
                  VS
                </Text>

                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontFamily: Typography.fontFamily.bold, textAlign: 'right', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }} numberOfLines={1}>
                    {m.teamB?.name || 'Team B'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.footer, t.type === 'liquid_metal' && { borderTopColor: t.borderColor }]}>
        <Text style={[styles.footerText, { color: t.secTextColor }]}>Powered by Decolz Sports</Text>
      </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  posterContainer: {
    overflow: 'hidden',
  },
  posterBanner: {
    width: '100%',
    height: 160,
  },
  posterContent: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  posterTitle: {
    fontSize: 24,
    fontFamily: Typography.fontFamily.bold,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  posterSubtitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: Spacing.md,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    marginTop: 2,
  },
  footer: {
    padding: Spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  footerText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  }
});
