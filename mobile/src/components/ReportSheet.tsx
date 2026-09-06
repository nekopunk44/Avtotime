import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, space, radius, font, shadow } from '../theme';
import PressableScale from './ui/PressableScale';
import { submitReport, ReportReason, ReportTargetType } from '../api/reports';

const REASONS: Array<{ key: ReportReason; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'spam', label: 'Спам', icon: 'megaphone-outline' },
  { key: 'harassment', label: 'Оскорбления или травля', icon: 'sad-outline' },
  { key: 'hate', label: 'Разжигание ненависти', icon: 'flame-outline' },
  { key: 'violence', label: 'Насилие', icon: 'warning-outline' },
  { key: 'sexual', label: 'Откровенный контент', icon: 'eye-off-outline' },
  { key: 'scam', label: 'Мошенничество', icon: 'card-outline' },
  { key: 'illegal', label: 'Незаконный контент', icon: 'ban-outline' },
  { key: 'misinformation', label: 'Дезинформация', icon: 'help-circle-outline' },
  { key: 'copyright', label: 'Нарушение авторских прав', icon: 'document-lock-outline' },
  { key: 'other', label: 'Другое', icon: 'ellipsis-horizontal-circle-outline' },
];

interface ReportSheetProps {
  visible: boolean;
  targetType: ReportTargetType;
  targetId: string;
  targetKind?: string;
  onClose: () => void;
}

type Phase = 'pick' | 'sending' | 'done' | 'already' | 'error';

/**
 * Тёмная шторка «Пожаловаться». Итог показывается внутри самой шторки:
 * жалующемуся важно увидеть, что его услышали, а не просто закрыть окно.
 */
export default function ReportSheet({ visible, targetType, targetId, targetKind, onClose }: ReportSheetProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState('');
  const [phase, setPhase] = useState<Phase>('pick');
  const [errorText, setErrorText] = useState('');
  const slide = useRef(new Animated.Value(60)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setReason(null);
      setComment('');
      setPhase('pick');
      slide.setValue(60);
      fade.setValue(0);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }),
      ]).start();
    }
  }, [visible, slide, fade]);

  const send = async () => {
    if (!reason || phase === 'sending') return;
    setPhase('sending');
    try {
      await submitReport({ targetType, targetId, targetKind, reason, comment: comment.trim() || undefined });
      setPhase('done');
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setPhase('already');
      } else {
        setErrorText(e?.response?.data?.message || 'Не удалось отправить жалобу');
        setPhase('error');
      }
    }
  };

  const finished = phase === 'done' || phase === 'already';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: slide }] }]}>
            <View style={styles.grabber} />

            {finished ? (
              <View style={styles.doneWrap}>
                <View style={styles.doneIconWrap}>
                  <Ionicons name="shield-checkmark-outline" size={30} color={colors.accent} />
                </View>
                <Text style={styles.title}>
                  {phase === 'already' ? 'Уже на рассмотрении' : 'Жалоба отправлена'}
                </Text>
                <Text style={styles.doneText}>
                  {phase === 'already'
                    ? 'Вы уже жаловались на этот объект — модераторы её видят.'
                    : 'Модераторы рассмотрят её в течение суток. Результат придёт в уведомления.'}
                </Text>
                <PressableScale style={styles.primaryBtn} onPress={onClose}>
                  <Text style={styles.primaryBtnText}>Понятно</Text>
                </PressableScale>
              </View>
            ) : (
              <>
                <Text style={styles.title}>Пожаловаться</Text>
                <Text style={styles.subtitle}>Автор не узнает, кто отправил жалобу</Text>

                <View style={styles.reasonList}>
                  {REASONS.map(({ key, label, icon }) => {
                    const active = reason === key;
                    return (
                      <PressableScale
                        key={key}
                        style={[styles.reasonRow, active && styles.reasonRowActive]}
                        onPress={() => setReason(key)}
                      >
                        <Ionicons
                          name={icon}
                          size={18}
                          color={active ? colors.onAccent : colors.textMuted}
                        />
                        <Text style={[styles.reasonText, active && styles.reasonTextActive]}>{label}</Text>
                      </PressableScale>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Комментарий (необязательно)"
                  placeholderTextColor={colors.textFaint}
                  value={comment}
                  onChangeText={setComment}
                  maxLength={1000}
                  multiline
                />

                {phase === 'error' ? <Text style={styles.errorText}>{errorText}</Text> : null}

                <PressableScale
                  style={[styles.primaryBtn, (!reason || phase === 'sending') && styles.primaryBtnDisabled]}
                  onPress={send}
                >
                  <Text style={styles.primaryBtnText}>
                    {phase === 'sending' ? 'Отправка…' : 'Отправить жалобу'}
                  </Text>
                </PressableScale>
              </>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl,
    paddingTop: space.sm,
    ...shadow.card,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHi,
    marginBottom: space.lg,
  },
  title: {
    color: colors.text,
    fontSize: font.h2,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: '600',
    marginTop: space.xs,
    marginBottom: space.lg,
  },
  reasonList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginBottom: space.lg,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm - 2,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  reasonRowActive: {
    backgroundColor: colors.accent,
  },
  reasonText: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: '700',
  },
  reasonTextActive: {
    color: colors.onAccent,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: font.body,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 48,
    maxHeight: 96,
    marginBottom: space.lg,
    textAlignVertical: 'top',
  },
  errorText: {
    color: colors.danger,
    fontSize: font.small,
    fontWeight: '600',
    marginBottom: space.md,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.4,
  },
  primaryBtnText: {
    color: colors.onAccent,
    fontSize: font.body,
    fontWeight: '900',
  },
  doneWrap: {
    alignItems: 'center',
    paddingTop: space.md,
  },
  doneIconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  doneText: {
    color: colors.textMuted,
    fontSize: font.body,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: space.sm,
    marginBottom: space.xl,
    lineHeight: 21,
  },
});
