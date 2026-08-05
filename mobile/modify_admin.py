import re

with open('/Users/apple/RoughTurf/TurfMobile/mobile/src/features/admin/screens/AdminDashboardScreen.js', 'r') as f:
    code = f.read()

# 1. Add refunds state
code = code.replace(
    "const [waitlist, setWaitlist] = useState([]);",
    "const [waitlist, setWaitlist] = useState([]);\n  const [refunds, setRefunds] = useState([]);"
)

# 2. Add API call in fetchData
code = code.replace(
    "api.get('/contact/waitlist?limit=100')",
    "api.get('/contact/waitlist?limit=100'),\n        api.get('/admin/refunds/pending?limit=100')"
)

code = code.replace(
    "if (waitlistRes.status === 'fulfilled') {",
    "const refundsRes = arguments[0][4] if arguments[0] && arguments[0].length > 4 else null; // actually wait, the array is not arguments[0]\n      if (waitlistRes && waitlistRes.status === 'fulfilled') {"
)

# Actually, Promise.allSettled returns an array of results. We can change the destructured assignment:
code = code.replace(
    "const [ownersRes, usersRes, turfsRes, waitlistRes] = await Promise.allSettled([",
    "const [ownersRes, usersRes, turfsRes, waitlistRes, refundsRes] = await Promise.allSettled(["
)

code = code.replace(
    "setWaitlist(wData?.data || wData || []);\n      }",
    "setWaitlist(wData?.data || wData || []);\n      }\n      if (refundsRes?.status === 'fulfilled') setRefunds(refundsRes.value.data.data || []);"
)

# 3. Add handleProcessRefund and renderRefundCard
new_funcs = """
  const handleProcessRefund = async (id) => {
    try {
      await api.post(`/admin/refunds/${id}/process`);
      showCustomAlert('Success', 'Refund processed successfully');
      fetchData();
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to process refund');
    }
  };

  const renderRefundCard = ({ item }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Booking ID: {item._id.slice(-6).toUpperCase()}</Text>
            <Text style={styles.cardSubtitle}>Amount: ₹{item.refundAmount || 0}</Text>
            <Text style={styles.cardSubtitle}>User: {item.user?.name || item.user?.email}</Text>
            <Text style={styles.cardSubtitle}>Turf: {item.turf?.name}</Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: 'rgba(255,152,0,0.15)' }]}>
             <Text style={[styles.roleText, { color: '#FF9800' }]}>PENDING</Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
           <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.primaryAlpha20, borderColor: Colors.primary }]} onPress={() => handleProcessRefund(item._id)}>
             <Icon name="check-circle-outline" size={12} color={Colors.primary} />
             <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Process Refund</Text>
           </TouchableOpacity>
        </View>
      </View>
    );
  };
"""

code = code.replace("const renderWaitlistCard = ({ item }) => {", new_funcs + "\n  const renderWaitlistCard = ({ item }) => {")

# 4. Change Tabs to Sidebar layout
tabs_code = """
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'owners' && styles.tabActive]}
          onPress={() => setActiveTab('owners')}
        >
          <Text style={[styles.tabText, activeTab === 'owners' && styles.tabTextActive]}>Owners ({owners.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'turfs' && styles.tabActive]}
          onPress={() => setActiveTab('turfs')}
        >
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={[styles.tabText, activeTab === 'turfs' && styles.tabTextActive]}>Turfs ({turfs.length})</Text>
            {turfs.filter(t => t.pendingPlatformFee > 0 && t.pendingPaymentId).length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{turfs.filter(t => t.pendingPlatformFee > 0 && t.pendingPaymentId).length}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'users' && styles.tabActive]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>Users ({users.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'waitlist' && styles.tabActive]}
          onPress={() => setActiveTab('waitlist')}
        >
          <Text style={[styles.tabText, activeTab === 'waitlist' && styles.tabTextActive]}>Waitlist ({waitlist.length})</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
"""

sidebar_layout = """
      <View style={styles.mainLayout}>
        {/* Sidebar */}
        <View style={styles.sidebar}>
          <TouchableOpacity style={[styles.sidebarItem, activeTab === 'turfs' && styles.sidebarItemActive]} onPress={() => setActiveTab('turfs')}>
            <Icon name="soccer-field" size={20} color={activeTab === 'turfs' ? Colors.primary : Colors.textTertiary} />
            <Text style={[styles.sidebarText, activeTab === 'turfs' && styles.sidebarTextActive]}>Turfs</Text>
            {turfs.filter(t => t.pendingPlatformFee > 0 && t.pendingPaymentId).length > 0 && (
              <View style={styles.sidebarBadge}><Text style={styles.sidebarBadgeText}>{turfs.filter(t => t.pendingPlatformFee > 0 && t.pendingPaymentId).length}</Text></View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.sidebarItem, activeTab === 'owners' && styles.sidebarItemActive]} onPress={() => setActiveTab('owners')}>
            <Icon name="briefcase-account" size={20} color={activeTab === 'owners' ? Colors.primary : Colors.textTertiary} />
            <Text style={[styles.sidebarText, activeTab === 'owners' && styles.sidebarTextActive]}>Owners</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.sidebarItem, activeTab === 'users' && styles.sidebarItemActive]} onPress={() => setActiveTab('users')}>
            <Icon name="account-group" size={20} color={activeTab === 'users' ? Colors.primary : Colors.textTertiary} />
            <Text style={[styles.sidebarText, activeTab === 'users' && styles.sidebarTextActive]}>Users</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.sidebarItem, activeTab === 'refunds' && styles.sidebarItemActive]} onPress={() => setActiveTab('refunds')}>
            <Icon name="cash-refund" size={20} color={activeTab === 'refunds' ? Colors.primary : Colors.textTertiary} />
            <Text style={[styles.sidebarText, activeTab === 'refunds' && styles.sidebarTextActive]}>Refunds</Text>
            {refunds.length > 0 && (
              <View style={styles.sidebarBadge}><Text style={styles.sidebarBadgeText}>{refunds.length}</Text></View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.sidebarItem, activeTab === 'waitlist' && styles.sidebarItemActive]} onPress={() => setActiveTab('waitlist')}>
            <Icon name="clipboard-list-outline" size={20} color={activeTab === 'waitlist' ? Colors.primary : Colors.textTertiary} />
            <Text style={[styles.sidebarText, activeTab === 'waitlist' && styles.sidebarTextActive]}>Waitlist</Text>
          </TouchableOpacity>
        </View>

        {/* Content Area */}
        <View style={styles.contentArea}>
"""

code = code.replace(tabs_code, sidebar_layout)

list_code = """
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : activeTab === 'owners' ? (
        <FlatList
          data={owners}
          keyExtractor={item => item._id}
          renderItem={renderOwnerCard}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No owners found.</Text>}
        />
      ) : activeTab === 'turfs' ? (
        <FlatList
          data={turfs}
          keyExtractor={item => item._id}
          renderItem={renderTurfCard}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No turfs found.</Text>}
        />
      ) : activeTab === 'users' ? (
        <FlatList
          data={users}
          keyExtractor={item => item._id}
          renderItem={renderUserCard}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No users found.</Text>}
        />
      ) : (
        <FlatList
          data={waitlist}
          keyExtractor={item => item._id}
          renderItem={renderWaitlistCard}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No waitlist entries found.</Text>}
        />
      )}
    </View>
"""

new_list_code = """
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : activeTab === 'owners' ? (
        <FlatList
          data={owners}
          keyExtractor={item => item._id}
          renderItem={renderOwnerCard}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No owners found.</Text>}
        />
      ) : activeTab === 'turfs' ? (
        <FlatList
          data={turfs}
          keyExtractor={item => item._id}
          renderItem={renderTurfCard}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No turfs found.</Text>}
        />
      ) : activeTab === 'users' ? (
        <FlatList
          data={users}
          keyExtractor={item => item._id}
          renderItem={renderUserCard}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No users found.</Text>}
        />
      ) : activeTab === 'refunds' ? (
        <FlatList
          data={refunds}
          keyExtractor={item => item._id}
          renderItem={renderRefundCard}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No pending refunds.</Text>}
        />
      ) : (
        <FlatList
          data={waitlist}
          keyExtractor={item => item._id}
          renderItem={renderWaitlistCard}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No waitlist entries found.</Text>}
        />
      )}
        </View>
      </View>
    </View>
"""

code = code.replace(list_code, new_list_code)

styles_patch = """
  // ── Layout ──────────────────────────────────────────────────────────────
  mainLayout: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 85, backgroundColor: Colors.backgroundCard, borderRightWidth: 1, borderRightColor: Colors.border, paddingVertical: Spacing.md },
  sidebarItem: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderLeftWidth: 3, borderLeftColor: 'transparent', position: 'relative' },
  sidebarItemActive: { borderLeftColor: Colors.primary, backgroundColor: Colors.primaryAlpha20 },
  sidebarText: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary, marginTop: 4 },
  sidebarTextActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },
  sidebarBadge: { position: 'absolute', top: 6, right: 12, backgroundColor: Colors.error, borderRadius: 10, paddingHorizontal: 4, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  sidebarBadgeText: { color: '#FFF', fontSize: 8, fontFamily: Typography.fontFamily.bold },
  contentArea: { flex: 1 },
"""

code = code.replace("  // ── Tabs ──────────────────────────────────────────────────────────────", styles_patch + "\n  // ── Tabs ──────────────────────────────────────────────────────────────")

with open('/Users/apple/RoughTurf/TurfMobile/mobile/src/features/admin/screens/AdminDashboardScreen.js', 'w') as f:
    f.write(code)
