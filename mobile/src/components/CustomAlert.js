import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme/theme';

export const customAlertRef = React.createRef();

export const showCustomAlert = (title, message, buttons) => {
  customAlertRef.current?.show(title, message, buttons);
};

const CustomAlert = forwardRef((props, ref) => {
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

  const handlePress = (onPress) => {
    setVisible(false);
    if (onPress) onPress();
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={() => setVisible(false)}>
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
                  buttons.length <= 2 && index > 0 && { borderLeftWidth: 1, borderLeftColor: Colors.border },
                  buttons.length > 2 && index > 0 && { borderTopWidth: 1, borderTopColor: Colors.border },
                  buttons.length > 2 && { flex: 0, width: '100%', paddingVertical: 14 },
                  btn.style === 'destructive' && { backgroundColor: 'rgba(244,67,54,0.1)' }
                ]}
                onPress={() => handlePress(btn.onPress)}
              >
                <Text style={[
                  styles.buttonText,
                  btn.style === 'destructive' && { color: Colors.error },
                  btn.style === 'cancel' && { color: Colors.textSecondary }
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  alertBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: Spacing.xl,
    marginHorizontal: Spacing.lg,
  },
  message: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    marginHorizontal: Spacing.lg,
  },
  buttonContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
  }
});

export default CustomAlert;
