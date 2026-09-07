import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTheme } from '../../../theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Animated,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Svg, { Circle } from 'react-native-svg';
import LinearGradient from '../../../components/SolidGradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSlots, clearSlots, updateSlotStatus } from '../../slot/slotSlice';
import { rescheduleBooking } from '../bookingSlice';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/theme';
import moment from 'moment';
import { formatISTTime } from '../../../utils/dateFormatter';
import { showCustomAlert } from '../../../components/CustomAlert';
import api from '../../../api/axios';
import socketService from '../../../services/socketService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  return 'night';
};

const TIME_GROUPS = [
  { key: 'early_morning', label: 'Early Morning', icon: 'weather-sunset-up', desc: '12:00 AM - 06:00 AM' },
  { key: 'morning', label: 'Morning', icon: 'weather-sunny', desc: '06:00 AM - 12:00 PM' },
  { key: 'afternoon', label: 'Afternoon', icon: 'weather-sunny', desc: '12:00 PM - 04:00 PM' },
  { key: 'evening', label: 'Evening', icon: 'weather-sunset-down', desc: '04:00 PM - 08:00 PM' },
  { key: 'night', label: 'Night', icon: 'weather-night', desc: '08:00 PM - 11:59 PM' }
];

const TIME_OPTIONS = [];
for (let h = 0; h < 24; h++) {
  const hr = h.toString().padStart(2, '0');
  TIME_OPTIONS.push(`${hr}:00`);
  TIME_OPTIONS.push(`${hr}:30`);
}

const SlotPickerScreen = ({ route, navigation }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets?.top || 0, Platform.OS === 'ios' ? 44 : 0);
  const safeBottom = Math.max(insets?.bottom || 0, Platform.OS === 'ios' ? 34 : 0);
  const { turf, isRescheduling, reschedulingBookingId, oldTotalPrice } = route.params;
  const dispatch = useDispatch();
  const { slots, isLoading } = useSelector((state) => state.slot);
  const [selectedIntervalMode, setSelectedIntervalMode] = useState(
    turf.bookingMode === 'both' ? '60' : (turf.bookingMode === '30_min' ? '30' : '60')
  );
  const [filterFromTime, setFilterFromTime] = useState('');
  const [filterToTime, setFilterToTime] = useState('');
  const [showNativeFromPicker, setShowNativeFromPicker] = useState(false);
  const [showNativeToPicker, setShowNativeToPicker] = useState(false);
  
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

  const { isAuthenticated } = useSelector((state) => state.auth);

  const today = moment();
  const [selectedDate, setSelectedDate] = useState(today.format('YYYY-MM-DD'));
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [platformFeePercent, setPlatformFeePercent] = useState(5);
  const [cancellationRefundPercent, setCancellationRefundPercent] = useState(70);
  const [cancellationPlatformPercent, setCancellationPlatformPercent] = useState(10);
  const [calendarMonth, setCalendarMonth] = useState(moment().startOf('month'));
  const [activePicker, setActivePicker] = useState('none');
  const [expandedGroup, setExpandedGroup] = useState(getCurrentTimeGroup());
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showFilteredSlotsModal, setShowFilteredSlotsModal] = useState(false);

  // Bulk Mode State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkParams, setBulkParams] = useState({
    startDate: moment().format('YYYY-MM-DD'),
    endDate: moment().add(7, 'days').format('YYYY-MM-DD'),
    daysOfWeek: [],
    startTime: '',
    endTime: ''
  });
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Generate 7 days for horizontal selector
  const dates = Array.from({ length: 7 }).map((_, i) => moment().add(i, 'days'));

  const formatTime = (timeStr) => formatISTTime(timeStr);

  useEffect(() => {
    dispatch(fetchSlots({ turfId: turf._id, date: selectedDate }));
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    
    // Fetch dynamic platform fee & cancellation percent
    api.get('/admin/public-settings').then(res => {
      if (res.data?.data) {
        if (res.data.data.bookingPlatformFeePercent !== undefined) setPlatformFeePercent(res.data.data.bookingPlatformFeePercent);
        if (res.data.data.cancellationRefundPercent !== undefined) setCancellationRefundPercent(res.data.data.cancellationRefundPercent);
        if (res.data.data.cancellationPlatformPercent !== undefined) setCancellationPlatformPercent(res.data.data.cancellationPlatformPercent);
      }
    }).catch(console.error);

    // Join Turf Room for real-time slot updates
    socketService.getSocket()?.emit('join_turf_room', { turfId: turf._id });
    
    const unsubs = [
      socketService.on('slots_locked', (data) => {
        if (data.turfId === turf._id && data.slots) {
          dispatch(updateSlotStatus({ slotIds: data.slots, status: 'booked' }));
        }
      }),
      socketService.on('slots_freed', (data) => {
        if (data.turfId === turf._id && data.slots) {
          dispatch(updateSlotStatus({ slotIds: data.slots, status: 'available' }));
        }
      })
    ];

    return () => {
      socketService.getSocket()?.emit('leave_turf_room', { turfId: turf._id });
      unsubs.forEach(unsub => unsub());
      dispatch(clearSlots());
    };
  }, [turf._id, selectedDate, dispatch]);

  const toggleSlot = (slot) => {
    if (slot.isMerged) {
      const s1Booked = slot.originalSlots[0].status !== 'available';
      const s2Booked = slot.originalSlots[1].status !== 'available';
      const isPartiallyBooked = (s1Booked && !s2Booked) || (!s1Booked && s2Booked);
      if (isPartiallyBooked) {
        setSelectedIntervalMode('30');
        return;
      }
    }

    if (slot.status !== 'available') return;
    if (isPastSlot(selectedDate, slot.startTime)) return;

    if (slot.isMerged) {
      const allSelected = slot.originalSlots.every(os => selectedSlots.some(s => s._id === os._id));
      if (allSelected) {
        // Deselect all original slots of this merged slot
        const idsToRemove = slot.originalSlots.map(os => os._id);
        setSelectedSlots(prev => prev.filter(s => !idsToRemove.includes(s._id)));
      } else {
        // Select all original slots
        const toAdd = slot.originalSlots.filter(os => !selectedSlots.some(s => s._id === os._id));
        setSelectedSlots(prev => [...prev, ...toAdd]);
      }
    } else {
      const exists = selectedSlots.find(s => s._id === slot._id);
      if (exists) {
        setSelectedSlots(prev => prev.filter(s => s._id !== slot._id));
      } else {
        setSelectedSlots(prev => [...prev, slot]);
      }
    }
  };

  useEffect(() => {
    setSelectedSlots(prev =>
      prev.filter(s => !isPastSlot(selectedDate, s.startTime))
    );
  }, [selectedDate]);

  const handleContinue = async () => {
    if (!isAuthenticated) {
      return navigation.navigate('AuthModal', { screen: 'Login' });
    }
    if (selectedSlots.length === 0) {
      return showCustomAlert('Select Slot', 'Please select at least one slot to continue.');
    }

    if (isRescheduling) {
      const totalPrice = selectedSlots.reduce((acc, s) => acc + (s.discountPrice !== undefined && s.discountPrice !== null ? s.discountPrice : s.price), 0);
      if (totalPrice !== oldTotalPrice) {
        return showCustomAlert('Price Mismatch', 'The total price of new slots must match exactly the old booking. Please cancel and rebook instead.');
      }

      const res = await dispatch(rescheduleBooking({ id: reschedulingBookingId, newSlots: selectedSlots.map(s => s._id) }));
      if (rescheduleBooking.fulfilled.match(res)) {
        showCustomAlert('Success', 'Booking successfully rescheduled!');
        navigation.navigate('Main', { screen: 'Bookings' });
      } else {
        showCustomAlert('Error', res.payload || 'Failed to reschedule booking.');
      }
    } else {
      setShowPolicyModal(true);
    }
  };

  const handleBulkSearch = async () => {
    if (!bulkParams.startTime || !bulkParams.endTime) {
      return showCustomAlert('Time Required', 'Please select start and end time windows.');
    }
    setIsBulkLoading(true);
    try {
      const res = await api.post(`/slots/bulk-search`, { ...bulkParams, turfId: turf._id });
      // The API returns an array of slots. We need to calculate the preview.
      const fetchedSlots = res.data.data || [];
      const subtotal = fetchedSlots.reduce((acc, s) => acc + s.price, 0);
      const calculatedPlatformFee = Math.round(subtotal * (platformFeePercent / 100));
      const total = subtotal + calculatedPlatformFee;
      
      setPreviewResult({
        slots: fetchedSlots,
        subtotal,
        platformFee: calculatedPlatformFee,
        total
      });
    } catch (e) {
      showCustomAlert('Search Failed', e.response?.data?.message || 'Failed to find matching slots.');
    } finally {
      setIsBulkLoading(false);
    }
  };

  const confirmBulkAdd = () => {
    if (previewResult && previewResult.slots.length > 0) {
      setSelectedSlots(previewResult.slots);
      setShowBulkModal(false);
      setPreviewResult(null);
    }
  };

  const toggleDayOfWeek = (dayIndex) => {
    const current = bulkParams.daysOfWeek;
    if (current.includes(dayIndex)) {
      setBulkParams({ ...bulkParams, daysOfWeek: current.filter(d => d !== dayIndex) });
    } else {
      setBulkParams({ ...bulkParams, daysOfWeek: [...current, dayIndex] });
    }
  };

  // Render Date item with perspective tilts
  const renderDateItem = (dateObj) => {
    const dateStr = dateObj.format('YYYY-MM-DD');
    const isSelected = dateStr === selectedDate;
    return (
      <TouchableOpacity
        key={dateStr}
        style={[
          styles.dateBox,
          isSelected ? styles.dateBoxSelected : styles.dateBoxInactive
        ]}
        onPress={() => setSelectedDate(dateStr)}
        activeOpacity={0.85}
      >
        <Text style={[styles.dateDay, isSelected && styles.dateTextSelected]}>{dateObj.format('ddd')}</Text>
        <Text style={[styles.dateNum, isSelected && styles.dateTextSelected]}>{dateObj.format('DD')}</Text>
        <Text style={[styles.dateMonth, isSelected && styles.dateTextSelected]}>{dateObj.format('MMM')}</Text>
      </TouchableOpacity>
    );
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
          // Calculate discount price if any
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
            status: (slot1.status === 'available' && slot2.status === 'available') ? 'available' : 'booked',
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
  }, [slots, selectedIntervalMode, turf, filterFromTime, filterToTime]);

  const availableCount = processedSlots.filter(s => s.status === 'available' && !isPastSlot(selectedDate, s.startTime)).length;
  const bookedCount = processedSlots.filter(s => s.status === 'booked' || s.status === 'offline_booking').length;
  const pastCount = processedSlots.filter(s => isPastSlot(selectedDate, s.startTime)).length;

  const totalSelectedPrice = selectedSlots.reduce((acc, s) => acc + (s.discountPrice !== undefined && s.discountPrice !== null ? s.discountPrice : s.price), 0);


  // Group slots by time blocks
  const groupedSlots = {
    early_morning: processedSlots.filter(s => getTimeGroup(s.startTime) === 'early_morning'),
    morning: processedSlots.filter(s => getTimeGroup(s.startTime) === 'morning'),
    afternoon: processedSlots.filter(s => getTimeGroup(s.startTime) === 'afternoon'),
    evening: processedSlots.filter(s => getTimeGroup(s.startTime) === 'evening'),
    night: processedSlots.filter(s => getTimeGroup(s.startTime) === 'night'),
  };

  const renderSlotCard = (slot) => {
    const isSelected = slot.isMerged
      ? slot.originalSlots.every(os => selectedSlots.some(s => s._id === os._id))
      : selectedSlots.some(s => s._id === slot._id);
    const past = isPastSlot(selectedDate, slot.startTime);

    const isPartiallyBooked = slot.isMerged && (() => {
      const s1Booked = slot.originalSlots[0].status !== 'available';
      const s2Booked = slot.originalSlots[1].status !== 'available';
      return (s1Booked && !s2Booked) || (!s1Booked && s2Booked);
    })();

    const isBooked = (slot.status === 'booked' || slot.status === 'offline_booking' || slot.status === 'offline') && !isPartiallyBooked;
    
    let cardStyle = styles.slotCardAvailable;
    let textStyle = styles.slotTextAvailable;

    if (isSelected) {
      cardStyle = styles.slotCardSelected;
      textStyle = styles.slotTextSelected;
    } else if (isBooked) {
      cardStyle = styles.slotCardBooked;
      textStyle = styles.slotTextBooked;
    } else if (isPartiallyBooked) {
      cardStyle = styles.slotCardBooked;
      textStyle = styles.slotTextBooked;
    } else if (past) {
      cardStyle = styles.slotCardPast;
      textStyle = styles.slotTextPast;
    }

    return (
      <TouchableOpacity
        key={slot._id}
        style={[styles.slotCard, cardStyle]}
        onPress={() => toggleSlot(slot)}
        disabled={isBooked || past}
        activeOpacity={0.8}
      >
        {isBooked ? (
          <Icon name="lock-outline" size={11} color={colors.textDisabled} style={styles.slotStateIcon} />
        ) : isPartiallyBooked ? (
          <View style={styles.slotPartialDot} />
        ) : past ? (
          <Icon name="clock-alert-outline" size={11} color={colors.textDisabled} style={styles.slotStateIcon} />
        ) : isSelected ? (
          <Icon name="check-circle" size={12} color={isDark ? '#FFD400' : '#8A6D00'} style={styles.slotStateIcon} />
        ) : null}
        <Text
          style={[styles.slotTime, textStyle, past && { textDecorationLine: 'line-through' }]}
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
        </Text>
        {slot.discountPrice !== undefined && slot.discountPrice !== null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <Text style={[styles.slotPrice, textStyle, { textDecorationLine: 'line-through', opacity: 0.5, fontSize: 9 }]}>
              ₹{slot.price}
            </Text>
            <Text style={[styles.slotPrice, { color: '#2ED573', fontWeight: 'bold' }]}>
              ₹{slot.discountPrice}
            </Text>
          </View>
        ) : (
          <Text style={[styles.slotPrice, textStyle, isSelected && { color: isDark ? '#FFD400' : '#8A6D00' }]}>
            ₹{slot.price}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      {/* ── Floating 3D Header ── */}
      <View style={[styles.header, { paddingTop: safeTop + 14 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRescheduling ? 'Reschedule Slots' : 'Select Slots'}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Fixed Sticky Top Bar: Date Picker & Time Navigation Chips ── */}
      <View style={styles.stickyHeaderSection}>
        {/* Date Selector */}
        <View style={styles.datePickerContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateScroll}
          >
            {/* Calendar button — shows picked date if it's outside the 7-day strip */}
            {(() => {
              const isCustomDate = !dates.some(d => d.format('YYYY-MM-DD') === selectedDate);
              const calMoment = moment(selectedDate, 'YYYY-MM-DD');
              return (
                <TouchableOpacity
                  style={[styles.calendarBtn, isCustomDate && styles.dateBoxSelected]}
                  onPress={() => {
                    setActivePicker('none');
                    setShowCalendar(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Icon name="calendar-month" size={20} color={isCustomDate ? '#FFD400' : '#FFD400'} />
                  {isCustomDate ? (
                    <>
                      <Text style={[styles.dateNum, { color: '#FFD400', fontSize: 13 }]}>{calMoment.format('DD')}</Text>
                      <Text style={[styles.dateMonth, { color: '#FFD400' }]}>{calMoment.format('MMM')}</Text>
                    </>
                  ) : (
                    <Text style={[styles.calendarBtnText]}>More</Text>
                  )}
                </TouchableOpacity>
              );
            })()}
            {dates.map(renderDateItem)}
          </ScrollView>
        </View>

        {/* Time Navigation Bar */}
        <View style={styles.timeNavContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.timeNavScroll}
          >
            {TIME_GROUPS.map((g) => {
              const isActive = expandedGroup === g.key;
              const count = (groupedSlots[g.key] || []).filter(s => s.status === 'available' && !isPastSlot(selectedDate, s.startTime)).length;
              return (
                <TouchableOpacity
                  key={g.key}
                  style={[styles.timeNavChip, isActive && styles.timeNavChipActive]}
                  onPress={() => setExpandedGroup(isActive ? null : g.key)}
                  activeOpacity={0.8}
                >
                  <Icon name={g.icon} size={13} color={isActive ? '#000' : '#FFD400'} style={{ marginRight: 5 }} />
                  <Text style={[styles.timeNavText, isActive && styles.timeNavTextActive]}>
                    {g.label}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.timeNavBadge, isActive && styles.timeNavBadgeActive]}>
                      <Text style={[styles.timeNavBadgeText, isActive && styles.timeNavBadgeTextActive]}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        style={{ opacity: fadeAnim }}
      >

        {/* ── Availability Summary Card ── */}
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
                <Text style={styles.statValue}>{availableCount}</Text>
              </View>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>Booked</Text>
                <Text style={styles.statValue}>{bookedCount}</Text>
              </View>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>Past</Text>
                <Text style={styles.statValue}>{pastCount}</Text>
              </View>
            </View>
          </View>
          <View style={styles.statsCircularProgress}>
            <Svg width={60} height={60} style={{ position: 'absolute' }}>
              <Circle
                cx={30} cy={30} r={26}
                stroke="#FFD400" strokeWidth={4} fill="none"
                strokeDasharray={2 * Math.PI * 26}
                strokeDashoffset={(2 * Math.PI * 26) * (1 - (slots.length ? (availableCount / slots.length) : 0))}
                rotation="-90" origin="30, 30" strokeLinecap="round"
              />
            </Svg>
             <Text style={styles.progressText}>{availableCount}</Text>
            <Text style={styles.progressSubText}>Slots</Text>
          </View>
        </View>

        {/* ── Booking Mode Toggle (only if both are supported) ── */}
        {turf.bookingMode === 'both' && databaseHas30MinSlots && (
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
        <View style={styles.filterContainer}>
          <Text style={styles.filterHeaderLabel}>Filter By Time</Text>
          <View style={styles.filterRow}>
            <TouchableOpacity style={styles.filterInput} onPress={() => setShowNativeFromPicker(true)}>
              <Icon name="clock-outline" size={14} color="#FFD400" style={{ marginRight: 6 }} />
              <Text style={styles.filterText}>
                {filterFromTime ? formatTime(filterFromTime) : 'From Time'}
              </Text>
            </TouchableOpacity>
            
            <Text style={{ color: colors.textSecondary, marginHorizontal: 8 }}>to</Text>
            
            <TouchableOpacity style={styles.filterInput} onPress={() => setShowNativeToPicker(true)}>
              <Icon name="clock-outline" size={14} color="#FFD400" style={{ marginRight: 6 }} />
              <Text style={styles.filterText}>
                {filterToTime ? formatTime(filterToTime) : 'To Time'}
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

          {/* Display Slots Button (Always visible) */}
          <TouchableOpacity
            style={styles.displaySlotsBtn}
            onPress={() => setShowFilteredSlotsModal(true)}
            activeOpacity={0.85}
          >
            <Icon name="view-grid-outline" size={16} color="#000" style={{ marginRight: 6 }} />
            <Text style={styles.displaySlotsBtnText}>
              {filterFromTime || filterToTime ? 'Display Filtered Slots' : 'Display All Slots'}
            </Text>
          </TouchableOpacity>
        </View>

        {selectedIntervalMode === '60' && databaseHas30MinSlots && (
          <View style={styles.legendContainer}>
            <View style={styles.legendDot} />
            <Text style={styles.legendText}>Orange dot indicates slot is partially booked (30 mins booked). Click to switch to 30 min view.</Text>
          </View>
        )}

        {/* ── Expandable Time Groups ── */}
        <View style={styles.groupsContainer}>
          {TIME_GROUPS.map((group) => {
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
                      size={20}
                      color={colors.textSecondary}
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


        <View style={{ height: 160 }} />
      </Animated.ScrollView>

      {/* ── Bottom Booking Card ── */}
      <View style={[styles.bottomBookingCard, { bottom: Math.max(safeBottom, 12) }]}>
        <View style={styles.bookingLeft}>
          {/* <Text style={styles.selectedCountLabel}>
            {selectedSlots.length} {selectedSlots.length === 1 ? 'SLOT' : 'SLOTS'} SELECTED
          </Text> */}
          <Text style={styles.selectedPrice}>₹{totalSelectedPrice}</Text>
        </View>
        <TouchableOpacity
          style={[styles.continueBtn, selectedSlots.length === 0 && styles.continueBtnDisabled]}
          onPress={() => setShowPolicyModal(true)}
          disabled={selectedSlots.length === 0}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#FFD400', '#FFB700']}
            style={styles.continueBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.continueBtnText}>
              {isRescheduling ? 'Reschedule' : 'Continue'}
            </Text>
            <Icon name="arrow-right" size={14} color="#000" style={{ marginLeft: 4 }} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Filtered Slots Center Modal ── */}
      {showFilteredSlotsModal && (
        <Modal visible={showFilteredSlotsModal} transparent={true} animationType="fade" statusBarTranslucent>
          <View style={styles.fsModalBackdrop}>
            <View style={styles.fsModalCard}>
              {/* Header */}
              <View style={styles.fsModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fsModalTitle}>Available Slots</Text>
                  <Text style={styles.fsModalSubtitle}>
                    {filterFromTime ? formatTime(filterFromTime) : 'Start'} → {filterToTime ? formatTime(filterToTime) : 'End'}
                  </Text>
                </View>

                {/* Select All Toggle for available slots */}
                {processedSlots.filter(s => s.status === 'available' && !isPastSlot(selectedDate, s.startTime)).length > 0 && (
                  <TouchableOpacity
                    style={styles.fsSelectAllBtn}
                    onPress={() => {
                      const availSlots = processedSlots.filter(s => s.status === 'available' && !isPastSlot(selectedDate, s.startTime));
                      const allSelected = availSlots.every(s => {
                        if (s.isMerged) return s.originalSlots.every(os => selectedSlots.some(sel => sel._id === os._id));
                        return selectedSlots.some(sel => sel._id === s._id);
                      });

                      if (allSelected) {
                        const idsToRemove = [];
                        availSlots.forEach(s => {
                          if (s.isMerged) idsToRemove.push(...s.originalSlots.map(os => os._id));
                          else idsToRemove.push(s._id);
                        });
                        setSelectedSlots(prev => prev.filter(s => !idsToRemove.includes(s._id)));
                      } else {
                        const toAdd = [];
                        availSlots.forEach(s => {
                          if (s.isMerged) {
                            s.originalSlots.forEach(os => {
                              if (!selectedSlots.some(sel => sel._id === os._id) && !toAdd.some(ta => ta._id === os._id)) {
                                toAdd.push(os);
                              }
                            });
                          } else {
                            if (!selectedSlots.some(sel => sel._id === s._id) && !toAdd.some(ta => ta._id === s._id)) {
                              toAdd.push(s);
                            }
                          }
                        });
                        setSelectedSlots(prev => [...prev, ...toAdd]);
                      }
                    }}
                  >
                    <Icon
                      name={
                        processedSlots.filter(s => s.status === 'available' && !isPastSlot(selectedDate, s.startTime)).length > 0 &&
                        processedSlots.filter(s => s.status === 'available' && !isPastSlot(selectedDate, s.startTime)).every(s => {
                          if (s.isMerged) return s.originalSlots.every(os => selectedSlots.some(sel => sel._id === os._id));
                          return selectedSlots.some(sel => sel._id === s._id);
                        })
                          ? 'checkbox-marked'
                          : 'checkbox-blank-outline'
                      }
                      size={16}
                      color="#FFD400"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.fsSelectAllText}>
                      {processedSlots.filter(s => s.status === 'available' && !isPastSlot(selectedDate, s.startTime)).every(s => {
                        if (s.isMerged) return s.originalSlots.every(os => selectedSlots.some(sel => sel._id === os._id));
                        return selectedSlots.some(sel => sel._id === s._id);
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
                  <Text style={{ color: colors.textSecondary, textAlign: 'center', marginVertical: 24, fontFamily: Typography.fontFamily.medium }}>
                    No slots found in this time range.
                  </Text>
                ) : processedSlots.map((slot) => {
                  const isBooked = slot.status === 'booked' || slot.status === 'offline_booking' || slot.status === 'offline';
                  const past = isPastSlot(selectedDate, slot.startTime);
                  const isSelected = slot.isMerged
                    ? slot.originalSlots.every(os => selectedSlots.some(sel => sel._id === os._id))
                    : selectedSlots.some(sel => sel._id === slot._id);

                  const borderColor = isSelected ? (isDark ? '#FFD400' : colors.primaryDark)
                    : isBooked ? '#2196F3'
                    : past ? (isDark ? '#333' : colors.border)
                    : colors.border;

                  const badgeLabel = isBooked ? 'Booked'
                    : past ? 'Past'
                    : 'Available';

                  const badgeBg = isBooked ? 'rgba(33, 150, 243, 0.15)'
                    : past ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)')
                    : 'rgba(46, 213, 115, 0.15)';

                  const badgeText = isBooked ? '#2196F3'
                    : past ? (isDark ? 'rgba(255, 255, 255, 0.5)' : colors.textTertiary)
                    : '#2ed573';

                  const priceVal = slot.discountPrice !== undefined && slot.discountPrice !== null ? slot.discountPrice : slot.price;

                  return (
                    <TouchableOpacity
                      key={slot._id}
                      activeOpacity={0.75}
                      disabled={isBooked || past}
                      onPress={() => toggleSlot(slot)}
                      style={[
                        styles.fsSlotRow,
                        {
                          borderColor,
                          backgroundColor: isSelected ? (isDark ? 'rgba(255, 212, 0, 0.08)' : '#FFF9D6') : (isDark ? '#1B1B1B' : colors.surfaceVariant),
                          opacity: (isBooked || past) ? 0.6 : 1,
                        }
                      ]}
                    >
                      <View style={styles.fsSlotCheckbox}>
                        {isBooked ? (
                          <Icon name="lock" size={15} color="#2196F3" />
                        ) : past ? (
                          <Icon name="clock-remove-outline" size={15} color={colors.textDisabled} />
                        ) : isSelected ? (
                          <Icon name="check-circle" size={16} color={isDark ? "#FFD400" : colors.primaryDark} />
                        ) : (
                          <Icon name="circle-outline" size={16} color={colors.textTertiary} />
                        )}
                      </View>

                      <Text style={[styles.fsSlotTime, isSelected && { color: isDark ? '#FFD400' : colors.primaryDark, fontFamily: Typography.fontFamily.bold }]}>
                        {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                      </Text>

                      <View style={[styles.fsSlotBadge, { backgroundColor: badgeBg, borderColor: badgeText }]}>
                        <Text style={[styles.fsSlotBadgeText, { color: badgeText }]}>{badgeLabel}</Text>
                      </View>

                      <Text style={[styles.fsSlotPrice, isSelected && { color: isDark ? '#FFD400' : colors.primaryDark }]}>
                        ₹{priceVal}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Modal Footer with Book Now Button */}
              <View style={styles.fsModalFooter}>
                <View style={styles.fsFooterSummaryRow}>
                  <Text style={styles.fsFooterPriceLabel}>
                    Total: <Text style={{ color: isDark ? '#FFD400' : colors.primaryDark, fontFamily: Typography.fontFamily.bold }}>₹{totalSelectedPrice}</Text>
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.fsBookNowBtn, selectedSlots.length === 0 && styles.fsBookNowBtnDisabled]}
                  disabled={selectedSlots.length === 0}
                  onPress={() => {
                    setShowFilteredSlotsModal(false);
                    setShowPolicyModal(true);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.fsBookNowBtnText}>
                    {isRescheduling ? 'Reschedule Now' : 'Book Now'}
                  </Text>
                  <Icon name="arrow-right" size={16} color="#000" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Bulk Booking Modal */}
      {showBulkModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bulk Booking Search</Text>
              <TouchableOpacity onPress={() => setShowBulkModal(false)} style={styles.modalClose}>
                <Icon name="close" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>

            {previewResult ? (
              <View style={styles.previewContainer}>
                <Text style={styles.previewTitle}>{previewResult.slots.length} Slots Found</Text>

                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Subtotal</Text>
                  <Text style={styles.previewValue}>₹{previewResult.subtotal}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Platform Fee ({platformFeePercent}%)</Text>
                  <Text style={styles.previewValue}>₹{previewResult.platformFee}</Text>
                </View>
                <View style={[styles.previewRow, styles.previewRowDivider]}>
                  <Text style={styles.previewLabelPay}>Total Payable</Text>
                  <Text style={styles.previewValuePay}>₹{previewResult.total}</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                  <TouchableOpacity style={styles.previewCancelBtn} onPress={() => setPreviewResult(null)}>
                    <Text style={styles.previewCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.previewAddBtn} onPress={confirmBulkAdd}>
                    <Text style={styles.previewAddBtnText}>Add to Cart</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <ScrollView style={{ maxHeight: 380 }}>
                  <Text style={styles.label}>Date Range (IST)</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                    <TouchableOpacity
                      style={styles.pickerInput}
                      onPress={() => { setActivePicker('start'); setShowCalendar(true); }}
                    >
                      <Text style={styles.pickerText}>
                        {bulkParams.startDate ? moment(bulkParams.startDate).format('DD MMM YYYY') : 'Start Date'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pickerInput}
                      onPress={() => { setActivePicker('end'); setShowCalendar(true); }}
                    >
                      <Text style={styles.pickerText}>
                        {bulkParams.endDate ? moment(bulkParams.endDate).format('DD MMM YYYY') : 'End Date'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>Days of Week</Text>
                  <View style={styles.daysGrid}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[styles.dayChip, bulkParams.daysOfWeek.includes(i) && styles.dayChipSel]}
                        onPress={() => toggleDayOfWeek(i)}
                      >
                        <Text style={[styles.dayChipText, bulkParams.daysOfWeek.includes(i) && { color: '#000' }]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>Time Window</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                    <TouchableOpacity
                      style={styles.pickerInput}
                      onPress={() => setActivePicker('startTime')}
                    >
                      <Text style={styles.pickerText}>
                        {bulkParams.startTime ? formatTime(bulkParams.startTime) : 'Start Time'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pickerInput}
                      onPress={() => setActivePicker('endTime')}
                    >
                      <Text style={styles.pickerText}>
                        {bulkParams.endTime ? formatTime(bulkParams.endTime) : 'End Time'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>

                <TouchableOpacity style={styles.searchBtn} onPress={handleBulkSearch} disabled={isBulkLoading}>
                  {isBulkLoading ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.searchBtnText}>Search & Preview Cost</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

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

      {/* Bulk Booking Time Selection Modal */}
      {(activePicker === 'startTime' || activePicker === 'endTime') && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Time</Text>
              <TouchableOpacity onPress={() => setActivePicker('none')} style={styles.modalClose}>
                <Icon name="close" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.timeGrid}>
              {Array.from({ length: 24 }).map((_, i) => {
                const hour = i.toString().padStart(2, '0');
                const timeStr = `${hour}:00`;
                const isSelected = activePicker === 'startTime' ? bulkParams.startTime === timeStr : bulkParams.endTime === timeStr;
                return (
                  <TouchableOpacity
                    key={timeStr}
                    style={[styles.timeBox, isSelected && styles.timeBoxSel]}
                    onPress={() => {
                      if (activePicker === 'startTime') setBulkParams({ ...bulkParams, startTime: timeStr });
                      else setBulkParams({ ...bulkParams, endTime: timeStr });
                      setActivePicker('none');
                    }}
                  >
                    <Text style={[styles.timeText, isSelected && { color: '#000' }]}>{formatTime(timeStr)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Calendar Modal */}
      {showCalendar && (
        <Modal visible={showCalendar} transparent={true} animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
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
                      (activePicker === 'start' && bulkParams.startDate === dStr) ||
                      (activePicker === 'end' && bulkParams.endDate === dStr);
                    grid.push(
                      <TouchableOpacity
                        key={`day-${i}`}
                        style={[styles.calDay, isSel && styles.calDaySel]}
                        disabled={isPast}
                        onPress={() => {
                          if (activePicker === 'start') {
                            setBulkParams({ ...bulkParams, startDate: dStr });
                          } else if (activePicker === 'end') {
                            setBulkParams({ ...bulkParams, endDate: dStr });
                          } else {
                            setSelectedDate(dStr);
                          }
                          setShowCalendar(false);
                          setActivePicker('none');
                        }}
                      >
                        <Text style={[styles.calDayText, isPast && { color: isDark ? 'rgba(255,255,255,0.2)' : colors.textDisabled }, isSel && { color: '#000' }]}>{i}</Text>
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
      )}
    {/* ── Cancellation Policy Bottom Sheet ── */}
    <Modal
      visible={showPolicyModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowPolicyModal(false)}
    >
      <View style={styles.policyModalOverlay}>
        <TouchableOpacity style={styles.policyModalBackdrop} activeOpacity={1} onPress={() => setShowPolicyModal(false)} />
        <View style={styles.policyModalContent}>
          <View style={styles.policyModalHeader}>
            <Icon name="information-outline" size={24} color={Colors.primary} />
            <Text style={styles.policyModalTitle}>Cancellation Policy</Text>
          </View>
          <Text style={styles.policyModalText}>
            Cancellations are allowed only if requested more than 2 hours before the slot start time.
          </Text>
            <Text style={styles.policyModalText}>
              Refunds are subject to owner approval ({cancellationRefundPercent}% refund of the slot price). The {platformFeePercent}% platform fee is non-refundable. Only online payments are eligible for refunds.
            </Text>
          <View style={styles.policyModalActions}>
            <TouchableOpacity style={styles.policyModalCancelBtn} onPress={() => setShowPolicyModal(false)}>
              <Text style={styles.policyModalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.policyModalConfirmBtn} 
              onPress={() => {
                setShowPolicyModal(false);
                navigation.navigate('BookingConfirm', { 
                  turf, 
                  slots: selectedSlots,
                  platformFeePercent 
                });
              }}
            >
              <Text style={styles.policyModalConfirmText}>Confirm & Pay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </View>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },
  scroll: { paddingBottom: 180 },

  /* ── Header ── */
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.05, shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: isDark ? '#1E1E1E' : colors.surfaceVariant,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },

  /* ── Sticky Top Header Section ── */
  stickyHeaderSection: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
    zIndex: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  timeNavContainer: {
    marginTop: 2,
  },
  timeNavScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  timeNavChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeNavChipActive: {
    backgroundColor: '#FFD400',
    borderColor: '#FFD400',
  },
  timeNavText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textPrimary,
  },
  timeNavTextActive: {
    color: '#000',
    fontFamily: Typography.fontFamily.bold,
  },
  timeNavBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: isDark ? 'rgba(255,212,0,0.15)' : 'rgba(0,0,0,0.06)',
  },
  timeNavBadgeActive: {
    backgroundColor: '#000',
  },
  timeNavBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: '#FFD400',
  },
  timeNavBadgeTextActive: {
    color: '#FFD400',
  },

  /* ── Horizontal Date Selector ── */
  datePickerContainer: {
    marginTop: 6,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: colors.background,
  },
  dateScroll: { paddingHorizontal: 16, gap: 10 },
  calendarBtn: {
    width: 62, height: 78, borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FFD400', borderStyle: 'dashed',
  },
  calendarBtnText: { fontSize: 11, color: '#FFD400', fontFamily: Typography.fontFamily.bold, marginTop: 4 },
  dateBox: {
    width: 62, height: 78, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  dateBoxInactive: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dateBoxSelected: {
    backgroundColor: isDark ? '#2A2400' : '#FFF9D6',
    borderWidth: 1.5, borderColor: '#FFD400',
    shadowColor: '#FFD400',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6,
    elevation: 4,
  },
  dateDay: { fontSize: 10, color: colors.textTertiary, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', marginBottom: 2 },
  dateNum: { fontSize: 18, color: colors.textPrimary, fontFamily: Typography.fontFamily.extraBold },
  dateMonth: { fontSize: 10, color: colors.textTertiary, fontFamily: Typography.fontFamily.medium, marginTop: 2 },
  dateTextSelected: { color: isDark ? '#FFD400' : '#8A6D00' },

  /* ── Availability Summary Card ── */
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.05, shadowRadius: 6,
    elevation: 3,
  },
  summaryLeft: { flex: 1 },
  summaryTitle: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 18 },
  statBlock: { flexDirection: 'column' },
  statLabel: { fontSize: 9, fontFamily: Typography.fontFamily.bold, color: colors.textTertiary, textTransform: 'uppercase' },
  statValue: { fontSize: 16, fontFamily: Typography.fontFamily.extraBold, color: colors.textPrimary, marginTop: 2 },
  statsCircularProgress: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 4, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  progressText: { fontSize: 14, fontFamily: Typography.fontFamily.extraBold, color: colors.textPrimary },
  progressSubText: { fontSize: 7, fontFamily: Typography.fontFamily.bold, color: '#FFD400', textTransform: 'uppercase', marginTop: -2 },

  /* ── Expandable Time Groups ── */
  groupsContainer: { marginHorizontal: 16, marginTop: 4, gap: 12 },
  groupTile: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.05, shadowRadius: 6,
    elevation: 3,
    marginBottom: 2,
  },
  groupHeader: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surface,
  },
  groupHeaderExpanded: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: isDark ? '#171717' : colors.surfaceVariant,
  },
  groupHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  groupLabel: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  groupDesc: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary, marginTop: 2 },
  groupHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  popularBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FFD400',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6,
  },
  popularText: { color: '#000', fontSize: 8, fontFamily: Typography.fontFamily.bold },
  groupContent: { paddingHorizontal: 10, paddingVertical: 12, backgroundColor: colors.surface },
  noSlotsText: { color: colors.textSecondary, fontSize: 12, fontFamily: Typography.fontFamily.medium, textAlign: 'center', marginVertical: 12 },

  /* ── Slot Grid & Cards ── */
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-start',
  },
  slotCard: {
    width: Math.floor((SCREEN_WIDTH - 70) / 3),
    minHeight: 58,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
    borderWidth: 1,
  },
  slotStateIcon: { position: 'absolute', top: 4, right: 4 },
  slotTime: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    textAlign: 'center',
    marginBottom: 3,
    lineHeight: 13,
  },
  slotPrice: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.extraBold,
    textAlign: 'center',
  },

  // Slot States Styles
  slotCardAvailable: {
    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
    borderColor: isDark ? '#333333' : '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.3 : 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  slotTextAvailable: { color: colors.textPrimary },
  slotCardSelected: {
    backgroundColor: isDark ? '#2B2300' : '#FFF9D6',
    borderColor: '#FFD400',
    borderWidth: 1.5,
    shadowColor: '#FFD400',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  slotTextSelected: { color: isDark ? '#FFD400' : '#8A6D00' },
  slotCardBooked: {
    backgroundColor: isDark ? '#141414' : '#F8FAFC',
    borderColor: isDark ? '#262626' : '#E2E8F0',
    opacity: 0.5,
  },
  slotTextBooked: { color: colors.textDisabled },
  slotCardPast: {
    backgroundColor: isDark ? '#0F0F0F' : '#F1F5F9',
    borderColor: isDark ? '#1E1E1E' : '#E2E8F0',
    opacity: 0.4,
  },
  slotTextPast: { color: colors.textTertiary },

  /* ── Bottom Summary Booking Card ── */
  bottomBookingCard: {
    position: 'absolute',
    bottom: 12,
    left: 16, right: 16,
    height: 68,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(24, 24, 24, 0.96)' : '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.4 : 0.1,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 100,
  },
  bookingLeft: { flexDirection: 'column' },
  selectedCountLabel: { color: colors.textTertiary, fontSize: 10, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  selectedPrice: { color: colors.textPrimary, fontSize: 20, fontFamily: Typography.fontFamily.extraBold, marginTop: 1 },
  continueBtn: { borderRadius: 14, overflow: 'hidden', shadowColor: '#FFD400', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 4 },
  continueBtnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  continueBtnGrad: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 20 },
  continueBtnText: { color: '#000000', fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  /* ── Bulk Booking Modal & Base Modals ── */
  modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { width: '88%', backgroundColor: colors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  modalClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: isDark ? '#171717' : colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  label: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  pickerInput: { flex: 1, backgroundColor: isDark ? '#171717' : colors.surfaceVariant, borderRadius: 12, paddingHorizontal: 12, height: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  pickerText: { color: colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 12 },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  dayChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#171717' : colors.surfaceVariant },
  dayChipSel: { backgroundColor: '#FFD400', borderColor: '#FFD400' },
  dayChipText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 11 },
  searchBtn: { backgroundColor: '#FFD400', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  searchBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 13 },

  previewContainer: { padding: 12, backgroundColor: isDark ? '#171717' : colors.surfaceVariant, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  previewTitle: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 12, textAlign: 'center' },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  previewRowDivider: { borderTopWidth: 1, borderTopColor: '#2A2A2A', paddingTop: 10, marginTop: 8 },
  previewLabel: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary },
  previewValue: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: colors.textPrimary },
  previewLabelPay: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  previewValuePay: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: '#FFD400' },
  previewCancelBtn: { flex: 1, backgroundColor: isDark ? '#171717' : colors.surfaceVariant, paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  previewCancelBtnText: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 13 },
  previewAddBtn: { flex: 1, backgroundColor: '#FFD400', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  previewAddBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 13 },

  /* ── Time & Calendar Grids ── */
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start', paddingBottom: 10 },
  timeBox: { width: '23%', paddingVertical: 10, backgroundColor: isDark ? '#171717' : colors.surfaceVariant, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  timeBoxSel: { backgroundColor: '#FFD400', borderColor: '#FFD400' },
  timeText: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 10 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  dayOfWeek: { width: '14.28%', textAlign: 'center', color: colors.textTertiary, marginBottom: 8, fontFamily: Typography.fontFamily.bold, fontSize: 11 },
  calDay: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 6, borderRadius: 12 },
  calDaySel: { backgroundColor: '#FFD400' },
  calDayText: { color: colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 12 },
  closeModalBtn: { marginTop: 16, padding: 14, backgroundColor: isDark ? '#171717' : colors.surfaceVariant, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  closeModalText: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 12 },
  cancellationPolicyContainer: { marginHorizontal: 16, marginTop: 20, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.surfaceVariant, padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: colors.border },
  cancellationPolicyTitle: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 4 },
  cancellationPolicyText: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary, lineHeight: 16 },

  /* ── Policy Modal Styles ── */
  policyModalOverlay: { flex: 1, justifyContent: 'flex-end' },
  policyModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  policyModalContent: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  policyModalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  policyModalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginLeft: 12 },
  policyModalText: { fontSize: 14, color: colors.textSecondary, fontFamily: Typography.fontFamily.regular, marginBottom: 12, lineHeight: 22 },
  policyModalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  policyModalCancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: isDark ? '#2A2A2A' : colors.surfaceVariant, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  policyModalCancelText: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  policyModalConfirmBtn: { flex: 2, padding: 16, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  policyModalConfirmText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 16 },

  /* ── Toggle Switch Styles ── */
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#171717' : colors.surfaceVariant,
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
  toggleBtnText: { color: isDark ? 'rgba(255,255,255,0.6)' : colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 13, textAlign: 'center' },
  toggleBtnTextActive: { color: '#000000', fontFamily: Typography.fontFamily.bold },

  /* ── Time Filter Styles ── */
  filterContainer: {
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 16,
    padding: 12,
    backgroundColor: isDark ? '#171717' : colors.surfaceVariant,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterHeaderLabel: { color: colors.textTertiary, fontSize: 10, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
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
  displaySlotsBtn: {
    height: 38,
    backgroundColor: '#FFD400',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
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
    backgroundColor: isDark ? 'rgba(255, 212, 0, 0.1)' : '#FFF9D6',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 212, 0, 0.3)' : '#FFEAA7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 10,
  },
  fsSelectAllText: {
    color: isDark ? '#FFD400' : '#8A6D00',
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
  fsFooterSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  fsFooterLabel: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  fsFooterPriceLabel: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  fsBookNowBtn: {
    height: 44,
    backgroundColor: '#FFD400',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsBookNowBtnDisabled: {
    opacity: 0.4,
  },
  fsBookNowBtnText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: '#000',
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
    backgroundColor: isDark ? '#111' : colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.borderLight,
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

export default SlotPickerScreen;