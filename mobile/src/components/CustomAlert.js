import React, { useState, forwardRef, useImperativeHandle, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useTheme, Typography, Spacing, BorderRadius } from '../theme/theme';

export const customAlertRef = React.createRef();

export const showCustomAlert = (title, message, buttons) => {
  customAlertRef.current?.show(title, message, buttons);
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.blackAlpha50,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  alertBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.lg,
  },
  title: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: Spacing.xl,
    marginHorizontal: Spacing.lg,
  },
  message: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    marginHorizontal: Spacing.lg,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonText: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: isDark ? colors.primary : colors.primaryDark,
    textAlign: 'center',
  }
});

const CustomAlert = forwardRef((props, ref) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);

  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [buttons, setButtons] = useState([]);

  useImperativeHandle(ref, () => ({
    show: (t, m, b) => {
      setTitle(t);
      setMessage(m);
      setButtons(b || [{ text: 'OK' }]);
      setVisible(true);
    },
    hide: () => setVisible(false),
  }));

  React.useEffect(() => {
    if (visible && buttons.length <= 1) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [visible, buttons]);

  const handlePress = (onPress) => {
    setVisible(false);
    if (onPress) onPress();
  };

  if (!visible) return null;

  return (
    <Modal transparent statusBarTranslucent animationType="fade" visible={visible} onRequestClose={() => setVisible(false)}>
      <View style={styles.overlay}>
        <View style={styles.alertBox}>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          
          <View style={[styles.buttonContainer, buttons.length > 2 && { flexDirection: 'column' }]}>
            {buttons.map((btn, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  buttons.length <= 2 && index > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border },
                  buttons.length > 2 && index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                  buttons.length > 2 && { flex: 0, width: '100%', paddingVertical: 14 },
                  btn.style === 'destructive' && { backgroundColor: colors.errorLight }
                ]}
                onPress={() => handlePress(btn.onPress)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.buttonText,
                  btn.style === 'destructive' && { color: colors.error },
                  btn.style === 'cancel' && { color: colors.textSecondary }
                ]}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
});

export default CustomAlert;
