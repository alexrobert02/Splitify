import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import type { GroupDto, UserDto, ReceiptDto } from '@/types';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [receipts, setReceipts] = useState<ReceiptDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'members' | 'receipts'>('receipts');
  const [addModal, setAddModal] = useState(false);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [g, r] = await Promise.all([
          api.groups.get(id),
          api.receipts.listByGroup(id),
        ]);
        if (cancelled) return;
        setGroup(g);
        setReceipts(r.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()));
      } catch (e: any) {
        if (!cancelled) Alert.alert('Error', e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]));

  const handleAddMember = async () => {
    if (!email.trim() || !id) return;
    setAdding(true);
    try {
      const updated = await api.groups.addMember(id, email.trim().toLowerCase());
      setGroup(updated);
      setAddModal(false);
      setEmail('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = (member: UserDto) => {
    if (!id) return;
    if (member.id === user?.id) {
      Alert.alert('Cannot remove yourself', 'You cannot remove yourself from the group');
      return;
    }
    Alert.alert('Remove member', `Remove ${member.name} from this group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
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

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!group) return null;

  const isOwner = group.createdById === user?.id;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{group.name}</Text>
          {group.description ? <Text style={styles.headerSub} numberOfLines={1}>{group.description}</Text> : null}
        </View>
        {isOwner && (
          <TouchableOpacity style={styles.addMemberBtn} onPress={() => setAddModal(true)}>
            <Ionicons name="person-add" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{group.members?.length ?? 0}</Text>
          <Text style={styles.statLabel}>Members</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{receipts.length}</Text>
          <Text style={styles.statLabel}>Receipts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {new Date(group.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </Text>
          <Text style={styles.statLabel}>Created</Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, tab === 'receipts' && styles.tabActive]} onPress={() => setTab('receipts')}>
          <Text style={[styles.tabText, tab === 'receipts' && styles.tabTextActive]}>Receipts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'members' && styles.tabActive]} onPress={() => setTab('members')}>
          <Text style={[styles.tabText, tab === 'members' && styles.tabTextActive]}>Members</Text>
        </TouchableOpacity>
      </View>

      {tab === 'members' ? (
        <ScrollView contentContainerStyle={styles.list}>
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
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {receipts.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyText}>No receipts in this group yet</Text>
              <TouchableOpacity
                style={styles.scanGroupBtn}
                onPress={() => router.push(`/receipt/scan?groupId=${id}` as any)}
              >
                <Ionicons name="camera" size={16} color="#fff" />
                <Text style={styles.scanGroupBtnText}>Scan Receipt</Text>
              </TouchableOpacity>
            </View>
          ) : (
            receipts.map(r => (
              <TouchableOpacity
                key={r.id}
                style={styles.receiptCard}
                onPress={() => router.push(`/receipt/${r.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.receiptLeft}>
                  <View style={[styles.receiptIcon, { backgroundColor: Colors.primaryLight }]}>
                    <Ionicons name="receipt" size={18} color={Colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.receiptTitle}>{r.title || 'Untitled'}</Text>
                    <Text style={styles.receiptDate}>
                      {new Date(r.scannedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' · '}{r.scannedByName}
                    </Text>
                  </View>
                </View>
                <Text style={styles.receiptAmt}>
                  {r.currency ?? 'RON'} {Number(r.totalAmount).toFixed(2)}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {tab === 'receipts' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push(`/receipt/scan?groupId=${id}` as any)}
        >
          <Ionicons name="camera" size={22} color="#fff" />
        </TouchableOpacity>
      )}

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
                style={[styles.saveBtn, (adding || !email.trim()) && styles.btnDisabled]}
                onPress={handleAddMember}
                disabled={adding || !email.trim()}
              >
                {adding ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Add</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  headerSub: { fontSize: 12, color: Colors.textSecondary },
  addMemberBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.divider },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  memberCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  memberAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  memberName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  memberEmail: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  memberRight: { alignItems: 'flex-end', gap: 6 },
  roleBadge: { backgroundColor: Colors.background, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  ownerBadge: { backgroundColor: Colors.primaryLight },
  roleText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  ownerText: { color: Colors.primary },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  scanGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
  },
  scanGroupBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  receiptCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  receiptLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  receiptIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  receiptTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  receiptDate: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  receiptAmt: { fontSize: 14, fontWeight: '700', color: Colors.text },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  modalSub: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnDisabled: { opacity: 0.5 },
});
