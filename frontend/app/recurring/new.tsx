import { useState, useEffect } from 'react';
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
import { Colors } from '@/constants/Colors';
import { CurrencyPickerModal, CurrencySelector } from '@/components/CurrencyPickerModal';
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
  { value: 'EQUAL',      label: 'Equal',      hint: 'Split evenly' },
  { value: 'PERCENTAGE', label: '%',           hint: 'Must sum to 100' },
  { value: 'FIXED',      label: 'Fixed',       hint: 'Must sum to total' },
];

interface ParticipantEntry {
  user: UserDto;
  splitValue: string;
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

export default function NewRecurringScreen() {
  const [title, setTitle]             = useState('');
  const [amount, setAmount]           = useState('');
  const [currency, setCurrency]       = useState('RON');
  const [currencyModal, setCurrencyModal] = useState(false);
  const [category, setCategory]       = useState<ReceiptCategory>('UTILITIES');
  const [categoryModal, setCategoryModal] = useState(false);
  const [frequency, setFrequency]     = useState<RecurrenceFrequency>('MONTHLY');
  const [startDate, setStartDate]     = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [splitType, setSplitType]     = useState<SplitType>('EQUAL');

  const [groups, setGroups]               = useState<GroupDto[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupDto | null>(null);
  const [participants, setParticipants]   = useState<ParticipantEntry[]>([]);
  const [saving, setSaving]               = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    api.groups.list().then(setGroups).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) setParticipants([{ user: user as UserDto, splitValue: '' }]);
  }, [user]);

  const handleGroupSelect = (group: GroupDto | null) => {
    setSelectedGroup(group);
    if (group) {
      setParticipants(group.members.map(m => ({ user: m, splitValue: '' })));
    } else if (user) {
      setParticipants([{ user: user as UserDto, splitValue: '' }]);
    }
  };

  const updateSplitValue = (idx: number, value: string) => {
    setParticipants(prev => prev.map((p, i) => (i === idx ? { ...p, splitValue: value } : p)));
  };

  const removeParticipant = (idx: number) => {
    setParticipants(prev => prev.filter((_, i) => i !== idx));
  };

  const validate = (): string | null => {
    if (!title.trim())                           return 'Title is required';
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0)                  return 'Enter a valid positive amount';
    if (participants.length === 0)               return 'At least one participant is required';

    if (splitType === 'PERCENTAGE') {
      const total = participants.reduce((s, p) => s + (parseFloat(p.splitValue) || 0), 0);
      if (Math.abs(total - 100) > 0.01)          return `Percentages must sum to 100 (got ${total})`;
    } else if (splitType === 'FIXED') {
      const total = participants.reduce((s, p) => s + (parseFloat(p.splitValue) || 0), 0);
      if (Math.abs(total - amt) > 0.01)          return `Fixed amounts must sum to ${amt} (got ${total.toFixed(2)})`;
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Recurring Expense</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Title */}
          <View style={styles.fieldGroup}>
            <FieldLabel label="Title" />
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Monthly rent"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Amount + Currency */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, styles.flex]}>
              <FieldLabel label="Amount" />
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.fieldGroup, { width: 130 }]}>
              <FieldLabel label="Currency" />
              <CurrencySelector
                value={currency}
                onPress={() => setCurrencyModal(true)}
              />
            </View>
          </View>

          {/* Category */}
          <View style={styles.fieldGroup}>
            <FieldLabel label="Category" />
            <CategorySelector value={category} onPress={() => setCategoryModal(true)} />
          </View>

          {/* Frequency */}
          <View style={styles.fieldGroup}>
            <FieldLabel label="Frequency" />
            <View style={styles.segmentRow}>
              {FREQUENCIES.map(f => {
                const active = frequency === f.value;
                return (
                  <TouchableOpacity
                    key={f.value}
                    style={[styles.segment, active && styles.segmentActive]}
                    onPress={() => setFrequency(f.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Start date */}
          <View style={styles.fieldGroup}>
            <FieldLabel label="Start date" />
            <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
              <Text style={{ color: Colors.text, fontSize: 15 }}>
                {startDate.toLocaleDateString('en-CA')}
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

          {/* Group */}
          <View style={styles.fieldGroup}>
            <FieldLabel label="Group" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity
                style={[styles.groupChip, selectedGroup === null && styles.groupChipActive]}
                onPress={() => handleGroupSelect(null)}
                activeOpacity={0.7}
              >
                <Ionicons name="person-outline" size={14} color={selectedGroup === null ? '#fff' : Colors.textMuted} />
                <Text style={[styles.groupChipText, selectedGroup === null && styles.groupChipTextActive]}>None</Text>
              </TouchableOpacity>
              {groups.map(g => {
                const active = selectedGroup?.id === g.id;
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.groupChip, active && styles.groupChipActive]}
                    onPress={() => handleGroupSelect(g)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="people-outline" size={14} color={active ? '#fff' : Colors.textMuted} />
                    <Text style={[styles.groupChipText, active && styles.groupChipTextActive]}>{g.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Participants */}
          {selectedGroup !== null && participants.length > 0 && (
            <>
              {/* Split type */}
              <View style={styles.fieldGroup}>
                <FieldLabel label="Split type" />
                <View style={styles.segmentRow}>
                  {SPLIT_TYPES.map(s => {
                    const active = splitType === s.value;
                    return (
                      <TouchableOpacity
                        key={s.value}
                        style={[styles.segment, active && styles.segmentActive]}
                        onPress={() => setSplitType(s.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{s.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.splitHint}>
                  {SPLIT_TYPES.find(s => s.value === splitType)?.hint}
                </Text>
              </View>

              {/* Participant rows */}
              <View style={styles.fieldGroup}>
                <FieldLabel label="Participants" />
                <View style={styles.participantList}>
                  {participants.map((p, idx) => (
                    <View key={p.user.id} style={styles.participantRow}>
                      <View style={styles.participantAvatar}>
                        <Text style={styles.participantInitial}>
                          {p.user.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.participantName} numberOfLines={1}>{p.user.name}</Text>
                      {splitType !== 'EQUAL' && (
                        <TextInput
                          style={styles.splitInput}
                          value={p.splitValue}
                          onChangeText={v => updateSplitValue(idx, v)}
                          placeholder={splitType === 'PERCENTAGE' ? '%' : currency}
                          placeholderTextColor={Colors.textMuted}
                          keyboardType="decimal-pad"
                        />
                      )}
                      {splitType === 'EQUAL' && (
                        <Text style={styles.equalBadge}>Equal</Text>
                      )}
                      <TouchableOpacity onPress={() => removeParticipant(idx)} hitSlop={8}>
                        <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* Bottom padding so footer doesn't overlap last field */}
          <View style={{ height: 16 }} />
        </ScrollView>

        {/* Sticky footer */}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },

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

  content: { padding: 16, gap: 4 },

  fieldGroup: { gap: 6, marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },

  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },

  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },

  categoryScroll: { marginTop: 2 },

  groupChip: {
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
  groupChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  groupChipText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  groupChipTextActive: { color: '#fff' },

  segmentRow: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  segmentActive: { backgroundColor: Colors.primary },
  segmentText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  segmentTextActive: { color: '#fff' },
  splitHint: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },

  participantList: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  participantAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantInitial: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  participantName: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.text },
  equalBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  splitInput: {
    width: 72,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    color: Colors.text,
    textAlign: 'right',
    backgroundColor: Colors.background,
  },

  footer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  saveBtn: {
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
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
