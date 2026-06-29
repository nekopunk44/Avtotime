import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { getMessages, sendMessage, Message } from '../api/messages';
import { getSocket } from '../hooks/useSocket';
import { useAuthStore } from '../store/authStore';
import { AppStackParamList } from '../navigation/AppNavigator';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'Chat'>;
  route: RouteProp<AppStackParamList, 'Chat'>;
};

export default function ChatScreen({ route, navigation }: Props) {
  const { userId, name } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const me = useAuthStore((s) => s.user);

  useEffect(() => {
    navigation.setOptions({ title: name });
  }, [name]);

  const load = useCallback(async () => {
    try {
      const data = await getMessages(userId);
      setMessages(data.reverse());
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
    let socket: any;
    getSocket().then((s) => {
      socket = s;
      const handler = (msg: Message) => {
        if (msg.senderId === userId || msg.receiverId === userId) {
          setMessages((prev) => [msg, ...prev]);
        }
      };
      socket.on('newMessage', handler);
      return () => socket?.off('newMessage', handler);
    });
    return () => {};
  }, [userId]);

  const handleSend = async () => {
    if (!text.trim()) return;
    const draft = text.trim();
    setText('');
    setSending(true);
    try {
      const msg = await sendMessage(userId, draft);
      setMessages((prev) => [msg, ...prev]);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.senderId === me?._id;
    return (
      <View style={[styles.bubble, isMine ? styles.mine : styles.theirs]}>
        {item.image && <Image source={{ uri: item.image }} style={styles.msgImage} />}
        {item.text ? <Text style={[styles.msgText, isMine && styles.mineText]}>{item.text}</Text> : null}
        <Text style={[styles.msgTime, isMine && styles.mineTime]}>
          {new Date(item.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#111" /></View>;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(m) => m._id}
        renderItem={renderMessage}
        inverted
        contentContainerStyle={styles.list}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Сообщение..."
          placeholderTextColor="#aaa"
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending || !text.trim()}>
          <Ionicons name="send" size={20} color={text.trim() ? '#111' : '#ccc'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 12, paddingVertical: 8 },
  bubble: {
    maxWidth: '75%', borderRadius: 18, padding: 10, marginVertical: 3,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: '#111' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' },
  msgText: { fontSize: 15, color: '#333', lineHeight: 20 },
  mineText: { color: '#fff' },
  msgTime: { fontSize: 10, color: '#aaa', marginTop: 4, alignSelf: 'flex-end' },
  mineTime: { color: 'rgba(255,255,255,0.6)' },
  msgImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee',
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: '#f3f3f3',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 15, color: '#111',
  },
  sendBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
});
