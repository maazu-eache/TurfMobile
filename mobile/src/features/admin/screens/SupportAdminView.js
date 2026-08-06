import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Modal, Image, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../../api/axios';
import { Colors, Typography } from '../../../theme/theme';
import { formatISTDateTime } from '../../../utils/dateFormatter';
import { showCustomAlert } from '../../../components/CustomAlert';

export default function SupportAdminView({ navigation, onStatusChanged }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('open'); // 'open', 'in_progress', 'resolved', 'closed'
  const [search, setSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/support?status=${activeTab}`);
      setTickets(res.data.data || []);
    } catch (err) {
      console.error('Error fetching admin tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTickets();
    }, [activeTab])
  );

  const handleUpdateStatus = (ticketId, newStatus) => {
    const statusLabel = newStatus.replace('_', ' ').toUpperCase();
    showCustomAlert(
      'Confirm Action',
      `Are you sure you want to change ticket status to ${statusLabel}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setUpdatingId(ticketId);
              await api.put(`/admin/support/${ticketId}/status`, { status: newStatus });
              if (selectedTicket && selectedTicket._id === ticketId) {
                setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null);
              }
              await fetchTickets();
              if (onStatusChanged) onStatusChanged();
              showCustomAlert('Success', `Ticket status updated to ${statusLabel}`);
            } catch (err) {
              console.error('Error updating status:', err);
              showCustomAlert('Error', err.response?.data?.message || 'Failed to update ticket status.');
            } finally {
              setUpdatingId(null);
            }
          }
        }
      ]
    );
  };

  const filteredTickets = tickets.filter(t => 
    t.subject.toLowerCase().includes(search.toLowerCase()) || 
    (t.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.creatorName || t.createdBy?.name || t.createdBy?.businessName || '').toLowerCase().includes(search.toLowerCase())
  );

  const renderTicket = ({ item }) => {
    const rawName = item.creatorName || item.createdBy?.name || item.createdBy?.userId?.name || item.createdBy?.businessName;
    const creatorName = (rawName && !rawName.includes('@')) ? rawName : (item.createdBy?.name || item.createdBy?.userId?.name || rawName || 'User');
    const isUpdating = updatingId === item._id;

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => setSelectedTicket(item)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
          <Text style={styles.date}>{formatISTDateTime(item.createdAt)}</Text>
        </View>

        <Text style={styles.category}>{item.category} • {item.creatorModel}: {creatorName}</Text>
        <Text style={styles.emailText}>Email: {item.email || 'N/A'}</Text>
        
        {item.bookingId && (
          <Text style={styles.bookingRef}>
            Booking: {typeof item.bookingId === 'object' ? (item.bookingId.bookingRef || item.bookingId._id) : item.bookingId}
          </Text>
        )}

        <Text style={styles.descriptionPreview} numberOfLines={2}>{item.description}</Text>

        <View style={styles.cardActions}>
          {isUpdating ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ padding: 6 }} />
          ) : (
            <>
              {item.status !== 'in_progress' && (
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: '#2196F3' }]} 
                  onPress={() => handleUpdateStatus(item._id, 'in_progress')}
                >
                  <Text style={styles.actionBtnText}>In Progress</Text>
                </TouchableOpacity>
              )}

              {item.status !== 'resolved' && (
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: Colors.success }]} 
                  onPress={() => handleUpdateStatus(item._id, 'resolved')}
                >
                  <Text style={styles.actionBtnText}>Mark Resolved</Text>
                </TouchableOpacity>
              )}

              {item.status !== 'closed' && (
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: Colors.error }]} 
                  onPress={() => handleUpdateStatus(item._id, 'closed')}
                >
                  <Text style={styles.actionBtnText}>Close Ticket</Text>
                </TouchableOpacity>
              )}

              {(item.status === 'resolved' || item.status === 'closed') && (
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: Colors.primary }]} 
                  onPress={() => handleUpdateStatus(item._id, 'open')}
                >
                  <Text style={[styles.actionBtnText, { color: '#000' }]}>Re-open</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const tabs = [
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'closed', label: 'Closed' }
  ];

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        {tabs.map(tab => (
          <TouchableOpacity 
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search subject, email or user..."
          placeholderTextColor={Colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={item => item._id}
          renderItem={renderTicket}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="ticket-outline" size={60} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No {activeTab.replace('_', ' ')} tickets found.</Text>
            </View>
          }
        />
      )}

      {/* Admin Ticket Detail Modal */}
      <Modal visible={!!selectedTicket} transparent animationType="slide" onRequestClose={() => setSelectedTicket(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>Ticket Details</Text>
              <TouchableOpacity onPress={() => setSelectedTicket(null)}>
                <Icon name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedTicket && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalSubject}>{selectedTicket.subject}</Text>
                <Text style={styles.modalMeta}>Status: {selectedTicket.status.toUpperCase()}</Text>
                <Text style={styles.modalMeta}>Category: {selectedTicket.category}</Text>
                <Text style={styles.modalMeta}>Contact Email: {selectedTicket.email || 'N/A'}</Text>
                <Text style={styles.modalMeta}>
                  Submitted By: {selectedTicket.creatorModel} ({ (selectedTicket.creatorName && !selectedTicket.creatorName.includes('@')) ? selectedTicket.creatorName : (selectedTicket.createdBy?.name || selectedTicket.createdBy?.userId?.name || selectedTicket.createdBy?.businessName || selectedTicket.creatorName || 'N/A') })
                </Text>

                {selectedTicket.bookingId && (
                  <Text style={styles.modalMeta}>
                    Booking Ref: {typeof selectedTicket.bookingId === 'object' ? (selectedTicket.bookingId.bookingRef || selectedTicket.bookingId._id) : selectedTicket.bookingId}
                  </Text>
                )}

                <Text style={styles.modalMeta}>
                  Submitted On: {formatISTDateTime(selectedTicket.createdAt)}
                </Text>

                <Text style={styles.modalSectionTitle}>Description</Text>
                <View style={styles.descriptionBox}>
                  <Text style={styles.modalDescription}>{selectedTicket.description}</Text>
                </View>

                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                  <>
                    <Text style={styles.modalSectionTitle}>Attached Proof / Screenshot</Text>
                    {selectedTicket.attachments.map((url, idx) => (
                      <Image key={idx} source={{ uri: url }} style={styles.attachedImage} resizeMode="contain" />
                    ))}
                  </>
                )}

                <View style={styles.modalActionsRow}>
                  {selectedTicket.status !== 'in_progress' && (
                    <TouchableOpacity 
                      style={[styles.modalActionBtn, { backgroundColor: '#2196F3' }]} 
                      onPress={() => handleUpdateStatus(selectedTicket._id, 'in_progress')}
                    >
                      <Text style={styles.actionBtnText}>In Progress</Text>
                    </TouchableOpacity>
                  )}

                  {selectedTicket.status !== 'resolved' && (
                    <TouchableOpacity 
                      style={[styles.modalActionBtn, { backgroundColor: Colors.success }]} 
                      onPress={() => handleUpdateStatus(selectedTicket._id, 'resolved')}
                    >
                      <Text style={styles.actionBtnText}>Mark Resolved</Text>
                    </TouchableOpacity>
                  )}

                  {selectedTicket.status !== 'closed' && (
                    <TouchableOpacity 
                      style={[styles.modalActionBtn, { backgroundColor: Colors.error }]} 
                      onPress={() => handleUpdateStatus(selectedTicket._id, 'closed')}
                    >
                      <Text style={styles.actionBtnText}>Close Ticket</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedTicket(null)}>
                  <Text style={styles.closeBtnText}>Done</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tabsContainer: { flexDirection: 'row', backgroundColor: Colors.backgroundElevated, padding: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 20 },
  activeTab: { backgroundColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 12 },
  activeTabText: { color: '#000', fontFamily: Typography.fontFamily.bold },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, margin: 16, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, padding: 12, color: Colors.textPrimary, fontFamily: Typography.fontFamily.regular },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingTop: 0 },
  card: { backgroundColor: Colors.backgroundCard, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  subject: { flex: 1, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16, marginRight: 8 },
  date: { color: Colors.textSecondary, fontSize: 12, fontFamily: Typography.fontFamily.regular },
  category: { color: Colors.primary, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginBottom: 4 },
  emailText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 12, marginBottom: 2 },
  bookingRef: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 12, marginBottom: 4 },
  descriptionPreview: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 13, marginTop: 4, marginBottom: 12 },
  
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  actionBtnText: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 12 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginTop: 16 },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: Colors.backgroundModal, borderRadius: 16, padding: 20, maxHeight: '85%', borderWidth: 1, borderColor: Colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 18 },
  modalSubject: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 17, marginBottom: 8 },
  modalMeta: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginBottom: 6 },
  modalSectionTitle: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 14, marginTop: 16, marginBottom: 8 },
  descriptionBox: { backgroundColor: Colors.background, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  modalDescription: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.regular, fontSize: 14 },
  attachedImage: { width: '100%', height: 220, borderRadius: 8, marginBottom: 12 },
  modalActionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalActionBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center' },
  closeBtn: { backgroundColor: Colors.primary, padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  closeBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 15 },
});
