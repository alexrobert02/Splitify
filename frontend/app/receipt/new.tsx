import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useTheme, type ColorPalette } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import type { ReceiptCategory } from '@/types';
import { CurrencyPickerModal, CurrencySelector } from '@/components/CurrencyPickerModal';
import { CategoryPickerModal, CategorySelector } from '@/components/CategoryPickerModal';

export default function NewReceiptScreen() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const titleRef = useRef<TextInput>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ReceiptCategory | null>(null);
  const [currency, setCurrency] = useState<string>(user?.preferredCurrency ?? 'RON');
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const handleCreate = async () => {
    if (!title.trim() || !category) return;
    setCreating(true);
    try {
      const receipt = await api.receipts.createReceipt(title.trim(), groupId, category, currency);
      router.replace(`/receipt/review?id=${receipt.id}` as any);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Receipt</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              ref={titleRef}
              style={styles.input}
              placeholder="e.g. Dinner at Pizza Place"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Category</Text>
            <CategorySelector value={category} onPress={() => setCategoryPickerVisible(true)} />
          </View>
          <CurrencySelector
            label="Currency"
            value={currency}
            onPress={() => setCurrencyPickerVisible(true)}
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.createBtn, (creating || !title.trim() || !category) && styles.btnDisabled]}
            onPress={handleCreate}
            disabled={creating || !title.trim() || !category}
          >
            {creating
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.createBtnText}>Create & Add Items</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <CurrencyPickerModal
        visible={currencyPickerVisible}
        selected={currency}
        onSelect={setCurrency}
        onClose={() => setCurrencyPickerVisible(false)}
      />
      <CategoryPickerModal
        visible={categoryPickerVisible}
        selected={category}
        onSelect={setCategory}
        onClose={() => setCategoryPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const getStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.background,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: c.text },
  content: { padding: 20, gap: 16, paddingBottom: 20 },
  fieldGroup: {},
  label: { fontSize: 13, fontWeight: '600', color: c.text, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: c.text,
    backgroundColor: c.surface,
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 8 : 20,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.surface,
  },
  createBtn: {
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
