import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useTheme, type ColorPalette } from '@/context/ThemeContext';
import { useCategoryConfig } from '@/constants/categories';
import type {
  ReceiptDto,
  ReceiptItemDto,
  ReceiptSummaryDto,
  UserDto,
  SplitType,
  AssigneeEntry,
} from '@/types';

function ReceiptMeta({ receipt, currency }: { receipt: ReceiptDto; currency: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const catConfig = useCategoryConfig();
  const cfg = catConfig[receipt.category];
  return (
    <View style={[styles.metaCard, { marginHorizontal: 0, marginTop: 0, marginBottom: 4 }]}>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Total</Text>
        <Text style={styles.metaTotal}>{currency} {Number(receipt.totalAmount).toFixed(2)}</Text>
      </View>
      {receipt.groupName && (
        <>
          <View style={styles.metaDivider} />
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Scanned by</Text>
            <Text style={styles.metaValue}>{receipt.createdByName}</Text>
          </View>
        </>
      )}
      {receipt.groupName && (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Group</Text>
          <Text style={styles.metaValue}>{receipt.groupName}</Text>
        </View>
      )}
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Category</Text>
        <View style={[styles.categoryBadge, { backgroundColor: cfg.bgColor }]}>
          <Ionicons name={cfg.icon as any} size={13} color={cfg.color} />
          <Text style={[styles.categoryText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
    </View>
  );
}

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
  members: UserDto[];
  receiptId: string;
  currency: string;
  onClose: () => void;
  onDone: (updated: ReceiptItemDto) => void;
}) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [splitType, setSplitType] = useState<SplitType>('EQUAL');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const initialSelected = useRef<Set<string>>(new Set());
  const initialSplitType = useRef<SplitType>('EQUAL');
  const initialCustomValues = useRef<Record<string, string>>({});

  useEffect(() => {
    if (visible && item) {
      const existing = new Set(item.assignments?.map(a => a.userId) ?? []);
      const vals: Record<string, string> = {};
      item.assignments?.forEach(a => { if (a.splitValue) vals[a.userId] = String(a.splitValue); });
      const type: SplitType = item.assignments?.[0]?.splitType ?? 'EQUAL';

      setSelected(existing);
      setCustomValues(vals);
      setSplitType(type);

      initialSelected.current = new Set(existing);
      initialSplitType.current = type;
      initialCustomValues.current = { ...vals };
    }
  }, [visible, item]);

  const hasChanges = (() => {
    const a = selected, b = initialSelected.current;
    if (a.size !== b.size || [...a].some(id => !b.has(id))) return true;
    if (splitType !== initialSplitType.current) return true;
    if (splitType !== 'EQUAL') {
      for (const id of selected) {
        if ((customValues[id] ?? '') !== (initialCustomValues.current[id] ?? '')) return true;
      }
    }
    return false;
  })();

  const toggleMember = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!item) return;
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

  const allMembers: UserDto[] = members.length > 0
    ? members
    : user ? [{ id: user.id, name: user.name, email: user.email }] : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
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
              const isSelected = selected.has(m.id);
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.memberRow, isSelected && styles.memberRowActive]}
                  onPress={() => toggleMember(m.id)}
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
                      placeholderTextColor={colors.textMuted}
                      value={customValues[m.id] ?? ''}
                      onChangeText={v => setCustomValues(prev => ({ ...prev, [m.id]: v }))}
                      keyboardType="numeric"
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveBtn, (saving || !hasChanges) && styles.btnDisabled, { marginTop: 16 }]}
            onPress={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Assign</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SummaryTab({ receipt }: { receipt: ReceiptDto }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
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

  const handleMarkPaid = async (participantId: string) => {
    setTogglingPaid(true);
    try {
      await api.receipts.markPaid(receipt.id, participantId);
      loadSummary();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setTogglingPaid(false);
    }
  };

  const currency = summary?.currency ?? receipt.currency ?? 'RON';
  const isScanner = user?.id === receipt.createdById;

  return (
    <ScrollView contentContainerStyle={styles.summaryContent}>
      <ReceiptMeta receipt={receipt} currency={currency} />
      {loading
        ? <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
        : summary?.participants.map(p => {
        const isCurrentUser = p.userId === user?.id;
        const owesPayment = isCurrentUser && !isScanner && p.totalOwed > 0;
        const canPayRevolut = owesPayment && !!receipt.createdByRevolutTag;

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
                {p.paid && !!receipt.groupId && (
                  <View style={styles.paidBadge}>
                    <Ionicons name="checkmark-circle" size={11} color={colors.success} />
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
            {isScanner && p.userId !== user?.id && p.totalOwed > 0 && !p.paid && (
              <TouchableOpacity
                style={styles.markPaidBtn}
                onPress={() => handleMarkPaid(p.userId)}
                disabled={togglingPaid}
              >
                {togglingPaid
                  ? <ActivityIndicator size="small" color={colors.success} />
                  : <>
                      <Ionicons name="checkmark-circle-outline" size={15} color={colors.success} />
                      <Text style={styles.markPaidText}>Mark as paid</Text>
                    </>
                }
              </TouchableOpacity>
            )}
            {canPayRevolut && !p.paid && (
              <TouchableOpacity
                style={styles.revolutBtn}
                onPress={() => openRevolutPay(
                  receipt.createdByRevolutTag!,
                  p.totalOwed,
                  currency,
                  receipt.createdByName,
                )}
              >
                <Ionicons name="card-outline" size={15} color="#fff" />
                <Text style={styles.revolutBtnText}>Pay with Revolut</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })
      }
    </ScrollView>
  );
}

export default function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [receipt, setReceipt] = useState<ReceiptDto | null>(null);
  const [members, setMembers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignTarget, setAssignTarget] = useState<ReceiptItemDto | null>(null);
  const [proceeding, setProceeding] = useState(false);
  const [assigningAll, setAssigningAll] = useState(false);

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

  const allMembers: UserDto[] = members.length > 0
    ? members
    : user ? [{ id: user.id, name: user.name, email: user.email }] : [];

  const handleAssignAll = async () => {
    if (!receipt || allMembers.length === 0) return;
    setAssigningAll(true);
    try {
      const assignees: AssigneeEntry[] = allMembers.map(m => ({
        userId: m.id,
        splitType: 'EQUAL' as SplitType,
      }));
      const updatedItems = await Promise.all(
        receipt.items.map(item => api.receipts.assignItem(receipt.id, item.id, assignees))
      );
      setReceipt(prev => prev ? { ...prev, items: updatedItems } : prev);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setAssigningAll(false);
    }
  };

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
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!receipt) return null;

  const currency = receipt.currency ?? 'RON';
  const isScanner = user?.id === receipt.createdById;
  const allAssigned = (receipt.items?.length ?? 0) > 0 &&
    receipt.items.every(item => (item.assignments?.length ?? 0) > 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{receipt.title || 'Receipt'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {(receipt.status === 'PENDING_PAYMENT' || receipt.status === 'FINALIZED') ? (
        <SummaryTab receipt={receipt} />
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.itemsList}>
            <ReceiptMeta receipt={receipt} currency={currency} />
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
                        <Ionicons name="person-add" size={14} color={colors.primary} />
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
                style={[styles.assignAllBtn, assigningAll && styles.btnDisabled]}
                onPress={handleAssignAll}
                disabled={assigningAll}
              >
                {assigningAll
                  ? <ActivityIndicator color={colors.primary} size="small" />
                  : <>
                      <Ionicons name="people-outline" size={16} color={colors.primary} />
                      <Text style={styles.assignAllBtnText}>Assign All to Everyone Equally</Text>
                    </>
                }
              </TouchableOpacity>
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

const getStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: c.text, textAlign: 'center', marginHorizontal: 8 },
  metaCard: {
    backgroundColor: c.surface,
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
  metaDivider: { height: 1, backgroundColor: c.divider, marginVertical: 8 },
  metaLabel: { fontSize: 13, color: c.textSecondary },
  metaValue: { fontSize: 14, fontWeight: '600', color: c.text },
  metaTotal: { fontSize: 22, fontWeight: '800', color: c.text },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  categoryText: { fontSize: 12, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: c.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
  tabTextActive: { color: '#fff' },
  itemsList: { padding: 16, gap: 10, paddingBottom: 40 },
  noItems: { textAlign: 'center', color: c.textMuted, marginTop: 40, fontSize: 14 },
  itemCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  itemTop: { flexDirection: 'row', gap: 12 },
  itemName: { fontSize: 15, fontWeight: '700', color: c.text },
  itemMeta: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
  itemRight: { alignItems: 'flex-end', gap: 6 },
  itemTotal: { fontSize: 15, fontWeight: '700', color: c.text },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  assignBtnText: { fontSize: 12, fontWeight: '600', color: c.primary },
  assigneeList: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  assigneeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.successLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  assigneeName: { fontSize: 12, fontWeight: '600', color: c.success },
  assigneeAmt: { fontSize: 11, color: c.success },
  summaryContent: { padding: 16, gap: 12, paddingBottom: 40 },
  summaryTotals: { flexDirection: 'row', gap: 10 },
  totalBox: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  totalLabel: { fontSize: 11, color: c.textSecondary, marginBottom: 4, textTransform: 'uppercase', fontWeight: '600' },
  totalValue: { fontSize: 16, fontWeight: '800', color: c.text },
  participantCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  participantHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  pAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.primaryLight, justifyContent: 'center', alignItems: 'center' },
  pAvatarText: { fontSize: 13, fontWeight: '800', color: c.primary },
  pName: { fontSize: 15, fontWeight: '700', color: c.text },
  pEmail: { fontSize: 11, color: c.textSecondary },
  pTotal: { fontSize: 16, fontWeight: '800', color: c.text },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: c.divider },
  breakdownItem: { fontSize: 13, color: c.textSecondary },
  breakdownAmt: { fontSize: 13, fontWeight: '600', color: c.text },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: c.successLight,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  paidBadgeText: { fontSize: 10, fontWeight: '700', color: c.success },
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
    backgroundColor: c.successLight,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  markPaidText: { fontSize: 13, fontWeight: '700', color: c.success },
  proceedBar: {
    padding: 16,
    paddingBottom: 12,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  assignAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: c.primary,
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  assignAllBtnText: { fontSize: 14, fontWeight: '700', color: c.primary },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  proceedBtnDisabled: { backgroundColor: c.border },
  proceedBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay },
  modalSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: c.text, marginBottom: 4 },
  modalSub: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 6 },
  modalItemMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalItemMetaText: { fontSize: 13, color: c.textSecondary },
  modalItemTotal: { fontSize: 15, fontWeight: '800', color: c.text },
  countHint: { fontSize: 12, color: c.primary, fontWeight: '600', marginBottom: 8, marginTop: -6 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 8 },
  splitTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  typeChip: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: c.border, alignItems: 'center' },
  typeChipActive: { backgroundColor: c.primary, borderColor: c.primary },
  typeChipText: { fontSize: 12, fontWeight: '700', color: c.textSecondary },
  typeChipTextActive: { color: '#fff' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: c.background,
  },
  memberRowActive: { backgroundColor: c.primaryLight },
  memberLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  memberCheckActive: { backgroundColor: c.primary, borderColor: c.primary },
  memberAvatar: { width: 32, height: 32, borderRadius: 8, backgroundColor: c.border, justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { fontSize: 12, fontWeight: '700', color: c.text },
  memberName: { fontSize: 14, fontWeight: '600', color: c.text },
  valueInput: {
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    color: c.text,
    width: 64,
    textAlign: 'center',
    backgroundColor: c.surface,
  },
  saveBtn: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnDisabled: { opacity: 0.5 },
});
