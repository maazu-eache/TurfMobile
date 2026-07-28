import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Share from 'react-native-share';
import Icon from 'react-native-vector-icons/Feather';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, BorderRadius, Spacing } from '../../../theme/theme';

const THEMES = [
  { key: 'Aesthetic', label: 'Glass',    icon: 'layers',         iconSet: 'feather',   color: '#A8B5D1' },
  { key: 'Hype',      label: 'Liquid',   icon: 'droplet',        iconSet: 'feather',   color: '#00F2FE' },
  { key: 'Aura',      label: 'Aura',     icon: 'star',           iconSet: 'feather',   color: '#A855F7' },
  { key: 'Chrome',    label: 'Metal',    icon: 'cpu',            iconSet: 'feather',   color: '#C0C0C0' },
  { key: 'Cyber',     label: 'Cyber',    icon: 'zap',            iconSet: 'feather',   color: '#FF0055' },
  { key: 'Drip',      label: 'Premium',  icon: 'award',          iconSet: 'feather',   color: '#F5A623' },
];

const SharePreviewModal = ({ visible, onClose, title, shareUrl, children }) => {
  const viewShotRefs = useRef({});
  const [activeTheme, setActiveTheme] = useState('Aesthetic');
  const [isCapturing, setIsCapturing] = useState(false);

  const handleShare = async () => {
    try {
      setIsCapturing(true);
      await new Promise(resolve => setTimeout(resolve, 300));
      const uris = [];
      const keys = Object.keys(viewShotRefs.current || {}).sort((a,b) => parseInt(a) - parseInt(b));
      
      for (const key of keys) {
        const ref = viewShotRefs.current[key];
        if (ref) {
          const uri = await captureRef(ref, {
            format: 'png',
            quality: 1,
          });
          uris.push(uri);
        }
      }
      
      setIsCapturing(false);
      if (uris.length === 0) return;
      
      const shareOptions = {
        title: 'Share Poster',
        message: `Check out ${title} on SportVerse! ${shareUrl || ''}`.trim(),
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

  const activeThemeObj = THEMES.find(t => t.key === activeTheme) || THEMES[0];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBg}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Share {title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Theme Selector */}
          <View style={styles.themeSelectorWrapper}>
            <View style={styles.themeRow}>
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
                        color={isActive ? theme.color : Colors.textSecondary}
                      />
                    </View>
                    <Text style={[styles.themeItemText, isActive && { color: theme.color, fontFamily: Typography.fontFamily.bold }]}>
                      {theme.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
                    {React.cloneElement(child, { theme: activeTheme, key: activeTheme })}
                  </View>
                );
              }
              return child;
            })}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={onClose}>
              <Text style={[styles.actionBtnText, { color: Colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.shareBtn]} onPress={handleShare} disabled={isCapturing}>
              {isCapturing ? <ActivityIndicator color="#011528" /> : (
                <>
                  <Icon name="share-2" size={18} color="#011528" style={{ marginRight: 8 }} />
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

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  modalContainer: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },

  // Theme Selector
  themeSelectorWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  themeItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
    gap: 4,
  },
  themeIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  themeItemText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Preview
  previewScroll: {
    backgroundColor: '#090D16',
  },
  previewContainer: {
    padding: Spacing.lg,
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
    borderTopColor: Colors.border,
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
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shareBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
  },
  actionBtnText: {
    color: '#011528',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 16,
  },
});

export default SharePreviewModal;
