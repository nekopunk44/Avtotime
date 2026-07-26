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
        <TouchableOpacity style={styles.avatarWrap} onPress={pickImage}>
          <Image source={avatar} style={styles.avatar} />
          <View style={styles.avatarBadge}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={styles.avatarActions}>
          <TouchableOpacity style={styles.avatarActionBtn} onPress={takePhoto} disabled={saving}>
            <Ionicons name="camera-outline" size={18} color={colors.text} />
            <Text style={styles.avatarActionText}>Камера</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarActionBtn} onPress={pickImage} disabled={saving}>
            <Ionicons name="image-outline" size={18} color={colors.text} />
            <Text style={styles.avatarActionText}>Галерея</Text>
          </TouchableOpacity>
          {imageUri ? (
            <TouchableOpacity style={styles.avatarActionBtn} onPress={() => setImageUri(undefined)} disabled={saving}>
              <Ionicons name="refresh-outline" size={18} color={colors.text} />
              <Text style={styles.avatarActionText}>Сброс</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Field label="Имя" value={name} onChangeText={setName} />
        <Field label="Username" value={userName} onChangeText={setUserName} autoCapitalize="none" />
        <Field label="О себе" value={bio} onChangeText={setBio} multiline maxLength={160} />
        <Field label="Город" value={location} onChangeText={setLocation} />
        <Field label="Сайт" value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" />
        <Field label="Instagram" value={instagram} onChangeText={setInstagram} autoCapitalize="none" />
        <Field label="Telegram" value={telegram} onChangeText={setTelegram} autoCapitalize="none" />

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.disabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Сохранить</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & { label: string };

function Field({ label, style, multiline, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.input, multiline && styles.multiline, style]}
        placeholderTextColor={colors.textFaint}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 18, paddingBottom: 34 },
  avatarWrap: { alignSelf: 'center', marginBottom: 24, position: 'relative' },
  avatar: { width: 104, height: 104, borderRadius: 52, backgroundColor: colors.surfaceAlt },
  avatarBadge: {
    position: 'absolute', right: 2, bottom: 2,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surfaceHi, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  avatarActions: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  avatarActionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  avatarActionText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 7 },
  input: {
    minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: colors.text,
    backgroundColor: colors.surface,
  },
  multiline: { minHeight: 94, lineHeight: 20 },
  saveBtn: {
    height: 52, borderRadius: 14, backgroundColor: colors.surfaceHi,
    justifyContent: 'center', alignItems: 'center', marginTop: 10,
  },
  disabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
