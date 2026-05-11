import { useEffect, useState, useCallback } from 'react';
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
  Platform,
  Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import type {
  ReceiptDto,
  ReceiptItemDto,
  ReceiptSummaryDto,
  GroupMemberDto,
  SplitType,
  AssigneeEntry,
} from '@/types';

// ─── Assign Item Modal ────────────────────────────────────────────────────────
function AssignModal({
  visible,
  item,
  members,
  receiptId,
  currency,
  onClose,
  onDone,
}: {
  visible: boolean;
  item: ReceiptItemDto | null;
  members: GroupMemberDto[];
  receiptId: string;
  currency: string;
  onClose: () => void;
  onDone: (updated: ReceiptItemDto) => void;
}) {
  const { user } = useAuth();
  const [splitType, setSplitType] = useState<SplitType>('EQUAL');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && item) {
      const existing = new Set(item.assignments?.map(a => a.userId) ?? []);
      setSelected(existing);
      const vals: Record<string, string> = {};
      item.assignments?.forEach(a => { if (a.splitValue) vals[a.userId] = String(a.splitValue); });
      setCustomValues(vals);
      setSplitType(item.assignments?.[0]?.splitType ?? 'EQUAL');
    }
  }, [visible, item]);

  const toggleMember = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!item || selected.size === 0) return;
    setSaving(true);
    try {
      const assignees: AssigneeEntry[] = Array.from(selected).map(uid => ({
        userId: uid,
        splitType,
        splitValue: (splitType !== 'EQUAL' && customValues[uid])
          ? parseFloat(customValues[uid])
          : undefined,
      }));
      const updated = await api.receipts.assignItem(receiptId, item.id, assignees);
      onDone(updated);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const allMembers: GroupMemberDto[] = members.length > 0
    ? members
    : user ? [{ userId: user.id, name: user.name, email: user.email, role: 'MEMBER', joinedAt: '' }] : [];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Assign Item</Text>
          {item && (
            <>
              <Text style={styles.modalSub}>{item.name}</Text>
              <View style={styles.modalItemMeta}>
                <Text style={styles.modalItemMetaText}>
                  {Number(item.quantity).toFixed(item.quantity % 1 === 0 ? 0 : 3)} × {currency} {Number(item.unitPrice).toFixed(2)}
                </Text>
                <Text style={styles.modalItemTotal}>{currency} {Number(item.totalPrice).toFixed(2)}</Text>
              </View>
            </>
          )}

          <Text style={styles.sectionLabel}>Split type</Text>
          <View style={styles.splitTypeRow}>
            {(['EQUAL', 'PERCENTAGE', 'FIXED', 'COUNT'] as SplitType[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, splitType === t && styles.typeChipActive]}
                onPress={() => setSplitType(t)}
              >
                <Text style={[styles.typeChipText, splitType === t && styles.typeChipTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Participants</Text>
          <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
            {allMembers.map(m => {
              const isSelected = selected.has(m.userId);
              return (
                <TouchableOpacity
                  key={m.userId}
                  style={[styles.memberRow, isSelected && styles.memberRowActive]}
                  onPress={() => toggleMember(m.userId)}
                >
                  <View style={styles.memberLeft}>
                    <View style={[styles.memberCheck, isSelected && styles.memberCheckActive]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>{m.name.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.memberName}>{m.name}</Text>
                  </View>
                  {isSelected && splitType !== 'EQUAL' && (
                    <TextInput
                      style={styles.valueInput}
                      placeholder={splitType === 'PERCENTAGE' ? '%' : splitType === 'COUNT' ? 'qty' : 'amt'}
                      placeholderTextColor={Colors.textMuted}
                      value={customValues[m.userId] ?? ''}
                      onChangeText={v => setCustomValues(prev => ({ ...prev, [m.userId]: v }))}
                      keyboardType="numeric"
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, (saving || selected.size === 0) && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving || selected.size === 0}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Assign</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Summary Tab ──────────────────────────────────────────────────────────────
function SummaryTab({ receipt }: { receipt: ReceiptDto }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<ReceiptSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingPaid, setTogglingPaid] = useState(false);

  const loadSummary = useCallback(() => {
    setLoading(true);
    api.receipts.summary(receipt.id)
      .then(setSummary)
      .catch(e => Alert.alert('Error', e.message))
      .finally(() => setLoading(false));
  }, [receipt.id]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const openRevolutPay = (revolutTag: string, amount: number, currency: string, scannerName: string) => {
    Alert.alert(
      'Pay with Revolut',
      `Send ${currency} ${Number(amount).toFixed(2)} to @${revolutTag} (${scannerName})`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Revolut',
          onPress: () => Linking.openURL(`https://revolut.me/${revolutTag}`),
        },
      ],
    );
  };

  const togglePaid = async (participantId: string, currentlyPaid: boolean) => {
    setTogglingPaid(true);
    try {
      if (currentlyPaid) {
        await api.receipts.markUnpaid(receipt.id, participantId);
      } else {
        await api.receipts.markPaid(receipt.id, participantId);
      }
      loadSummary();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setTogglingPaid(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />;
  if (!summary) return null;

  const currency = summary.currency ?? 'RON';
  const isScanner = user?.id === receipt.scannedById;

  return (
    <ScrollView contentContainerStyle={styles.summaryContent}>
      {summary.participants.map(p => {
        const isCurrentUser = p.userId === user?.id;
        const canPay =
          isCurrentUser &&
          !isScanner &&
          p.totalOwed > 0 &&
          !!receipt.scannedByRevolutTag;

        return (
          <View key={p.userId} style={styles.participantCard}>
            <View style={styles.participantHeader}>
              <View style={styles.pAvatar}>
                <Text style={styles.pAvatarText}>{p.name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pName}>{p.name}{isCurrentUser ? ' (you)' : ''}</Text>
                <Text style={styles.pEmail}>{p.email}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={styles.pTotal}>{currency} {Number(p.totalOwed).toFixed(2)}</Text>
                {p.paid && (
                  <View style={styles.paidBadge}>
                    <Ionicons name="checkmark-circle" size={11} color={Colors.success} />
                    <Text style={styles.paidBadgeText}>Paid</Text>
                  </View>
                )}
              </View>
            </View>
            {p.itemBreakdown?.map(item => (
              <View key={item.itemId} style={styles.breakdownRow}>
                <Text style={styles.breakdownItem}>{item.itemName}</Text>
                <Text style={styles.breakdownAmt}>{currency} {Number(item.amountOwed).toFixed(2)}</Text>
              </View>
            ))}
            {/* Scanner: toggle paid status for other participants (not themselves) */}
            {isScanner && p.userId !== user?.id && p.totalOwed > 0 && (
              <TouchableOpacity
                style={[styles.markPaidBtn, p.paid && styles.markUnpaidBtn]}
                onPress={() => togglePaid(p.userId, p.paid)}
                disabled={togglingPaid}
              >
                {togglingPaid
                  ? <ActivityIndicator size="small" color={p.paid ? Colors.textSecondary : Colors.success} />
                  : <>
                      <Ionicons
                        name={p.paid ? 'close-circle-outline' : 'checkmark-circle-outline'}
                        size={15}
                        color={p.paid ? Colors.textSecondary : Colors.success}
                      />
                      <Text style={[styles.markPaidText, p.paid && styles.markUnpaidText]}>
                        {p.paid ? 'Mark unpaid' : 'Mark as paid'}
                      </Text>
                    </>
                }
              </TouchableOpacity>
            )}
            {/* Participant: pay with Revolut button on their own card */}
            {canPay && !p.paid && (
              <TouchableOpacity
                style={styles.revolutBtn}
                onPress={() => openRevolutPay(
                  receipt.scannedByRevolutTag!,
                  p.totalOwed,
                  currency,
                  receipt.scannedByName,
                )}
              >
                <Ionicons name="card-outline" size={15} color="#fff" />
                <Text style={styles.revolutBtnText}>Pay with Revolut</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [receipt, setReceipt] = useState<ReceiptDto | null>(null);
  const [members, setMembers] = useState<GroupMemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignTarget, setAssignTarget] = useState<ReceiptItemDto | null>(null);
  const [proceeding, setProceeding] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const r = await api.receipts.get(id);
        setReceipt(r);
        if (r.groupId) {
          const g = await api.groups.get(r.groupId);
          setMembers(g.members ?? []);
        }
      } catch (e: any) {
        Alert.alert('Error', e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleItemUpdated = useCallback((updated: ReceiptItemDto) => {
    setReceipt(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(it => it.id === updated.id ? updated : it),
      };
    });
  }, []);

  const handleProceed = async () => {
    if (!receipt) return;
    setProceeding(true);
    try {
      const updated = await api.receipts.finalize(receipt.id);
      setReceipt(updated);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setProceeding(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!receipt) return null;

  const currency = receipt.currency ?? 'RON';
  const statusColor = receipt.status === 'PROCESSED' ? Colors.success : receipt.status === 'PROCESSING' ? Colors.warning : Colors.error;
  const isScanner = user?.id === receipt.scannedById;
  const allAssigned = (receipt.items?.length ?? 0) > 0 &&
    receipt.items.every(item => (item.assignments?.length ?? 0) > 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{receipt.title || 'Receipt'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.metaCard}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Total</Text>
          <Text style={styles.metaTotal}>{currency} {Number(receipt.totalAmount).toFixed(2)}</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Scanned by</Text>
          <Text style={styles.metaValue}>{receipt.scannedByName}</Text>
        </View>
        {receipt.groupName && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Group</Text>
            <Text style={styles.metaValue}>{receipt.groupName}</Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Status</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{receipt.status}</Text>
          </View>
        </View>
      </View>

      {receipt.finalized ? (
        <SummaryTab receipt={receipt} />
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.itemsList}>
            {receipt.items?.length === 0 && (
              <Text style={styles.noItems}>No items detected. Try scanning again.</Text>
            )}
            {receipt.items?.map(item => {
              const assignedCount = item.assignments?.length ?? 0;
              return (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemMeta}>
                        {Number(item.quantity).toFixed(0)} × {currency} {Number(item.unitPrice).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={styles.itemTotal}>{currency} {Number(item.totalPrice).toFixed(2)}</Text>
                      <TouchableOpacity
                        style={styles.assignBtn}
                        onPress={() => setAssignTarget(item)}
                      >
                        <Ionicons name="person-add" size={14} color={Colors.primary} />
                        <Text style={styles.assignBtnText}>
                          {assignedCount > 0 ? `${assignedCount} assigned` : 'Assign'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {item.assignments?.length > 0 && (
                    <View style={styles.assigneeList}>
                      {item.assignments.map(a => (
                        <View key={a.id} style={styles.assigneeChip}>
                          <Text style={styles.assigneeName}>{a.userName}</Text>
                          <Text style={styles.assigneeAmt}>{currency} {Number(a.amountOwed).toFixed(2)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
          {isScanner && (
            <View style={styles.proceedBar}>
              <TouchableOpacity
                style={[styles.proceedBtn, !allAssigned && styles.proceedBtnDisabled]}
                onPress={handleProceed}
                disabled={!allAssigned || proceeding}
              >
                {proceeding
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
                      <Text style={styles.proceedBtnText}>
                        {allAssigned ? 'Proceed to Summary' : 'Assign all items to proceed'}
                      </Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <AssignModal
        visible={assignTarget !== null}
        item={assignTarget}
        members={members}
        receiptId={receipt.id}
        currency={currency}
        onClose={() => setAssignTarget(null)}
        onDone={handleItemUpdated}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.text, textAlign: 'center', marginHorizontal: 8 },
  metaCard: {
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
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  metaDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: 8 },
  metaLabel: { fontSize: 13, color: Colors.textSecondary },
  metaValue: { fontSize: 14, fontWeight: '600', color: Colors.text },
  metaTotal: { fontSize: 22, fontWeight: '800', color: Colors.text },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },
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
  itemsList: { padding: 16, gap: 10, paddingBottom: 40 },
  noItems: { textAlign: 'center', color: Colors.textMuted, marginTop: 40, fontSize: 14 },
  itemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  itemTop: { flexDirection: 'row', gap: 12 },
  itemName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  itemMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  itemRight: { alignItems: 'flex-end', gap: 6 },
  itemTotal: { fontSize: 15, fontWeight: '700', color: Colors.text },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  assignBtnText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  assigneeList: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  assigneeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  assigneeName: { fontSize: 12, fontWeight: '600', color: Colors.success },
  assigneeAmt: { fontSize: 11, color: Colors.success },
  // Summary
  summaryContent: { padding: 16, gap: 12, paddingBottom: 40 },
  summaryTotals: { flexDirection: 'row', gap: 10 },
  totalBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  totalLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', fontWeight: '600' },
  totalValue: { fontSize: 16, fontWeight: '800', color: Colors.text },
  participantCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  participantHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  pAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  pAvatarText: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  pName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  pEmail: { fontSize: 11, color: Colors.textSecondary },
  pTotal: { fontSize: 16, fontWeight: '800', color: Colors.text },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: Colors.divider },
  breakdownItem: { fontSize: 13, color: Colors.textSecondary },
  breakdownAmt: { fontSize: 13, fontWeight: '600', color: Colors.text },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.successLight,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  paidBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.success },
  revolutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#5B2EDA',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  revolutBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  markPaidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.successLight,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  markUnpaidBtn: { backgroundColor: Colors.background },
  markPaidText: { fontSize: 13, fontWeight: '700', color: Colors.success },
  markUnpaidText: { color: Colors.textSecondary },
  proceedBar: {
    padding: 16,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  proceedBtnDisabled: { backgroundColor: Colors.border },
  proceedBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  modalSub: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  modalItemMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalItemMetaText: { fontSize: 13, color: Colors.textSecondary },
  modalItemTotal: { fontSize: 15, fontWeight: '800', color: Colors.text },
  countHint: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginBottom: 8, marginTop: -6 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 8 },
  splitTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  typeChip: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  typeChipTextActive: { color: '#fff' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: Colors.background,
  },
  memberRowActive: { backgroundColor: Colors.primaryLight },
  memberLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  memberCheckActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  memberAvatar: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { fontSize: 12, fontWeight: '700', color: Colors.text },
  memberName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  valueInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    color: Colors.text,
    width: 64,
    textAlign: 'center',
    backgroundColor: Colors.surface,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnDisabled: { opacity: 0.5 },
});
