import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers } from 'redux';

import authReducer from '../features/auth/authSlice';
import userReducer from '../features/user/userSlice';
import turfReducer from '../features/turf/turfSlice';
import bookingReducer from '../features/booking/bookingSlice';
import slotReducer from '../features/slot/slotSlice';
import matchReducer from '../features/match/matchSlice';
import playerReducer from '../features/player/playerSlice';
import teamReducer from '../features/team/teamSlice';
import tournamentReducer from '../features/tournament/tournamentSlice';
import walletReducer from '../features/wallet/walletSlice';
import notificationReducer from '../features/notification/notificationSlice';
import ownerReducer from '../features/owner/ownerSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  user: userReducer,
  turf: turfReducer,
  booking: bookingReducer,
  slot: slotReducer,
  match: matchReducer,
  player: playerReducer,
  team: teamReducer,
  tournament: tournamentReducer,
  wallet: walletReducer,
  notification: notificationReducer,
  owner: ownerReducer,
});

const persistConfig = {
  key: 'root',
  version: 1,
  storage: AsyncStorage,
  whitelist: ['auth', 'user'], // Only persist auth & user session
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export default store;
