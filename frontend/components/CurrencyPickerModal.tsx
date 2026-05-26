import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { CURRENCIES } from '@/constants/currencies';

interface Props {
  visible: boolean;
  selected: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

export function CurrencyPickerModal({ visible, selected, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Select Currency</Text>
        <FlatList
          data={CURRENCIES}
          keyExtractor={(item) => item.code}
          renderItem={({ item }) => {
            const active = item.code === selected;
            return (
              <TouchableOpacity
                style={[styles.row, active && styles.rowActive]}
                onPress={() => { onSelect(item.code); onClose(); }}
                activeOpacity={0.7}
              >
                <View style={styles.rowLeft}>
                  <Text style={[styles.code, active && styles.codeActive]}>{item.code}</Text>
                  <Text style={styles.name}>{item.name}</Text>
                </View>
                {active && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      </View>
    </Modal>
  );
}

export function CurrencySelector({
  value,
  onPress,
  label,
}: {
  value: string;
  onPress: () => void;
  label?: string;
}) {
  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity style={styles.selector} onPress={onPress} activeOpacity={0.7}>
        <Ionicons name="globe-outline" size={16} color={Colors.primary} />
        <Text style={styles.selectorText}>{value}</Text>
        <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
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
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowActive: { backgroundColor: Colors.primaryLight },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  code: { fontSize: 15, fontWeight: '700', color: Colors.text, width: 44 },
  codeActive: { color: Colors.primary },
  name: { fontSize: 14, color: Colors.textSecondary },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
  },
  selectorText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
});
