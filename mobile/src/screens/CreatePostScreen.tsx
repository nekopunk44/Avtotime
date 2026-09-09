import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { colors, font, radius, space } from '../theme';
import { PressableScale } from '../components/ui';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'CreatePost'> };

const MEDIA_LIMIT = 8;

/**
 * Пост — это фото. Экран сразу открывает галерею; видео живёт в коротких
 * роликах, здесь его нет. Дальше — коллаж выбранного и подпись.
 */
export default function CreatePostScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState('');
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [captionFocused, setCaptionFocused] = useState(false);
  const openedOnceRef = useRef(false);

  const { markSaved } = useUnsavedGuard(navigation, Boolean(caption.trim() || mediaUris.length));

  const collageFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!mediaUris.length) return;
    collageFade.setValue(0);
    Animated.timing(collageFade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [mediaUris.length, collageFade]);

  const pickImages = useCallback(async (initial = false) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Доступ к галерее', 'Разрешите доступ к медиатеке, чтобы добавить фото.');
      if (initial) navigation.goBack();
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MEDIA_LIMIT,
      quality: 0.82,
    });

    if (result.canceled) {
      // Экран существует ради выбора: передумал на входе — вернулись назад.
      if (initial) navigation.goBack();
      return;
    }

    setMediaUris((prev) =>
      [...prev, ...result.assets.map((asset) => asset.uri)].slice(0, MEDIA_LIMIT),
    );
  }, [navigation]);

  // Галерея открывается сразу — это и есть «создать пост».
  useEffect(() => {
    if (openedOnceRef.current) return;
    openedOnceRef.current = true;
    pickImages(true);
  }, [pickImages]);

  const removeMedia = (uri: string) => {
    setMediaUris((prev) => prev.filter((item) => item !== uri));
  };

  const handlePost = async () => {
    if (!mediaUris.length) {
      Alert.alert('Публикация', 'Добавьте фото.');
      return;
    }

    setLoading(true);
    try {
      await createPost({
        caption: caption.trim(),
        mediaUris,
        mediaType: 'image',
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

  // Коллаж: нечётное число — первый кадр во всю ширину, остальные парами.
  const fullWidthFirst = mediaUris.length % 2 === 1;
  const gridUris = fullWidthFirst ? mediaUris.slice(1) : mediaUris;

  const renderTile = (uri: string, wide: boolean) => (
    <View key={uri} style={[styles.tile, wide ? styles.tileWide : styles.tileHalf]}>
      <Image source={{ uri }} style={styles.tileImage} resizeMode="cover" />
      <TouchableOpacity
        style={styles.tileRemove}
        onPress={() => removeMedia(uri)}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <Ionicons name="close" size={13} color={colors.white} />
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()} disabled={loading} hitSlop={10}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Новая публикация</Text>

        <TouchableOpacity style={styles.headerBtn} onPress={handlePost} disabled={!canPost} hitSlop={10}>
          {loading ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Ionicons name="paper-plane" size={24} color={canPost ? colors.text : colors.textFaint} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {mediaUris.length ? (
          <Animated.View style={{ opacity: collageFade }}>
            <View style={styles.collage}>
              {fullWidthFirst ? renderTile(mediaUris[0], true) : null}
              {gridUris.map((uri) => renderTile(uri, false))}
              {mediaUris.length < MEDIA_LIMIT ? (
                <PressableScale style={[styles.tileHalf, styles.addTile]} onPress={() => pickImages()}>
                  <Ionicons name="add" size={26} color={colors.textMuted} />
                  <Text style={styles.addTileText}>Ещё {MEDIA_LIMIT - mediaUris.length}</Text>
                </PressableScale>
              ) : null}
            </View>
          </Animated.View>
        ) : (
          // Сюда попадают, только если удалили всё выбранное.
          <PressableScale style={styles.reopen} onPress={() => pickImages()}>
            <Ionicons name="images-outline" size={20} color={colors.text} />
            <Text style={styles.reopenText}>Открыть галерею</Text>
          </PressableScale>
        )}

        <View style={[styles.captionField, captionFocused && styles.captionFieldFocused]}>
          <TextInput
            style={styles.input}
            placeholder="Добавьте подпись…"
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

const GAP = 4;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: space.md, paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  // Иконки без подложек; заголовок центрируется симметрией одинаковых кнопок.
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: font.h3, fontWeight: '900', color: colors.text },

  content: { padding: space.lg, gap: space.md, paddingBottom: 40 },

  collage: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  tile: { backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  tileWide: { width: '100%', aspectRatio: 16 / 10 },
  tileHalf: { width: '49.4%', aspectRatio: 1 },
  tileImage: { width: '100%', height: '100%' },
  tileRemove: {
    position: 'absolute', top: 6, right: 6,
    width: 24, height: 24, borderRadius: radius.pill,
    backgroundColor: 'rgba(8,8,10,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },
  addTile: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  addTileText: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '800' },

  reopen: {
    height: 52, borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
  },
  reopenText: { color: colors.text, fontSize: font.body, fontWeight: '800' },

  captionField: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: space.md + 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  captionFieldFocused: { borderColor: colors.accent },
  input: { fontSize: font.body + 1, color: colors.text, lineHeight: 24, minHeight: 96 },
  charCount: { textAlign: 'right', marginTop: 6, color: colors.textFaint, fontSize: font.tiny, fontWeight: '700' },
});
