import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Пост — это фото. Экран сразу открывает галерею; дальше кадры занимают всё
 * свободное место, листаются свайпами, подпись живёт поверх снимка. На
 * Android окно в режиме resize: при клавиатуре фото ужимается, а подпись
 * остаётся видимой над клавиатурой.
 */
export default function CreatePostScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState('');
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const openedOnceRef = useRef(false);
  const pagerRef = useRef<ScrollView>(null);

  const { markSaved } = useUnsavedGuard(navigation, Boolean(caption.trim() || mediaUris.length));

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
    setMediaUris((prev) => {
      const next = prev.filter((item) => item !== uri);
      const maxPage = Math.max(0, next.length - 1);
      if (page > maxPage) {
        setPage(maxPage);
        requestAnimationFrame(() =>
          pagerRef.current?.scrollTo({ x: maxPage * SCREEN_WIDTH, animated: false }),
        );
      }
      return next;
    });
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
  const canAddMore = mediaUris.length > 0 && mediaUris.length < MEDIA_LIMIT;
  // Последняя страница пейджера — компактный «добавить ещё».
  const pageCount = mediaUris.length + (canAddMore ? 1 : 0);
  const onAddPage = page >= mediaUris.length;

  const onPagerScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (next !== page) setPage(Math.min(next, pageCount - 1));
  };

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

      <View style={styles.stage}>
        {mediaUris.length ? (
          <>
            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onPagerScroll}
              onScrollEndDrag={onPagerScroll}
            >
              {mediaUris.map((uri) => (
                <View key={uri} style={styles.page}>
                  <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
                </View>
              ))}
              {canAddMore ? (
                <View style={[styles.page, styles.addPage]}>
                  <PressableScale style={styles.addCircle} onPress={() => pickImages()}>
                    <Ionicons name="add" size={26} color={colors.text} />
                  </PressableScale>
                  <Text style={styles.addText}>Ещё до {MEDIA_LIMIT - mediaUris.length} фото</Text>
                </View>
              ) : null}
            </ScrollView>

            {!onAddPage ? (
              <>
                <View style={styles.counter}>
                  <Text style={styles.counterText}>{page + 1}/{mediaUris.length}</Text>
                </View>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeMedia(mediaUris[page])}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <Ionicons name="close" size={14} color={colors.white} />
                </TouchableOpacity>
              </>
            ) : null}

            {mediaUris.length > 1 ? (
              <View style={styles.dots} pointerEvents="none">
                {Array.from({ length: pageCount }, (_, i) => (
                  <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
                ))}
              </View>
            ) : null}

            {/* Подпись поверх кадра; в режиме resize поднимается с клавиатурой. */}
            <View style={styles.captionOverlay}>
              <TextInput
                style={styles.captionInput}
                placeholder="Добавьте подпись…"
                placeholderTextColor="rgba(255,255,255,0.55)"
                multiline
                value={caption}
                onChangeText={setCaption}
                maxLength={500}
              />
              {caption.length >= 400 ? (
                <Text style={styles.charCount}>{caption.length}/500</Text>
              ) : null}
            </View>
          </>
        ) : (
          // Сюда попадают, только если удалили всё выбранное.
          <View style={styles.emptyStage}>
            <PressableScale style={styles.addCircle} onPress={() => pickImages()}>
              <Ionicons name="images-outline" size={24} color={colors.text} />
            </PressableScale>
            <Text style={styles.addText}>Открыть галерею</Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

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

  // Кадру — всё место между шапкой и низом, без полей.
  stage: { flex: 1, backgroundColor: colors.bg },
  page: { width: SCREEN_WIDTH, height: '100%' },
  photo: { width: '100%', height: '100%' },

  addPage: { alignItems: 'center', justifyContent: 'center', gap: space.md, backgroundColor: colors.surface },
  addCircle: {
    width: 52, height: 52, borderRadius: radius.pill,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center', justifyContent: 'center',
  },
  addText: { color: colors.textMuted, fontSize: font.small, fontWeight: '700' },

  counter: {
    position: 'absolute', top: space.md, left: space.md,
    height: 24, paddingHorizontal: space.sm + 2,
    borderRadius: radius.pill, backgroundColor: 'rgba(8,8,10,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  counterText: { color: colors.text, fontSize: font.tiny, fontWeight: '800' },
  removeBtn: {
    position: 'absolute', top: space.md, right: space.md,
    width: 26, height: 26, borderRadius: radius.pill,
    backgroundColor: 'rgba(8,8,10,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },

  dots: {
    position: 'absolute', left: 0, right: 0, bottom: 96,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { backgroundColor: colors.white },

  captionOverlay: {
    position: 'absolute', left: space.md, right: space.md, bottom: space.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(8,8,10,0.62)',
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm + 2,
  },
  captionInput: { color: colors.white, fontSize: font.body, lineHeight: 22, maxHeight: 110 },
  charCount: { textAlign: 'right', marginTop: 2, color: 'rgba(255,255,255,0.55)', fontSize: font.tiny, fontWeight: '700' },

  emptyStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
});
