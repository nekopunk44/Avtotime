import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { RouteProp, useFocusEffect, useIsFocused, useRoute } from '@react-navigation/native';
import { commentLoop, getLoops, likeLoop, Loop, uploadLoop } from '../api/loops';
import { useAuthStore } from '../store/authStore';
import { AppStackParamList, AppTabParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };

const LOOPS_PAGE_SIZE = 10;

type LoopCardProps = {
  loop: Loop;
  active: boolean;
  height: number;
  onLike: (loopId: string) => void;
  onCommentOpen: (loop: Loop) => void;
  onAuthorPress: (userId?: string) => void;
};

function LoopCard({ loop, active, height, onLike, onCommentOpen, onAuthorPress }: LoopCardProps) {
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const user = useAuthStore((s) => s.user);
  const liked = !!user?._id && loop.likes?.includes(user._id);
  const commentsCount = typeof loop.commentsCount === 'number'
    ? loop.commentsCount
    : (loop.commentsPreview || loop.comments || []).length;

  const player = useVideoPlayer(loop.media, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.timeUpdateEventInterval = 0.25;
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (active) {
      player.play();
    } else {
      player.pause();
    }
  }, [active, player]);

  useEffect(() => {
    const subscription = (player as any).addListener?.('timeUpdate', ({ currentTime }: { currentTime: number }) => {
      const duration = player.duration || 0;
      setProgress(duration > 0 ? Math.min(1, currentTime / duration) : 0);
    });

    return () => subscription?.remove?.();
  }, [player]);

  return (
    <View style={[styles.loopCard, { height }]}>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls={false}
        contentFit="contain"
        allowsPictureInPicture={false}
        surfaceType="textureView"
      />

      <View style={styles.topOverlay}>
        <Text style={styles.screenTitle}>Короткие видео</Text>
      </View>

      <TouchableOpacity
        style={styles.soundBtn}
        onPress={() => setMuted((prev) => !prev)}
        activeOpacity={0.85}
      >
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#fff" />
      </TouchableOpacity>

      <View style={styles.actionsRail}>
        <TouchableOpacity style={styles.railButton} onPress={() => onLike(loop._id)} activeOpacity={0.85}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={30} color={liked ? '#ff335f' : '#fff'} />
          <Text style={styles.railText}>{loop.likes?.length || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.railButton} onPress={() => onCommentOpen(loop)} activeOpacity={0.85}>
          <Ionicons name="chatbubble-outline" size={28} color="#fff" />
          <Text style={styles.railText}>{commentsCount}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoOverlay}>
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

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

export default function LoopsScreen({ navigation }: Props) {
  const route = useRoute<RouteProp<AppTabParamList, 'Loops'>>();
  const [loops, setLoops] = useState<Loop[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [commentTarget, setCommentTarget] = useState<Loop | null>(null);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [pendingVideo, setPendingVideo] = useState<{ uri: string; mimeType?: string } | null>(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [error, setError] = useState('');
  const { height } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const focused = useIsFocused();
  const listHeight = Math.max(320, height - tabBarHeight);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;
  const listRef = useRef<FlatList<Loop>>(null);
  const targetLoopId = route.params?.loopId;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const first = viewableItems?.[0];
    if (typeof first?.index === 'number') setActiveIndex(first.index);
  }).current;

  const activeLoop = useMemo(
    () => commentTarget ? loops.find((loop) => loop._id === commentTarget._id) || commentTarget : null,
    [commentTarget, loops],
  );

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

  const handleLike = async (loopId: string) => {
    try {
      const updated = await likeLoop(loopId);
      updateLoop(updated);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось поставить лайк');
    }
  };

  const openAuthor = (userId?: string) => {
    if (!userId) return;
    navigation.navigate('UserProfile', { userId });
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Доступ к галерее', 'Разрешите доступ к видео, чтобы загрузить loop.');
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
      Alert.alert('Готово', 'Видео опубликовано.');
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось загрузить видео');
    } finally {
      setUploading(false);
    }
  };

  const sendComment = async () => {
    if (!activeLoop || !commentText.trim()) return;

    setSendingComment(true);
    try {
      const updated = await commentLoop(activeLoop._id, commentText.trim());
      updateLoop(updated);
      setCommentText('');
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось отправить комментарий');
    } finally {
      setSendingComment(false);
    }
  };

  const closeComments = () => {
    setCommentTarget(null);
    setCommentText('');
  };

  const renderLoop = ({ item, index }: { item: Loop; index: number }) => (
    <LoopCard
      loop={item}
      active={focused && index === activeIndex}
      height={listHeight}
      onLike={handleLike}
      onCommentOpen={setCommentTarget}
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
        data={loops}
        keyExtractor={(item) => item._id}
        renderItem={renderLoop}
        pagingEnabled
        snapToInterval={listHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
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
            <Ionicons name={error ? 'alert-circle-outline' : 'play-circle-outline'} size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{error || 'Пока нет видео'}</Text>
            <Text style={styles.emptyText}>
              {error ? 'Потяните вниз, чтобы попробовать снова.' : 'Загрузите первое короткое видео для Avtotime.'}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.uploadBtn}
        onPress={pickVideo}
        disabled={uploading}
        activeOpacity={0.85}
      >
        {uploading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Ionicons name="add" size={26} color={colors.text} />
        )}
      </TouchableOpacity>

      <Modal visible={!!pendingVideo} transparent animationType="fade" onRequestClose={() => setPendingVideo(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.uploadModalRoot}
        >
          <TouchableOpacity
            style={styles.uploadModalBackdrop}
            activeOpacity={1}
            onPress={() => !uploading && setPendingVideo(null)}
          />
          <View style={styles.uploadDialog}>
            <Text style={styles.uploadTitle}>Новое видео</Text>
            <TextInput
              style={styles.uploadCaptionInput}
              placeholder="Описание..."
              placeholderTextColor={colors.textFaint}
              value={uploadCaption}
              onChangeText={(value) => setUploadCaption(value.slice(0, 280))}
              multiline
            />
            <Text style={styles.captionCounter}>{uploadCaption.length}/280</Text>
            <View style={styles.uploadActions}>
              <TouchableOpacity
                style={styles.cancelUploadBtn}
                onPress={() => setPendingVideo(null)}
                disabled={uploading}
              >
                <Text style={styles.cancelUploadText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.publishBtn}
                onPress={publishPendingVideo}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.publishText}>Опубликовать</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!activeLoop} transparent animationType="slide" onRequestClose={closeComments}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeComments} />
          <View style={styles.commentsSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Комментарии</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={closeComments}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={activeLoop?.comments || activeLoop?.commentsPreview || []}
              keyExtractor={(item, index) => item._id || `${item.author?._id || 'comment'}-${index}`}
              style={styles.commentsList}
              contentContainerStyle={styles.commentsContent}
              ListEmptyComponent={<Text style={styles.noComments}>Комментариев пока нет</Text>}
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  {item.author?.profileImage ? (
                    <Image source={{ uri: item.author.profileImage }} style={styles.commentAvatar} />
                  ) : (
                    <View style={[styles.commentAvatar, styles.commentAvatarFallback]}>
                      <Ionicons name="person-outline" size={16} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.commentBody}>
                    <Text style={styles.commentAuthor}>@{item.author?.userName || 'user'}</Text>
                    <Text style={styles.commentMessage}>{item.message}</Text>
                  </View>
                </View>
              )}
            />

            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Напишите комментарий..."
                placeholderTextColor={colors.textFaint}
                value={commentText}
                onChangeText={setCommentText}
                returnKeyType="send"
                onSubmitEditing={sendComment}
              />
              <TouchableOpacity
                style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
                onPress={sendComment}
                disabled={!commentText.trim() || sendingComment}
              >
                {sendingComment ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceHi },
  centerDark: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHi },
  loopCard: { width: '100%', backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  video: { width: '100%', height: '100%' },
  topOverlay: { position: 'absolute', top: 14, left: 0, right: 0, alignItems: 'center' },
  screenTitle: { color: '#fff', fontSize: 17, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 8 },
  soundBtn: { position: 'absolute', top: 14, right: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  actionsRail: { position: 'absolute', right: 12, bottom: 120, alignItems: 'center', gap: 20 },
  railButton: { alignItems: 'center', gap: 4 },
  railText: { color: '#fff', fontSize: 12, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 },
  infoOverlay: { position: 'absolute', left: 14, right: 76, bottom: 36 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#fff', backgroundColor: '#333' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  authorName: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 },
  caption: { marginTop: 10, color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
  progressFill: { height: '100%', backgroundColor: '#ff335f' },
  uploadBtn: { position: 'absolute', top: 14, left: 14, width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  emptyTitle: { marginTop: 12, color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 8, color: colors.textFaint, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  commentsSheet: { maxHeight: '72%', minHeight: '50%', backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 8 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#ddd', marginBottom: 8 },
  sheetHeader: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  closeBtn: { position: 'absolute', right: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  commentsList: { flex: 1 },
  commentsContent: { padding: 16, gap: 14 },
  noComments: { marginTop: 36, textAlign: 'center', color: colors.textMuted, fontSize: 15, fontWeight: '700' },
  commentRow: { flexDirection: 'row', gap: 10 },
  commentAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceAlt },
  commentAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  commentBody: { flex: 1 },
  commentAuthor: { color: colors.text, fontSize: 13, fontWeight: '900' },
  commentMessage: { marginTop: 3, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14, borderTopWidth: 1, borderTopColor: colors.border },
  commentInput: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, color: colors.text, fontSize: 14 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.45 },
  uploadModalRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  uploadModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.62)' },
  uploadDialog: { width: '100%', maxWidth: 420, borderRadius: 8, backgroundColor: colors.surface, padding: 16 },
  uploadTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  uploadCaptionInput: { minHeight: 112, marginTop: 14, borderRadius: 8, backgroundColor: colors.surfaceAlt, padding: 12, color: colors.text, fontSize: 15, lineHeight: 21, textAlignVertical: 'top' },
  captionCounter: { marginTop: 6, color: colors.textMuted, fontSize: 12, textAlign: 'right', fontWeight: '700' },
  uploadActions: { marginTop: 16, flexDirection: 'row', gap: 10 },
  cancelUploadBtn: { flex: 1, height: 46, borderRadius: 8, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cancelUploadText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  publishBtn: { flex: 1, height: 46, borderRadius: 8, backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center' },
  publishText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});
