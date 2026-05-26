import { useState } from 'react';
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
import { Colors } from '@/constants/Colors';
import { CurrencyPickerModal } from '@/components/CurrencyPickerModal';

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
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

            {/* Email — not editable */}
            <View style={styles.menuItem}>
              <View style={styles.menuLeft}>
                <View style={[styles.menuIcon, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="mail" size={18} color="#6366F1" />
                </View>
                <View>
                  <Text style={styles.menuText}>Email</Text>
                  <Text style={styles.menuSub}>{user?.email}</Text>
                </View>
              </View>
            </View>

            <View style={styles.separator} />

            {/* Display name */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setEditingName(true); setEditingRevolut(false); }}
              disabled={editingName}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIcon, { backgroundColor: Colors.primaryLight }]}>
                  <Ionicons name="person" size={18} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.menuText}>Display name</Text>
                  <Text style={styles.menuSub}>{user?.name}</Text>
                </View>
              </View>
              {!editingName && <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />}
            </TouchableOpacity>
            {editingName && (
              <View style={styles.inlineForm}>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                  placeholder="Your name"
                  placeholderTextColor={Colors.textMuted}
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

            {/* Revolut */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setEditingRevolut(true); setEditingName(false); }}
              disabled={editingRevolut}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIcon, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="card-outline" size={18} color="#7C3AED" />
                </View>
                <View>
                  <Text style={styles.menuText}>Revolut</Text>
                  <Text style={styles.menuSub}>
                    {user?.revolutTag ? `@${user.revolutTag}` : 'Not set — tap to add'}
                  </Text>
                </View>
              </View>
              {!editingRevolut && <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />}
            </TouchableOpacity>
            {editingRevolut && (
              <View style={styles.inlineForm}>
                <TextInput
                  style={styles.input}
                  value={revolutTag}
                  onChangeText={setRevolutTag}
                  autoFocus
                  placeholder="e.g. john-doe"
                  placeholderTextColor={Colors.textMuted}
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

            {/* Preferred currency */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setCurrencyPickerVisible(true)}
              disabled={savingCurrency}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIcon, { backgroundColor: '#ECFDF5' }]}>
                  {savingCurrency
                    ? <ActivityIndicator size="small" color="#10B981" />
                    : <Ionicons name="globe-outline" size={18} color="#10B981" />}
                </View>
                <View>
                  <Text style={styles.menuText}>Preferred Currency</Text>
                  <Text style={styles.menuSub}>{user?.preferredCurrency ?? 'RON'}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>

          </View>
        </View>

        <CurrencyPickerModal
          visible={currencyPickerVisible}
          selected={user?.preferredCurrency ?? 'RON'}
          onSelect={handleSaveCurrency}
          onClose={() => setCurrencyPickerVisible(false)}
        />

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { paddingBottom: 48 },
  headerRow: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  heading: { fontSize: 24, fontWeight: '800', color: Colors.text },
  avatarSection: { alignItems: 'center', paddingTop: 12, paddingBottom: 28, paddingHorizontal: 20 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  avatarText: { fontSize: 30, fontWeight: '800', color: '#fff' },
  userName: { fontSize: 22, fontWeight: '800', color: Colors.text },
  userEmail: { fontSize: 14, color: Colors.textSecondary, marginTop: 3 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
    marginBottom: 12,
  },
  inlineForm: { paddingHorizontal: 16, paddingBottom: 14 },
  editActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  btnDisabled: { opacity: 0.6 },
  section: { marginHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, marginLeft: 4 },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  separator: { height: 1, backgroundColor: Colors.divider, marginLeft: 62 },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIcon: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  menuText: { fontSize: 15, fontWeight: '600', color: Colors.text },
  menuSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.errorLight,
    borderRadius: 16,
    paddingVertical: 15,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: Colors.error },
});
