import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { Colors } from '@/constants/Colors';
import type { ReceiptDto, ReceiptItemDto, ReceiptCategory } from '@/types';
import { CurrencyPickerModal } from '@/components/CurrencyPickerModal';
import { CategoryPickerModal } from '@/components/CategoryPickerModal';
import { CATEGORY_CONFIG } from '@/constants/categories';

type EditState = { name: string; quantity: string; unitPrice: string };

const emptyEdit = (): EditState => ({ name: '', quantity: '1', unitPrice: '' });

export default function ReviewScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const isScanned = source === 'scan';
  const [receipt, setReceipt] = useState<ReceiptDto | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>(emptyEdit());
  const [saving, setSaving] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addState, setAddState] = useState<EditState>(emptyEdit());
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);

  const busy = editingId !== null || showAddForm;
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (showAddForm) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [showAddForm]);

  const handleAddFormFocus = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const handleCurrencyChange = async (code: string) => {
    setSavingCurrency(true);
    try {
      const updated = await api.receipts.update(id, { currency: code });
      setReceipt(updated);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingCurrency(false);
    }
  };

  const handleCategoryChange = async (cat: ReceiptCategory) => {
    setSavingCategory(true);
    try {
      const updated = await api.receipts.update(id, { category: cat });
      setReceipt(updated);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteReceipt = () => {
    Alert.alert('Delete receipt', 'Are you sure you want to delete this receipt?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setDeleting(true);
          try {
            await api.receipts.delete(id);
            router.back();
          } catch (e: any) {
            Alert.alert('Error', e.message);
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await api.receipts.confirmReview(id);
      router.replace(`/receipt/${id}` as any);
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setConfirming(false);
    }
  };

  useEffect(() => {
    api.receipts
      .get(id)
      .then(setReceipt)
      .catch((e: any) => Alert.alert('Error', e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const startEdit = (item: ReceiptItemDto) => {
    setEditingId(item.id);
    setEditState({ name: item.name, quantity: String(item.quantity), unitPrice: String(item.unitPrice) });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (item: ReceiptItemDto) => {
    const qty = parseFloat(editState.quantity);
    const price = parseFloat(editState.unitPrice);
    if (!editState.name.trim() || isNaN(qty) || isNaN(price) || qty <= 0 || price < 0) {
      Alert.alert('Invalid input', 'Please enter a valid name, quantity, and price.');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.receipts.updateItem(id, item.id, {
        name: editState.name.trim(),
        quantity: qty,
        unitPrice: price,
      });
      setReceipt((prev) =>
        prev ? { ...prev, items: prev.items.map((i) => (i.id === item.id ? updated : i)) } : prev
      );
      setEditingId(null);
    } catch (e: any) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: ReceiptItemDto) => {
    Alert.alert('Delete item', `Remove "${item.name}" from the receipt?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.receipts.deleteItem(id, item.id);
            setReceipt((prev) =>
              prev ? { ...prev, items: prev.items.filter((i) => i.id !== item.id) } : prev
            );
          } catch (e: any) {
            Alert.alert('Delete failed', e.message);
          }
        },
      },
    ]);
  };

  const cancelAdd = () => {
    setShowAddForm(false);
    setAddState(emptyEdit());
  };

  const saveAdd = async () => {
    const qty = parseFloat(addState.quantity);
    const price = parseFloat(addState.unitPrice);
    if (!addState.name.trim() || isNaN(qty) || isNaN(price) || qty <= 0 || price < 0) {
      Alert.alert('Invalid input', 'Please enter a valid name, quantity, and price.');
      return;
    }
    setAdding(true);
    try {
      await api.receipts.addItem(id, {
        name: addState.name.trim(),
        quantity: qty,
        unitPrice: price,
      });
      const updated = await api.receipts.get(id);
      setReceipt(updated);
      setShowAddForm(false);
      setAddState(emptyEdit());
    } catch (e: any) {
      Alert.alert('Add failed', e.message);
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const currency = receipt?.currency ?? '';
  const total = receipt?.items.reduce((sum, i) => sum + i.totalPrice, 0) ?? 0;
  const catCfg = CATEGORY_CONFIG[receipt?.category ?? 'OTHER'] ?? CATEGORY_CONFIG.OTHER;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Items</Text>
          <TouchableOpacity onPress={handleDeleteReceipt} style={styles.headerBtn} disabled={deleting}>
            {deleting
              ? <ActivityIndicator size="small" color={Colors.error} />
              : <Ionicons name="trash-outline" size={20} color={Colors.error} />}
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {isScanned && (
            <Text style={styles.subtitle}>
              Review and correct the items extracted from your receipt before continuing.
            </Text>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Category</Text>
            <TouchableOpacity
              style={styles.currencyBtn}
              onPress={() => setCategoryPickerVisible(true)}
              disabled={savingCategory || busy}
            >
              {savingCategory
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <>
                    <Ionicons name={catCfg.icon as any} size={13} color={Colors.primary} />
                    <Text style={styles.currencyBtnText}>{receipt?.category ?? ''}</Text>
                    <Ionicons name="swap-horizontal" size={13} color={Colors.primary} />
                  </>
              }
            </TouchableOpacity>
          </View>

          {receipt?.items.map((item) =>
            editingId === item.id ? (
              <View
                key={item.id}
                style={[styles.card, styles.cardEditing]}
              >
                <ItemForm
                  state={editState}
                  onChange={setEditState}
                  onSave={() => saveEdit(item)}
                  onCancel={cancelEdit}
                  saving={saving}
                />
              </View>
            ) : (
              <View key={item.id} style={styles.card}>
                <View style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      {item.quantity} × {currency} {item.unitPrice.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.itemRight}>
                    <Text style={styles.itemTotal}>
                      {currency} {item.totalPrice.toFixed(2)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => startEdit(item)}
                      style={styles.iconBtn}
                      disabled={busy}
                    >
                      <Ionicons name="pencil" size={15} color={busy ? Colors.textMuted : Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(item)}
                      style={[styles.iconBtn, styles.iconBtnDanger]}
                      disabled={busy}
                    >
                      <Ionicons name="trash-outline" size={15} color={busy ? Colors.textMuted : Colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )
          )}

          {receipt?.items.length === 0 && !showAddForm && (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>
                {isScanned ? 'Nothing could be extracted from the receipt. Add items manually below.' : 'No items yet. Add them below.'}
              </Text>
            </View>
          )}

          {showAddForm ? (
            <View style={[styles.card, styles.cardEditing]}>
              <Text style={styles.addFormTitle}>New Item</Text>
              <ItemForm
                state={addState}
                onChange={setAddState}
                onSave={saveAdd}
                onCancel={cancelAdd}
                saving={adding}
                onFocus={handleAddFormFocus}
              />
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addBtn, editingId !== null && styles.addBtnDisabled]}
              onPress={() => setShowAddForm(true)}
              disabled={editingId !== null}
            >
              <Ionicons name="add-circle-outline" size={18} color={editingId !== null ? Colors.textMuted : Colors.primary} />
              <Text style={[styles.addBtnText, editingId !== null && styles.addBtnTextDisabled]}>
                Add Item
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.totalRow}>
            <View style={styles.totalLeft}>
              <Text style={styles.totalLabel}>Total</Text>
              <TouchableOpacity
                style={styles.currencyBtn}
                onPress={() => setCurrencyPickerVisible(true)}
                disabled={savingCurrency || busy}
              >
                {savingCurrency
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : <>
                      <Text style={styles.currencyBtnText}>{currency}</Text>
                      <Ionicons name="swap-horizontal" size={13} color={Colors.primary} />
                    </>
                }
              </TouchableOpacity>
            </View>
            <Text style={styles.totalValue}>{total.toFixed(2)}</Text>
          </View>

          <CurrencyPickerModal
            visible={currencyPickerVisible}
            selected={currency}
            onSelect={handleCurrencyChange}
            onClose={() => setCurrencyPickerVisible(false)}
          />
          <CategoryPickerModal
            visible={categoryPickerVisible}
            selected={receipt?.category ?? null}
            onSelect={handleCategoryChange}
            onClose={() => setCategoryPickerVisible(false)}
          />
        </ScrollView>

        {!keyboardVisible && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.confirmBtn, (busy || confirming) && styles.btnDisabled]}
              onPress={handleConfirm}
              disabled={busy || confirming}
            >
              {confirming
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Text style={styles.confirmBtnText}>Confirm & Continue</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
              }
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ItemForm({
  state,
  onChange,
  onSave,
  onCancel,
  saving,
  onFocus,
  autoFocus,
}: {
  state: EditState;
  onChange: (s: EditState) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  onFocus?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.formInner}>
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          style={styles.input}
          value={state.name}
          onChangeText={(v) => onChange({ ...state, name: v })}
          placeholder="Item name"
          placeholderTextColor={Colors.textMuted}
          autoFocus={autoFocus}
          onFocus={onFocus}
        />
      </View>
      <View style={styles.row}>
        <View style={[styles.fieldGroup, styles.flex]}>
          <Text style={styles.fieldLabel}>Quantity</Text>
          <TextInput
            style={styles.input}
            value={state.quantity}
            onChangeText={(v) => onChange({ ...state, quantity: v })}
            keyboardType="decimal-pad"
            placeholder="1"
            placeholderTextColor={Colors.textMuted}
            onFocus={onFocus}
          />
        </View>
        <View style={[styles.fieldGroup, styles.flex]}>
          <Text style={styles.fieldLabel}>Unit Price</Text>
          <TextInput
            style={styles.input}
            value={state.unitPrice}
            onChangeText={(v) => onChange({ ...state, unitPrice: v })}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={Colors.textMuted}
            onFocus={onFocus}
          />
        </View>
      </View>
      <View style={styles.editActions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={saving}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardEditing: { borderColor: Colors.primary },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemInfo: { flex: 1, gap: 3 },
  itemName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  itemMeta: { fontSize: 13, color: Colors.textSecondary },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemTotal: { fontSize: 15, fontWeight: '700', color: Colors.text, marginRight: 4 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnDanger: { backgroundColor: Colors.errorLight },
  formInner: { gap: 12 },
  addFormTitle: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginBottom: -4 },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  row: { flexDirection: 'row', gap: 12 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    backgroundColor: Colors.primaryLight,
  },
  addBtnDisabled: { borderColor: Colors.border, backgroundColor: Colors.surface },
  addBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  addBtnTextDisabled: { color: Colors.textMuted },
  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  totalLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalLabel: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  totalValue: { fontSize: 18, fontWeight: '800', color: Colors.text },
  currencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  currencyBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
