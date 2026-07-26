import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { colors } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'HelpRequests'> };

type DraftState = {
  location: string;
  description: string;
  status: HelpRequestStatus;
};

const emptyDraft: DraftState = { location: '', description: '', status: 'active' };

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

export default function HelpRequestsScreen({ navigation }: Props) {
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

  const activeList = scope === 'mine' ? myRequests : requests;
  const activeRequests = useMemo(() => activeList.filter((item) => item.status === 'active'), [activeList]);
  const resolvedRequests = useMemo(() => activeList.filter((item) => item.status === 'resolved'), [activeList]);
  const displayList = scope === 'mine' ? activeList : [...activeRequests, ...resolvedRequests];

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

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setDraft(emptyDraft);
  };

  const saveRequest = async () => {
    const location = draft.location.trim();
    const description = draft.description.trim();
    if (!location || !description) {
      Alert.alert('Запрос помощи', 'Заполните место и описание проблемы.');
      return;
    }

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
        await createHelpRequest({
          location,
          description,
          coordinates: null,
        });
        setScope('mine');
      }
      closeModal();
      await load(true);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось сохранить запрос');
    } finally {
      setSaving(false);
    }
  };

  const removeRequest = async (request: HelpRequest) => {
    const id = getHelpRequestKey(request);
    if (!id) return;

    Alert.alert('Удалить запрос?', 'Запрос исчезнет из вашего списка.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteHelpRequest(id);
            await load(true);
          } catch (e: any) {
            Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось удалить запрос');
          }
        },
      },
    ]);
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
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, active ? styles.iconCircleActive : styles.iconCircleResolved]}>
            <Ionicons name={active ? 'warning-outline' : 'checkmark-circle-outline'} size={22} color={active ? '#d92323' : '#14843b'} />
          </View>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.cardUser} numberOfLines={1}>{item.user || (isMine ? 'Вы' : 'Пользователь')}</Text>
            <Text style={styles.cardTime}>{getRequestTime(item)}</Text>
          </View>
          <Text style={[styles.statusPill, active ? styles.statusActive : styles.statusResolved]}>
            {active ? 'Активен' : 'Решен'}
          </Text>
        </View>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={17} color={colors.textMuted} />
          <Text style={styles.locationText}>{item.location}</Text>
        </View>

        <Text style={styles.description}>{item.description}</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.routeBtn} onPress={() => openRoute(item)}>
            <Ionicons name="navigate-outline" size={17} color="#fff" />
            <Text style={styles.routeText}>Маршрут</Text>
          </TouchableOpacity>

          {scope === 'mine' || isMine ? (
            <>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => openEdit(item)}>
                <Ionicons name="create-outline" size={18} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => removeRequest(item)}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Помощь</Text>
            <Text style={styles.subtitle}>Запросы водителей из сообщества Avtotime</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{activeRequests.length}</Text>
            <Text style={styles.statLabel}>Активные</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{resolvedRequests.length}</Text>
            <Text style={styles.statLabel}>Решенные</Text>
          </View>
        </View>

        <View style={styles.scopeRow}>
          <TouchableOpacity
            style={[styles.scopeBtn, scope === 'all' && styles.scopeBtnActive]}
            onPress={() => setScope('all')}
          >
            <Text style={[styles.scopeText, scope === 'all' && styles.scopeTextActive]}>Все</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scopeBtn, scope === 'mine' && styles.scopeBtnActive]}
            onPress={() => setScope('mine')}
          >
            <Text style={[styles.scopeText, scope === 'mine' && styles.scopeTextActive]}>Мои</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={(item, index) => getHelpRequestKey(item) || `help-${index}`}
          renderItem={renderRequest}
          contentContainerStyle={displayList.length ? styles.list : styles.emptyList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name={error ? 'alert-circle-outline' : 'heart-outline'} size={38} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>{error || 'Запросов пока нет'}</Text>
              <Text style={styles.emptyText}>
                {error ? 'Потяните экран вниз, чтобы повторить загрузку.' : 'Создайте запрос, если нужна помощь на дороге.'}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeModal} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{editing ? 'Редактировать запрос' : 'Нужна помощь'}</Text>

            <Text style={styles.inputLabel}>Местоположение</Text>
            <TextInput
              style={styles.input}
              placeholder="Например: Кишинев, Ботаника"
              placeholderTextColor={colors.textFaint}
              value={draft.location}
              onChangeText={(location) => setDraft((prev) => ({ ...prev, location }))}
            />

            <Text style={styles.inputLabel}>Что случилось</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Опишите проблему и какая помощь нужна"
              placeholderTextColor={colors.textFaint}
              value={draft.description}
              onChangeText={(description) => setDraft((prev) => ({ ...prev, description }))}
              multiline
              textAlignVertical="top"
            />

            {editing ? (
              <View style={styles.statusSwitch}>
                <TouchableOpacity
                  style={[styles.statusSwitchBtn, draft.status === 'active' && styles.statusSwitchActive]}
                  onPress={() => setDraft((prev) => ({ ...prev, status: 'active' }))}
                >
                  <Text style={[styles.statusSwitchText, draft.status === 'active' && styles.statusSwitchTextActive]}>Активен</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.statusSwitchBtn, draft.status === 'resolved' && styles.statusSwitchActive]}
                  onPress={() => setDraft((prev) => ({ ...prev, status: 'resolved' }))}
                >
                  <Text style={[styles.statusSwitchText, draft.status === 'resolved' && styles.statusSwitchTextActive]}>Решен</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal} disabled={saving}>
                <Text style={styles.cancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveRequest} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{editing ? 'Сохранить' : 'Создать'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  top: { backgroundColor: colors.surface, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleBlock: { flex: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  subtitle: { marginTop: 4, color: colors.textMuted, fontSize: 13 },
  addBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statItem: { flex: 1, borderRadius: 8, backgroundColor: colors.surfaceAlt, padding: 12 },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '900' },
  statLabel: { marginTop: 2, color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  scopeRow: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 3, marginTop: 12 },
  scopeBtn: { flex: 1, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  scopeBtnActive: { backgroundColor: colors.surfaceHi },
  scopeText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  scopeTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, gap: 10 },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  emptyState: { alignItems: 'center' },
  emptyTitle: { marginTop: 10, color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 6, color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: 8, padding: 14, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  iconCircleActive: { backgroundColor: 'rgba(255,90,95,0.12)' },
  iconCircleResolved: { backgroundColor: '#eaf8ef' },
  cardTitleBlock: { flex: 1 },
  cardUser: { color: colors.text, fontSize: 15, fontWeight: '900' },
  cardTime: { marginTop: 2, color: colors.textFaint, fontSize: 12, fontWeight: '700' },
  statusPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  statusActive: { color: '#fff', backgroundColor: colors.danger },
  statusResolved: { color: '#14843b', backgroundColor: '#eaf8ef' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14 },
  locationText: { flex: 1, color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  description: { marginTop: 10, color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  routeBtn: { flex: 1, height: 42, borderRadius: 8, backgroundColor: colors.surfaceHi, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  routeText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  secondaryBtn: { width: 42, height: 42, borderRadius: 8, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#ddd', marginBottom: 12 },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginBottom: 14 },
  inputLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '800', marginBottom: 7 },
  input: { minHeight: 46, borderRadius: 8, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, color: colors.text, fontSize: 15, marginBottom: 13 },
  textArea: { minHeight: 112, paddingTop: 12, lineHeight: 21 },
  statusSwitch: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 3, marginBottom: 14 },
  statusSwitchBtn: { flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statusSwitchActive: { backgroundColor: colors.surfaceHi },
  statusSwitchText: { color: colors.textMuted, fontSize: 13, fontWeight: '900' },
  statusSwitchTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, height: 46, borderRadius: 8, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  saveBtn: { flex: 1, height: 46, borderRadius: 8, backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});
