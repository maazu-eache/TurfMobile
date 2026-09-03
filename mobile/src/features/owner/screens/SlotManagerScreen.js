import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, Modal, TextInput, Animated, StatusBar,
  Platform, KeyboardAvoidingView, PermissionsAndroid, NativeModules
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Circle } from 'react-native-svg';
import LinearGradient from '../../../components/SolidGradient';
import { useSelector } from 'react-redux';
import { Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { useTheme } from '../../../theme/ThemeContext';
import api from '../../../api/axios';
import { formatISTTime } from '../../../utils/dateFormatter';
import { showCustomAlert } from '../../../components/CustomAlert';
import DateTimePicker from '@react-native-community/datetimepicker';
import moment from 'moment';
import Tts from 'react-native-tts';
import Voice from '@react-native-voice/voice';

const isPastSlot = (selectedDate, startTime) => {
  const slotStart = moment(`${selectedDate} ${startTime}`, 'YYYY-MM-DD HH:mm').utcOffset("+05:30", true);
  return slotStart.isBefore(moment().utcOffset("+05:30"));
};

const getTimeGroup = (timeStr) => {
  const hour = parseInt(timeStr.split(':')[0], 10);
  if (hour >= 0 && hour < 6) return 'early_morning';
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 16) return 'afternoon';
  if (hour >= 16 && hour < 20) return 'evening';
  return 'night';
};

const getCurrentTimeGroup = () => {
  const hour = moment().utcOffset("+05:30").hour();
  if (hour >= 0 && hour < 6) return 'early_morning';
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 16) return 'afternoon';
  if (hour >= 16 && hour < 20) return 'evening';
  return 'night';
};

const generateDates = (startDate = new Date()) => {
  const dates = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
};

const VOICE_ASSISTANT_ENABLED = false;

const TIME_OPTIONS = [];
for (let h = 0; h < 24; h++) {
  const hr = h.toString().padStart(2, '0');
  TIME_OPTIONS.push(`${hr}:00`);
  TIME_OPTIONS.push(`${hr}:30`);
}

const SlotManagerScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark, shadows), [colors, isDark, shadows]);
  const { dashboard } = useSelector((state) => state.owner);
  const turfs = dashboard?.owner?.turfs || [];
  
  const [selectedTurf, setSelectedTurf] = useState(turfs[0]?._id || null);
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  // Voice Assistant states
  const [voiceAssistantVisible, setVoiceAssistantVisible] = useState(false);
  const [voiceState, setVoiceState] = useState('IDLE');
  const [voiceDraft, setVoiceDraft] = useState(null);
  const [voiceText, setVoiceText] = useState('');
  const [assistantMessages, setAssistantMessages] = useState([]);
  const scrollRef = useRef(null);

  // STT states
  const [isListening, setIsListening] = useState(false);
  const [partialText, setPartialText] = useState('');
  const micPulse = useRef(new Animated.Value(1)).current;
  
  const [dates, setDates] = useState(generateDates());
  const [selectedSlots, setSelectedSlots] = useState([]);
  const activeTurf = turfs.find(t => t._id === selectedTurf);
  const [selectedIntervalMode, setSelectedIntervalMode] = useState('60');
  const [filterFromTime, setFilterFromTime] = useState('');
  const [filterToTime, setFilterToTime] = useState('');
  const [showNativeFromPicker, setShowNativeFromPicker] = useState(false);
  const [showNativeToPicker, setShowNativeToPicker] = useState(false);
  const [showFilteredSlotsModal, setShowFilteredSlotsModal] = useState(false);
  const [modalSelectedSlots, setModalSelectedSlots] = useState([]);

  const databaseHas30MinSlots = React.useMemo(() => {
    if (!slots || slots.length === 0) return false;
    return slots.some(s => {
      const diff = moment(s.endTime, 'HH:mm').diff(moment(s.startTime, 'HH:mm'), 'minutes');
      return diff === 30;
    });
  }, [slots]);

  useEffect(() => {
    if (slots && slots.length > 0 && !databaseHas30MinSlots) {
      setSelectedIntervalMode('60');
    }
  }, [slots, databaseHas30MinSlots]);

  useEffect(() => {
    if (activeTurf) {
      setSelectedIntervalMode(
        activeTurf.bookingMode === 'both' ? '60' : (activeTurf.bookingMode === '30_min' ? '30' : '60')
      );
    }
  }, [selectedTurf, activeTurf]);
  
  // Audio Mute State
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);

  const toggleMute = () => {
    const newVal = !isMuted;
    setIsMuted(newVal);
    isMutedRef.current = newVal;
    if (newVal) {
      Tts.stop();
    }
  };

  const speakTts = (text) => {
    if (isMutedRef.current) return;
    Tts.stop();
    Tts.speak(text);
  };

  // Time Groups State
  const [expandedGroup, setExpandedGroup] = useState(getCurrentTimeGroup());

  // Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [turfModalVisible, setTurfModalVisible] = useState(false);
  const [actionType, setActionType] = useState('available');
  const [offlineDetails, setOfflineDetails] = useState({ customerName: '', customerMobile: '', amount: '', reason: 'walk_in' });
  
  // Discount States
  const [discountModalVisible, setDiscountModalVisible] = useState(false);
  const [discountMode, setDiscountMode] = useState('single'); // 'single' or 'extend'
  const [discountPrice, setDiscountPrice] = useState('');
  const [discountStartDate, setDiscountStartDate] = useState(moment().format('YYYY-MM-DD'));
  const [discountEndDate, setDiscountEndDate] = useState(moment().add(7, 'days').format('YYYY-MM-DD'));

  // Bulk Search / Update Modals
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [bulkData, setBulkData] = useState({
    startDate: '', endDate: '', startTime: '', endTime: '', action: 'status',
    daysOfWeek: [], 
    actionData: { status: 'available', price: 0, customerName: '', customerMobile: '', amount: 0, reason: 'walk_in' }
  });
  const [previewResult, setPreviewResult] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Pickers and Custom JS Calendar
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(moment().startOf('month'));
  const [activePicker, setActivePicker] = useState('none'); 
  
  const getOriginalPriceText = () => {
    if (selectedSlots.length === 0) return '';
    const selectedSlotObjs = slots.filter(s => selectedSlots.includes(s._id));
    if (selectedSlotObjs.length === 0) return '';
    const prices = selectedSlotObjs.map(s => s.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    if (minPrice === maxPrice) return `₹${minPrice}`;
    return `₹${minPrice} - ₹${maxPrice}`;
  };

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handleDiscountSubmit = async () => {
    if (!discountPrice) {
      return showCustomAlert('Missing Info', 'Please enter a discounted price.');
    }
    try {
      setLoading(true);
      await api.post('/slots/discount', {
        turfId: selectedTurf,
        slotIds: selectedSlots,
        mode: discountMode,
        discountPrice: Number(discountPrice),
        startDate: discountMode === 'extend' ? discountStartDate : undefined,
        endDate: discountMode === 'extend' ? discountEndDate : undefined,
      });
      setDiscountModalVisible(false);
      setDiscountPrice('');
      setSelectedSlots([]);
      fetchSlots();
      showCustomAlert('Success', 'Discount applied successfully.');
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to apply discount');
    } finally {
      setLoading(false);
    }
  };

  const handleClearDiscount = async () => {
    try {
      setLoading(true);
      await api.post('/slots/discount', {
        turfId: selectedTurf,
        slotIds: selectedSlots,
        mode: discountMode,
        discountPrice: null,
        startDate: discountMode === 'extend' ? discountStartDate : undefined,
        endDate: discountMode === 'extend' ? discountEndDate : undefined,
      });
      setDiscountModalVisible(false);
      setDiscountPrice('');
      setSelectedSlots([]);
      fetchSlots();
      showCustomAlert('Success', 'Discount cleared successfully.');
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to clear discount');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    Tts.setDefaultLanguage('en-IN').catch(() => {
      Tts.setDefaultLanguage('en-US').catch(() => {});
    });
    Tts.setDefaultRate(0.46);
    Tts.setDefaultPitch(0.85);

    // Query and set system male voice
    Tts.voices().then(voices => {
      let maleVoice = voices.find(v => 
        (v.language.startsWith('en-IN') || v.language.startsWith('en-US')) && 
        (String(v.gender).toLowerCase() === 'male' ||
         v.name.toLowerCase().includes('male') || 
         v.name.toLowerCase().includes('guy') ||
         v.id.toLowerCase().includes('male') ||
         v.id.toLowerCase().includes('guy'))
      );
      
      if (!maleVoice) {
        // Fallback search for common Google TTS male voices on Android
        maleVoice = voices.find(v => 
          (v.id.includes('en-in-x-ene') || 
           v.id.includes('en-us-x-iom') || 
           v.id.includes('en-us-x-iol') || 
           v.id.includes('en-us-x-tgf') || 
           v.id.includes('en-us-x-jot'))
        );
      }

      if (maleVoice) {
        Tts.setDefaultVoice(maleVoice.id).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // ── Voice Recognition (STT) Setup ─────────────────────────────
  useEffect(() => {
    Voice.onSpeechStart = () => {
      setIsListening(true);
      setPartialText('');
    };

    Voice.onSpeechPartialResults = (e) => {
      const partial = e.value?.[0] || '';
      setPartialText(partial);
      setVoiceText(partial);
    };

    Voice.onSpeechResults = (e) => {
      const recognized = e.value?.[0] || '';
      setIsListening(false);
      setPartialText('');
      if (recognized.trim()) {
        setVoiceText(recognized);
        // Auto-send after a brief delay so the user can see the text
        setTimeout(() => sendVoiceMessage(recognized), 300);
      }
    };

    Voice.onSpeechError = (e) => {
      setIsListening(false);
      setPartialText('');
      const errCode = e.error?.code;
      // 7 = no match, 5 = client error — don't alert on these, just stop
      if (errCode !== '7' && errCode !== '5') {
        showCustomAlert('Mic Error', e.error?.message || 'Speech recognition failed. Try typing instead.');
      }
    };

    Voice.onSpeechEnd = () => {
      setIsListening(false);
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners).catch(() => {});
    };
  }, []);

  // Pulse animation for the mic button while listening
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(micPulse, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(micPulse, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      micPulse.stopAnimation();
      Animated.timing(micPulse, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [isListening]);

  const requestMicPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'Voice Booking Assistant needs access to your microphone to take bookings by voice.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch {
        return false;
      }
    }
    return true; // iOS permission handled via Info.plist
  };

  const startListening = async () => {
    if (isListening) {
      try { await Voice.stop(); } catch { /* ignore */ }
      setIsListening(false);
      return;
    }
    // Stop TTS so it doesn't interfere with recognition
    Tts.stop();

    if (!NativeModules.Voice) {
      showCustomAlert('Mic Error', 'Voice module is not compiled in this build. Please run "npm run android" inside the mobile directory to compile the native modules.');
      return;
    }

    const hasPermission = await requestMicPermission();
    if (!hasPermission) {
      showCustomAlert('Permission Denied', 'Microphone access is required. Enable it in Settings.');
      return;
    }
    try {
      setVoiceText('');
      setPartialText('');
      await Voice.start('en-IN');
    } catch (e) {
      setIsListening(false);
      console.log('Voice start error:', e);
      showCustomAlert('Mic Error', e.message ? `Could not start voice recognition: ${e.message}. Try typing instead.` : 'Could not start voice recognition. Try typing instead.');
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
    } catch { /* ignore */ }
    setIsListening(false);
  };

  const sendVoiceMessage = async (text) => {
    if (!text.trim()) return;
    const newMsg = { sender: 'owner', text };
    setAssistantMessages(prev => [...prev, newMsg]);
    setVoiceText('');
    
    setLoading(true);
    try {
      const res = await api.post('/bookings/voice-dialogue', {
        turfId: selectedTurf,
        voiceText: text,
        currentState: voiceState,
        currentDraft: voiceDraft
      });
      
      const data = res.data.data;
      
      setAssistantMessages(prev => [...prev, { sender: 'assistant', text: data.speechText }]);
      setVoiceState(data.nextState);
      setVoiceDraft(data.draft);
      
      speakTts(data.speechText);
      
      if (data.success && data.nextState === 'IDLE') {
        fetchSlots();
        showCustomAlert('Success', 'Offline booking created successfully.');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to process voice command';
      setAssistantMessages(prev => [...prev, { sender: 'assistant', text: errMsg }]);
      speakTts(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTurf) {
      fetchSlots();
      setSelectedSlots([]); // Clear selections on date/turf change
    }
  }, [selectedTurf, selectedDate]);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/slots/${selectedTurf}/${selectedDate}`);
      setSlots(res.data.data);
    } catch (err) {
      showCustomAlert('Error', 'Failed to fetch slots');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOfflineSlot = async (slotId, status) => {
    try {
      setLoading(true);
      await api.put(`/slots/${slotId}`, { status });
      fetchSlots();
      showCustomAlert('Success', `Slot status updated to ${status}.`);
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to update slot status');
    } finally {
      setLoading(false);
    }
  };

  const handleSlotPress = (slot) => {
    if (slot.isMerged) {
      const bookedOrig = slot.originalSlots.find(os => os.status === 'booked' || os.status === 'offline_booking');
      const allBooked = slot.originalSlots.every(os => os.status === 'booked' || os.status === 'offline_booking');
      if (bookedOrig) {
        if (!allBooked) {
          // Switch to 30 Mins mode if partially booked
          setSelectedIntervalMode('30');
          return;
        }
        return handleSlotPress(bookedOrig);
      }
      
      const allSelected = slot.originalSlots.every(os => selectedSlots.includes(os._id));
      if (allSelected) {
        const idsToRemove = slot.originalSlots.map(os => os._id);
        setSelectedSlots(prev => prev.filter(id => !idsToRemove.includes(id)));
      } else {
        const toAdd = slot.originalSlots.map(os => os._id).filter(id => !selectedSlots.includes(id));
        setSelectedSlots(prev => [...prev, ...toAdd]);
      }
      return;
    }

    const isBooked = slot.status === 'booked' || slot.status === 'offline_booking';
    
    if (isBooked) {
      if (slot.booking) {
        const b = slot.booking;
        const userName = b.user?.name ? b.user.name : 'Unknown User';
        const userPhone = b.user?.phone ? b.user.phone : '';
        const amt = b.totalAmount || b.finalAmount || slot.price;
        const refStr = b.bookingRef || b._id.substring(0, 8);
        return showCustomAlert('Booking Details', `Ref: ${refStr}\nUser: ${userName} ${userPhone ? `(${userPhone})` : ''}\nAmount: ₹${amt}\nStatus: ${b.status.toUpperCase()}`);
      } else if (slot.status === 'offline_booking') {
        const ob = slot.offlineBooking;
        let detailsStr = 'This slot was booked offline/walk-in.';
        if (ob) {
          const custName = ob.customerName || 'Unknown Customer';
          const custPhone = ob.customerMobile || '-';
          const amt = ob.amount || 0;
          const notes = ob.notes || ob.reason || '-';
          detailsStr = `Customer: ${custName}\nPhone: ${custPhone}\nAmount: ₹${amt}\nNotes/Reason: ${notes}`;
        }
        return showCustomAlert('Offline Booking Details', detailsStr, [
          { text: 'Make Available', onPress: () => handleUpdateOfflineSlot(slot._id, 'available') },
          { text: 'Mark Maintenance', onPress: () => handleUpdateOfflineSlot(slot._id, 'maintenance') },
          { text: 'Cancel', style: 'cancel' }
        ]);
      }
      return showCustomAlert('Booked', 'This slot is already booked and cannot be changed.');
    }
    
    if (isPastSlot(selectedDate, slot.startTime)) {
      return showCustomAlert('Past Slot', 'This slot has already passed and cannot be managed.');
    }
    
    if (selectedSlots.includes(slot._id)) {
      setSelectedSlots(selectedSlots.filter(id => id !== slot._id));
    } else {
      setSelectedSlots([...selectedSlots, slot._id]);
    }
  };

  const handleQuickAction = async (type) => {
    if (type === 'offline_booking') {
      const totalSelectedPrice = selectedSlots.reduce((sum, id) => {
        const slotObj = slots.find(s => s._id === id);
        const price = slotObj?.discountPrice !== undefined && slotObj?.discountPrice !== null ? slotObj.discountPrice : (slotObj?.price || 0);
        return sum + price;
      }, 0);

      setActionType(type);
      setOfflineDetails({
        customerName: '',
        customerMobile: '',
        amount: totalSelectedPrice.toString(),
        reason: 'walk_in'
      });
      setModalVisible(true);
      return;
    }

    try {
      await api.post('/slots/bulk-update-ids', {
        turfId: selectedTurf,
        slotIds: selectedSlots,
        action: 'status',
        actionData: { status: type }
      });
      setSelectedSlots([]);
      fetchSlots();
      showCustomAlert('Success', `Selected slots marked as ${type}.`);
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to update slots');
    }
  };

  const handleOfflineBookingSubmit = async () => {
    try {
      await api.post('/slots/bulk-update-ids', {
        turfId: selectedTurf,
        slotIds: selectedSlots,
        action: 'offline_booking',
        actionData: {
          reason: offlineDetails.reason,
          customerName: offlineDetails.customerName,
          customerMobile: offlineDetails.customerMobile,
          amount: Number(offlineDetails.amount) / selectedSlots.length
        }
      });
      setModalVisible(false);
      setOfflineDetails({ customerName: '', customerMobile: '', amount: '', reason: 'walk_in' });
      setSelectedSlots([]);
      fetchSlots();
      showCustomAlert('Success', 'Offline bookings created.');
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to create offline bookings');
    }
  };

  const handleMobileChange = async (val) => {
    setOfflineDetails(prev => ({ ...prev, customerMobile: val }));
    if (val.trim().length === 10) {
      try {
        const response = await api.get(`/users/lookup/${val.trim()}`);
        if (response.data?.data?.exists) {
          const matchedUser = response.data.data.user;
          if (matchedUser && matchedUser.name) {
            setOfflineDetails(prev => ({ ...prev, customerName: matchedUser.name }));
          }
        }
      } catch (err) {
        console.log('Error looking up user by mobile:', err);
      }
    }
  };

  const handleBulkMobileChange = async (val) => {
    setBulkData(prev => ({
      ...prev,
      actionData: { ...prev.actionData, customerMobile: val }
    }));
    if (val.trim().length === 10) {
      try {
        const response = await api.get(`/users/lookup/${val.trim()}`);
        if (response.data?.data?.exists) {
          const matchedUser = response.data.data.user;
          if (matchedUser && matchedUser.name) {
            setBulkData(prev => ({
              ...prev,
              actionData: { ...prev.actionData, customerName: matchedUser.name }
            }));
          }
        }
      } catch (err) {
        console.log('Error looking up user by mobile:', err);
      }
    }
  };

  const toggleBulkDayOfWeek = (dayIndex) => {
    const current = bulkData.daysOfWeek;
    if (current.includes(dayIndex)) {
      setBulkData({ ...bulkData, daysOfWeek: current.filter(d => d !== dayIndex) });
    } else {
      setBulkData({ ...bulkData, daysOfWeek: [...current, dayIndex] });
    }
  };

  const resetPreview = () => setPreviewResult(null);

  const handlePreviewSlots = async () => {
    if (!bulkData.startDate || !bulkData.endDate) {
      return showCustomAlert('Missing Info', 'Please select a date range first.');
    }
    if (!bulkData.startTime || !bulkData.endTime) {
      return showCustomAlert('Missing Info', 'Please select both start and end times. Time range is required.');
    }
    setIsPreviewing(true);
    const { startTime, endTime, startDate, endDate } = bulkData;
    const isCrossMidnight = startTime && endTime && startTime > endTime;
    try {
      let fetchedSlots = [];
      if (isCrossMidnight) {
        const nextDayDaysOfWeek = bulkData.daysOfWeek.length > 0 
          ? bulkData.daysOfWeek.map(d => (d + 1) % 7) 
          : [];

        const [r1, r2] = await Promise.all([
          api.post('/slots/bulk-search', { turfId: selectedTurf, ...bulkData, endTime: '23:59' }),
          api.post('/slots/bulk-search', {
            turfId: selectedTurf, ...bulkData,
            startTime: '00:00',
            startDate: moment(startDate).add(1, 'day').format('YYYY-MM-DD'),
            endDate:   moment(endDate).add(1, 'day').format('YYYY-MM-DD'),
            daysOfWeek: nextDayDaysOfWeek
          }),
        ]);
        fetchedSlots = [...(r1.data.data || []), ...(r2.data.data || [])];
      } else {
        const r = await api.post('/slots/bulk-search', { turfId: selectedTurf, ...bulkData });
        fetchedSlots = r.data.data || [];
      }

      if (fetchedSlots.length === 0) {
        showCustomAlert('No Slots Found', 'No available slots matched your criteria.');
      } else {
        const defaultPrice = fetchedSlots[0]?.price ?? 0;
        setPreviewResult({ slots: fetchedSlots, customPrice: String(defaultPrice) });
      }
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to search slots');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (!previewResult) return;
    const { startTime, endTime, startDate, endDate } = bulkData;
    const isCrossMidnight = startTime && endTime && startTime > endTime;
    const customPrice = Number(previewResult.customPrice) || 0;
    const payload = {
      ...bulkData,
      actionData: {
        ...bulkData.actionData,
        price: customPrice,
        amount: bulkData.action === 'offline_booking' ? customPrice : bulkData.actionData.amount,
      },
    };

    try {
      if (isCrossMidnight) {
        const nextDayDaysOfWeek = bulkData.daysOfWeek.length > 0 
          ? bulkData.daysOfWeek.map(d => (d + 1) % 7) 
          : [];

        await Promise.all([
          api.post('/slots/bulk', { turfId: selectedTurf, ...payload, endTime: '23:59' }),
          api.post('/slots/bulk', {
            turfId: selectedTurf, ...payload,
            startTime: '00:00',
            startDate: moment(startDate).add(1, 'day').format('YYYY-MM-DD'),
            endDate:   moment(endDate).add(1, 'day').format('YYYY-MM-DD'),
            daysOfWeek: nextDayDaysOfWeek
          }),
        ]);
      } else {
        await api.post('/slots/bulk', { turfId: selectedTurf, ...payload });
      }
      setBulkModalVisible(false);
      setPreviewResult(null);
      showCustomAlert('Success', `Bulk action applied to ${previewResult.slots.length} slots!`);
      fetchSlots();
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to apply bulk update');
    }
  };

  const processedSlots = React.useMemo(() => {
    if (!slots) return [];
    
    let finalSlots = slots;
    
    if (selectedIntervalMode === '60' && databaseHas30MinSlots) {
      const merged = [];
      const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
      
      let i = 0;
      while (i < sorted.length) {
        const slot1 = sorted[i];
        const slot2 = sorted[i + 1];
        
        if (slot2 && slot1.endTime === slot2.startTime) {
          let discountPrice = null;
          if (slot1.discountPrice !== undefined && slot1.discountPrice !== null || 
              slot2.discountPrice !== undefined && slot2.discountPrice !== null) {
            const p1 = slot1.discountPrice !== undefined && slot1.discountPrice !== null ? slot1.discountPrice : slot1.price;
            const p2 = slot2.discountPrice !== undefined && slot2.discountPrice !== null ? slot2.discountPrice : slot2.price;
            discountPrice = p1 + p2;
          }

          merged.push({
            _id: `${slot1._id}_${slot2._id}`,
            isMerged: true,
            originalSlots: [slot1, slot2],
            startTime: slot1.startTime,
            endTime: slot2.endTime,
            price: slot1.price + slot2.price,
            discountPrice,
            status: (slot1.status === 'booked' || slot2.status === 'booked')
              ? 'booked'
              : (slot1.status === 'offline_booking' || slot2.status === 'offline_booking')
                ? 'offline_booking'
                : (slot1.status === 'maintenance' || slot2.status === 'maintenance')
                  ? 'maintenance'
                  : 'available',
          });
          i += 2;
        } else {
          i++;
        }
      }
      finalSlots = merged;
    }
    
    if (filterFromTime) {
      finalSlots = finalSlots.filter(s => s.startTime >= filterFromTime);
    }
    if (filterToTime) {
      finalSlots = finalSlots.filter(s => s.endTime <= filterToTime);
    }
    
    return finalSlots;
  }, [slots, selectedIntervalMode, activeTurf, filterFromTime, filterToTime]);

  const selectedDisplayCount = useMemo(() => {
    if (selectedIntervalMode === '60') {
      return processedSlots.filter(s => {
        if (s.isMerged) {
          return s.originalSlots.every(os => selectedSlots.includes(os._id));
        }
        return selectedSlots.includes(s._id);
      }).length;
    }
    return selectedSlots.length;
  }, [selectedIntervalMode, processedSlots, selectedSlots]);

  // Grouping slots logically
  const groupedSlots = {
    early_morning: processedSlots.filter(s => getTimeGroup(s.startTime) === 'early_morning'),
    morning: processedSlots.filter(s => getTimeGroup(s.startTime) === 'morning'),
    afternoon: processedSlots.filter(s => getTimeGroup(s.startTime) === 'afternoon'),
    evening: processedSlots.filter(s => getTimeGroup(s.startTime) === 'evening'),
    night: processedSlots.filter(s => getTimeGroup(s.startTime) === 'night'),
  };

  const renderDateItem = (dateObj) => {
    const mDate = moment(dateObj);
    const dateStr = mDate.format('YYYY-MM-DD');
    const isSelected = dateStr === selectedDate;
    
    return (
      <TouchableOpacity
        key={dateStr}
        style={[
          styles.dateBox,
          isSelected ? styles.dateBoxSelected : styles.dateBoxInactive
        ]}
        onPress={() => {
          setSelectedDate(dateStr);
          setDates(generateDates(dateObj));
        }}
        activeOpacity={0.85}
      >
        <Text style={[styles.dateDay, isSelected && styles.dateTextSelected]}>{mDate.format('ddd')}</Text>
        <Text style={[styles.dateNum, isSelected && styles.dateTextSelected]}>{mDate.format('DD')}</Text>
        <Text style={[styles.dateMonth, isSelected && styles.dateTextSelected]}>{mDate.format('MMM')}</Text>
      </TouchableOpacity>
    );
  };

  const renderSlotCard = (slot) => {
    const isSelected = slot.isMerged
      ? slot.originalSlots.every(os => selectedSlots.includes(os._id))
      : selectedSlots.includes(slot._id);
    const past = isPastSlot(selectedDate, slot.startTime);
    const isBooked = slot.status === 'booked';
    const isOffline = slot.status === 'offline_booking';
    const isMaintenance = slot.status === 'maintenance';

    const isPartiallyBooked = slot.isMerged && (() => {
      const s1Booked = slot.originalSlots[0].status === 'booked' || slot.originalSlots[0].status === 'offline_booking';
      const s2Booked = slot.originalSlots[1].status === 'booked' || slot.originalSlots[1].status === 'offline_booking';
      return (s1Booked && !s2Booked) || (!s1Booked && s2Booked);
    })();
    
    let cardStyle = styles.slotCardAvailable;
    let textStyle = styles.slotTextAvailable;

    if (isSelected) {
      cardStyle = styles.slotCardSelected;
      textStyle = styles.slotTextSelected;
    } else if (isMaintenance) {
      cardStyle = styles.slotCardMaintenance;
      textStyle = styles.slotTextMaintenance;
    } else if (isOffline && !isPartiallyBooked) {
      cardStyle = styles.slotCardOffline;
      textStyle = styles.slotTextOffline;
    } else if (isBooked && !isPartiallyBooked) {
      cardStyle = styles.slotCardBooked;
      textStyle = styles.slotTextBooked;
    } else if (isPartiallyBooked) {
      const bookedSubSlot = slot.originalSlots.find(os => os.status === 'booked' || os.status === 'offline_booking');
      if (bookedSubSlot && bookedSubSlot.status === 'offline_booking') {
        cardStyle = styles.slotCardOffline;
        textStyle = styles.slotTextOffline;
      } else if (bookedSubSlot && bookedSubSlot.status === 'booked') {
        cardStyle = styles.slotCardBooked;
        textStyle = styles.slotTextBooked;
      } else {
        cardStyle = styles.slotCardAvailable;
        textStyle = styles.slotTextAvailable;
      }
    } else if (past) {
      cardStyle = styles.slotCardPast;
      textStyle = styles.slotTextPast;
    }

    return (
      <TouchableOpacity
        key={slot._id}
        style={[styles.slotCard, cardStyle]}
        onPress={() => handleSlotPress(slot)}
        activeOpacity={0.8}
      >
        {isBooked && !isPartiallyBooked ? (
          <Icon name="lock" size={14} color="#2196F3" style={styles.slotStateIcon} />
        ) : isOffline && !isPartiallyBooked ? (
          <Icon name="account-cash" size={14} color="#9C27B0" style={styles.slotStateIcon} />
        ) : isPartiallyBooked ? (
          <View style={styles.slotPartialDot} />
        ) : isMaintenance ? (
          <Icon name="tools" size={12} color="#FF4757" style={styles.slotStateIcon} />
        ) : past ? (
          <Icon name="clock-alert-outline" size={14} color="rgba(255,255,255,0.4)" style={styles.slotStateIcon} />
        ) : isSelected ? (
          <Icon name="check-circle" size={14} color="#FFF" style={styles.slotStateIcon} />
        ) : null}
        
        <Text style={[styles.slotTime, textStyle, (past && !isSelected && !isMaintenance) && { textDecorationLine: 'line-through' }]}>
          {formatISTTime(slot.startTime)} - {formatISTTime(slot.endTime)}
        </Text>
        {slot.discountPrice !== undefined && slot.discountPrice !== null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={[styles.slotPrice, textStyle, { textDecorationLine: 'line-through', opacity: 0.6, fontSize: 9 }]}>₹{slot.price}</Text>
            <Text style={[styles.slotPrice, textStyle, { color: '#2ed573', fontWeight: 'bold' }]}>₹{slot.discountPrice}</Text>
          </View>
        ) : (
          <Text style={[styles.slotPrice, textStyle]}>₹{slot.price}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* ── Floating 3D Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        
        {turfs.length > 1 ? (
          <TouchableOpacity style={styles.headerDropdown} onPress={() => setTurfModalVisible(true)}>
            <Text style={styles.headerDropdownText} numberOfLines={1}>
              {turfs.find(t => t._id === selectedTurf)?.name || 'Select Ground'}
            </Text>
            <Icon name="chevron-down" size={18} color="#FFD400" style={{marginLeft: 4}} />
          </TouchableOpacity>
        ) : (
          <View style={{ alignItems: 'center', justifyContent: 'center', maxWidth: 220 }}>
            <Text style={{ fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary }} numberOfLines={1}>
              {turfs[0]?.name || 'Select Ground'}
            </Text>
          </View>
        )}

        <View style={{ width: 44 }} />
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        style={{ opacity: fadeAnim }}
      >
        {/* ── Date Picker Horizontal List ── */}
        <View style={styles.datePickerContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateScroll}
            style={{ overflow: 'visible' }}
          >
            <TouchableOpacity
              style={styles.calendarBtn}
              onPress={() => {
                setActivePicker('singleDate');
                setShowCalendar(true);
              }}
              activeOpacity={0.8}
            >
              <Icon name="calendar-month" size={20} color="#FFD400" />
              <Text style={styles.calendarBtnText}>More</Text>
            </TouchableOpacity>
            {dates.map(renderDateItem)}
          </ScrollView>
        </View>

        {/* ── Booking Mode Toggle (only if both are supported) ── */}
        {!loading && activeTurf?.bookingMode === 'both' && databaseHas30MinSlots && (
          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              style={[styles.toggleBtn, selectedIntervalMode === '60' && styles.toggleBtnActive]}
              onPress={() => {
                setSelectedIntervalMode('60');
                setSelectedSlots([]); // Clear selections when mode toggles
              }}
            >
              <Text style={[styles.toggleBtnText, selectedIntervalMode === '60' && styles.toggleBtnTextActive]}>
                1 Hour
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleBtn, selectedIntervalMode === '30' && styles.toggleBtnActive]}
              onPress={() => {
                setSelectedIntervalMode('30');
                setSelectedSlots([]); // Clear selections when mode toggles
              }}
            >
              <Text style={[styles.toggleBtnText, selectedIntervalMode === '30' && styles.toggleBtnTextActive]}>
                30 Mins
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Time Filter Row ── */}
        {!loading && slots.length > 0 && (
          <View style={styles.filterContainer}>
            <Text style={styles.filterHeaderLabel}>Filter By Time</Text>
            <View style={styles.filterRow}>
              <TouchableOpacity style={styles.filterInput} onPress={() => setShowNativeFromPicker(true)}>
                <Icon name="clock-outline" size={14} color="#FFD400" style={{ marginRight: 6 }} />
                <Text style={styles.filterText}>
                  {filterFromTime ? formatISTTime(filterFromTime) : 'From Time'}
                </Text>
              </TouchableOpacity>
              
              <Text style={{ color: colors.textTertiary, marginHorizontal: 8 }}>to</Text>
              
              <TouchableOpacity style={styles.filterInput} onPress={() => setShowNativeToPicker(true)}>
                <Icon name="clock-outline" size={14} color="#FFD400" style={{ marginRight: 6 }} />
                <Text style={styles.filterText}>
                  {filterToTime ? formatISTTime(filterToTime) : 'To Time'}
                </Text>
              </TouchableOpacity>

              {(filterFromTime || filterToTime) && (
                <TouchableOpacity 
                  style={styles.filterResetBtn} 
                  onPress={() => {
                    setFilterFromTime('');
                    setFilterToTime('');
                  }}
                >
                  <Icon name="close-circle" size={18} color="#FF4757" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity 
              style={[styles.displaySlotsBtn, { marginTop: 12 }]}
              onPress={() => {
                const selectables = processedSlots.filter(s => s.status !== 'booked' && !isPastSlot(selectedDate, s.startTime));
                const initialIds = [];
                selectables.forEach(s => {
                  if (s.isMerged) {
                    initialIds.push(...s.originalSlots.map(os => os._id));
                  } else {
                    initialIds.push(s._id);
                  }
                });
                setModalSelectedSlots(initialIds);
                setShowFilteredSlotsModal(true);
              }}
              activeOpacity={0.85}
            >
              <Icon name="view-grid-outline" size={16} color="#000" style={{ marginRight: 8 }} />
              <Text style={styles.displaySlotsBtnText}>
                {filterFromTime || filterToTime ? 'Display Filtered Slots' : 'Display All Slots'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Availability Summary Card ── */}
        {!loading && processedSlots.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryTitle}>
                {moment(selectedDate, 'YYYY-MM-DD').isSame(moment(), 'day')
                  ? 'Available Today'
                  : moment(selectedDate, 'YYYY-MM-DD').format('ddd, DD MMM YYYY')}
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.statBlock}>
                  <Text style={styles.statLabel}>Available</Text>
                  <Text style={styles.statValue}>{processedSlots.filter(s => (s.status === 'available' || s.status === 'maintenance') && !isPastSlot(selectedDate, s.startTime)).length}</Text>
                </View>
                <View style={styles.statBlock}>
                  <Text style={styles.statLabel}>Online</Text>
                  <Text style={styles.statValue}>{processedSlots.filter(s => s.status === 'booked').length}</Text>
                </View>
                <View style={styles.statBlock}>
                  <Text style={styles.statLabel}>Offline</Text>
                  <Text style={styles.statValue}>{processedSlots.filter(s => s.status === 'offline_booking').length}</Text>
                </View>
                <View style={styles.statBlock}>
                  <Text style={styles.statLabel}>Past</Text>
                  <Text style={styles.statValue}>{processedSlots.filter(s => isPastSlot(selectedDate, s.startTime)).length}</Text>
                </View>
              </View>
            </View>
            <View style={styles.statsCircularProgress}>
              <Svg width={60} height={60} style={{ position: 'absolute' }}>
                <Circle
                  cx={30} cy={30} r={26}
                  stroke="#FFD400" strokeWidth={4} fill="none"
                  strokeDasharray={2 * Math.PI * 26}
                  strokeDashoffset={(2 * Math.PI * 26) * (1 - (processedSlots.length ? (processedSlots.filter(s => (s.status === 'available' || s.status === 'maintenance') && !isPastSlot(selectedDate, s.startTime)).length / processedSlots.length) : 0))}
                  rotation="-90" origin="30, 30" strokeLinecap="round"
                />
              </Svg>
              <Text style={styles.progressText}>{processedSlots.filter(s => (s.status === 'available' || s.status === 'maintenance') && !isPastSlot(selectedDate, s.startTime)).length}</Text>
              <Text style={styles.progressSubText}>Slots</Text>
            </View>
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color="#FFD400" style={{ marginTop: 50 }} />
        ) : processedSlots.length === 0 ? (
          <Text style={styles.noSlotsText}>
            {slots.length === 0 ? 'No slots generated for this day.' : 'No slots matches the selected filters.'}
          </Text>
        ) : (
          <>
            {selectedIntervalMode === '60' && databaseHas30MinSlots && (
              <View style={styles.legendContainer}>
                <View style={styles.legendDot} />
                <Text style={styles.legendText}>Orange dot indicates slot is partially booked (30 mins booked). Click to switch to 30 min view.</Text>
              </View>
            )}
            
            {/* ── Expandable Time Groups ── */}
            <View style={styles.groupsContainer}>
            {[
              { key: 'early_morning', label: 'Early Morning', icon: 'weather-sunset-up', desc: '12:00 AM - 06:00 AM' },
              { key: 'morning', label: 'Morning', icon: 'weather-sunny', desc: '06:00 AM - 12:00 PM' },
              { key: 'afternoon', label: 'Afternoon', icon: 'weather-sunny', desc: '12:00 PM - 04:00 PM' },
              { key: 'evening', label: 'Evening', icon: 'weather-sunset-down', desc: '04:00 PM - 08:00 PM' },
              { key: 'night', label: 'Night', icon: 'weather-night', desc: '08:00 PM - 11:59 PM' }
            ].map((group) => {
              const isExpanded = expandedGroup === group.key;
              const slotList = groupedSlots[group.key] || [];
              return (
                <View key={group.key} style={styles.groupTile}>
                  <TouchableOpacity
                    style={[styles.groupHeader, isExpanded && styles.groupHeaderExpanded]}
                    onPress={() => setExpandedGroup(isExpanded ? null : group.key)}
                    activeOpacity={0.9}
                  >
                    <View style={styles.groupHeaderLeft}>
                      <Icon name={group.icon} size={18} color="#FFD400" style={{ marginRight: 8 }} />
                      <View>
                        <Text style={styles.groupLabel}>{group.label}</Text>
                        <Text style={styles.groupDesc}>{group.desc}</Text>
                      </View>
                    </View>
                    <View style={styles.groupHeaderRight}>
                      <Icon
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color="rgba(255,255,255,0.4)"
                      />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.groupContent}>
                      {slotList.length === 0 ? (
                        <Text style={styles.noSlotsText}>No slots available for this period</Text>
                      ) : (
                        <View style={styles.slotsGrid}>
                          {slotList.map(renderSlotCard)}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </>
        )}

        <View style={{ height: 160 }} />
      </Animated.ScrollView>

      {/* ── Floating Action Bar for Selections ── */}
      {selectedSlots.length > 0 && (
        <View style={[styles.bottomBookingCard, { height: 110, borderRadius: 24, flexDirection: 'column', paddingVertical: 12, gap: 8, paddingHorizontal: 16 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Text style={styles.selectedCountLabel}>Manage</Text>
            <Text style={styles.selectedCountText}>
              {selectedDisplayCount} Slot{selectedDisplayCount === 1 ? '' : 's'} Selected
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'space-between', width: '100%' }}>
            {slots.filter(s => selectedSlots.includes(s._id) && s.status !== 'available').length > 0 && (
              <TouchableOpacity style={[styles.fabBtn, { flex: 1, backgroundColor: 'rgba(255, 212, 0, 0.1)', borderColor: isDark ? '#FFD400' : colors.primaryDark }]} onPress={() => handleQuickAction('available')}>
                <Icon name="check" size={12} color="#FFD400" />
                <Text style={[styles.fabBtnText, { color: isDark ? '#FFD400' : colors.primaryDark }]}>Avail</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.fabBtn, { flex: 1, backgroundColor: 'rgba(156, 39, 176, 0.1)', borderColor: '#9C27B0' }]} onPress={() => handleQuickAction('offline_booking')}>
              <Icon name="account-cash" size={12} color="#9C27B0" />
              <Text style={[styles.fabBtnText, { color: '#9C27B0' }]}>Walk-in</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.fabBtn, { flex: 1, backgroundColor: 'rgba(46, 213, 115, 0.1)', borderColor: '#2ed573' }]} onPress={() => setDiscountModalVisible(true)}>
              <Icon name="tag-outline" size={12} color="#2ed573" />
              <Text style={[styles.fabBtnText, { color: '#2ed573' }]}>Discount</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.fabBtn, { flex: 1, backgroundColor: 'rgba(255, 71, 87, 0.1)', borderColor: '#FF4757' }]} onPress={() => handleQuickAction('maintenance')}>
              <Icon name="tools" size={12} color="#FF4757" />
              <Text style={[styles.fabBtnText, { color: '#FF4757' }]}>Maint</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Modals ── */}
      {/* Offline Booking Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderTitle}>
              <Text style={styles.modalTitle}>Walk-in Booking ({selectedDisplayCount} Slot{selectedDisplayCount === 1 ? '' : 's'})</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
                <Icon name="close" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.offlineForm}>
              <Text style={styles.modalSubtitle}>Customer Details</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Mobile Number"
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
                value={offlineDetails.customerMobile}
                onChangeText={handleMobileChange}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Customer Name *"
                placeholderTextColor={colors.textTertiary}
                value={offlineDetails.customerName}
                onChangeText={(t) => setOfflineDetails({...offlineDetails, customerName: t})}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Total Amount Collected (₹)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                value={offlineDetails.amount}
                onChangeText={(t) => setOfflineDetails({...offlineDetails, amount: t})}
              />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleOfflineBookingSubmit}>
               <LinearGradient colors={['#FFD400', '#FFB700']} style={styles.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                 <Text style={styles.saveBtnTextPrimary}>Confirm Offline Booking</Text>
               </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Discount Settings Modal */}
      <Modal visible={discountModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderTitle}>
              <Text style={styles.modalTitle}>Slot Promotion Discount</Text>
              <TouchableOpacity onPress={() => setDiscountModalVisible(false)} style={styles.modalClose}>
                <Icon name="close" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSubtitle}>Mode</Text>
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={[styles.actionBtn, discountMode === 'single' && styles.actionBtnActive]} 
                  onPress={() => setDiscountMode('single')}
                >
                  <Text style={[styles.actionBtnText, discountMode === 'single' && { color: '#000' }]}>Only Today</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionBtn, discountMode === 'extend' && styles.actionBtnActive]} 
                  onPress={() => setDiscountMode('extend')}
                >
                  <Text style={[styles.actionBtnText, discountMode === 'extend' && { color: '#000' }]}>Extend Dates</Text>
                </TouchableOpacity>
              </View>

              {discountMode === 'extend' && (
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.modalSubtitle}>Date Range</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity 
                      style={styles.pickerInput} 
                      onPress={() => {
                        setActivePicker('discountStart');
                        setShowCalendar(true);
                      }}
                    >
                      <Text style={styles.pickerText}>
                        {discountStartDate ? moment(discountStartDate).format('DD MMM YYYY') : 'Start Date'}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.pickerInput} 
                      onPress={() => {
                        setActivePicker('discountEnd');
                        setShowCalendar(true);
                      }}
                    >
                      <Text style={styles.pickerText}>
                        {discountEndDate ? moment(discountEndDate).format('DD MMM YYYY') : 'End Date'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <Text style={styles.modalSubtitle}>Discounted Price (Original: {getOriginalPriceText()})</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Discounted Price (e.g. 800) *"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                value={discountPrice}
                onChangeText={setDiscountPrice}
              />

              <View style={{ gap: 10, marginTop: 14 }}>
                <TouchableOpacity style={styles.saveBtn} onPress={handleDiscountSubmit}>
                  <LinearGradient colors={['#FFD400', '#FFB700']} style={styles.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={styles.saveBtnTextPrimary}>Apply Discount</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.saveBtn, { borderWidth: 1, borderColor: '#FF4757', borderRadius: 16 }]} 
                  onPress={handleClearDiscount}
                >
                  <View style={[styles.saveBtnGrad, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.saveBtnTextPrimary, { color: '#FF4757' }]}>Remove/Clear Discount</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Turf Selection Modal */}
      <Modal visible={turfModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderTitle}>
              <Text style={styles.modalTitle}>Select Ground</Text>
              <TouchableOpacity onPress={() => setTurfModalVisible(false)} style={styles.modalClose}>
                <Icon name="close" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {turfs.map(t => (
                <TouchableOpacity 
                  key={t._id} 
                  style={[styles.turfOption, selectedTurf === t._id && styles.turfOptionActive]}
                  onPress={() => {
                    setSelectedTurf(t._id);
                    setTurfModalVisible(false);
                  }}
                >
                  <Text style={[styles.turfOptionText, selectedTurf === t._id && styles.turfOptionTextActive]}>
                    {t.name}
                  </Text>
                  {selectedTurf === t._id && <Icon name="check-circle" size={20} color="#FFD400" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bulk Operations Modal */}
      <Modal visible={bulkModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeaderTitle}>
              <Text style={styles.modalTitle}>Bulk Operations</Text>
              <TouchableOpacity onPress={() => { setBulkModalVisible(false); setPreviewResult(null); }} style={styles.modalClose}>
                <Icon name="close" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.stepLabel}>1. Select Criteria</Text>

              <Text style={styles.modalSubtitle}>Date Range</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                <TouchableOpacity style={styles.pickerInput} onPress={() => { resetPreview(); setActivePicker('start'); setShowCalendar(true); }}>
                  <Text style={styles.pickerText}>
                    {bulkData.startDate ? moment(bulkData.startDate).format('DD MMM YYYY') : 'Start Date'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickerInput} onPress={() => { resetPreview(); setActivePicker('end'); setShowCalendar(true); }}>
                  <Text style={styles.pickerText}>
                    {bulkData.endDate ? moment(bulkData.endDate).format('DD MMM YYYY') : 'End Date'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>Days of Week</Text>
              <View style={styles.daysGrid}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dayChip, bulkData.daysOfWeek.includes(i) && styles.dayChipSel]}
                    onPress={() => { resetPreview(); toggleBulkDayOfWeek(i); }}
                  >
                    <Text style={[styles.dayChipText, bulkData.daysOfWeek.includes(i) && { color: '#000' }]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalSubtitle}>Slot Range <Text style={{ color: '#FF4757' }}>*</Text></Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                <TouchableOpacity style={[styles.pickerInput, !bulkData.startTime && styles.inputRequired]} onPress={() => { resetPreview(); setActivePicker('startTime'); }}>
                  <Text style={styles.pickerText}>{bulkData.startTime ? formatISTTime(bulkData.startTime) : 'Start Slot *'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.pickerInput, !bulkData.endTime && styles.inputRequired]} onPress={() => { resetPreview(); setActivePicker('endTime'); }}>
                  <Text style={styles.pickerText}>{bulkData.endTime ? formatISTTime(bulkData.endTime) : 'End Slot *'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>Action to Apply</Text>
              <View style={[styles.actionButtons, { marginBottom: 15 }]}>
                <TouchableOpacity style={[styles.actionBtn, bulkData.action === 'status' && styles.actionBtnActive]} onPress={() => { resetPreview(); setBulkData({ ...bulkData, action: 'status' }); }}>
                  <Text style={[styles.actionBtnText, bulkData.action === 'status' && { color: '#000' }]}>Status</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, bulkData.action === 'offline_booking' && styles.actionBtnActive]} onPress={() => { resetPreview(); setBulkData({ ...bulkData, action: 'offline_booking' }); }}>
                  <Text style={[styles.actionBtnText, bulkData.action === 'offline_booking' && { color: '#000' }]}>Offline Booking</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, bulkData.action === 'price' && styles.actionBtnActive]} onPress={() => { resetPreview(); setBulkData({ ...bulkData, action: 'price' }); }}>
                  <Text style={[styles.actionBtnText, bulkData.action === 'price' && { color: '#000' }]}>Change Price</Text>
                </TouchableOpacity>
              </View>

              {bulkData.action === 'status' && (
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                  <TouchableOpacity style={[styles.actionSubBtn, bulkData.actionData.status === 'available' && styles.actionSubBtnActive]} onPress={() => setBulkData({ ...bulkData, actionData: { ...bulkData.actionData, status: 'available' } })}>
                    <Text style={[styles.actionSubBtnText, bulkData.actionData.status === 'available' && { color: isDark ? '#FFD400' : colors.primaryDark }]}>Available</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionSubBtn, bulkData.actionData.status === 'maintenance' && { borderColor: '#FF4757', backgroundColor: 'rgba(255, 71, 87, 0.1)' }]} onPress={() => setBulkData({ ...bulkData, actionData: { ...bulkData.actionData, status: 'maintenance' } })}>
                    <Text style={[styles.actionSubBtnText, bulkData.actionData.status === 'maintenance' && { color: '#FF4757' }]}>Maintenance</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={styles.searchSlotsBtn} onPress={handlePreviewSlots} disabled={isPreviewing}>
                {isPreviewing ? <ActivityIndicator color="#000" size="small" /> : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="magnify" size={18} color="#000" />
                    <Text style={styles.searchSlotsBtnText}>Search Slots</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* ── STEP 2: Preview + Confirm ── */}
              {previewResult && (
                <View style={styles.previewCard}>
                  <Text style={[styles.stepLabel, { marginTop: 0 }]}>2. Review &amp; Confirm</Text>

                  <View style={styles.previewSummaryRow}>
                    <View style={styles.previewStat}>
                      <Icon name="calendar-check" size={20} color="#FFD400" />
                      <Text style={styles.previewStatValue}>{previewResult.slots.length}</Text>
                      <Text style={styles.previewStatLabel}>Slots Found</Text>
                    </View>
                    <View style={styles.previewDivider} />
                    <View style={styles.previewStat}>
                      <Icon name="currency-inr" size={20} color="#FFD400" />
                      <Text style={styles.previewStatValue}>₹{previewResult.customPrice || 0}</Text>
                      <Text style={styles.previewStatLabel}>Per Slot</Text>
                    </View>
                    <View style={styles.previewDivider} />
                    <View style={styles.previewStat}>
                      <Icon name="sigma" size={20} color="#FFD400" />
                      <Text style={styles.previewStatValue}>₹{(Number(previewResult.customPrice) || 0) * previewResult.slots.length}</Text>
                      <Text style={styles.previewStatLabel}>Total</Text>
                    </View>
                  </View>

                  <Text style={styles.modalSubtitle}>Price Per Slot (₹)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Enter price per slot"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    value={previewResult.customPrice}
                    onChangeText={t => setPreviewResult({ ...previewResult, customPrice: t })}
                  />

                  {bulkData.action === 'offline_booking' && (
                    <View>
                      <Text style={styles.modalSubtitle}>Customer Details</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Mobile Number"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="phone-pad"
                        value={bulkData.actionData.customerMobile}
                        onChangeText={handleBulkMobileChange}
                      />
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Customer Name *"
                        placeholderTextColor={colors.textTertiary}
                        value={bulkData.actionData.customerName}
                        onChangeText={t => setBulkData({ ...bulkData, actionData: { ...bulkData.actionData, customerName: t } })}
                      />
                    </View>
                  )}

                  <TouchableOpacity style={[styles.saveBtn, { marginTop: 20 }]} onPress={handleBulkUpdate}>
                     <LinearGradient colors={['#FFD400', '#FFB700']} style={styles.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                       <Text style={styles.saveBtnTextPrimary}>
                         {bulkData.action === 'offline_booking'
                            ? `Confirm Offline Booking (${previewResult.slots.length} slots)`
                            : `Apply to ${previewResult.slots.length} Slots`}
                       </Text>
                     </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ height: 40 }} />
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <Modal visible={activePicker === 'startTime' || activePicker === 'endTime'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderTitle}>
              <Text style={styles.modalTitle}>Select Time</Text>
              <TouchableOpacity onPress={() => setActivePicker('none')} style={styles.modalClose}>
                <Icon name="close" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.timeGrid}>
              {Array.from({ length: 24 }).map((_, i) => {
                const hour = i.toString().padStart(2, '0');
                const timeStr = `${hour}:00`;
                const isSelected = activePicker === 'startTime' ? bulkData.startTime === timeStr : bulkData.endTime === timeStr;
                return (
                  <TouchableOpacity
                    key={timeStr}
                    style={[styles.timeBox, isSelected && styles.timeBoxSel]}
                    onPress={() => {
                      if (activePicker === 'startTime') setBulkData({ ...bulkData, startTime: timeStr });
                      else setBulkData({ ...bulkData, endTime: timeStr });
                      setActivePicker('none');
                    }}
                  >
                    <Text style={[styles.timeText, isSelected && { color: '#000' }]}>{formatISTTime(timeStr)}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Calendar Modal */}
      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderTitle}>
              <TouchableOpacity onPress={() => setCalendarMonth(moment(calendarMonth).subtract(1, 'month'))}>
                <Icon name="chevron-left" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{calendarMonth.format('MMMM YYYY')}</Text>
              <TouchableOpacity onPress={() => setCalendarMonth(moment(calendarMonth).add(1, 'month'))}>
                <Icon name="chevron-right" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarGrid}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <Text key={i} style={styles.dayOfWeek}>{d}</Text>
              ))}
              {(() => {
                const startDay = moment(calendarMonth).startOf('month').day();
                const daysInMonth = moment(calendarMonth).daysInMonth();
                const grid = [];
                for (let i = 0; i < startDay; i++) grid.push(<View key={`empty-${i}`} style={styles.calDay} />);
                for (let i = 1; i <= daysInMonth; i++) {
                  const d = moment(calendarMonth).date(i);
                  const dStr = d.format('YYYY-MM-DD');
                  const isPast = d.isBefore(moment(), 'day');
                  const isSel = (activePicker === 'none' && selectedDate === dStr) ||
                    (activePicker === 'start' && bulkData.startDate === dStr) ||
                    (activePicker === 'end' && bulkData.endDate === dStr) ||
                    (activePicker === 'discountStart' && discountStartDate === dStr) ||
                    (activePicker === 'discountEnd' && discountEndDate === dStr) ||
                    (activePicker === 'singleDate' && selectedDate === dStr);
                  grid.push(
                    <TouchableOpacity
                      key={`day-${i}`}
                      style={[styles.calDay, isSel && styles.calDaySel]}
                      onPress={() => {
                        if (activePicker === 'start') {
                          setBulkData({ ...bulkData, startDate: dStr });
                        } else if (activePicker === 'end') {
                          setBulkData({ ...bulkData, endDate: dStr });
                        } else if (activePicker === 'discountStart') {
                          setDiscountStartDate(dStr);
                        } else if (activePicker === 'discountEnd') {
                          setDiscountEndDate(dStr);
                        } else {
                          setSelectedDate(dStr);
                          setDates(generateDates(d.toDate()));
                        }
                        setShowCalendar(false);
                        setActivePicker('none');
                      }}
                    >
                      <Text style={[styles.calDayText, isPast && { color: 'rgba(255,255,255,0.5)' }, isSel && { color: '#000' }]}>{i}</Text>
                    </TouchableOpacity>
                  );
                }
                return grid;
              })()}
            </View>

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => { setShowCalendar(false); setActivePicker('none'); }}>
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Native Platform Time Pickers */}
      {showNativeFromPicker && (
        <DateTimePicker
          value={filterFromTime ? moment(filterFromTime, 'HH:mm').toDate() : new Date()}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowNativeFromPicker(false);
            if (event.type === 'set' && date) {
              const formattedTime = moment(date).format('HH:mm');
              setFilterFromTime(formattedTime);
              if (formattedTime.split(':')[1] === '30' && databaseHas30MinSlots) {
                setSelectedIntervalMode('30');
              }
            }
          }}
        />
      )}

      {showNativeToPicker && (
        <DateTimePicker
          value={filterToTime ? moment(filterToTime, 'HH:mm').toDate() : new Date()}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowNativeToPicker(false);
            if (event.type === 'set' && date) {
              const formattedTime = moment(date).format('HH:mm');
              setFilterToTime(formattedTime);
              if (formattedTime.split(':')[1] === '30' && databaseHas30MinSlots) {
                setSelectedIntervalMode('30');
              }
            }
          }}
        />
      )}

      {/* ── Filtered Slots Center Modal ── */}
      {showFilteredSlotsModal && (
        <Modal visible={showFilteredSlotsModal} transparent={true} animationType="fade" statusBarTranslucent>
          <View style={styles.fsModalBackdrop}>
            <View style={styles.fsModalCard}>
              {/* Header */}
              <View style={styles.fsModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fsModalTitle}>Filtered Slots</Text>
                  <Text style={styles.fsModalSubtitle}>
                    {filterFromTime ? formatISTTime(filterFromTime) : 'Start'} → {filterToTime ? formatISTTime(filterToTime) : 'End'}
                  </Text>
                </View>

                {/* Select All Toggle */}
                {processedSlots.length > 0 && (
                  <TouchableOpacity
                    style={styles.fsSelectAllBtn}
                    onPress={() => {
                      const selectables = processedSlots.filter(s => s.status !== 'booked');
                      const allSelected = selectables.length > 0 && selectables.every(s => {
                        if (s.isMerged) return s.originalSlots.every(os => modalSelectedSlots.includes(os._id));
                        return modalSelectedSlots.includes(s._id);
                      });

                      if (allSelected) {
                        setModalSelectedSlots([]);
                      } else {
                        const ids = [];
                        selectables.forEach(s => {
                          if (s.isMerged) ids.push(...s.originalSlots.map(os => os._id));
                          else ids.push(s._id);
                        });
                        setModalSelectedSlots(ids);
                      }
                    }}
                  >
                    <Icon
                      name={
                        processedSlots.filter(s => s.status !== 'booked').length > 0 &&
                        processedSlots.filter(s => s.status !== 'booked').every(s => {
                          if (s.isMerged) return s.originalSlots.every(os => modalSelectedSlots.includes(os._id));
                          return modalSelectedSlots.includes(s._id);
                        })
                          ? 'checkbox-marked'
                          : 'checkbox-blank-outline'
                      }
                      size={16}
                      color="#FFD400"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.fsSelectAllText}>
                      {processedSlots.filter(s => s.status !== 'booked').length > 0 &&
                      processedSlots.filter(s => s.status !== 'booked').every(s => {
                        if (s.isMerged) return s.originalSlots.every(os => modalSelectedSlots.includes(os._id));
                        return modalSelectedSlots.includes(s._id);
                      })
                        ? 'Deselect All'
                        : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity onPress={() => setShowFilteredSlotsModal(false)} style={styles.fsModalCloseBtn}>
                  <Icon name="close" size={18} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Slot list */}
              <ScrollView
                showsVerticalScrollIndicator={true}
                style={{ maxHeight: 360, marginVertical: 8 }}
                contentContainerStyle={{ paddingVertical: 4 }}
              >
                {processedSlots.length === 0 ? (
                  <Text style={{ color: colors.textTertiary, textAlign: 'center', marginVertical: 24, fontFamily: Typography.fontFamily.medium }}>
                    No slots found in this time range.
                  </Text>
                ) : processedSlots.map((slot) => {
                  const isBooked = slot.status === 'booked';
                  const isOffline = slot.status === 'offline_booking';
                  const isMaintenance = slot.status === 'maintenance';
                  const past = isPastSlot(selectedDate, slot.startTime);
                  const isSelected = slot.isMerged
                    ? slot.originalSlots.every(os => modalSelectedSlots.includes(os._id))
                    : modalSelectedSlots.includes(slot._id);

                  const borderColor = isSelected ? '#FFD400'
                    : isBooked ? '#2196F3'
                    : isOffline ? '#9C27B0'
                    : isMaintenance ? '#FF4757'
                    : past ? '#333'
                    : '#2A2A2A';

                  const badgeLabel = isBooked ? 'Online'
                    : past ? 'Past'
                    : isOffline ? 'Walk-in'
                    : isMaintenance ? 'Blocked'
                    : 'Available';

                  const badgeBg = isBooked ? 'rgba(33, 150, 243, 0.15)'
                    : past ? 'rgba(255, 255, 255, 0.08)'
                    : isOffline ? 'rgba(156, 39, 176, 0.15)'
                    : isMaintenance ? 'rgba(255, 71, 87, 0.15)'
                    : 'rgba(46, 213, 115, 0.15)';

                  const badgeText = isBooked ? '#2196F3'
                    : past ? 'rgba(255, 255, 255, 0.5)'
                    : isOffline ? '#9C27B0'
                    : isMaintenance ? '#FF4757'
                    : '#2ed573';

                  return (
                    <TouchableOpacity
                      key={slot._id}
                      activeOpacity={0.75}
                      disabled={isBooked}
                      onPress={() => {
                        const ids = slot.isMerged ? slot.originalSlots.map(os => os._id) : [slot._id];
                        const allSel = ids.every(id => modalSelectedSlots.includes(id));
                        setModalSelectedSlots(prev =>
                          allSel ? prev.filter(id => !ids.includes(id)) : [...prev, ...ids.filter(id => !prev.includes(id))]
                        );
                      }}
                      style={[
                        styles.fsSlotRow,
                        {
                          borderColor,
                          backgroundColor: isSelected ? 'rgba(255, 212, 0, 0.08)' : '#1B1B1B',
                          opacity: isBooked ? 0.6 : 1,
                        }
                      ]}
                    >
                      <View style={styles.fsSlotCheckbox}>
                        {isBooked ? (
                          <Icon name="lock" size={15} color="#2196F3" />
                        ) : isSelected ? (
                          <Icon name="check-circle" size={16} color="#FFD400" />
                        ) : (
                          <Icon name="circle-outline" size={16} color="rgba(255,255,255,0.3)" />
                        )}
                      </View>

                      <Text style={[styles.fsSlotTime, isSelected && { color: isDark ? '#FFD400' : colors.primaryDark, fontFamily: Typography.fontFamily.bold }]}>
                        {formatISTTime(slot.startTime)} – {formatISTTime(slot.endTime)}
                      </Text>

                      <View style={[styles.fsSlotBadge, { backgroundColor: badgeBg, borderColor: badgeText }]}>
                        <Text style={[styles.fsSlotBadgeText, { color: badgeText }]}>{badgeLabel}</Text>
                      </View>

                      <Text style={[styles.fsSlotPrice, isSelected && { color: isDark ? '#FFD400' : colors.primaryDark }]}>
                        ₹{slot.price}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Footer actions */}
              <View style={styles.fsModalFooter}>
                <Text style={styles.fsFooterLabel}>
                  {modalSelectedSlots.length} slot{modalSelectedSlots.length === 1 ? '' : 's'} selected
                </Text>
                <View style={styles.fsFooterBtns}>
                  <TouchableOpacity
                    style={[styles.fsFooterBtn, { borderColor: isDark ? '#FFD400' : colors.primaryDark, backgroundColor: 'rgba(255, 212, 0, 0.1)' }]}
                    disabled={modalSelectedSlots.length === 0}
                    onPress={async () => {
                      try {
                        await api.post('/slots/bulk-update-ids', { turfId: selectedTurf, slotIds: modalSelectedSlots, action: 'status', actionData: { status: 'available' } });
                        setShowFilteredSlotsModal(false);
                        fetchSlots();
                        showCustomAlert('Success', 'Slots marked as available.');
                      } catch { showCustomAlert('Error', 'Failed to update.'); }
                    }}
                  >
                    <Icon name="check-circle-outline" size={14} color="#FFD400" />
                    <Text style={[styles.fsFooterBtnText, { color: isDark ? '#FFD400' : colors.primaryDark }]}>Avail</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.fsFooterBtn, { borderColor: '#9C27B0', backgroundColor: 'rgba(156, 39, 176, 0.1)' }]}
                    disabled={modalSelectedSlots.length === 0}
                    onPress={() => {
                      const totalPrice = modalSelectedSlots.reduce((sum, id) => {
                        const s = slots.find(sl => sl._id === id);
                        return sum + (s?.discountPrice ?? s?.price ?? 0);
                      }, 0);
                      setSelectedSlots(modalSelectedSlots);
                      setActionType('offline_booking');
                      setOfflineDetails({ customerName: '', customerMobile: '', amount: totalPrice.toString(), reason: 'walk_in' });
                      setShowFilteredSlotsModal(false);
                      setModalVisible(true);
                    }}
                  >
                    <Icon name="account-cash-outline" size={14} color="#9C27B0" />
                    <Text style={[styles.fsFooterBtnText, { color: '#9C27B0' }]}>Walk-in</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.fsFooterBtn, { borderColor: '#FF4757', backgroundColor: 'rgba(255, 71, 87, 0.1)' }]}
                    disabled={modalSelectedSlots.length === 0}
                    onPress={async () => {
                      try {
                        await api.post('/slots/bulk-update-ids', { turfId: selectedTurf, slotIds: modalSelectedSlots, action: 'status', actionData: { status: 'maintenance' } });
                        setShowFilteredSlotsModal(false);
                        fetchSlots();
                        showCustomAlert('Success', 'Slots marked as maintenance.');
                      } catch { showCustomAlert('Error', 'Failed to update.'); }
                    }}
                  >
                    <Icon name="tools" size={14} color="#FF4757" />
                    <Text style={[styles.fsFooterBtnText, { color: '#FF4757' }]}>Maint</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Voice Assistant Floating Action Button */}
      {VOICE_ASSISTANT_ENABLED && (
        <TouchableOpacity 
          style={styles.voiceAssistantFab}
          onPress={async () => {
            // Request permission before opening so the modal is ready to listen immediately
            await requestMicPermission();
            setVoiceAssistantVisible(true);
            setVoiceState('IDLE');
            setVoiceDraft(null);
            const greetingText = "Pluto here. I check and book single slots. Don't try bulk range bookings or status changes unless you enjoy wasting both our times. What do you want?";
            setAssistantMessages([
              { sender: 'assistant', text: greetingText }
            ]);
            speakTts(greetingText);
          }}
          activeOpacity={0.85}
        >
          <Icon name="microphone" size={28} color="#000" />
        </TouchableOpacity>
      )}

      {/* Voice Assistant Panel Modal */}
      <Modal
        visible={voiceAssistantVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setVoiceAssistantVisible(false);
          Tts.stop();
        }}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={{ flex: 1 }}
        >
          <View style={styles.assistantOverlay}>
            <View style={styles.assistantContainer}>
              
              {/* Header */}
              <View style={styles.assistantHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="robot" size={22} color="#FFD400" style={{ marginRight: 8 }} />
                  <Text style={styles.assistantTitle}>Voice Booking Assistant</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={toggleMute} style={{ marginRight: 16 }}>
                    <Icon name={isMuted ? "volume-off" : "volume-high"} size={22} color="#FFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {
                    setVoiceAssistantVisible(false);
                    Tts.stop();
                  }}>
                    <Icon name="close" size={22} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Messages ScrollView */}
              <ScrollView 
                style={styles.messagesList}
                contentContainerStyle={{ paddingVertical: 10 }}
                ref={scrollRef}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              >
                {assistantMessages.map((msg, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.messageBubble, 
                      msg.sender === 'owner' ? styles.ownerBubble : styles.assistantBubble
                    ]}
                  >
                    <Text style={msg.sender === 'owner' ? styles.ownerText : styles.assistantText}>
                      {msg.text}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              {/* Booking Status Card */}
              {voiceDraft && (
                <View style={styles.statusCard}>
                  <Text style={styles.statusCardTitle}>Booking Draft Details</Text>
                  <View style={styles.statusGrid}>
                    <Text style={styles.statusLabel}>Court:</Text>
                    <Text style={styles.statusVal}>{voiceDraft.courtName || '-'}</Text>
                    
                    <Text style={styles.statusLabel}>Date:</Text>
                    <Text style={styles.statusVal}>
                      {voiceDraft.date 
                        ? (voiceDraft.endDate && voiceDraft.endDate !== voiceDraft.date
                          ? `${moment(voiceDraft.date).format('DD-MM-YYYY')} to ${moment(voiceDraft.endDate).format('DD-MM-YYYY')}`
                          : moment(voiceDraft.date).format('DD-MM-YYYY'))
                        : '-'}
                    </Text>
                    
                    <Text style={styles.statusLabel}>Time:</Text>
                    <Text style={styles.statusVal}>
                      {voiceDraft.startTime ? `${formatISTTime(voiceDraft.startTime)} - ${voiceDraft.endTime ? formatISTTime(voiceDraft.endTime) : ''}` : '-'}
                    </Text>
                    
                    <Text style={styles.statusLabel}>Slots Count:</Text>
                    <Text style={styles.statusVal}>
                      {(() => {
                        if (!voiceDraft.startTime || !voiceDraft.endTime) return '-';
                        const startParts = voiceDraft.startTime.split(':').map(Number);
                        const endParts = voiceDraft.endTime.split(':').map(Number);
                        const diffMinutes = (endParts[0] * 60 + endParts[1]) - (startParts[0] * 60 + startParts[1]);
                        const dailyHours = Math.max(0, Math.round(diffMinutes / 60));
                        
                        if (voiceDraft.endDate && voiceDraft.endDate !== voiceDraft.date) {
                          const start = moment(voiceDraft.date);
                          const end = moment(voiceDraft.endDate);
                          const daysCount = Math.max(1, end.diff(start, 'days') + 1);
                          const totalSlots = dailyHours * daysCount;
                          return `${totalSlots} slots (${dailyHours} slots/day x ${daysCount} days)`;
                        }
                        
                        return `${dailyHours} slot${dailyHours !== 1 ? 's' : ''}`;
                      })()}
                    </Text>
                    
                    <Text style={styles.statusLabel}>Name:</Text>
                    <Text style={styles.statusVal}>{voiceDraft.customerName || '-'}</Text>
                    
                    <Text style={styles.statusLabel}>Phone:</Text>
                    <Text style={styles.statusVal}>{voiceDraft.phoneNumber || '-'}</Text>
                    
                    <Text style={styles.statusLabel}>Amount:</Text>
                    <Text style={styles.statusVal}>
                      {voiceDraft.amount 
                        ? (() => {
                            let label = `₹${voiceDraft.amount}`;
                            const breakdown = [];
                            
                            if (voiceDraft.weekdaySlotsCount > 0) {
                              const weekdayRate = Math.round(voiceDraft.weekdayAmount / voiceDraft.weekdaySlotsCount);
                              breakdown.push(`Weekdays: ${voiceDraft.weekdaySlotsCount} slots @ ₹${weekdayRate}/slot`);
                            }
                            if (voiceDraft.weekendSlotsCount > 0) {
                              const weekendRate = Math.round(voiceDraft.weekendAmount / voiceDraft.weekendSlotsCount);
                              breakdown.push(`Weekends: ${voiceDraft.weekendSlotsCount} slots @ ₹${weekendRate}/slot`);
                            }
                            
                            if (breakdown.length > 0) {
                              return `${label}\n(${breakdown.join('\n')})`;
                            }
                            return label;
                          })()
                        : '-'}
                    </Text>
                  </View>
                  
                  {/* Hybrid Confirmation Button */}
                  {voiceState === 'CONFIRMATION' && (
                    <TouchableOpacity 
                      style={styles.confirmBtn}
                      onPress={() => sendVoiceMessage("Yes")}
                    >
                      <Text style={styles.confirmBtnText}>Confirm Booking</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Input Bar — mic + text + send */}
              <View style={styles.inputBar}>
                {/* Pulsing mic button */}
                <Animated.View style={{ transform: [{ scale: micPulse }] }}>
                  <TouchableOpacity
                    style={[
                      styles.micBtn,
                      isListening && styles.micBtnActive,
                      !VOICE_ASSISTANT_ENABLED && { backgroundColor: '#333' }
                    ]}
                    disabled={!VOICE_ASSISTANT_ENABLED}
                    onPress={startListening}
                    activeOpacity={0.8}
                  >
                    <Icon
                      name={isListening ? 'microphone' : 'microphone-outline'}
                      size={22}
                      color={isListening ? '#000' : (VOICE_ASSISTANT_ENABLED ? '#FFD400' : '#888')}
                    />
                  </TouchableOpacity>
                </Animated.View>

                <View style={{ flex: 1 }}>
                  {isListening && (
                    <Text style={styles.listeningLabel}>Listening…</Text>
                  )}
                  <TextInput
                    style={styles.textInput}
                    placeholder={isListening ? '' : 'Speak or type (e.g. Sunday 6 PM)...'}
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={voiceText}
                    onChangeText={setVoiceText}
                    onSubmitEditing={() => { stopListening(); sendVoiceMessage(voiceText); }}
                    editable={!isListening}
                  />
                </View>

                <TouchableOpacity 
                  style={styles.sendBtn}
                  onPress={() => { stopListening(); sendVoiceMessage(voiceText); }}
                >
                  <Icon name="send" size={20} color="#000" />
                </TouchableOpacity>
              </View>
              
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
};

const createStyles = (colors, isDark, shadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 160 },
  
  /* ── Floating 3D Header ── */
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderColor: colors.border,
    ...shadows.medium, zIndex: 10,
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  headerDropdown: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceVariant, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    maxWidth: 200
  },
  headerDropdownText: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },

  /* ── Horizontal Date Selector ── */
  datePickerContainer: { marginTop: 14, paddingVertical: 8, backgroundColor: colors.background, overflow: 'visible' },
  dateScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 10, overflow: 'visible' },
  calendarBtn: {
    width: 64, height: 86, borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  calendarBtnText: { fontSize: 10, color: isDark ? '#FFD400' : colors.primaryDark, fontFamily: Typography.fontFamily.bold, marginTop: 4 },
  dateBox: {
    width: 64, height: 86, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  dateBoxInactive: {
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1, borderColor: colors.border,
    borderBottomWidth: 3, borderBottomColor: colors.border,
  },
  dateBoxSelected: {
    backgroundColor: isDark ? colors.surfaceVariant : '#FFFFFF',
    borderWidth: 1.5, borderColor: isDark ? '#FFD400' : colors.primaryDark,
    borderBottomWidth: 4, borderBottomColor: isDark ? '#BCA100' : colors.primaryDark,
    transform: [{ scale: 1.05 }],
    shadowColor: isDark ? '#FFD400' : colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  dateDay: { fontSize: 10, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, textTransform: 'uppercase' },
  dateNum: { fontSize: 20, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, marginVertical: 1 },
  dateMonth: { fontSize: 10, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  dateTextSelected: { color: isDark ? '#FFD400' : colors.primaryDark },

  /* ── Availability Summary Card ── */
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 10, marginBottom: 16,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
  },
  summaryLeft: { flex: 1 },
  summaryTitle: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 14 },
  statBlock: { flexDirection: 'column' },
  statLabel: { fontSize: 9, fontFamily: Typography.fontFamily.medium, color: colors.textTertiary, textTransform: 'uppercase' },
  statValue: { fontSize: 16, fontFamily: Typography.fontFamily.extraBold, color: colors.textPrimary, marginTop: 2 },
  statsCircularProgress: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 4, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  progressText: { fontSize: 14, fontFamily: Typography.fontFamily.extraBold, color: colors.textPrimary },
  progressSubText: { fontSize: 7, fontFamily: Typography.fontFamily.bold, color: isDark ? '#FFD400' : colors.primaryDark, textTransform: 'uppercase', marginTop: -2 },

  /* ── Expandable Time Groups ── */
  groupsContainer: { marginHorizontal: 16, gap: 12 },
  groupTile: {
    backgroundColor: colors.surface, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5,
  },
  groupHeader: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface },
  groupHeaderExpanded: { borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surfaceVariant },
  groupHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  groupLabel: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  groupDesc: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: colors.textTertiary, marginTop: 1 },
  groupHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupContent: { padding: 14, backgroundColor: colors.surface },
  noSlotsText: { color: colors.textTertiary, fontSize: 12, fontFamily: Typography.fontFamily.medium, textAlign: 'center', marginVertical: 20 },

  /* ── Slot Grid & 3D Mini Cards ── */
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: '2.5%', justifyContent: 'flex-start' },
  slotCard: {
    width: '31.6%', borderRadius: 18, paddingVertical: 12, alignItems: 'center', marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4, position: 'relative',
    transform: [{ perspective: 1000 }, { rotateX: '6deg' }],
  },
  slotStateIcon: { position: 'absolute', top: 4, right: 6 },
  slotTime: { fontSize: 9, fontFamily: Typography.fontFamily.bold, marginBottom: 2 },
  slotPrice: { fontSize: 10, fontFamily: Typography.fontFamily.medium },

  slotCardAvailable: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomWidth: 3, borderBottomColor: colors.border },
  slotTextAvailable: { color: colors.textPrimary },
  
  slotCardSelected: {
    backgroundColor: isDark ? colors.surfaceVariant : '#FFF9DB', borderWidth: 1.5, borderColor: isDark ? '#FFD400' : colors.primaryDark, borderBottomWidth: 4, borderBottomColor: isDark ? '#BCA100' : colors.primaryDark,
    transform: [{ scale: 1.05 }, { translateY: -4 }, { perspective: 1000 }, { rotateX: '6deg' }],
    shadowColor: isDark ? '#FFD400' : colors.primaryDark, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  slotTextSelected: { color: isDark ? '#FFD400' : colors.primaryDark },
  
  slotCardMaintenance: { backgroundColor: 'rgba(255, 71, 87, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 71, 87, 0.4)', borderBottomWidth: 3, borderBottomColor: 'rgba(255, 71, 87, 0.2)' },
  slotTextMaintenance: { color: '#FF4757' },
  
  slotCardBooked: { backgroundColor: 'rgba(33, 150, 243, 0.05)', borderWidth: 1, borderColor: 'rgba(33, 150, 243, 0.4)', borderBottomWidth: 3, borderBottomColor: 'rgba(33, 150, 243, 0.2)' },
  slotTextBooked: { color: '#2196F3' },

  slotCardOffline: { backgroundColor: 'rgba(156, 39, 176, 0.05)', borderWidth: 1, borderColor: 'rgba(156, 39, 176, 0.4)', borderBottomWidth: 3, borderBottomColor: 'rgba(156, 39, 176, 0.2)' },
  slotTextOffline: { color: '#9C27B0' },
  
  slotCardPartiallyBooked: { backgroundColor: 'rgba(255, 152, 0, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 152, 0, 0.4)', borderBottomWidth: 3, borderBottomColor: 'rgba(255, 152, 0, 0.2)' },
  slotTextPartiallyBooked: { color: '#FF9800' },
  partiallyBookedLabel: { fontSize: 7, fontFamily: Typography.fontFamily.bold, color: '#FF9800', marginTop: 1, textTransform: 'uppercase' },

  slotCardPast: { backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.border, borderBottomWidth: 3, borderBottomColor: colors.border },
  slotTextPast: { color: colors.textTertiary },

  /* ── Bottom Summary Booking Card (Floating Action Bar) ── */
  bottomBookingCard: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    height: 72, borderRadius: 36, backgroundColor: isDark ? 'rgba(22,22,22,0.95)' : colors.surface,
    borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10, zIndex: 100,
  },
  bookingLeft: { flexDirection: 'column' },
  selectedCountLabel: { color: colors.textTertiary, fontSize: 9, fontFamily: Typography.fontFamily.medium, textTransform: 'uppercase' },
  selectedCountText: { color: colors.textPrimary, fontSize: 13, fontFamily: Typography.fontFamily.bold, marginTop: 1 },
  fabBtnGroup: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  fabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 64,
  },
  fabBtnText: { fontSize: 11, fontFamily: Typography.fontFamily.bold, lineHeight: 13 },

  /* ── Modals General ── */
  modalOverlay: { flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: colors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.border, ...shadows.medium },
  modalHeaderTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  modalSubtitle: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: colors.textSecondary, marginTop: 16, marginBottom: 8, textTransform: 'uppercase' },
  modalInput: { backgroundColor: colors.surfaceVariant, borderRadius: 12, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, fontFamily: Typography.fontFamily.medium, marginBottom: 12 },
  
  /* Turf Selection Options */
  turfOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  turfOptionActive: { backgroundColor: isDark ? 'rgba(255, 212, 0, 0.08)' : '#FFF9DB', borderRadius: 12, paddingHorizontal: 10, borderBottomWidth: 0 },
  turfOptionText: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: colors.textPrimary },
  turfOptionTextActive: { color: isDark ? '#FFD400' : colors.primaryDark, fontFamily: Typography.fontFamily.bold },

  /* Bulk Ops Modal Specific */
  stepLabel: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: isDark ? '#FFD400' : colors.primaryDark, marginTop: 10, marginBottom: 4 },
  pickerInput: { flex: 1, backgroundColor: colors.surfaceVariant, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, paddingHorizontal: 14, justifyContent: 'center' },
  pickerText: { color: colors.textPrimary, fontSize: 12, fontFamily: Typography.fontFamily.medium },
  inputRequired: { borderColor: colors.error },
  
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { backgroundColor: colors.surfaceVariant, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border },
  dayChipSel: { backgroundColor: '#FFD400', borderColor: isDark ? '#FFD400' : colors.primaryDark },
  dayChipText: { color: colors.textPrimary, fontSize: 12, fontFamily: Typography.fontFamily.medium },

  actionButtons: { flexDirection: 'row', backgroundColor: colors.surfaceVariant, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  actionBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  actionBtnActive: { backgroundColor: '#FFD400' },
  actionBtnText: { color: colors.textSecondary, fontSize: 12, fontFamily: Typography.fontFamily.bold },
  
  actionSubBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceVariant },
  actionSubBtnActive: { borderColor: isDark ? '#FFD400' : colors.primaryDark, backgroundColor: 'rgba(255, 212, 0, 0.1)' },
  actionSubBtnText: { color: colors.textSecondary, fontSize: 12, fontFamily: Typography.fontFamily.bold },

  searchSlotsBtn: { backgroundColor: '#FFD400', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  searchSlotsBtnText: { color: '#000', fontSize: 14, fontFamily: Typography.fontFamily.bold },

  /* Preview Card */
  previewCard: { backgroundColor: colors.surfaceVariant, borderRadius: 16, padding: 16, marginTop: 24, borderWidth: 1, borderColor: colors.border, shadowColor: '#FFD400', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  previewSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 16 },
  previewStat: { alignItems: 'center', flex: 1 },
  previewStatValue: { color: colors.textPrimary, fontSize: 18, fontFamily: Typography.fontFamily.bold, marginTop: 6 },
  previewStatLabel: { color: colors.textSecondary, fontSize: 10, fontFamily: Typography.fontFamily.medium, marginTop: 2 },
  previewDivider: { width: 1, height: 30, backgroundColor: colors.border },
  
  saveBtn: { borderRadius: 16, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  saveBtnTextPrimary: { color: '#000', fontSize: 14, fontFamily: Typography.fontFamily.bold },

  /* Time Grid / Pickers */
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  timeBox: { width: '30%', backgroundColor: colors.surfaceVariant, paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  timeBoxSel: { backgroundColor: '#FFD400', borderColor: isDark ? '#FFD400' : colors.primaryDark },
  timeText: { color: colors.textPrimary, fontSize: 12, fontFamily: Typography.fontFamily.medium },

  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 10 },
  dayOfWeek: { width: '14.28%', textAlign: 'center', color: colors.textTertiary, fontFamily: Typography.fontFamily.bold, fontSize: 12, marginBottom: 16 },
  calDay: { width: '14.28%', height: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  calDaySel: { backgroundColor: '#FFD400', borderRadius: 20 },
  calDayText: { color: colors.textPrimary, fontSize: 13, fontFamily: Typography.fontFamily.medium },
  closeModalBtn: { backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  closeModalText: { color: colors.textPrimary, fontSize: 13, fontFamily: Typography.fontFamily.bold },

  /* ── Voice Assistant Styles ── */
  voiceAssistantFab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFD400',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFD400',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 99
  },
  assistantOverlay: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  assistantContainer: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '80%',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    flexDirection: 'column'
  },
  assistantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingBottom: 16
  },
  assistantTitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary
  },
  messagesList: {
    flex: 1,
    marginVertical: 12
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    marginVertical: 6,
    maxWidth: '80%'
  },
  ownerBubble: {
    backgroundColor: '#FFD400',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4
  },
  assistantBubble: {
    backgroundColor: colors.surfaceVariant,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border
  },
  ownerText: {
    color: '#000',
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium
  },
  assistantText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium
  },
  statusCard: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12
  },
  statusCardTitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: isDark ? '#FFD400' : colors.primaryDark,
    marginBottom: 10,
    textTransform: 'uppercase'
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8
  },
  statusLabel: {
    width: '30%',
    color: colors.textTertiary,
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium
  },
  statusVal: {
    width: '70%',
    color: colors.textPrimary,
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold
  },
  confirmBtn: {
    backgroundColor: '#FFD400',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14
  },
  confirmBtnText: {
    color: '#000',
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20
  },
  textInput: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFD400',
    alignItems: 'center',
    justifyContent: 'center'
  },
  micBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1.5,
    borderColor: isDark ? '#FFD400' : colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: '#FFD400',
    borderColor: isDark ? '#FFD400' : colors.primaryDark,
  },
  listeningLabel: {
    color: isDark ? '#FFD400' : colors.primaryDark,
    fontSize: 10,
    fontFamily: Typography.fontFamily.medium,
    marginBottom: 2,
    marginLeft: 4,
    letterSpacing: 0.5,
  },

  /* ── Toggle Switch Styles ── */
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceVariant,
    borderRadius: 24,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#FFD400',
  },
  toggleBtnText: {
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 12,
    textAlign: 'center',
  },
  toggleBtnTextActive: {
    color: '#000',
  },

  /* ── Time Filter Styles ── */
  filterContainer: {
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterHeaderLabel: {
    color: colors.textTertiary,
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterInput: {
    flex: 1,
    height: 38,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  filterText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
  },
  filterResetBtn: {
    marginLeft: 10,
    padding: 4,
  },
  selectAllFilteredBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  selectAllFilteredText: {
    color: isDark ? '#FFD400' : colors.primaryDark,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
  },
  displaySlotsBtn: {
    height: 40,
    backgroundColor: '#FFD400',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  displaySlotsBtnText: {
    color: '#000',
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
  },
  /* ── Filtered Slots Center Modal ── */
  fsModalBackdrop: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  fsModalCard: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  fsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fsModalTitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  fsModalSubtitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: isDark ? '#FFD400' : colors.primaryDark,
    marginTop: 2,
  },
  fsSelectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 212, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 212, 0, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 10,
  },
  fsSelectAllText: {
    color: isDark ? '#FFD400' : colors.primaryDark,
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
  },
  fsModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderWidth: 1.5,
  },
  fsSlotCheckbox: {
    width: 22,
    alignItems: 'center',
  },
  fsSlotTime: {
    flex: 1,
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textPrimary,
    marginLeft: 8,
  },
  fsSlotBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginHorizontal: 8,
  },
  fsSlotBadgeText: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
  },
  fsSlotPrice: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    minWidth: 44,
    textAlign: 'right',
  },
  fsModalFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  fsFooterLabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  fsFooterBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  fsFooterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: 18,
    paddingVertical: 10,
  },
  fsFooterBtnText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
  },
  slotPartialDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF9800',
    position: 'absolute',
    top: 6,
    right: 8,
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF9800',
    marginRight: 8,
  },
  legendText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: Typography.fontFamily.medium,
    flex: 1,
  },
});

export default SlotManagerScreen;
