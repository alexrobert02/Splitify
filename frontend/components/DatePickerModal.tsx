import { useState, useMemo, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, type ColorPalette } from '@/context/ThemeContext';

interface Props {
  visible: boolean;
  value: Date;
  minimumDate?: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function DatePickerModal({ visible, value, minimumDate, onSelect, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [viewYear, setViewYear]   = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());

  useEffect(() => {
    if (visible) {
      setViewYear(value.getFullYear());
      setViewMonth(value.getMonth());
    }
  }, [visible]);

  const rows = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [
      ...Array(firstWeekday).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length < 42) cells.push(null);
    const r: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) r.push(cells.slice(i, i + 7));
    return r;
  }, [viewYear, viewMonth]);

  const minDate = useMemo(() => {
    if (!minimumDate) return null;
    const d = new Date(minimumDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [minimumDate]);

  const isSelected = (d: number) =>
    d === value.getDate() && viewMonth === value.getMonth() && viewYear === value.getFullYear();

  const isToday = (d: number) => {
    const t = new Date();
    return d === t.getDate() && viewMonth === t.getMonth() && viewYear === t.getFullYear();
  };

  const isDisabled = (d: number) => {
    if (!minDate) return false;
    return new Date(viewYear, viewMonth, d) < minDate;
  };

  const canGoPrev = () => {
    if (!minDate) return true;
    return viewYear > minDate.getFullYear() ||
      (viewYear === minDate.getFullYear() && viewMonth > minDate.getMonth());
  };

  const prevMonth = () => {
    if (!canGoPrev()) return;
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleSelect = (d: number) => {
    if (isDisabled(d)) return;
    onSelect(new Date(viewYear, viewMonth, d));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.nav}>
            <TouchableOpacity
              style={[styles.navBtn, !canGoPrev() && styles.navBtnDisabled]}
              onPress={prevMonth}
              disabled={!canGoPrev()}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={18} color={canGoPrev() ? colors.text : colors.textMuted} />
            </TouchableOpacity>

            <Text style={styles.monthTitle}>{MONTHS[viewMonth]} {viewYear}</Text>

            <TouchableOpacity style={styles.navBtn} onPress={nextMonth} hitSlop={8}>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.dayLabelRow}>
            {DAY_LABELS.map(d => (
              <Text key={d} style={styles.dayLabel}>{d}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {rows.map((row, ri) => (
              <View key={ri} style={styles.row}>
                {row.map((d, ci) => {
                  if (d === null) return <View key={ci} style={styles.cell} />;
                  const selected = isSelected(d);
                  const disabled = isDisabled(d);
                  const today    = isToday(d);
                  return (
                    <TouchableOpacity
                      key={ci}
                      style={[
                        styles.cell,
                        selected  && styles.cellSelected,
                        !selected && today && styles.cellToday,
                      ]}
                      onPress={() => handleSelect(d)}
                      disabled={disabled}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.cellText,
                        selected  && styles.cellTextSelected,
                        disabled  && styles.cellTextDisabled,
                        !selected && today && styles.cellTextToday,
                      ]}>
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (c: ColorPalette) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 24,
  },
  sheet: {
    width: '100%',
    backgroundColor: c.surface,
    borderRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.35 },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
  },

  dayLabelRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: c.textMuted,
  },

  grid: { gap: 4 },
  row: { flexDirection: 'row' },

  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  cellSelected: {
    backgroundColor: c.primary,
  },
  cellToday: {
    backgroundColor: c.primaryLight,
  },
  cellText: {
    fontSize: 14,
    fontWeight: '500',
    color: c.text,
  },
  cellTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  cellTextDisabled: {
    color: c.textMuted,
    opacity: 0.4,
  },
  cellTextToday: {
    color: c.primary,
    fontWeight: '700',
  },

  doneBtn: {
    marginTop: 20,
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
