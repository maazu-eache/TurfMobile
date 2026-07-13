import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Typography } from '../../../theme/theme';

const DummyScreen = ({ navigation, route }) => (
  <View style={styles.container}>
    <Text style={styles.text}>Coming Soon</Text>
    <TouchableOpacity onPress={() => navigation.goBack()} style={{marginTop: 20}}>
      <Text style={{color: Colors.primary}}>Go Back</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  text: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 24 }
});
export default DummyScreen;
