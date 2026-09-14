import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import {
  createHelpRequest,
  deleteHelpRequest,
  getHelpRequestKey,
  getHelpRequests,
  HelpRequest,
  HelpRequestStatus,
  updateHelpRequest,
} from '../api/helpRequests';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors, font, radius, shadow, space } from '../theme';
import { ConfirmSheet, EmptyState, PressableScale, Skeleton } from '../components/ui';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'HelpRequests'> };

type DraftState = {
  location: string;
  description: string;
  status: HelpRequestStatus;
};

const emptyDraft: DraftState = { location: '', description: '', status: 'active' };

const SCOPES: Array<{ key: 'all' | 'mine'; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'mine', label: 'Мои' },
];

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const getRequestTime = (request: HelpRequest) => request.time || formatDate(request.createdAt) || '';

const getMapUrl = (request: HelpRequest) => {
  const lat = request.coordinates?.lat;
  const lng = request.coordinates?.lng;
  if (typeof lat === 'number' && typeof lng === 'number') {
    return `https://www.google.com/maps/?q=${lat},${lng}`;
  }

  const query = request.location.trim();
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : '';
};

export default function HelpRequestsScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [myRequests, setMyRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [editing, setEditing] = useState<HelpRequest | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<HelpRequest | null>(null);

  const activeList = scope === 'mine' ? myRequests : requests;
  const activeRequests = useMemo(() => activeList.filter((item) => item.status === 'active'), [activeList]);
  const resolvedRequests = useMemo(() => activeList.filter((item) => item.status === 'resolved'), [activeList]);
  // Активные впереди: помощь нужна сейчас, решённые — история.
  const displayList = useMemo(
    () => [...activeRequests, ...resolvedRequests],
    [activeRequests, resolvedRequests],
  );

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [all, mine] = await Promise.all([
        getHelpRequests(false),
        getHelpRequests(true),
      ]);
      setRequests(all);
      setMyRequests(mine);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить запросы помощи');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  // ── Переключатель охвата: заливка едет к выбранному ──────────────────────
  const [scopeWidth, setScopeWidth] = useState(0);
  const scopeSlide = useRef(new Animated.Value(0)).current;
  const scopePlaced = useRef(false);
  const scopeSeg = scopeWidth > 0 ? (scopeWidth - 8) / SCOPES.length : 0;
  const scopeIndex = Math.max(0, SCOPES.findIndex((item) => item.key === scope));

  useEffect(() => {
    if (scopeSeg <= 0) return;
    const target = 4 + scopeSeg * scopeIndex;
    if (!scopePlaced.current) {
      scopePlaced.current = true;
      scopeSlide.setValue(target);
      return;
    }
    Animated.spring(scopeSlide, { toValue: target, useNativeDriver: true, speed: 16, bounciness: 7 }).start();
  }, [scopeIndex, scopeSeg, scopeSlide]);

  // ── Шторка создания: выезжает снизу и идёт за пальцем ────────────────────
  const [sheetMounted, setSheetMounted] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(420);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const sheetDrag = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (modalOpen) {
      setSheetMounted(true);
      sheetAnim.setValue(0);
      sheetDrag.setValue(0);
      Animated.timing(sheetAnim, {
        toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }).start();
      return;
    }
    Animated.parallel([
      Animated.timing(sheetAnim, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
      Animated.timing(sheetDrag, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
    ]).start(({ finished }) => {
      if (finished) setSheetMounted(false);
    });
  }, [modalOpen, sheetAnim, sheetDrag]);

  const closeModal = useCallback(() => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setDraft(emptyDraft);
  }, [saving]);

  const closeRef = useRef(closeModal);
  closeRef.current = closeModal;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) sheetDrag.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.9) {
          closeRef.current();
          return;
        }
        Animated.spring(sheetDrag, { toValue: 0, useNativeDriver: false, bounciness: 6, speed: 14 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(sheetDrag, { toValue: 0, useNativeDriver: false, bounciness: 6, speed: 14 }).start();
      },
    }),
  ).current;

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setModalOpen(true);
  };

  const openEdit = (request: HelpRequest) => {
    setEditing(request);
    setDraft({
      location: request.location || '',
      description: request.description || '',
      status: request.status || 'active',
    });
    setModalOpen(true);
  };

  const canSave = Boolean(draft.location.trim() && draft.description.trim()) && !saving;

  const saveRequest = async () => {
    if (!canSave) return;
    const location = draft.location.trim();
    const description = draft.description.trim();

    setSaving(true);
    try {
      if (editing) {
        const id = getHelpRequestKey(editing);
        await updateHelpRequest(id, {
          location,
          description,
          status: draft.status,
          coordinates: editing.coordinates || null,
        });
      } else {
        await createHelpRequest({ location, description, coordinates: null });
        setScope('mine');
      }
      setModalOpen(false);
      setEditing(null);
      setDraft(emptyDraft);
      await load(true);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось сохранить запрос');
    } finally {
      setSaving(false);
    }
  };

  const removeRequest = async () => {
    const request = pendingRemoval;
    setPendingRemoval(null);
    const id = request ? getHelpRequestKey(request) : '';
    if (!id) return;

    try {
      await deleteHelpRequest(id);
      await load(true);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось удалить запрос');
    }
  };

  const openRoute = async (request: HelpRequest) => {
    const url = getMapUrl(request);
    if (!url) {
      Alert.alert('Маршрут', 'У запроса не указано место.');
      return;
    }

    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Маршрут', 'Не удалось открыть карты на устройстве.');
      return;
    }
    await Linking.openURL(url);
  };

  const renderRequest = ({ item }: { item: HelpRequest }) => {
    const isMine = myRequests.some((request) => getHelpRequestKey(request) === getHelpRequestKey(item));
    const active = item.status === 'active';

    return (
      <View style={styles.card}>
        {/* Полоса слева отвечает за статус: цветную метку видно раньше текста. */}
        <View style={[styles.stripe, active ? styles.stripeActive : styles.stripeResolved]} />

        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={[styles.status, active ? styles.statusActive : styles.statusResolved]}>
              {active ? 'Нужна помощь' : 'Решён'}
            </Text>
            <Text style={styles.time}>{getRequestTime(item)}</Text>
          </View>

          <Text style={styles.description}>{item.description}</Text>

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={15} color={colors.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText} numberOfLines={1}>{item.user || (isMine ? 'Вы' : 'Пользователь')}</Text>
          </View>

          <View style={styles.actionRow}>
            <PressableScale style={styles.routeBtn} scaleTo={0.97} onPress={() => openRoute(item)}>
              <Ionicons name="navigate" size={16} color={colors.onAccent} />
              <Text style={styles.routeText}>Маршрут</Text>
            </PressableScale>

            {isMine ? (
              <>
                <PressableScale style={styles.iconBtn} scaleTo={0.94} onPress={() => openEdit(item)}>
                  <Ionicons name="create-outline" size={18} color={colors.text} />
                </PressableScale>
                <PressableScale style={styles.iconBtn} scaleTo={0.94} onPress={() => setPendingRemoval(item)}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </PressableScale>
              </>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <View style={styles.scopeRow} onLayout={(e) => setScopeWidth(e.nativeEvent.layout.width)}>
          {scopeSeg > 0 ? (
            <Animated.View
              style={[styles.scopeThumb, { width: scopeSeg, transform: [{ translateX: scopeSlide }] }]}
            />
          ) : null}
          {SCOPES.map((item) => (
            <Pressable key={item.key} style={styles.scopeBtn} onPress={() => setScope(item.key)}>
              <Text style={[styles.scopeText, scope === item.key && styles.scopeTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Счётчики строкой, а не плитками: два нуля не стоят четверти экрана. */}
        <Text style={styles.counters}>
          <Text style={styles.counterActive}>{activeRequests.length} активных</Text>
          {'  ·  '}
          {resolvedRequests.length} решённых
        </Text>
      </View>

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => <Skeleton key={i} style={styles.skeletonCard} />)}
        </View>
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={(item, index) => getHelpRequestKey(item) || `help-${index}`}
          renderItem={renderRequest}
          contentContainerStyle={displayList.length ? styles.list : styles.emptyList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <EmptyState
              icon={error ? 'alert-circle-outline' : 'hand-left-outline'}
              title={error || (scope === 'mine' ? 'Вы ещё не просили помощи' : 'Запросов пока нет')}
              subtitle={
                error
                  ? 'Потяните экран вниз, чтобы повторить загрузку.'
                  : 'Опишите, что случилось на дороге, — запрос увидят другие водители.'
              }
              actionLabel={error ? undefined : 'Создать запрос'}
              onAction={error ? undefined : openCreate}
            />
          }
        />
      )}

      {/* Кнопка создания плавает над списком: она нужна с любого места. */}
      <PressableScale
        style={[styles.fab, { bottom: insets.bottom + space.xl }]}
        scaleTo={0.94}
        onPress={openCreate}
      >
        <Ionicons name="add" size={26} color={colors.onAccent} />
      </PressableScale>

      <Modal visible={sheetMounted} transparent animationType="none" onRequestClose={closeModal} statusBarTranslucent>
        <Animated.View style={[styles.backdrop, { opacity: sheetAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetWrap}
            pointerEvents="box-none"
          >
            <Animated.View
              onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
              style={[
                styles.sheet,
                {
                  paddingBottom: insets.bottom + space.lg,
                  transform: [{
                    translateY: Animated.add(
                      sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight, 0] }),
                      sheetDrag,
                    ),
                  }],
                },
              ]}
            >
              <View {...pan.panHandlers} style={styles.handleZone}>
                <View style={styles.grabber} />
                <Text style={styles.sheetTitle}>{editing ? 'Изменить запрос' : 'Нужна помощь'}</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Где вы</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Например: Кишинев, Ботаника"
                  placeholderTextColor={colors.textFaint}
                  value={draft.location}
                  onChangeText={(location) => setDraft((prev) => ({ ...prev, location }))}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Что случилось</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Опишите проблему и какая помощь нужна"
                  placeholderTextColor={colors.textFaint}
                  value={draft.description}
                  onChangeText={(description) => setDraft((prev) => ({ ...prev, description }))}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {editing ? (
                <View style={styles.field}>
                  <Text style={styles.label}>Статус</Text>
                  <View style={styles.statusSwitch}>
                    {(['active', 'resolved'] as HelpRequestStatus[]).map((value) => {
                      const on = draft.status === value;
                      return (
                        <Pressable
                          key={value}
                          style={[styles.statusBtn, on && styles.statusBtnActive]}
                          onPress={() => setDraft((prev) => ({ ...prev, status: value }))}
                        >
                          <Text style={[styles.statusBtnText, on && styles.statusBtnTextActive]}>
                            {value === 'active' ? 'Нужна помощь' : 'Решён'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <PressableScale
                style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                scaleTo={0.98}
                onPress={saveRequest}
              >
                {saving
                  ? <ActivityIndicator color={colors.onAccent} />
                  : <Text style={styles.saveText}>{editing ? 'Сохранить' : 'Опубликовать запрос'}</Text>}
              </PressableScale>
            </Animated.View>
          </KeyboardAvoidingView>
        </Animated.View>
      </Modal>

      <ConfirmSheet
        visible={pendingRemoval !== null}
        title="Удалить запрос?"
        message="Он исчезнет из списка, и помощь по нему больше не предложат."
        cancelLabel="Оставить"
        confirmLabel="Удалить"
        destructive
        onCancel={() => setPendingRemoval(null)}
        onConfirm={removeRequest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  top: { paddingHorizontal: space.md, paddingTop: space.md, gap: space.sm },
  scopeRow: {
    flexDirection: 'row', backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill, padding: 4,
  },
  scopeThumb: {
    position: 'absolute', left: 0, top: 4, bottom: 4,
    borderRadius: radius.pill, backgroundColor: colors.accent,
  },
  scopeBtn: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center' },
  scopeText: { color: colors.textMuted, fontSize: font.small, fontWeight: '800' },
  scopeTextActive: { color: colors.onAccent, fontWeight: '900' },
  counters: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '800', marginLeft: 2 },
  counterActive: { color: colors.text },

  list: { padding: space.md, gap: space.sm },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: space.lg },
  skeletonCard: { height: 150, borderRadius: radius.lg },

  card: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg,
    overflow: 'hidden', ...shadow.card,
  },
  stripe: { width: 4 },
  stripeActive: { backgroundColor: colors.danger },
  stripeResolved: { backgroundColor: colors.success },
  cardBody: { flex: 1, padding: space.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  status: {
    overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4,
    fontSize: font.tiny, fontWeight: '900',
  },
  statusActive: { color: colors.danger, backgroundColor: 'rgba(255,90,95,0.14)' },
  statusResolved: { color: colors.success, backgroundColor: 'rgba(61,214,140,0.14)' },
  time: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '700' },

  description: { marginTop: space.md, color: colors.text, fontSize: font.body, lineHeight: 21, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: space.sm },
  metaText: { flexShrink: 1, color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
  metaDot: { color: colors.textFaint, fontSize: font.small, fontWeight: '900' },

  actionRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  routeBtn: {
    flex: 1, height: 42, borderRadius: radius.pill, backgroundColor: colors.accent,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  routeText: { color: colors.onAccent, fontSize: font.small, fontWeight: '900' },
  iconBtn: {
    width: 42, height: 42, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },

  fab: {
    position: 'absolute', right: space.lg, width: 58, height: 58, borderRadius: radius.pill,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...shadow.float,
  },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.lg,
  },
  handleZone: { paddingTop: space.xs, paddingBottom: space.xs, alignItems: 'center' },
  grabber: {
    width: 44, height: 5, borderRadius: radius.pill,
    backgroundColor: colors.surfaceHi, marginBottom: space.md,
  },
  sheetTitle: { color: colors.text, fontSize: font.h2, fontWeight: '900', textAlign: 'center' },

  field: { gap: space.sm },
  label: {
    color: colors.textMuted, fontSize: font.tiny, fontWeight: '900',
    marginLeft: 2, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  input: {
    minHeight: 48, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    paddingHorizontal: space.md, color: colors.text, fontSize: font.body,
  },
  textArea: { minHeight: 110, paddingTop: space.md, lineHeight: 21 },

  statusSwitch: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4, gap: 4 },
  statusBtn: { flex: 1, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  statusBtnActive: { backgroundColor: colors.accent },
  statusBtnText: { color: colors.textMuted, fontSize: font.small, fontWeight: '800' },
  statusBtnTextActive: { color: colors.onAccent, fontWeight: '900' },

  saveBtn: {
    height: 52, borderRadius: radius.pill, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveText: { color: colors.onAccent, fontSize: font.body, fontWeight: '900' },
});
