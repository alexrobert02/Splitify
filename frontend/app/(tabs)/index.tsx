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
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import type { GroupDto, UserDto, ReceiptDto } from '@/types';
import { CurrencyPickerModal, CurrencySelector } from '@/components/CurrencyPickerModal';

type ActiveView = { type: 'picker' } | { type: 'solo' } | { type: 'group'; id: string };

// ─── Shared components ────────────────────────────────────────────────────────

function LoadingView() {
  return (
    <SafeAreaView style={styles.centered}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </SafeAreaView>
  );
}

const STATUS_COLOR: Record<string, string> = {
  PENDING_REVIEW:     '#F59E0B',
  PENDING_ASSIGNMENT: '#3B82F6',
  PENDING_PAYMENT:    '#EF4444',
  FINALIZED:          '#10B981',
};

function ReceiptCard({ receipt, onDelete }: { receipt: ReceiptDto; onDelete: () => void }) {
  const date = new Date(receipt.scannedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const destination = receipt.status === 'PENDING_REVIEW'
    ? `/receipt/review?id=${receipt.id}`
    : `/receipt/${receipt.id}`;
  const statusColor = STATUS_COLOR[receipt.status] ?? STATUS_COLOR.FINALIZED;
  return (
    <TouchableOpacity
      style={styles.receiptCard}
      onPress={() => router.push(destination as any)}
      activeOpacity={0.7}
    >
      <View style={[styles.statusStrip, { backgroundColor: statusColor }]} />
      <View style={styles.receiptLeft}>
        <View style={[styles.receiptIcon, { backgroundColor: Colors.primaryLight }]}>
          <Ionicons name="receipt" size={18} color={Colors.primary} />
        </View>
        <View style={styles.receiptInfo}>
          <Text style={styles.receiptTitle} numberOfLines={1}>{receipt.title || 'Untitled'}</Text>
          <Text style={styles.receiptDate}>{date}{receipt.scannedByName ? ` · ${receipt.scannedByName}` : ''}</Text>
        </View>
      </View>
      <View style={styles.receiptRight}>
        <Text style={styles.receiptAmt}>{receipt.currency ?? 'RON'} {Number(receipt.totalAmount).toFixed(2)}</Text>
        <TouchableOpacity
          hitSlop={8}
          onPress={() =>
            Alert.alert('Delete receipt', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: onDelete },
            ])
          }
        >
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
        </TouchableOpacity>
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

// ─── Manual receipt creation modal ───────────────────────────────────────────

const CATEGORIES = [
  { value: 'GROCERIES',     label: 'Groceries',     icon: 'basket-outline',              color: '#10B981' },
  { value: 'DINING',        label: 'Dining',         icon: 'restaurant-outline',          color: '#F97316' },
  { value: 'TRANSPORT',     label: 'Transport',      icon: 'car-outline',                 color: '#3B82F6' },
  { value: 'ENTERTAINMENT', label: 'Fun',            icon: 'film-outline',                color: '#A855F7' },
  { value: 'SHOPPING',      label: 'Shopping',       icon: 'bag-handle-outline',          color: '#EC4899' },
  { value: 'UTILITIES',     label: 'Utilities',      icon: 'flash-outline',               color: '#F59E0B' },
  { value: 'HEALTH',        label: 'Health',         icon: 'medkit-outline',              color: '#EF4444' },
  { value: 'OTHER',         label: 'Other',          icon: 'ellipsis-horizontal-outline', color: '#6B7280' },
] as const;
type CategoryValue = typeof CATEGORIES[number]['value'];

function CreateManualModal({
  visible,
  groupId,
  onClose,
}: {
  visible: boolean;
  groupId?: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CategoryValue | null>(null);
  const [currency, setCurrency] = useState<string>(user?.preferredCurrency ?? 'RON');
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [creating, setCreating] = useState(false);

  const reset = () => { setTitle(''); setCategory(null); setCurrency(user?.preferredCurrency ?? 'RON'); };

  const handleCreate = async () => {
    if (!title.trim() || !category) return;
    setCreating(true);
    try {
      const receipt = await api.receipts.createReceipt(title.trim(), groupId, category, currency);
      onClose();
      reset();
      router.push(`/receipt/review?id=${receipt.id}` as any);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>New Receipt</Text>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Dinner at Pizza Place"
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
            autoFocus
          />
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={{ gap: 8 }}>
            {CATEGORIES.map(cat => {
              const active = category === cat.value;
              return (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.categoryPill, active && { borderColor: cat.color, backgroundColor: cat.color + '18' }]}
                  onPress={() => setCategory(cat.value)}
                >
                  <Ionicons name={cat.icon as any} size={14} color={active ? cat.color : Colors.textMuted} />
                  <Text style={[styles.categoryPillText, active && { color: cat.color }]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <CurrencySelector
            label="Currency"
            value={currency}
            onPress={() => setCurrencyPickerVisible(true)}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { onClose(); reset(); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, (creating || !title.trim() || !category) && styles.btnDisabled]}
              onPress={handleCreate}
              disabled={creating || !title.trim() || !category}
            >
              {creating
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.primaryBtnText}>Create & Add Items</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
      <CurrencyPickerModal
        visible={currencyPickerVisible}
        selected={currency}
        onSelect={setCurrency}
        onClose={() => setCurrencyPickerVisible(false)}
      />
    </Modal>
  );
}

// ─── Solo (Personal) View ─────────────────────────────────────────────────────

function SoloView({ onBack }: { onBack: () => void }) {
  const [receipts, setReceipts] = useState<ReceiptDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);

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

      <FlatList
        data={receipts}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyTitle}>No personal receipts</Text>
            <Text style={styles.emptySub}>Tap the camera button to scan one</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ReceiptCard receipt={item} onDelete={() => handleDelete(item.id)} />
        )}
      />

      <View style={styles.fabRow}>
        <TouchableOpacity style={styles.fabSecondary} onPress={() => setManualVisible(true)}>
          <Ionicons name="add-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/receipt/scan' as any)}>
          <Ionicons name="camera" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <CreateManualModal visible={manualVisible} onClose={() => setManualVisible(false)} />
    </SafeAreaView>
  );
}

// ─── Group View ───────────────────────────────────────────────────────────────

function GroupView({ id, onBack }: { id: string; onBack: () => void }) {
  const { user } = useAuth();
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [receipts, setReceipts] = useState<ReceiptDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [membersVisible, setMembersVisible] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);
  const [filterUnpaid, setFilterUnpaid] = useState(false);

  const loadData = useCallback(async (isRefresh = false, unpaid = false) => {
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

  const handleDeleteReceipt = (receiptId: string) => {
    Alert.alert('Delete receipt', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.receipts.delete(receiptId);
            setReceipts(prev => prev.filter(r => r.id !== receiptId));
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
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

      <TouchableOpacity
        style={[styles.filterChip, filterUnpaid && styles.filterChipActive]}
        onPress={() => setFilterUnpaid(v => !v)}
      >
        <Ionicons name="time-outline" size={14} color={filterUnpaid ? '#fff' : Colors.textSecondary} />
        <Text style={[styles.filterChipText, filterUnpaid && styles.filterChipTextActive]}>My unpaid</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadData(true, filterUnpaid); }} tintColor={Colors.primary} />}
      >
        {receipts.length === 0 && !filterUnpaid ? (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyText}>No receipts in this group yet</Text>
            <TouchableOpacity style={styles.scanGroupBtn} onPress={() => router.push(`/receipt/scan?groupId=${id}` as any)}>
              <Ionicons name="camera" size={16} color="#fff" />
              <Text style={styles.scanGroupBtnText}>Scan Receipt</Text>
            </TouchableOpacity>
          </View>
        ) : receipts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyText}>You&#39;re all settled up!</Text>
          </View>
        ) : (
          receipts.map(r => (
            <ReceiptCard key={r.id} receipt={r} onDelete={() => handleDeleteReceipt(r.id)} />
          ))
        )}
      </ScrollView>

      <View style={styles.fabRow}>
        <TouchableOpacity style={styles.fabSecondary} onPress={() => setManualVisible(true)}>
          <Ionicons name="add-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab} onPress={() => router.push(`/receipt/scan?groupId=${id}` as any)}>
          <Ionicons name="camera" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <CreateManualModal visible={manualVisible} groupId={id} onClose={() => setManualVisible(false)} />

      {/* Three-dots action menu */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuSheet}>
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
  menuSheet: { position: 'absolute', top: 60, right: 16, backgroundColor: Colors.surface, borderRadius: 14, paddingVertical: 6, minWidth: 180, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8 },
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
  statusStrip: { position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, borderRadius: 2 },
  receiptInfo: { flex: 1 },
  receiptTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  receiptDate: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  receiptRight: { alignItems: 'flex-end', gap: 6 },
  receiptAmt: { fontSize: 14, fontWeight: '700', color: Colors.text },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textSecondary },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
  scanGroupBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4 },
  scanGroupBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  fabRow: { position: 'absolute', bottom: 24, right: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  fab: { backgroundColor: Colors.primary, borderRadius: 16, width: 56, height: 56, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  fabSecondary: { backgroundColor: Colors.surface, borderRadius: 16, width: 48, height: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.primary, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },

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
  categoryScroll: { marginBottom: 16 },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  categoryPillText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
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
