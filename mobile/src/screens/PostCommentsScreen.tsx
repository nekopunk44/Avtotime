import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Image, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { addComment, deletePost, getPostById, isPostSaved, Post, PostComment, toggleLike, toggleSavePost } from '../api/posts';
import { useAuthStore } from '../store/authStore';
import { AppStackParamList } from '../navigation/AppNavigator';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'PostComments'>;
  route: RouteProp<AppStackParamList, 'PostComments'>;
};

const fallbackAvatar = require('../../assets/icon.png');

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
    const avatar = post.author?.profileImage ? { uri: post.author.profileImage } : fallbackAvatar;
    const liked = user ? post.likes?.includes(user._id) : false;
    const saved = isPostSaved(user, post._id);
    const isMine = post.author?._id === user?._id;
    const media = post.mediaList?.[0] || post.media;
    const mediaCount = post.mediaList?.length ?? (post.media ? 1 : 0);

    return (
      <View style={styles.postHeader}>
        <View style={styles.authorRow}>
          <Image source={avatar} style={styles.avatar} />
          <View style={styles.authorText}>
            <Text style={styles.name}>{post.author?.name}</Text>
            <Text style={styles.username}>@{post.author?.userName}</Text>
          </View>
        </View>
        {media ? (
          <View>
            <Image source={{ uri: media }} style={styles.postImage} resizeMode="cover" />
            {mediaCount > 1 ? (
              <View style={styles.mediaCounter}>
                <Ionicons name="images-outline" size={14} color="#fff" />
                <Text style={styles.mediaCounterText}>{mediaCount}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
        <View style={styles.postActions}>
          <TouchableOpacity style={styles.postActionBtn} onPress={handleLike}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? '#e53935' : '#555'} />
            <Text style={styles.postActionText}>{post.likes?.length ?? 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.postActionBtn} onPress={handleSave}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color="#555" />
            <Text style={styles.postActionText}>{saved ? 'Сохранено' : 'Сохранить'}</Text>
          </TouchableOpacity>
          {isMine ? (
            <View style={styles.ownerActions}>
              <TouchableOpacity style={styles.ownerBtn} onPress={() => navigation.navigate('EditPost', { post })}>
                <Ionicons name="create-outline" size={18} color="#111" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.ownerBtn} onPress={confirmDelete}>
                <Ionicons name="trash-outline" size={18} color="#d92323" />
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
    const avatar = author.profileImage ? { uri: author.profileImage } : fallbackAvatar;

    return (
      <View style={styles.commentRow}>
        <Image source={avatar} style={styles.commentAvatar} />
        <View style={styles.commentBubble}>
          <Text style={styles.commentName}>{author.userName ? `@${author.userName}` : author.name}</Text>
          <Text style={styles.commentText}>{item.message}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#111" /></View>;
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
          placeholderTextColor="#aaa"
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
            ? <ActivityIndicator size="small" color="#111" />
            : <Ionicons name="send" size={20} color={text.trim() ? '#111' : '#ccc'} />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 16 },
  postHeader: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee' },
  authorText: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: '#111' },
  username: { fontSize: 12, color: '#888', marginTop: 1 },
  postImage: { width: '100%', aspectRatio: 1, backgroundColor: '#eee' },
  mediaCounter: { position: 'absolute', right: 10, top: 10, borderRadius: 14, paddingHorizontal: 8, height: 28, backgroundColor: 'rgba(0,0,0,0.62)', flexDirection: 'row', alignItems: 'center', gap: 4 },
  mediaCounterText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  caption: { paddingHorizontal: 14, paddingTop: 12, fontSize: 14, color: '#222', lineHeight: 20 },
  postActions: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingTop: 12 },
  postActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postActionText: { color: '#555', fontSize: 13, fontWeight: '800' },
  ownerActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 },
  ownerBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f3f3f3', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { paddingHorizontal: 14, paddingTop: 16, fontSize: 13, fontWeight: '700', color: '#777' },
  commentRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 8 },
  commentAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#eee' },
  commentBubble: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  commentName: { fontSize: 12, fontWeight: '700', color: '#333', marginBottom: 3 },
  commentText: { fontSize: 14, color: '#222', lineHeight: 19 },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 30, fontSize: 14 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee',
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 110, backgroundColor: '#f3f3f3',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 15, color: '#111',
  },
  sendBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
});
