import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, Image,
  TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { searchUsers, getSuggestedUsers } from '../api/users';
import { User } from '../api/auth';
import { AppStackParamList } from '../navigation/AppNavigator';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };

export default function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [suggested, setSuggested] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSuggestedUsers().then(setSuggested).catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchUsers(query.trim());
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userRow}
      onPress={() => navigation.navigate('UserProfile', { userId: item._id })}
    >
      <Image
        source={item.profileImage ? { uri: item.profileImage } : require('../../assets/icon.png')}
        style={styles.avatar}
      />
      <View style={styles.userInfo}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.username}>@{item.username}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#ccc" />
    </TouchableOpacity>
  );

  const data = query.trim() ? results : suggested;

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#aaa" />
        <TextInput
          style={styles.input}
          placeholder="Поиск пользователей"
          placeholderTextColor="#aaa"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color="#aaa" />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading && <ActivityIndicator style={{ marginTop: 20 }} color="#111" />}

      <FlatList
        data={data}
        keyExtractor={(u) => u._id}
        renderItem={renderUser}
        ListHeaderComponent={
          !query.trim() && suggested.length > 0
            ? <Text style={styles.section}>Рекомендации</Text>
            : null
        }
        ListEmptyComponent={
          !loading && query.trim()
            ? <Text style={styles.empty}>Ничего не найдено</Text>
            : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#f3f3f3', borderRadius: 14,
  },
  input: { flex: 1, fontSize: 15, color: '#111' },
  section: { paddingHorizontal: 16, paddingVertical: 10, fontSize: 13, fontWeight: '700', color: '#888' },
  userRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 10, gap: 12,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#eee' },
  userInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#111' },
  username: { fontSize: 13, color: '#888', marginTop: 1 },
  empty: { textAlign: 'center', marginTop: 40, color: '#aaa', fontSize: 15 },
});
