import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useTheme, type ColorPalette } from '@/context/ThemeContext';
import { CurrencyPickerModal } from '@/components/CurrencyPickerModal';
import { CategoryPickerModal, CategorySelector } from '@/components/CategoryPickerModal';
import { useAuth } from '@/context/AuthContext';
import type { GroupDto, UserDto, ReceiptCategory, RecurrenceFrequency, SplitType } from '@/types';

const FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'DAILY',   label: 'Daily' },
  { value: 'WEEKLY',  label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY',  label: 'Yearly' },
];

const SPLIT_TYPES: { value: SplitType; label: string; hint: string }[] = [
  { value: 'EQUAL',      label: 'Equal',   hint: 'Split evenly' },
  { value: 'PERCENTAGE', label: 'Percent', hint: 'Must sum to 100%' },
  { value: 'FIXED',      label: 'Fixed',   hint: 'Must sum to total' },
];

interface ParticipantEntry { user: UserDto; splitValue: string }

export default function NewRecurringScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [title, setTitle]                   = useState('');
  const [amount, setAmount]                 = useState('');
  const [currency, setCurrency]             = useState('RON');
  const [currencyModal, setCurrencyModal]   = useState(false);
  const [category, setCategory]             = useState<ReceiptCategory>('UTILITIES');
  const [categoryModal, setCategoryModal]   = useState(false);
  const [frequency, setFrequency]           = useState<RecurrenceFrequency>('MONTHLY');
  const [startDate, setStartDate]           = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [splitType, setSplitType]           = useState<SplitType>('EQUAL');
  const [groups, setGroups]                 = useState<GroupDto[]>([]);
  const [selectedGroup, setSelectedGroup]   = useState<GroupDto | null>(null);
  const [participants, setParticipants]     = useState<ParticipantEntry[]>([]);
  const [saving, setSaving]                 = useState(false);
  const { user } = useAuth();

  useEffect(() => { api.groups.list().then(setGroups).catch(() => {}); }, []);
  useEffect(() => { if (user) setParticipants([{ user: user as UserDto, splitValue: '' }]); }, [user]);

  const handleGroupSelect = (group: GroupDto | null) => {
    setSelectedGroup(group);
    setParticipants(
      group
        ? group.members.map(m => ({ user: m, splitValue: '' }))
        : user ? [{ user: user as UserDto, splitValue: '' }] : []
    );
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Title is required';
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return 'Enter a valid positive amount';
    if (participants.length === 0) return 'At least one participant is required';
    if (splitType === 'PERCENTAGE') {
      const sum = participants.reduce((s, p) => s + (parseFloat(p.splitValue) || 0), 0);
      if (Math.abs(sum - 100) > 0.01) return `Percentages must sum to 100 (got ${sum})`;
    } else if (splitType === 'FIXED') {
      const sum = participants.reduce((s, p) => s + (parseFloat(p.splitValue) || 0), 0);
      if (Math.abs(sum - parseFloat(amount)) > 0.01) return `Fixed amounts must sum to ${amount} (got ${sum.toFixed(2)})`;
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { Alert.alert('Check your inputs', err); return; }
    setSaving(true);
    try {
      await api.recurring.create({
        title: title.trim(),
        totalAmount: parseFloat(amount),
        currency,
        category,
        groupId: selectedGroup?.id,
        frequency,
        startDate: startDate.toISOString().split('T')[0],
        participants: participants.map(p => ({
          userId: p.user.id,
          splitType,
          splitValue: splitType !== 'EQUAL' ? parseFloat(p.splitValue) : undefined,
        })),
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Recurring Expense</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <View>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Monthly rent"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.label}>Amount</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ width: 120 }}>
              <Text style={styles.label}>Currency</Text>
              <TouchableOpacity style={styles.currencyBtn} onPress={() => setCurrencyModal(true)} activeOpacity={0.7}>
                <Ionicons name="globe-outline" size={15} color={colors.primary} />
                <Text style={styles.currencyBtnText}>{currency}</Text>
                <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <View>
            <Text style={styles.label}>Category</Text>
            <CategorySelector value={category} onPress={() => setCategoryModal(true)} />
          </View>

          <View>
            <Text style={styles.label}>Frequency</Text>
            <View style={styles.chipRow}>
              {FREQUENCIES.map(f => {
                const active = frequency === f.value;
                return (
                  <TouchableOpacity
                    key={f.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFrequency(f.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={styles.label}>Start Date</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text style={styles.dateBtnText}>
                {startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                value={startDate}
                minimumDate={new Date()}
                onChange={(_, date) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (date) setStartDate(date);
                }}
              />
            )}
          </View>

          <View>
            <Text style={styles.label}>Group</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, selectedGroup === null && styles.chipActive]}
                onPress={() => handleGroupSelect(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selectedGroup === null && styles.chipTextActive]}>Solo</Text>
              </TouchableOpacity>
              {groups.map(g => {
                const active = selectedGroup?.id === g.id;
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => handleGroupSelect(g)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{g.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {selectedGroup !== null && participants.length > 0 && (
            <>
              <View>
                <Text style={styles.label}>Split type</Text>
                <View style={styles.chipRow}>
                  {SPLIT_TYPES.map(s => {
                    const active = splitType === s.value;
                    return (
                      <TouchableOpacity
                        key={s.value}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setSplitType(s.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.hint}>{SPLIT_TYPES.find(s => s.value === splitType)?.hint}</Text>
              </View>

              <View>
                <Text style={styles.label}>Participants</Text>
                <View style={styles.participantList}>
                  {participants.map((p, idx) => (
                    <View
                      key={p.user.id}
                      style={[styles.participantRow, idx < participants.length - 1 && styles.participantBorder]}
                    >
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{p.user.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.participantName} numberOfLines={1}>{p.user.name}</Text>
                      {splitType !== 'EQUAL' ? (
                        <TextInput
                          style={styles.splitInput}
                          value={p.splitValue}
                          onChangeText={v => setParticipants(prev => prev.map((e, i) => i === idx ? { ...e, splitValue: v } : e))}
                          placeholder={splitType === 'PERCENTAGE' ? '%' : currency}
                          placeholderTextColor={colors.textMuted}
                          keyboardType="decimal-pad"
                        />
                      ) : (
                        <Text style={styles.equalBadge}>Equal</Text>
                      )}
                      <TouchableOpacity onPress={() => setParticipants(prev => prev.filter((_, i) => i !== idx))} hitSlop={8}>
                        <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}

        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.saveBtnText}>Save Recurring Expense</Text>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <CurrencyPickerModal
        visible={currencyModal}
        selected={currency}
        onSelect={setCurrency}
        onClose={() => setCurrencyModal(false)}
      />
      <CategoryPickerModal
        visible={categoryModal}
        selected={category}
        onSelect={setCategory}
        onClose={() => setCategoryModal(false)}
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

  content: { padding: 20, gap: 18, paddingBottom: 24 },

  row: { flexDirection: 'row', gap: 12 },

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

  currencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: c.surface,
  },
  currencyBtnText: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },

  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: c.surface,
  },
  dateBtnText: { fontSize: 15, color: c.text },

  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
  chipTextActive: { color: '#fff' },

  hint: { fontSize: 12, color: c.textMuted, marginTop: 6 },

  participantList: {
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: c.surface,
    overflow: 'hidden',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  participantBorder: { borderBottomWidth: 1, borderBottomColor: c.divider },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: c.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: c.primary },
  participantName: { flex: 1, fontSize: 14, fontWeight: '500', color: c.text },
  equalBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: c.primary,
    backgroundColor: c.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  splitInput: {
    width: 72,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    color: c.text,
    textAlign: 'right',
    backgroundColor: c.background,
  },

  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 8 : 20,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.surface,
  },
  saveBtn: {
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
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
