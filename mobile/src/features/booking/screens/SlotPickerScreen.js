import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import LinearGradient from '../../../components/SolidGradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSlots, clearSlots } from '../../slot/slotSlice';
import { rescheduleBooking } from '../bookingSlice';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/theme';
import moment from 'moment';
import { formatISTTime } from '../../../utils/dateFormatter';
import { showCustomAlert } from '../../../components/CustomAlert';
import api from '../../../api/axios';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const isPastSlot = (selectedDate, startTime) => {
  const slotStart = moment(`${selectedDate} ${startTime}`, 'YYYY-MM-DD HH:mm');
  return slotStart.isBefore(moment());
};

const getTimeGroup = (timeStr) => {
  const hour = parseInt(timeStr.split(':')[0], 10);
  if (hour >= 0 && hour < 6) return 'early_morning';
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 16) return 'afternoon';
  if (hour >= 16 && hour < 20) return 'evening';
  return 'night';
};

const SlotPickerScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { turf, isRescheduling, reschedulingBookingId, oldTotalPrice } = route.params;
  const dispatch = useDispatch();
  const { slots, isLoading } = useSelector((state) => state.slot);
  const { isAuthenticated } = useSelector((state) => state.auth);

  const today = moment();
  const [selectedDate, setSelectedDate] = useState(today.format('YYYY-MM-DD'));
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(moment().startOf('month'));
  const [activePicker, setActivePicker] = useState('none');
  const [expandedGroup, setExpandedGroup] = useState('evening'); // Default expanded group

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
    return () => dispatch(clearSlots());
  }, [turf._id, selectedDate, dispatch]);

  const toggleSlot = (slot) => {
    if (slot.status !== 'available') return;
    if (isPastSlot(selectedDate, slot.startTime)) return;
    const exists = selectedSlots.find(s => s._id === slot._id);
    if (exists) {
      setSelectedSlots(selectedSlots.filter(s => s._id !== slot._id));
    } else {
      setSelectedSlots([...selectedSlots, slot]);
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
      const totalPrice = selectedSlots.reduce((acc, s) => acc + s.price, 0);
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
      navigation.navigate('BookingConfirm', { turf, slots: selectedSlots });
    }
  };

  const handleBulkSearch = async () => {
    if (!bulkParams.startTime || !bulkParams.endTime) {
      return showCustomAlert('Time Required', 'Please select start and end time windows.');
    }
    setIsBulkLoading(true);
    try {
      const res = await api.post(`/bookings/bulk-search/${turf._id}`, bulkParams);
      setPreviewResult(res.data.data);
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

  const availableCount = slots.filter(s => s.status === 'available' && !isPastSlot(selectedDate, s.startTime)).length;
  const bookedCount = slots.filter(s => s.status === 'booked' || s.status === 'offline_booking').length;
  const pastCount = slots.filter(s => isPastSlot(selectedDate, s.startTime)).length;

  const totalSelectedPrice = selectedSlots.reduce((acc, s) => acc + s.price, 0);

  // Group slots by time blocks
  const groupedSlots = {
    early_morning: slots.filter(s => getTimeGroup(s.startTime) === 'early_morning'),
    morning: slots.filter(s => getTimeGroup(s.startTime) === 'morning'),
    afternoon: slots.filter(s => getTimeGroup(s.startTime) === 'afternoon'),
    evening: slots.filter(s => getTimeGroup(s.startTime) === 'evening'),
    night: slots.filter(s => getTimeGroup(s.startTime) === 'night'),
  };

  const renderSlotCard = (slot) => {
    const isSelected = selectedSlots.find(s => s._id === slot._id);
    const past = isPastSlot(selectedDate, slot.startTime);
    const isBooked = slot.status === 'booked' || slot.status === 'offline_booking' || slot.status === 'offline';
    
    let cardStyle = styles.slotCardAvailable;
    let textStyle = styles.slotTextAvailable;

    if (isSelected) {
      cardStyle = styles.slotCardSelected;
      textStyle = styles.slotTextSelected;
    } else if (isBooked) {
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
          <Icon name="lock-outline" size={14} color="rgba(255,255,255,0.25)" style={styles.slotStateIcon} />
        ) : past ? (
          <Icon name="clock-alert-outline" size={14} color="rgba(255,255,255,0.15)" style={styles.slotStateIcon} />
        ) : isSelected ? (
          <Icon name="check-circle" size={14} color="#FFF" style={styles.slotStateIcon} />
        ) : null}
        <Text style={[styles.slotTime, textStyle, past && { textDecorationLine: 'line-through' }]}>
          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
        </Text>
        <Text style={[styles.slotPrice, textStyle]}>₹{slot.price}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* ── Floating 3D Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRescheduling ? 'Reschedule Slots' : 'Select Slots'}</Text>
        <TouchableOpacity onPress={() => setShowBulkModal(true)} style={styles.headerBtn}>
          <Icon name="calendar-multiselect" size={20} color="#FFD400" />
        </TouchableOpacity>
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
          >
            <TouchableOpacity
              style={styles.calendarBtn}
              onPress={() => {
                setActivePicker('none');
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

        {/* ── Availability Summary Card ── */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryTitle}>Available Today</Text>
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
            <View style={styles.yellowProgressRing} />
            <Text style={styles.progressText}>{availableCount}</Text>
            <Text style={styles.progressSubText}>Slots</Text>
          </View>
        </View>

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

        <View style={{ height: 160 }} />
      </Animated.ScrollView>

      {/* ── Bottom Booking Card ── */}
      <View style={styles.bottomBookingCard}>
        <View style={styles.bookingLeft}>
          <Text style={styles.selectedCountLabel}>
            {selectedSlots.length} {selectedSlots.length === 1 ? 'Slot' : 'Slots'} Selected
          </Text>
          <Text style={styles.selectedPrice}>₹{totalSelectedPrice}</Text>
        </View>
        <TouchableOpacity
          style={[styles.continueBtn, selectedSlots.length === 0 && styles.continueBtnDisabled]}
          onPress={handleContinue}
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
                  <Text style={styles.previewLabel}>Platform Fee (5%)</Text>
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

      {/* Time Picker Modal */}
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
                )
              })}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Calendar Modal */}
      {showCalendar && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setCalendarMonth(moment(calendarMonth).subtract(1, 'month'))}>
                <Icon name="chevron-left" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{calendarMonth.format('MMMM YYYY')}</Text>
              <TouchableOpacity onPress={() => setCalendarMonth(moment(calendarMonth).add(1, 'month'))}>
                <Icon name="chevron-right" size={24} color="#FFF" />
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
                      <Text style={[styles.calDayText, isPast && { color: 'rgba(255,255,255,0.2)' }, isSel && { color: '#000' }]}>{i}</Text>
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
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: 'rgba(255,255,255,0.6)', fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },
  scroll: { paddingBottom: 160 },

  /* ── Floating 3D Header ── */
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: '#0F0F0F',
    borderBottomWidth: 1, borderColor: '#2A2A2A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#171717',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  headerTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: '#FFF' },

  /* ── Horizontal Date Selector ── */
  datePickerContainer: {
    marginTop: 14,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: '#000',
  },
  dateScroll: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  calendarBtn: {
    width: 64, height: 86, borderRadius: 20,
    backgroundColor: '#0F0F0F',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#2A2A2A', borderStyle: 'dashed',
  },
  calendarBtnText: { fontSize: 10, color: '#FFD400', fontFamily: Typography.fontFamily.bold, marginTop: 4 },
  dateBox: {
    width: 64, height: 86, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6,
    elevation: 4,
  },
  dateBoxInactive: {
    backgroundColor: '#0F0F0F',
    borderWidth: 1, borderColor: '#2A2A2A',
    borderBottomWidth: 3, borderBottomColor: '#171717', // extrusion
    transform: [{ perspective: 1000 }, { rotateX: '6deg' }, { rotateY: '-4deg' }],
  },
  dateBoxSelected: {
    backgroundColor: '#171717',
    borderWidth: 1, borderColor: '#FFD400',
    borderBottomWidth: 4, borderBottomColor: '#BCA100', // yellow extrusion
    transform: [{ scale: 1.02 }],
    shadowColor: '#FFD400',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 10,
    elevation: 8,
  },
  dateDay: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: Typography.fontFamily.medium, textTransform: 'uppercase' },
  dateNum: { fontSize: 20, color: '#FFF', fontFamily: Typography.fontFamily.bold, marginVertical: 1 },
  dateMonth: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: Typography.fontFamily.medium },
  dateTextSelected: { color: '#FFD400' },

  /* ── Availability Summary Card ── */
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 4, marginBottom: 16,
    borderRadius: 22,
    backgroundColor: '#0F0F0F',
    borderWidth: 1, borderColor: '#2A2A2A',
    padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 10,
    elevation: 6,
  },
  summaryLeft: { flex: 1 },
  summaryTitle: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: '#FFF', marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 18 },
  statBlock: { flexDirection: 'column' },
  statLabel: { fontSize: 9, fontFamily: Typography.fontFamily.medium, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' },
  statValue: { fontSize: 16, fontFamily: Typography.fontFamily.extraBold, color: '#FFF', marginTop: 2 },
  statsCircularProgress: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 4, borderColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center',
  },
  yellowProgressRing: {
    position: 'absolute',
    top: -4, left: -4, right: -4, bottom: -4,
    borderRadius: 30, borderWidth: 4, borderColor: '#FFD400',
    borderBottomColor: 'transparent', borderRightColor: 'transparent',
  },
  progressText: { fontSize: 14, fontFamily: Typography.fontFamily.extraBold, color: '#FFF' },
  progressSubText: { fontSize: 7, fontFamily: Typography.fontFamily.bold, color: '#FFD400', textTransform: 'uppercase', marginTop: -2 },

  /* ── Expandable Time Groups ── */
  groupsContainer: { marginHorizontal: 16, gap: 12 },
  groupTile: {
    backgroundColor: '#0F0F0F',
    borderRadius: 20,
    borderWidth: 1, borderColor: '#2A2A2A',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 5,
  },
  groupHeader: {
    padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#0F0F0F',
  },
  groupHeaderExpanded: {
    borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
    backgroundColor: '#171717',
  },
  groupHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  groupLabel: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: '#FFF' },
  groupDesc: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  groupHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  popularBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FFD400',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6,
  },
  popularText: { color: '#000', fontSize: 8, fontFamily: Typography.fontFamily.bold },
  groupContent: { padding: 14, backgroundColor: '#0F0F0F' },
  noSlotsText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: Typography.fontFamily.medium, textAlign: 'center', marginVertical: 10 },

  /* ── Slot Grid & 3D Mini Cards ── */
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: '2.5%', justifyContent: 'flex-start' },
  slotCard: {
    width: '31.6%',
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6,
    elevation: 4,
    position: 'relative',
    transform: [{ perspective: 1000 }, { rotateX: '6deg' }],
  },
  slotStateIcon: { position: 'absolute', top: 4, right: 6 },
  slotTime: { fontSize: 9, fontFamily: Typography.fontFamily.bold, marginBottom: 2 },
  slotPrice: { fontSize: 10, fontFamily: Typography.fontFamily.medium },

  // Slot States Styles
  slotCardAvailable: {
    backgroundColor: '#0F0F0F',
    borderWidth: 1, borderColor: '#FFD400',
    borderBottomWidth: 3, borderBottomColor: '#6A5600', // yellow extrusion
  },
  slotTextAvailable: { color: '#FFF' },
  slotCardSelected: {
    backgroundColor: '#171717',
    borderWidth: 1.5, borderColor: '#FFD400',
    borderBottomWidth: 4, borderBottomColor: '#BCA100', // thick yellow extrusion
    transform: [{ scale: 1.05 }, { translateY: -4 }, { perspective: 1000 }, { rotateX: '6deg' }],
    shadowColor: '#FFD400',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 8,
  },
  slotTextSelected: { color: '#FFD400' },
  slotCardBooked: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1, borderColor: '#2A2A2A',
    borderBottomWidth: 1,
    opacity: 0.45,
  },
  slotTextBooked: { color: 'rgba(255,255,255,0.3)' },
  slotCardPast: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1, borderColor: '#222',
    borderBottomWidth: 1,
    opacity: 0.3,
  },
  slotTextPast: { color: 'rgba(255,255,255,0.2)' },

  /* ── Bottom Summary Booking Card ── */
  bottomBookingCard: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    height: 72, borderRadius: 36,
    backgroundColor: 'rgba(22,22,22,0.95)',
    borderWidth: 1, borderColor: '#2A2A2A',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 15,
    elevation: 10,
    zIndex: 100,
  },
  bookingLeft: { flexDirection: 'column' },
  selectedCountLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: Typography.fontFamily.medium, textTransform: 'uppercase' },
  selectedPrice: { color: '#FFF', fontSize: 20, fontFamily: Typography.fontFamily.bold, marginTop: 1 },
  continueBtn: { borderRadius: 20, overflow: 'hidden', shadowColor: '#FFD400', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  continueBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  continueBtnGrad: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20 },
  continueBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 13 },

  /* ── Bulk Booking Modal & Base Modals ── */
  modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { width: '88%', backgroundColor: '#0F0F0F', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#2A2A2A', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, color: '#FFF', fontFamily: Typography.fontFamily.bold },
  modalClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A2A2A' },
  label: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: '#FFF', marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  pickerInput: { flex: 1, backgroundColor: '#171717', borderRadius: 12, paddingHorizontal: 12, height: 44, justifyContent: 'center', borderWidth: 1, borderColor: '#2A2A2A' },
  pickerText: { color: '#FFF', fontFamily: Typography.fontFamily.medium, fontSize: 12 },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  dayChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#2A2A2A', backgroundColor: '#171717' },
  dayChipSel: { backgroundColor: '#FFD400', borderColor: '#FFD400' },
  dayChipText: { color: 'rgba(255,255,255,0.6)', fontFamily: Typography.fontFamily.bold, fontSize: 11 },
  searchBtn: { backgroundColor: '#FFD400', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  searchBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 13 },

  previewContainer: { padding: 12, backgroundColor: '#171717', borderRadius: 16, borderWidth: 1, borderColor: '#2A2A2A' },
  previewTitle: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: '#FFF', marginBottom: 12, textAlign: 'center' },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  previewRowDivider: { borderTopWidth: 1, borderTopColor: '#2A2A2A', paddingTop: 10, marginTop: 8 },
  previewLabel: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: 'rgba(255,255,255,0.5)' },
  previewValue: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: '#FFF' },
  previewLabelPay: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: '#FFF' },
  previewValuePay: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: '#FFD400' },
  previewCancelBtn: { flex: 1, backgroundColor: '#171717', paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A' },
  previewCancelBtnText: { color: '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: 13 },
  previewAddBtn: { flex: 1, backgroundColor: '#FFD400', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  previewAddBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 13 },

  /* ── Time & Calendar Grids ── */
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start', paddingBottom: 10 },
  timeBox: { width: '23%', paddingVertical: 10, backgroundColor: '#171717', borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 6 },
  timeBoxSel: { backgroundColor: '#FFD400', borderColor: '#FFD400' },
  timeText: { color: '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: 10 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  dayOfWeek: { width: '14.28%', textAlign: 'center', color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontFamily: Typography.fontFamily.bold, fontSize: 11 },
  calDay: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 6, borderRadius: 12 },
  calDaySel: { backgroundColor: '#FFD400' },
  calDayText: { color: '#FFF', fontFamily: Typography.fontFamily.medium, fontSize: 12 },
  closeModalBtn: { marginTop: 16, padding: 12, backgroundColor: '#171717', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A' },
  closeModalText: { color: '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: 12 },
});

export default SlotPickerScreen;