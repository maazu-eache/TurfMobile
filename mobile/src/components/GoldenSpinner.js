import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Rect, G, Defs, LinearGradient, Stop, Filter, FeGaussianBlur, FeMerge, FeMergeNode } from 'react-native-svg';
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const GoldenSpinner = ({ size = 20 }) => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(animValue, {
        toValue: 12,
        duration: 1000,
        useNativeDriver: true,
        isInteraction: false,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [animValue]);

  const getOpacity = (i) => {
    const inputRange = [];
    const outputRange = [];
    
    for (let val = 0; val <= 12; val++) {
      inputRange.push(val);
      const activeIdx = val % 12;
      const diff = (activeIdx - i + 12) % 12;
      
      // Decays smoothly: active segment has opacity 1.0, trailing segments gradually fade out to 0.15
      const opacity = Math.max(0.15, 1 - (diff * 0.08));
      outputRange.push(opacity);
    }
    
    return animValue.interpolate({
      inputRange,
      outputRange,
    });
  };

  const segments = Array.from({ length: 12 });

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          {/* Metallic Golden Gradient */}
          <LinearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFD54F" />
            <Stop offset="50%" stopColor="#FFC107" />
            <Stop offset="100%" stopColor="#E6A100" />
          </LinearGradient>
          
          {/* Soft Golden Glow Filter */}
          <Filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <FeGaussianBlur stdDeviation="3.5" result="blur" />
            <FeMerge>
              <FeMergeNode in="blur" />
              <FeMergeNode in="SourceGraphic" />
            </FeMerge>
          </Filter>
        </Defs>

        <G>
          {segments.map((_, i) => {
            const angle = i * 30; // 360 / 12 = 30 degrees
            const opacity = getOpacity(i);
            
            return (
              <G key={i} transform={`rotate(${angle}, 50, 50)`}>
                <AnimatedRect
                  x={46.5} // Centered pill: width = 7
                  y={12}    // Pill height = 22
                  width={7}
                  height={22}
                  rx={3.5}
                  ry={3.5}
                  fill="url(#goldGradient)"
                  filter="url(#glow)"
                  style={{ opacity }}
                />
              </G>
            );
          })}
        </G>
      </Svg>
    </View>
  );
};

export default GoldenSpinner;
