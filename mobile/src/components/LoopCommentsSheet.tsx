import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { commentLoop, getLoopById, Loop } from '../api/loops';
import { useKeyboardLift } from '../hooks/useKeyboardLift';
import { useLoopCommentsStore } from '../store/loopCommentsStore';
import { showToast } from '../store/toastStore';
import { colors, font, radius, space } from '../theme';

// Ход выезда заведомо больше панели: старт всегда за краем экрана.
const SHEET_TRAVEL = Dimensions.get('window').height;

/**
 * Шторка комментариев к ролику. Живёт в корне приложения поверх всего —
 * навигаторов, панели вкладок, экрана: слой внутри сцены не дотягивался до
 * низа экрана (навигатор режет сцену под панель), а окно Modal на Android
 * само решает, где его край, и на разных устройствах решает по-разному.
 * Здесь же — главное окно приложения, чья клавиатурная механика давно
 * выверена чатом.
 */
export default function LoopCommentsSheet() {
  const loop = useLoopCommentsStore((s) => s.loop);
  const merge = useLoopCommentsStore((s) => s.merge);
  const close = useLoopCommentsStore((s) => s.close);
  const insets = useSafeAreaInsets();
  const { lift: kbLift, onLayout: onRootLayout } = useKeyboardLift();

  // Шторка живёт до конца анимации ухода и показывает снимок последнего
  // ролика: подмена списка на пустоту во время выезда была видна.
  const [mounted, setMounted] = useState(false);
  const lastLoopRef = useRef<Loop | null>(null);
  if (loop) lastLoopRef.current = loop;
  const shown = loop ?? lastLoopRef.current;

  const anim = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;

  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (loop) {
      setMounted(true);
      setCommentText('');
      anim.setValue(0);
      drag.setValue(0);
      Animated.timing(anim, {
        toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();

      // Лента несёт только превью комментариев — полный список доезжает молча.
      getLoopById(loop._id)
        .then((full) => { if (full) merge(full); })
        .catch(() => {});
      return;
    }
    Animated.timing(anim, {
      toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(({ finished }) => { if (finished) setMounted(false); });
    // Анимации перезапускаются только сменой ролика.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop?._id]);

  const closeRef = useRef(close);
  closeRef.current = close;

  const pan = useRef(
    PanResponder.create({
      // Захват с первого касания: жест живёт на шапке, где нет кнопок.
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) drag.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        // Смещение не сбрасываем: выезд стартует с места, где отпустили палец.
        if (g.dy > 80 || g.vy > 0.9) {
          closeRef.current();
          return;
        }
        Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 6, speed: 14 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 6, speed: 14 }).start();
      },
    }),
  ).current;

  const sendComment = async () => {
    if (sending || !loop || !commentText.trim()) return;
    setSending(true);
    try {
      const updated = await commentLoop(loop._id, commentText.trim());
      merge(updated);
      setCommentText('');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось отправить комментарий', 'error');
    } finally {
      setSending(false);
    }
  };

  if (!mounted || !shown) return null;

  const comments = shown.comments || shown.commentsPreview || [];
  const canSend = !!commentText.trim() && !sending;

  return (
    <View style={styles.layer} onLayout={onRootLayout} pointerEvents="auto">
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close}>
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, { opacity: anim }]} />
      </TouchableOpacity>

      {/* Подъём под клавиатуру двигает шторку, затемнение остаётся на месте. */}
      <Animated.View style={{ transform: [{ translateY: Animated.multiply(kbLift, -1) }] }}>
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{
                translateY: Animated.add(
                  anim.interpolate({ inputRange: [0, 1], outputRange: [SHEET_TRAVEL, 0] }),
                  drag,
                ),
              }],
            },
          ]}
        >
          {/* Тянуть можно за всю шапку: в полоску пальцем не попасть. */}
          <View {...pan.panHandlers} style={styles.handleZone}>
            <View style={styles.grabber} />
            <Text style={styles.title}>Комментарии</Text>
          </View>

          <FlatList
            data={comments}
            keyExtractor={(item, index) => item._id || `${item.author?._id || 'comment'}-${index}`}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.empty}>Комментариев пока нет</Text>}
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

          <View style={[styles.composerWrap, { paddingBottom: insets.bottom + space.sm }]}>
            <View style={styles.composer}>
              <TextInput
                style={styles.composerInput}
                placeholder="Добавить комментарий"
                placeholderTextColor={colors.textFaint}
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity
                style={[styles.composerSend, !canSend && styles.composerSendOff]}
                onPress={sendComment}
                disabled={!canSend}
              >
                {sending ? (
                  <ActivityIndicator color={colors.onAccent} size="small" />
                ) : (
                  <Ionicons name="arrow-up" size={18} color={canSend ? colors.onAccent : colors.textFaint} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Поверх всего приложения, панель вкладок остаётся под затемнением.
  layer: {
    ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end',
    zIndex: 900, elevation: 900,
  },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: Dimensions.get('window').height * 0.72,
    minHeight: Dimensions.get('window').height * 0.5,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingTop: space.sm,
  },
  handleZone: { paddingBottom: space.sm },
  grabber: {
    alignSelf: 'center', width: 42, height: 4, borderRadius: radius.pill,
    backgroundColor: colors.surfaceHi, marginBottom: space.sm,
  },
  title: { textAlign: 'center', color: colors.text, fontSize: font.h3, fontWeight: '900' },
  list: { flex: 1, marginTop: space.sm },
  listContent: { padding: space.lg, gap: 14 },
  empty: { textAlign: 'center', color: colors.textFaint, marginTop: 28, fontSize: font.small },
  commentRow: { flexDirection: 'row', gap: space.sm },
  commentAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceAlt },
  commentAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  commentBody: { flex: 1 },
  commentAuthor: { color: colors.text, fontSize: font.small, fontWeight: '900' },
  commentMessage: { marginTop: 2, color: colors.textMuted, fontSize: font.small, lineHeight: 19 },

  composerWrap: { paddingHorizontal: space.md, paddingTop: space.sm },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: space.xs,
    borderRadius: radius.xl, backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 5, paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  composerInput: {
    flex: 1, minHeight: 38, maxHeight: 104, paddingHorizontal: space.sm,
    paddingTop: 8, paddingBottom: 8, fontSize: font.small, color: colors.text,
  },
  composerSend: {
    width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  composerSendOff: { backgroundColor: colors.surfaceHi },
});
