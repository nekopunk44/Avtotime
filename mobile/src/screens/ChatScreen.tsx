import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import VoiceMessage from '../components/VoiceMessage';
import ImageViewer from '../components/ImageViewer';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  blockUser,
  deleteConversation,
  getBlockedStatus,
  getMessages,
  getMessageUserId,
  markConversationRead,
  Message,
  sendMessage,
  unblockUser,
} from '../api/messages';
import { getUserById } from '../api/users';
import { Avatar, ConfirmSheet, PopoverMenu } from '../components/ui';
import type { PopoverAction } from '../components/ui/PopoverMenu';
import { getSocket } from '../hooks/useSocket';
import { colors, font, radius, shadow, space } from '../theme';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import { useBadgeStore } from '../store/badgeStore';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'Chat'>;
  route: RouteProp<AppStackParamList, 'Chat'>;
};

type AttachmentDraft = {
  kind: 'image' | 'file';
  uri: string;
  name?: string;
  mimeType?: string;
  size?: number;
};

const DOCUMENT_TYPES = [
  'application/pdf',
  'application/zip',
  'application/x-7z-compressed',
  'application/x-rar-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];

const formatTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const ATTACH_PANEL_H = 116;

const ATTACH_OPTIONS = [
  { key: 'camera', icon: 'camera-outline', label: 'Камера' },
  { key: 'gallery', icon: 'images-outline', label: 'Галерея' },
  { key: 'file', icon: 'document-outline', label: 'Файл' },
] as const;

const formatFileSize = (value?: number) => {
  if (!value) return '';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} КБ`;
  return `${(value / 1024 / 1024).toFixed(1)} МБ`;
};

export default function ChatScreen({ route, navigation }: Props) {
  const { userId, name, userName } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<AttachmentDraft | undefined>();
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [menuBusy, setMenuBusy] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | undefined>();
  const [attachOpen, setAttachOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<'block' | 'delete' | null>(null);
  const [peerImage, setPeerImage] = useState<string | undefined>();
  const flatRef = useRef<FlatList>(null);
  const me = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  // Панель ввода поднимается сама: под edge-to-edge окно под клавиатуру не
  // сжимается, поэтому высоту берём из события, а не из KeyboardAvoidingView.
  const kbLift = useRef(new Animated.Value(0)).current;
  const attachLift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const glide = (height: number, duration?: number) => {
      Animated.timing(kbLift, {
        // Системная полоса внизу уже даёт отступ — вычитаем, иначе останется щель.
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
    return () => subs.forEach((s) => s.remove());
  }, [insets.bottom, kbLift]);

  useEffect(() => {
    Animated.timing(attachLift, {
      toValue: attachOpen ? ATTACH_PANEL_H : 0,
      duration: attachOpen ? 260 : 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [attachOpen, attachLift]);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRecordTimer = useCallback(() => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }, []);

  useEffect(() => stopRecordTimer, [stopRecordTimer]);

  const isMessageInChat = useCallback((msg: Message) => {
    const senderId = getMessageUserId(msg.sender);
    const receiverId = getMessageUserId(msg.receiver);
    return senderId === userId || receiverId === userId;
  }, [userId]);

  const prependMessage = useCallback((msg: Message) => {
    if (!isMessageInChat(msg)) return;
    setMessages((prev) => (prev.some((item) => item._id === msg._id) ? prev : [msg, ...prev]));
  }, [isMessageInChat]);

  const CHAT_PAGE_SIZE = 50;
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [data, blocked, peer] = await Promise.all([
        getMessages(userId, { page: 1, limit: CHAT_PAGE_SIZE }),
        getBlockedStatus(userId).catch(() => ({ isBlocked: false })),
        getUserById(userId).catch(() => null),
      ]);
      setPeerImage(peer?.profileImage || undefined);
      setMessages(data.reverse());
      pageRef.current = 1;
      hasMoreRef.current = data.length === CHAT_PAGE_SIZE;
      setIsBlocked(blocked.isBlocked);
      // Opening the chat marked messages read on the server — refresh tab badges
      useBadgeStore.getState().refresh();
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось загрузить чат');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  // The list is inverted, so "end reached" means the user scrolled up to the
  // oldest loaded message — fetch the next (older) page and append it.
  const loadOlder = useCallback(async () => {
    if (loading || loadingOlder || !hasMoreRef.current) return;
    setLoadingOlder(true);
    try {
      const next = pageRef.current + 1;
      const older = await getMessages(userId, { page: next, limit: CHAT_PAGE_SIZE });
      pageRef.current = next;
      hasMoreRef.current = older.length === CHAT_PAGE_SIZE;
      if (older.length) {
        setMessages((prev) => {
          const seen = new Set(prev.map((item) => item._id));
          return [...prev, ...older.reverse().filter((item) => !seen.has(item._id))];
        });
      }
    } catch {
      // scrolling again retries
    } finally {
      setLoadingOlder(false);
    }
  }, [loading, loadingOlder, userId]);

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const openProfile = useCallback(() => {
    navigation.navigate('UserProfile', { userId });
  }, [navigation, userId]);

  const applyBlockToggle = useCallback(async () => {
    const nextAction = isBlocked ? unblockUser : blockUser;
    setMenuBusy(true);
    try {
      await nextAction(userId);
      setIsBlocked((prev) => !prev);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось обновить блокировку');
    } finally {
      setMenuBusy(false);
    }
  }, [isBlocked, userId]);

  const applyDeleteConversation = useCallback(async () => {
    setMenuBusy(true);
    try {
      await deleteConversation(userId);
      setMessages([]);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось удалить переписку');
    } finally {
      setMenuBusy(false);
    }
  }, [userId]);

  const chatActions = useMemo<PopoverAction[]>(() => [
    { key: 'profile', label: 'Открыть профиль', icon: 'person-outline', onPress: openProfile },
    {
      key: 'block',
      label: isBlocked ? 'Разблокировать' : 'Заблокировать',
      icon: isBlocked ? 'lock-open-outline' : 'ban-outline',
      danger: !isBlocked,
      onPress: () => setConfirm('block'),
    },
    {
      key: 'delete',
      label: 'Удалить переписку',
      icon: 'trash-outline',
      danger: true,
      onPress: () => setConfirm('delete'),
    },
  ], [isBlocked, openProfile]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: name,
      headerTitleAlign: 'left',
      // Собеседник в шапке: лицо и ник вместо одной строки — по имени
      // «Автосалон Avtotime» непонятно, с кем именно идёт переписка.
      headerTitle: () => (
        <TouchableOpacity style={styles.headerTitle} activeOpacity={0.7} onPress={openProfile}>
          <Avatar uri={peerImage} userName={userName} name={name} size={36} />
          <View style={styles.headerTitleText}>
            <Text style={styles.headerName} numberOfLines={1}>{name || 'Пользователь'}</Text>
            {userName ? <Text style={styles.headerTag} numberOfLines={1}>@{userName}</Text> : null}
          </View>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity style={styles.headerBtn} onPress={() => setMenuOpen(true)} disabled={menuBusy}>
          {menuBusy ? <ActivityIndicator color={colors.text} /> : <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />}
        </TouchableOpacity>
      ),
    });
  }, [menuBusy, name, navigation, openProfile, peerImage, userName]);

  useEffect(() => {
    load();
    let socket: any;
    let mounted = true;
    const handler = (msg: Message) => {
      prependMessage(msg);
      // Incoming message from the peer while the chat is open — mark it read
      if (isMessageInChat(msg) && getMessageUserId(msg.sender) === userId) {
        markConversationRead(userId)
          .then(() => useBadgeStore.getState().refresh())
          .catch(() => {});
      }
    };

    getSocket().then((s) => {
      if (!mounted) return;
      socket = s;
      socket.on('newMessage', handler);
    });

    return () => {
      mounted = false;
      socket?.off('newMessage', handler);
    };
  }, [load, prependMessage, isMessageInChat, userId]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Доступ к галерее', 'Разрешите доступ к фото, чтобы отправить изображение.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.82,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setAttachment({ kind: 'image', uri: asset.uri, name: asset.fileName || 'chat-photo.jpg', mimeType: asset.mimeType });
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Доступ к камере', 'Разрешите доступ к камере, чтобы сделать фото.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.82 });
    if (!result.canceled) {
      const asset = result.assets[0];
      setAttachment({ kind: 'image', uri: asset.uri, name: asset.fileName || 'chat-photo.jpg', mimeType: asset.mimeType });
    }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: DOCUMENT_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setAttachment({
        kind: 'file',
        uri: asset.uri,
        name: asset.name || 'attachment.bin',
        mimeType: asset.mimeType,
        size: asset.size,
      });
    }
  };

  // Системный диалог выезжал светлой коробкой посреди тёмного экрана —
  // вместо него панель выезжает снизу и приподнимает строку ввода.
  const toggleAttachmentMenu = () => {
    if (isBlocked || sending) return;
    Keyboard.dismiss();
    setAttachOpen((open) => !open);
  };

  const chooseAttachment = (key: (typeof ATTACH_OPTIONS)[number]['key']) => {
    setAttachOpen(false);
    if (key === 'camera') takePhoto();
    else if (key === 'gallery') pickImage();
    else pickFile();
  };

  const startRecording = async () => {
    if (isBlocked || sending || recording) return;
    setAttachOpen(false);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('Доступ к микрофону', 'Разрешите доступ к микрофону, чтобы записывать голосовые сообщения.');
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordSeconds(0);
      setRecording(true);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      Alert.alert('Ошибка', 'Не удалось начать запись.');
    }
  };

  const cancelRecording = async () => {
    stopRecordTimer();
    setRecording(false);
    setRecordSeconds(0);
    try { await recorder.stop(); } catch {}
    // Route audio back to the speaker for playback (iOS)
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
  };

  const stopAndSendRecording = async () => {
    stopRecordTimer();
    setRecording(false);
    const seconds = recordSeconds;
    setRecordSeconds(0);
    try {
      await recorder.stop();
    } catch {
      Alert.alert('Ошибка', 'Не удалось завершить запись.');
      return;
    }
    // Route audio back to the speaker for playback (iOS)
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});

    const uri = recorder.uri;
    if (!uri || seconds < 1) {
      if (seconds < 1) Alert.alert('Слишком коротко', 'Удерживайте запись хотя бы одну секунду.');
      return;
    }

    setSending(true);
    try {
      const msg = await sendMessage(userId, {
        audioUri: uri,
        audioName: 'voice-message.m4a',
        audioType: 'audio/mp4',
      });
      prependMessage(msg);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось отправить голосовое сообщение');
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (isBlocked) {
      Alert.alert('Чат заблокирован', 'Разблокируйте пользователя, чтобы отправить сообщение.');
      return;
    }

    if (!text.trim() && !attachment) return;
    const draft = text.trim();
    const pickedAttachment = attachment;
    setText('');
    setAttachment(undefined);
    setSending(true);
    try {
      const msg = await sendMessage(userId, {
        text: draft,
        imageUri: pickedAttachment?.kind === 'image' ? pickedAttachment.uri : undefined,
        fileUri: pickedAttachment?.kind === 'file' ? pickedAttachment.uri : undefined,
        fileName: pickedAttachment?.name,
        fileType: pickedAttachment?.mimeType,
        fileSize: pickedAttachment?.size,
      });
      prependMessage(msg);
    } catch (e: any) {
      // Restore the draft only if the input is still empty — don't clobber text typed meanwhile
      setText((current) => (current ? current : draft));
      setAttachment(pickedAttachment);
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  };

  const openUrl = async (url?: string) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Вложение', 'Не удалось открыть файл');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = getMessageUserId(item.sender) === me?._id;
    const hasAttachment = item.image || item.file || item.audioUrl;

    return (
      <View style={[styles.bubble, isMine ? styles.mine : styles.theirs]}>
        {item.image ? (
          <TouchableOpacity onPress={() => setViewerUri(item.image)} activeOpacity={0.9}>
            <Image source={{ uri: item.image }} style={styles.msgImage} />
          </TouchableOpacity>
        ) : null}
        {item.file ? (
          <TouchableOpacity style={[styles.attachment, isMine && styles.attachmentMine]} onPress={() => openUrl(item.file)}>
            <Ionicons name="document-attach-outline" size={20} color={isMine ? colors.onAccent : colors.text} />
            <View style={styles.attachmentTextWrap}>
              <Text style={[styles.attachmentTitle, isMine && styles.mineText]} numberOfLines={1}>{item.fileName || 'Файл'}</Text>
              <Text style={[styles.attachmentMeta, isMine && styles.mineTime]}>
                {item.fileType || 'Вложение'} {formatFileSize(item.fileSize)}
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}
        {item.audioUrl ? (
          <VoiceMessage uri={item.audioUrl} mine={isMine} />
        ) : null}
        {item.message ? <Text style={[styles.msgText, isMine && styles.mineText]}>{item.message}</Text> : null}
        <Text style={[styles.msgTime, isMine && styles.mineTime]}>{formatTime(item.createdAt)}</Text>
        {!hasAttachment && !item.message ? <Text style={[styles.msgText, isMine && styles.mineText]}>Сообщение</Text> : null}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  const hasContent = Boolean(text.trim() || attachment);
  const canSend = hasContent && !sending && !isBlocked;

  return (
    <Animated.View style={[styles.container, { paddingBottom: kbLift }]}>
      {isBlocked ? (
        <View style={styles.blockedBanner}>
          <Ionicons name="ban-outline" size={18} color={colors.danger} />
          <Text style={styles.blockedText}>Пользователь заблокирован вами</Text>
          <TouchableOpacity onPress={() => setConfirm('block')}>
            <Text style={styles.unblockText}>Разблокировать</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.listWrap}>
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={messages.length ? styles.list : styles.emptyList}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingOlder ? <ActivityIndicator style={styles.olderSpinner} color={colors.text} /> : null}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-ellipses-outline" size={42} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>Сообщений пока нет</Text>
              <Text style={styles.emptyText}>Напишите первое сообщение, чтобы начать диалог.</Text>
            </View>
          }
        />
        {/* Тап по переписке закрывает панель вложений — как по фону шторки. */}
        {attachOpen ? (
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAttachOpen(false)} />
        ) : null}
      </View>

      {attachment ? (
        <View style={styles.previewRow}>
          {attachment.kind === 'image' ? (
            <Image source={{ uri: attachment.uri }} style={styles.previewImage} />
          ) : (
            <View style={styles.previewFileIcon}>
              <Ionicons name="document-attach-outline" size={25} color={colors.text} />
            </View>
          )}
          <View style={styles.previewText}>
            <Text style={styles.previewTitle} numberOfLines={1}>
              {attachment.kind === 'image' ? 'Фото готово к отправке' : attachment.name || 'Файл готов к отправке'}
            </Text>
            <Text style={styles.previewMeta} numberOfLines={1}>
              {attachment.kind === 'image' ? 'Можно добавить текст ниже' : [attachment.mimeType, formatFileSize(attachment.size)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <TouchableOpacity style={styles.removePreview} onPress={() => setAttachment(undefined)}>
            <Ionicons name="close-circle" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Панель ввода парит над краем экрана: полем во всю ширину она
          прилипала к нижней границе и давила на переписку. */}
      <View style={styles.composerWrap}>
        {recording ? (
          <View style={styles.composer}>
            <TouchableOpacity style={styles.roundGhost} onPress={cancelRecording}>
              <Ionicons name="trash-outline" size={21} color={colors.danger} />
            </TouchableOpacity>
            <View style={styles.recordingBar}>
              <View style={styles.recordDot} />
              <Text style={styles.recordingText}>
                Запись… {Math.floor(recordSeconds / 60)}:{(recordSeconds % 60).toString().padStart(2, '0')}
              </Text>
            </View>
            <TouchableOpacity style={styles.roundAccent} onPress={stopAndSendRecording}>
              <Ionicons name="send" size={19} color={colors.onAccent} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.composer}>
            <TouchableOpacity style={styles.roundGhost} onPress={toggleAttachmentMenu} disabled={sending || isBlocked}>
              <Animated.View
                style={{
                  transform: [{
                    rotate: attachLift.interpolate({
                      inputRange: [0, ATTACH_PANEL_H],
                      outputRange: ['0deg', '45deg'],
                    }),
                  }],
                }}
              >
                <Ionicons name="add" size={24} color={isBlocked ? colors.textFaint : colors.textMuted} />
              </Animated.View>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, isBlocked && styles.inputDisabled]}
              placeholder={isBlocked ? 'Пользователь заблокирован' : 'Сообщение'}
              placeholderTextColor={colors.textFaint}
              value={text}
              onChangeText={setText}
              onFocus={() => setAttachOpen(false)}
              multiline
              editable={!isBlocked}
            />
            {hasContent ? (
              <TouchableOpacity
                style={[styles.roundAccent, !canSend && styles.roundDisabled]}
                onPress={handleSend}
                disabled={!canSend}
              >
                {sending
                  ? <ActivityIndicator size="small" color={colors.onAccent} />
                  : <Ionicons name="arrow-up" size={21} color={canSend ? colors.onAccent : colors.textFaint} />}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.roundAccent, isBlocked && styles.roundDisabled]}
                onPress={startRecording}
                disabled={sending || isBlocked}
              >
                <Ionicons name="mic" size={21} color={isBlocked ? colors.textFaint : colors.onAccent} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Панель вложений раскрывается под строкой ввода и поднимает её,
          как это делает клавиатура. */}
      <Animated.View style={[styles.attachPanel, { height: attachLift }]} pointerEvents={attachOpen ? 'auto' : 'none'}>
        <Animated.View
          style={[
            styles.attachCard,
            {
              opacity: attachLift.interpolate({ inputRange: [0, ATTACH_PANEL_H], outputRange: [0, 1] }),
            },
          ]}
        >
          {ATTACH_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={styles.attachOption}
              activeOpacity={0.75}
              onPress={() => chooseAttachment(option.key)}
            >
              <View style={styles.attachIcon}>
                <Ionicons name={option.icon} size={23} color={colors.text} />
              </View>
              <Text style={styles.attachLabel}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </Animated.View>

      <View style={{ height: insets.bottom + space.sm }} />

      <PopoverMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        actions={chatActions}
        top={headerHeight + space.xs}
      />

      <ConfirmSheet
        visible={confirm === 'block'}
        title={isBlocked ? 'Разблокировать пользователя?' : 'Заблокировать пользователя?'}
        message={isBlocked
          ? 'Вы снова сможете отправлять сообщения этому пользователю.'
          : 'Вы не сможете отправлять сообщения, пока пользователь заблокирован.'}
        confirmLabel={isBlocked ? 'Разблокировать' : 'Заблокировать'}
        cancelLabel="Отмена"
        destructive={!isBlocked}
        onConfirm={() => { setConfirm(null); applyBlockToggle(); }}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmSheet
        visible={confirm === 'delete'}
        title="Удалить переписку?"
        message="Сообщения будут удалены из этой переписки."
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        destructive
        onConfirm={() => { setConfirm(null); applyDeleteConversation(); }}
        onCancel={() => setConfirm(null)}
      />

      <ImageViewer uri={viewerUri} visible={!!viewerUri} onClose={() => setViewerUri(undefined)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  listWrap: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  headerBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingRight: space.md },
  headerTitleText: { flexShrink: 1 },
  headerName: { color: colors.text, fontSize: font.body, fontWeight: '900' },
  headerTag: { marginTop: 1, color: colors.textFaint, fontSize: font.tiny, fontWeight: '800' },
  blockedBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: 'rgba(255,90,95,0.12)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,90,95,0.25)' },
  blockedText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '800' },
  unblockText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  olderSpinner: { paddingVertical: 14 },
  list: { paddingHorizontal: space.md, paddingVertical: space.md },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: space.xxl },
  emptyState: { alignItems: 'center' },
  emptyTitle: { marginTop: space.md, color: colors.text, fontSize: font.h3, fontWeight: '900' },
  emptyText: { marginTop: 5, color: colors.textMuted, fontSize: font.small, textAlign: 'center', lineHeight: 19 },
  bubble: { maxWidth: '78%', borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, marginVertical: 3 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accent, borderBottomRightRadius: radius.sm },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  msgText: { fontSize: font.body, color: colors.text, lineHeight: 21 },
  mineText: { color: colors.onAccent },
  msgTime: { fontSize: 10, color: colors.textFaint, marginTop: 5, alignSelf: 'flex-end' },
  mineTime: { color: 'rgba(11,11,14,0.55)' },
  msgImage: { width: 210, height: 210, borderRadius: 12, marginBottom: 6, backgroundColor: colors.surfaceHi },
  attachment: { minWidth: 190, borderRadius: 12, backgroundColor: colors.surface, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  attachmentMine: { backgroundColor: 'rgba(11,11,14,0.08)' },
  attachmentTextWrap: { flex: 1 },
  attachmentTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  attachmentMeta: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  previewRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    marginHorizontal: space.md, marginTop: space.sm, padding: space.sm,
    borderRadius: radius.lg, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  previewImage: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceHi },
  previewFileIcon: {
    width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  previewText: { flex: 1 },
  previewTitle: { color: colors.text, fontSize: font.small, fontWeight: '900' },
  previewMeta: { marginTop: 2, color: colors.textMuted, fontSize: font.tiny, fontWeight: '700' },
  removePreview: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  composerWrap: { paddingHorizontal: space.md, paddingTop: space.sm, backgroundColor: 'transparent' },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: space.xs,
    borderRadius: radius.xl, backgroundColor: colors.surface,
    paddingHorizontal: 6, paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    ...shadow.float,
  },
  roundGhost: { width: 44, height: 44, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center' },
  roundAccent: {
    width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  roundDisabled: { backgroundColor: colors.surfaceAlt },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: space.sm,
    paddingTop: 11, paddingBottom: 11, fontSize: font.body, color: colors.text,
  },
  inputDisabled: { color: colors.textFaint },
  recordingBar: {
    flex: 1, height: 44, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, gap: space.sm,
  },
  recordDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger },
  recordingText: { color: colors.text, fontSize: font.small, fontWeight: '800' },

  attachPanel: { overflow: 'hidden' },
  attachCard: {
    position: 'absolute', left: space.md, right: space.md, bottom: space.sm,
    height: ATTACH_PANEL_H - space.sm * 2,
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.xl, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  attachOption: { flex: 1, alignItems: 'center', gap: 7 },
  attachIcon: {
    width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  attachLabel: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '800' },
});
