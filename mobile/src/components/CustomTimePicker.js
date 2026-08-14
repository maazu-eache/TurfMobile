import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, FlatList } from 'react-native';
import { Colors, Typography, BorderRadius, Spacing } from '../theme/theme';

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45', '59'];

const CustomTimePicker = ({ visible, onClose, onSelect, initialTime, title }) => {
  const [selectedHour, setSelectedHour] = useState(initialTime ? initialTime.split(':')[0] : '00');
  const [selectedMinute, setSelectedMinute] = useState(initialTime ? initialTime.split(':')[1] : '00');

  const handleHourSelect = (hour) => {
    setSelectedHour(hour);
    if (hour !== '23' && selectedMinute === '59') {
      setSelectedMinute('00');
    }
  };

  const minutesData = selectedHour === '23' ? ['00', '15', '30', '45', '59'] : ['00', '15', '30', '45'];

  const handleSave = () => {
    onSelect(`${selectedHour}:${selectedMinute}`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{title || 'Select Time'}</Text>
          
          <View style={styles.pickerRow}>
            <View style={styles.listContainer}>
              <Text style={styles.listTitle}>Hour</Text>
              <FlatList
                data={HOURS}
                extraData={selectedHour}
                keyExtractor={(item) => item}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={[styles.item, selectedHour === item && styles.itemSelected]}
                    onPress={() => handleHourSelect(item)}
                  >
                    <Text style={[styles.itemText, selectedHour === item && styles.itemTextSelected]}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
 
            <Text style={styles.colon}>:</Text>
 
            <View style={styles.listContainer}>
              <Text style={styles.listTitle}>Minute</Text>
              <FlatList
                data={minutesData}
                extraData={`${selectedHour}-${selectedMinute}`}
                keyExtractor={(item) => item}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={[styles.item, selectedMinute === item && styles.itemSelected]}
                    onPress={() => setSelectedMinute(item)}
                  >
                    <Text style={[styles.itemText, selectedMinute === item && styles.itemTextSelected]}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
 
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '80%',
    height: 350,
    backgroundColor: '#1A1A1A',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#333',
  },
  title: {
    ...Typography.subtitle1,
    color: '#FFF',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  listContainer: {
    flex: 1,
    height: '100%',
  },
  listTitle: {
    ...Typography.body2,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  item: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  itemSelected: {
    backgroundColor: Colors.primary,
  },
  itemText: {
    ...Typography.body1,
    color: Colors.textSecondary,
  },
  itemTextSelected: {
    color: '#000',
    fontWeight: 'bold',
  },
  colon: {
    ...Typography.h4,
    color: '#FFF',
    marginHorizontal: Spacing.sm,
    paddingBottom: 20,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    ...Typography.button,
    color: Colors.textSecondary,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
  },
  saveBtnText: {
    ...Typography.button,
    color: '#000',
  }
});

export default CustomTimePicker;
