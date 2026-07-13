import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createPost } from '../api/posts';
import { AppStackParamList } from '../navigation/AppNavigator';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'CreatePost'> };

const MEDIA_LIMIT = 8;

export default function CreatePostScreen({ navigation }: Props) {
  const [caption, setCaption] = useState('');
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Доступ к галерее', 'Разрешите доступ к фото, чтобы добавить медиа.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MEDIA_LIMIT,
      quality: 0.82,
    });

    if (!result.canceled) {
      const selected = result.assets.map((asset) => asset.uri);
      setMediaUris((prev) => [...prev, ...selected].slice(0, MEDIA_LIMIT));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Доступ к камере', 'Разрешите доступ к камере, чтобы сделать фото.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.82 });
    if (!result.canceled) {
      setMediaUris((prev) => [...prev, result.assets[0].uri].slice(0, MEDIA_LIMIT));
    }
  };

  const removeMedia = (uri: string) => {
    setMediaUris((prev) => prev.filter((item) => item !== uri));
  };

  const handlePost = async () => {
    if (!mediaUris.length) {
      Alert.alert('Публикация', 'Добавьте хотя бы одно фото.');
      return;
    }

    setLoading(true);
    try {
      await createPost({
        caption: caption.trim(),
        mediaUris,
        mediaType: 'image',
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось опубликовать');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={loading}>
          <Text style={styles.cancel}>Отмена</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Новая публикация</Text>
        <TouchableOpacity onPress={handlePost} disabled={loading || !mediaUris.length}>
          {loading ? (
            <ActivityIndicator color="#111" />
          ) : (
            <Text style={[styles.post, !mediaUris.length && styles.postDisabled]}>Опубликовать</Text>
          )}
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Добавьте подпись..."
        placeholderTextColor="#999"
        multiline
        value={caption}
        onChangeText={setCaption}
        maxLength={500}
        textAlignVertical="top"
      />
      <Text style={styles.charCount}>{caption.length}/500</Text>

      <View style={styles.mediaPanel}>
        <View style={styles.mediaHeader}>
          <Text style={styles.sectionTitle}>Медиа</Text>
          <Text style={styles.mediaCount}>{mediaUris.length}/{MEDIA_LIMIT}</Text>
        </View>

        {mediaUris.length ? (
          <View style={styles.previewGrid}>
            {mediaUris.map((uri, index) => (
              <View key={uri} style={styles.previewItem}>
                <Image source={{ uri }} style={styles.previewImage} />
                <Text style={styles.previewIndex}>{index + 1}</Text>
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeMedia(uri)}>
                  <Ionicons name="close" size={15} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyMedia}>
            <Ionicons name="images-outline" size={38} color="#bbb" />
            <Text style={styles.emptyTitle}>Добавьте фото</Text>
          </View>
        )}

        <View style={styles.mediaButtons}>
          <TouchableOpacity style={styles.mediaBtn} onPress={takePhoto} disabled={loading || mediaUris.length >= MEDIA_LIMIT}>
            <Ionicons name="camera-outline" size={23} color="#111" />
            <Text style={styles.mediaBtnText}>Камера</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaBtn} onPress={pickImages} disabled={loading || mediaUris.length >= MEDIA_LIMIT}>
            <Ionicons name="image-outline" size={23} color="#111" />
            <Text style={styles.mediaBtnText}>Галерея</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingBottom: 28 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  cancel: { fontSize: 15, color: '#555', fontWeight: '800' },
  title: { fontSize: 16, fontWeight: '900', color: '#111' },
  post: { fontSize: 15, fontWeight: '900', color: '#111' },
  postDisabled: { color: '#aaa' },
  input: { margin: 16, marginBottom: 6, fontSize: 16, color: '#111', lineHeight: 24, minHeight: 120, borderRadius: 10, backgroundColor: '#f7f7f7', padding: 12 },
  charCount: { textAlign: 'right', marginRight: 18, color: '#999', fontSize: 12, fontWeight: '700' },
  mediaPanel: { margin: 16, marginTop: 18, borderRadius: 8, borderWidth: 1, borderColor: '#ececec', backgroundColor: '#fff', padding: 12 },
  mediaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: '#111', fontSize: 17, fontWeight: '900' },
  mediaCount: { color: '#777', fontSize: 12, fontWeight: '900' },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewItem: { width: '31.8%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: '#eee' },
  previewImage: { width: '100%', height: '100%' },
  previewIndex: { position: 'absolute', left: 6, bottom: 6, overflow: 'hidden', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 10, fontWeight: '900' },
  removeBtn: { position: 'absolute', top: 5, right: 5, width: 23, height: 23, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  emptyMedia: { minHeight: 150, borderRadius: 8, backgroundColor: '#f7f7f7', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 8, color: '#777', fontSize: 14, fontWeight: '900' },
  mediaButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  mediaBtn: { flex: 1, height: 44, borderRadius: 8, backgroundColor: '#f4f4f4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  mediaBtnText: { color: '#111', fontSize: 14, fontWeight: '900' },
});
