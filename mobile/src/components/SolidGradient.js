import React from 'react';
import { View } from 'react-native';

const SolidGradient = ({ colors, style, children, start, end, locations, ...rest }) => {
  // Use the first color from the array, or transparent if none
  let backgroundColor = 'transparent';
  if (colors && colors.length > 0) {
    backgroundColor = colors[0];
  }
  return (
    <View style={[style, { backgroundColor }]} {...rest}>
      {children}
    </View>
  );
};

export default SolidGradient;
