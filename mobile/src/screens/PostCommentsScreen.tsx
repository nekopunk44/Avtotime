import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useHeaderHeight } from '@react-navigation/elements';
import { addComment, deletePost, getPostById, isPostSaved, Post, PostComment, toggleLike, toggleSavePost } from '../api/posts';
import { useAuthStore } from '../store/authStore';
import { AppStackParamList } from '../navigation/AppNavigator';
import PostMediaCarousel from '../components/PostMediaCarousel';
import { Avatar } from '../components/ui';
import { colors } from '../theme';

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
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const headerHeight = useHeaderHeight();

  const load = useCallback(async () => {
    try {
      const data = await getPostById(postId);
      setPost(data);
      navigation.setOptions({ title: `Комментарии (${data.commentsCount ?? data.comments.length})` });
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось загрузить комментарии');
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
      navigation.setOptions({ title: `Комментарии (${updated.commentsCount ?? updated.comments.length})` });
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось добавить комментарий');
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
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось обновить лайк');
    }
  };

  const handleSave = async () => {
    if (!post || !user) return;
    try {
      const nextUser = await toggleSavePost(post._id);
      setUser({ ...user, saved: nextUser.saved ?? [] });
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось сохранить публикацию');
    }
  };

  const confirmDelete = () => {
    if (!post) return;
    Alert.alert('Удалить публикацию?', 'Публикация исчезнет из ленты и профиля.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost(post._id);
            navigation.goBack();
          } catch (e: any) {
            Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось удалить публикацию');
          }
        },
      },
    ]);
  };

  const renderHeader = () => {
    if (!post) return null;
    const liked = user ? post.likes?.includes(user._id) : false;
    const saved = isPostSaved(user, post._id);
    const isMine = post.author?._id === user?._id;
    const hasMedia = !!(post.mediaList?.length || post.media);

    return (
      <View style={styles.postHeader}>
        <View style={styles.authorRow}>
          <Avatar
            uri={post.author?.profileImage}
            userName={post.author?.userName}
            name={post.author?.name}
            size={40}
          />
          <View style={styles.authorText}>
            <Text style={styles.name}>{post.author?.name}</Text>
            <Text style={styles.username}>@{post.author?.userName}</Text>
          </View>
        </View>
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        data={post?.comments ?? []}
        keyExtractor={(item) => item._id}
        renderItem={renderComment}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={<Text style={styles.empty}>Пока нет комментариев</Text>}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Добавить комментарий..."
          placeholderTextColor={colors.textFaint}
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity
          style={styles.sendBtn}
          onPress={handleSend}
          disabled={sending || !text.trim()}
        >
          {sending
            ? <ActivityIndicator size="small" color={colors.text} />
            : <Ionicons name="send" size={20} color={text.trim() ? colors.accent : colors.textFaint} />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 16 },
  postHeader: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt },
  authorText: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  username: { fontSize: 12, color: colors.textFaint, marginTop: 1 },
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
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 110, backgroundColor: colors.surfaceAlt,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 15, color: colors.text,
  },
  sendBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
});
