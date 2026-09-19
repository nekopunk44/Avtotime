import React, { useState, useCallback, useEffect, useRef } from 'react';
import { askConfirm } from '../store/confirmStore';
import { showToast } from '../store/toastStore';
import {
  Animated, FlatList, View, Text, Image, StyleSheet,
  ActivityIndicator, RefreshControl, } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { deletePost, FEED_PAGE_SIZE, getFeed, getVideoPoster, isPostSaved, toggleLike, Post, toggleSavePost } from '../api/posts';
import { getStories, getStoryByUserName, Story, uploadStory } from '../api/stories';
import { useAuthStore } from '../store/authStore';
import { AppStackParamList } from '../navigation/AppNavigator';
import { TAB_BAR_SPACE } from '../navigation/FloatingTabBar';
import { colors, font, radius, space, shadow } from '../theme';
import { Avatar, Card, EmptyState, PressableScale, Skeleton } from '../components/ui';
import ReportSheet from '../components/ReportSheet';
import { ChoiceSheet } from '../components/ui';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };


interface PostCardProps {
  item: Post;
  liked: boolean;
  saved: boolean;
  isMine: boolean;
  onProfile: () => void;
  onOpen: () => void;
  onLike: () => void;
  onSave: () => void;
  onActions: () => void;
}

// Single post as an elevated card with a fade-in on mount.
function PostCard({ item, liked, saved, isMine, onProfile, onOpen, onLike, onSave, onActions }: PostCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  const firstMedia = item.mediaList?.[0] || item.media;
  const mediaCount = item.mediaList?.length ?? (item.media ? 1 : 0);
  const isVideo = item.mediaType === 'video';
  const poster = isVideo ? getVideoPoster(firstMedia) || firstMedia : firstMedia;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <PressableScale style={styles.authorTap} onPress={onProfile}>
            <Avatar
              uri={item.author?.profileImage}
              userName={item.author?.userName}
              name={item.author?.name}
              size={42}
            />
            <View>
              <Text style={styles.name}>{item.author?.name}</Text>
              <Text style={styles.username}>@{item.author?.userName}</Text>
            </View>
          </PressableScale>
          <PressableScale style={styles.moreBtn} onPress={onActions} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
          </PressableScale>
        </View>

        {firstMedia ? (
          <PressableScale onPress={onOpen} scaleTo={0.99}>
            <View style={styles.mediaWrap}>
              <Image source={{ uri: poster }} style={styles.postImage} resizeMode="cover" />
              {isVideo ? (
                <View style={styles.playBadge}>
                  <View style={styles.playCircle}>
                    <Ionicons name="play" size={26} color="#fff" />
                  </View>
                </View>
              ) : null}
              {mediaCount > 1 ? (
                <View style={styles.mediaCounter}>
                  <Ionicons name="images-outline" size={13} color="#fff" />
                  <Text style={styles.mediaCounterText}>{mediaCount}</Text>
                </View>
              ) : null}
            </View>
          </PressableScale>
        ) : null}

        {item.caption ? <Text style={styles.caption}>{item.caption}</Text> : null}

        <View style={styles.actions}>
          <PressableScale style={styles.actionBtn} onPress={onLike} hitSlop={10}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={23} color={liked ? colors.danger : colors.textMuted} />
            <Text style={[styles.actionCount, liked && { color: colors.danger }]}>{item.likes.length}</Text>
          </PressableScale>
          <PressableScale style={styles.actionBtn} onPress={onOpen} hitSlop={10}>
            <Ionicons name="chatbubble-outline" size={21} color={colors.textMuted} />
            <Text style={styles.actionCount}>{item.commentsCount ?? item.comments.length}</Text>
          </PressableScale>
          <PressableScale style={styles.saveActionBtn} onPress={onSave} hitSlop={10}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color={saved ? colors.accent : colors.textMuted} />
          </PressableScale>
        </View>
      </Card>
    </Animated.View>
  );
}

function FeedSkeleton() {
  return (
    <View>
      {[0, 1].map((i) => (
        <Card key={i} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.authorTap}>
              <Skeleton style={styles.avatar} />
              <View style={{ gap: 6 }}>
                <Skeleton style={{ width: 120, height: 12 }} />
                <Skeleton style={{ width: 80, height: 10 }} />
              </View>
            </View>
          </View>
          <Skeleton style={styles.mediaWrap} />
          <Skeleton style={{ width: '70%', height: 12, marginTop: space.md }} />
        </Card>
      ))}
    </View>
  );
}

export default function FeedScreen({ navigation }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [uploadingStory, setUploadingStory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const loadFeed = useCallback(async () => {
    try {
      const [postData, followingStories, myStory] = await Promise.all([
        getFeed(1, FEED_PAGE_SIZE),
        getStories().catch(() => []),
        user?.userName ? getStoryByUserName(user.userName).catch(() => null) : Promise.resolve(null),
      ]);

      const storyMap = new Map<string, Story>();
      if (myStory) storyMap.set(myStory._id, myStory);
      followingStories.forEach((story) => storyMap.set(story._id, story));

      setPosts(postData);
      setStories(Array.from(storyMap.values()));
      setPage(1);
      setHasMore(postData.length === FEED_PAGE_SIZE);
    } catch (e) {
      console.error('Feed error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.userName]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading || refreshing) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const more = await getFeed(next, FEED_PAGE_SIZE);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p._id));
        return [...prev, ...more.filter((p) => !seen.has(p._id))];
      });
      setPage(next);
      setHasMore(more.length === FEED_PAGE_SIZE);
    } catch {
      // keep current posts; user can retry by scrolling again
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, loading, refreshing, page]);

  useFocusEffect(useCallback(() => {
    // Only load when the list is empty — reloading on every focus would reset
    // pagination and jump the scroll position. Pull-to-refresh reloads manually.
    if (posts.length === 0) loadFeed();
  }, [posts.length, loadFeed]));

  const pickAndUploadStory = async (mediaType: 'image' | 'video') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Разрешите доступ к медиатеке, чтобы загрузить историю.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaType === 'video' ? ['videos'] : ['images'],
      allowsEditing: true,
      quality: 0.85,
      videoMaxDuration: 60,
    });

    if (result.canceled) return;

    setUploadingStory(true);
    try {
      const story = await uploadStory(result.assets[0].uri, mediaType);
      setStories((prev) => [story, ...prev.filter((item) => item._id !== story._id)]);
      navigation.navigate('StoryViewer', { story });
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось загрузить историю', 'error');
    } finally {
      setUploadingStory(false);
    }
  };

  const uploadStoryPrompt = () => setStoryPrompt(true);

  const handleLike = async (postId: string) => {
    if (!user) return;
    // Optimistic: flip the like locally right away, roll back if the API fails.
    const flip = (p: Post): Post => p._id !== postId ? p : {
      ...p,
      likes: p.likes.includes(user._id)
        ? p.likes.filter((id) => id !== user._id)
        : [...p.likes, user._id],
    };
    setPosts((prev) => prev.map(flip));
    try {
      const updated = await toggleLike(postId);
      setPosts((prev) => prev.map((p) => p._id === postId ? { ...p, ...updated } : p));
    } catch {
      setPosts((prev) => prev.map(flip));
    }
  };

  const handleSave = async (postId: string) => {
    if (!user) return;
    try {
      const nextUser = await toggleSavePost(postId);
      setUser({ ...user, saved: nextUser.saved ?? [] });
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось сохранить публикацию', 'error');
    }
  };

  const removePost = (post: Post) => {
    askConfirm({
      title: 'Удалить публикацию?',
      message: 'Публикация исчезнет из вашей ленты и профиля.',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      destructive: true,
    }).then((agreed) => { if (agreed) (async () => {
          try {
            await deletePost(post._id);
            setPosts((prev) => prev.filter((item) => item._id !== post._id));
          } catch (e: any) {
            showToast(e.response?.data?.message || 'Не удалось удалить публикацию', 'error');
          }
        })(); });
  };

  const [reportPostId, setReportPostId] = useState<string | null>(null);
  // Выбор снизу вместо системных списков: чем публиковать и что делать с постом.
  const [storyPrompt, setStoryPrompt] = useState(false);
  const [postActions, setPostActions] = useState<Post | null>(null);

  const openPostActions = (post: Post) => {
    if (post.author?._id !== user?._id) {
      // Чужой пост: единственное действие в меню — пожаловаться.
      setReportPostId(post._id);
      return;
    }
    setPostActions(post);
  };

  const renderPost = ({ item }: { item: Post }) => (
    <PostCard
      item={item}
      liked={user ? item.likes.includes(user._id) : false}
      saved={isPostSaved(user, item._id)}
      isMine={item.author?._id === user?._id}
      onProfile={() => {
        const authorId = item.author?._id;
        if (authorId) navigation.navigate('UserProfile', { userId: authorId });
      }}
      onOpen={() => navigation.navigate('PostComments', { postId: item._id })}
      onLike={() => handleLike(item._id)}
      onSave={() => handleSave(item._id)}
      onActions={() => openPostActions(item)}
    />
  );

  const renderStories = () => (
    <View style={styles.storiesWrap}>
      <FlatList
        data={stories}
        horizontal
        keyExtractor={(item) => item._id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesList}
        ListHeaderComponent={
          <PressableScale style={styles.storyItem} onPress={uploadStoryPrompt} disabled={uploadingStory}>
            <View style={[styles.storyRing, styles.addStoryRing]}>
              <View style={styles.storyInner}>
                {uploadingStory ? (
                  <ActivityIndicator color={colors.accent} />
                ) : user?.profileImage ? (
                  <Image source={{ uri: user.profileImage }} style={styles.storyImage} />
                ) : (
                  <Ionicons name="add" size={24} color={colors.accent} />
                )}
              </View>
              <View style={styles.storyPlus}>
                <Ionicons name="add" size={13} color={colors.onAccent} />
              </View>
            </View>
            <Text style={styles.storyName} numberOfLines={1}>Ваша</Text>
          </PressableScale>
        }
        renderItem={({ item }) => {
          const viewed = user ? item.viewers?.some((viewer) => viewer._id === user._id) : false;
          return (
            <PressableScale
              style={styles.storyItem}
              onPress={() => navigation.navigate('StoryViewer', { story: item })}
            >
              <View style={[styles.storyRing, viewed && styles.storyRingViewed]}>
                <View style={styles.storyInner}>
                  <Avatar
                    uri={item.author?.profileImage}
                    userName={item.author?.userName}
                    name={item.author?.name}
                    size={54}
                  />
                </View>
              </View>
              <Text style={styles.storyName} numberOfLines={1}>{item.author?.userName}</Text>
            </PressableScale>
          );
        }}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.list}>
        {renderStories()}
        <FeedSkeleton />
      </View>
    );
  }

  return (
    <>
    <FlatList
      data={posts}
      keyExtractor={(item) => item._id}
      renderItem={renderPost}
      style={styles.list}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadFeed(); }}
          tintColor={colors.accent}
        />
      }
      ListHeaderComponent={renderStories()}
      ListEmptyComponent={
        <EmptyState
          icon="newspaper-outline"
          title="Пока пусто"
          subtitle="Подпишитесь на людей или создайте первую публикацию, и лента оживёт."
          actionLabel="Создать публикацию"
          onAction={() => navigation.navigate('CreatePost')}
        />
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        loadingMore ? <ActivityIndicator style={styles.footer} color={colors.accent} /> : <View style={{ height: space.lg }} />
      }
    />
    <ReportSheet
      visible={reportPostId !== null}
      targetType="post"
      targetId={reportPostId ?? ''}
      onClose={() => setReportPostId(null)}
    />

    <ChoiceSheet
      visible={storyPrompt}
      title="Новая история"
      options={[
        { value: 'image', label: 'Фото', icon: 'image-outline' },
        { value: 'video', label: 'Видео', icon: 'videocam-outline' },
      ]}
      onSelect={(value) => pickAndUploadStory(value as 'image' | 'video')}
      onClose={() => setStoryPrompt(false)}
    />

    <ChoiceSheet
      visible={postActions !== null}
      title="Публикация"
      options={[
        { value: 'edit', label: 'Редактировать', icon: 'create-outline' },
        { value: 'delete', label: 'Удалить', icon: 'trash-outline', danger: true },
      ]}
      onSelect={(value) => {
        const post = postActions;
        if (!post) return;
        if (value === 'edit') navigation.navigate('EditPost', { post });
        else removePost(post);
      }}
      onClose={() => setPostActions(null)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: TAB_BAR_SPACE },
  footer: { paddingVertical: space.xl },

  storiesWrap: { backgroundColor: colors.surface, marginBottom: space.md, ...shadow.card },
  storiesList: { paddingHorizontal: space.md, paddingVertical: space.md, gap: 14 },
  storyItem: { width: 68, alignItems: 'center' },
  storyRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 2.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  storyRingViewed: { borderColor: colors.border },
  addStoryRing: { borderColor: colors.accent, borderStyle: 'dashed' },
  storyInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  storyImage: { width: '100%', height: '100%' },
  storyPlus: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  storyName: { marginTop: 6, color: colors.textMuted, fontSize: font.tiny, fontWeight: '700', maxWidth: 64 },

  card: { marginHorizontal: space.md, marginBottom: space.md, padding: space.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  authorTap: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  moreBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceAlt },
  name: { fontWeight: '900', fontSize: font.body, color: colors.text },
  username: { fontSize: font.small, color: colors.textFaint, marginTop: 1 },

  mediaWrap: { width: '100%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt, marginTop: space.md },
  postImage: { width: '100%', height: '100%' },
  playBadge: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingLeft: 4 },
  mediaCounter: { position: 'absolute', right: 10, top: 10, borderRadius: 14, paddingHorizontal: 8, height: 26, backgroundColor: 'rgba(0,0,0,0.62)', flexDirection: 'row', alignItems: 'center', gap: 4 },
  mediaCounterText: { color: '#fff', fontSize: font.tiny, fontWeight: '900' },

  caption: { paddingTop: space.md, fontSize: font.body, color: colors.text, lineHeight: 21 },
  actions: { flexDirection: 'row', alignItems: 'center', paddingTop: space.md, gap: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: font.small, fontWeight: '700', color: colors.textMuted },
  saveActionBtn: { marginLeft: 'auto' },
});
