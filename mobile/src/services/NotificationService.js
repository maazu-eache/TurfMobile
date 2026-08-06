import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import api from '../api/axios';

class NotificationService {
  async requestUserPermission() {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Notification permission granted.');
        }
      } catch (err) {
        console.warn(err);
      }
    }

    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('Authorization status:', authStatus);
      return this.getFCMToken();
    }
    return null;
  }

  async getFCMToken() {
    try {
      const fcmToken = await messaging().getToken();
      if (fcmToken) {
        console.log('FCM Token:', fcmToken);
        await this.syncTokenWithBackend(fcmToken);
        return fcmToken;
      }
    } catch (error) {
      console.log('Error getting FCM token', error);
    }
    return null;
  }

  async syncTokenWithBackend(token) {
    try {
      // Sync token with backend if user is authenticated
      await api.put('/users/me', { fcmToken: token });
      console.log('✅ FCM Token synced with backend successfully!');
    } catch (error) {
      console.log('Could not sync token:', error.response?.data?.message || error.message);
    }
  }

  listenToForegroundMessages(callback) {
    return messaging().onMessage(async remoteMessage => {
      console.log('A new FCM message arrived in the foreground!', remoteMessage);
      
      // Request permissions (required for iOS)
      await notifee.requestPermission();

      // Create a channel (required for Android)
      const channelId = await notifee.createChannel({
        id: 'scoreverse_alerts',
        name: 'ScoreVerse Alerts',
        importance: AndroidImportance.HIGH,
        sound: 'notifications', // matches notifications.mp3 in res/raw (omit extension)
      });

      // Display a notification
      await notifee.displayNotification({
        title: remoteMessage.notification?.title || 'New Notification',
        body: remoteMessage.notification?.body || '',
        data: remoteMessage.data,
        android: {
          channelId,
          smallIcon: 'ic_launcher', // fallback to default icon
          sound: 'notifications', // matches notifications.mp3 in res/raw (omit extension)
          pressAction: {
            id: 'default',
          },
        },
        ios: {
          sound: 'Notifications.mp3', // include extension on iOS
        },
      });

      if (callback) callback(remoteMessage);
    });
  }

  listenToBackgroundMessages() {
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('Message handled in the background!', remoteMessage);
    });
  }

  async getInitialNotification() {
    return await messaging().getInitialNotification();
  }

  onNotificationOpenedApp(callback) {
    return messaging().onNotificationOpenedApp(callback);
  }
}

export default new NotificationService();
