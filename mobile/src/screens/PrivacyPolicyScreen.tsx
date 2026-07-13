import React from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const EFFECTIVE_DATE = '23 апреля 2026';
const CONTACT_EMAIL = 'avtotimereal@gmail.com';

const sections = [
  {
    title: '1. Какие данные мы собираем',
    items: [
      'Данные аккаунта: имя, username, email, пароль в защищенном виде, фото профиля.',
      'Контент: посты, комментарии, сообщения, сторис, изображения, видео, объявления и отзывы.',
      'Данные объявлений: марка, модель, год, регион, цена, описание, фото и параметры услуги.',
      'Технические данные: IP-адрес, тип устройства, системные журналы и данные безопасности.',
    ],
  },
  {
    title: '2. Зачем мы используем данные',
    items: [
      'Чтобы создавать и обслуживать аккаунт, вход, восстановление пароля и подтверждение email.',
      'Чтобы работали лента, сообщения, маркет, уведомления, курсы и другие функции Avtotime.',
      'Чтобы модерировать контент, предотвращать спам, злоупотребления и нарушение правил.',
      'Чтобы улучшать качество сервиса, аналитику, диагностику ошибок и поддержку пользователей.',
    ],
  },
  {
    title: '3. Передача третьим лицам',
    text: 'Мы можем привлекать сервисы для отправки писем, хранения медиа, платежей, аналитики и хостинга. Такие сервисы получают только тот объем данных, который нужен для работы платформы.',
  },
  {
    title: '4. Хранение и безопасность',
    text: 'Мы храним данные столько, сколько нужно для целей, описанных в этой политике, или сколько требуется законом. Мы применяем разумные технические и организационные меры защиты, но ни один способ передачи или хранения данных не является абсолютно безопасным.',
  },
  {
    title: '5. Ваши права',
    items: [
      'Запросить доступ к данным и получить их копию.',
      'Исправить неточные данные в профиле.',
      'Удалить аккаунт и связанные данные, если это допускается законом.',
      'Обратиться к нам по вопросам обработки персональных данных.',
    ],
  },
  {
    title: '6. Cookies и похожие технологии',
    text: 'В мобильном приложении могут использоваться локальные токены авторизации и системные механизмы устройства, чтобы сохранять вход и обеспечивать безопасность аккаунта.',
  },
  {
    title: '7. Возрастные ограничения',
    text: 'Сервис не предназначен для использования детьми, если это запрещено законами вашей страны. Если вы считаете, что ребенок предоставил нам данные, напишите на контактный email.',
  },
  {
    title: '8. Изменения политики',
    text: 'Мы можем обновлять эту политику. Актуальная версия будет доступна в приложении и на сайте Avtotime.',
  },
];

export default function PrivacyPolicyScreen() {
  const openEmail = () => {
    Linking.openURL(`mailto:${CONTACT_EMAIL}`).catch(() => {});
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="shield-checkmark-outline" size={28} color="#111" />
        </View>
        <Text style={styles.title}>Политика конфиденциальности</Text>
        <Text style={styles.subtitle}>Персональные данные Avtotime</Text>
        <Text style={styles.date}>Дата вступления в силу: {EFFECTIVE_DATE}</Text>
      </View>

      <View style={styles.introCard}>
        <Text style={styles.introText}>
          Эта политика объясняет, какие данные мы собираем при использовании Avtotime,
          зачем они нужны, кому и когда могут быть переданы, как долго мы их храним и
          какие права есть у пользователя.
        </Text>
      </View>

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.text ? <Text style={styles.paragraph}>{section.text}</Text> : null}
          {section.items?.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <View style={styles.bullet} />
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      ))}

      <View style={styles.contactCard}>
        <View style={styles.contactIcon}>
          <Ionicons name="mail-outline" size={22} color="#111" />
        </View>
        <View style={styles.contactBody}>
          <Text style={styles.contactTitle}>Контакты</Text>
          <Text style={styles.contactText}>По вопросам конфиденциальности и обработки данных:</Text>
          <TouchableOpacity onPress={openEmail} activeOpacity={0.8}>
            <Text style={styles.email}>{CONTACT_EMAIL}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  content: { padding: 16, paddingBottom: 32 },
  hero: { alignItems: 'center', paddingVertical: 18 },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { color: '#111', fontSize: 27, lineHeight: 33, fontWeight: '900', textAlign: 'center' },
  subtitle: { marginTop: 5, color: '#666', fontSize: 14, textAlign: 'center', fontWeight: '700' },
  date: { marginTop: 8, color: '#777', fontSize: 12, fontWeight: '800' },
  introCard: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  introText: { color: '#fff', fontSize: 14, lineHeight: 21, fontWeight: '700' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ececec',
    padding: 14,
    marginBottom: 10,
  },
  sectionTitle: { color: '#111', fontSize: 17, lineHeight: 22, fontWeight: '900', marginBottom: 8 },
  paragraph: { color: '#555', fontSize: 14, lineHeight: 21, fontWeight: '600' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 8 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#d92323', marginTop: 7 },
  bulletText: { flex: 1, color: '#555', fontSize: 14, lineHeight: 21, fontWeight: '600' },
  contactCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ececec',
    padding: 14,
    flexDirection: 'row',
    gap: 11,
  },
  contactIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactBody: { flex: 1 },
  contactTitle: { color: '#111', fontSize: 16, fontWeight: '900' },
  contactText: { marginTop: 4, color: '#777', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  email: { marginTop: 6, color: '#111', fontSize: 14, fontWeight: '900', textDecorationLine: 'underline' },
});
