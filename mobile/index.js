/**
 * @format
 */

import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
enableScreens(false);
import {AppRegistry, DeviceEventEmitter} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';

// Compatibility shim for legacy native modules invoking RCTEventEmitter in Bridgeless Mode (RN 0.86)
const rctEventEmitterShim = {
  receiveEvent(tag, topLevelType, data) {
    if (typeof topLevelType === 'string') {
      DeviceEventEmitter.emit(topLevelType, data);
    }
  },
  receiveTouches() {},
};

if (typeof global.RN$registerCallableModule === 'function') {
  global.RN$registerCallableModule('RCTEventEmitter', () => rctEventEmitterShim);
}
try {
  const BatchedBridge = require('react-native/Libraries/BatchedBridge/BatchedBridge').default;
  if (BatchedBridge && typeof BatchedBridge.registerCallableModule === 'function') {
    BatchedBridge.registerCallableModule('RCTEventEmitter', rctEventEmitterShim);
  }
} catch (e) {}

messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Message handled in the background!', remoteMessage);
});

AppRegistry.registerComponent(appName, () => App);

