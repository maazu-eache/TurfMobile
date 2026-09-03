import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme, Typography } from "../../../theme/theme";

const DummyScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.text, { color: colors.textPrimary }]}>Coming Soon</Text>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
        <Text style={{ color: colors.primary, fontFamily: Typography.fontFamily.semiBold }}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontFamily: Typography.fontFamily.bold, fontSize: 24 }
});
export default DummyScreen;
