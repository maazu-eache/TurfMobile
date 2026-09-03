import React, { useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Share from 'react-native-share';
import Icon from 'react-native-vector-icons/Feather';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, Typography, BorderRadius, Spacing } from '../../../theme/theme';

const THEMES = [
  { key: 'Aesthetic', label: 'Golden',  icon: 'sun',      iconSet: 'feather', color: '#E8C468' },
  { key: 'Hype',      label: 'Neon',    icon: 'zap',      iconSet: 'feather', color: '#38F2E0' },
  { key: 'Aura',      label: 'Royal',   icon: 'star',     iconSet: 'feather', color: '#C9A24B' },
  { key: 'Chrome',    label: 'Silver',  icon: 'film',     iconSet: 'feather', color: '#E4E4E4' },
  { key: 'Cyber',     label: 'Crimson', icon: 'target',   iconSet: 'feather', color: '#E8384F' },
  { key: 'Drip',      label: 'Amber',   icon: 'award',    iconSet: 'feather', color: '#D98A3D' },
];

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: colors.blackAlpha50,
    justifyContent: 'center',
    padding: Spacing.md,
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },

  // Theme Selector
  themeSelectorWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: isDark ? colors.backgroundElevated : colors.surfaceVariant,
  },
  themeScrollContainer: {
    paddingHorizontal: 8,
  },
  themeItem: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
    gap: 4,
    minWidth: 80,
  },
  themeIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
  },
  themeItemText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Preview
  previewScroll: {
    backgroundColor: isDark ? colors.background : colors.surfaceVariant,
  },
  previewContainer: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
  },
  viewShotContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: BorderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: isDark ? colors.backgroundElevated : colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    ...shadows.md,
  },
  actionBtnText: {
    color: colors.textOnPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 16,
  }
});

const SharePreviewModal = ({ visible, onClose, title, shareUrl, children }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);

  const viewShotRefs = useRef({});
  const [activeTheme, setActiveTheme] = useState('Aesthetic');
  const [isCapturing, setIsCapturing] = useState(false);

  const handleShare = async () => {
    try {
      setIsCapturing(true);
      await new Promise(resolve => setTimeout(resolve, 300));
      const uris = [];
      const keys = Object.keys(viewShotRefs.current || {}).sort((a,b) => parseInt(a) - parseInt(b));
      
      const safeTitle = title ? title.replace(/[^a-zA-Z0-9]/g, '_') : 'poster';
      
      for (const key of keys) {
        const ref = viewShotRefs.current[key];
        if (ref) {
          const uri = await captureRef(ref, {
            format: 'png',
            quality: 1,
            fileName: `${safeTitle}_poster`,
          });
          uris.push(uri);
        }
      }
      
      setIsCapturing(false);
      if (uris.length === 0) return;
      
      const shareOptions = {
        title: 'Share Poster',
        message: `Check out ${title} on ScoreVerse!\nApp Link: ${shareUrl || ''}`.trim(),
      };
      
      if (uris.length === 1) {
        shareOptions.url = uris[0];
      } else {
        shareOptions.urls = uris;
      }
      
      await Share.open(shareOptions);
    } catch (error) {
      console.log('Error sharing image', error);
      setIsCapturing(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBg}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>Share {title}</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Icon name="x" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Theme Selector */}
          <View style={styles.themeSelectorWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.themeScrollContainer}
            >
              {THEMES.map(theme => {
                const isActive = activeTheme === theme.key;
                return (
                  <TouchableOpacity
                    key={theme.key}
                    style={[styles.themeItem, isActive && { borderBottomColor: theme.color, borderBottomWidth: 2.5 }]}
                    onPress={() => setActiveTheme(theme.key)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.themeIconBg, isActive && { backgroundColor: `${theme.color}22` }]}>
                      <Icon
                        name={theme.icon}
                        size={16}
                        color={isActive ? theme.color : colors.textSecondary}
                      />
                    </View>
                    <Text style={[styles.themeItemText, isActive && { color: theme.color, fontFamily: Typography.fontFamily.bold }]}>
                      {theme.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Preview Area */}
          <ScrollView
            style={styles.previewScroll}
            contentContainerStyle={styles.previewContainer}
            showsVerticalScrollIndicator={false}
          >
            {React.Children.map(children, (child, index) => {
              if (React.isValidElement(child)) {
                return (
                  <View
                    key={`${activeTheme}_${index}`}
                    ref={el => {
                      if (!viewShotRefs.current) viewShotRefs.current = {};
                      viewShotRefs.current[index] = el;
                    }}
                    collapsable={false}
                    style={[styles.viewShotContainer, index > 0 && { marginTop: Spacing.xl }]}
                  >
                    {React.cloneElement(child, { theme: activeTheme, key: activeTheme, shareUrl })}
                  </View>
                );
              }
              return child;
            })}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={onClose} activeOpacity={0.7}>
              <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.shareBtn]} onPress={handleShare} disabled={isCapturing} activeOpacity={0.85}>
              {isCapturing ? <ActivityIndicator color={colors.textOnPrimary} /> : (
                <>
                  <Icon name="share-2" size={18} color={colors.textOnPrimary} style={{ marginRight: 8 }} />
                  <Text style={styles.actionBtnText}>Share Poster</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default SharePreviewModal;
