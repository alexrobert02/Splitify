import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useTheme, type ColorPalette } from '@/context/ThemeContext';

export default function ScanScreen() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);

  const pickImage = async (fromCamera: boolean) => {
    const { status } = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission needed', fromCamera ? 'Camera access is required' : 'Gallery access is required');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: 'images',
          quality: 0.8,
          allowsEditing: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          quality: 0.8,
          allowsEditing: true,
        });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!imageUri || !title.trim()) return;
    setUploading(true);
    try {
      const receipt = await api.receipts.scan(imageUri, title.trim(), groupId);
      router.replace(`/receipt/review?id=${receipt.id}&source=scan` as any);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Please try again');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Receipt</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={[styles.imageBox, imageUri && styles.imageBoxFilled]}
            onPress={() => pickImage(false)}
            activeOpacity={0.8}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="receipt-outline" size={56} color={colors.textMuted} />
                <Text style={styles.placeholderText}>Tap to select a receipt image</Text>
                <Text style={styles.placeholderSub}>JPG or PNG supported</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.pickerRow}>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => pickImage(true)}>
              <Ionicons name="camera" size={20} color={colors.primary} />
              <Text style={styles.pickerBtnText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => pickImage(false)}>
              <Ionicons name="images" size={20} color={colors.primary} />
              <Text style={styles.pickerBtnText}>Gallery</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Dinner at Pizza Place"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={18} color={colors.primary} />
            <Text style={styles.infoText}>
              Our OCR engine will automatically extract items, quantities and prices from your receipt.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.uploadBtn, (!imageUri || !title.trim() || uploading) && styles.btnDisabled]}
            onPress={handleUpload}
            disabled={!imageUri || !title.trim() || uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={20} color="#fff" />
                <Text style={styles.uploadBtnText}>Process Receipt</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  imageBox: {
    height: 240,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: c.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: c.surface,
  },
  imageBoxFilled: { borderStyle: 'solid', borderColor: c.primary },
  previewImage: { width: '100%', height: '100%' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  placeholderText: { fontSize: 15, fontWeight: '600', color: c.textSecondary },
  placeholderSub: { fontSize: 13, color: c.textMuted },
  pickerRow: { flexDirection: 'row', gap: 12 },
  pickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.primaryLight,
    borderRadius: 12,
    paddingVertical: 12,
  },
  pickerBtnText: { fontSize: 14, fontWeight: '700', color: c.primary },
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
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: c.primaryLight,
    borderRadius: 12,
    padding: 14,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 13, color: c.primaryDark, lineHeight: 20 },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 8 : 20,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.surface,
  },
  uploadBtn: {
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
  btnDisabled: { opacity: 0.5 },
  uploadBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
