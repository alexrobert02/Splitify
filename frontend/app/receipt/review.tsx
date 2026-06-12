import { useState, useRef, useEffect, useMemo } from 'react';
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
  Modal,
  Platform,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useTheme, type ColorPalette } from '@/context/ThemeContext';
import type { ReceiptDto, ReceiptItemDto, ReceiptCategory } from '@/types';
import { CurrencyPickerModal } from '@/components/CurrencyPickerModal';
import { CategoryPickerModal } from '@/components/CategoryPickerModal';
import { CATEGORY_CONFIG } from '@/constants/categories';

type EditState = { name: string; quantity: string; unitPrice: string };

const emptyEdit = (): EditState => ({ name: '', quantity: '1', unitPrice: '' });

export default function ReviewScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const isScanned = source === 'scan';
  const [receipt, setReceipt] = useState<ReceiptDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageExpanded, setImageExpanded] = useState(false);

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
    api.receipts.image(id)
      .then(img => setImageUri(`data:${img.imageMimeType};base64,${img.imageBase64}`))
      .catch(() => {});
  }, [id]);

  const startEdit = (item: ReceiptItemDto) => {
    setEditingId(item.id);
    setEditState({ name: item.name, quantity: String(item.quantity), unitPrice: String(item.unitPrice) });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    if (!editingId) return;
    const qty = parseFloat(editState.quantity);
    const price = parseFloat(editState.unitPrice);
    if (!editState.name.trim() || isNaN(qty) || isNaN(price) || qty <= 0 || price < 0) {
      Alert.alert('Invalid input', 'Please enter a valid name, quantity, and price.');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.receipts.updateItem(id, editingId, {
        name: editState.name.trim(),
        quantity: qty,
        unitPrice: price,
      });
      setReceipt((prev) =>
        prev ? { ...prev, items: prev.items.map((i) => (i.id === editingId ? updated : i)) } : prev
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
          <ActivityIndicator size="large" color={colors.primary} />
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
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} pointerEvents="none">Review Items</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {imageUri && (
              <TouchableOpacity style={styles.headerBtn} onPress={() => setImageExpanded(true)}>
                <Ionicons name="camera-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleDeleteReceipt} style={styles.headerBtn} disabled={deleting}>
              {deleting
                ? <ActivityIndicator size="small" color={colors.error} />
                : <Ionicons name="trash-outline" size={20} color={colors.error} />}
            </TouchableOpacity>
          </View>
        </View>

        <Modal visible={imageExpanded} transparent animationType="fade" onRequestClose={() => setImageExpanded(false)}>
          <View style={styles.imageModal}>
            <TouchableOpacity style={styles.imageModalClose} onPress={() => setImageExpanded(false)}>
              <Ionicons name="close-circle" size={32} color="#fff" />
            </TouchableOpacity>
            <Image source={{ uri: imageUri! }} style={styles.imageModalFull} resizeMode="contain" />
          </View>
        </Modal>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
              disabled={savingCategory}
            >
              {savingCategory
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <>
                    <Ionicons name={catCfg.icon as any} size={13} color={colors.primary} />
                    <Text style={styles.currencyBtnText}>{receipt?.category ?? ''}</Text>
                    <Ionicons name="swap-horizontal" size={13} color={colors.primary} />
                  </>
              }
            </TouchableOpacity>
          </View>

          {receipt?.items.map((item) => (
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
                  <TouchableOpacity onPress={() => startEdit(item)} style={styles.iconBtn}>
                    <Ionicons name="pencil" size={15} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    style={[styles.iconBtn, styles.iconBtnDanger]}
                  >
                    <Ionicons name="trash-outline" size={15} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          {receipt?.items.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                {isScanned ? 'Nothing could be extracted from the receipt. Add items manually below.' : 'No items yet. Add them below.'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddForm(true)}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.addBtnText}>Add Item</Text>
          </TouchableOpacity>

          <View style={styles.totalRow}>
            <View style={styles.totalLeft}>
              <Text style={styles.totalLabel}>Total</Text>
              <TouchableOpacity
                style={styles.currencyBtn}
                onPress={() => setCurrencyPickerVisible(true)}
                disabled={savingCurrency}
              >
                {savingCurrency
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <>
                      <Text style={styles.currencyBtnText}>{currency}</Text>
                      <Ionicons name="swap-horizontal" size={13} color={colors.primary} />
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

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.confirmBtn, confirming && styles.btnDisabled]}
            onPress={handleConfirm}
            disabled={confirming}
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
        <Modal
          visible={editingId !== null}
          transparent
          animationType="fade"
          onRequestClose={cancelEdit}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={cancelEdit} activeOpacity={1} />
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Item</Text>
                <TouchableOpacity onPress={cancelEdit} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ItemForm
                state={editState}
                onChange={setEditState}
                onSave={saveEdit}
                saving={saving}
                colors={colors}
                styles={styles}
              />
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={showAddForm}
          transparent
          animationType="fade"
          onRequestClose={cancelAdd}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={cancelAdd} activeOpacity={1} />
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Item</Text>
                <TouchableOpacity onPress={cancelAdd} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ItemForm
                state={addState}
                onChange={setAddState}
                onSave={saveAdd}
                saving={adding}
                colors={colors}
                styles={styles}
              />
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ItemForm({
  state,
  onChange,
  onSave,
  saving,
  colors,
  styles,
}: {
  state: EditState;
  onChange: (s: EditState) => void;
  onSave: () => void;
  saving: boolean;
  colors: ColorPalette;
  styles: ReturnType<typeof getStyles>;
}) {
  const quantityRef = useRef<TextInput>(null);
  const unitPriceRef = useRef<TextInput>(null);

  return (
    <View style={styles.formInner}>
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          style={styles.input}
          value={state.name}
          onChangeText={(v) => onChange({ ...state, name: v })}
          placeholder="Item name"
          placeholderTextColor={colors.textMuted}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => quantityRef.current?.focus()}
        />
      </View>
      <View style={styles.row}>
        <View style={[styles.fieldGroup, styles.flex]}>
          <Text style={styles.fieldLabel}>Quantity</Text>
          <TextInput
            ref={quantityRef}
            style={styles.input}
            value={state.quantity}
            onChangeText={(v) => onChange({ ...state, quantity: v })}
            keyboardType="decimal-pad"
            placeholder="1"
            placeholderTextColor={colors.textMuted}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => unitPriceRef.current?.focus()}
          />
        </View>
        <View style={[styles.fieldGroup, styles.flex]}>
          <Text style={styles.fieldLabel}>Unit Price</Text>
          <TextInput
            ref={unitPriceRef}
            style={styles.input}
            value={state.unitPrice}
            onChangeText={(v) => onChange({ ...state, unitPrice: v })}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
          />
        </View>
      </View>
      <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Save</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.surface,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.background,
  },
  headerTitle: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 17, fontWeight: '700', color: c.text },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  subtitle: { fontSize: 13, color: c.textSecondary, lineHeight: 19 },
  card: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemInfo: { flex: 1, gap: 3 },
  itemName: { fontSize: 15, fontWeight: '600', color: c.text },
  itemMeta: { fontSize: 13, color: c.textSecondary },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemTotal: { fontSize: 15, fontWeight: '700', color: c.text, marginRight: 4 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: c.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnDanger: { backgroundColor: c.errorLight },
  formInner: { gap: 12 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  modalSheet: {
    width: '88%',
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: c.text,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: c.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
  input: {
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: c.text,
    backgroundColor: c.background,
  },
  row: { flexDirection: 'row', gap: 12 },
  saveBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: c.primary,
    alignItems: 'center',
    marginTop: 4,
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
    borderColor: c.primary,
    borderStyle: 'dashed',
    backgroundColor: c.primaryLight,
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: c.primary },
  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  emptyText: { fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 20 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  totalLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalLabel: { fontSize: 15, fontWeight: '600', color: c.textSecondary },
  totalValue: { fontSize: 18, fontWeight: '800', color: c.text },
  currencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  currencyBtnText: { fontSize: 13, fontWeight: '700', color: c.primary },
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.surface,
  },
  confirmBtn: {
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  imageModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  imageModalClose: { position: 'absolute', top: 48, right: 20, zIndex: 10 },
  imageModalFull: { width: '100%', height: '80%' },
});
