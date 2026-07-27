import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { updateProfile } from '../api/users';
import { useAuthStore } from '../store/authStore';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'EditProfile'> };

const fallbackAvatar = require('../../assets/icon.png');

export default function EditProfileScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState(user?.name ?? '');
  const [userName, setUserName] = useState(user?.userName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [website, setWebsite] = useState(user?.website ?? '');
  const [instagram, setInstagram] = useState(user?.instagram ?? '');
  const [telegram, setTelegram] = useState(user?.telegram ?? '');
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const avatar = imageUri
    ? { uri: imageUri }
    : user.profileImage
      ? { uri: user.profileImage }
      : fallbackAvatar;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нужен доступ к галерее');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Камера', 'Разрешите доступ к камере, чтобы сделать фото профиля.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!name.trim() || !userName.trim()) {
      Alert.alert('Ошибка', 'Имя и username обязательны');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile({
        name: name.trim(),
        userName: userName.trim(),
        bio: bio.trim(),
        location: location.trim(),
        website: website.trim(),
        instagram: instagram.trim(),
        telegram: telegram.trim(),
      }, imageUri);
      setUser(updated);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.avatarWrap} onPress={pickImage} activeOpacity={0.85}>
          <Image source={avatar} style={styles.avatar} />
          <View style={styles.avatarBadge}>
            <Ionicons name="camera" size={16} color={colors.onAccent} />
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Нажмите на фото, чтобы изменить</Text>

        <Text style={styles.sectionHeader}>Основное</Text>
        <Field label="Имя" icon="person-outline" value={name} onChangeText={setName} />
        <Field label="Username" icon="at-outline" value={userName} onChangeText={setUserName} autoCapitalize="none" />
        <Field label="О себе" icon="document-text-outline" value={bio} onChangeText={setBio} multiline maxLength={160} />
        <Field label="Город" icon="location-outline" value={location} onChangeText={setLocation} />

        <Text style={styles.sectionHeader}>Ссылки</Text>
        <Field label="Сайт" icon="link-outline" value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" />
        <Field label="Instagram" icon="logo-instagram" value={instagram} onChangeText={setInstagram} autoCapitalize="none" />
        <Field label="Telegram" icon="paper-plane-outline" value={telegram} onChangeText={setTelegram} autoCapitalize="none" />

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.disabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.saveText}>Сохранить</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

function Field({ label, icon, style, multiline, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, multiline && styles.inputRowMultiline]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.textFaint} style={styles.inputIcon} /> : null}
        <TextInput
          {...props}
          style={[styles.input, multiline && styles.multiline, style]}
          placeholderTextColor={colors.textFaint}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 18, paddingBottom: 40 },
  avatarWrap: { alignSelf: 'center', marginBottom: 8, position: 'relative' },
  avatarHint: { alignSelf: 'center', color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 22 },
  avatar: { width: 104, height: 104, borderRadius: 52, backgroundColor: colors.surfaceAlt },
  avatarBadge: {
    position: 'absolute', right: 2, bottom: 2,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: colors.bg,
  },
  avatarActions: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  avatarActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  avatarActionText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  sectionHeader: { color: colors.text, fontSize: 12, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 10, marginBottom: 12, marginLeft: 2 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '800', color: colors.textMuted, marginBottom: 8, marginLeft: 2 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt, paddingHorizontal: 14,
  },
  inputRowMultiline: { alignItems: 'flex-start', paddingVertical: 12 },
  inputIcon: { marginTop: 1 },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },
  multiline: { minHeight: 72, paddingVertical: 0, lineHeight: 20 },
  saveBtn: {
    height: 52, borderRadius: 14, backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center', marginTop: 10,
  },
  disabled: { opacity: 0.6 },
  saveText: { color: colors.onAccent, fontWeight: '700', fontSize: 16 },
});
