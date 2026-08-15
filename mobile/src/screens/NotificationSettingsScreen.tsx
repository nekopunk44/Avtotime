import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import {
  defaultNotificationPreferences,
  DigestFrequency,
  getNotificationPreferences,
  NotificationPreferences,
  updateNotificationPreferences,
} from '../api/notifications';

const DIGEST_OPTIONS: { value: DigestFrequency; label: string; description: string }[] = [
  { value: 'instant', label: 'Сразу', description: 'Отправлять email сразу после события' },
  { value: 'daily', label: 'Ежедневно', description: 'Собирать уведомления в дневной дайджест' },
  { value: 'weekly', label: 'Еженедельно', description: 'Собирать уведомления за неделю' },
  { value: 'never', label: 'Никогда', description: 'Не отправлять email-дайджест' },
];

const TOGGLE_GROUPS: {
  title: string;
  items: { key: keyof NotificationPreferences; title: string; description: string; icon: keyof typeof Ionicons.glyphMap }[];
}[] = [
  {
    title: 'Социальные',
    items: [
      { key: 'like', title: 'Лайки', description: 'Реакции на публикации и контент', icon: 'heart-outline' },
      { key: 'comment', title: 'Комментарии', description: 'Ответы и комментарии к вашим публикациям', icon: 'chatbubble-outline' },
      { key: 'follow', title: 'Подписки', description: 'Новые подписчики профиля', icon: 'person-add-outline' },
      { key: 'mention', title: 'Упоминания', description: 'Упоминания профиля и отзывы', icon: 'at-outline' },
    ],
  },
  {
    title: 'Рабочие',
    items: [
      { key: 'message', title: 'Сообщения', description: 'Новые сообщения в чатах', icon: 'mail-outline' },
      { key: 'listing_comment', title: 'Объявления', description: 'Комментарии и события по объявлениям', icon: 'car-sport-outline' },
      { key: 'system', title: 'Системные', description: 'Модерация, тарифы и важные события аккаунта', icon: 'settings-outline' },
    ],
  },
];

export default function NotificationSettingsScreen() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getNotificationPreferences();
      setPreferences(data);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось загрузить настройки уведомлений');
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

  const setToggle = (key: keyof NotificationPreferences, value: boolean) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const setDigest = (value: DigestFrequency) => {
    setPreferences((prev) => ({ ...prev, digestFrequency: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const next = await updateNotificationPreferences(preferences);
      setPreferences(next);
      Alert.alert('Готово', 'Настройки уведомлений сохранены');
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
    >
      <Text style={styles.intro}>Выберите, какие события показывать в приложении и отправлять на email.</Text>

      {TOGGLE_GROUPS.map((group) => (
        <View key={group.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{group.title}</Text>
          {group.items.map((item) => (
            <View key={item.key} style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name={item.icon} size={21} color={colors.text} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowDescription}>{item.description}</Text>
              </View>
              <Switch
                value={Boolean(preferences[item.key])}
                onValueChange={(value) => setToggle(item.key, value)}
                trackColor={{ false: colors.surfaceHi, true: colors.success }}
                thumbColor={colors.white}
              />
            </View>
          ))}
        </View>
      ))}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Email</Text>
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Ionicons name="mail-open-outline" size={21} color={colors.text} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Email-уведомления</Text>
            <Text style={styles.rowDescription}>Дублировать события на почту, если сервер настроен на отправку email</Text>
          </View>
          <Switch
            value={preferences.emailNotifications}
            onValueChange={(value) => setToggle('emailNotifications', value)}
            trackColor={{ false: colors.surfaceHi, true: colors.success }}
            thumbColor={colors.white}
          />
        </View>

        <Text style={styles.digestTitle}>Частота</Text>
        <View style={styles.digestList}>
          {DIGEST_OPTIONS.map((option) => {
            const active = preferences.digestFrequency === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.digestOption, active && styles.digestOptionActive]}
                onPress={() => setDigest(option.value)}
                activeOpacity={0.85}
              >
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={styles.digestBody}>
                  <Text style={styles.digestLabel}>{option.label}</Text>
                  <Text style={styles.digestDescription}>{option.description}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={save} disabled={saving}>
        {saving ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <>
            <Ionicons name="save-outline" size={19} color={colors.onAccent} />
            <Text style={styles.saveText}>Сохранить</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  intro: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 2 },
  section: { marginTop: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 4 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 6 },
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingVertical: 12 },
  rowIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  rowDescription: { marginTop: 3, color: colors.textMuted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  digestTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '900', marginTop: 12, marginBottom: 8 },
  digestList: { gap: 8, paddingBottom: 10 },
  digestOption: { minHeight: 58, borderRadius: 12, backgroundColor: colors.surfaceAlt, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8 },
  digestOptionActive: { backgroundColor: colors.surfaceHi },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.textFaint, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.accent },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  digestBody: { flex: 1 },
  digestLabel: { color: colors.text, fontSize: 14, fontWeight: '900' },
  digestDescription: { marginTop: 2, color: colors.textMuted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  saveBtn: { marginTop: 18, height: 52, borderRadius: 12, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnDisabled: { opacity: 0.65 },
  saveText: { color: colors.onAccent, fontSize: 16, fontWeight: '900' },
});
