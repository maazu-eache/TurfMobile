import React, { useState, useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, Modal, TextInput, Animated, StatusBar 
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from '../../../components/SolidGradient';
import { useSelector } from 'react-redux';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api from '../../../api/axios';
import { formatISTTime } from '../../../utils/dateFormatter';
import { showCustomAlert } from '../../../components/CustomAlert';
import moment from 'moment';

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

const SlotManagerScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { dashboard } = useSelector((state) => state.owner);
  const turfs = dashboard?.owner?.turfs || [];
  
  const [selectedTurf, setSelectedTurf] = useState(turfs[0]?._id || null);
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [dates, setDates] = useState(generateDates());
  const [selectedSlots, setSelectedSlots] = useState([]);

  // Time Groups State
  const [expandedGroup, setExpandedGroup] = useState(getCurrentTimeGroup());

  // Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [turfModalVisible, setTurfModalVisible] = useState(false);
  const [actionType, setActionType] = useState('available');
  const [offlineDetails, setOfflineDetails] = useState({ customerName: '', customerMobile: '', amount: '', reason: 'walk_in' });
  
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
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

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
        return showCustomAlert('Offline Booking', 'This slot was booked offline/walk-in.');
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
      setActionType(type);
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

  // Grouping slots logically
  const groupedSlots = {
    early_morning: slots.filter(s => getTimeGroup(s.startTime) === 'early_morning'),
    morning: slots.filter(s => getTimeGroup(s.startTime) === 'morning'),
    afternoon: slots.filter(s => getTimeGroup(s.startTime) === 'afternoon'),
    evening: slots.filter(s => getTimeGroup(s.startTime) === 'evening'),
    night: slots.filter(s => getTimeGroup(s.startTime) === 'night'),
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
    const isSelected = selectedSlots.includes(slot._id);
    const past = isPastSlot(selectedDate, slot.startTime);
    const isBooked = slot.status === 'booked';
    const isOffline = slot.status === 'offline_booking';
    const isMaintenance = slot.status === 'maintenance';
    
    let cardStyle = styles.slotCardAvailable;
    let textStyle = styles.slotTextAvailable;

    if (isSelected) {
      cardStyle = styles.slotCardSelected;
      textStyle = styles.slotTextSelected;
    } else if (isMaintenance) {
      cardStyle = styles.slotCardMaintenance;
      textStyle = styles.slotTextMaintenance;
    } else if (isOffline) {
      cardStyle = styles.slotCardOffline;
      textStyle = styles.slotTextOffline;
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
        onPress={() => handleSlotPress(slot)}
        activeOpacity={0.8}
      >
        {isBooked ? (
          <Icon name="lock" size={14} color="#2196F3" style={styles.slotStateIcon} />
        ) : isOffline ? (
          <Icon name="account-cash" size={14} color="#9C27B0" style={styles.slotStateIcon} />
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
        
        <TouchableOpacity style={styles.headerDropdown} onPress={() => setTurfModalVisible(true)}>
          <Text style={styles.headerDropdownText} numberOfLines={1}>
            {turfs.find(t => t._id === selectedTurf)?.name || 'Select Ground'}
          </Text>
          <Icon name="chevron-down" size={18} color="#FFD400" style={{marginLeft: 4}} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setBulkModalVisible(true)} style={styles.headerBtn}>
          <Icon name="layers-triple" size={20} color="#FFD400" />
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

        {loading ? (
          <ActivityIndicator size="large" color="#FFD400" style={{ marginTop: 50 }} />
        ) : slots.length === 0 ? (
          <Text style={styles.noSlotsText}>No slots generated for this day.</Text>
        ) : (
          /* ── Expandable Time Groups ── */
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
        )}

        <View style={{ height: 160 }} />
      </Animated.ScrollView>

      {/* ── Floating Action Bar for Selections ── */}
      {selectedSlots.length > 0 && (
        <View style={styles.bottomBookingCard}>
          <View style={styles.bookingLeft}>
            <Text style={styles.selectedCountLabel}>Manage</Text>
            <Text style={styles.selectedCountText}>
              {selectedSlots.length} Slots Selected
            </Text>
          </View>
          <View style={styles.fabBtnGroup}>
            <TouchableOpacity style={[styles.fabBtn, { backgroundColor: 'rgba(255, 212, 0, 0.1)', borderColor: '#FFD400' }]} onPress={() => handleQuickAction('available')}>
              <Icon name="check" size={14} color="#FFD400" />
              <Text style={[styles.fabBtnText, { color: '#FFD400' }]}>Avail</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.fabBtn, { backgroundColor: 'rgba(156, 39, 176, 0.1)', borderColor: '#9C27B0' }]} onPress={() => handleQuickAction('offline_booking')}>
              <Icon name="account-cash" size={14} color="#9C27B0" />
              <Text style={[styles.fabBtnText, { color: '#9C27B0' }]}>Walk-in</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.fabBtn, { backgroundColor: 'rgba(255, 71, 87, 0.1)', borderColor: '#FF4757' }]} onPress={() => handleQuickAction('maintenance')}>
              <Icon name="tools" size={14} color="#FF4757" />
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
              <Text style={styles.modalTitle}>Walk-in Booking ({selectedSlots.length} Slots)</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
                <Icon name="close" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.offlineForm}>
              <Text style={styles.modalSubtitle}>Customer Details</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Customer Name *"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={offlineDetails.customerName}
                onChangeText={(t) => setOfflineDetails({...offlineDetails, customerName: t})}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Mobile Number"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="phone-pad"
                value={offlineDetails.customerMobile}
                onChangeText={(t) => setOfflineDetails({...offlineDetails, customerMobile: t})}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Total Amount Collected (₹)"
                placeholderTextColor="rgba(255,255,255,0.3)"
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

      {/* Turf Selection Modal */}
      <Modal visible={turfModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderTitle}>
              <Text style={styles.modalTitle}>Select Ground</Text>
              <TouchableOpacity onPress={() => setTurfModalVisible(false)} style={styles.modalClose}>
                <Icon name="close" size={18} color="#FFF" />
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
                <Icon name="close" size={18} color="#FFF" />
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
                    <Text style={[styles.actionSubBtnText, bulkData.actionData.status === 'available' && { color: '#FFD400' }]}>Available</Text>
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
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    keyboardType="numeric"
                    value={previewResult.customPrice}
                    onChangeText={t => setPreviewResult({ ...previewResult, customPrice: t })}
                  />

                  {bulkData.action === 'offline_booking' && (
                    <View>
                      <Text style={styles.modalSubtitle}>Customer Details</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Customer Name *"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        value={bulkData.actionData.customerName}
                        onChangeText={t => setBulkData({ ...bulkData, actionData: { ...bulkData.actionData, customerName: t } })}
                      />
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Mobile Number"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        keyboardType="phone-pad"
                        value={bulkData.actionData.customerMobile}
                        onChangeText={t => setBulkData({ ...bulkData, actionData: { ...bulkData.actionData, customerMobile: t } })}
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
                <Icon name="close" size={18} color="#FFF" />
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
                    (activePicker === 'start' && bulkData.startDate === dStr) ||
                    (activePicker === 'end' && bulkData.endDate === dStr) ||
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

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { paddingBottom: 160 },
  
  /* ── Floating 3D Header ── */
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: '#0F0F0F',
    borderBottomWidth: 1, borderColor: '#2A2A2A',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8, zIndex: 10,
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#171717',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  headerDropdown: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#171717', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#2A2A2A',
    maxWidth: 200
  },
  headerDropdownText: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: '#FFF' },

  /* ── Horizontal Date Selector ── */
  datePickerContainer: { marginTop: 14, paddingTop: 24, paddingBottom: 14, backgroundColor: '#000' },
  dateScroll: { paddingHorizontal: 16, gap: 10 },
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
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  dateBoxInactive: {
    backgroundColor: '#0F0F0F',
    borderWidth: 1, borderColor: '#2A2A2A',
    borderBottomWidth: 3, borderBottomColor: '#171717',
    transform: [{ perspective: 1000 }, { rotateX: '6deg' }, { rotateY: '-4deg' }],
  },
  dateBoxSelected: {
    backgroundColor: '#171717',
    borderWidth: 1, borderColor: '#FFD400',
    borderBottomWidth: 4, borderBottomColor: '#BCA100',
    transform: [{ scale: 1.02 }],
    shadowColor: '#FFD400', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 8,
  },
  dateDay: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: Typography.fontFamily.medium, textTransform: 'uppercase' },
  dateNum: { fontSize: 20, color: '#FFF', fontFamily: Typography.fontFamily.bold, marginVertical: 1 },
  dateMonth: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: Typography.fontFamily.medium },
  dateTextSelected: { color: '#FFD400' },

  /* ── Expandable Time Groups ── */
  groupsContainer: { marginHorizontal: 16, gap: 12 },
  groupTile: {
    backgroundColor: '#0F0F0F', borderRadius: 20,
    borderWidth: 1, borderColor: '#2A2A2A', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  groupHeader: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F0F0F' },
  groupHeaderExpanded: { borderBottomWidth: 1, borderBottomColor: '#2A2A2A', backgroundColor: '#171717' },
  groupHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  groupLabel: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: '#FFF' },
  groupDesc: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  groupHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupContent: { padding: 14, backgroundColor: '#0F0F0F' },
  noSlotsText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: Typography.fontFamily.medium, textAlign: 'center', marginVertical: 20 },

  /* ── Slot Grid & 3D Mini Cards ── */
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: '2.5%', justifyContent: 'flex-start' },
  slotCard: {
    width: '31.6%', borderRadius: 18, paddingVertical: 12, alignItems: 'center', marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4, position: 'relative',
    transform: [{ perspective: 1000 }, { rotateX: '6deg' }],
  },
  slotStateIcon: { position: 'absolute', top: 4, right: 6 },
  slotTime: { fontSize: 9, fontFamily: Typography.fontFamily.bold, marginBottom: 2 },
  slotPrice: { fontSize: 10, fontFamily: Typography.fontFamily.medium },

  slotCardAvailable: { backgroundColor: '#0F0F0F', borderWidth: 1, borderColor: '#2A2A2A', borderBottomWidth: 3, borderBottomColor: '#171717' },
  slotTextAvailable: { color: '#FFF' },
  
  slotCardSelected: {
    backgroundColor: '#171717', borderWidth: 1.5, borderColor: '#FFD400', borderBottomWidth: 4, borderBottomColor: '#BCA100',
    transform: [{ scale: 1.05 }, { translateY: -4 }, { perspective: 1000 }, { rotateX: '6deg' }],
    shadowColor: '#FFD400', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  slotTextSelected: { color: '#FFD400' },
  
  slotCardMaintenance: { backgroundColor: 'rgba(255, 71, 87, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 71, 87, 0.4)', borderBottomWidth: 3, borderBottomColor: 'rgba(255, 71, 87, 0.2)' },
  slotTextMaintenance: { color: '#FF4757' },
  
  slotCardBooked: { backgroundColor: 'rgba(33, 150, 243, 0.05)', borderWidth: 1, borderColor: 'rgba(33, 150, 243, 0.4)', borderBottomWidth: 3, borderBottomColor: 'rgba(33, 150, 243, 0.2)' },
  slotTextBooked: { color: '#2196F3' },

  slotCardOffline: { backgroundColor: 'rgba(156, 39, 176, 0.05)', borderWidth: 1, borderColor: 'rgba(156, 39, 176, 0.4)', borderBottomWidth: 3, borderBottomColor: 'rgba(156, 39, 176, 0.2)' },
  slotTextOffline: { color: '#9C27B0' },
  
  slotCardPast: { backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#333', borderBottomWidth: 3, borderBottomColor: '#111' },
  slotTextPast: { color: 'rgba(255,255,255,0.4)' },

  /* ── Bottom Summary Booking Card (Floating Action Bar) ── */
  bottomBookingCard: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    height: 72, borderRadius: 36, backgroundColor: 'rgba(22,22,22,0.95)',
    borderWidth: 1, borderColor: '#2A2A2A',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 10, zIndex: 100,
  },
  bookingLeft: { flexDirection: 'column' },
  selectedCountLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: Typography.fontFamily.medium, textTransform: 'uppercase' },
  selectedCountText: { color: '#FFF', fontSize: 13, fontFamily: Typography.fontFamily.bold, marginTop: 1 },
  fabBtnGroup: { flexDirection: 'row', gap: 8 },
  fabBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  fabBtnText: { fontSize: 10, fontFamily: Typography.fontFamily.bold },

  /* ── Modals General ── */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#171717', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#2A2A2A' },
  modalHeaderTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: '#FFF' },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  modalSubtitle: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: 'rgba(255,255,255,0.5)', marginTop: 16, marginBottom: 8, textTransform: 'uppercase' },
  modalInput: { backgroundColor: '#0F0F0F', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', color: '#FFF', paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, fontFamily: Typography.fontFamily.medium, marginBottom: 12 },
  
  /* Turf Selection Options */
  turfOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  turfOptionActive: { backgroundColor: 'rgba(255, 212, 0, 0.05)', borderRadius: 12, paddingHorizontal: 10, borderBottomWidth: 0 },
  turfOptionText: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: '#FFF' },
  turfOptionTextActive: { color: '#FFD400', fontFamily: Typography.fontFamily.bold },

  /* Bulk Ops Modal Specific */
  stepLabel: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: '#FFD400', marginTop: 10, marginBottom: 4 },
  pickerInput: { flex: 1, backgroundColor: '#0F0F0F', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', paddingVertical: 12, paddingHorizontal: 14, justifyContent: 'center' },
  pickerText: { color: '#FFF', fontSize: 12, fontFamily: Typography.fontFamily.medium },
  inputRequired: { borderColor: 'rgba(255, 71, 87, 0.5)' },
  
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { backgroundColor: '#0F0F0F', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#2A2A2A' },
  dayChipSel: { backgroundColor: '#FFD400', borderColor: '#FFD400' },
  dayChipText: { color: '#FFF', fontSize: 12, fontFamily: Typography.fontFamily.medium },

  actionButtons: { flexDirection: 'row', backgroundColor: '#0F0F0F', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A' },
  actionBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  actionBtnActive: { backgroundColor: '#FFD400' },
  actionBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: Typography.fontFamily.bold },
  
  actionSubBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', backgroundColor: '#0F0F0F' },
  actionSubBtnActive: { borderColor: '#FFD400', backgroundColor: 'rgba(255, 212, 0, 0.1)' },
  actionSubBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: Typography.fontFamily.bold },

  searchSlotsBtn: { backgroundColor: '#FFD400', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  searchSlotsBtnText: { color: '#000', fontSize: 14, fontFamily: Typography.fontFamily.bold },

  /* Preview Card */
  previewCard: { backgroundColor: '#0F0F0F', borderRadius: 16, padding: 16, marginTop: 24, borderWidth: 1, borderColor: '#2A2A2A', shadowColor: '#FFD400', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  previewSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 16 },
  previewStat: { alignItems: 'center', flex: 1 },
  previewStatValue: { color: '#FFF', fontSize: 18, fontFamily: Typography.fontFamily.bold, marginTop: 6 },
  previewStatLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: Typography.fontFamily.medium, marginTop: 2 },
  previewDivider: { width: 1, height: 30, backgroundColor: '#2A2A2A' },
  
  saveBtn: { borderRadius: 16, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  saveBtnTextPrimary: { color: '#000', fontSize: 14, fontFamily: Typography.fontFamily.bold },

  /* Time Grid / Pickers */
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  timeBox: { width: '30%', backgroundColor: '#0F0F0F', paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A' },
  timeBoxSel: { backgroundColor: '#FFD400', borderColor: '#FFD400' },
  timeText: { color: '#FFF', fontSize: 12, fontFamily: Typography.fontFamily.medium },

  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 10 },
  dayOfWeek: { width: '14.28%', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: Typography.fontFamily.bold, fontSize: 12, marginBottom: 16 },
  calDay: { width: '14.28%', height: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  calDaySel: { backgroundColor: '#FFD400', borderRadius: 20 },
  calDayText: { color: '#FFF', fontSize: 13, fontFamily: Typography.fontFamily.medium },
  closeModalBtn: { backgroundColor: '#2A2A2A', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  closeModalText: { color: '#FFF', fontSize: 13, fontFamily: Typography.fontFamily.bold }
});

export default SlotManagerScreen;
