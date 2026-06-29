import React, { useEffect, useState } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getUserById, toggleFollow, getFollowStatus } from '../api/users';
import { getFeed, Post } from '../api/posts';
import { useAuthStore } from '../store/authStore';
import { User } from '../api/auth';
import { AppStackParamList } from '../navigation/AppNavigator';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'UserProfile'>;
  route: RouteProp<AppStackParamList, 'UserProfile'>;
};

export default function UserProfileScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const me = useAuthStore((s) => s.user);
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      getUserById(userId),
      getFeed(),
      getFollowStatus(userId),
    ]).then(([u, allPosts, status]) => {
      setUser(u);
      navigation.setOptions({ title: u.name });
      setPosts(allPosts.filter((p) => p.author?._id === userId));
      setIsFollowing(status.isFollowing);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  const handleFollow = async () => {
    if (!user) return;
    setFollowLoading(true);
    try {
      await toggleFollow(userId);
      setIsFollowing((prev) => !prev);
      setUser((prev) => prev ? {
        ...prev,
        followers: isFollowing
          ? prev.followers.filter((id) => id !== me?._id)
          : [...prev.followers, me!._id],
      } : prev);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось');
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading || !user) return <View style={styles.center}><ActivityIndicator size="large" color="#111" /></View>;

  const isMe = me?._id === userId;
  const avatar = user.profileImage ? { uri: user.profileImage } : require('../../assets/icon.png');

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image source={avatar} style={styles.avatar} />
        <View style={styles.stats}>
          {[
            { label: 'Публикации', value: posts.length },
            { label: 'Подписчики', value: user.followers.length },
            { label: 'Подписки', value: user.following.length },
          ].map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text style={styles.statNum}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.username}>@{user.userName}</Text>
        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
      </View>

      {!isMe && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followingBtn]}
            onPress={handleFollow}
            disabled={followLoading}
          >
            {followLoading
              ? <ActivityIndicator color={isFollowing ? '#111' : '#fff'} size="small" />
              : <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                  {isFollowing ? 'Отписаться' : 'Подписаться'}
                </Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.msgBtn}
            onPress={() => navigation.navigate('Chat', { userId, name: user.name, userName: user.userName ?? '' })}
          >
            <Ionicons name="chatbubble-outline" size={18} color="#111" />
            <Text style={styles.msgBtnText}>Сообщение</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={posts}
        keyExtractor={(p) => p._id}
        numColumns={3}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            {item.mediaList?.[0]
              ? <Image source={{ uri: item.mediaList[0] }} style={styles.gridImage} />
              : <View style={[styles.gridImage, styles.gridNoImage]}>
                  <Ionicons name="text-outline" size={20} color="#ccc" />
                </View>
            }
          </View>
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eee' },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '700', color: '#111' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  info: { paddingHorizontal: 16, paddingBottom: 12 },
  name: { fontWeight: '700', fontSize: 16, color: '#111' },
  username: { fontSize: 13, color: '#888', marginTop: 1 },
  bio: { fontSize: 14, color: '#444', marginTop: 6, lineHeight: 20 },
  actions: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  followBtn: {
    flex: 1, height: 38, backgroundColor: '#111',
    borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  followingBtn: { backgroundColor: '#f3f3f3', borderWidth: 1, borderColor: '#ddd' },
  followBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  followingBtnText: { color: '#111' },
  msgBtn: {
    flex: 1, height: 38, backgroundColor: '#f3f3f3', borderRadius: 10,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: '#ddd',
  },
  msgBtnText: { fontSize: 14, fontWeight: '600', color: '#111' },
  gridItem: { flex: 1/3 },
  gridImage: { width: '100%', aspectRatio: 1, backgroundColor: '#eee' },
  gridNoImage: { justifyContent: 'center', alignItems: 'center' },
});
