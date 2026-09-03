import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme, Typography } from "../../../theme/theme";

const DummyScreen = ({ navigation, route }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Playing XI - Coming Soon</Text>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
        <Text style={{ color: colors.primary, fontFamily: Typography.fontFamily.semiBold }}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  text: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 24 }
});

export default DummyScreen;
