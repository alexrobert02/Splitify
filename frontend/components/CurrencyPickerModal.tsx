import { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, type ColorPalette } from '@/context/ThemeContext';
import { CURRENCIES } from '@/constants/currencies';

interface Props {
  visible: boolean;
  selected: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

export function CurrencyPickerModal({ visible, selected, onSelect, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Select Currency</Text>
          <FlatList
            data={CURRENCIES}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
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
                  {active && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
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

export function CurrencySelector({
  value,
  onPress,
  label,
}: {
  value: string;
  onPress: () => void;
  label?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity style={styles.selector} onPress={onPress} activeOpacity={0.7}>
        <Ionicons name="globe-outline" size={16} color={colors.primary} />
        <Text style={styles.selectorText}>{value}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
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
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  rowActive: { backgroundColor: c.primaryLight },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  code: { fontSize: 15, fontWeight: '700', color: c.text, width: 44 },
  codeActive: { color: c.primary },
  name: { fontSize: 14, color: c.textSecondary },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: c.text,
    marginBottom: 6,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: c.surface,
  },
  selectorText: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },
});
