import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, ScrollView, RefreshControl, TextInput, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api, { getImageUrl } from '../../../api/axios';
import { Colors, Typography } from '../../../theme/theme';
import { formatISTDateTime } from '../../../utils/dateFormatter';
import { showCustomAlert } from '../../../components/CustomAlert';

export default function UgcReportsAdminView() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'resolved'
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [warningText, setWarningText] = useState('');

  const getDefaultWarningMessage = (report, isSecondWarning = false) => {
    if (!report) return '';
    const isPlayer = report.contentType === 'player';
    const contentName = report.contentDetails?.name || 'profile';

    if (isSecondWarning) {
      switch (report.reason) {
        case 'inappropriate_name':
          return `⚠️ FINAL WARNING: Your ${report.contentType} profile "${contentName}" continues to violate our community guidelines due to an inappropriate name. If you do not update this name immediately, your account will be permanently suspended.`;
        case 'offensive_photo':
          return `⚠️ FINAL WARNING: Your ${report.contentType} profile "${contentName}" continues to violate our community guidelines due to an offensive photo or logo. If you do not change it immediately, your account will be permanently suspended.`;
        case 'harassment':
          return `⚠️ FINAL WARNING: Your account/team "${contentName}" has been flagged multiple times for harassment or abusive behavior. This is your final warning before permanent suspension.`;
        case 'spam':
          return `⚠️ FINAL WARNING: Multiple reports of spam or fake account activity have been logged for "${contentName}". Please verify your details immediately, or your account will be permanently removed.`;
        default:
          return `⚠️ FINAL WARNING: This is a final notice regarding violations on your ${report.contentType} profile "${contentName}". Please correct the details immediately to avoid account deletion.`;
      }
    }

    switch (report.reason) {
      case 'inappropriate_name':
        return `Hello, your ${report.contentType} profile "${contentName}" has been flagged for having an inappropriate name. Please update it to comply with ScoreVerse guidelines.`;
      case 'offensive_photo':
        return `Hello, your ${report.contentType} profile "${contentName}" has been flagged for containing an offensive photo or logo. Please update it with a suitable image.`;
      case 'harassment':
        return `Hello, your ${report.contentType} profile "${contentName}" has been flagged for harassment or abusive content. Please review your details and adhere to our community standards.`;
      case 'spam':
        return `Hello, your ${report.contentType} profile "${contentName}" has been reported as spam or a fake account. Please verify your details.`;
      default:
        return `Hello, your ${report.contentType} profile "${contentName}" has been reported for violating our community guidelines. Please review and update your profile details.`;
    }
  };

  const handleOpenWarning = (report) => {
    setSelectedReport(report);
    const isSecondWarning = report.status !== 'pending';
    setWarningText(getDefaultWarningMessage(report, isSecondWarning));
    setWarningModalVisible(true);
  };

  const fetchReports = async () => {
    try {
      if (!refreshing) setLoading(true);
      const res = await api.get('/admin/ugc-reports');
      if (res.data && res.data.success) {
        setReports(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching UGC reports:', err);
      showCustomAlert('Error', 'Failed to fetch UGC reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [activeTab])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  const handleExecuteAction = (reportId, action, actionLabel) => {
    showCustomAlert(
      'Confirm Action',
      `Are you sure you want to execute "${actionLabel}"? This action will resolve the report.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setLoading(true);
              await api.post(`/admin/ugc-reports/${reportId}/action`, { action });
              showCustomAlert('Success', `Action "${actionLabel}" executed successfully.`);
              await fetchReports();
            } catch (err) {
              console.error('Error executing action:', err);
              showCustomAlert('Error', err.response?.data?.message || 'Failed to execute moderation action.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const filteredReports = reports.filter(r => {
    if (activeTab === 'pending') return r.status === 'pending';
    return r.status === 'resolved' || r.status === 'reviewed';
  });

  const renderReport = ({ item }) => {
    const isPlayer = item.contentType === 'player';
    const content = item.contentDetails;

    // Reason formatting
    const reasonLabels = {
      inappropriate_name: 'Inappropriate Name',
      offensive_photo: isPlayer ? 'Offensive Photo' : 'Offensive Logo',
      harassment: 'Harassment or Abuse',
      spam: 'Spam or Fake Profile',
      other: 'Other Reason'
    };
    const displayReason = reasonLabels[item.reason] || item.reason;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon 
              name={isPlayer ? 'account-alert-outline' : 'shield-alert-outline'} 
              size={20} 
              color={Colors.primary} 
            />
            <Text style={styles.contentTypeText}>
              Reported {isPlayer ? 'Player' : 'Team'}
            </Text>
          </View>
          <Text style={styles.dateText}>{formatISTDateTime(item.createdAt)}</Text>
        </View>

        {/* Content details display */}
        {content ? (
          <View style={styles.contentBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {isPlayer ? (
                content.photo ? (
                  <Image source={{ uri: getImageUrl(content.photo) }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>{(content.name || '?').charAt(0).toUpperCase()}</Text>
                  </View>
                )
              ) : (
                content.logo ? (
                  <Image source={{ uri: getImageUrl(content.logo) }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Icon name="shield" size={20} color={Colors.primary} />
                  </View>
                )
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.contentName} numberOfLines={1}>{content.name}</Text>
                <Text style={styles.contentSub} numberOfLines={1}>
                  {isPlayer ? `Email: ${content.email}` : `${content.city || 'N/A'}, ${content.state || 'N/A'}`}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.contentBox}>
            <Text style={{ color: Colors.textSecondary, fontStyle: 'italic', fontSize: 13 }}>
              Content has already been deleted or is not available.
            </Text>
          </View>
        )}

        <Text style={styles.reasonText}>Reason: <Text style={{ color: '#fff', fontFamily: Typography.fontFamily.bold }}>{displayReason}</Text></Text>
        {item.details ? (
          <View style={styles.detailsBox}>
            <Text style={styles.detailsText}>{item.details}</Text>
          </View>
        ) : null}

        <Text style={styles.reporterText}>
          Reported by: {item.reporterId?.name || 'User'} ({item.reporterId?.email || 'N/A'})
        </Text>

        {item.status === 'pending' && (
          <View style={styles.actionsRow}>
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#FF9800' }]} 
              onPress={() => handleOpenWarning(item)}
            >
              <Text style={styles.actionBtnText}>Warn</Text>
            </TouchableOpacity>

            {isPlayer ? (
              <>
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: Colors.error }]} 
                  onPress={() => handleExecuteAction(item._id, 'suspend_user', 'Suspend User')}
                >
                  <Text style={styles.actionBtnText}>Suspend</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: Colors.error }]} 
                onPress={() => handleExecuteAction(item._id, 'delete_team', 'Delete Team')}
              >
                <Text style={styles.actionBtnText}>Delete Team</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]} 
              onPress={() => handleExecuteAction(item._id, 'dismiss', 'Dismiss Report')}
            >
              <Text style={[styles.actionBtnText, { color: Colors.textSecondary }]}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status !== 'pending' && (
          <View style={styles.actionsRow}>
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#FF9800' }]} 
              onPress={() => handleOpenWarning(item)}
            >
              <Text style={styles.actionBtnText}>Warn Again</Text>
            </TouchableOpacity>

            {isPlayer ? (
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: Colors.error }]} 
                onPress={() => handleExecuteAction(item._id, 'delete_user', 'Delete Player & Total Things')}
              >
                <Text style={styles.actionBtnText}>Delete Cascade</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: Colors.error }]} 
                onPress={() => handleExecuteAction(item._id, 'delete_team', 'Delete Team')}
              >
                <Text style={styles.actionBtnText}>Delete Team</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'resolved' && styles.activeTab]}
          onPress={() => setActiveTab('resolved')}
        >
          <Text style={[styles.tabText, activeTab === 'resolved' && styles.activeTabText]}>
            Resolved
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={filteredReports}
          keyExtractor={item => item._id}
          renderItem={renderReport}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="shield-check-outline" size={60} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No {activeTab} UGC reports found.</Text>
            </View>
          }
        />
      )}

      {/* Send Warning Modal */}
      <Modal visible={warningModalVisible} transparent animationType="slide" onRequestClose={() => setWarningModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Warning</Text>
              <TouchableOpacity onPress={() => setWarningModalVisible(false)}>
                <Icon name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedReport && (
              <View style={styles.recipientBadge}>
                <Text style={styles.recipientTitle}>
                  Warning Recipient ({selectedReport.contentType === 'player' ? 'Player' : 'Team Captain'}):
                </Text>
                <Text style={styles.recipientDetail}>
                  Name: <Text style={{ color: '#fff', fontFamily: Typography.fontFamily.bold }}>{selectedReport.contentType === 'player' ? selectedReport.contentDetails?.name : (selectedReport.contentDetails?.creator?.name || 'Team Captain')}</Text>
                </Text>
                <Text style={styles.recipientDetail}>
                  Email: <Text style={{ color: '#fff', fontFamily: Typography.fontFamily.bold }}>{selectedReport.contentType === 'player' ? selectedReport.contentDetails?.email : (selectedReport.contentDetails?.creator?.email || 'N/A')}</Text>
                </Text>
              </View>
            )}

            <Text style={{ color: Colors.textSecondary, marginBottom: 12, fontSize: 13, fontFamily: Typography.fontFamily.regular, lineHeight: 18 }}>
              Enter the warning message that will be sent to the user or captain's notifications inbox:
            </Text>
            <TextInput
              style={styles.modalInput}
              multiline
              numberOfLines={4}
              placeholder="Type warning message here..."
              placeholderTextColor={Colors.textTertiary}
              value={warningText}
              onChangeText={setWarningText}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]} 
                onPress={() => setWarningModalVisible(false)}
              >
                <Text style={{ color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: Colors.primary }]} 
                onPress={async () => {
                  if (!warningText.trim()) {
                    showCustomAlert('Error', 'Please enter a warning message.');
                    return;
                  }
                  try {
                    setLoading(true);
                    setWarningModalVisible(false);
                    await api.post(`/admin/ugc-reports/${selectedReport._id}/warn`, { message: warningText });
                    showCustomAlert('Success', 'Warning sent successfully and report resolved.');
                    await fetchReports();
                  } catch (err) {
                    showCustomAlert('Error', err.response?.data?.message || 'Failed to send warning.');
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <Text style={{ color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 14 }}>Send Warning</Text>
              </TouchableOpacity>
            </View>
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
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  card: { backgroundColor: Colors.backgroundCard, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  contentTypeText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 13 },
  dateText: { color: Colors.textSecondary, fontSize: 11, fontFamily: Typography.fontFamily.regular },
  contentBox: { backgroundColor: Colors.background, padding: 10, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#222' },
  avatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,204,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  avatarFallbackText: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.primary },
  contentName: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  contentSub: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 11, marginTop: 1 },
  reasonText: { color: Colors.textSecondary, fontSize: 13, fontFamily: Typography.fontFamily.medium, marginBottom: 6 },
  detailsBox: { backgroundColor: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 6, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  detailsText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.regular, fontSize: 13, lineHeight: 18 },
  reporterText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 11, marginBottom: 12 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 12 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
  emptyText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginTop: 16 },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: Colors.backgroundModal || Colors.backgroundCard, borderRadius: 16, padding: 20, maxHeight: '80%', borderWidth: 1, borderColor: Colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 18 },
  modalInput: { backgroundColor: Colors.background, color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: Colors.border, padding: 12, fontSize: 14, textAlignVertical: 'top', height: 100 },
  modalActionBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  recipientBadge: { backgroundColor: 'rgba(255,204,0,0.06)', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,204,0,0.15)', marginBottom: 12 },
  recipientTitle: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 13, marginBottom: 4 },
  recipientDetail: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 12, marginBottom: 2 },
});
