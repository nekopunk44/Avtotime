import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createPost } from '../api/posts';
import { AppStackParamList } from '../navigation/AppNavigator';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'CreatePost'> };

export default function CreatePostScreen({ navigation }: Props) {
  const [caption, setCaption] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Нужен доступ к галерее'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) setMediaUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Нужен доступ к камере'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!result.canceled) setMediaUri(result.assets[0].uri);
  };

  const handlePost = async () => {
    if (!mediaUri) { Alert.alert('Выберите фото'); return; }
    setLoading(true);
    try {
      await createPost(caption, mediaUri);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось опубликовать');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancel}>Отмена</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Новая публикация</Text>
        <TouchableOpacity onPress={handlePost} disabled={loading || !mediaUri}>
          {loading
            ? <ActivityIndicator color="#0066ff" />
            : <Text style={[styles.post, !mediaUri && styles.postDisabled]}>Опубликовать</Text>
          }
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Добавьте подпись..."
        placeholderTextColor="#aaa"
        multiline
        value={caption}
        onChangeText={setCaption}
        maxLength={500}
      />
      <Text style={styles.charCount}>{caption.length}/500</Text>

      {mediaUri ? (
        <View style={styles.preview}>
          <Image source={{ uri: mediaUri }} style={styles.previewImage} />
          <TouchableOpacity style={styles.removeBtn} onPress={() => setMediaUri(null)}>
            <Ionicons name="close-circle" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.mediaButtons}>
          <TouchableOpacity style={styles.mediaBtn} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={28} color="#555" />
            <Text style={styles.mediaBtnText}>Камера</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaBtn} onPress={pickImage}>
            <Ionicons name="image-outline" size={28} color="#555" />
            <Text style={styles.mediaBtnText}>Галерея</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  cancel: { fontSize: 16, color: '#555' },
  title: { fontSize: 16, fontWeight: '700', color: '#111' },
  post: { fontSize: 16, fontWeight: '700', color: '#0066ff' },
  postDisabled: { color: '#aaa' },
  input: {
    margin: 16, fontSize: 16, color: '#111', lineHeight: 24,
    minHeight: 120, textAlignVertical: 'top',
  },
  charCount: { textAlign: 'right', marginRight: 16, color: '#bbb', fontSize: 12 },
  mediaButtons: {
    flexDirection: 'row', justifyContent: 'center', gap: 24,
    marginTop: 32, paddingVertical: 24, borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  mediaBtn: { alignItems: 'center', gap: 6 },
  mediaBtnText: { fontSize: 13, color: '#555' },
  preview: { margin: 16, position: 'relative' },
  previewImage: { width: '100%', aspectRatio: 1, borderRadius: 12 },
  removeBtn: { position: 'absolute', top: 8, right: 8 },
});
