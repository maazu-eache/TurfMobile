import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Linking, Modal, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../../api/axios';
import { Colors, Typography, Spacing } from '../../../theme/theme';

import { formatISTDateTime } from '../../../utils/dateFormatter';

export default function TicketListScreen({ navigation }) {
  const supportEmail = 'maazibrahimoo0@gmail.com';
  const supportPhone = '+91 8428676150';
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await api.get('/support');
      setTickets(res.data.data || []);
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTickets();
    }, [])
  );

  const getStatusColor = (status) => {
    switch(status) {
      case 'open': return Colors.primary;
      case 'in_progress': return Colors.warning;
      case 'resolved': return Colors.success;
      case 'closed': return Colors.textSecondary;
      default: return Colors.textSecondary;
    }
  };

  const renderTicket = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => setSelectedTicket(item)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.category}>{item.category}</Text>
      {item.email && <Text style={styles.contactEmail}>Contact Email: {item.email}</Text>}
      {item.bookingId && (
        <Text style={styles.bookingRef}>
          Booking: {typeof item.bookingId === 'object' ? (item.bookingId.bookingRef || item.bookingId._id) : item.bookingId}
        </Text>
      )}
      <Text style={styles.date}>
        Submitted on: {formatISTDateTime(item.createdAt)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Support Tickets</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={item => item._id}
            renderItem={renderTicket}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="ticket-confirmation-outline" size={56} color={Colors.primary} />
                <Text style={styles.emptyTitle}>No Support Tickets</Text>
                <Text style={styles.emptySubtitle}>
                  You haven't opened any support tickets yet. Need urgent help? Reach out directly to us:
                </Text>

                <View style={styles.contactCardContainer}>
                  <TouchableOpacity 
                    style={styles.contactItem}
                    onPress={() => Linking.openURL(`mailto:${supportEmail}`)}
                  >
                    <View style={styles.contactIconBox}>
                      <Icon name="email-outline" size={22} color={Colors.primary} />
                    </View>
                    <View style={styles.contactTextWrap}>
                      <Text style={styles.contactLabel}>Email Support</Text>
                      <Text style={styles.contactValue}>{supportEmail}</Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.contactItem}
                    onPress={() => Linking.openURL(`tel:${supportPhone}`)}
                  >
                    <View style={styles.contactIconBox}>
                      <Icon name="phone-outline" size={22} color={Colors.primary} />
                    </View>
                    <View style={styles.contactTextWrap}>
                      <Text style={styles.contactLabel}>Phone Support</Text>
                      <Text style={styles.contactValue}>{supportPhone}</Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={styles.createTicketPromptBtn}
                  onPress={() => navigation.navigate('CreateTicketScreen')}
                >
                  <Icon name="plus-circle-outline" size={20} color="#000" style={{ marginRight: 8 }} />
                  <Text style={styles.createTicketPromptText}>Create Support Ticket</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}

        <TouchableOpacity 
          style={styles.fab}
          onPress={() => navigation.navigate('CreateTicketScreen')}
        >
          <Icon name="plus" size={28} color="#000" />
        </TouchableOpacity>

        {/* Ticket Details Modal */}
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
                  <View style={styles.modalRow}>
                    <Text style={styles.modalSubject}>{selectedTicket.subject}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedTicket.status) }]}>
                      <Text style={styles.statusText}>{selectedTicket.status.toUpperCase()}</Text>
                    </View>
                  </View>

                  <Text style={styles.modalMeta}>Category: {selectedTicket.category}</Text>
                  <Text style={styles.modalMeta}>Contact Email: {selectedTicket.email || 'N/A'}</Text>

                  {selectedTicket.bookingId && (
                    <Text style={styles.modalMeta}>
                      Booking Ref: {typeof selectedTicket.bookingId === 'object' ? (selectedTicket.bookingId.bookingRef || selectedTicket.bookingId._id) : selectedTicket.bookingId}
                    </Text>
                  )}

                  <Text style={styles.modalMeta}>
                    Submitted: {formatISTDateTime(selectedTicket.createdAt)}
                  </Text>

                  <Text style={styles.modalSectionTitle}>Description</Text>
                  <View style={styles.descriptionBox}>
                    <Text style={styles.modalDescription}>{selectedTicket.description}</Text>
                  </View>

                  {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                    <>
                      <Text style={styles.modalSectionTitle}>Attached Image</Text>
                      {selectedTicket.attachments.map((url, idx) => (
                        <Image key={idx} source={{ uri: url }} style={styles.attachedImage} resizeMode="contain" />
                      ))}
                    </>
                  )}

                  <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedTicket(null)}>
                    <Text style={styles.closeBtnText}>Close</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: Colors.backgroundCard,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subject: {
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 16,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#000',
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
  },
  category: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 14,
    marginBottom: 4,
  },
  contactEmail: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 12,
    marginBottom: 4,
  },
  bookingRef: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 12,
    marginBottom: 4,
  },
  date: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 20,
    marginTop: 12,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  contactCardContainer: {
    width: '100%',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 8,
    marginBottom: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  contactIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 204, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactTextWrap: {
    flex: 1,
  },
  contactLabel: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  contactValue: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
    marginTop: 2,
  },
  createTicketPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 8,
  },
  createTicketPromptText: {
    color: '#000',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 15,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: Colors.backgroundModal, borderRadius: 16, padding: 20, maxHeight: '85%', borderWidth: 1, borderColor: Colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 18 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalSubject: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16, flex: 1, marginRight: 8 },
  modalMeta: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginBottom: 6 },
  modalSectionTitle: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 14, marginTop: 16, marginBottom: 8 },
  descriptionBox: { backgroundColor: Colors.background, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  modalDescription: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.regular, fontSize: 14 },
  attachedImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 12 },
  closeBtn: { backgroundColor: Colors.primary, padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  closeBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 15 },
});
