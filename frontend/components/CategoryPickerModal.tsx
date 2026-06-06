import { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, type ColorPalette } from '@/context/ThemeContext';
import { useCategoryConfig } from '@/constants/categories';
import type { ReceiptCategory } from '@/types';

interface ModalProps {
  visible: boolean;
  selected: ReceiptCategory | null;
  onSelect: (value: ReceiptCategory) => void;
  onClose: () => void;
}

export function CategoryPickerModal({ visible, selected, onSelect, onClose }: ModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const catConfig = useCategoryConfig();
  const categories = useMemo(
    () => (Object.entries(catConfig) as [ReceiptCategory, (typeof catConfig)[ReceiptCategory]][]).map(([value, cfg]) => ({ value, ...cfg })),
    [catConfig]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Select Category</Text>
          <FlatList
            data={categories}
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = item.value === selected;
              return (
                <TouchableOpacity
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => { onSelect(item.value); onClose(); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBox, { backgroundColor: item.bgColor }]}>
                    <Ionicons name={item.icon} size={18} color={item.color} />
                  </View>
                  <Text style={[styles.label, active && { color: item.color, fontWeight: '700' }]}>
                    {item.label}
                  </Text>
                  {active && <Ionicons name="checkmark-circle" size={20} color={item.color} />}
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        </View>
      </View>
    </Modal>
  );
}

interface SelectorProps {
  value: ReceiptCategory | null;
  onPress: () => void;
  placeholder?: string;
}

export function CategorySelector({ value, onPress, placeholder = 'Select category' }: SelectorProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const catConfig = useCategoryConfig();
  const cfg = value ? catConfig[value] : null;
  return (
    <TouchableOpacity style={styles.selector} onPress={onPress} activeOpacity={0.7}>
      {cfg ? (
        <>
          <View style={[styles.selectorIcon, { backgroundColor: cfg.bgColor }]}>
            <Ionicons name={cfg.icon} size={16} color={cfg.color} />
          </View>
          <Text style={[styles.selectorText, { color: cfg.color, fontWeight: '700' }]}>{cfg.label}</Text>
        </>
      ) : (
        <>
          <Ionicons name="grid-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.selectorText, { color: colors.textMuted }]}>{placeholder}</Text>
        </>
      )}
      <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const getStyles = (c: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  rowActive: { backgroundColor: c.primaryLight },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { flex: 1, fontSize: 15, color: c.text },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: c.surface,
  },
  selectorIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorText: { flex: 1, fontSize: 15 },
});
