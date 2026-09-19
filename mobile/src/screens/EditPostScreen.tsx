import React, { useMemo, useState } from 'react';
import { showToast } from '../store/toastStore';
import {
  ActivityIndicator,
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
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { editPost } from '../api/posts';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import { colors } from '../theme';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'EditPost'>;
  route: RouteProp<AppStackParamList, 'EditPost'>;
};

const MEDIA_LIMIT = 8;

export default function EditPostScreen({ navigation, route }: Props) {
  const { post } = route.params;
  const [caption, setCaption] = useState(post.caption || '');
  const [replacementUris, setReplacementUris] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { markSaved, guardSheet } = useUnsavedGuard(navigation, caption !== (post.caption || '') || replacementUris.length > 0);
  const existingMediaUris = useMemo(
    () => (post.mediaList?.length ? post.mediaList : post.media ? [post.media] : []),
    [post.media, post.mediaList],
  );
  const displayUris = replacementUris.length ? replacementUris : existingMediaUris;
  const isReplacingMedia = replacementUris.length > 0;

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Разрешите доступ к фото, чтобы заменить медиа публикации.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MEDIA_LIMIT,
      quality: 0.82,
    });

    if (!result.canceled) {
      setReplacementUris(result.assets.map((asset) => asset.uri).slice(0, MEDIA_LIMIT));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showToast('Разрешите доступ к камере, чтобы сделать новое фото.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.82 });
    if (!result.canceled) {
      setReplacementUris([result.assets[0].uri]);
    }
  };

  const removeReplacement = (uri: string) => {
    setReplacementUris((prev) => prev.filter((item) => item !== uri));
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await editPost(post._id, {
        caption: caption.trim(),
        mediaUris: replacementUris,
        mediaType: 'image',
      });
      showToast('Публикация обновлена', 'success');
      markSaved();
      navigation.replace('PostComments', { postId: updated._id });
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось сохранить публикацию', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.mediaPanel}>
        <View style={styles.mediaHeader}>
          <View>
            <Text style={styles.sectionTitle}>{isReplacingMedia ? 'Новые фото' : 'Текущие медиа'}</Text>
            <Text style={styles.sectionHint}>{isReplacingMedia ? 'Будут загружены после сохранения' : 'Сейчас прикреплены к посту'}</Text>
          </View>
          <Text style={styles.mediaCount}>{displayUris.length}/{MEDIA_LIMIT}</Text>
        </View>

        {displayUris.length ? (
          <View style={styles.previewGrid}>
            {displayUris.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.previewItem}>
                {post.mediaType === 'video' && !isReplacingMedia ? (
                  <View style={styles.videoPreview}>
                    <Ionicons name="play-circle" size={36} color={colors.white} />
                  </View>
                ) : (
                  <Image source={{ uri }} style={styles.previewImage} />
                )}
                <Text style={styles.previewIndex}>{index + 1}</Text>
                {isReplacingMedia ? (
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeReplacement(uri)} disabled={saving}>
                    <Ionicons name="close" size={15} color={colors.white} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyMedia}>
            <Ionicons name="images-outline" size={38} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>Медиа не найдены</Text>
          </View>
        )}

        <View style={styles.mediaButtons}>
          <TouchableOpacity style={styles.mediaBtn} onPress={takePhoto} disabled={saving}>
            <Ionicons name="camera-outline" size={22} color={colors.text} />
            <Text style={styles.mediaBtnText}>Камера</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaBtn} onPress={pickImages} disabled={saving}>
            <Ionicons name="image-outline" size={22} color={colors.text} />
            <Text style={styles.mediaBtnText}>Галерея</Text>
          </TouchableOpacity>
        </View>

        {isReplacingMedia ? (
          <TouchableOpacity style={styles.resetBtn} onPress={() => setReplacementUris([])} disabled={saving}>
            <Ionicons name="refresh-outline" size={18} color={colors.textMuted} />
            <Text style={styles.resetText}>Вернуть текущие медиа</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <TextInput
        style={styles.input}
        value={caption}
        onChangeText={setCaption}
        placeholder="Подпись к публикации"
        placeholderTextColor={colors.textFaint}
        multiline
        maxLength={500}
        textAlignVertical="top"
      />
      <Text style={styles.counter}>{caption.length}/500</Text>

      <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={save} disabled={saving}>
        {saving ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <>
            <Ionicons name="save-outline" size={19} color={colors.onAccent} />
            <Text style={styles.saveText}>Сохранить</Text>
          </>
        )}
      </TouchableOpacity>
      {guardSheet}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 30 },
  mediaPanel: { marginBottom: 16, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, padding: 12 },
  mediaHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  sectionHint: { marginTop: 2, color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  mediaCount: { color: colors.textMuted, fontSize: 12, fontWeight: '900' },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewItem: { width: '31.8%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  previewImage: { width: '100%', height: '100%' },
  videoPreview: { width: '100%', height: '100%', backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center' },
  previewIndex: { position: 'absolute', left: 6, bottom: 6, overflow: 'hidden', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.65)', color: colors.white, fontSize: 10, fontWeight: '900' },
  removeBtn: { position: 'absolute', top: 5, right: 5, width: 23, height: 23, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  emptyMedia: { minHeight: 150, borderRadius: 8, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 8, color: colors.textMuted, fontSize: 14, fontWeight: '900' },
  mediaButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  mediaBtn: { flex: 1, height: 44, borderRadius: 8, backgroundColor: colors.surfaceAlt, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  mediaBtnText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  resetBtn: { marginTop: 10, height: 42, borderRadius: 8, backgroundColor: colors.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  resetText: { color: colors.textMuted, fontSize: 13, fontWeight: '900' },
  input: { minHeight: 130, borderRadius: 10, backgroundColor: colors.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, color: colors.text, fontSize: 16, lineHeight: 23, padding: 12 },
  counter: { marginTop: 6, color: colors.textFaint, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  saveBtn: { marginTop: 18, height: 52, borderRadius: 12, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnDisabled: { opacity: 0.65 },
  saveText: { color: colors.onAccent, fontSize: 16, fontWeight: '900' },
});
