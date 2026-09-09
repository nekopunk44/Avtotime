import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { colors, font, radius, shadow, space } from '../theme';
import { PressableScale } from '../components/ui';

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

  // Первое фото — обложка поста в ленте; тап по миниатюре назначает её.
  const makeCover = (uri: string) => {
    setMediaUris((prev) => [uri, ...prev.filter((item) => item !== uri)]);
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
  const [captionFocused, setCaptionFocused] = useState(false);

  // Обложка мягко проявляется при выборе и при смене.
  const coverUri = mediaUris[0];
  const coverFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    coverFade.setValue(0);
    Animated.timing(coverFade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [coverUri, coverFade]);

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
          <View style={styles.emptyWrap}>
            <PressableScale style={styles.hero} onPress={pickImages} scaleTo={0.98}>
              <View style={styles.heroIcon}>
                <Ionicons name="aperture-outline" size={32} color={colors.accent} />
              </View>
              <Text style={styles.heroTitle}>Покажите свою машину</Text>
              <Text style={styles.heroSub}>До {MEDIA_LIMIT} фото или одно видео до 2 минут</Text>

              <View style={styles.heroCta}>
                <Ionicons name="images-outline" size={18} color={colors.onAccent} />
                <Text style={styles.heroCtaText}>Выбрать из галереи</Text>
              </View>
            </PressableScale>

            <View style={styles.secondaryRow}>
              <PressableScale style={styles.secondaryBtn} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={17} color={colors.text} />
                <Text style={styles.secondaryText}>Снять фото</Text>
              </PressableScale>
              <PressableScale style={styles.secondaryBtn} onPress={pickVideo}>
                <Ionicons name="videocam-outline" size={17} color={colors.text} />
                <Text style={styles.secondaryText}>Видео</Text>
              </PressableScale>
            </View>
          </View>
        ) : isVideo ? (
          <View style={styles.videoPreview}>
            <View style={styles.videoPlayCircle}>
              <Ionicons name="play" size={28} color={colors.onAccent} />
            </View>
            <Text style={styles.videoPreviewText}>Видео готово к публикации</Text>
            <View style={styles.videoActions}>
              <PressableScale style={styles.secondaryBtn} onPress={pickVideo}>
                <Ionicons name="swap-horizontal-outline" size={16} color={colors.text} />
                <Text style={styles.secondaryText}>Заменить</Text>
              </PressableScale>
              <PressableScale style={styles.secondaryBtn} onPress={() => removeMedia(mediaUris[0])}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={[styles.secondaryText, { color: colors.danger }]}>Убрать</Text>
              </PressableScale>
            </View>
          </View>
        ) : (
          <View>
            <Animated.View style={{ opacity: coverFade }}>
              <View style={styles.cover}>
                <Image source={{ uri: coverUri }} style={styles.coverImage} resizeMode="cover" />
                <View style={styles.coverBadge}>
                  <Ionicons name="image-outline" size={12} color={colors.text} />
                  <Text style={styles.coverBadgeText}>{mediaUris.length}/{MEDIA_LIMIT}</Text>
                </View>
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeMedia(coverUri)}>
                  <Ionicons name="close" size={15} color={colors.white} />
                </TouchableOpacity>
              </View>
            </Animated.View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbStrip}>
              {mediaUris.map((uri) => (
                <PressableScale key={uri} style={styles.thumbWrap} onPress={() => makeCover(uri)}>
                  <Image source={{ uri }} style={[styles.thumb, uri === coverUri && styles.thumbActive]} />
                  <TouchableOpacity
                    style={styles.thumbRemove}
                    onPress={() => removeMedia(uri)}
                    hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                  >
                    <Ionicons name="close" size={11} color={colors.white} />
                  </TouchableOpacity>
                </PressableScale>
              ))}
              {mediaUris.length < MEDIA_LIMIT ? (
                <PressableScale style={styles.addTile} onPress={pickImages}>
                  <Ionicons name="add" size={22} color={colors.textMuted} />
                </PressableScale>
              ) : null}
            </ScrollView>
            <Text style={styles.coverHint}>Первое фото — обложка. Тап по миниатюре меняет её.</Text>
          </View>
        )}

        <View style={[styles.captionField, captionFocused && styles.captionFieldFocused]}>
          <TextInput
            style={styles.input}
            placeholder="Расскажите историю этого кадра…"
            placeholderTextColor={colors.textFaint}
            multiline
            value={caption}
            onChangeText={setCaption}
            maxLength={500}
            textAlignVertical="top"
            onFocus={() => setCaptionFocused(true)}
            onBlur={() => setCaptionFocused(false)}
          />
          {caption.length >= 400 ? (
            <Text style={styles.charCount}>{caption.length}/500</Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.md + 2, paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  headerTitle: { fontSize: font.h3, fontWeight: '900', color: colors.text },
  postBtn: { height: 40, minWidth: 116, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  postBtnDisabled: { backgroundColor: colors.surfaceAlt },
  postBtnText: { fontSize: font.small + 1, fontWeight: '900', color: colors.onAccent },
  postBtnTextDisabled: { color: colors.textFaint },

  content: { padding: space.lg, gap: space.md, paddingBottom: 40 },

  // ── Пустое состояние: один герой, одно главное действие ──
  emptyWrap: { gap: space.md },
  hero: {
    minHeight: 320,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    ...shadow.card,
  },
  heroIcon: {
    width: 76, height: 76, borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: space.sm,
  },
  heroTitle: { color: colors.text, fontSize: font.h2, fontWeight: '900', textAlign: 'center' },
  heroSub: { color: colors.textMuted, fontSize: font.small, fontWeight: '600', textAlign: 'center' },
  heroCta: {
    marginTop: space.lg,
    height: 52, borderRadius: radius.pill,
    paddingHorizontal: space.xl + 4,
    backgroundColor: colors.accent,
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
  },
  heroCtaText: { color: colors.onAccent, fontSize: font.body, fontWeight: '900' },
  secondaryRow: { flexDirection: 'row', gap: space.sm, justifyContent: 'center' },
  secondaryBtn: {
    height: 42, borderRadius: radius.pill, paddingHorizontal: space.lg,
    backgroundColor: colors.surfaceAlt,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  secondaryText: { color: colors.text, fontSize: font.small, fontWeight: '800' },

  // ── Выбранные фото: обложка ведёт, миниатюры под рукой ──
  cover: { width: '100%', aspectRatio: 4 / 5, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  coverImage: { width: '100%', height: '100%' },
  coverBadge: {
    position: 'absolute', left: space.sm + 2, top: space.sm + 2,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 24, paddingHorizontal: space.sm,
    borderRadius: radius.pill, backgroundColor: 'rgba(8,8,10,0.6)',
  },
  coverBadgeText: { color: colors.text, fontSize: font.tiny, fontWeight: '800' },
  removeBtn: { position: 'absolute', top: space.sm + 2, right: space.sm + 2, width: 26, height: 26, borderRadius: radius.pill, backgroundColor: 'rgba(8,8,10,0.65)', alignItems: 'center', justifyContent: 'center' },
  thumbStrip: { gap: space.sm, paddingTop: space.md },
  thumbWrap: { position: 'relative' },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  thumbActive: { borderWidth: 2, borderColor: colors.accent },
  thumbRemove: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: radius.pill, backgroundColor: 'rgba(8,8,10,0.85)', alignItems: 'center', justifyContent: 'center' },
  addTile: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  coverHint: { marginTop: space.sm, color: colors.textFaint, fontSize: font.tiny, fontWeight: '600' },

  // ── Видео ──
  videoPreview: { minHeight: 300, borderRadius: radius.xl, backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center', gap: space.md, ...shadow.card },
  videoPlayCircle: { width: 58, height: 58, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingLeft: 4 },
  videoPreviewText: { color: colors.textMuted, fontSize: font.body, fontWeight: '900' },
  videoActions: { flexDirection: 'row', gap: space.sm },

  // ── Подпись: filled-инпут с акцентом на фокусе ──
  captionField: { borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: space.md + 2, borderWidth: 1, borderColor: 'transparent' },
  captionFieldFocused: { borderColor: colors.accent },
  input: { fontSize: font.body + 1, color: colors.text, lineHeight: 24, minHeight: 96 },
  charCount: { textAlign: 'right', marginTop: 6, color: colors.textFaint, fontSize: font.tiny, fontWeight: '700' },
});
