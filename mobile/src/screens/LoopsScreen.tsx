import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { showToast } from '../store/toastStore';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  Pressable,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useKeyboardLift } from '../hooks/useKeyboardLift';
import { useLoopCommentsStore } from '../store/loopCommentsStore';
import { useProfileLibraryStore } from '../store/profileLibraryStore';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { RouteProp, useFocusEffect, useIsFocused, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLoops, likeLoop, Loop, saveLoop, uploadLoop } from '../api/loops';
import { useAuthStore } from '../store/authStore';
import { AppStackParamList, AppTabParamList } from '../navigation/AppNavigator';
import ModeSwitcher from '../components/ModeSwitcher';
import { colors, font, radius, space } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };

const LOOPS_PAGE_SIZE = 10;

// Matches @react-navigation's default header content height so the overlaid
// switcher/search line up with the native header on Feed/Search/Messages.
const HEADER_CONTENT = Platform.OS === 'ios' ? 44 : 56;

type LoopCardProps = {
  loop: Loop;
  active: boolean;
  height: number;
  muted: boolean;
  onToggleMute: () => void;
  onLike: (loopId: string) => void;
  saved: boolean;
  onSave: (loopId: string) => void;
  onCommentOpen: (loop: Loop) => void;
  onAuthorPress: (userId?: string) => void;
};

function LoopCard({ loop, active, height, muted, onToggleMute, onLike, saved, onSave, onCommentOpen, onAuthorPress }: LoopCardProps) {
  // Ползунок скользит между отсчётами плеера: сами отсчёты приходят раз в
  // четверть секунды, и прямая запись в ширину шагала рывками.
  const progressAnim = useRef(new Animated.Value(0)).current;
  const lastRatioRef = useRef(0);
  const [trackW, setTrackW] = useState(0);
  // Пауза по тапу в любом месте кадра — привычный жест вертикальных видео.
  const [paused, setPaused] = useState(false);
  const insets = useSafeAreaInsets();

  // Подписи и кнопки не должны прятаться за плавающей панелью вкладок.
  const overlayBottom = insets.bottom + 88;
  const user = useAuthStore((s) => s.user);
  const liked = !!user?._id && loop.likes?.includes(user._id);
  const commentsCount = typeof loop.commentsCount === 'number'
    ? loop.commentsCount
    : (loop.commentsPreview || loop.comments || []).length;

  // ── Отклик действий: значки не подменяются, а отыгрывают ────────────────
  // Значок паузы проявляется и растёт, а не вспыхивает готовым.
  const pauseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pauseAnim, { toValue: paused ? 1 : 0, useNativeDriver: true, speed: 26, bounciness: 9 }).start();
  }, [paused, pauseAnim]);

  // Лайк: сердце приседает и выпрыгивает с отскоком — отклик живёт на самой
  // кнопке, ничего не заслоняя посреди кадра.
  const likeScale = useRef(new Animated.Value(1)).current;
  const likeMounted = useRef(false);
  useEffect(() => {
    if (!likeMounted.current) {
      likeMounted.current = true;
      return;
    }
    Animated.sequence([
      Animated.timing(likeScale, { toValue: 0.7, duration: 80, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.spring(likeScale, { toValue: 1.4, useNativeDriver: true, speed: 40, bounciness: 16 }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }),
    ]).start();
  }, [liked, likeScale]);

  // Закладка подпрыгивает так же, как сердце.
  const saveScale = useRef(new Animated.Value(1)).current;
  const saveMounted = useRef(false);
  useEffect(() => {
    if (!saveMounted.current) {
      saveMounted.current = true;
      return;
    }
    Animated.sequence([
      Animated.timing(saveScale, { toValue: 0.75, duration: 70, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.spring(saveScale, { toValue: 1.3, useNativeDriver: true, speed: 40, bounciness: 14 }),
      Animated.spring(saveScale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 7 }),
    ]).start();
  }, [saved, saveScale]);

  // Переключение звука коротко показывает состояние по центру кадра и
  // подталкивает значок на рейке.
  const muteFlash = useRef(new Animated.Value(0)).current;
  const muteScale = useRef(new Animated.Value(1)).current;
  const muteMounted = useRef(false);
  useEffect(() => {
    if (!muteMounted.current) {
      muteMounted.current = true;
      return;
    }
    if (!active) return;
    muteFlash.setValue(0);
    Animated.sequence([
      Animated.spring(muteFlash, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
      Animated.delay(420),
      Animated.timing(muteFlash, { toValue: 0, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.spring(muteScale, { toValue: 1.25, useNativeDriver: true, speed: 40, bounciness: 12 }),
      Animated.spring(muteScale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 7 }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  const player = useVideoPlayer(loop.media, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.timeUpdateEventInterval = 0.25;
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (active && !paused) {
      player.play();
    } else {
      player.pause();
    }
  }, [active, paused, player]);

  // Новый ролик в фокусе всегда стартует сам: пауза — решение про конкретное
  // видео, а не про ленту.
  useEffect(() => {
    if (active) setPaused(false);
  }, [active]);

  useEffect(() => {
    const subscription = (player as any).addListener?.('timeUpdate', ({ currentTime }: { currentTime: number }) => {
      const duration = player.duration || 0;
      const ratio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
      if (ratio + 0.05 < lastRatioRef.current) {
        // Новый круг или перемотка назад: ползунок перескакивает, а не ползёт
        // через весь трек в обратную сторону.
        progressAnim.setValue(ratio);
      } else {
        // Цель — положение СЛЕДУЮЩЕГО отсчёта: скольжение к уже прошедшей
        // точке держало ползунок на шаг позади видео.
        const step = duration > 0 ? 0.25 / duration : 0;
        Animated.timing(progressAnim, {
          toValue: Math.min(1, ratio + step),
          duration: 260,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start();
      }
      lastRatioRef.current = ratio;
    });

    return () => subscription?.remove?.();
  }, [player, progressAnim]);

  return (
    <View style={[styles.loopCard, { height }]}>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls={false}
        // Кадр заполняет экран, как в вертикальных лентах: contain оставлял
        // серые поля сверху и снизу.
        contentFit="cover"
        allowsPictureInPicture={false}
        surfaceType="textureView"
      />

      <Pressable style={StyleSheet.absoluteFill} onPress={() => setPaused((prev) => !prev)} />

      <Animated.View
        style={[
          styles.centerBadge,
          {
            opacity: pauseAnim,
            transform: [{ scale: pauseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          },
        ]}
        pointerEvents="none"
      >
        <Ionicons name="play" size={34} color="#fff" />
      </Animated.View>

      <Animated.View
        style={[
          styles.centerBadge,
          {
            opacity: muteFlash,
            transform: [{ scale: muteFlash.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          },
        ]}
        pointerEvents="none"
      >
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={32} color="#fff" />
      </Animated.View>

      <View style={[styles.actionsRail, { bottom: overlayBottom + 76 }]}>
        <TouchableOpacity style={styles.railButton} onPress={() => onLike(loop._id)} activeOpacity={0.85}>
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={30} color={liked ? colors.danger : '#fff'} />
          </Animated.View>
          <Text style={styles.railText}>{loop.likes?.length || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.railButton} onPress={() => onCommentOpen(loop)} activeOpacity={0.85}>
          <Ionicons name="chatbubble-outline" size={28} color="#fff" />
          <Text style={styles.railText}>{commentsCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.railButton} onPress={() => onSave(loop._id)} activeOpacity={0.85}>
          <Animated.View style={{ transform: [{ scale: saveScale }] }}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={26} color={saved ? colors.accent : '#fff'} />
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.railButton} onPress={onToggleMute} activeOpacity={0.85}>
          <Animated.View style={{ transform: [{ scale: muteScale }] }}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={26} color="#fff" />
          </Animated.View>
        </TouchableOpacity>
      </View>

      <View style={[styles.infoOverlay, { bottom: overlayBottom }]}>
        <TouchableOpacity
          style={styles.authorRow}
          onPress={() => onAuthorPress(loop.author?._id)}
          activeOpacity={0.85}
        >
          {loop.author?.profileImage ? (
            <Image source={{ uri: loop.author.profileImage }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person-outline" size={18} color="#fff" />
            </View>
          )}
          <Text style={styles.authorName} numberOfLines={1}>@{loop.author?.userName || 'avtotime'}</Text>
        </TouchableOpacity>
        {loop.caption ? (
          <Text style={styles.caption} numberOfLines={3}>{loop.caption}</Text>
        ) : null}
      </View>

      <View
        style={[styles.progressTrack, { bottom: insets.bottom + 76 }]}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      >
        {trackW > 0 ? (
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: trackW,
                transform: [{
                  translateX: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-trackW, 0],
                  }),
                }],
              },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

type UploadSheetProps = {
  video: { uri: string; mimeType?: string };
  caption: string;
  onChangeCaption: (value: string) => void;
  onCancel: () => void;
  onPublish: () => void;
  uploading: boolean;
};

// Live, muted, looping preview of the picked clip so the author sees what they
// are about to publish before writing a caption.
function UploadSheet({ video, caption, onChangeCaption, onCancel, onPublish, uploading }: UploadSheetProps) {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(video.uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={[styles.uploadSheet, { paddingBottom: insets.bottom + space.lg }]}>
      <View style={styles.uploadHandle} />
      <Text style={styles.uploadTitle}>Новое видео</Text>
      <Text style={styles.uploadHint}>Проверьте превью и добавьте описание</Text>

      <View style={styles.uploadRow}>
        <View style={styles.previewCard}>
          <VideoView
            player={player}
            style={styles.previewVideo}
            nativeControls={false}
            contentFit="cover"
            allowsPictureInPicture={false}
          />
          <View style={styles.previewChip}>
            <Ionicons name="play" size={11} color={colors.onAccent} />
            <Text style={styles.previewChipText}>Превью</Text>
          </View>
        </View>

        <View style={styles.uploadFields}>
          <TextInput
            style={styles.uploadCaptionInput}
            placeholder="Добавьте описание…"
            placeholderTextColor={colors.textFaint}
            value={caption}
            onChangeText={(value) => onChangeCaption(value.slice(0, 280))}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.captionCounter}>{caption.length}/280</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.publishBtn} onPress={onPublish} disabled={uploading} activeOpacity={0.9}>
        {uploading ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <>
            <Ionicons name="cloud-upload-outline" size={19} color={colors.onAccent} />
            <Text style={styles.publishText}>Опубликовать</Text>
          </>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelUploadBtn} onPress={onCancel} disabled={uploading} activeOpacity={0.9}>
        <Text style={styles.cancelUploadText}>Отмена</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function LoopsScreen({ navigation }: Props) {
  const route = useRoute<RouteProp<AppTabParamList, 'Loops'>>();
  const [loops, setLoops] = useState<Loop[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeIndex;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [pendingVideo, setPendingVideo] = useState<{ uri: string; mimeType?: string } | null>(null);
  const [muted, setMuted] = useState(true);
  const [uploadCaption, setUploadCaption] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const { height } = useWindowDimensions();
  // Подъём под клавиатуру — экранный: шторка живёт в окне приложения, а не
  // в окне диалога, и здесь механика уже выверена чатом.
  const { lift: kbLift, onLayout: onRootLayout } = useKeyboardLift();


  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  // Высота кадра — фактическая высота самой ленты, а не формула из экрана и
  // панели: только замер гарантирует «один ролик = один экран» без полосы
  // соседнего кадра. Формула остаётся стартовым значением до первого замера.
  const [viewportH, setViewportH] = useState(0);
  const listHeight = viewportH > 0 ? viewportH : Math.max(320, height - tabBarHeight);

  // Замер приходит после первого рендера, и все смещения, посчитанные по
  // стартовой формуле, устаревают: сверху выглядывал низ соседнего ролика.
  // При смене высоты лента доснапливается к активному кадру заново.
  useEffect(() => {
    if (viewportH <= 0) return;
    requestAnimationFrame(() => listRef.current?.scrollToOffset({
      offset: activeIndexRef.current * viewportH,
      animated: false,
    }));
  }, [viewportH]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;
  const listRef = useRef<FlatList<Loop>>(null);
  const targetLoopId = route.params?.loopId;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const first = viewableItems?.[0];
    if (typeof first?.index === 'number') setActiveIndex(first.index);
  }).current;



  const filteredLoops = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return loops;
    return loops.filter((loop) =>
      (loop.caption || '').toLowerCase().includes(q) ||
      (loop.author?.userName || '').toLowerCase().includes(q));
  }, [loops, query]);

  useEffect(() => {
    if (!targetLoopId || !loops.length) return;
    const index = loops.findIndex((loop) => loop._id === targetLoopId);
    if (index < 0) return;

    setActiveIndex(index);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, animated: false });
    });
  }, [loops, targetLoopId]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await getLoops(1, LOOPS_PAGE_SIZE);
      setLoops(data);
      setPage(1);
      setHasMore(data.length === LOOPS_PAGE_SIZE);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить видео');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading || refreshing) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const more = await getLoops(next, LOOPS_PAGE_SIZE);
      setLoops((prev) => {
        const seen = new Set(prev.map((l) => l._id));
        return [...prev, ...more.filter((l) => !seen.has(l._id))];
      });
      setPage(next);
      setHasMore(more.length === LOOPS_PAGE_SIZE);
    } catch {
      // keep current list; scrolling again retries
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, loading, refreshing, page]);

  useFocusEffect(useCallback(() => {
    load(true);
  }, [load]));

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const updateLoop = (updated: Loop) => {
    setLoops((prev) => prev.map((loop) => loop._id === updated._id ? updated : loop));
  };

  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const savedLoopIds = useMemo(
    () => new Set((user?.savedLoops ?? []).map((item) => (typeof item === 'string' ? item : item._id))),
    [user?.savedLoops],
  );

  const handleSave = async (loopId: string) => {
    try {
      const fresh = await saveLoop(loopId);
      setUser(fresh);
      // Профиль перечитывает «Сохранённые» в фоне — к открытию уже свежие.
      refreshSavedLibrary();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось сохранить ролик', 'error');
    }
  };

  const handleLike = async (loopId: string) => {
    try {
      const updated = await likeLoop(loopId);
      updateLoop(updated);
      refreshLikedLibrary();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось поставить лайк', 'error');
    }
  };

  const openAuthor = (userId?: string) => {
    if (!userId) return;
    navigation.navigate('UserProfile', { userId });
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Разрешите доступ к видео, чтобы загрузить loop.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.9,
      videoMaxDuration: 90,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    setPendingVideo({ uri: asset.uri, mimeType: asset.mimeType });
    setUploadCaption('');
  };

  const publishPendingVideo = async () => {
    if (!pendingVideo) return;

    setUploading(true);
    try {
      const uploaded = await uploadLoop(pendingVideo.uri, uploadCaption.trim(), pendingVideo.mimeType);
      setLoops((prev) => [uploaded, ...prev.filter((loop) => loop._id !== uploaded._id)]);
      setPendingVideo(null);
      setUploadCaption('');
      setActiveIndex(0);
      requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
      showToast('Видео опубликовано.', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось загрузить видео', 'error');
    } finally {
      setUploading(false);
    }
  };

;

  // Шторка комментариев живёт в корне приложения: слой внутри сцены не
  // дотягивается до низа экрана, а окно Modal ведёт себя по-разному на
  // разных устройствах. Экран лишь открывает её и подхватывает обновления.
  const openComments = useLoopCommentsStore((s) => s.open);
  const refreshLikedLibrary = useProfileLibraryStore((s) => s.refreshLiked);
  const refreshSavedLibrary = useProfileLibraryStore((s) => s.refreshSaved);
  const sheetLoop = useLoopCommentsStore((s) => s.loop);

  useEffect(() => {
    if (sheetLoop) updateLoop(sheetLoop);
    // updateLoop стабилен по смыслу: обновляет список по _id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetLoop]);;






  const renderLoop = ({ item, index }: { item: Loop; index: number }) => (
    <LoopCard
      loop={item}
      active={focused && index === activeIndex}
      height={listHeight}
      muted={muted}
      onToggleMute={() => setMuted((prev) => !prev)}
      onLike={handleLike}
      saved={savedLoopIds.has(item._id)}
      onSave={handleSave}
      onCommentOpen={openComments}
      onAuthorPress={openAuthor}
    />
  );

  if (loading) {
    return (
      <View style={styles.centerDark}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
        style={styles.fullBleed}
        data={filteredLoops}
        keyExtractor={(item) => item._id}
        renderItem={renderLoop}
        pagingEnabled
        snapToInterval={listHeight}
        // Один свайп — один ролик: без этого сильный бросок пролистывал
        // несколько видео, а лента должна магнититься к соседнему.
        disableIntervalMomentum
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={loadMore}
        onEndReachedThreshold={1.5}
        getItemLayout={(_, index) => ({ length: listHeight, offset: listHeight * index, index })}
        onScrollToIndexFailed={({ index }) => {
          requestAnimationFrame(() => listRef.current?.scrollToOffset({
            offset: Math.max(0, index * listHeight),
            animated: false,
          }));
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#fff" />}
        ListEmptyComponent={
          <View style={[styles.emptyState, { height: listHeight }]}>
            <Ionicons name={error ? 'alert-circle-outline' : query ? 'search-outline' : 'play-circle-outline'} size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{error || (query ? 'Ничего не найдено' : 'Пока нет видео')}</Text>
            <Text style={styles.emptyText}>
              {error
                ? 'Потяните вниз, чтобы попробовать снова.'
                : query
                  ? 'Попробуйте другой запрос.'
                  : 'Загрузите первое короткое видео для Avtotime.'}
            </Text>
          </View>
        }
      />

      <View style={[styles.topBar, { paddingTop: insets.top }]} pointerEvents="box-none">
        <View style={styles.switcherRow} pointerEvents="box-none">
          <ModeSwitcher current="social" />
        </View>
        <View style={styles.searchRow} pointerEvents="box-none">
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Поиск видео"
              placeholderTextColor={colors.textFaint}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textFaint} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.addReelBtn}
            onPress={pickVideo}
            disabled={uploading}
            activeOpacity={0.85}
          >
            {uploading ? (
              <ActivityIndicator color={colors.onAccent} size="small" />
            ) : (
              <Ionicons name="add" size={24} color={colors.onAccent} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={!!pendingVideo} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={() => !uploading && setPendingVideo(null)}>
        <View style={styles.modalRoot} onLayout={onRootLayout}>
          <TouchableOpacity
            style={[styles.modalBackdrop, styles.backdropFill]}
            activeOpacity={1}
            onPress={() => !uploading && setPendingVideo(null)}
          />
          {pendingVideo ? (
            <Animated.View style={{ transform: [{ translateY: Animated.multiply(kbLift, -1) }] }}>
            <UploadSheet
              video={pendingVideo}
              caption={uploadCaption}
              onChangeCaption={setUploadCaption}
              onCancel={() => setPendingVideo(null)}
              onPublish={publishPendingVideo}
              uploading={uploading}
            />
            </Animated.View>
          ) : null}
        </View>
      </Modal>


    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  // Кадр занимает весь экран: панель вкладок плавает поверх видео.
  fullBleed: { flex: 1 },
  centerDark: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  loopCard: { width: '100%', backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  video: { width: '100%', height: '100%' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space.lg, paddingBottom: 10, zIndex: 20 },
  switcherRow: { height: HEADER_CONTENT, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  searchBar: { flex: 1, height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  addReelBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  actionsRail: { position: 'absolute', right: 12, alignItems: 'center', gap: 20 },
  railButton: { alignItems: 'center', gap: 4 },
  railText: { color: '#fff', fontSize: 12, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 },
  infoOverlay: { position: 'absolute', left: 14, right: 76 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#fff', backgroundColor: colors.surfaceHi },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  authorName: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 },
  caption: { marginTop: 10, color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 },
  progressTrack: { position: 'absolute', left: 14, right: 14, height: 3, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.18)' },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  centerBadge: {
    position: 'absolute', alignSelf: 'center', top: '45%',
    width: 72, height: 72, borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  emptyTitle: { marginTop: 12, color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 8, color: colors.textFaint, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  // Слой шторки: поверх всего экрана, вместе со спрятанной панелью вкладок.
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  backdropFill: { backgroundColor: 'rgba(0,0,0,0.45)' },
  noComments: { marginTop: 36, textAlign: 'center', color: colors.textMuted, fontSize: 15, fontWeight: '700' },
  uploadHandle: {
    alignSelf: 'center', width: 42, height: 4, borderRadius: radius.pill,
    backgroundColor: colors.surfaceHi, marginBottom: space.sm,
  },
  uploadSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.lg, paddingTop: space.sm },
  uploadTitle: { color: colors.text, fontSize: 21, fontWeight: '900', textAlign: 'center' },
  uploadHint: { marginTop: 3, color: colors.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  uploadRow: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  previewCard: { width: 104, aspectRatio: 9 / 16, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceHi, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  previewVideo: { width: '100%', height: '100%' },
  previewChip: { position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  previewChipText: { color: colors.onAccent, fontSize: 10, fontWeight: '900' },
  uploadFields: { flex: 1 },
  uploadCaptionInput: { flex: 1, minHeight: 130, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: 12, color: colors.text, fontSize: 15, lineHeight: 21, textAlignVertical: 'top' },
  captionCounter: { marginTop: 6, color: colors.textMuted, fontSize: 12, textAlign: 'right', fontWeight: '700' },
  publishBtn: { marginTop: space.lg, height: 52, borderRadius: radius.pill, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  publishText: { color: colors.onAccent, fontSize: 16, fontWeight: '900' },
  cancelUploadBtn: { marginTop: space.sm, height: 48, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cancelUploadText: { color: colors.text, fontSize: 15, fontWeight: '900' },
});
