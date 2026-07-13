import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api from '../../../api/axios';
import { formatISTTime } from '../../../utils/dateFormatter';
import { showCustomAlert } from '../../../components/CustomAlert';
import moment from 'moment';

/**
 * Returns true if the slot's start time is in the past or within 1 hour from now.
 * Only applied when the selected date is TODAY.
 */
const isPastSlot = (selectedDate, startTime) => {
  const today = moment().format('YYYY-MM-DD');
  if (selectedDate !== today) return false;
  const slotStart = moment(`${selectedDate} ${startTime}`, 'YYYY-MM-DD HH:mm');
  const cutoff = moment().add(1, 'hour');
  return slotStart.isBefore(cutoff);
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

const SlotManagerScreen = ({ navigation }) => {
  const { dashboard } = useSelector((state) => state.owner);
  const turfs = dashboard?.owner?.turfs || [];
  
  const [selectedTurf, setSelectedTurf] = useState(turfs[0]?._id || null);
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [dates, setDates] = useState(generateDates());

  // Multi-select state
  const [selectedSlots, setSelectedSlots] = useState([]);

  // Modal State for Offline Booking or specific details
  const [modalVisible, setModalVisible] = useState(false);
  const [actionType, setActionType] = useState('available');
  const [offlineDetails, setOfflineDetails] = useState({ customerName: '', customerMobile: '', amount: '', reason: 'walk_in' });

  // Bulk Action Modal State
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [bulkData, setBulkData] = useState({
    startDate: '', endDate: '', startTime: '', endTime: '', action: 'status',
    daysOfWeek: [], // 0=Sun, 1=Mon … 6=Sat
    actionData: { status: 'available', price: 0, customerName: '', customerMobile: '', amount: 0, reason: 'walk_in' }
  });

  // Preview state: after "Search Slots", shows matched slot count + price editor
  const [previewResult, setPreviewResult] = useState(null); // { slots: [], customPrice: '' }
  const [isPreviewing, setIsPreviewing] = useState(false);

  const toggleBulkDayOfWeek = (dayIndex) => {
    const current = bulkData.daysOfWeek;
    if (current.includes(dayIndex)) {
      setBulkData({ ...bulkData, daysOfWeek: current.filter(d => d !== dayIndex) });
    } else {
      setBulkData({ ...bulkData, daysOfWeek: [...current, dayIndex] });
    }
  };

  // Reset preview whenever criteria change
  const resetPreview = () => setPreviewResult(null);

  // Custom Calendar State
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(moment().startOf('month'));
  const [activePicker, setActivePicker] = useState('none'); // 'start', 'end', 'startTime', 'endTime', 'singleDate', 'none'

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

  const handleSlotPress = (slot) => {
    if (slot.status === 'booked') {
      return showCustomAlert('Booked', 'This slot is already booked online and cannot be changed.');
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
      setActionType(type);
      setModalVisible(true);
      return;
    }

    // Direct Status Update (Available / Maintenance)
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


  /**
  /**
   * Step 1: Search matching slots (cross-midnight aware) to preview count + price.
   */
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

  /**
   * Step 2: Apply bulk action using the previewed slots + custom price.
   * Cross-midnight aware split.
   */
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


  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return Colors.primary;
      case 'booked': return '#2196F3'; // Blue
      case 'offline_booking': return '#9C27B0'; // Purple
      case 'maintenance': return Colors.error; // Red
      default: return Colors.surfaceVariant;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Slots</Text>
        <TouchableOpacity onPress={() => setBulkModalVisible(true)} style={{width: 40, alignItems: 'flex-end'}}>
          <Icon name="layers-triple" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Turf Selector */}
      <View style={styles.turfSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {turfs.map(t => (
            <TouchableOpacity 
              key={t._id} 
              style={[styles.turfChip, selectedTurf === t._id && styles.turfChipActive]}
              onPress={() => setSelectedTurf(t._id)}
            >
              <Text style={[styles.turfChipText, selectedTurf === t._id && styles.turfChipTextActive]}>{t.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Date Selector */}
      <View style={styles.dateSelector}>
        <TouchableOpacity 
          style={styles.calendarBtn} 
          onPress={() => {
            setActivePicker('singleDate');
            setShowCalendar(true);
          }}
        >
          <Icon name="calendar-month" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {dates.map((d, i) => {
            const mDate = moment(d);
            const dateStr = mDate.format('YYYY-MM-DD');
            const isSelected = dateStr === selectedDate;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.dateCard, isSelected && styles.dateCardActive]}
                onPress={() => {
                  setSelectedDate(dateStr);
                  setDates(generateDates(d));
                }}
              >
                <Text style={[styles.dateMonth, isSelected && styles.dateTextActive]}>
                  {mDate.format('MMM')}
                </Text>
                <Text style={[styles.dateDay, isSelected && styles.dateTextActive]}>
                  {mDate.format('D')}
                </Text>
                <Text style={[styles.dateDayName, isSelected && styles.dateTextActive]}>
                  {mDate.format('ddd')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: getStatusColor('available')}]} /><Text style={styles.legendText}>Available</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: getStatusColor('booked')}]} /><Text style={styles.legendText}>Booked</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: getStatusColor('offline_booking')}]} /><Text style={styles.legendText}>Offline</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: getStatusColor('maintenance')}]} /><Text style={styles.legendText}>Maintenance</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: Colors.border}]} /><Text style={styles.legendText}>Past</Text></View>
      </View>

      {/* Slots Grid */}
      <ScrollView contentContainerStyle={styles.slotsContainer}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
        ) : slots.length === 0 ? (
          <Text style={styles.emptyText}>No slots generated for this day.</Text>
        ) : (
          <View style={styles.grid}>
            {slots.map(slot => {
              const isSelected = selectedSlots.includes(slot._id);
              const past = isPastSlot(selectedDate, slot.startTime);
              return (
                <TouchableOpacity
                  key={slot._id}
                  style={[
                    styles.slotCard,
                    past
                      ? styles.slotCardPast
                      : { borderColor: getStatusColor(slot.status) },
                    isSelected && styles.slotCardSelected,
                  ]}
                  onPress={() => handleSlotPress(slot)}
                  disabled={past}
                >
                  <Text style={[styles.slotTime, {
                    color: past ? Colors.textTertiary
                      : isSelected ? '#000'
                      : getStatusColor(slot.status)
                  }]}>
                    {formatISTTime(slot.startTime)}
                  </Text>
                  <Text style={[styles.slotPrice, {
                    color: past ? Colors.textTertiary
                      : isSelected ? '#000'
                      : getStatusColor(slot.status)
                  }]}>
                    ₹{slot.price}
                  </Text>
                  <Text style={[styles.slotStatus, {
                    color: past ? Colors.textTertiary
                      : isSelected ? '#333'
                      : Colors.textSecondary
                  }]}>
                    {past ? 'PAST' : slot.status.toUpperCase().replace('_', ' ')}
                  </Text>
                  {isSelected && (
                    <View style={styles.checkBadge}>
                      <Icon name="check" size={12} color="#000" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Bar */}
      {selectedSlots.length > 0 && (
        <View style={styles.floatingActionBar}>
          <View style={styles.fabHeader}>
            <Text style={styles.fabTitle}>{selectedSlots.length} Slots Selected</Text>
            <TouchableOpacity onPress={() => setSelectedSlots([])}>
              <Text style={styles.fabClear}>Clear</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.fabButtons}>
            <TouchableOpacity style={styles.fabBtn} onPress={() => handleQuickAction('available')}>
              <Text style={[styles.fabBtnText, {color: Colors.primary}]}>Available</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fabBtn} onPress={() => handleQuickAction('offline_booking')}>
              <Text style={[styles.fabBtnText, {color: '#9C27B0'}]}>Offline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fabBtn} onPress={() => handleQuickAction('maintenance')}>
              <Text style={[styles.fabBtnText, {color: Colors.error}]}>Maint.</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bulk Action Modal */}
      <Modal visible={bulkModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bulk Operations</Text>
              <TouchableOpacity onPress={() => { setBulkModalVisible(false); setPreviewResult(null); }}>
                <Icon name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: '85%' }} showsVerticalScrollIndicator={false}>

              {/* ── STEP 1: Criteria ── */}
              <Text style={styles.stepLabel}>1. Select Criteria</Text>

              <Text style={styles.modalSubtitle}>Date Range</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                <TouchableOpacity
                  style={[styles.input, { flex: 1, justifyContent: 'center' }]}
                  onPress={() => { resetPreview(); setActivePicker('start'); setShowCalendar(true); }}
                >
                  <Text style={{ color: bulkData.startDate ? Colors.textPrimary : Colors.textTertiary }}>
                    {bulkData.startDate ? moment(bulkData.startDate).format('DD MMM YYYY') : 'Start Date'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.input, { flex: 1, justifyContent: 'center' }]}
                  onPress={() => { resetPreview(); setActivePicker('end'); setShowCalendar(true); }}
                >
                  <Text style={{ color: bulkData.endDate ? Colors.textPrimary : Colors.textTertiary }}>
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
                    <Text style={[
                      styles.dayChipText,
                      bulkData.daysOfWeek.includes(i) && { color: '#000', fontFamily: Typography.fontFamily.bold }
                    ]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalSubtitle}>Slot Range <Text style={{ color: Colors.error }}>*</Text></Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                <TouchableOpacity
                  style={[
                    styles.input, { flex: 1, justifyContent: 'center' },
                    !bulkData.startTime && styles.inputRequired,
                  ]}
                  onPress={() => { resetPreview(); setActivePicker('startTime'); }}
                >
                  <Text style={{ color: bulkData.startTime ? Colors.textPrimary : Colors.textTertiary }}>
                    {bulkData.startTime ? formatISTTime(bulkData.startTime) : 'Start Slot *'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.input, { flex: 1, justifyContent: 'center' },
                    !bulkData.endTime && styles.inputRequired,
                  ]}
                  onPress={() => { resetPreview(); setActivePicker('endTime'); }}
                >
                  <Text style={{ color: bulkData.endTime ? Colors.textPrimary : Colors.textTertiary }}>
                    {bulkData.endTime ? formatISTTime(bulkData.endTime) : 'End Slot *'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>Action</Text>
              <View style={[styles.actionButtons, { marginBottom: 10 }]}>
                <TouchableOpacity style={[styles.actionBtn, bulkData.action === 'status' && styles.actionBtnActive]} onPress={() => { resetPreview(); setBulkData({ ...bulkData, action: 'status' }); }}>
                  <Text style={[styles.actionBtnText, bulkData.action === 'status' && { color: Colors.primary }]}>Status</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, bulkData.action === 'offline_booking' && styles.actionBtnActive]} onPress={() => { resetPreview(); setBulkData({ ...bulkData, action: 'offline_booking' }); }}>
                  <Text style={[styles.actionBtnText, bulkData.action === 'offline_booking' && { color: Colors.primary }]}>Offline Booking</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, bulkData.action === 'price' && styles.actionBtnActive]} onPress={() => { resetPreview(); setBulkData({ ...bulkData, action: 'price' }); }}>
                  <Text style={[styles.actionBtnText, bulkData.action === 'price' && { color: Colors.primary }]}>Price</Text>
                </TouchableOpacity>
              </View>

              {bulkData.action === 'status' && (
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                  <TouchableOpacity style={[styles.actionBtn, bulkData.actionData.status === 'available' && styles.actionBtnActive]} onPress={() => setBulkData({ ...bulkData, actionData: { ...bulkData.actionData, status: 'available' } })}>
                    <Text style={[styles.actionBtnText, bulkData.actionData.status === 'available' && { color: Colors.primary }]}>Available</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, bulkData.actionData.status === 'maintenance' && styles.actionBtnActive]} onPress={() => setBulkData({ ...bulkData, actionData: { ...bulkData.actionData, status: 'maintenance' } })}>
                    <Text style={[styles.actionBtnText, bulkData.actionData.status === 'maintenance' && { color: Colors.primary }]}>Maintenance</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Search button */}
              <TouchableOpacity
                style={[styles.searchSlotsBtn, isPreviewing && { opacity: 0.6 }]}
                onPress={handlePreviewSlots}
                disabled={isPreviewing}
              >
                {isPreviewing
                  ? <ActivityIndicator color="#000" size="small" />
                  : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Icon name="magnify" size={18} color="#000" />
                      <Text style={styles.searchSlotsBtnText}>Search Slots</Text>
                    </View>
                  )
                }
              </TouchableOpacity>

              {/* ── STEP 2: Preview + Confirm ── */}
              {previewResult && (
                <View style={styles.previewCard}>
                  <Text style={styles.stepLabel}>2. Review &amp; Confirm</Text>

                  {/* Summary row */}
                  <View style={styles.previewSummaryRow}>
                    <View style={styles.previewStat}>
                      <Icon name="calendar-check" size={20} color={Colors.primary} />
                      <Text style={styles.previewStatValue}>{previewResult.slots.length}</Text>
                      <Text style={styles.previewStatLabel}>Slots Found</Text>
                    </View>
                    <View style={styles.previewDivider} />
                    <View style={styles.previewStat}>
                      <Icon name="currency-inr" size={20} color={Colors.primary} />
                      <Text style={styles.previewStatValue}>₹{previewResult.customPrice || 0}</Text>
                      <Text style={styles.previewStatLabel}>Per Slot</Text>
                    </View>
                    <View style={styles.previewDivider} />
                    <View style={styles.previewStat}>
                      <Icon name="sigma" size={20} color={Colors.primary} />
                      <Text style={styles.previewStatValue}>₹{(Number(previewResult.customPrice) || 0) * previewResult.slots.length}</Text>
                      <Text style={styles.previewStatLabel}>Total</Text>
                    </View>
                  </View>

                  {/* Price editor */}
                  <Text style={styles.modalSubtitle}>Price Per Slot (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter price per slot"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="numeric"
                    value={previewResult.customPrice}
                    onChangeText={t => setPreviewResult({ ...previewResult, customPrice: t })}
                  />

                  {/* Offline booking: customer details */}
                  {bulkData.action === 'offline_booking' && (
                    <View>
                      <Text style={styles.modalSubtitle}>Customer Details</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Customer Name *"
                        placeholderTextColor={Colors.textTertiary}
                        value={bulkData.actionData.customerName}
                        onChangeText={t => setBulkData({ ...bulkData, actionData: { ...bulkData.actionData, customerName: t } })}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Mobile Number"
                        placeholderTextColor={Colors.textTertiary}
                        keyboardType="phone-pad"
                        value={bulkData.actionData.customerMobile}
                        onChangeText={t => setBulkData({ ...bulkData, actionData: { ...bulkData.actionData, customerMobile: t } })}
                      />
                      <View style={styles.totalSummaryRow}>
                        <Text style={styles.totalSummaryLabel}>
                          {previewResult.slots.length} slots × ₹{previewResult.customPrice || 0}
                        </Text>
                        <Text style={styles.totalSummaryValue}>
                          = ₹{(Number(previewResult.customPrice) || 0) * previewResult.slots.length}
                        </Text>
                      </View>
                    </View>
                  )}

                  <TouchableOpacity style={styles.saveBtn} onPress={handleBulkUpdate}>
                    <Text style={styles.saveBtnText}>
                      {bulkData.action === 'offline_booking'
                        ? `Confirm Offline Booking (${previewResult.slots.length} slots)`
                        : `Apply to ${previewResult.slots.length} Slots`}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Offline Booking Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Offline Booking ({selectedSlots.length} Slots)</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.offlineForm}>
              <TextInput
                style={styles.input}
                placeholder="Customer Name"
                placeholderTextColor={Colors.textTertiary}
                value={offlineDetails.customerName}
                onChangeText={(t) => setOfflineDetails({...offlineDetails, customerName: t})}
              />
              <TextInput
                style={styles.input}
                placeholder="Mobile Number"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="phone-pad"
                value={offlineDetails.customerMobile}
                onChangeText={(t) => setOfflineDetails({...offlineDetails, customerMobile: t})}
              />
              <TextInput
                style={styles.input}
                placeholder="Amount Collected (₹)"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
                value={offlineDetails.amount}
                onChangeText={(t) => setOfflineDetails({...offlineDetails, amount: t})}
              />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleOfflineBookingSubmit}>
              <Text style={styles.saveBtnText}>Confirm Booking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      {(activePicker === 'startTime' || activePicker === 'endTime') && (
        <Modal transparent visible={true} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, {padding: Spacing.md}]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Time</Text>
                <TouchableOpacity onPress={() => setActivePicker('none')}>
                  <Icon name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{maxHeight: 300}} contentContainerStyle={styles.timeGrid}>
                {Array.from({length: 24}).map((_, i) => {
                  const hour = i.toString().padStart(2, '0');
                  const timeStr = `${hour}:00`;
                  const isSelected = activePicker === 'startTime' ? bulkData.startTime === timeStr : bulkData.endTime === timeStr;
                  return (
                    <TouchableOpacity 
                      key={timeStr}
                      style={[styles.timeBox, isSelected && styles.timeBoxSel]}
                      onPress={() => {
                        if (activePicker === 'startTime') setBulkData({...bulkData, startTime: timeStr});
                        else setBulkData({...bulkData, endTime: timeStr});
                        setActivePicker('none');
                      }}
                    >
                      <Text style={[styles.timeText, isSelected && {color: '#000'}]}>{formatISTTime(timeStr)}</Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Custom JS Calendar Modal */}
      {showCalendar && (
        <Modal transparent visible={true} animationType="fade">
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
                {['S','M','T','W','T','F','S'].map((d, i) => (
                  <Text key={i} style={styles.dayOfWeek}>{d}</Text>
                ))}
                {(() => {
                  const startDay = moment(calendarMonth).startOf('month').day();
                  const daysInMonth = moment(calendarMonth).daysInMonth();
                  const grid = [];
                  for(let i=0; i<startDay; i++) grid.push(<View key={`empty-${i}`} style={styles.calDay} />);
                  for(let i=1; i<=daysInMonth; i++) {
                    const d = moment(calendarMonth).date(i);
                    const dStr = d.format('YYYY-MM-DD');
                    const isPast = d.isBefore(moment(), 'day');
                    const isSel = (activePicker === 'singleDate' && selectedDate === dStr) || 
                                 (activePicker === 'start' && bulkData.startDate === dStr) ||
                                 (activePicker === 'end' && bulkData.endDate === dStr);
                    grid.push(
                      <TouchableOpacity 
                        key={`day-${i}`} 
                        style={[styles.calDay, isSel && styles.calDaySel]}
                        disabled={isPast && activePicker === 'singleDate'} // Only disable past days for single date selection
                        onPress={() => {
                          if (activePicker === 'start') {
                            setBulkData({...bulkData, startDate: dStr});
                          } else if (activePicker === 'end') {
                            setBulkData({...bulkData, endDate: dStr});
                          } else if (activePicker === 'singleDate') {
                            setSelectedDate(dStr);
                            setDates(generateDates(d.toDate()));
                          }
                          setShowCalendar(false);
                          setActivePicker('none');
                        }}
                      >
                        <Text style={[styles.calDayText, isPast && activePicker === 'singleDate' && {color: Colors.textTertiary}, isSel && {color: '#000'}]}>{i}</Text>
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

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: Spacing.xl, paddingTop: 60, paddingBottom: Spacing.lg,
    backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  
  turfSelector: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  turfChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.backgroundElevated, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  turfChipActive: { backgroundColor: Colors.primaryAlpha20, borderColor: Colors.primary },
  turfChipText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13 },
  turfChipTextActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },

  dateSelector: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.backgroundCard },
  calendarBtn: { width: 50, height: 60, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.md, marginRight: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  dateCard: { width: 50, height: 60, justifyContent: 'center', alignItems: 'center', marginRight: 8, borderRadius: BorderRadius.md, backgroundColor: Colors.backgroundElevated, borderWidth: 1, borderColor: Colors.border },
  dateCardActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dateMonth: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  dateDay: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginVertical: 1 },
  dateDayName: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  dateTextActive: { color: '#000' },

  legendContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: Spacing.sm, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 11, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },

  slotsContainer: { padding: Spacing.md, paddingBottom: 150 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: '2%' },
  slotCard: { width: '23%', paddingVertical: Spacing.sm, marginBottom: Spacing.md, backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.md, borderWidth: 1.5, alignItems: 'center', position: 'relative' },
  slotCardPast: { borderColor: Colors.border, opacity: 0.35 },
  inputRequired: { borderColor: Colors.error, borderWidth: 1.5 },
  slotCardSelected: { backgroundColor: Colors.primaryAlpha20 },
  slotTime: { fontSize: 12, fontFamily: Typography.fontFamily.bold, marginBottom: 2 },
  slotPrice: { fontSize: 11, fontFamily: Typography.fontFamily.medium },
  slotStatus: { fontSize: 8, fontFamily: Typography.fontFamily.bold, marginTop: 2 },
  checkBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: Colors.primary, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40, fontFamily: Typography.fontFamily.medium },

  floatingActionBar: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10, borderWidth: 1, borderColor: Colors.border },
  fabHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  fabTitle: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  fabClear: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium },
  fabButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  fabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.md, marginHorizontal: 4, borderWidth: 1, borderColor: Colors.border },
  fabBtnText: { fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  modalSubtitle: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginBottom: 8, marginTop: 10 },
  
  input: { backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, color: Colors.textPrimary, fontFamily: Typography.fontFamily.regular, borderWidth: 1, borderColor: Colors.border, marginBottom: 15 },
  
  actionButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: BorderRadius.md, backgroundColor: Colors.backgroundElevated, borderWidth: 1, borderColor: Colors.border },
  actionBtnActive: { backgroundColor: Colors.primaryAlpha20, borderColor: Colors.primary },
  actionBtnText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  
  saveBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 16 },

  // Time Picker Styles
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  timeBox: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: BorderRadius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  timeBoxSel: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timeText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium },

  // Calendar Styles
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  dayOfWeek: { width: '14.2%', textAlign: 'center', color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, marginBottom: 10 },
  calDay: { width: '14.2%', height: 40, justifyContent: 'center', alignItems: 'center' },
  calDaySel: { backgroundColor: Colors.primary, borderRadius: 20 },
  calDayText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium },
  closeModalBtn: { backgroundColor: Colors.surface, paddingVertical: 12, borderRadius: BorderRadius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  closeModalText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },

  // Days of week selector
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  dayChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundElevated,
  },
  dayChipSel: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayChipText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13 },

  // Two-step bulk modal
  stepLabel: {
    fontSize: 13, fontFamily: Typography.fontFamily.bold,
    color: Colors.primary, marginBottom: 10, marginTop: 4,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  searchSlotsBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 13, alignItems: 'center', marginTop: 10, marginBottom: 6,
  },
  searchSlotsBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 15 },
  previewCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg, borderWidth: 1,
    borderColor: Colors.primaryAlpha20,
    padding: Spacing.base, marginTop: 14,
  },
  previewSummaryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.backgroundElevated,
    borderRadius: BorderRadius.md, borderWidth: 1,
    borderColor: Colors.border, padding: Spacing.base,
    marginBottom: 16,
  },
  previewStat: { flex: 1, alignItems: 'center', gap: 3 },
  previewDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  previewStatValue: {
    color: Colors.textPrimary, fontFamily: Typography.fontFamily.extraBold,
    fontSize: Typography.fontSize.lg,
  },
  previewStatLabel: {
    color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 10,
  },
  totalSummaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.primaryAlpha10, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.primaryAlpha20, marginBottom: 12,
  },
  totalSummaryLabel: {
    color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13,
  },
  totalSummaryValue: {
    color: Colors.primary, fontFamily: Typography.fontFamily.extraBold, fontSize: 16,
  },
});

export default SlotManagerScreen;
