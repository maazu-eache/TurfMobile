import React, { useState, useCallback } from 'react';
import {  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Modal, Image, ScrollView , Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import api from '../../../api/axios';
import { Colors, Typography } from '../../../theme/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { formatISTDateTime } from '../../../utils/dateFormatter';
import { showCustomAlert } from '../../../components/CustomAlert';

export default function SupportAdminView({ navigation, onStatusChanged }) {
  const { colors, isDark, shadows } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, isDark, shadows), [colors, isDark, shadows]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('open'); // 'open', 'in_progress', 'resolved', 'closed'
  const [search, setSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const [resolutionModalVisible, setResolutionModalVisible] = useState(false);
  const [targetStatus, setTargetStatus] = useState(null); // 'resolved' or 'closed'
  const [resolutionMessage, setResolutionMessage] = useState('');
  const [resolutionImageUri, setResolutionImageUri] = useState(null);
  const [resolutionImageFile, setResolutionImageFile] = useState(null);
  const [targetTicketId, setTargetTicketId] = useState(null);
  const [verificationModalVisible, setVerificationModalVisible] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [verificationText, setVerificationText] = useState('');

  const getDefaultVerificationMessage = (name, matchName) => {
    return `Hello ${name},\n\nWe are currently reviewing a support ticket dispute regarding your match (${matchName}).\n\nAs a key stakeholder (player, scorer, or organizer) of this match, please reply directly to this email with proof of the match. You can provide a screenshot from the app itself, written statements, or photos of physical scorecard sheets to help us verify and resolve this dispute.`;
  };

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
    if (newStatus === 'resolved' || newStatus === 'closed') {
      setTargetTicketId(ticketId);
      setTargetStatus(newStatus);
      const defaultMsg = newStatus === 'resolved'
        ? 'Dear user, your support ticket/dispute has been resolved successfully. Thank you for your patience and cooperation.'
        : 'Dear user, your support ticket has been closed. Thank you for reaching out to ScoreVerse Support.';
      setResolutionMessage(defaultMsg);
      setResolutionImageUri(null);
      setResolutionImageFile(null);
      setResolutionModalVisible(true);
      return;
    }

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

  const handleSelectResolutionImage = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
      if (result.didCancel) return;
      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setResolutionImageUri(asset.uri);
        setResolutionImageFile({
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || 'upload.jpg',
        });
      }
    } catch (err) {
      console.log('Error selecting image:', err);
    }
  };

  const handleConfirmResolution = async () => {
    try {
      setLoading(true);
      setResolutionModalVisible(false);

      let attachments = [];
      if (resolutionImageFile) {
        const formData = new FormData();
        formData.append('images', resolutionImageFile);
        const uploadRes = await api.post('/support/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (uploadRes.data.success && uploadRes.data.data.urls) {
          attachments = uploadRes.data.data.urls;
        }
      }

      await api.put(`/admin/support/${targetTicketId}/status`, { 
        status: targetStatus,
        message: resolutionMessage,
        attachments
      });

      if (selectedTicket && selectedTicket._id === targetTicketId) {
        setSelectedTicket(prev => prev ? { ...prev, status: targetStatus } : null);
      }
      await fetchTickets();
      if (onStatusChanged) onStatusChanged();
      showCustomAlert('Success', `Ticket resolved successfully.`);
    } catch (err) {
      console.error('Error resolving ticket:', err);
      showCustomAlert('Error', err.response?.data?.message || 'Failed to resolve ticket.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendVerification = (email, name, matchObj) => {
    const cleanMatchId = matchObj?._id || matchObj;
    const teamAName = matchObj?.teamA?.name;
    const teamBName = matchObj?.teamB?.name;
    const matchName = teamAName && teamBName ? `${teamAName} vs ${teamBName}` : 'Disputed Match';

    setSelectedContact({ email, name, matchId: cleanMatchId, matchName });
    setVerificationText(getDefaultVerificationMessage(name, matchName));
    setVerificationModalVisible(true);
  };

  const handleDeleteMatch = (matchId) => {
    const cleanMatchId = matchId?._id || matchId;
    showCustomAlert(
      'Delete Match',
      'Are you sure you want to permanently delete this match and rollback all player stats? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Match',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdatingId(selectedTicket._id);
              await api.delete(`/admin/matches/${cleanMatchId}`);
              showCustomAlert('Success', 'Match deleted and player/team stats rolled back successfully.');
              setSelectedTicket(null);
              await fetchTickets();
              if (onStatusChanged) onStatusChanged();
            } catch (err) {
              console.error('Error deleting match:', err);
              showCustomAlert('Error', err.response?.data?.message || 'Failed to delete match.');
            } finally {
              setUpdatingId(null);
            }
          }
        }
      ]
    );
  };

  const handleDeleteTournament = (tournamentId) => {
    const cleanTournamentId = tournamentId?._id || tournamentId;
    showCustomAlert(
      'Delete Tournament',
      'Are you sure you want to permanently delete this tournament and all its associated matches? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Tournament',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdatingId(selectedTicket._id);
              await api.delete(`/admin/tournaments/${cleanTournamentId}`);
              showCustomAlert('Success', 'Tournament deleted and all match stats rolled back successfully.');
              setSelectedTicket(null);
              await fetchTickets();
              if (onStatusChanged) onStatusChanged();
            } catch (err) {
              console.error('Error deleting tournament:', err);
              showCustomAlert('Error', err.response?.data?.message || 'Failed to delete tournament.');
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

                {selectedTicket.matchId && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.modalSectionTitle}>Associated Match Details</Text>
                    <View style={styles.disputeCard}>
                      <View style={styles.disputeHeader}>
                        <Icon name="cricket" size={20} color={Colors.primary} />
                        <Text style={styles.disputeTitle}>Match Dispute Info</Text>
                      </View>
                      <Text style={styles.disputeDetail}>
                        Teams: {selectedTicket.matchId.teamA?.name || 'A'} vs {selectedTicket.matchId.teamB?.name || 'B'}
                      </Text>
                      <Text style={styles.disputeDetail}>Status: {selectedTicket.matchId.status?.toUpperCase() || 'N/A'}</Text>
                      <Text style={styles.disputeDetail}>ID: {selectedTicket.matchId._id || selectedTicket.matchId}</Text>
                      {selectedTicket.matchId.result?.summary && (
                        <Text style={styles.disputeDetail}>Result: {selectedTicket.matchId.result.summary}</Text>
                      )}
                      
                      <TouchableOpacity 
                        style={[styles.deleteBtn, { marginTop: 12 }]} 
                        onPress={() => handleDeleteMatch(selectedTicket.matchId._id || selectedTicket.matchId)}
                      >
                        <Icon name="trash-can-outline" size={16} color="#FFF" style={{ marginRight: 4 }} />
                        <Text style={styles.deleteBtnText}>Delete Match & Revert Stats</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {selectedTicket.tournamentId && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.modalSectionTitle}>Associated Tournament Details</Text>
                    <View style={styles.disputeCard}>
                      <View style={styles.disputeHeader}>
                        <Icon name="trophy-outline" size={20} color={Colors.primary} />
                        <Text style={styles.disputeTitle}>Tournament Info</Text>
                      </View>
                      <Text style={styles.disputeDetail}>Name: {selectedTicket.tournamentId.name || 'N/A'}</Text>
                      <Text style={styles.disputeDetail}>Sport: {selectedTicket.tournamentId.sport || 'Cricket'}</Text>
                      {selectedTicket.tournamentId.description && (
                        <Text style={styles.disputeDetail} numberOfLines={2}>Desc: {selectedTicket.tournamentId.description}</Text>
                      )}
                      <Text style={styles.disputeDetail}>ID: {selectedTicket.tournamentId._id || selectedTicket.tournamentId}</Text>

                      <TouchableOpacity 
                        style={[styles.deleteBtn, { marginTop: 12 }]} 
                        onPress={() => handleDeleteTournament(selectedTicket.tournamentId._id || selectedTicket.tournamentId)}
                      >
                        <Icon name="trash-can-outline" size={16} color="#FFF" style={{ marginRight: 4 }} />
                        <Text style={styles.deleteBtnText}>Delete Tournament & All Matches</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {selectedTicket.matchContacts && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.modalSectionTitle}>Match Contacts & Roles</Text>
                    <View style={styles.disputeCard}>
                      {/* Scorer */}
                      {selectedTicket.matchContacts.scorer && (
                        <View style={styles.contactSubBox}>
                          <Text style={styles.contactRoleTitle}>Match Scorer</Text>
                          <Text style={styles.disputeDetail}>Name: {selectedTicket.matchContacts.scorer.name}</Text>
                          <Text style={styles.disputeDetail}>Mobile: {selectedTicket.matchContacts.scorer.mobile}</Text>
                          <Text style={styles.disputeDetail}>Email: {selectedTicket.matchContacts.scorer.email}</Text>
                          {selectedTicket.matchContacts.scorer.email && selectedTicket.matchContacts.scorer.email !== 'N/A' && (
                            <TouchableOpacity 
                              style={styles.requestProofBtn}
                              onPress={() => handleSendVerification(
                                selectedTicket.matchContacts.scorer.email,
                                selectedTicket.matchContacts.scorer.name,
                                selectedTicket.matchId
                              )}
                            >
                              <Icon name="email-send-outline" size={12} color="#000" />
                              <Text style={styles.requestProofText}>Request Proof</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      {/* Organizer */}
                      {selectedTicket.matchContacts.organizer && (
                        <View style={[styles.contactSubBox, { marginTop: 8 }]}>
                          <Text style={styles.contactRoleTitle}>Match Creator/Organizer</Text>
                          <Text style={styles.disputeDetail}>Name: {selectedTicket.matchContacts.organizer.name}</Text>
                          <Text style={styles.disputeDetail}>Mobile: {selectedTicket.matchContacts.organizer.mobile}</Text>
                          <Text style={styles.disputeDetail}>Email: {selectedTicket.matchContacts.organizer.email}</Text>
                          {selectedTicket.matchContacts.organizer.email && selectedTicket.matchContacts.organizer.email !== 'N/A' && (
                            <TouchableOpacity 
                              style={styles.requestProofBtn}
                              onPress={() => handleSendVerification(
                                selectedTicket.matchContacts.organizer.email,
                                selectedTicket.matchContacts.organizer.name,
                                selectedTicket.matchId
                              )}
                            >
                              <Icon name="email-send-outline" size={12} color="#000" />
                              <Text style={styles.requestProofText}>Request Proof</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      {/* Co-organizers */}
                      {selectedTicket.matchContacts.coOrganizers && selectedTicket.matchContacts.coOrganizers.length > 0 && (
                        <View style={[styles.contactSubBox, { marginTop: 8 }]}>
                          <Text style={styles.contactRoleTitle}>Co-Organizers</Text>
                          {selectedTicket.matchContacts.coOrganizers.map((co, idx) => (
                            <View key={idx} style={{ marginBottom: 6 }}>
                              <Text style={styles.disputeDetail}>• {co.name} (Mob: {co.mobile})</Text>
                              {co.email && co.email !== 'N/A' && (
                                <TouchableOpacity 
                                  style={[styles.requestProofBtn, { marginLeft: 10 }]}
                                  onPress={() => handleSendVerification(
                                    co.email,
                                    co.name,
                                    selectedTicket.matchId
                                  )}
                                >
                                  <Icon name="email-send-outline" size={12} color="#000" />
                                  <Text style={styles.requestProofText}>Request Proof</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Scorers */}
                      {selectedTicket.matchContacts.scorers && selectedTicket.matchContacts.scorers.length > 0 && (
                        <View style={[styles.contactSubBox, { marginTop: 8 }]}>
                          <Text style={styles.contactRoleTitle}>Additional Scorers</Text>
                          {selectedTicket.matchContacts.scorers.map((sc, idx) => (
                            <View key={idx} style={{ marginBottom: 6 }}>
                              <Text style={styles.disputeDetail}>• {sc.name} (Mob: {sc.mobile})</Text>
                              {sc.email && sc.email !== 'N/A' && (
                                <TouchableOpacity 
                                  style={[styles.requestProofBtn, { marginLeft: 10 }]}
                                  onPress={() => handleSendVerification(
                                    sc.email,
                                    sc.name,
                                    selectedTicket.matchId
                                  )}
                                >
                                  <Icon name="email-send-outline" size={12} color="#000" />
                                  <Text style={styles.requestProofText}>Request Proof</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Top Players */}
                      {selectedTicket.matchContacts.topPlayers && selectedTicket.matchContacts.topPlayers.length > 0 && (
                        <View style={[styles.contactSubBox, { marginTop: 8, borderBottomWidth: 0, paddingBottom: 0 }]}>
                          <Text style={styles.contactRoleTitle}>Top 3 Match Players / Captains</Text>
                          {selectedTicket.matchContacts.topPlayers.map((tp, idx) => (
                            <View key={idx} style={{ marginTop: 6, paddingLeft: 6 }}>
                              <Text style={styles.disputeDetail}>
                                {idx + 1}. {tp.name} (Mob: {tp.mobile})
                              </Text>
                              <Text style={[styles.disputeDetail, { fontSize: 11, color: Colors.textTertiary, marginLeft: 12, marginBottom: 2 }]}>
                                Email: {tp.email}
                              </Text>
                              {tp.email && tp.email !== 'N/A' && (
                                <TouchableOpacity 
                                  style={[styles.requestProofBtn, { marginLeft: 12 }]}
                                  onPress={() => handleSendVerification(
                                    tp.email,
                                    tp.name,
                                    selectedTicket.matchId
                                  )}
                                >
                                  <Icon name="email-send-outline" size={12} color="#000" />
                                  <Text style={styles.requestProofText}>Request Proof</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {selectedTicket.tournamentContacts && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.modalSectionTitle}>Tournament Contacts & Roles</Text>
                    <View style={styles.disputeCard}>
                      {/* Organizer */}
                      {selectedTicket.tournamentContacts.organizer && (
                        <View style={styles.contactSubBox}>
                          <Text style={styles.contactRoleTitle}>Tournament Organizer</Text>
                          <Text style={styles.disputeDetail}>Name: {selectedTicket.tournamentContacts.organizer.name}</Text>
                          <Text style={styles.disputeDetail}>Mobile: {selectedTicket.tournamentContacts.organizer.mobile}</Text>
                          <Text style={styles.disputeDetail}>Email: {selectedTicket.tournamentContacts.organizer.email}</Text>
                        </View>
                      )}

                      {/* Co-organizers */}
                      {selectedTicket.tournamentContacts.coOrganizers && selectedTicket.tournamentContacts.coOrganizers.length > 0 && (
                        <View style={[styles.contactSubBox, { marginTop: 8 }]}>
                          <Text style={styles.contactRoleTitle}>Co-Organizers</Text>
                          {selectedTicket.tournamentContacts.coOrganizers.map((co, idx) => (
                            <Text key={idx} style={styles.disputeDetail}>
                              • {co.name} (Mob: {co.mobile}, Email: {co.email})
                            </Text>
                          ))}
                        </View>
                      )}

                      {/* Scorers */}
                      {selectedTicket.tournamentContacts.scorers && selectedTicket.tournamentContacts.scorers.length > 0 && (
                        <View style={[styles.contactSubBox, { marginTop: 8, borderBottomWidth: 0, paddingBottom: 0 }]}>
                          <Text style={styles.contactRoleTitle}>Tournament Scorers</Text>
                          {selectedTicket.tournamentContacts.scorers.map((sc, idx) => (
                            <Text key={idx} style={styles.disputeDetail}>
                              • {sc.name} (Mob: {sc.mobile}, Email: {sc.email})
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                )}

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

      {/* Send Verification Modal */}
      <Modal visible={verificationModalVisible} transparent animationType="slide" onRequestClose={() => setVerificationModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Match Proof</Text>
              <TouchableOpacity onPress={() => setVerificationModalVisible(false)}>
                <Icon name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedContact && (
              <View style={styles.recipientBadge}>
                <Text style={styles.recipientTitle}>Recipient Info:</Text>
                <Text style={styles.recipientDetail}>
                  Name: <Text style={{ color: '#fff', fontFamily: Typography.fontFamily.bold }}>{selectedContact.name}</Text>
                </Text>
                <Text style={styles.recipientDetail}>
                  Email: <Text style={{ color: '#fff', fontFamily: Typography.fontFamily.bold }}>{selectedContact.email}</Text>
                </Text>
                <Text style={styles.recipientDetail}>
                  Match: <Text style={{ color: '#fff', fontFamily: Typography.fontFamily.bold }}>{selectedContact.matchName}</Text>
                </Text>
              </View>
            )}

            <Text style={{ color: Colors.textSecondary, marginBottom: 8, fontSize: 13, fontFamily: Typography.fontFamily.regular, lineHeight: 18 }}>
              Review or customize the verification request message below:
            </Text>
            
            <TextInput
              style={styles.modalInput}
              multiline
              numberOfLines={6}
              placeholder="Type verification request details here..."
              placeholderTextColor={Colors.textTertiary}
              value={verificationText}
              onChangeText={setVerificationText}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 12 }]} 
                onPress={() => setVerificationModalVisible(false)}
              >
                <Text style={{ color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: Colors.primary, paddingVertical: 12 }]} 
                onPress={async () => {
                  if (!verificationText.trim()) {
                    showCustomAlert('Error', 'Please enter a verification message.');
                    return;
                  }
                  try {
                    setLoading(true);
                    setVerificationModalVisible(false);
                    await api.post('/admin/support/send-match-verification', {
                      email: selectedContact.email,
                      recipientName: selectedContact.name,
                      matchId: selectedContact.matchId,
                      message: verificationText
                    });
                    showCustomAlert('Success', `Verification request email sent successfully to ${selectedContact.name}.`);
                  } catch (err) {
                    console.error('Error sending verification email:', err);
                    showCustomAlert('Error', err.response?.data?.message || 'Failed to send verification email.');
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <Text style={{ color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 14 }}>Send Email</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Resolution / Close Ticket Modal */}
      <Modal visible={resolutionModalVisible} transparent animationType="slide" onRequestClose={() => setResolutionModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{targetStatus === 'resolved' ? 'Resolve Dispute' : 'Close Ticket'}</Text>
              <TouchableOpacity onPress={() => setResolutionModalVisible(false)}>
                <Icon name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: Colors.textSecondary, marginBottom: 12, fontSize: 13, fontFamily: Typography.fontFamily.regular, lineHeight: 18 }}>
              Provide a written resolution summary and upload a screenshot from the app as proof of the match:
            </Text>

            <TextInput
              style={[styles.modalInput, { height: 95, marginBottom: 16 }]}
              multiline
              numberOfLines={4}
              placeholder="Write resolution notes here (e.g. scorecard updated)..."
              placeholderTextColor={Colors.textTertiary}
              value={resolutionMessage}
              onChangeText={setResolutionMessage}
            />

            <Text style={[styles.recipientTitle, { marginBottom: 6 }]}>Resolution Proof / Screenshot:</Text>
            
            {resolutionImageUri ? (
              <View style={{ position: 'relative', marginBottom: 16 }}>
                <Image source={{ uri: resolutionImageUri }} style={{ width: '100%', height: 160, borderRadius: 8, borderWidth: 1, borderColor: Colors.border }} />
                <TouchableOpacity 
                  style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 12, padding: 4 }}
                  onPress={() => {
                    setResolutionImageUri(null);
                    setResolutionImageFile(null);
                  }}
                >
                  <Icon name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderStyle: 'dashed', borderWidth: 1.5, borderColor: Colors.border, borderRadius: 8, padding: 18, marginBottom: 16, gap: 8 }}
                onPress={handleSelectResolutionImage}
              >
                <Icon name="camera-plus-outline" size={20} color={Colors.primary} />
                <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 13 }}>Attach Proof / Screenshot</Text>
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 12 }]} 
                onPress={() => setResolutionModalVisible(false)}
              >
                <Text style={{ color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: Colors.primary, paddingVertical: 12 }]} 
                onPress={handleConfirmResolution}
              >
                <Text style={{ color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 14 }}>Submit Resolution</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors, isDark, shadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabsContainer: { flexDirection: 'row', backgroundColor: colors.surface, padding: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 20 },
  activeTab: { backgroundColor: isDark ? '#FFD400' : colors.primaryDark },
  tabText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 12 },
  activeTabText: { color: isDark ? '#000' : '#FFF', fontFamily: Typography.fontFamily.bold },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, margin: 16, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, padding: 12, color: colors.textPrimary, fontFamily: Typography.fontFamily.regular },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingTop: 0 },
  card: { backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  subject: { flex: 1, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16, marginRight: 8 },
  date: { color: colors.textSecondary, fontSize: 12, fontFamily: Typography.fontFamily.regular },
  category: { color: isDark ? '#FFD400' : colors.primaryDark, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginBottom: 4 },
  emailText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 12, marginBottom: 2 },
  bookingRef: { color: colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 12, marginBottom: 4 },
  descriptionPreview: { color: colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 13, marginTop: 4, marginBottom: 12 },
  
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  actionBtnText: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 12 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginTop: 16 },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, maxHeight: '85%', borderWidth: 1, borderColor: colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 18 },
  modalSubject: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 17, marginBottom: 8 },
  modalMeta: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginBottom: 6 },
  modalSectionTitle: { color: isDark ? '#FFD400' : colors.primaryDark, fontFamily: Typography.fontFamily.bold, fontSize: 14, marginTop: 16, marginBottom: 8 },
  descriptionBox: { backgroundColor: colors.surfaceVariant, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  modalDescription: { color: colors.textPrimary, fontFamily: Typography.fontFamily.regular, fontSize: 14 },
  attachedImage: { width: '100%', height: 220, borderRadius: 8, marginBottom: 12 },
  modalActionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalActionBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center' },
  closeBtn: { backgroundColor: isDark ? '#FFD400' : colors.primaryDark, padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  closeBtnText: { color: isDark ? '#000' : '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: 15 },

  disputeCard: { backgroundColor: colors.surfaceVariant, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  disputeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  disputeTitle: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  disputeDetail: { color: colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 13, marginBottom: 4 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.error, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  deleteBtnText: { color: '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: 13 },

  contactSubBox: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8, marginBottom: 4 },
  contactRoleTitle: { color: isDark ? '#FFD400' : colors.primaryDark, fontFamily: Typography.fontFamily.bold, fontSize: 13, marginBottom: 4 },

  requestProofBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#FFD400' : colors.primaryDark, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, marginTop: 4, alignSelf: 'flex-start', gap: 4 },
  requestProofText: { color: isDark ? '#000' : '#FFF', fontSize: 11, fontFamily: Typography.fontFamily.bold },

  recipientBadge: { backgroundColor: colors.surfaceVariant, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  recipientTitle: { color: isDark ? '#FFD400' : colors.primaryDark, fontFamily: Typography.fontFamily.bold, fontSize: 13, marginBottom: 4 },
  recipientDetail: { color: colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 12, marginBottom: 2 },
  modalInput: { backgroundColor: colors.surfaceVariant, color: colors.textPrimary, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 12, fontSize: 14, textAlignVertical: 'top', height: 120 },
});
