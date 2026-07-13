import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SplashScreen from '../features/auth/screens/SplashScreen';
import OnboardingScreen from '../features/auth/screens/OnboardingScreen';
import LoginScreen from '../features/auth/screens/LoginScreen';
import OTPVerifyScreen from '../features/auth/screens/OTPVerifyScreen';

const Stack = createNativeStackNavigator();

const AuthNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Onboarding">
    <Stack.Screen name="Onboarding" component={OnboardingScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="OTPVerify" component={OTPVerifyScreen} />
  </Stack.Navigator>
);

export default AuthNavigator;
