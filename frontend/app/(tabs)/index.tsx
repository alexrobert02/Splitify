import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  BackHandler,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { CATEGORY_CONFIG } from '@/constants/categories';
import type { GroupDto, UserDto, ReceiptDto } from '@/types';

type ActiveView = { type: 'picker' } | { type: 'solo' } | { type: 'group'; id: string };

// ─── Shared components ────────────────────────────────────────────────────────

function LoadingView() {
  return (
    <SafeAreaView style={styles.centered}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </SafeAreaView>
  );
}


const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING_REVIEW:     { label: 'Review items',   color: '#F59E0B' },
  PENDING_ASSIGNMENT: { label: 'Assign items',   color: '#3B82F6' },
  PENDING_PAYMENT:    { label: 'Pending',        color: '#EF4444' },
  FINALIZED:          { label: 'Finalized',      color: '#10B981' },
};

const STATUS_FILTER_OPTIONS: { key: string | null; label: string }[] = [
  { key: null,                 label: 'All statuses' },
  { key: 'PENDING_REVIEW',     label: 'Review items' },
  { key: 'PENDING_ASSIGNMENT', label: 'Assign items' },
  { key: 'PENDING_PAYMENT',    label: 'Pending' },
  { key: 'FINALIZED',          label: 'Finalized' },
];

function StatusFilterButton({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const cfg = value ? STATUS_CONFIG[value] : null;
  const label = cfg ? cfg.label : 'All statuses';
  const color = cfg?.color ?? Colors.textSecondary;
  // header (60) + groupFilters bar (10 padding + ~32 chip + 2 padding = 44)
  const dropdownTop = insets.top + 60 + 44;

  return (
    <>
      <TouchableOpacity
        style={[styles.filterChip, { marginHorizontal: 0, marginTop: 0, marginBottom: 0 }, value !== null && { borderColor: color, backgroundColor: color + '18' }]}
        onPress={() => setOpen(true)}
      >
        <Ionicons name="funnel-outline" size={13} color={value !== null ? color : Colors.textSecondary} />
        <Text style={[styles.filterChipText, value !== null && { color, fontWeight: '700' }]}>{label}</Text>
        <Ionicons name="chevron-down" size={13} color={value !== null ? color : Colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={[styles.dropdownSheet, { top: dropdownTop }]}>
          <Text style={styles.dropdownTitle}>Filter by status</Text>
          {STATUS_FILTER_OPTIONS.map(opt => {
            const optCfg = opt.key ? STATUS_CONFIG[opt.key] : null;
            const optColor = optCfg?.color ?? Colors.text;
            const selected = value === opt.key;
            return (
              <TouchableOpacity
                key={String(opt.key)}
                style={[styles.dropdownItem, selected && { backgroundColor: (optCfg?.color ?? Colors.primary) + '12' }]}
                onPress={() => { onChange(opt.key); setOpen(false); }}
              >
                {opt.key ? (
                  <View style={[styles.dropdownDot, { backgroundColor: optColor }]} />
                ) : (
                  <Ionicons name="list-outline" size={14} color={Colors.textSecondary} style={{ width: 14 }} />
                )}
                <Text style={[styles.dropdownItemText, selected && { color: optColor, fontWeight: '700' }]}>
                  {opt.label}
                </Text>
                {selected && <Ionicons name="checkmark" size={16} color={optColor} style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </Modal>
    </>
  );
}

function ReceiptCard({ receipt }: { receipt: ReceiptDto }) {
  const date = new Date(receipt.scannedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const destination = receipt.status === 'PENDING_REVIEW'
    ? `/receipt/review?id=${receipt.id}`
    : `/receipt/${receipt.id}`;
  const catCfg = CATEGORY_CONFIG[receipt.category] ?? CATEGORY_CONFIG.OTHER;
  const statusCfg = STATUS_CONFIG[receipt.status] ?? STATUS_CONFIG.FINALIZED;
  return (
    <TouchableOpacity
      style={styles.receiptCard}
      onPress={() => router.push(destination as any)}
      activeOpacity={0.7}
    >
      <View style={styles.receiptLeft}>
        <View style={[styles.receiptIcon, { backgroundColor: catCfg.bgColor }]}>
          <Ionicons name={catCfg.icon as any} size={18} color={catCfg.color} />
        </View>
        <View style={styles.receiptInfo}>
          <Text style={styles.receiptTitle} numberOfLines={1}>{receipt.title || 'Untitled'}</Text>
          <View style={styles.receiptMeta}>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '18' }]}>
              <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.receiptRight}>
        <Text style={styles.receiptAmt}>{receipt.currency ?? 'RON'} {Number(receipt.totalAmount).toFixed(2)}</Text>
        <Text style={styles.receiptDate}>{date}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function GroupsTab() {
  const [active, setActive] = useState<ActiveView>({ type: 'picker' });

  useFocusEffect(
    useCallback(() => {
      if (active.type === 'picker') return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setActive({ type: 'picker' });
        return true;
      });
      return () => sub.remove();
    }, [active])
  );

  if (active.type === 'solo') return <SoloView onBack={() => setActive({ type: 'picker' })} />;
  if (active.type === 'group') return <GroupView id={active.id} onBack={() => setActive({ type: 'picker' })} />;
  return (
    <PickerView
      onSelectSolo={() => setActive({ type: 'solo' })}
      onSelectGroup={(id) => setActive({ type: 'group', id })}
    />
  );
}

// ─── Picker ───────────────────────────────────────────────────────────────────

function PickerView({ onSelectSolo, onSelectGroup }: { onSelectSolo: () => void; onSelectGroup: (id: string) => void }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      setGroups(await api.groups.list());
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { void load(); }, []));

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const g = await api.groups.create(newName.trim(), newDesc.trim() || undefined);
      setGroups((prev) => [g, ...prev]);
      setModalVisible(false);
      setNewName('');
      setNewDesc('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.groups.delete(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.pickerHeader}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]}</Text>
          <Text style={styles.heading}>Groups</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <TouchableOpacity style={styles.soloCard} onPress={onSelectSolo} activeOpacity={0.75}>
            <View style={styles.soloAvatar}>
              <Ionicons name="person" size={22} color={Colors.primary} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Personal</Text>
              <Text style={styles.cardSub}>Receipts just for you</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptySub}>Create a group to split bills with friends</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => onSelectGroup(item.id)} activeOpacity={0.75}>
            <View style={styles.cardLeft}>
              <View style={styles.groupAvatar}>
                <Text style={styles.groupAvatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {item.description ? <Text style={styles.cardSub} numberOfLines={1}>{item.description}</Text> : null}
                <Text style={styles.memberCount}>
                  <Ionicons name="person" size={11} /> {item.members?.length ?? 0} member{(item.members?.length ?? 0) !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              hitSlop={8}
              onPress={() => Alert.alert('Delete group', `Delete "${item.name}"?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item.id) },
              ])}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.error} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Group</Text>
            <Text style={styles.label}>Group name</Text>
            <TextInput style={styles.input} placeholder="Friends, Family, Work…" placeholderTextColor={Colors.textMuted} value={newName} onChangeText={setNewName} />
            <Text style={styles.label}>Description (optional)</Text>
            <TextInput style={styles.input} placeholder="What's this group for?" placeholderTextColor={Colors.textMuted} value={newDesc} onChangeText={setNewDesc} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, creating && styles.btnDisabled]} onPress={handleCreate} disabled={creating}>
                {creating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── FAB context menu ────────────────────────────────────────────────────────

function FabMenu({
  visible,
  onClose,
  onScan,
  onManual,
}: {
  visible: boolean;
  onClose: () => void;
  onScan: () => void;
  onManual: () => void;
}) {
  const tabBarHeight = useBottomTabBarHeight();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.fabMenuOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.fabMenuSheet, { bottom: tabBarHeight + 24 }]}>
          <TouchableOpacity style={styles.fabMenuItem} onPress={onManual}>
            <Ionicons name="create-outline" size={20} color={Colors.text} />
            <Text style={styles.fabMenuItemText}>Add manually</Text>
          </TouchableOpacity>
          <View style={styles.fabMenuDivider} />
          <TouchableOpacity style={styles.fabMenuItem} onPress={onScan}>
            <Ionicons name="camera-outline" size={20} color={Colors.text} />
            <Text style={styles.fabMenuItemText}>Scan receipt</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Solo (Personal) View ─────────────────────────────────────────────────────

function SoloView({ onBack }: { onBack: () => void }) {
  const [receipts, setReceipts] = useState<ReceiptDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fabMenuVisible, setFabMenuVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const load = async () => {
    try {
      const all = await api.receipts.list();
      setReceipts(all.filter((r) => !r.groupId).sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { void load(); }, []));

  const handleDelete = async (id: string) => {
    try {
      await api.receipts.delete(id);
      setReceipts((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={styles.detailHeaderTitle}>Personal</Text>
          <Text style={styles.detailHeaderSub}>Your receipts</Text>
        </View>
      </View>

      <View style={styles.groupFilters}>
        <StatusFilterButton value={statusFilter} onChange={setStatusFilter} />
      </View>

      <FlatList
        data={statusFilter ? receipts.filter(r => r.status === statusFilter) : receipts}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyTitle}>{statusFilter ? 'No matching receipts' : 'No personal receipts'}</Text>
            <Text style={styles.emptySub}>{statusFilter ? 'Try a different filter' : 'Tap the camera button to scan one'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ReceiptCard receipt={item} />
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setFabMenuVisible(true)}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      <FabMenu
        visible={fabMenuVisible}
        onClose={() => setFabMenuVisible(false)}
        onScan={() => { setFabMenuVisible(false); router.push('/receipt/scan' as any); }}
        onManual={() => { setFabMenuVisible(false); router.push('/receipt/new' as any); }}
      />
    </SafeAreaView>
  );
}

// ─── Group View ───────────────────────────────────────────────────────────────

function GroupView({ id, onBack }: { id: string; onBack: () => void }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [receipts, setReceipts] = useState<ReceiptDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptsLoading, setReceiptsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [membersVisible, setMembersVisible] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [fabMenuVisible, setFabMenuVisible] = useState(false);
  const [filterUnpaid, setFilterUnpaid] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false, unpaid = false) => {
    if (!isRefresh) setReceiptsLoading(true);
    try {
      const [g, r] = await Promise.all([
        api.groups.get(id),
        api.receipts.listByGroup(id, unpaid),
      ]);
      setGroup(g);
      setReceipts(r.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setReceiptsLoading(false);
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    void loadData(false, filterUnpaid);
  }, [loadData, filterUnpaid]));

  const handleAddMember = async () => {
    if (!email.trim()) return;
    setAdding(true);
    try {
      setGroup(await api.groups.addMember(id, email.trim().toLowerCase()));
      setAddModal(false);
      setEmail('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = (member: UserDto) => {
    if (member.id === user?.id) {
      Alert.alert('Cannot remove yourself', 'You cannot remove yourself from the group');
      return;
    }
    Alert.alert('Remove member', `Remove ${member.name} from this group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await api.groups.removeMember(id, member.id);
            setGroup(prev => prev ? { ...prev, members: prev.members.filter(m => m.id !== member.id) } : prev);
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleDeleteReceipt = async (receiptId: string) => {
    try {
      await api.receipts.delete(receiptId);
      setReceipts(prev => prev.filter(r => r.id !== receiptId));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  if (loading) return <LoadingView />;
  if (!group) return null;

  const isOwner = group.createdById === user?.id;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={styles.detailHeaderTitle} numberOfLines={1}>{group.name}</Text>
          {group.description ? <Text style={styles.detailHeaderSub} numberOfLines={1}>{group.description}</Text> : null}
        </View>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuVisible(true)}>
          <Ionicons name="ellipsis-vertical" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.groupFilters}>
        <StatusFilterButton
          value={statusFilter}
          onChange={v => { setStatusFilter(v); if (v !== null) setFilterUnpaid(false); }}
        />
        <TouchableOpacity
          style={[styles.filterChip, filterUnpaid && styles.filterChipActive, { marginHorizontal: 0, marginTop: 0 }]}
          onPress={() => { setStatusFilter(null); setReceiptsLoading(true); setFilterUnpaid(v => !v); }}
        >
          <Ionicons name="time-outline" size={14} color={filterUnpaid ? '#fff' : Colors.textSecondary} />
          <Text style={[styles.filterChipText, filterUnpaid && styles.filterChipTextActive]}>My unpaid</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadData(true, filterUnpaid); }} tintColor={Colors.primary} />}
      >
        {receiptsLoading && !refreshing ? (
          <View style={styles.listSpinner}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (() => {
          const filtered = statusFilter ? receipts.filter(r => r.status === statusFilter) : receipts;
          if (filtered.length === 0 && !filterUnpaid && !statusFilter) return (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyText}>No receipts in this group yet</Text>
              <TouchableOpacity style={styles.scanGroupBtn} onPress={() => router.push(`/receipt/scan?groupId=${id}` as any)}>
                <Ionicons name="camera" size={16} color="#fff" />
                <Text style={styles.scanGroupBtnText}>Scan Receipt</Text>
              </TouchableOpacity>
            </View>
          );
          if (filtered.length === 0 && filterUnpaid && !statusFilter) return (
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyText}>You&#39;re all settled up!</Text>
            </View>
          );
          if (filtered.length === 0) return (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyText}>No matching receipts</Text>
            </View>
          );
          return filtered.map(r => (
            <ReceiptCard key={r.id} receipt={r} />
          ));
        })()}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setFabMenuVisible(true)}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      <FabMenu
        visible={fabMenuVisible}
        onClose={() => setFabMenuVisible(false)}
        onScan={() => { setFabMenuVisible(false); router.push(`/receipt/scan?groupId=${id}` as any); }}
        onManual={() => { setFabMenuVisible(false); router.push(`/receipt/new?groupId=${id}` as any); }}
      />

      {/* Three-dots action menu */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuSheet, { top: insets.top + 60 }]}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setMembersVisible(true); }}>
              <Ionicons name="people-outline" size={20} color={Colors.text} />
              <Text style={styles.menuItemText}>View Members</Text>
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setAddModal(true); }}>
                <Ionicons name="person-add-outline" size={20} color={Colors.text} />
                <Text style={styles.menuItemText}>Add Member</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Members bottom sheet */}
      <Modal visible={membersVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMembersVisible(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Members</Text>
            {group.members?.map(m => (
              <View key={m.id} style={styles.memberCard}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{m.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{m.name}{m.id === user?.id ? ' (you)' : ''}</Text>
                  <Text style={styles.memberEmail}>{m.email}</Text>
                </View>
                <View style={styles.memberRight}>
                  <View style={[styles.roleBadge, m.id === group.createdById && styles.ownerBadge]}>
                    <Text style={[styles.roleText, m.id === group.createdById && styles.ownerText]}>
                      {m.id === group.createdById ? 'Owner' : 'Member'}
                    </Text>
                  </View>
                  {isOwner && m.id !== user?.id && (
                    <TouchableOpacity onPress={() => handleRemoveMember(m)} hitSlop={8}>
                      <Ionicons name="remove-circle-outline" size={20} color={Colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add member bottom sheet */}
      <Modal visible={addModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Member</Text>
            <Text style={styles.modalSub}>Invite someone by their email address</Text>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              placeholder="friend@example.com"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setAddModal(false); setEmail(''); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, (adding || !email.trim()) && styles.btnDisabled]}
                onPress={handleAddMember}
                disabled={adding || !email.trim()}
              >
                {adding ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Add</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  greeting: { fontSize: 14, color: Colors.textSecondary, marginBottom: 2 },
  heading: { fontSize: 24, fontWeight: '800', color: Colors.text },
  addBtn: { backgroundColor: Colors.primary, borderRadius: 12, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },

  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  detailHeaderTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  detailHeaderSub: { fontSize: 12, color: Colors.textSecondary },
  menuBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  menuSheet: { position: 'absolute', right: 16, backgroundColor: Colors.surface, borderRadius: 14, paddingVertical: 6, minWidth: 180, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  menuItemText: { fontSize: 15, fontWeight: '600', color: Colors.text },

  list: { padding: 16, gap: 10, paddingBottom: 80 },

  soloCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  soloAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },

  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  groupAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  groupAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  memberCount: { fontSize: 11, color: Colors.textMuted, marginTop: 3 },

  receiptCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  receiptLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  receiptIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  receiptInfo: { flex: 1 },
  receiptTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  receiptMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  receiptDate: { fontSize: 11, color: Colors.textSecondary },
  receiptRight: { alignItems: 'flex-end', gap: 2 },
  receiptAmt: { fontSize: 14, fontWeight: '700', color: Colors.text },

  listSpinner: { alignItems: 'center', paddingTop: 80 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textSecondary },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
  scanGroupBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4 },
  scanGroupBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  fab: { position: 'absolute', bottom: 24, right: 20, backgroundColor: Colors.primary, borderRadius: 16, width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
  fabMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  fabMenuSheet: { position: 'absolute', right: 20, backgroundColor: Colors.surface, borderRadius: 14, paddingVertical: 6, minWidth: 190, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 },
  fabMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  fabMenuItemText: { fontSize: 15, fontWeight: '600', color: Colors.text },
  fabMenuDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 8 },

  memberCard: { backgroundColor: Colors.background, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  memberAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  memberName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  memberEmail: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  memberRight: { alignItems: 'flex-end', gap: 6 },
  roleBadge: { backgroundColor: Colors.background, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  ownerBadge: { backgroundColor: Colors.primaryLight },
  roleText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  ownerText: { color: Colors.primary },

  groupFilters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterChipTextActive: { color: '#fff' },
  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  dropdownSheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  dropdownTitle: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingVertical: 8 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, marginHorizontal: 6 },
  dropdownDot: { width: 8, height: 8, borderRadius: 4 },
  dropdownItemText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  modalSub: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.background, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  primaryBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnDisabled: { opacity: 0.6 },
});
