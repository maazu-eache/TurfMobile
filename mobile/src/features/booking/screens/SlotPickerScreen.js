import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSlots, clearSlots } from '../../slot/slotSlice';
import { rescheduleBooking } from '../bookingSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import moment from 'moment'; // Assuming moment is used, or native Date
import { formatISTTime } from '../../../utils/dateFormatter';
import { showCustomAlert } from '../../../components/CustomAlert';
import api from '../../../api/axios';

/**
 * Returns true if the slot's start time is in the past or within 1 hour from now.
 * Only applied when the selected date is TODAY.
 */
const isPastSlot = (selectedDate, startTime) => {
  const today = moment().format('YYYY-MM-DD');
  if (selectedDate !== today) return false; // Future dates are always fine
  // Combine today's date with slot startTime to get a comparable moment
  const slotStart = moment(`${selectedDate} ${startTime}`, 'YYYY-MM-DD HH:mm');
  const cutoff = moment().add(1, 'hour'); // Must be at least 1 hr in the future
  return slotStart.isBefore(cutoff);
};


const SlotPickerScreen = ({ route, navigation }) => {
  const { turf, isRescheduling, reschedulingBookingId, oldTotalPrice } = route.params;
  const dispatch = useDispatch();
  const { slots, isLoading, error } = useSelector((state) => state.slot);
  const { isAuthenticated } = useSelector((state) => state.auth);

  // Date selection state (next 7 days)
  const today = moment();
  const [selectedDate, setSelectedDate] = useState(today.format('YYYY-MM-DD'));
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(moment().startOf('month'));
  const [activePicker, setActivePicker] = useState('none'); // 'start', 'end', 'startTime', 'endTime', 'none'

  // Bulk Mode State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkParams, setBulkParams] = useState({
    startDate: moment().format('YYYY-MM-DD'),
    endDate: moment().add(7, 'days').format('YYYY-MM-DD'),
    daysOfWeek: [], // 0=Sun, 1=Mon...
    startTime: '',
    endTime: ''
  });
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);

  // Generate 7 days for horizontal list
  const dates = Array.from({ length: 7 }).map((_, i) => moment().add(i, 'days'));

  // Format time to AM/PM
  const formatTime = (timeStr) => formatISTTime(timeStr);

  useEffect(() => {
    dispatch(fetchSlots({ turfId: turf._id, date: selectedDate }));
    return () => dispatch(clearSlots());
  }, [turf._id, selectedDate, dispatch]);

  const toggleSlot = (slot) => {
    if (slot.status !== 'available') return;
    if (isPastSlot(selectedDate, slot.startTime)) return; // Block past/near-past slots
    const exists = selectedSlots.find(s => s._id === slot._id);
    if (exists) {
      setSelectedSlots(selectedSlots.filter(s => s._id !== slot._id));
    } else {
      setSelectedSlots([...selectedSlots, slot]);
    }
  };

  // When date changes, drop any selected slots that are now in the past
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
        navigation.navigate('Main', { screen: 'Bookings' }); // Adjust route as needed
      } else {
        showCustomAlert('Error', res.payload || 'Failed to reschedule booking.');
      }
    } else {
      navigation.navigate('BookingConfirm', { turf, slots: selectedSlots });
    }
  };

  /**
   * Cross-midnight aware bulk search.
   * When startTime > endTime (e.g. 23:00 → 01:00), the window wraps midnight.
   * We split into two requests:
   *  1. Evening part: startTime → "23:59" on the ORIGINAL date range.
   *  2. Midnight part: "00:00" → endTime on the date range shifted +1 day.
   */
  const handleBulkSearch = async () => {
    const { startTime, endTime, startDate, endDate } = bulkParams;

    if (!startDate || !endDate) {
      return showCustomAlert('Missing Info', 'Please select a date range first.');
    }
    if (!startTime || !endTime) {
      return showCustomAlert('Missing Info', 'Please select both start and end times.');
    }

    setIsBulkLoading(true);
    try {
      const isCrossMidnight =
        startTime && endTime && startTime > endTime; // "23:00" > "01:00" → true

      let fetchedSlots = [];

      if (isCrossMidnight) {
        const nextDayDaysOfWeek = bulkParams.daysOfWeek.length > 0
          ? bulkParams.daysOfWeek.map(d => (d + 1) % 7)
          : [];

        // Request 1 – evening slots (startTime → end of day)
        const [res1, res2] = await Promise.all([
          api.post('/slots/bulk-search', {
            turfId: turf._id,
            ...bulkParams,
            endTime: '23:59',
          }),
          // Request 2 – midnight slots (start of day → endTime) on next-day dates
          api.post('/slots/bulk-search', {
            turfId: turf._id,
            ...bulkParams,
            startTime: '00:00',
            startDate: moment(startDate).add(1, 'day').format('YYYY-MM-DD'),
            endDate: moment(endDate).add(1, 'day').format('YYYY-MM-DD'),
            daysOfWeek: nextDayDaysOfWeek
          }),
        ]);
        fetchedSlots = [
          ...(res1.data.data || []),
          ...(res2.data.data || []),
        ];
      } else {
        const res = await api.post('/slots/bulk-search', {
          turfId: turf._id,
          ...bulkParams,
        });
        fetchedSlots = res.data.data || [];
      }

      // Filter out past slots and de-duplicate
      const existingIds = new Set(selectedSlots.map(s => s._id));
      const newSlots = fetchedSlots.filter(
        s => !existingIds.has(s._id) && s.status === 'available'
      );

      if (newSlots.length === 0) {
        showCustomAlert('No Slots Found', 'No available slots matched your criteria.');
      } else {
        const subtotal = newSlots.reduce((acc, s) => acc + s.price, 0);
        const platformFee = Math.round(subtotal * 0.05);
        setPreviewResult({
          slots: newSlots,
          subtotal,
          platformFee,
          total: subtotal + platformFee
        });
      }
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to search bulk slots');
    } finally {
      setIsBulkLoading(false);
    }
  };

  const confirmBulkAdd = () => {
    if (!previewResult) return;
    setSelectedSlots([...selectedSlots, ...previewResult.slots]);
    setShowBulkModal(false);
    showCustomAlert('Success', `${previewResult.slots.length} slots added to your cart!`);
    setPreviewResult(null);
  };

  const toggleDayOfWeek = (dayIndex) => {
    const current = bulkParams.daysOfWeek;
    if (current.includes(dayIndex)) {
      setBulkParams({ ...bulkParams, daysOfWeek: current.filter(d => d !== dayIndex) });
    } else {
      setBulkParams({ ...bulkParams, daysOfWeek: [...current, dayIndex] });
    }
  };

  const renderDateItem = (dateObj) => {
    const dateStr = dateObj.format('YYYY-MM-DD');
    const isSelected = dateStr === selectedDate;
    return (
      <TouchableOpacity
        key={dateStr}
        style={[styles.dateBox, isSelected && styles.dateBoxSelected]}
        onPress={() => setSelectedDate(dateStr)}
      >
        <Text style={[styles.dateDay, isSelected && styles.dateTextSelected]}>{dateObj.format('ddd')}</Text>
        <Text style={[styles.dateNum, isSelected && styles.dateTextSelected]}>{dateObj.format('DD')}</Text>
        <Text style={[styles.dateMonth, isSelected && styles.dateTextSelected]}>{dateObj.format('MMM')}</Text>
      </TouchableOpacity>
    );
  };

  const getSlotStyle = (slot, isSelected) => {
    // Past slot (today only, within 1 hr from now)
    if (isPastSlot(selectedDate, slot.startTime)) {
      return {
        container: { backgroundColor: 'rgba(0,0,0,0.2)', borderColor: Colors.border, opacity: 0.45 },
        text: { color: Colors.textTertiary, textDecorationLine: 'line-through' },
        label: 'PAST',
        labelColor: Colors.textTertiary,
      };
    }
    if (isSelected) {
      return {
        container: { backgroundColor: Colors.primary, borderColor: Colors.primary },
        text: { color: '#000', textDecorationLine: 'none' },
        label: null,
        labelColor: null,
      };
    }
    switch (slot.status) {
      case 'available':
        return {
          container: { backgroundColor: Colors.surface, borderColor: Colors.primary },
          text: { color: Colors.textPrimary, textDecorationLine: 'none' },
          label: null,
          labelColor: null,
        };
      case 'booked':
        return {
          container: { backgroundColor: 'rgba(33,150,243,0.1)', borderColor: '#2196F3', opacity: 0.7 },
          text: { color: Colors.textTertiary, textDecorationLine: 'line-through' },
          label: 'BOOKED',
          labelColor: '#2196F3',
        };
      case 'offline_booking':
      case 'offline':
        return {
          container: { backgroundColor: 'rgba(156,39,176,0.1)', borderColor: '#9C27B0', opacity: 0.7 },
          text: { color: Colors.textTertiary, textDecorationLine: 'line-through' },
          label: 'OFFLINE',
          labelColor: '#9C27B0',
        };
      case 'maintenance':
        return {
          container: { backgroundColor: 'rgba(244,67,54,0.1)', borderColor: Colors.error, opacity: 0.7 },
          text: { color: Colors.textTertiary, textDecorationLine: 'line-through' },
          label: 'MAINT.',
          labelColor: Colors.error,
        };
      default:
        return {
          container: { backgroundColor: Colors.surface, borderColor: Colors.border },
          text: { color: Colors.textSecondary },
          label: null,
          labelColor: null,
        };
    }
  };

  const renderSlot = (slot) => {
    const isSelected = selectedSlots.find(s => s._id === slot._id);
    const past = isPastSlot(selectedDate, slot.startTime);
    const dynamicStyle = getSlotStyle(slot, isSelected);
    const isDisabled = slot.status !== 'available' || past;

    return (
      <TouchableOpacity
        key={slot._id}
        style={[styles.slot, dynamicStyle.container]}
        onPress={() => toggleSlot(slot)}
        disabled={isDisabled}
      >
        <Text style={[styles.slotTime, dynamicStyle.text]}>
          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
        </Text>
        <Text style={[styles.slotPrice, dynamicStyle.text]}>₹{slot.price}</Text>
        {dynamicStyle.label && (
          <Text style={[
            styles.slotLabel,
            { color: dynamicStyle.labelColor }
          ]}>
            {dynamicStyle.label}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const totalPrice = selectedSlots.reduce((acc, s) => acc + s.price, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRescheduling ? 'Reschedule Slots' : 'Select Slots'}</Text>
        <TouchableOpacity onPress={() => setShowBulkModal(true)}>
          <Icon name="calendar-multiselect" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Date Picker */}
      <View style={styles.datePickerContainer}>
        <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateScroll}>
          <TouchableOpacity
            style={styles.calendarBtn}
            onPress={() => {
              setActivePicker('none');
              setShowCalendar(true);
            }}
          >
            <Icon name="calendar-month" size={28} color={Colors.primary} />
            <Text style={styles.calendarBtnText}>More</Text>
          </TouchableOpacity>
          {dates.map(renderDateItem)}
        </KeyboardAwareScrollView>
      </View>

      {/* Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.primary }]} /><Text style={styles.legendText}>Selected</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primary }]} /><Text style={styles.legendText}>Available</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} /><Text style={styles.legendText}>Booked</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.border }]} /><Text style={styles.legendText}>Past</Text></View>
      </View>

      {/* Slots List */}
      <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.slotsContainer}>
        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
        ) : slots.length === 0 ? (
          <Text style={styles.emptyText}>No slots generated for this date yet.</Text>
        ) : (
          <View style={styles.slotsGrid}>
            {slots.map(renderSlot)}
          </View>
        )}
      </KeyboardAwareScrollView>

      {/* Footer / Checkout Button */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.totalLabel}>{selectedSlots.length} Slots Selected</Text>
          <Text style={[styles.totalPrice, isRescheduling && totalPrice !== oldTotalPrice && { color: Colors.error }]}>₹{totalPrice}</Text>
          {isRescheduling && (
            <Text style={{ fontSize: 10, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium }}>
              Must equal old price: ₹{oldTotalPrice}
            </Text>
          )}
        </View>
        <TouchableOpacity style={[styles.continueBtn, selectedSlots.length === 0 && { opacity: 0.5 }]} onPress={handleContinue} disabled={selectedSlots.length === 0}>
          <LinearGradient colors={Colors.gradients.primary} style={styles.continueBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={styles.continueBtnText}>{isRescheduling ? 'Reschedule' : 'Continue →'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>



      {/* Bulk Booking Modal */}
      {showBulkModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bulk Booking Search</Text>
              <TouchableOpacity onPress={() => setShowBulkModal(false)}>
                <Icon name="close" size={24} color={Colors.textPrimary} />
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
                <View style={[styles.previewRow, { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, marginTop: 10 }]}>
                  <Text style={[styles.previewLabel, { fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary }]}>Total Payable</Text>
                  <Text style={[styles.previewValue, { fontFamily: Typography.fontFamily.bold, color: Colors.primary }]}>₹{previewResult.total}</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                  <TouchableOpacity style={[styles.searchBtn, { flex: 1, backgroundColor: Colors.surfaceVariant }]} onPress={() => setPreviewResult(null)}>
                    <Text style={[styles.searchBtnText, { color: Colors.textPrimary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.searchBtn, { flex: 1 }]} onPress={confirmBulkAdd}>
                    <Text style={styles.searchBtnText}>Add to Cart</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={{ maxHeight: 400 }}>
                  <Text style={styles.label}>Date Range (IST)</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                    <TouchableOpacity
                      style={styles.pickerInput}
                      onPress={() => { setActivePicker('start'); setShowCalendar(true); }}
                    >
                      <Text style={[styles.pickerText, !bulkParams.startDate && { color: Colors.textTertiary }]}>
                        {bulkParams.startDate ? moment(bulkParams.startDate).format('DD MMM YYYY') : 'Start Date'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pickerInput}
                      onPress={() => { setActivePicker('end'); setShowCalendar(true); }}
                    >
                      <Text style={[styles.pickerText, !bulkParams.endDate && { color: Colors.textTertiary }]}>
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
                      <Text style={[styles.pickerText, !bulkParams.startTime && { color: Colors.textTertiary }]}>
                        {bulkParams.startTime ? formatTime(bulkParams.startTime) : 'Start Time'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pickerInput}
                      onPress={() => setActivePicker('endTime')}
                    >
                      <Text style={[styles.pickerText, !bulkParams.endTime && { color: Colors.textTertiary }]}>
                        {bulkParams.endTime ? formatTime(bulkParams.endTime) : 'End Time'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </KeyboardAwareScrollView>

                <TouchableOpacity style={styles.searchBtn} onPress={handleBulkSearch} disabled={isBulkLoading}>
                  {isBulkLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.searchBtnText}>Search & Preview Cost</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {/* Time Picker Modal */}
      {(activePicker === 'startTime' || activePicker === 'endTime') && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: Spacing.md }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Time</Text>
              <TouchableOpacity onPress={() => setActivePicker('none')}>
                <Icon name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={{ maxHeight: 300 }} contentContainerStyle={styles.timeGrid}>
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
            </KeyboardAwareScrollView>
          </View>
        </View>
      )}

      {/* Custom JS Calendar Modal */}
      {showCalendar && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setCalendarMonth(moment(calendarMonth).subtract(1, 'month'))}>
                <Icon name="chevron-left" size={30} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{calendarMonth.format('MMMM YYYY')}</Text>
              <TouchableOpacity onPress={() => setCalendarMonth(moment(calendarMonth).add(1, 'month'))}>
                <Icon name="chevron-right" size={30} color={Colors.textPrimary} />
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
                      <Text style={[styles.calDayText, isPast && { color: Colors.textTertiary }, isSel && { color: '#000' }]}>{i}</Text>
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
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.xl, paddingTop: 60, backgroundColor: Colors.backgroundElevated },
  headerTitle: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  datePickerContainer: { backgroundColor: Colors.backgroundElevated, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dateScroll: { paddingHorizontal: Spacing.xl, gap: 12 },
  dateBox: { width: 64, height: 80, borderRadius: BorderRadius.lg, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  dateBoxSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dateDay: { fontSize: 12, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, textTransform: 'uppercase' },
  dateNum: { fontSize: 24, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, marginVertical: 2 },
  dateMonth: { fontSize: 12, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  dateTextSelected: { color: '#000' },
  legendContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: Spacing.sm, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 11, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  slotsContainer: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 220 },
  emptyText: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40, fontFamily: Typography.fontFamily.medium },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: '2%', justifyContent: 'flex-start' },
  slot: { width: '31%', paddingVertical: 12, paddingHorizontal: 4, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: 'center', marginBottom: 8 },
  slotTime: { fontSize: 11, fontFamily: Typography.fontFamily.bold, marginBottom: 2, textAlign: 'center' },
  slotPrice: { fontSize: 11, fontFamily: Typography.fontFamily.medium },
  slotLabel: { fontSize: 9, fontFamily: Typography.fontFamily.bold, marginTop: 4, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.backgroundElevated, borderTopWidth: 1, borderTopColor: Colors.border, padding: Spacing.lg, paddingBottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: Colors.textSecondary, fontSize: 14, fontFamily: Typography.fontFamily.medium },
  totalPrice: { color: Colors.textPrimary, fontSize: 24, fontFamily: Typography.fontFamily.bold },
  continueBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden', width: 140 },
  continueBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  continueBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  calendarBtn: { width: 64, height: 80, borderRadius: BorderRadius.lg, backgroundColor: Colors.backgroundElevated, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' },
  calendarBtnText: { fontSize: 12, color: Colors.primary, fontFamily: Typography.fontFamily.medium, marginTop: 4 },
  modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modalContent: { width: '85%', backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: Typography.fontSize.lg, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayOfWeek: { width: '14.28%', textAlign: 'center', color: Colors.textSecondary, marginBottom: Spacing.md, fontFamily: Typography.fontFamily.bold },
  calDay: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 4, borderRadius: 20 },
  calDaySel: { backgroundColor: Colors.primary },
  calDayText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium },
  closeModalBtn: { marginTop: Spacing.lg, padding: 12, backgroundColor: Colors.surfaceVariant, borderRadius: BorderRadius.md, alignItems: 'center' },
  closeModalText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  label: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 8, marginTop: 8 },
  pickerInput: { flex: 1, backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.md, paddingHorizontal: 12, height: 48, justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  pickerText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingBottom: 20 },
  timeBox: { width: '30%', paddingVertical: 12, backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  timeBoxSel: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timeText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  dayChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundElevated },
  dayChipSel: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayChipText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold },
  searchBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: BorderRadius.lg, alignItems: 'center', marginTop: Spacing.lg },
  searchBtnText: {
    color: '#000',
    fontFamily: Typography.fontFamily.bold,
  },

  // Preview Styles
  previewContainer: {
    padding: Spacing.md,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  previewLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
  },
  previewValue: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textPrimary,
  }
});

export default SlotPickerScreen;
