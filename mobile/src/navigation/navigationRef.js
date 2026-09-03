import React from 'react';
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export const navigate = (name, params) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
};

export const goBack = () => {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
};

export const reset = (name, params) => {
  if (navigationRef.isReady()) {
    try {
      navigationRef.reset({ index: 0, routes: [{ name, params }] });
    } catch (e) {
      // Ignored if navigator is currently transitioning or remounting
    }
  }
};
