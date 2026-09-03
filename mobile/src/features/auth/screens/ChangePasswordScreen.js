import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Keyboard, StatusBar } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { changePassword, clearError } from '../authSlice';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: Spacing['3xl'] },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing['2xl'] },
  backBtn: { 
    width: 44, height: 44, borderRadius: 22, backgroundColor: isDark ? colors.surface : colors.surfaceVariant, 
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  headerTitle: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  card: {
    backgroundColor: colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl,
    borderWidth: 1, borderColor: colors.border,
    ...(isDark ? {} : shadows.sm),
  },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: BorderRadius.lg,
    backgroundColor: isDark ? colors.background : colors.surfaceVariant, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: Spacing.md,
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: isDark ? colors.backgroundElevated : colors.surface },
  inputIcon: { marginRight: Spacing.sm },
  eyeIcon: { padding: Spacing.xs },
  input: { flex: 1, color: colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.md },
  error: { color: colors.error, fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, marginTop: Spacing.md, textAlign: 'center' },
  actionBtn: {
    height: 56, borderRadius: BorderRadius.lg, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xl,
    ...shadows.md,
  },
  actionBtnText: { fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.bold, color: colors.textOnPrimary },
});

const ChangePasswordScreen = ({ navigation }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [focusedInput, setFocusedInput] = useState(null);
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);
  const insets = useSafeAreaInsets();

  const handleChangePassword = async () => {
    if (!currentPassword) return showCustomAlert('Error', 'Please enter your current password');
    if (!newPassword) return showCustomAlert('Error', 'Please enter a new password');
    if (newPassword !== confirmPassword) return showCustomAlert('Error', 'New passwords do not match');
    
    Keyboard.dismiss();
    dispatch(clearError());

    const result = await dispatch(changePassword({ currentPassword, newPassword }));

    if (changePassword.fulfilled.match(result)) {
      showCustomAlert('Success', 'Password changed successfully!');
      navigation.goBack();
    } else {
      showCustomAlert('Error', result.payload || 'Failed to change password');
    }
  };

  const renderInput = (id, icon, placeholder, value, setValue, showPassword, setShowPassword) => {
    const isFocused = focusedInput === id;
    return (
      <View style={[styles.inputContainer, isFocused && styles.inputFocused]}>
        <Icon name={icon} size={22} color={isFocused ? (isDark ? colors.primary : colors.primaryDark) : colors.textTertiary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={setValue}
          onFocus={() => setFocusedInput(id)}
          onBlur={() => setFocusedInput(null)}
          selectionColor={colors.primary}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon} activeOpacity={0.7}>
          <Icon name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <KeyboardAwareScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.md }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Icon name="chevron-left" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Change Password</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.card}>
          {renderInput('currentPassword', 'lock-outline', 'Current Password', currentPassword, setCurrentPassword, showCurrentPassword, setShowCurrentPassword)}
          <View style={{ height: Spacing.md }} />
          {renderInput('newPassword', 'lock-reset', 'New Password', newPassword, setNewPassword, showNewPassword, setShowNewPassword)}
          <View style={{ height: Spacing.md }} />
          {renderInput('confirmPassword', 'lock-check-outline', 'Confirm New Password', confirmPassword, setConfirmPassword, showConfirmPassword, setShowConfirmPassword)}
          
          {error ? <Text style={styles.error}>{error}</Text> : null}
          
          <TouchableOpacity style={styles.actionBtn} onPress={handleChangePassword} disabled={isLoading} activeOpacity={0.85}>
            {isLoading ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.actionBtnText}>Update Password</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default ChangePasswordScreen;
