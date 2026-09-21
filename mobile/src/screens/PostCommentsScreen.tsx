import React, { useCallback, useEffect, useRef, useState } from 'react';
import { askConfirm } from '../store/confirmStore';
import { showToast } from '../store/toastStore';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Animated, Easing, Keyboard, } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addComment, deletePost, getPostById, isPostSaved, Post, PostComment, toggleLike, toggleSavePost } from '../api/posts';
import { useAuthStore } from '../store/authStore';
import { AppStackParamList } from '../navigation/AppNavigator';
import PostMediaCarousel from '../components/PostMediaCarousel';
import { Avatar } from '../components/ui';
import { colors, font, radius, shadow, space } from '../theme';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'PostComments'>;
  route: RouteProp<AppStackParamList, 'PostComments'>;
};


function getCommentAuthor(comment: PostComment) {
  return typeof comment.author === 'string'
    ? { name: 'Пользователь', userName: 'user', profileImage: undefined }
    : comment.author;
}

export default function PostCommentsScreen({ route, navigation }: Props) {
  const { postId } = route.params;
  const [post, setPost] = useState<Post | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const insets = useSafeAreaInsets();

  // Место под клавиатуру считаем по её событиям: под edge-to-edge окно не
  // сжимается, и KeyboardAvoidingView оставлял поле под клавиатурой.
  const kbLift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const glide = (height: number, duration?: number) => {
      Animated.timing(kbLift, {
        toValue: Math.max(0, height - insets.bottom),
        duration: duration && duration > 0 ? duration : 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    };
    const subs = [
      Keyboard.addListener('keyboardWillShow', (e) => glide(e.endCoordinates.height, e.duration)),
      Keyboard.addListener('keyboardDidShow', (e) => glide(e.endCoordinates.height, e.duration)),
      Keyboard.addListener('keyboardWillHide', (e) => glide(0, e.duration)),
      Keyboard.addListener('keyboardDidHide', (e) => glide(0, e.duration)),
    ];
    return () => subs.forEach((sub) => sub.remove());
  }, [insets.bottom, kbLift]);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const load = useCallback(async () => {
    try {
      const data = await getPostById(postId);
      setPost(data);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось загрузить комментарии', 'error');
    } finally {
      setLoading(false);
    }
  }, [navigation, postId]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    const message = text.trim();
    if (!message || sending) return;

    setSending(true);
    try {
      const updated = await addComment(postId, message);
      setPost(updated);
      setText('');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось добавить комментарий', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleLike = async () => {
    if (!post) return;
    try {
      const updated = await toggleLike(post._id);
      setPost((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось обновить лайк', 'error');
    }
  };

  const handleSave = async () => {
    if (!post || !user) return;
    try {
      const nextUser = await toggleSavePost(post._id);
      setUser({ ...user, saved: nextUser.saved ?? [] });
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось сохранить публикацию', 'error');
    }
  };

  const confirmDelete = () => {
    if (!post) return;
    askConfirm({
      title: 'Удалить публикацию?',
      message: 'Публикация исчезнет из ленты и профиля.',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      destructive: true,
    }).then((agreed) => { if (agreed) (async () => {
          try {
            await deletePost(post._id);
            navigation.goBack();
          } catch (e: any) {
            showToast(e.response?.data?.message || 'Не удалось удалить публикацию', 'error');
          }
        })(); });
  };

  const buildHeader = () => {
    if (!post) return null;
    const liked = user ? post.likes?.includes(user._id) : false;
    const saved = isPostSaved(user, post._id);
    const isMine = post.author?._id === user?._id;
    const hasMedia = !!(post.mediaList?.length || post.media);

    return (
      <View style={styles.postHeader}>
        {hasMedia ? (
          <PostMediaCarousel media={post.media} mediaList={post.mediaList} mediaType={post.mediaType} />
        ) : null}
        {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
        <View style={styles.postActions}>
          <TouchableOpacity style={styles.postActionBtn} onPress={handleLike}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? colors.danger : colors.textFaint} />
            <Text style={styles.postActionText}>{post.likes?.length ?? 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.postActionBtn} onPress={handleSave}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color={colors.textMuted} />
            <Text style={styles.postActionText}>{saved ? 'Сохранено' : 'Сохранить'}</Text>
          </TouchableOpacity>
          {isMine ? (
            <View style={styles.ownerActions}>
              <TouchableOpacity style={styles.ownerBtn} onPress={() => navigation.navigate('EditPost', { post })}>
                <Ionicons name="create-outline" size={18} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.ownerBtn} onPress={confirmDelete}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
        <Text style={styles.sectionTitle}>Комментарии</Text>
      </View>
    );
  };

  const renderComment = ({ item }: { item: PostComment }) => {
    const author = getCommentAuthor(item);

    return (
      <View style={styles.commentRow}>
        <Avatar uri={author.profileImage} userName={author.userName} name={author.name} size={34} />
        <View style={styles.commentBubble}>
          <Text style={styles.commentName}>{author.userName ? `@${author.userName}` : author.name}</Text>
          <Text style={styles.commentText}>{item.message}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.text} /></View>;
  }

  const header = buildHeader();

  const canSend = !!text.trim() && !sending;

  const openAuthor = () => {
    const authorId = post?.author?._id;
    if (authorId) navigation.navigate('UserProfile', { userId: authorId });
  };

  return (
    <View style={styles.container}>
      {/* Своя строка вместо шапки навигации: возврат слева, автор по центру —
          чтобы имя стояло на одном уровне с кнопкой, а не под ней. */}
      <View style={[styles.topBar, { paddingTop: insets.top + space.xs }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.topAuthor} activeOpacity={0.8} onPress={openAuthor}>
          <Avatar
            uri={post?.author?.profileImage}
            userName={post?.author?.userName}
            name={post?.author?.name}
            size={34}
          />
          <View style={styles.topAuthorText}>
            <Text style={styles.name} numberOfLines={1}>{post?.author?.name || 'Публикация'}</Text>
            {post?.author?.userName ? (
              <Text style={styles.username} numberOfLines={1}>@{post.author.userName}</Text>
            ) : null}
          </View>
        </TouchableOpacity>

        {/* Пустое место шириной с кнопку: без него автор смещается вправо. */}
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={post?.comments ?? []}
        keyExtractor={(item) => item._id}
        renderItem={renderComment}
        ListHeaderComponent={header}
        ListEmptyComponent={<Text style={styles.empty}>Пока нет комментариев</Text>}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 96 }]}
        keyboardShouldPersistTaps="handled"
      />

      {/* Ввод прижат к низу экрана отдельным слоем: в общем потоке его нижний
          край срезала системная полоса. Клавиатура двигает сам слой. */}
      <Animated.View
        style={[styles.composerWrap, { bottom: kbLift, paddingBottom: insets.bottom + space.sm }]}
      >
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Добавить комментарий"
            placeholderTextColor={colors.textFaint}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnOff]}
            onPress={handleSend}
            disabled={!canSend}
          >
            {sending
              ? <ActivityIndicator size="small" color={colors.onAccent} />
              : <Ionicons name="arrow-up" size={18} color={canSend ? colors.onAccent : colors.textFaint} />}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: space.xxl },
  postHeader: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt },
  authorText: { flex: 1 },
  name: { fontSize: font.body, fontWeight: '900', color: colors.text },
  username: { marginTop: 1, fontSize: font.tiny, fontWeight: '800', color: colors.textFaint },
  caption: { paddingHorizontal: 14, paddingTop: 12, fontSize: 14, color: colors.text, lineHeight: 20 },
  postActions: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingTop: 12 },
  postActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postActionText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  ownerActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 },
  ownerBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { paddingHorizontal: 14, paddingTop: 16, fontSize: 13, fontWeight: '700', color: colors.textMuted },
  commentRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 8 },
  commentAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceAlt },
  commentBubble: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  commentName: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 3 },
  commentText: { fontSize: 14, color: colors.text, lineHeight: 19 },
  empty: { textAlign: 'center', color: colors.textFaint, marginTop: 30, fontSize: 14 },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: space.sm, paddingBottom: space.sm,
    backgroundColor: colors.bg,
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  topAuthor: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  topAuthorText: { flexShrink: 1 },
  composerWrap: {
    position: 'absolute', left: 0, right: 0,
    paddingHorizontal: space.md, paddingTop: space.sm, backgroundColor: colors.bg,
  },
  // Строка комментария ниже, чем в чате: здесь пишут короче, а высокая
  // пилюля отъедала место у самой переписки.
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: space.xs,
    borderRadius: radius.xl, backgroundColor: colors.surface,
    paddingHorizontal: 5, paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    ...shadow.float,
  },
  input: {
    flex: 1, minHeight: 38, maxHeight: 104, paddingHorizontal: space.sm,
    paddingTop: 8, paddingBottom: 8, fontSize: font.small, color: colors.text,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnOff: { backgroundColor: colors.surfaceAlt },
});
