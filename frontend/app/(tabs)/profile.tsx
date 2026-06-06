import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useTheme, type ColorPalette, type ColorSchemePreference } from '@/context/ThemeContext';
import { CurrencyPickerModal } from '@/components/CurrencyPickerModal';

const THEME_OPTIONS: { value: ColorSchemePreference; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { value: 'light',  label: 'Light',  icon: 'sunny-outline' },
  { value: 'dark',   label: 'Dark',   icon: 'moon-outline' },
];

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const { colors, colorScheme, setColorScheme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [editingName, setEditingName] = useState(false);
  const [editingRevolut, setEditingRevolut] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [revolutTag, setRevolutTag] = useState(user?.revolutTag ?? '');
  const [savingName, setSavingName] = useState(false);
  const [savingRevolut, setSavingRevolut] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSavingName(true);
    try {
      await api.users.update({ name: name.trim() });
      await refreshUser();
      setEditingName(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveRevolut = async () => {
    setSavingRevolut(true);
    try {
      await api.users.update({ revolutTag: revolutTag.trim() || undefined });
      await refreshUser();
      setEditingRevolut(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingRevolut(false);
    }
  };

  const handleSaveCurrency = async (code: string) => {
    setSavingCurrency(true);
    try {
      await api.users.update({ preferredCurrency: code });
      await refreshUser();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingCurrency(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login' as any);
        },
      },
    ]);
  };

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Profile</Text>
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionCard}>

            <View style={styles.menuItem}>
              <View style={styles.menuLeft}>
                <View style={[styles.menuIcon, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="mail" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.menuText}>Email</Text>
                  <Text style={styles.menuSub}>{user?.email}</Text>
                </View>
              </View>
            </View>

            <View style={styles.separator} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setEditingName(true); setEditingRevolut(false); }}
              disabled={editingName}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIcon, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="person" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.menuText}>Display name</Text>
                  <Text style={styles.menuSub}>{user?.name}</Text>
                </View>
              </View>
              {!editingName && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
            </TouchableOpacity>
            {editingName && (
              <View style={styles.inlineForm}>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                  placeholder="Your name"
                  placeholderTextColor={colors.textMuted}
                />
                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditingName(false); setName(user?.name ?? ''); }}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveBtn, savingName && styles.btnDisabled]} onPress={handleSaveName} disabled={savingName}>
                    {savingName ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Save</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.separator} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setEditingRevolut(true); setEditingName(false); }}
              disabled={editingRevolut}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIcon, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="card-outline" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.menuText}>Revolut</Text>
                  <Text style={styles.menuSub}>
                    {user?.revolutTag ? `@${user.revolutTag}` : 'Not set — tap to add'}
                  </Text>
                </View>
              </View>
              {!editingRevolut && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
            </TouchableOpacity>
            {editingRevolut && (
              <View style={styles.inlineForm}>
                <TextInput
                  style={styles.input}
                  value={revolutTag}
                  onChangeText={setRevolutTag}
                  autoFocus
                  placeholder="e.g. john-doe"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditingRevolut(false); setRevolutTag(user?.revolutTag ?? ''); }}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveBtn, savingRevolut && styles.btnDisabled]} onPress={handleSaveRevolut} disabled={savingRevolut}>
                    {savingRevolut ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Save</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.separator} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setCurrencyPickerVisible(true)}
              disabled={savingCurrency}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIcon, { backgroundColor: colors.successLight }]}>
                  {savingCurrency
                    ? <ActivityIndicator size="small" color={colors.success} />
                    : <Ionicons name="globe-outline" size={18} color={colors.success} />}
                </View>
                <View>
                  <Text style={styles.menuText}>Preferred Currency</Text>
                  <Text style={styles.menuSub}>{user?.preferredCurrency ?? 'RON'}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.sectionCard}>
            <View style={styles.menuItem}>
              <View style={styles.menuLeft}>
                <View style={[styles.menuIcon, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="color-palette-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.menuText}>Theme</Text>
              </View>
            </View>
            <View style={styles.themeRow}>
              {THEME_OPTIONS.map((opt) => {
                const active = colorScheme === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.themeChip, active && styles.themeChipActive]}
                    onPress={() => setColorScheme(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={16}
                      color={active ? '#fff' : colors.textSecondary}
                    />
                    <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <CurrencyPickerModal
          visible={currencyPickerVisible}
          selected={user?.preferredCurrency ?? 'RON'}
          onSelect={handleSaveCurrency}
          onClose={() => setCurrencyPickerVisible(false)}
        />

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  container: { paddingBottom: 48 },
  headerRow: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  heading: { fontSize: 24, fontWeight: '800', color: c.text },
  avatarSection: { alignItems: 'center', paddingTop: 12, paddingBottom: 28, paddingHorizontal: 20 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: c.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  avatarText: { fontSize: 30, fontWeight: '800', color: '#fff' },
  userName: { fontSize: 22, fontWeight: '800', color: c.text },
  userEmail: { fontSize: 14, color: c.textSecondary, marginTop: 3 },
  input: {
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: c.text,
    backgroundColor: c.background,
    marginBottom: 12,
  },
  inlineForm: { paddingHorizontal: 16, paddingBottom: 14 },
  editActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
  saveBtn: {
    flex: 1,
    backgroundColor: c.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  btnDisabled: { opacity: 0.6 },
  section: { marginHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: c.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, marginLeft: 4 },
  sectionCard: {
    backgroundColor: c.surface,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  separator: { height: 1, backgroundColor: c.divider, marginLeft: 62 },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIcon: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  menuText: { fontSize: 15, fontWeight: '600', color: c.text },
  menuSub: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  themeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.background,
  },
  themeChipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  themeChipText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
  themeChipTextActive: { color: '#fff' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.errorLight,
    borderRadius: 16,
    paddingVertical: 15,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: c.error },
});
