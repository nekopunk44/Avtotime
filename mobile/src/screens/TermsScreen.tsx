import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, shadow, space } from '../theme';

const EFFECTIVE_DATE = '1 июня 2026';
const CONTACT_EMAIL = 'avtotimereal@gmail.com';

// Текст повторяет условия на сайте: расходиться им нельзя — это один
// документ, просто показанный в двух местах.
const sections: Array<{ title: string; text?: string; items?: string[] }> = [
  {
    title: '1. Общие положения',
    items: [
      'Условия регулируют доступ к платформе Avtotime и её использование, включая маркет автомобилей, запчастей и услуг.',
      'Пользуясь платформой, вы подтверждаете, что ознакомились с условиями и согласны их соблюдать.',
      'Если вы не согласны с условиями, прекратите использование платформы.',
    ],
  },
  {
    title: '2. Регистрация и аккаунт',
    items: [
      'Для публикаций, объявлений и заявок нужна регистрация с достоверными сведениями.',
      'Вы отвечаете за сохранность доступа к аккаунту и за действия, совершённые под ним.',
      'Аккаунт, нарушающий условия, может быть приостановлен или удалён.',
    ],
  },
  {
    title: '3. Объявления и контент',
    items: [
      'Разрешено размещать объявления о продаже автомобилей, запчастей и автомобильных услуг.',
      'Запрещена недостоверная, вводящая в заблуждение и незаконная информация.',
      'Объявления проходят модерацию; не соответствующие правилам отклоняются или удаляются.',
      'За содержание объявления и его законность отвечает автор.',
    ],
  },
  {
    title: '4. Что запрещено',
    items: [
      'Публиковать ложные и мошеннические объявления.',
      'Использовать платформу для незаконной деятельности.',
      'Собирать данные других пользователей без их согласия.',
      'Автоматически выкачивать данные платформы.',
      'Совершать действия, нарушающие работу платформы.',
    ],
  },
  {
    title: '5. Платные возможности',
    items: [
      'Часть возможностей платная; актуальные условия — в разделе «Тарифы».',
      'Оплата идёт через защищённые платёжные системы; данные карт платформа не хранит.',
      'Возврат средств — по действующему законодательству и политике возвратов.',
    ],
  },
  {
    title: '6. Ответственность',
    items: [
      'Avtotime — площадка для объявлений и не является стороной сделок между пользователями.',
      'Платформа не отвечает за качество товаров и услуг, предлагаемых пользователями.',
      'Мы стремимся к бесперебойной работе, но не гарантируем абсолютную доступность сервиса.',
    ],
  },
  {
    title: '7. Интеллектуальная собственность',
    items: [
      'Права на логотип, дизайн и программное обеспечение принадлежат Avtotime.',
      'Размещая контент, пользователь разрешает показывать его в сервисе.',
    ],
  },
  {
    title: '8. Изменения условий',
    text: 'Условия могут меняться. Действующая редакция всегда доступна на этом экране, а продолжение работы с приложением после изменений означает согласие с ними.',
  },
];

/**
 * Условия использования в приложении: раньше они были только на сайте, и из
 * приложения на них было не сослаться.
 */
export default function TermsScreen() {
  const openEmail = () => {
    Linking.openURL(`mailto:${CONTACT_EMAIL}`).catch(() => {});
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="document-text-outline" size={28} color={colors.text} />
        </View>
        <Text style={styles.title}>Условия использования</Text>
        <Text style={styles.subtitle}>Правила площадки Avtotime</Text>
        <Text style={styles.date}>Действуют с {EFFECTIVE_DATE}</Text>
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

      <TouchableOpacity style={styles.contactCard} onPress={openEmail} activeOpacity={0.85}>
        <View style={styles.contactIcon}>
          <Ionicons name="mail-outline" size={22} color={colors.text} />
        </View>
        <View style={styles.contactBody}>
          <Text style={styles.contactTitle}>Вопросы по условиям</Text>
          <Text style={styles.contactMail}>{CONTACT_EMAIL}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, paddingBottom: space.xxl },
  hero: { alignItems: 'center', paddingVertical: space.lg },
  heroIcon: {
    width: 60, height: 60, borderRadius: radius.pill, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: space.md, ...shadow.card,
  },
  title: { color: colors.text, fontSize: font.h2, fontWeight: '900', textAlign: 'center' },
  subtitle: { marginTop: 4, color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
  date: { marginTop: 6, color: colors.textFaint, fontSize: font.tiny, fontWeight: '800' },

  section: {
    marginTop: space.md, padding: space.md, borderRadius: radius.lg,
    backgroundColor: colors.surface, ...shadow.card,
  },
  sectionTitle: { color: colors.text, fontSize: font.h3, fontWeight: '900', marginBottom: space.sm },
  paragraph: { color: colors.textMuted, fontSize: font.small, lineHeight: 20, fontWeight: '600' },
  bulletRow: { flexDirection: 'row', gap: space.sm, marginTop: 7 },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 8, backgroundColor: colors.textFaint },
  bulletText: { flex: 1, color: colors.textMuted, fontSize: font.small, lineHeight: 20, fontWeight: '600' },

  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    marginTop: space.md, padding: space.md, borderRadius: radius.lg,
    backgroundColor: colors.surface, ...shadow.card,
  },
  contactIcon: {
    width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  contactBody: { flex: 1 },
  contactTitle: { color: colors.text, fontSize: font.small, fontWeight: '900' },
  contactMail: { marginTop: 2, color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
});
