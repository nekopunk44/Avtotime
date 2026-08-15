import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createPost } from '../api/posts';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import { colors } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'CreatePost'> };

const MEDIA_LIMIT = 8;

export default function CreatePostScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState('');
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [loading, setLoading] = useState(false);

  const isVideo = mediaType === 'video';
  const { markSaved } = useUnsavedGuard(navigation, Boolean(caption.trim() || mediaUris.length));

  const addImages = (uris: string[]) => {
    // Switching to photos discards a previously picked video
    setMediaType('image');
    setMediaUris((prev) => {
      const base = mediaType === 'video' ? [] : prev;
      return [...base, ...uris].slice(0, MEDIA_LIMIT);
    });
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Доступ к галерее', 'Разрешите доступ к медиатеке, чтобы добавить медиа.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MEDIA_LIMIT,
      quality: 0.82,
    });

    if (!result.canceled) {
      addImages(result.assets.map((asset) => asset.uri));
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
      addImages([result.assets[0].uri]);
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Доступ к галерее', 'Разрешите доступ к медиатеке, чтобы добавить видео.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: false,
      videoMaxDuration: 120,
      quality: 0.82,
    });

    if (!result.canceled) {
      // A post is either photos or a single video — a video replaces any photos
      setMediaType('video');
      setMediaUris([result.assets[0].uri]);
    }
  };

  const removeMedia = (uri: string) => {
    setMediaUris((prev) => prev.filter((item) => item !== uri));
  };

  const handlePost = async () => {
    if (!mediaUris.length) {
      Alert.alert('Публикация', 'Добавьте фото или видео.');
      return;
    }

    setLoading(true);
    try {
      await createPost({
        caption: caption.trim(),
        mediaUris,
        mediaType,
      });
      markSaved();
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось опубликовать');
    } finally {
      setLoading(false);
    }
  };

  const canPost = mediaUris.length > 0 && !loading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()} disabled={loading} hitSlop={8}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Новая публикация</Text>
        <TouchableOpacity
          style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
          onPress={handlePost}
          disabled={!canPost}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color={colors.onAccent} size="small" />
          ) : (
            <Text style={[styles.postBtnText, !canPost && styles.postBtnTextDisabled]}>Опубликовать</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!mediaUris.length ? (
          <TouchableOpacity style={styles.dropzone} onPress={pickImages} activeOpacity={0.9}>
            <View style={styles.emptyIcon}>
              <Ionicons name="images-outline" size={34} color={colors.text} />
            </View>
            <Text style={styles.emptyTitle}>Добавьте фото или видео</Text>
            <Text style={styles.emptySub}>До {MEDIA_LIMIT} фото или одно видео</Text>
          </TouchableOpacity>
        ) : isVideo ? (
          <View style={styles.videoPreview}>
            <View style={styles.videoPlayCircle}>
              <Ionicons name="play" size={28} color={colors.onAccent} />
            </View>
            <Text style={styles.videoPreviewText}>Видео готово к публикации</Text>
            <TouchableOpacity style={styles.removeBtn} onPress={() => removeMedia(mediaUris[0])}>
              <Ionicons name="close" size={15} color={colors.white} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.previewGrid}>
            {mediaUris.map((uri, index) => (
              <View key={uri} style={styles.previewItem}>
                <Image source={{ uri }} style={styles.previewImage} />
                <Text style={styles.previewIndex}>{index + 1}</Text>
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeMedia(uri)}>
                  <Ionicons name="close" size={15} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.mediaButtons}>
          <TouchableOpacity style={styles.mediaBtn} onPress={takePhoto} disabled={loading || (!isVideo && mediaUris.length >= MEDIA_LIMIT)}>
            <Ionicons name="camera-outline" size={20} color={colors.text} />
            <Text style={styles.mediaBtnText}>Камера</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaBtn} onPress={pickImages} disabled={loading || (!isVideo && mediaUris.length >= MEDIA_LIMIT)}>
            <Ionicons name="image-outline" size={20} color={colors.text} />
            <Text style={styles.mediaBtnText}>Фото</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaBtn} onPress={pickVideo} disabled={loading}>
            <Ionicons name="videocam-outline" size={20} color={colors.text} />
            <Text style={styles.mediaBtnText}>Видео</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.captionField}>
          <TextInput
            style={styles.input}
            placeholder="Добавьте подпись…"
            placeholderTextColor={colors.textFaint}
            multiline
            value={caption}
            onChangeText={setCaption}
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{caption.length}/500</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  headerTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  postBtn: { height: 40, minWidth: 116, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  postBtnDisabled: { backgroundColor: colors.surfaceAlt },
  postBtnText: { fontSize: 14, fontWeight: '900', color: colors.onAccent },
  postBtnTextDisabled: { color: colors.textFaint },

  content: { padding: 16, gap: 12, paddingBottom: 40 },
  input: { fontSize: 16, color: colors.text, lineHeight: 24, minHeight: 90 },
  charCount: { textAlign: 'right', marginTop: 6, color: colors.textFaint, fontSize: 12, fontWeight: '700' },
  captionField: { marginTop: 2, borderRadius: 16, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 14 },

  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewItem: { width: '31.6%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  previewImage: { width: '100%', height: '100%' },
  previewIndex: { position: 'absolute', left: 6, bottom: 6, overflow: 'hidden', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.65)', color: colors.white, fontSize: 10, fontWeight: '900' },
  removeBtn: { position: 'absolute', top: 5, right: 5, width: 23, height: 23, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  dropzone: { minHeight: 300, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  emptySub: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  videoPreview: { minHeight: 300, borderRadius: 18, backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center', gap: 12 },
  videoPlayCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingLeft: 4 },
  videoPreviewText: { color: colors.textMuted, fontSize: 14, fontWeight: '900' },
  mediaButtons: { flexDirection: 'row', gap: 8, marginTop: 2 },
  mediaBtn: { flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.surfaceAlt, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  mediaBtnText: { color: colors.text, fontSize: 13, fontWeight: '900' },
});
