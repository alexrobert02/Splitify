import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { CATEGORY_CONFIG } from '@/constants/categories';
import type { ReceiptCategory } from '@/types';

const CATEGORIES = (
  Object.entries(CATEGORY_CONFIG) as [ReceiptCategory, (typeof CATEGORY_CONFIG)[ReceiptCategory]][]
).map(([value, cfg]) => ({ value, ...cfg }));

interface ModalProps {
  visible: boolean;
  selected: ReceiptCategory | null;
  onSelect: (value: ReceiptCategory) => void;
  onClose: () => void;
}

export function CategoryPickerModal({ visible, selected, onSelect, onClose }: ModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Select Category</Text>
        <FlatList
          data={CATEGORIES}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => {
            const active = item.value === selected;
            return (
              <TouchableOpacity
                style={[styles.row, active && styles.rowActive]}
                onPress={() => { onSelect(item.value); onClose(); }}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
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
    </Modal>
  );
}

interface SelectorProps {
  value: ReceiptCategory | null;
  onPress: () => void;
  placeholder?: string;
}

export function CategorySelector({ value, onPress, placeholder = 'Select category' }: SelectorProps) {
  const cfg = value ? CATEGORY_CONFIG[value] : null;
  return (
    <TouchableOpacity style={styles.selector} onPress={onPress} activeOpacity={0.7}>
      {cfg ? (
        <>
          <View style={[styles.selectorIcon, { backgroundColor: cfg.color + '20' }]}>
            <Ionicons name={cfg.icon} size={16} color={cfg.color} />
          </View>
          <Text style={[styles.selectorText, { color: cfg.color, fontWeight: '700' }]}>{cfg.label}</Text>
        </>
      ) : (
        <>
          <Ionicons name="grid-outline" size={16} color={Colors.textMuted} />
          <Text style={[styles.selectorText, { color: Colors.textMuted }]}>{placeholder}</Text>
        </>
      )}
      <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
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
    backgroundColor: Colors.border,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
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
    borderBottomColor: Colors.divider,
  },
  rowActive: { backgroundColor: Colors.primaryLight },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { flex: 1, fontSize: 15, color: Colors.text },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
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
