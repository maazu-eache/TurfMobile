import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import LocationAutocomplete from '../../../components/LocationAutocomplete';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Modal, Platform, StatusBar,
  FlatList, Image, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyPlayer, updatePlayerProfile, fetchMatchHistory } from '../playerSlice';
import { useTheme, Typography, Spacing, BorderRadius, Colors } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import api, { getImageUrl } from '../../../api/axios';
import LinearGradient from 'react-native-linear-gradient';
import { getPlayerTags } from '../../../utils/playerTags';
import SharePreviewModal from '../../tournament/components/SharePreviewModal';
import { PlayerProfilePoster } from '../../tournament/components/PosterTemplates';

const OUTDOOR_GROUND = require('../../../ground.png');
const INDOOR_GROUND = require('../../../turf.png');
const BallTypeImages = {
  'Tennis': require('../../../../Tennis.jpeg'),
  'Leather': require('../../../../Leather.jpeg'),
  'Rubber': require('../../../../Others.jpeg'),
  'Tape Ball': require('../../../../Others.jpeg'),
  'Other': require('../../../../Others.jpeg'),
  'Others': require('../../../../Others.jpeg'),
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ROLES = ['Batsman', 'Bowler', 'All Rounder', 'Wicket Keeper', 'Wicket Keeper Batsman'];
const BATTING_STYLES = ['Right Hand', 'Left Hand'];
const BATTING_ORDERS = ['Top Order', 'Middle Order', 'Lower Order', 'Tailender'];
const BOWLING_STYLES = ['Right Arm Fast', 'Right Arm Medium', 'Right Arm Off Spin', 'Right Arm Leg Spin', 'Left Arm Fast', 'Left Arm Medium', 'Left Arm Orthodox', 'Left Arm Wrist Spin', 'None'];
const GENDERS = ['Male', 'Female', 'Other'];
const BALL_TYPES = ['Overall', 'Tennis', 'Leather', 'Other'];
const STAT_TABS = ['Statistics', 'Matches', 'Analytics', 'Achievements', 'Awards'];

// ─── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background,
  },
  
  // Floating nav bar
  navBarAbsolute: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    zIndex: 20,
  },
  navBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    height: 52,
  },
  navBackBtn: { 
    width: 38, 
    height: 38, 
    borderRadius: 19, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  navShareBtn: { 
    width: 38, 
    height: 38, 
    borderRadius: 19, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    alignItems: 'center', 
    justifyContent: 'center',
  },

  scrollContent: { 
    paddingBottom: 50,
  },

  // Hero Banner — full-bleed photo + gradient
  heroBanner: {
    width: '100%',
    height: Dimensions.get('window').height * 0.36,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  heroBgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  heroBgFallback: {
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBgFallbackLetter: {
    fontSize: 80,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
    opacity: 0.4,
  },
  heroBannerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  heroOverlayContent: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 2,
  },
  heroName: {
    fontSize: 26,
    fontFamily: Typography.fontFamily.bold,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
    textAlign: 'left',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 6,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroRoleHighlight: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
    letterSpacing: 0.2,
  },
  heroMetaDot: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  heroMetaText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: '#E0E0E0',
  },
  heroTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 7,
  },
  heroTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 204, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.4)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  heroTagBadgeText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  heroLocationText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: 'rgba(255, 255, 255, 0.85)',
  },

  // Tag Definition Modal
  tagModalOverlay: {
    flex: 1,
    backgroundColor: colors.blackAlpha50,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  tagModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.lg,
  },
  tagModalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.primaryAlpha30,
  },
  tagModalTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  tagModalDesc: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  tagModalCloseBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 16,
  },
  tagModalCloseBtnText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textOnPrimary,
  },

  // Card
  card: { 
    backgroundColor: colors.surface, 
    borderRadius: 14, 
    padding: 18, 
    borderWidth: 1, 
    borderColor: colors.border, 
    marginBottom: 14,
    ...(isDark ? {} : shadows.sm),
  },
  profileHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatarWrap: { width: 68, height: 68, borderRadius: 34, position: 'relative', borderWidth: 2, borderColor: colors.primary },
  avatarImg: { width: '100%', height: '100%', borderRadius: 34 },
  avatarFb: { width: '100%', height: '100%', borderRadius: 34, backgroundColor: colors.primaryAlpha10, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 24, fontFamily: Typography.fontFamily.bold, color: colors.primary },
  avatarEditBadge: { position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  profileHeaderInfo: { flex: 1, justifyContent: 'center' },
  profileRoleTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cardTitle: { fontSize: 22, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary, marginBottom: 14 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 5 },
  infoRowLeft: { flexDirection: 'row', alignItems: 'center' },
  infoIcon: { marginRight: 10 },
  infoLabel: { fontSize: 13, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary },
  infoValue: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },

  // Social counts
  socialCountsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 12 },
  socialCountItem: { flex: 1, alignItems: 'center' },
  socialCountVal: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  socialCountLbl: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary, marginTop: 2 },
  socialDivider: { width: 1, height: 20, backgroundColor: colors.border },

  // Stats section
  statsSection: { marginBottom: 30 },
  statsSectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  statsSectionAccent: { width: 3, height: 20, borderRadius: 2, backgroundColor: colors.primary, marginRight: 8 },
  statsSectionTitle: { fontSize: 17, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },

  // Quick summary
  quickSummaryRow: { 
    flexDirection: 'row', 
    backgroundColor: colors.surface, 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: colors.border, 
    marginBottom: 14, 
    overflow: 'hidden',
    ...(isDark ? {} : shadows.sm),
  },
  quickSummaryItem: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  quickSummaryVal: { fontSize: 18, fontFamily: Typography.fontFamily.bold },
  quickSummaryLbl: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary, marginTop: 3 },

  // Tab bar
  statTabsRow: { paddingBottom: 4, marginBottom: 10 },
  statTab: { paddingHorizontal: 14, paddingVertical: 10, marginRight: 4, alignItems: 'center', position: 'relative' },
  statTabText: { fontSize: 13, fontFamily: Typography.fontFamily.semiBold, color: colors.textSecondary },
  statTabTextActive: { color: colors.primary, fontFamily: Typography.fontFamily.bold },
  statTabUnderline: { position: 'absolute', bottom: 0, left: 8, right: 8, height: 2, backgroundColor: colors.primary, borderRadius: 1 },

  // Ball type filter
  filterSection: {
    marginVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingTop: 12,
    paddingBottom: 4,
    ...(isDark ? {} : shadows.sm),
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  filterIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: colors.primaryAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryAlpha20,
  },
  filterHeaderText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textTertiary,
    letterSpacing: 1.2,
  },
  filterScrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 12,
    alignItems: 'center',
  },
  filterPillCircular: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  filterPillCircularActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  filterPillCircularImage: {
    width: '100%',
    height: '100%',
  },

  // Stats cards
  statsCard: { 
    backgroundColor: colors.surface, 
    borderRadius: 16, 
    padding: 14, 
    borderWidth: 1, 
    borderColor: colors.border, 
    marginBottom: 12,
    ...(isDark ? {} : shadows.sm),
  },

  // Section heading
  sectionHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionHeadingBar: { width: 3, height: 14, borderRadius: 2, marginRight: 7 },
  sectionHeadingText: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },

  // Stat grid
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  statTile: {
    width: (SCREEN_WIDTH - 32 - 28 - 42) / 5,
    minWidth: 52,
    paddingVertical: 9,
    paddingHorizontal: 2,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  statTileValue: { fontSize: 14, fontFamily: Typography.fontFamily.bold },
  statTileLabel: { fontSize: 9, fontFamily: Typography.fontFamily.medium, marginTop: 3, textAlign: 'center' },

  // Fielding
  fieldingRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  fieldingBox: { 
    flex: 1, 
    alignItems: 'center', 
    paddingVertical: 12, 
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : colors.surfaceVariant, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: colors.border 
  },
  fieldingVal: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginTop: 5 },
  fieldingLbl: { fontSize: 9, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary, marginTop: 2 },

  // Wagon Wheel
  wwOuter: { alignItems: 'center', paddingVertical: 10, position: 'relative' },
  wwCircleWrap: { overflow: 'hidden', backgroundColor: '#0B231E', borderWidth: 2, position: 'relative' },
  wwGroundImage: { width: '100%', height: '100%', position: 'absolute' },
  wwOverlay: { position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.3)' },
  wwLoadingWrap: { alignItems: 'center', justifyContent: 'center', zIndex: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 15, borderRadius: 12 },
  wwLoadingText: { fontSize: 12, fontFamily: Typography.fontFamily.medium, marginTop: 8 },
  wwLegendRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 16 },
  wwLegendItem: { flexDirection: 'row', alignItems: 'center' },
  wwLegendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  wwLegendText: { fontSize: 11, fontFamily: Typography.fontFamily.medium },
  wwTotalText: { fontSize: 10, marginTop: 10, fontFamily: Typography.fontFamily.regular },
  wwToggleRow: { flexDirection: 'row', backgroundColor: colors.surfaceVariant, borderRadius: 6, padding: 2 },
  wwToggleBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  wwToggleBtnActive: { backgroundColor: colors.primary },
  wwToggleText: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary },
  wwToggleTextActive: { color: colors.textOnPrimary, fontFamily: Typography.fontFamily.bold },

  // Achievements
  achieveGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  achieveBadge: {
    width: '48%', 
    marginBottom: 12,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  achieveIconWrap: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  achieveTitle: { fontSize: 11, fontFamily: Typography.fontFamily.bold, textAlign: 'center', marginBottom: 3 },
  achieveDesc: { fontSize: 10, fontFamily: Typography.fontFamily.regular, textAlign: 'center', lineHeight: 13 },
  achieveLock: { position: 'absolute', top: 8, right: 8 },

  // Awards
  awardsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  awardCard: { width: '48%', marginBottom: 12, borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  awardGradient: { padding: 16, alignItems: 'center' },
  awardIconCircle: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  awardCount: { fontSize: 28, fontFamily: Typography.fontFamily.bold, lineHeight: 32 },
  awardTitle: { fontSize: 11, fontFamily: Typography.fontFamily.bold, textAlign: 'center', marginTop: 4 },
  awardSub: { fontSize: 10, marginTop: 2 },

  // Career bests
  bestPerfRow: { flexDirection: 'row', alignItems: 'center' },
  bestPerfItem: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  bestPerfDivider: { width: 1, height: 36, backgroundColor: colors.border },
  bestPerfLabel: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary, marginBottom: 4 },
  bestPerfValue: { fontSize: 18, fontFamily: Typography.fontFamily.bold },

  // Edit modal
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDark ? colors.backgroundCard : colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 17, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  modalSaveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnText: { color: colors.textOnPrimary, fontSize: 13, fontFamily: Typography.fontFamily.bold },
  modalScrollContent: { padding: 16, paddingBottom: 40 },
  formSection: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    ...(isDark ? {} : shadows.sm),
  },
  formSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  formSectionAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginRight: 8,
  },
  formSectionTitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  fieldContainer: { marginBottom: 14 },
  label: { color: colors.textSecondary, fontSize: 13, marginBottom: 6, fontFamily: Typography.fontFamily.medium },
  input: {
    backgroundColor: isDark ? colors.background : colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: Typography.fontFamily.regular,
  },
  dropdownBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownBtnText: { fontFamily: Typography.fontFamily.regular, fontSize: 14 },
  locationInputBox: {
    backgroundColor: isDark ? colors.background : colors.surfaceVariant,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 46,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', borderRadius: 10, padding: 10, borderWidth: 1, ...shadows.lg },
  modalItem: { paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1 },
  modalItemText: { fontSize: 16, fontFamily: Typography.fontFamily.regular },
  modalItemTextActive: { fontFamily: Typography.fontFamily.bold },

  // Social modal
  socialModalOverlay: { flex: 1, backgroundColor: colors.blackAlpha50, justifyContent: 'flex-end' },
  socialModalSheet: { 
    backgroundColor: colors.surface, 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    padding: 20, 
    paddingBottom: 32, 
    maxHeight: '85%', 
    borderTopWidth: 1, 
    borderColor: colors.border,
    ...shadows.lg,
  },
  socialModalHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  socialModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  socialModalTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  socialEmptyList: { alignItems: 'center', paddingVertical: 40 },
  socialEmptyText: { marginTop: 10, fontSize: 14, color: colors.textTertiary },
  socialItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  socialItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  socialAvatar: { width: 40, height: 40, borderRadius: 20 },
  socialAvatarPlaceholder: { backgroundColor: colors.primaryAlpha10, justifyContent: 'center', alignItems: 'center' },
  socialName: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  socialRole: { fontSize: 12, fontFamily: Typography.fontFamily.regular, color: colors.textSecondary, marginTop: 1 },
  socialActionBtn: { borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.errorLight },
  socialActionBtnText: { fontSize: 12, fontFamily: Typography.fontFamily.semiBold, color: colors.error },

  // Matches Tab cards and badges
  tabCenteredEmpty: { alignItems: 'center', paddingVertical: 64 },
  emptyText: { marginTop: 14, fontSize: 14, color: colors.textTertiary, fontFamily: Typography.fontFamily.medium },
  matchCard: { 
    marginHorizontal: 2, 
    marginBottom: 10, 
    padding: 14, 
    backgroundColor: colors.surface, 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: colors.border, 
    flexDirection: 'row', 
    alignItems: 'center',
    ...(isDark ? {} : shadows.sm),
  },
  matchCardLive: { borderColor: colors.primaryAlpha30 },
  matchCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : colors.borderLight, paddingBottom: 8, marginBottom: 10 },
  matchTeamsText: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  matchCardBody: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  matchCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : colors.borderLight, paddingTop: 8 },
  matchStatusText: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary, flex: 1 },
  matchRunsValue: { fontSize: 22, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  matchRunsLabel: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: colors.textSecondary, marginTop: 2 },
  matchDNB: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: colors.textTertiary, fontStyle: 'italic' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 71, 87, 0.15)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255, 71, 87, 0.3)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF4757', marginRight: 5 },
  liveText: { color: '#FF4757', fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 },
  matchDate: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: colors.textTertiary },
  matchBallTypeBadge: { backgroundColor: colors.primaryAlpha10, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.primaryAlpha20 },
  matchBallTypeBadgeText: { fontSize: 10, fontFamily: Typography.fontFamily.bold, color: colors.primary },
});

const useProfileStyles = () => {
  const { colors, shadows, isDark } = useTheme();
  return {
    styles: useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]),
    colors,
    shadows,
    isDark,
  };
};

// ─── Dropdown ────────────────────────────────────────────────────────────────
const Dropdown = ({ label, value, options, onSelect }) => {
  const { styles, colors, isDark } = useProfileStyles();
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.fieldContainer}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TouchableOpacity 
        style={[
          styles.dropdownBtn, 
          { backgroundColor: isDark ? colors.background : colors.surfaceVariant, borderColor: colors.border }
        ]} 
        onPress={() => setVisible(true)}
      >
        <Text style={[styles.dropdownBtnText, { color: value ? colors.textPrimary : colors.textTertiary }]}>
          {value || 'Select ' + label}
        </Text>
        <Icon name="chevron-down" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={[styles.modalOverlay, { backgroundColor: colors.blackAlpha50 }]} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={{ maxHeight: 300 }}>
              {options.map(opt => (
                <TouchableOpacity 
                  key={opt} 
                  style={[styles.modalItem, { borderBottomColor: colors.border }]} 
                  onPress={() => { onSelect(opt); setVisible(false); }}
                >
                  <Text style={[styles.modalItemText, { color: value === opt ? colors.primary : colors.textPrimary }, value === opt && styles.modalItemTextActive]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </KeyboardAwareScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ─── Stat Tile ───────────────────────────────────────────────────────────────
const StatTile = ({ value, label, accent, flex }) => {
  const { styles, colors, isDark } = useProfileStyles();
  return (
    <View style={[
      styles.statTile, 
      { 
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : colors.surfaceVariant,
        borderColor: colors.border,
      },
      flex ? { flex, width: 'auto' } : {}
    ]}>
      <Text style={[styles.statTileValue, { color: accent || colors.textPrimary }]}>{value ?? '-'}</Text>
      <Text style={[styles.statTileLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
};

// ─── Section Heading ─────────────────────────────────────────────────────────
const SectionHeading = ({ icon, title, color }) => {
  const { styles, colors } = useProfileStyles();
  const themeColor = color || colors.primary;
  return (
    <View style={styles.sectionHeading}>
      <View style={[styles.sectionHeadingBar, { backgroundColor: themeColor }]} />
      <MCIcon name={icon} size={14} color={themeColor} style={{ marginRight: 6 }} />
      <Text style={[styles.sectionHeadingText, { color: colors.textPrimary }]}>{title}</Text>
    </View>
  );
};

// ─── Real Wagon Wheel ─────────────────────────────────────────────────────────
const WW_SIZE = SCREEN_WIDTH - 32 - 28;
const WW_CENTER = WW_SIZE / 2;
const WW_RADIUS = WW_SIZE / 2;

const getShotColor = (shot, primaryColor) => {
  if (shot.isSix) return '#FF5722';
  if (shot.isBoundary) return '#4CAF50';
  if (shot.runs >= 3) return '#29B6F6';
  if (shot.runs === 2) return '#AB47BC';
  if (shot.runs === 1) return primaryColor;
  return 'rgba(255,255,255,0.35)';
};

const RealWagonWheel = ({ shots, groundType, loading }) => {
  const { styles, colors } = useProfileStyles();
  const isTurf = groundType === 'indoor';
  const groundImg = isTurf ? INDOOR_GROUND : OUTDOOR_GROUND;
  const filteredShots = shots.filter(s =>
    groundType === 'all' ? true : s.groundType === groundType
  );

  const sixCount = filteredShots.filter(s => s.isSix).length;
  const fourCount = filteredShots.filter(s => s.isBoundary).length;
  const dotCount = filteredShots.filter(s => s.runs === 0).length;
  const totalShots = filteredShots.length;

  const WW_W = isTurf ? Math.min(WW_SIZE * 0.75, 220) : WW_SIZE;
  const WW_H = isTurf ? Math.min(WW_SIZE * 1.2, 360) : WW_SIZE;
  const CX = WW_W / 2;
  const CY = WW_H / 2;
  const CY_ACTUAL = CY - (isTurf ? WW_H * (60 / 360) : WW_H * (40 / 300));

  return (
    <View style={styles.wwOuter}>
      <View style={[styles.wwCircleWrap, { width: WW_W, height: WW_H, borderRadius: isTurf ? 16 : WW_W / 2, borderColor: `${colors.primary}40` }]}>
        <Image source={groundImg} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: WW_W, height: WW_H }} resizeMode="cover" />
        <View style={styles.wwOverlay} />

        <Text style={{ position: 'absolute', top: 20, left: CX - 30, width: 60, textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 'bold' }}>BEHIND</Text>
        <Text style={{ position: 'absolute', bottom: 20, left: CX - 40, width: 80, textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 'bold' }}>STRAIGHT</Text>
        <Text style={{ position: 'absolute', right: 20, top: CY_ACTUAL - 8, color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 'bold' }}>LEG</Text>
        <Text style={{ position: 'absolute', left: 20, top: CY_ACTUAL - 8, color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 'bold' }}>OFF</Text>

        <View style={{ position: 'absolute', left: CX - 4, top: CY_ACTUAL - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: 'red' }} />

        {loading ? (
          <View style={styles.wwLoadingWrap}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[styles.wwLoadingText, { color: colors.textSecondary }]}>Loading shots...</Text>
          </View>
        ) : filteredShots.length === 0 ? (
          <View style={styles.wwLoadingWrap}>
            <MCIcon name="cricket" size={32} color={`${colors.primary}80`} />
            <Text style={[styles.wwLoadingText, { color: colors.textSecondary }]}>No wagon wheel data yet</Text>
            <Text style={[styles.wwLoadingText, { fontSize: 10, marginTop: 4, color: colors.textTertiary }]}>Scorer must record shot direction</Text>
          </View>
        ) : (
          filteredShots.map((shot, i) => {
            const scaleFactor = WW_W / (isTurf ? 220 : 300);
            const distance = (isTurf ? shot.distance * 1.5 : shot.distance) * scaleFactor;
            const color = getShotColor(shot, colors.primary);
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: CX - distance,
                  top: CY_ACTUAL - 2,
                  width: distance * 2,
                  height: 1.5,
                  justifyContent: 'center',
                  alignItems: 'flex-end',
                  transform: [{ rotate: `${shot.angle}deg` }],
                  opacity: shot.isBoundary || shot.isSix ? 0.9 : 0.65,
                }}>
                <View style={{ width: distance, height: 1.5, backgroundColor: color }} />
              </View>
            );
          })
        )}
      </View>

      {totalShots > 0 && (
        <View style={styles.wwLegendRow}>
          {[
            { color: '#FF5722', label: `6s (${sixCount})` },
            { color: '#4CAF50', label: `4s (${fourCount})` },
            { color: colors.primary, label: `Singles` },
            { color: 'rgba(255,255,255,0.4)', label: `Dots (${dotCount})` },
          ].map(l => (
            <View key={l.label} style={styles.wwLegendItem}>
              <View style={[styles.wwLegendDot, { backgroundColor: l.color }]} />
              <Text style={[styles.wwLegendText, { color: colors.textSecondary }]}>{l.label}</Text>
            </View>
          ))}
        </View>
      )}
      {totalShots > 0 && (
        <Text style={[styles.wwTotalText, { color: colors.textTertiary }]}>{totalShots} shots recorded</Text>
      )}
    </View>
  );
};

// ─── Achievement Badge ────────────────────────────────────────────────────────
const AchievementBadge = ({ icon, color, title, desc, earned, timesEarned }) => {
  const { styles, colors, isDark, shadows } = useProfileStyles();
  const badgeColor = color || colors.primary;
  return (
    <View style={[
      styles.achieveBadge, 
      {
        backgroundColor: isDark ? colors.backgroundElevated : colors.surface,
        borderColor: colors.border,
        ...(isDark ? {} : shadows.sm),
      },
      !earned && { opacity: 0.45 }
    ]}>
      <View style={[styles.achieveIconWrap, { backgroundColor: earned ? `${badgeColor}20` : (isDark ? 'rgba(255,255,255,0.04)' : colors.surfaceVariant) }]}>
        <MCIcon name={icon} size={26} color={earned ? badgeColor : colors.textTertiary} />
      </View>
      <Text style={[styles.achieveTitle, { color: earned ? colors.textPrimary : colors.textTertiary }]}>{title}</Text>
      <Text style={[styles.achieveDesc, { color: colors.textSecondary }]}>{desc}</Text>
      {earned && timesEarned > 0 && (
        <Text style={[styles.achieveDesc, { color: colors.primary, marginTop: 4, fontFamily: Typography.fontFamily.semiBold }]}>
          Awarded {timesEarned} times
        </Text>
      )}
      {!earned && (
        <View style={styles.achieveLock}>
          <MCIcon name="lock" size={10} color={colors.textTertiary} />
        </View>
      )}
    </View>
  );
};

// ─── Award Card ───────────────────────────────────────────────────────────────
const AwardCard = ({ icon, color, title, count, matches }) => {
  const { styles, colors, isDark, shadows } = useProfileStyles();
  const awardColor = color || colors.primary;
  return (
    <View style={[
      styles.awardCard, 
      { 
        backgroundColor: isDark ? colors.backgroundCard : colors.surface,
        borderColor: isDark ? `${awardColor}30` : colors.border,
        ...(isDark ? {} : shadows.sm),
      }
    ]}>
      <LinearGradient colors={[`${awardColor}15`, 'transparent']} style={styles.awardGradient}>
        <View style={[styles.awardIconCircle, { backgroundColor: `${awardColor}20` }]}>
          <MCIcon name={icon} size={20} color={awardColor} />
        </View>
        <Text style={[styles.awardCount, { color: awardColor }]}>{count}</Text>
        <Text style={[styles.awardTitle, { color: colors.textPrimary }]}>{title}</Text>
        {count > 0 && <Text style={[styles.awardSub, { color: colors.textSecondary }]}>Awarded {count} times</Text>}
      </LinearGradient>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const PlayerProfileScreen = ({ navigation }) => {
  const { styles, colors, shadows, isDark } = useProfileStyles();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { user } = useSelector(state => state.auth);
  const matchHistory = useSelector(state => state.player.matchHistory || []);
  const { myProfile, isLoading } = useSelector(state => state.player);

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [form, setForm] = useState({
    name: '', mobile: '', email: '', location: '', dob: '',
    gender: 'Male', playingRole: 'Batsman', battingStyle: 'Right Hand',
    battingOrder: 'Top Order', bowlingStyle: 'Right Arm Fast',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [socialModalVisible, setSocialModalVisible] = useState(false);
  const [socialType, setSocialType] = useState('followers');
  const [socialList, setSocialList] = useState([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [selectedTagDefinition, setSelectedTagDefinition] = useState(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [imgErrors, setImgErrors] = useState({});
  const [activeStatTab, setActiveStatTab] = useState('Statistics');
  const [scoringWindowOffset, setScoringWindowOffset] = useState(0); // 0 = show latest 7
  const [activeBallType, setActiveBallType] = useState('Overall');
  const [wwGroundType, setWwGroundType] = useState('outdoor'); // 'outdoor' | 'indoor'
  const [wagonWheelData, setWagonWheelData] = useState({ shots: [], totalShots: 0 });
  const [wwLoading, setWwLoading] = useState(false);

  const loadSocialList = async (type) => {
    if (!myProfile) return;
    setSocialType(type);
    setSocialModalVisible(true);
    setSocialLoading(true);
    try {
      const res = await api.get(`/players/${myProfile._id}/${type}`);
      setSocialList(res.data.data || []);
    } catch {
      showCustomAlert('Error', 'Failed to load list');
    } finally {
      setSocialLoading(false);
    }
  };

  const handleRemoveFollower = (followerId, followerName) => {
    showCustomAlert(
      'Remove Follower',
      `Remove ${followerName || 'this player'} from your followers?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/players/${myProfile._id}/followers/${followerId}`);
              setSocialList(prev => prev.filter(p => p._id !== followerId));
              dispatch(fetchMyPlayer());
            } catch (err) {
              showCustomAlert('Error', err.response?.data?.message || 'Failed to remove follower');
            }
          },
        },
      ]
    );
  };

  const handleUnfollowFromList = (followingId, followingName) => {
    showCustomAlert(
      'Unfollow',
      `Unfollow ${followingName || 'this player'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfollow',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/players/${myProfile._id}/following/${followingId}`);
              setSocialList(prev => prev.filter(p => p._id !== followingId));
              dispatch(fetchMyPlayer());
            } catch (err) {
              showCustomAlert('Error', err.response?.data?.message || 'Failed to unfollow');
            }
          },
        },
      ]
    );
  };

  useEffect(() => { dispatch(fetchMyPlayer()); }, [dispatch]);
  useEffect(() => {
    if (myProfile?._id) {
      dispatch(fetchMatchHistory({ playerId: myProfile._id, ballType: activeBallType }));
      setScoringWindowOffset(0);
    }
  }, [dispatch, myProfile?._id, activeBallType]);

  // Fetch wagon wheel data when Analytics tab is opened or ball filter changes
  useEffect(() => {
    const fetchWagonWheel = async () => {
      if (!myProfile?._id || activeStatTab !== 'Analytics') return;
      setWwLoading(true);
      try {
        let url = `/players/${myProfile._id}/wagon-wheel`;
        if (activeBallType !== 'Overall') {
          url += `?ballType=${activeBallType}`;
        }
        const res = await api.get(url);
        setWagonWheelData(res.data.data || { shots: [], totalShots: 0 });
      } catch (err) {
        console.error('Failed to fetch wagon wheel', err);
      } finally {
        setWwLoading(false);
      }
    };
    fetchWagonWheel();
  }, [myProfile?._id, activeStatTab, activeBallType]);

  useEffect(() => {
    if (myProfile) {
      setForm({
        name: myProfile.userId?.name || user?.name || '',
        mobile: myProfile.userId?.mobile || user?.mobile || '',
        email: myProfile.userId?.email || user?.email || '',
        location: myProfile.location || myProfile.city || user?.city || '',
        dob: myProfile.dob ? new Date(myProfile.dob).toISOString().split('T')[0] : '',
        gender: myProfile.gender || 'Male',
        playingRole: myProfile.playingRole || 'Batsman',
        battingStyle: myProfile.battingStyle || 'Right Hand',
        battingOrder: myProfile.battingOrder || 'Top Order',
        bowlingStyle: myProfile.bowlingStyle || 'Right Arm Fast',
      });
    } else if (user) {
      setForm(prev => ({ 
        ...prev, 
        name: user.name || '', 
        mobile: user.mobile || '', 
        email: user.email || '',
        location: user.city || ''
      }));
    }
  }, [myProfile, user]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await dispatch(updatePlayerProfile(form)).unwrap();
      showCustomAlert('Success', 'Cricket profile updated successfully!');
      setIsEditModalVisible(false);
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err?.message || err?.error || 'Failed to update profile');
      showCustomAlert('Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setForm(prev => ({ ...prev, dob: selectedDate.toISOString().split('T')[0] }));
  };

  // ── Derive stats ──────────────────────────────────────────────────────────
  // statsByBallType is a Mongoose Map — access via .get() or plain object keys
  const getStats = (ballType) => {
    if (ballType === 'Overall') {
      return myProfile || {};
    }
    const sbt = myProfile?.statsByBallType;
    if (!sbt) return {};
    // Handle both Map (from SDK) and plain object (from JSON)
    if (typeof sbt.get === 'function') return sbt.get(ballType) || {};
    return sbt[ballType] || {};
  };

  const currentStats = getStats(activeBallType);
  const bat = currentStats.batting || {};
  const bowl = currentStats.bowling || {};
  const field = currentStats.fielding || {};
  const careerMatches = myProfile?.career?.matches || 0;

  const batAvg = bat.innings && (bat.innings - (bat.notOuts || 0)) > 0
    ? (bat.runs / (bat.innings - (bat.notOuts || 0))).toFixed(1) : '—';
  const batSR = bat.balls ? ((bat.runs / bat.balls) * 100).toFixed(1) : '—';
  const bowlOversVal = bowl.overs ? (bowl.overs + (bowl.balls || 0) / 6) : 0;
  const bowlAvg = bowl.wickets ? (bowl.runs / bowl.wickets).toFixed(1) : '—';
  const bowlEcon = bowlOversVal > 0 ? (bowl.runs / bowlOversVal).toFixed(2) : '—';
  const bowlSR = bowl.wickets && bowl.balls ? (bowl.balls / bowl.wickets).toFixed(1) : '—';
  const bowlOverDisplay = bowl.overs != null
    ? `${bowl.overs}.${bowl.balls || 0}`
    : '0.0';
  const bestFig = (bowl.bestWickets != null && bowl.bestWickets > 0) ? `${bowl.bestWickets}/${bowl.bestRuns}` : '—';

  const overallBat = getStats('Overall').batting || {};
  const overallBowl = getStats('Overall').bowling || {};

  // ── Ball Filter Strip (Using Ball Images) ──────────────────────────────────
  const BallFilter = () => (
    <View style={styles.filterSection}>
      <View style={styles.filterHeaderRow}>
        <View style={styles.filterIconWrap}>
          <Icon name="filter-outline" size={12} color={colors.primary} />
        </View>
        <Text style={styles.filterHeaderText}>FILTER BY BALL TYPE</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
        {BALL_TYPES.map(bt => {
          const isActive = activeBallType === bt;
          if (bt === 'Overall') {
            return (
              <TouchableOpacity
                key={bt}
                style={[styles.filterPillCircular, isActive && styles.filterPillCircularActive, { opacity: isActive ? 1 : 0.45 }]}
                onPress={() => setActiveBallType('Overall')}
                activeOpacity={0.75}
              >
                <Icon name="globe-outline" size={20} color={isActive ? colors.primary : colors.textSecondary} />
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={bt}
              style={[styles.filterPillCircular, isActive && styles.filterPillCircularActive, { opacity: isActive ? 1 : 0.45 }]}
              onPress={() => setActiveBallType(bt)}
              activeOpacity={0.75}
            >
              <Image 
                source={BallTypeImages[bt] || BallTypeImages['Other']} 
                style={styles.filterPillCircularImage} 
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // ── Tab content ────────────────────────────────────────────────────────────
  const renderStatContent = () => {

    // ── STATISTICS ──────────────────────────────────────────────────────────
    if (activeStatTab === 'Statistics') {
      return (
        <View>
          <BallFilter />

          {/* Batting */}
          <View style={styles.statsCard}>
            <SectionHeading icon="cricket" title="Batting" color={colors.primary} />
            <View style={styles.statGrid}>
              <StatTile value={bat.innings ?? 0} label="Innings" />
              <StatTile value={bat.runs ?? 0} label="Runs" />
              <StatTile value={batAvg} label="Average" />
              <StatTile value={batSR} label="S/R" />
              <StatTile value={bat.highestScore ?? '—'} label="H/S" />
              <StatTile value={bat.fifties ?? 0} label="50s" />
              <StatTile value={bat.hundreds ?? 0} label="100s" />
              <StatTile value={bat.fours ?? 0} label="4s" />
              <StatTile value={bat.sixes ?? 0} label="6s" />
              <StatTile value={bat.notOuts ?? 0} label="Not Outs" />
            </View>
          </View>

          {/* Bowling */}
          <View style={styles.statsCard}>
            <SectionHeading icon="bowling" title="Bowling" color={colors.primary} />
            <View style={styles.statGrid}>
              <StatTile value={bowl.innings ?? 0} label="Innings" />
              <StatTile value={bowl.wickets ?? 0} label="Wickets" />
              <StatTile value={bowl.runs ?? 0} label="Runs" />
              <StatTile value={bowlAvg} label="Average" />
              <StatTile value={bowlEcon} label="Economy" />
              <StatTile value={bowlSR} label="S/R" />
              <StatTile value={bestFig} label="Best" />
              <StatTile value={bowl.threeWicketHauls ?? 0} label="3W" />
              <StatTile value={bowl.fiveWicketHauls ?? 0} label="5W" />
              <StatTile value={bowl.maidens ?? 0} label="Maidens" />
            </View>
          </View>

          {/* Fielding */}
          <View style={styles.statsCard}>
            <SectionHeading icon="hand-back-right" title="Fielding" color={colors.primary} />
            <View style={styles.fieldingRow}>
              {[
                { icon: 'hand-back-right', color: colors.primary, val: field.catches ?? 0, label: 'Catches' },
                { icon: 'run-fast', color: colors.primary, val: field.runOuts ?? 0, label: 'Run Outs' },
                { icon: 'target', color: colors.primary, val: field.stumpings ?? 0, label: 'Stumpings' },
                { icon: 'shield', color: colors.primary, val: field.caughtBehind ?? field.caughtBehinds ?? 0, label: 'Caught Behind' },
              ].map(f => (
                <View key={f.label} style={styles.fieldingBox}>
                  <MCIcon name={f.icon} size={20} color={f.color} />
                  <Text style={styles.fieldingVal}>{f.val}</Text>
                  <Text style={styles.fieldingLbl}>{f.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      );
    }

    // ── MATCHES ─────────────────────────────────────────────────────────────
    if (activeStatTab === 'Matches') {
      if (isLoading) return <View style={styles.tabCenteredEmpty}><ActivityIndicator color={colors.primary} size="large" /></View>;
      if (!matchHistory || matchHistory.length === 0) return (
        <View style={styles.tabCenteredEmpty}>
          <MCIcon name="baseball" size={52} color={colors.textTertiary} />
          <Text style={styles.emptyText}>No match history yet</Text>
        </View>
      );
      return (
        <View>
          <BallFilter />
          {[...matchHistory].reverse().map((match, idx) => {
            const isLive = match.status === 'in_progress';
            const teamAName = match.teamA?.shortName || match.teamA?.name || 'Team A';
            const teamBName = match.teamB?.shortName || match.teamB?.name || 'Team B';
            const statusText = isLive 
              ? 'Match is Ongoing' 
              : (match.resultSummary || 'Match Completed');

            return (
              <TouchableOpacity key={idx} style={[styles.matchCard, isLive && styles.matchCardLive]} activeOpacity={0.8}
                onPress={() => { if (match.matchId) navigation.navigate('MatchSummary', { matchId: match.matchId }); }}>
                <View style={{ flex: 1 }}>
                  {/* Top row: Team Names + Status Indicator */}
                  <View style={styles.matchCardHeader}>
                    <Text style={styles.matchTeamsText} numberOfLines={1}>
                      {teamAName} <Text style={{ color: colors.primary, fontFamily: Typography.fontFamily.bold }}>vs</Text> {teamBName}
                    </Text>
                  </View>

                  {/* Center row: Score/Stats + Live/Date Indicator */}
                  <View style={styles.matchCardBody}>
                    <View style={{ flex: 1 }}>
                      {/* Batting Stats */}
                      {match.runs !== null && (
                        <View>
                          <Text style={styles.matchRunsValue}>{match.runs}{match.isNotOut ? '*' : ''} <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: Typography.fontFamily.regular }}>runs</Text></Text>
                          <Text style={styles.matchRunsLabel}>{match.balls || 0} balls · {match.fours || 0}×4s · {match.sixes || 0}×6s</Text>
                        </View>
                      )}

                      {/* Spacer if both are present */}
                      {match.runs !== null && match.bowling && (
                        <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.borderLight, marginVertical: 8 }} />
                      )}

                      {/* Bowling Stats */}
                      {match.bowling ? (
                        <View>
                          <Text style={styles.matchRunsValue}>
                            {match.bowling.wickets}-{match.bowling.runs}{' '}
                            <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: Typography.fontFamily.regular }}>
                              ({match.bowling.overs}.{match.bowling.balls} ov)
                            </Text>
                          </Text>
                          <Text style={styles.matchRunsLabel}>
                            {match.bowling.maidens || 0} mdns · econ {(match.bowling.economy || 0).toFixed(2)}
                          </Text>
                        </View>
                      ) : (
                        match.runs === null && <Text style={styles.matchDNB}>Did Not Bat or Bowl</Text>
                      )}
                    </View>

                    <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                      {isLive ? (
                        <View style={styles.liveBadge}>
                          <View style={styles.liveDot} />
                          <Text style={styles.liveText}>LIVE</Text>
                        </View>
                      ) : (
                        <Text style={styles.matchDate}>{match.date ? new Date(match.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}</Text>
                      )}
                    </View>
                  </View>

                  {/* Bottom row: Match Status / Result Summary */}
                  <View style={styles.matchCardFooter}>
                    <Text style={[styles.matchStatusText, isLive && { color: colors.primary }]} numberOfLines={1}>
                      {statusText}
                    </Text>
                  </View>
                </View>
                <Icon name="chevron-forward" size={16} color={colors.textTertiary} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    // ── ANALYTICS ───────────────────────────────────────────────────────────
    if (activeStatTab === 'Analytics') {
      return (
        <View>
          <BallFilter />

          <View style={styles.statsCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={[styles.sectionHeading, { marginBottom: 0 }]}>
                <View style={[styles.sectionHeadingBar, { backgroundColor: colors.primary }]} />
                <MCIcon name="chart-donut" size={14} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.sectionHeadingText}>Wagon Wheel</Text>
              </View>
              <View style={styles.wwToggleRow}>
                {['outdoor', 'indoor'].map(t => (
                  <TouchableOpacity key={t} style={[styles.wwToggleBtn, wwGroundType === t && styles.wwToggleBtnActive]} onPress={() => setWwGroundType(t)} activeOpacity={0.8}>
                    <Text style={[styles.wwToggleText, wwGroundType === t && styles.wwToggleTextActive]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <RealWagonWheel shots={wagonWheelData.shots || []} groundType={wwGroundType} loading={wwLoading} />
          </View>

          <View style={styles.statsCard}>
            <SectionHeading icon="chart-line" title="Scoring Pattern" color={colors.primary} />
            {(() => {
              const WINDOW = 7;
              const total = matchHistory.length;

              // Clamp offset: 0 = latest window, positive = further back in time
              const maxOffset = Math.max(0, total - WINDOW);
              const clampedOffset = Math.min(scoringWindowOffset, maxOffset);

              // Slice window from the full sorted (oldest→newest) history
              const startIdx = Math.max(0, total - WINDOW - clampedOffset);
              const endIdx = startIdx + WINDOW;
              const window = matchHistory.slice(startIdx, Math.min(endIdx, total));

              const canGoPrev = clampedOffset < maxOffset; // older matches exist
              const canGoNext = clampedOffset > 0;         // newer matches exist

              // Compute stats for visible window only
              const battingEntries = window.filter(m => m.runs !== null);
              const windowInnings = battingEntries.length;
              const windowRuns = battingEntries.reduce((s, m) => s + (m.runs || 0), 0);
              const windowAvg = windowInnings > 0 ? Math.round(windowRuns / windowInnings) : 0;
              const windowHS = battingEntries.reduce((mx, m) => Math.max(mx, m.runs || 0), 0);

              const BAR_HEIGHT = 80;
              const BAR_CONTAINER_H = 100;
              const AVG_COLOR = '#FF9500';
              const maxVal = Math.max(windowHS, 10);
              const avgBarH = (windowAvg / maxVal) * BAR_HEIGHT;
              const avgLineY = BAR_CONTAINER_H - avgBarH;

              return (
                <View style={{ paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4 }}>
                  {/* Summary stats row — dynamic for current window */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 }}>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: colors.primary, fontSize: 18, fontFamily: Typography.fontFamily.bold }}>{windowHS}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 10 }}>High Score</Text>
                    </View>
                    <View style={{ width: 1, backgroundColor: colors.border, height: 34 }} />
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: colors.primary, fontSize: 18, fontFamily: Typography.fontFamily.bold }}>{windowAvg}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 10 }}>Avg/Innings</Text>
                    </View>
                    <View style={{ width: 1, backgroundColor: colors.border, height: 34 }} />
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: colors.primary, fontSize: 18, fontFamily: Typography.fontFamily.bold }}>{windowInnings}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 10 }}>Innings</Text>
                    </View>
                  </View>

                  {/* Nav + chart */}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {/* Prev arrow */}
                    <TouchableOpacity
                      onPress={() => canGoPrev && setScoringWindowOffset(clampedOffset + 1)}
                      style={{ padding: 6, opacity: canGoPrev ? 1 : 0.25 }}
                    >
                      <MCIcon name="chevron-left" size={22} color={colors.primary} />
                    </TouchableOpacity>

                    {/* Chart */}
                    <View style={{ flex: 1, height: BAR_CONTAINER_H + 18, position: 'relative' }}>
                      {/* Avg line */}
                      {windowInnings > 0 && (
                        <View style={{ position: 'absolute', top: avgLineY, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', zIndex: 10 }}>
                          <View style={{ flex: 1, height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: AVG_COLOR }} />
                          <View style={{ backgroundColor: AVG_COLOR, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 3 }}>
                            <Text style={{ color: '#000', fontSize: 8, fontFamily: Typography.fontFamily.bold }}>∅{windowAvg}</Text>
                          </View>
                        </View>
                      )}

                      {/* Bars row */}
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: BAR_CONTAINER_H, paddingHorizontal: 2 }}>
                        {window.map((match, i) => {
                          const isDnb = match.runs === null;
                          const score = isDnb ? 0 : (match.runs || 0);
                          const barH = isDnb ? 6 : Math.max(8, (score / maxVal) * BAR_HEIGHT);
                          const isHS = score === windowHS && score > 0;
                          return (
                            <View key={i} style={{ alignItems: 'center', flex: 1, gap: 2 }}>
                              <Text style={{ color: isHS ? colors.primary : colors.textSecondary, fontSize: 9, fontFamily: isHS ? Typography.fontFamily.bold : 'normal' }}>
                                {isDnb ? '—' : score}{match.isNotOut && !isDnb ? '*' : ''}
                              </Text>
                              <View style={{ width: 18, height: barH, borderRadius: 5, overflow: 'hidden' }}>
                                <LinearGradient
                                  colors={isDnb ? (isDark ? ['#2A2A2A', '#000000'] : ['#E0E0E0', '#BDBDBD']) : isHS ? [colors.primary, colors.primaryDark] : [colors.primaryLight, colors.primary]}
                                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                                  style={{ flex: 1 }}
                                />
                              </View>
                            </View>
                          );
                        })}
                        {/* Pad if fewer than WINDOW matches */}
                        {Array.from({ length: Math.max(0, WINDOW - window.length) }).map((_, i) => (
                          <View key={`pad-${i}`} style={{ flex: 1 }} />
                        ))}
                      </View>

                      {/* X-axis labels */}
                      <View style={{ flexDirection: 'row', paddingHorizontal: 2 }}>
                        {window.map((_, i) => (
                          <Text key={i} style={{ flex: 1, textAlign: 'center', color: colors.textTertiary, fontSize: 8 }}>
                            #{startIdx + i + 1}
                          </Text>
                        ))}
                        {Array.from({ length: Math.max(0, WINDOW - window.length) }).map((_, i) => (
                          <View key={`lpad-${i}`} style={{ flex: 1 }} />
                        ))}
                      </View>
                    </View>

                    {/* Next arrow */}
                    <TouchableOpacity
                      onPress={() => canGoNext && setScoringWindowOffset(clampedOffset - 1)}
                      style={{ padding: 6, opacity: canGoNext ? 1 : 0.25 }}
                    >
                      <MCIcon name="chevron-right" size={22} color={colors.primary} />
                    </TouchableOpacity>
                  </View>

                  {/* Footer label */}
                  <Text style={{ color: colors.textTertiary, fontSize: 9, textAlign: 'center', marginTop: 6 }}>
                    Showing innings #{startIdx + 1}–{Math.min(startIdx + window.length, total)} of {total} · Tap ‹ › to navigate
                  </Text>
                </View>
              );
            })()}
          </View>

          <View style={styles.statsCard}>
            <SectionHeading icon="trophy-outline" title="Match Contribution" color={colors.primary} />
            <View style={styles.statGrid}>
              <StatTile flex={1} value={myProfile?.career?.winsBattingFirst || 0} label="Batting 1st" accent={colors.primary} />
              <StatTile flex={1} value={myProfile?.career?.winsBowlingFirst || 0} label="Bowling 1st" accent={colors.primary} />
              <StatTile flex={1} value={careerMatches} label="Matches" accent={colors.primary} />
              <StatTile flex={1} value={myProfile?.career?.wins ?? 0} label="Wins" accent={colors.primary} />
            </View>
          </View>
        </View>
      );
    }

    // ── ACHIEVEMENTS ─────────────────────────────────────────────────────────
    if (activeStatTab === 'Achievements') {
      const totalRuns = overallBat.runs || 0;
      const totalWickets = overallBowl.wickets || 0;
      return (
        <View>
          <View style={styles.statsCard}>
            <SectionHeading icon="medal" title="Batting Milestones" color={colors.primary} />
            <View style={styles.achieveGrid}>
              <AchievementBadge icon="numeric-1-circle" color={colors.primary} title="First Run" desc="Score your first run" earned={totalRuns >= 1} />
              <AchievementBadge icon="star" color={colors.primary} title="Hundred Runs" desc="100+ total runs" earned={totalRuns >= 100} />
              <AchievementBadge icon="star" color={colors.primary} title="Run Machine" desc="500+ total runs" earned={totalRuns >= 500} />
              <AchievementBadge icon="star" color={colors.primary} title="Run Accumulator" desc="1000+ total runs" earned={totalRuns >= 1000} />
              
              <AchievementBadge icon="counter" color={colors.primary} title="Cool Thirty" desc="Score 30+ runs" earned={(overallBat.thirties || 0) > 0} timesEarned={overallBat.thirties || 0} />
              <AchievementBadge icon="counter" color={colors.primary} title="Thirty Machine" desc="Score 10 30+ scores" earned={(overallBat.thirties || 0) >= 10} />
              
              <AchievementBadge icon="counter" color={colors.primary} title="First Fifty" desc="Score 50+ runs" earned={(overallBat.fifties || 0) > 0} timesEarned={overallBat.fifties || 0} />
              <AchievementBadge icon="counter" color={colors.primary} title="Half-Century Machine" desc="Score 10 50+ scores" earned={(overallBat.fifties || 0) >= 10} />
              
              <AchievementBadge icon="trophy" color={colors.primary} title="Centurion" desc="100+ runs in an innings" earned={(overallBat.hundreds || 0) > 0} timesEarned={overallBat.hundreds || 0} />
              <AchievementBadge icon="trophy" color={colors.primary} title="Legendary Centurion" desc="Score 10 centuries" earned={(overallBat.hundreds || 0) >= 10} />
              
              <AchievementBadge icon="flash" color={colors.primary} title="Boundary Hitter" desc="Hit 50+ fours" earned={(overallBat.fours || 0) >= 50} timesEarned={Math.floor((overallBat.fours || 0)/50)} />
              <AchievementBadge icon="flash" color={colors.primary} title="Boundary Machine" desc="Hit 100+ fours" earned={(overallBat.fours || 0) >= 100} />
              
              <AchievementBadge icon="fire" color={colors.primary} title="Six Hitter" desc="Hit 50+ sixes" earned={(overallBat.sixes || 0) >= 50} />
              <AchievementBadge icon="fire" color={colors.primary} title="Six Machine" desc="Hit 100+ sixes" earned={(overallBat.sixes || 0) >= 100} />
              
              <AchievementBadge icon="shield" color={colors.primary} title="The Wall" desc="Stay Not Out 10+ times" earned={(overallBat.notOuts || 0) >= 10} timesEarned={overallBat.notOuts || 0} />
              <AchievementBadge icon="lightning-bolt" color={colors.primary} title="Powerhouse" desc="Strike Rate 150+" earned={parseFloat(batSR) >= 150} />
            </View>
          </View>

          <View style={styles.statsCard}>
            <SectionHeading icon="medal-outline" title="Bowling Milestones" color={colors.primary} />
            <View style={styles.achieveGrid}>
              <AchievementBadge icon="numeric-1-circle" color={colors.primary} title="First Wicket" desc="Take your first wicket" earned={totalWickets >= 1} />
              <AchievementBadge icon="star" color={colors.primary} title="First 10 Wickets" desc="Take 10+ wickets" earned={totalWickets >= 10} />
              <AchievementBadge icon="star-circle" color={colors.primary} title="Wicket Taker" desc="Take 50+ wickets" earned={totalWickets >= 50} />
              <AchievementBadge icon="star-circle" color={colors.primary} title="Wicket Machine" desc="Take 100+ wickets" earned={totalWickets >= 100} />
              <AchievementBadge icon="target" color={colors.primary} title="5-Wicket Haul" desc="Take a 5-for in an innings" earned={(overallBowl.fiveWickets || 0) > 0} timesEarned={overallBowl.fiveWickets || 0} />
              <AchievementBadge icon="bowling" color={colors.primary} title="Hat-Trick" desc="3 wickets in 3 balls" earned={false} />
              <AchievementBadge icon="chart-line" color={colors.primary} title="Economy King" desc="Economy below 6.0" earned={parseFloat(bowlEcon) > 0 && parseFloat(bowlEcon) < 6} />
            </View>
          </View>

          <View style={styles.statsCard}>
            <SectionHeading icon="shield-star" title="General Milestones" color={colors.primary} />
            <View style={styles.achieveGrid}>
              <AchievementBadge icon="cricket" color={colors.primary} title="Debut" desc="Play your first match" earned={careerMatches >= 1} />
              <AchievementBadge icon="account-group" color={colors.primary} title="Veteran" desc="Play 10+ matches" earned={careerMatches >= 10} />
              <AchievementBadge icon="crown" color={colors.primary} title="Legend" desc="Play 50+ matches" earned={careerMatches >= 50} />
              <AchievementBadge icon="hand-back-right" color={colors.primary} title="Safe Hands" desc="Take 5+ catches" earned={(field.catches || 0) >= 5} />
              <AchievementBadge icon="hand-wave" color={colors.primary} title="Magic Hands" desc="Take 10+ catches" earned={(field.catches || 0) >= 10} />
              <AchievementBadge icon="bullseye" color={colors.primary} title="Sniper" desc="Execute 5+ Run Outs" earned={(field.runOuts || 0) >= 5} />
              <AchievementBadge icon="medal" color={colors.primary} title="Centurion" desc="Play 100+ matches" earned={careerMatches >= 100} />
            </View>
          </View>
        </View>
      );
    }

    // ── AWARDS ───────────────────────────────────────────────────────────────
    if (activeStatTab === 'Awards') {
      const potm = myProfile?.career?.playerOfMatchAwards || 0;
      const fotm = myProfile?.career?.fighterOfMatchAwards || 0;
      const topBatter = myProfile?.career?.topBatterAwards || 0;
      const topBowler = myProfile?.career?.topBowlerAwards || 0;
      return (
        <View>
          <View style={styles.statsCard}>
            <SectionHeading icon="trophy" title="Match Awards" color={colors.primary} />
            <View style={styles.awardsGrid}>
              <AwardCard icon="star" color={colors.primary} title="Player of Match" count={potm} matches={careerMatches} />
              <AwardCard icon="lightning-bolt" color={colors.primary} title="Fighter of Match" count={fotm} matches={careerMatches} />
              <AwardCard icon="cricket" color={colors.primary} title="Top Batter" count={topBatter} matches={careerMatches} />
              <AwardCard icon="bowling" color={colors.primary} title="Top Bowler" count={myProfile?.career?.topBowlerAwards || 0} matches={careerMatches} />
              <AwardCard icon="shield-check" color={colors.primary} title="Best Fielder" count={myProfile?.career?.bestFielderAwards || 0} matches={careerMatches} />
              <AwardCard icon="crown" color={colors.warning} title="MVP" count={myProfile?.career?.mvpAwards || 0} matches={careerMatches} />
            </View>
          </View>

          <View style={styles.statsCard}>
            <SectionHeading icon="podium" title="Career Bests" color={colors.primary} />
            <View style={styles.bestPerfRow}>
              <View style={styles.bestPerfItem}>
                <Text style={styles.bestPerfLabel}>Best Batting</Text>
                <Text style={[styles.bestPerfValue, { color: colors.primary }]}>
                  {overallBat.highestScore ? `${overallBat.highestScore}${overallBat.highestScoreNotOut ? '*' : ''}` : '—'}
                </Text>
              </View>
              <View style={styles.bestPerfDivider} />
              <View style={styles.bestPerfItem}>
                <Text style={styles.bestPerfLabel}>Best Bowling</Text>
                <Text style={[styles.bestPerfValue, { color: colors.info }]}>{bestFig}</Text>
              </View>
              <View style={styles.bestPerfDivider} />
              <View style={styles.bestPerfItem}>
                <Text style={styles.bestPerfLabel}>Bat Strike Rate</Text>
                <Text style={[styles.bestPerfValue, { color: colors.warning }]}>{batSR}</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  const avatarPhoto = myProfile?.photo || myProfile?.userId?.photo || myProfile?.userId?.profilePicture || user?.photo || user?.profilePicture;
  const avatarUrl = getImageUrl(avatarPhoto);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Floating nav bar over banner */}
      <View style={[styles.navBarAbsolute, { paddingTop: insets.top || 10 }]} pointerEvents="box-none">
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBackBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.8}>
            <Icon name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navShareBtn} onPress={() => setShareModalVisible(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.8}>
            <Icon name="share-social-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAwareScrollView
        enableOnAndroid={true}
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HERO BANNER — full-bleed profile photo with gradient overlay ── */}
        <View style={styles.heroBanner}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.heroBgImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.heroBgImage, styles.heroBgFallback]}>
              <Text style={styles.heroBgFallbackLetter}>{form.name?.[0]?.toUpperCase() || 'P'}</Text>
            </View>
          )}

          {/* Gradient + overlay content sits on top via zIndex */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.78)', isDark ? 'rgba(0,0,0,0.98)' : 'rgba(0,0,0,0.92)']}
            locations={[0, 0.35, 0.70, 1]}
            style={styles.heroBannerGradient}
            pointerEvents="box-none"
          >
            {/* Bottom content block */}
            <View style={styles.heroOverlayContent}>
              {/* Name */}
              <Text style={styles.heroName}>{form.name}</Text>

              {/* Clean Meta Info Row (Role • Batting • Bowling) */}
              <View style={styles.heroMetaRow}>
                <View style={styles.heroMetaItem}>
                  <MCIcon name="cricket" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.heroRoleHighlight}>{form.playingRole || 'Batsman'}</Text>
                </View>
                {form.battingStyle ? (
                  <>
                    <Text style={styles.heroMetaDot}>•</Text>
                    <Text style={styles.heroMetaText}>{form.battingStyle}</Text>
                  </>
                ) : null}
                {form.bowlingStyle && form.bowlingStyle !== 'None' ? (
                  <>
                    <Text style={styles.heroMetaDot}>•</Text>
                    <Text style={styles.heroMetaText}>{form.bowlingStyle}</Text>
                  </>
                ) : null}
              </View>

              {/* Special Player Badges / Tags (Non-Pill Sleek Badges) */}
              {(() => {
                const overallStats = getStats('Overall');
                const playerObj = {
                  ...myProfile,
                  matches: careerMatches,
                  batting: overallStats.batting || myProfile?.batting || {},
                  bowling: overallStats.bowling || myProfile?.bowling || {},
                };
                const tags = getPlayerTags(playerObj);
                if (!tags || tags.length === 0) return null;
                return (
                  <View style={styles.heroTagsRow}>
                    {tags.map((tag, tIdx) => (
                      <TouchableOpacity
                        key={tIdx}
                        onPress={() => setSelectedTagDefinition(tag)}
                        activeOpacity={0.7}
                        style={styles.heroTagBadge}
                      >
                        <MCIcon
                          name={tag.type === 'batting' ? 'lightning-bolt' : 'fire'}
                          size={12}
                          color={colors.primary}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.heroTagBadgeText}>{tag.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })()}

              {/* Location */}
              {form.location ? (
                <View style={styles.heroLocationRow}>
                  <MCIcon name="map-marker" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.heroLocationText}>{form.location}</Text>
                </View>
              ) : null}
            </View>
          </LinearGradient>
        </View>

        {/* Content body padding */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>

          {/* Social counts card */}
          <View style={[styles.card, { paddingVertical: 14, marginBottom: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity style={styles.socialCountItem} onPress={() => loadSocialList('followers')} activeOpacity={0.7}>
                <Text style={[styles.socialCountVal, { color: colors.primary }]}>{myProfile?.followers?.length || 0}</Text>
                <Text style={styles.socialCountLbl}>Followers</Text>
              </TouchableOpacity>
              <View style={styles.socialDivider} />
              <TouchableOpacity style={styles.socialCountItem} onPress={() => loadSocialList('following')} activeOpacity={0.7}>
                <Text style={[styles.socialCountVal, { color: colors.primary }]}>{myProfile?.following?.length || 0}</Text>
                <Text style={styles.socialCountLbl}>Following</Text>
              </TouchableOpacity>
              <View style={styles.socialDivider} />
              <View style={styles.socialCountItem}>
                <Text style={styles.socialCountVal}>{myProfile?.profileViews || 0}</Text>
                <Text style={styles.socialCountLbl}>Views</Text>
              </View>
            </View>
          </View>

          {/* Profile info card */}
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary }}>Personal & Cricket Info</Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(true)} style={{ flexDirection: 'row', alignItems: 'center' }} activeOpacity={0.7}>
                <Icon name="create-outline" size={18} color={colors.primary} />
                <Text style={{ color: colors.primary, marginLeft: 4, fontFamily: Typography.fontFamily.semiBold }}>Edit</Text>
              </TouchableOpacity>
            </View>

            {[
              { icon: 'call-outline', label: 'Mobile', val: form.mobile },
              { icon: 'mail-outline', label: 'Email', val: form.email },
              { icon: 'calendar-outline', label: 'Date of Birth', val: form.dob ? form.dob.split('-').reverse().join('-') : '' },
              { icon: 'person-outline', label: 'Gender', val: form.gender },
            ].map(r => (
              <View key={r.label} style={styles.infoRow}>
                <View style={styles.infoRowLeft}>
                  <Icon name={r.icon} size={18} color={colors.primary} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{r.label}</Text>
                </View>
                <Text style={styles.infoValue}>{r.val || '-'}</Text>
              </View>
            ))}

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoRowLeft}>
                <MCIcon name="cricket" size={18} color={colors.primary} style={styles.infoIcon} />
                <Text style={styles.infoLabel}>Batting</Text>
              </View>
              <Text style={styles.infoValue}>{form.battingStyle} ({form.battingOrder})</Text>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoRowLeft}>
                <MCIcon name="bowling" size={18} color={colors.primary} style={styles.infoIcon} />
                <Text style={styles.infoLabel}>Bowling</Text>
              </View>
              <Text style={styles.infoValue}>{form.bowlingStyle}</Text>
            </View>
          </View>

          {/* My Teams */}
          <TouchableOpacity
            style={[styles.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, marginBottom: 20 }]}
            onPress={() => navigation.navigate('TeamList')}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="people-outline" size={22} color={colors.primary} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary }}>My Teams</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Stats & Achievements Section */}
          <View style={styles.statsSection}>
            <View style={styles.statsSectionHeader}>
              <View style={styles.statsSectionAccent} />
              <Text style={styles.statsSectionTitle}>Stats & Achievements</Text>
            </View>

            {/* Quick summary */}
            <View style={styles.quickSummaryRow}>
              {[
                { val: careerMatches, label: 'Matches', color: colors.textPrimary },
                { val: overallBat.runs ?? 0, label: 'Runs', color: colors.textPrimary },
                { val: overallBowl.wickets ?? 0, label: 'Wickets', color: colors.textPrimary },
                { val: (myProfile?.playingRole === 'Bowler' && bowl.bestWickets > 0) ? bestFig : ((overallBat.highestScore > 0) ? `${overallBat.highestScore}${overallBat.highestScoreNotOut ? '*' : ''}` : bestFig), label: (myProfile?.playingRole === 'Bowler' && bowl.bestWickets > 0) ? 'Best Bowl' : ((overallBat.highestScore > 0) ? 'High Score' : 'Best Bowl'), color: colors.textPrimary },
              ].map((s, i, arr) => (
                <View key={s.label} style={[styles.quickSummaryItem, i < arr.length - 1 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
                  <Text style={[styles.quickSummaryVal, { color: s.color }]}>{s.val}</Text>
                  <Text style={styles.quickSummaryLbl}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Tab bar */}
            <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statTabsRow}>
              {STAT_TABS.map(tab => (
                <TouchableOpacity key={tab} style={styles.statTab} onPress={() => setActiveStatTab(tab)} activeOpacity={0.7}>
                  <Text style={[styles.statTabText, activeStatTab === tab && styles.statTabTextActive]}>{tab}</Text>
                  {activeStatTab === tab && <View style={styles.statTabUnderline} />}
                </TouchableOpacity>
              ))}
            </KeyboardAwareScrollView>

            {renderStatContent()}
          </View>
        </View>
      </KeyboardAwareScrollView>

      {/* Edit Modal */}
      <Modal visible={isEditModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsEditModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsEditModalVisible(false)} style={styles.modalHeaderBtn}>
              <Icon name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity 
              onPress={handleSave} 
              disabled={isSaving || isLoading} 
              style={styles.modalSaveBtn}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.textOnPrimary} size="small" />
              ) : (
                <Text style={styles.modalSaveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollView
            enableOnAndroid={true}
            extraScrollHeight={20}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Section 1: Personal Details */}
            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <View style={styles.formSectionAccent} />
                <Text style={styles.formSectionTitle}>Personal Details</Text>
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor={colors.textTertiary}
                  value={form.name}
                  onChangeText={t => setForm({ ...form, name: t })}
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Mobile Number</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor={colors.textTertiary}
                  value={form.mobile}
                  keyboardType="phone-pad"
                  onChangeText={t => setForm({ ...form, mobile: t })}
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor={colors.textTertiary}
                  value={form.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onChangeText={t => setForm({ ...form, email: t })}
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Date of Birth</Text>
                <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowDatePicker(true)}>
                  <Text style={[styles.dropdownBtnText, !form.dob && { color: colors.textTertiary }]}>
                    {form.dob ? form.dob.split('-').reverse().join('-') : 'Select Date of Birth'}
                  </Text>
                  <Icon name="calendar-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={form.dob ? new Date(form.dob) : new Date()}
                    mode="date" display="spinner" maximumDate={new Date()}
                    textColor={colors.textPrimary} accentColor={colors.primary}
                    onChange={onDateChange}
                  />
                )}
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Location</Text>
                <LocationAutocomplete
                  value={form.location}
                  onChangeText={t => setForm({ ...form, location: t })}
                  onSelectLocation={(loc) => {
                    setForm({
                      ...form,
                      location: loc ? loc.name : '',
                      locationObj: loc ? { name: loc.name, latitude: loc.latitude, longitude: loc.longitude } : null
                    });
                  }}
                  placeholder="City or Area"
                  variant="none"
                  style={styles.locationInputBox}
                />
              </View>

              <Dropdown label="Gender" value={form.gender} options={GENDERS} onSelect={val => setForm({ ...form, gender: val })} />
            </View>

            {/* Section 2: Cricket Details */}
            <View style={[styles.formSection, { marginTop: 4 }]}>
              <View style={styles.formSectionHeader}>
                <View style={styles.formSectionAccent} />
                <Text style={styles.formSectionTitle}>Cricket Profile</Text>
              </View>

              <Dropdown label="Playing Role" value={form.playingRole} options={ROLES} onSelect={val => setForm({ ...form, playingRole: val })} />
              <Dropdown label="Batting Order" value={form.battingOrder} options={BATTING_ORDERS} onSelect={val => setForm({ ...form, battingOrder: val })} />
              <Dropdown label="Batting Style" value={form.battingStyle} options={BATTING_STYLES} onSelect={val => setForm({ ...form, battingStyle: val })} />
              <Dropdown label="Bowling Style" value={form.bowlingStyle} options={BOWLING_STYLES} onSelect={val => setForm({ ...form, bowlingStyle: val })} />
            </View>
          </KeyboardAwareScrollView>
        </SafeAreaView>
      </Modal>

      {/* Social Modal */}
      <Modal visible={socialModalVisible} animationType="slide" transparent onRequestClose={() => setSocialModalVisible(false)}>
        <View style={styles.socialModalOverlay}>
          <View style={styles.socialModalSheet}>
            <View style={styles.socialModalHandle} />
            <View style={styles.socialModalHeader}>
              <Text style={styles.socialModalTitle}>
                {socialType === 'followers' ? 'Followers' : 'Following'} ({socialList.length})
              </Text>
              <TouchableOpacity onPress={() => setSocialModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {socialLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 40 }} />
            ) : socialList.length === 0 ? (
              <View style={styles.socialEmptyList}>
                <Icon name="people-outline" size={48} color={colors.textTertiary} />
                <Text style={styles.socialEmptyText}>No users found</Text>
              </View>
            ) : (
              <FlatList
                data={socialList}
                keyExtractor={item => item._id}
                renderItem={({ item }) => {
                  const photo = item.photo || item.userId?.profilePicture || item.userId?.photo;
                  const hasError = imgErrors[item._id];
                  const imageUrl = getImageUrl(photo);
                  return (
                    <View style={styles.socialItem}>
                      <TouchableOpacity style={styles.socialItemLeft} onPress={() => { setSocialModalVisible(false); navigation.navigate('PlayerDetail', { id: item._id }); }} activeOpacity={0.7}>
                        {imageUrl && !hasError ? (
                          <Image 
                            source={{ uri: imageUrl }} 
                            style={styles.socialAvatar} 
                            onError={() => setImgErrors(prev => ({ ...prev, [item._id]: true }))} 
                          />
                        ) : (
                          <View style={[styles.socialAvatar, styles.socialAvatarPlaceholder]}>
                            <Text style={{ fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.primary }}>
                              {(item.name || '?').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.socialName}>{item.name}</Text>
                          <Text style={styles.socialRole}>{item.playingRole || 'Cricket Player'}</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.socialActionBtn}
                        onPress={() => socialType === 'followers'
                          ? handleRemoveFollower(item._id, item.name)
                          : handleUnfollowFromList(item._id, item.name)
                        }
                        activeOpacity={0.7}
                      >
                        <Text style={styles.socialActionBtnText}>{socialType === 'followers' ? 'Remove' : 'Unfollow'}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }}
                contentContainerStyle={{ paddingBottom: 16 }}
              />
            )}
            <SafeAreaView edges={['bottom']} />
          </View>
        </View>
      </Modal>

      {/* Tag Definition Popup Modal */}
      <Modal visible={!!selectedTagDefinition} transparent animationType="fade" onRequestClose={() => setSelectedTagDefinition(null)}>
        <TouchableOpacity style={styles.tagModalOverlay} activeOpacity={1} onPress={() => setSelectedTagDefinition(null)}>
          <View style={styles.tagModalContent}>
            <View style={styles.tagModalIconWrap}>
              <MCIcon
                name={selectedTagDefinition?.type === 'batting' ? 'lightning-bolt' : 'fire'}
                size={28}
                color={colors.primary}
              />
            </View>
            <Text style={styles.tagModalTitle}>{selectedTagDefinition?.name}</Text>
            <Text style={styles.tagModalDesc}>{selectedTagDefinition?.desc}</Text>
            <TouchableOpacity style={styles.tagModalCloseBtn} onPress={() => setSelectedTagDefinition(null)} activeOpacity={0.8}>
              <Text style={styles.tagModalCloseBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── SHARE PREVIEW MODAL ── */}
      <SharePreviewModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        title={myProfile?.name}
        shareUrl={`https://www.scoreverse.in/player/${myProfile?._id}`}
      >
        <PlayerProfilePoster
          player={myProfile}
          career={myProfile?.career || {}}
          batting={overallBat}
          bowling={overallBowl}
        />
      </SharePreviewModal>
    </View>
  );
};

export default PlayerProfileScreen;

