/**
 * CustomDateTimePicker
 *
 * Android  → uses the native @react-native-community/datetimepicker.
 * iOS      → uses a pure-JS calendar / time picker rendered inside a Modal.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme, Typography } from '../../theme/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const parseDate = (val, minDate, maxDate) => {
  let result = null;

  if (val instanceof Date) {
    result = isNaN(val.getTime()) ? null : new Date(val.getTime());
  } else if (typeof val === 'number') {
    const d = new Date(val);
    result = isNaN(d.getTime()) ? null : d;
  } else if (typeof val === 'string' && val.trim()) {
    const str = val.trim();
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
      const p = str.split(':');
      const d = new Date();
      d.setHours(+p[0], +p[1], 0, 0);
      if (!isNaN(d.getTime())) result = d;
    }
    if (!result && str.includes('/')) {
      const p = str.split('/');
      if (p.length === 3) {
        const [y, mo, day] = p[0].length === 4
          ? [+p[0], +p[1] - 1, +p[2]]
          : [+p[2], +p[1] - 1, +p[0]];
        const d = new Date(y, mo, day);
        if (!isNaN(d.getTime())) result = d;
      }
    }
    if (!result && str.includes('-') && !str.includes('T')) {
      const p = str.split('-');
      if (p.length === 3) {
        const [y, mo, day] = p[0].length === 4
          ? [+p[0], +p[1] - 1, +p[2]]
          : [+p[2], +p[1] - 1, +p[0]];
        const d = new Date(y, mo, day);
        if (!isNaN(d.getTime())) result = d;
      }
    }
    if (!result) {
      const c = str.replace(/^[A-Za-z]{3},\s*/, '');
      const p = new Date(c);
      result = !isNaN(p.getTime()) ? p : (!isNaN(new Date(str).getTime()) ? new Date(str) : null);
    }
  } else if (val && typeof val === 'object' && val._isAMomentObject) {
    const d = val.toDate();
    if (!isNaN(d.getTime())) result = d;
  }

  if (!result || isNaN(result.getTime())) result = new Date();

  if (minDate instanceof Date && !isNaN(minDate.getTime()) && result < minDate) result = new Date(minDate);
  if (maxDate instanceof Date && !isNaN(maxDate.getTime()) && result > maxDate) result = new Date(maxDate);

  return result;
};

// How many days in a month?
const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

// ─────────────────────────────────────────────────────────────────────────────
// iOS – JS Calendar (date mode)
// ─────────────────────────────────────────────────────────────────────────────
const JSCalendar = ({ date, minimumDate, maximumDate, onChange, colors, isDark }) => {
  const [viewYear, setViewYear] = useState(date.getFullYear());
  const [viewMonth, setViewMonth] = useState(date.getMonth());
  const [selectedDay, setSelectedDay] = useState(date.getDate());
  const [showYearPicker, setShowYearPicker] = useState(false);

  // Keep local selection in sync when `date` prop changes (new picker open)
  useEffect(() => {
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
    setSelectedDay(date.getDate());
  }, [date]);

  const firstDOW = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const totalDays = daysInMonth(viewYear, viewMonth);

  const goMonth = (delta) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
    const d = new Date(date);
    d.setFullYear(y, m, Math.min(selectedDay, daysInMonth(y, m)));
    onChange(d);
  };

  const goYear = (delta) => {
    let y = viewYear + delta;
    const minY = minimumDate ? minimumDate.getFullYear() : 1930;
    const maxY = maximumDate ? maximumDate.getFullYear() : new Date().getFullYear() + 20;
    if (y < minY) y = minY;
    if (y > maxY) y = maxY;
    setViewYear(y);
    const d = new Date(date);
    d.setFullYear(y, viewMonth, Math.min(selectedDay, daysInMonth(y, viewMonth)));
    onChange(d);
  };

  const selectDay = (day) => {
    setSelectedDay(day);
    // Preserve the time component from the original date
    const d = new Date(date);
    d.setFullYear(viewYear, viewMonth, day);
    // Clamp
    if (minimumDate instanceof Date && d < minimumDate) return;
    if (maximumDate instanceof Date && d > maximumDate) return;
    onChange(d);
  };

  const isSelected = (day) => day === selectedDay && viewMonth === date.getMonth() && viewYear === date.getFullYear();

  const isDayDisabled = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    if (minimumDate instanceof Date && d < minimumDate) return true;
    if (maximumDate instanceof Date && d > maximumDate) return true;
    return false;
  };

  const primary = colors.primary || '#007AFF';
  const textPrimary = colors.textPrimary || (isDark ? '#FFF' : '#000');
  const textSecondary = colors.textSecondary || '#8E8E93';

  const minY = minimumDate ? minimumDate.getFullYear() : 1940;
  const maxY = maximumDate ? maximumDate.getFullYear() : new Date().getFullYear();
  const years = [];
  for (let y = maxY; y >= minY; y--) years.push(y);

  if (showYearPicker) {
    return (
      <View style={{ paddingHorizontal: 12, paddingTop: 8, height: 280 }}>
        <View style={calStyles.navRow}>
          <Text style={[calStyles.monthTitle, { color: textPrimary }]}>Select Year & Month</Text>
          <TouchableOpacity onPress={() => setShowYearPicker(false)}>
            <Text style={{ color: primary, fontWeight: '600', fontSize: 14 }}>Close</Text>
          </TouchableOpacity>
        </View>

        {/* Month selector grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
          {MONTHS.map((mName, mIdx) => (
            <TouchableOpacity
              key={mName}
              style={[
                calStyles.monthChip,
                viewMonth === mIdx && { backgroundColor: primary }
              ]}
              onPress={() => setViewMonth(mIdx)}
            >
              <Text style={[
                calStyles.monthChipText,
                { color: viewMonth === mIdx ? '#FFF' : textPrimary }
              ]}>
                {mName.substring(0, 3)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Year list */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={true}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 }}>
            {years.map((y) => (
              <TouchableOpacity
                key={y}
                style={[
                  calStyles.yearChip,
                  viewYear === y && { backgroundColor: primary }
                ]}
                onPress={() => {
                  setViewYear(y);
                  setShowYearPicker(false);
                  const d = new Date(date);
                  d.setFullYear(y, viewMonth, Math.min(selectedDay, daysInMonth(y, viewMonth)));
                  onChange(d);
                }}
              >
                <Text style={[
                  calStyles.yearChipText,
                  { color: viewYear === y ? '#FFF' : textPrimary }
                ]}>
                  {y}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // Build cell array: blanks + days
  const cells = [];
  for (let i = 0; i < firstDOW; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
      {/* Month / year navigation */}
      <View style={calStyles.navRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity onPress={() => goYear(-1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[calStyles.navYearArrow, { color: primary }]}>«</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => goMonth(-1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[calStyles.navArrow, { color: primary }]}>‹</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={calStyles.titleBtn}
          onPress={() => setShowYearPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={[calStyles.monthTitle, { color: textPrimary }]}>
            {MONTHS[viewMonth]} {viewYear}
          </Text>
          <Text style={{ fontSize: 11, color: primary, marginLeft: 4 }}>▼</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity onPress={() => goMonth(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[calStyles.navArrow, { color: primary }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => goYear(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[calStyles.navYearArrow, { color: primary }]}>»</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Day-of-week labels */}
      <View style={calStyles.dowRow}>
        {DAY_LABELS.map(l => (
          <Text key={l} style={[calStyles.dowLabel, { color: textSecondary }]}>{l}</Text>
        ))}
      </View>

      {/* Day grid */}
      {rows.map((row, ri) => (
        <View key={ri} style={calStyles.weekRow}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={calStyles.dayCell} />;
            const disabled = isDayDisabled(day);
            const sel = isSelected(day);
            const isToday =
              day === new Date().getDate() &&
              viewMonth === new Date().getMonth() &&
              viewYear === new Date().getFullYear();
            return (
              <TouchableOpacity
                key={ci}
                style={[
                  calStyles.dayCell,
                  sel && { backgroundColor: primary, borderRadius: 20 },
                ]}
                onPress={() => !disabled && selectDay(day)}
                activeOpacity={disabled ? 1 : 0.7}
              >
                <Text
                  style={[
                    calStyles.dayText,
                    { color: disabled ? textSecondary : textPrimary },
                    sel && { color: '#FFF', fontWeight: '700' },
                    isToday && !sel && { color: primary, fontWeight: '600' },
                  ]}
                >
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const calStyles = StyleSheet.create({
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  navArrow: { fontSize: 24, lineHeight: 28, paddingHorizontal: 6 },
  navYearArrow: { fontSize: 20, lineHeight: 24, paddingHorizontal: 6 },
  titleBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.04)' },
  monthTitle: { fontSize: 16, fontFamily: Typography?.fontFamily?.bold || 'System', fontWeight: '600' },
  dowRow: { flexDirection: 'row', marginBottom: 4 },
  dowLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', paddingVertical: 4 },
  weekRow: { flexDirection: 'row', marginBottom: 2 },
  dayCell: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 36, margin: 1 },
  dayText: { fontSize: 15, lineHeight: 20 },
  monthChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' },
  monthChipText: { fontSize: 12, fontWeight: '600' },
  yearChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.05)', minWidth: 64, alignItems: 'center' },
  yearChipText: { fontSize: 14, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// iOS – JS Time Picker (time mode)
// ─────────────────────────────────────────────────────────────────────────────
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);    // 1–12
const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);          // 0–23
const MINUTES  = Array.from({ length: 60 }, (_, i) => i);          // 0–59

const ScrollColumn = ({ items, selected, onSelect, label, colors, isDark }) => {
  const primary = colors.primary || '#007AFF';
  const textPrimary = colors.textPrimary || (isDark ? '#FFF' : '#000');
  const textSecondary = colors.textSecondary || '#8E8E93';

  return (
    <View style={timeStyles.col}>
      <Text style={[timeStyles.colLabel, { color: textSecondary }]}>{label}</Text>
      <ScrollView
        style={timeStyles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 8 }}
      >
        {items.map((item) => {
          const sel = item === selected;
          return (
            <TouchableOpacity
              key={item}
              style={[timeStyles.item, sel && { backgroundColor: primary, borderRadius: 10 }]}
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
            >
              <Text style={[timeStyles.itemText, { color: sel ? '#FFF' : textPrimary }, sel && { fontWeight: '700' }]}>
                {String(item).padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const JSTimePicker = ({ date, is24Hour, onChange, colors, isDark }) => {
  const toHour12 = (h) => (h % 12) || 12;
  const isAM = (h) => h < 12;

  const [hour, setHour] = useState(() => is24Hour ? date.getHours() : toHour12(date.getHours()));
  const [minute, setMinute] = useState(date.getMinutes());
  const [amPm, setAmPm] = useState(() => isAM(date.getHours()) ? 'AM' : 'PM');

  useEffect(() => {
    setHour(is24Hour ? date.getHours() : toHour12(date.getHours()));
    setMinute(date.getMinutes());
    setAmPm(isAM(date.getHours()) ? 'AM' : 'PM');
  }, [date]);

  const fireChange = (h, m, ap) => {
    const d = new Date(date);
    let hours = is24Hour ? h : (ap === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12));
    d.setHours(hours, m, 0, 0);
    onChange(d);
  };

  const primary = colors.primary || '#007AFF';
  const textPrimary = colors.textPrimary || (isDark ? '#FFF' : '#000');

  return (
    <View style={timeStyles.row}>
      <ScrollColumn
        items={is24Hour ? HOURS_24 : HOURS_12}
        selected={hour}
        onSelect={(h) => { setHour(h); fireChange(h, minute, amPm); }}
        label="HH"
        colors={colors}
        isDark={isDark}
      />
      <Text style={[timeStyles.colon, { color: textPrimary }]}>:</Text>
      <ScrollColumn
        items={MINUTES}
        selected={minute}
        onSelect={(m) => { setMinute(m); fireChange(hour, m, amPm); }}
        label="MM"
        colors={colors}
        isDark={isDark}
      />
      {!is24Hour && (
        <View style={timeStyles.amPmCol}>
          {['AM', 'PM'].map((ap) => (
            <TouchableOpacity
              key={ap}
              style={[timeStyles.amPmBtn, amPm === ap && { backgroundColor: primary, borderRadius: 8 }]}
              onPress={() => { setAmPm(ap); fireChange(hour, minute, ap); }}
            >
              <Text style={[timeStyles.amPmText, { color: amPm === ap ? '#FFF' : (colors.textPrimary || (isDark ? '#FFF' : '#000')) }]}>{ap}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const timeStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  col: { width: 80, alignItems: 'center' },
  colLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  scroll: { height: 200, width: '100%' },
  item: { alignItems: 'center', paddingVertical: 10, marginVertical: 1, marginHorizontal: 4 },
  itemText: { fontSize: 22, lineHeight: 28 },
  colon: { fontSize: 28, fontWeight: '700', marginHorizontal: 4, marginTop: 20 },
  amPmCol: { marginLeft: 12, marginTop: 20 },
  amPmBtn: { paddingVertical: 10, paddingHorizontal: 14, marginVertical: 4 },
  amPmText: { fontSize: 16, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const CustomDateTimePicker = ({
  visible,
  mode = 'date',
  value,
  onChange,
  onConfirm,
  onClose,
  onCancel,
  minimumDate,
  maximumDate,
  is24Hour = false,
  title,
}) => {
  const { colors, isDark } = useTheme();

  // Internal selection – updated by the JS calendar/time picker directly
  const [selected, setSelected] = useState(() => parseDate(value, minimumDate, maximumDate));

  // Re-sync when the picker becomes visible (new open) or mode changes
  useEffect(() => {
    if (visible) {
      setSelected(parseDate(value, minimumDate, maximumDate));
    }
  }, [visible, mode, value]);

  if (!visible) return null;

  // ── Android: native dialog ──────────────────────────────────────────────
  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={parseDate(value, minimumDate, maximumDate)}
        mode={mode}
        display="default"
        is24Hour={is24Hour}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onChange={(event, date) => {
          if (date && event.type !== 'dismissed') {
            if (onConfirm) onConfirm(date);
            else if (onChange) onChange(event, date);
          } else if (event.type === 'dismissed') {
            if (onCancel) onCancel();
            else if (onChange) onChange(event, date);
          }
          if (onClose) onClose();
        }}
      />
    );
  }

  // ── iOS: bottom-sheet modal with JS picker ──────────────────────────────
  const handleDone = () => {
    if (onConfirm) {
      onConfirm(selected);
    } else if (onChange) {
      onChange({ type: 'set' }, selected);
    }
    if (onClose) onClose();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    else if (onChange) onChange({ type: 'dismissed' }, selected);
    if (onClose) onClose();
  };

  const currentTitle =
    title ||
    (mode === 'time' ? 'Select Time' : mode === 'datetime' ? 'Select Date & Time' : 'Select Date');

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={handleCancel}
        />
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: isDark ? colors.surface || '#1C1C1E' : '#FFFFFF' },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
            ]}
          >
            <TouchableOpacity onPress={handleCancel} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[styles.cancelText, { color: colors.textSecondary || '#8E8E93' }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.titleText, { color: colors.textPrimary || (isDark ? '#FFF' : '#000') }]}>
              {currentTitle}
            </Text>
            <TouchableOpacity onPress={handleDone} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[styles.doneText, { color: colors.primary || '#007AFF' }]}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* JS picker content */}
          <ScrollView scrollEnabled={false} keyboardShouldPersistTaps="handled">
            {mode === 'date' && (
              <JSCalendar
                date={selected}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={setSelected}
                colors={colors}
                isDark={isDark}
              />
            )}
            {mode === 'time' && (
              <JSTimePicker
                date={selected}
                is24Hour={is24Hour}
                onChange={setSelected}
                colors={colors}
                isDark={isDark}
              />
            )}
            {mode === 'datetime' && (
              <>
                <JSCalendar
                  date={selected}
                  minimumDate={minimumDate}
                  maximumDate={maximumDate}
                  onChange={setSelected}
                  colors={colors}
                  isDark={isDark}
                />
                <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', marginVertical: 8 }} />
                <JSTimePicker
                  date={selected}
                  is24Hour={is24Hour}
                  onChange={setSelected}
                  colors={colors}
                  isDark={isDark}
                />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancelText: { fontSize: 16, fontFamily: Typography?.fontFamily?.medium || 'System' },
  titleText: { fontSize: 17, fontFamily: Typography?.fontFamily?.bold || 'System', fontWeight: '600' },
  doneText: { fontSize: 16, fontFamily: Typography?.fontFamily?.bold || 'System', fontWeight: '600' },
});

export default CustomDateTimePicker;
