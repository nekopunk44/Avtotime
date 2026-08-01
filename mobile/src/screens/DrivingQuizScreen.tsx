import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  DrivingMode,
  DrivingQuestion,
  getDrivingQuestions,
  saveDrivingResult,
} from '../api/driving';
import { AppStackParamList } from '../navigation/AppNavigator';
import ExamOutcomeScene from '../components/ExamOutcomeScene';
import { colors } from '../theme';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'DrivingQuiz'>;
  route: RouteProp<AppStackParamList, 'DrivingQuiz'>;
};

type AnswerMap = Record<number, number>;

const modeTitle: Record<DrivingMode, string> = {
  exam: 'Экзамен',
  practice: 'Тренировка',
  marathon: 'Марафон',
};

const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

export default function DrivingQuizScreen({ navigation, route }: Props) {
  const { mode, ticketNumber } = route.params;
  // Only the exam hides correctness until the very end — training/marathon keep
  // showing the answer and explanation right after each pick.
  const reveal = mode !== 'exam';

  const [questions, setQuestions] = useState<DrivingQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startedAt] = useState(Date.now());
  const [timeLeft, setTimeLeft] = useState(mode === 'exam' ? 20 * 60 : 0);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Backend attaches a constructed image URL to every question even when no
  // file exists. Only show the image block once it actually loads, and drop it
  // if it 404s — otherwise an empty grey box flashes for image-less questions.
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [readyImages, setReadyImages] = useState<Set<string>>(new Set());

  const slide = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const dirRef = useRef(1);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getDrivingQuestions(mode, ticketNumber);
      setQuestions(data);
      setCurrentIndex(0);
      setAnswers({});
      setFinished(false);
      setNavOpen(false);
      setTimeLeft(mode === 'exam' ? 20 * 60 : 0);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить вопросы');
    } finally {
      setLoading(false);
    }
  }, [mode, ticketNumber]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const answeredCount = Object.keys(answers).length;
  const correctCount = useMemo(() => (
    questions.reduce((sum, question, index) => (
      sum + (answers[index] === question.correctAnswerNumber ? 1 : 0)
    ), 0)
  ), [answers, questions]);
  const percentage = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
  const passed = mode !== 'exam' || percentage >= 70;
  const currentQuestion = questions[currentIndex];
  const selectedAnswer = answers[currentIndex];
  const isAnswered = selectedAnswer != null;
  const answeredPct = questions.length ? answeredCount / questions.length : 0;

  // Timer / progress lives in the native header, next to the screen title.
  useEffect(() => {
    const warn = mode === 'exam' && timeLeft < 60;
    navigation.setOptions({
      title: modeTitle[mode],
      headerRight: finished
        ? () => (
            <TouchableOpacity style={styles.headerHistory} onPress={() => navigation.navigate('DrivingResults', { mode })} hitSlop={8} activeOpacity={0.8}>
              <Ionicons name="stats-chart-outline" size={17} color={colors.text} />
              <Text style={styles.headerHistoryText}>История</Text>
            </TouchableOpacity>
          )
        : () => (
            <View style={[styles.headerBadge, warn && styles.headerBadgeWarn]}>
              <Ionicons
                name={mode === 'exam' ? 'timer-outline' : 'checkmark-done-outline'}
                size={16}
                color={warn ? colors.danger : colors.text}
              />
              <Text style={[styles.headerBadgeText, warn && styles.headerBadgeTextWarn]}>
                {mode === 'exam' ? formatTime(timeLeft) : `${answeredCount}/${questions.length}`}
              </Text>
            </View>
          ),
    });
  }, [navigation, mode, timeLeft, finished, answeredCount, questions.length]);

  const saveResult = useCallback(async () => {
    setSaving(true);
    setSaveError(false);
    const timeSpentSeconds = mode === 'exam'
      ? 20 * 60 - timeLeft
      : Math.floor((Date.now() - startedAt) / 1000);
    try {
      await saveDrivingResult({
        mode,
        ticketNumbers: ticketNumber ? [ticketNumber] : [],
        timeSpentSeconds,
        // Unanswered questions must still be sent (as 0) so a 0%/partial attempt
        // is stored in history, not just fully-answered ones.
        questions: questions.map((question, index) => ({
          questionId: question._id,
          ticketNumber: question.ticketNumber,
          questionNumber: question.questionNumber,
          selectedAnswer: answers[index] ?? 0,
          correctAnswer: question.correctAnswerNumber,
          isCorrect: answers[index] === question.correctAnswerNumber,
        })),
      });
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }, [answers, mode, questions, startedAt, ticketNumber, timeLeft]);

  const finishQuiz = useCallback(() => {
    if (!questions.length || finished) return;
    setConfirmOpen(false);
    setFinished(true);
    saveResult();
  }, [finished, questions.length, saveResult]);

  useEffect(() => {
    if (mode !== 'exam' || loading || finished) return undefined;
    if (timeLeft <= 0) {
      finishQuiz();
      return undefined;
    }
    const id = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(id);
  }, [finishQuiz, finished, loading, mode, timeLeft]);

  // Slide + fade the question card whenever we move between questions.
  useEffect(() => {
    slide.setValue(dirRef.current * 26);
    fade.setValue(0.35);
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [currentIndex, fade, slide]);

  const goNext = () => { dirRef.current = 1; setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1)); };
  const goPrev = () => { dirRef.current = -1; setCurrentIndex((prev) => Math.max(0, prev - 1)); };
  const goTo = (index: number) => {
    dirRef.current = index >= currentIndex ? 1 : -1;
    setCurrentIndex(index);
    setNavOpen(false);
  };

  const selectAnswer = (answerNumber: number) => {
    if (finished || isAnswered) return;
    setAnswers((prev) => ({ ...prev, [currentIndex]: answerNumber }));
    // Exam: auto-advance to the next question after a brief highlight.
    if (mode === 'exam' && currentIndex < questions.length - 1) {
      setTimeout(() => {
        dirRef.current = 1;
        setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
      }, 260);
    }
  };

  const confirmFinish = () => {
    if (mode === 'exam' && answeredCount < questions.length) {
      setConfirmOpen(true);
      return;
    }
    finishQuiz();
  };

  // Guard against malformed question data (empty or duplicate answer rows).
  const answerList = useMemo(() => {
    const seen = new Set<string>();
    return (currentQuestion?.answers || []).filter((answer) => {
      const text = (answer.text || '').trim();
      if (!text || seen.has(text)) return false;
      seen.add(text);
      return true;
    });
  }, [currentQuestion]);

  const answerStyle = (answerNumber: number) => {
    if (!isAnswered) return styles.answerBtn;
    if (reveal) {
      if (answerNumber === currentQuestion?.correctAnswerNumber) return [styles.answerBtn, styles.answerCorrect];
      if (answerNumber === selectedAnswer) return [styles.answerBtn, styles.answerWrong];
      return [styles.answerBtn, styles.answerMuted];
    }
    if (answerNumber === selectedAnswer) return [styles.answerBtn, styles.answerSelected];
    return styles.answerBtn;
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.text} /></View>;
  }

  if (error || !currentQuestion) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={36} color={colors.textFaint} />
        <Text style={styles.errorTitle}>{error || 'Вопросы не найдены'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadQuestions}>
          <Text style={styles.retryText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (finished) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.resultContent}>
        <ExamOutcomeScene passed={passed} />
        <Text style={styles.resultTitle}>{passed ? 'Хороший результат' : 'Нужно повторить'}</Text>
        <Text style={styles.resultPercent}>{percentage}%</Text>
        <Text style={styles.resultMeta}>Правильно {correctCount} из {questions.length}</Text>
        {saving ? <ActivityIndicator color={colors.text} style={{ marginTop: 12 }} /> : null}
        {saveError ? (
          <TouchableOpacity style={styles.saveErrorBox} onPress={saveResult} activeOpacity={0.85}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
            <Text style={styles.saveErrorText}>Не удалось сохранить. Нажмите, чтобы повторить.</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.resultTiles}>
          {questions.map((question, index) => {
            const answer = answers[index];
            const state = answer == null ? 'empty' : answer === question.correctAnswerNumber ? 'correct' : 'wrong';
            return (
              <View
                key={question._id}
                style={[
                  styles.resultTile,
                  state === 'correct' && styles.tileCorrect,
                  state === 'wrong' && styles.tileWrong,
                ]}
              >
                <Text style={[styles.resultTileText, state !== 'empty' && styles.resultTileTextOn]}>{index + 1}</Text>
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={loadQuestions}>
          <Ionicons name="refresh-outline" size={19} color={colors.onAccent} />
          <Text style={styles.primaryText}>Пройти ещё раз</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        <TouchableOpacity style={styles.navListBtn} onPress={() => setNavOpen((prev) => !prev)} activeOpacity={0.85}>
          <Ionicons name="apps-outline" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${answeredPct * 100}%` }]} />
        </View>
        <Text style={styles.progressCount}>{answeredCount}/{questions.length}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View style={{ transform: [{ translateX: slide }], opacity: fade }}>
          {currentQuestion.imageUrl && !failedImages.has(currentQuestion.imageUrl) ? (
            <Image
              source={{ uri: currentQuestion.imageUrl }}
              style={[styles.questionImage, !readyImages.has(currentQuestion.imageUrl) && styles.questionImageHidden]}
              resizeMode="cover"
              onLoad={() => setReadyImages((prev) => new Set(prev).add(currentQuestion.imageUrl!))}
              onError={() => setFailedImages((prev) => new Set(prev).add(currentQuestion.imageUrl!))}
            />
          ) : null}

          <View style={styles.questionCard}>
            <View style={styles.ticketLine}>
              <Text style={styles.ticketText}>Билет {currentQuestion.ticketNumber}</Text>
              <Text style={styles.ticketText}>Вопрос {currentIndex + 1} из {questions.length}</Text>
            </View>
            <Text style={styles.questionText}>{currentQuestion.questionText}</Text>

            <View style={styles.answers}>
              {answerList.map((answer) => (
                <TouchableOpacity
                  key={answer.number}
                  style={answerStyle(answer.number)}
                  onPress={() => selectAnswer(answer.number)}
                  activeOpacity={0.86}
                  disabled={isAnswered}
                >
                  <View style={styles.answerNumber}>
                    <Text style={styles.answerNumberText}>{answer.number}</Text>
                  </View>
                  <Text style={styles.answerText}>{answer.text}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {reveal && isAnswered ? (
              <View style={styles.explanationBox}>
                <Text style={styles.explanationTitle}>
                  {selectedAnswer === currentQuestion.correctAnswerNumber ? 'Верно' : `Правильный ответ: ${currentQuestion.correctAnswerNumber}`}
                </Text>
                {currentQuestion.explanation ? (
                  <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </Animated.View>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
            disabled={currentIndex === 0}
            onPress={goPrev}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={styles.navText}>Назад</Text>
          </TouchableOpacity>
          {currentIndex === questions.length - 1 ? (
            <TouchableOpacity style={styles.finishBtn} onPress={confirmFinish}>
              <Text style={styles.finishText}>Завершить</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.navBtn} onPress={goNext}>
              <Text style={styles.navText}>Далее</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {navOpen ? (
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.overlayBackdrop} activeOpacity={1} onPress={() => setNavOpen(false)} />
          <View style={styles.overlayCard}>
            <View style={styles.overlayHeader}>
              <Text style={styles.overlayTitle}>Вопросы</Text>
              <TouchableOpacity onPress={() => setNavOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.overlayGrid}>
              {questions.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dot,
                    index === currentIndex && styles.dotActive,
                    answers[index] != null && styles.dotAnswered,
                  ]}
                  onPress={() => goTo(index)}
                >
                  <Text style={[
                    styles.dotText,
                    (index === currentIndex || answers[index] != null) && styles.dotTextActive,
                  ]}>
                    {index + 1}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      ) : null}

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.confirmRoot}>
          <TouchableOpacity style={styles.confirmBackdrop} activeOpacity={1} onPress={() => setConfirmOpen(false)} />
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons name="flag-outline" size={24} color={colors.text} />
            </View>
            <Text style={styles.confirmTitle}>Завершить экзамен?</Text>
            <Text style={styles.confirmText}>
              Отвечено {answeredCount} из {questions.length}. Неотвеченные вопросы будут засчитаны как ошибки.
            </Text>
            <TouchableOpacity style={styles.confirmPrimary} onPress={finishQuiz} activeOpacity={0.9}>
              <Text style={styles.confirmPrimaryText}>Завершить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmSecondary} onPress={() => setConfirmOpen(false)} activeOpacity={0.9}>
              <Text style={styles.confirmSecondaryText}>Продолжить</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.bg },
  headerBadge: { height: 34, borderRadius: 999, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, marginRight: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerBadgeWarn: { backgroundColor: 'rgba(255,90,95,0.16)' },
  headerBadgeText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  headerBadgeTextWarn: { color: colors.danger },
  headerHistory: { flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 6, paddingVertical: 4 },
  headerHistoryText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  navListBtn: { width: 38, height: 32, borderRadius: 10, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  progressBar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceHi, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.accent },
  progressCount: { color: colors.textMuted, fontSize: 12, fontWeight: '900', minWidth: 42, textAlign: 'right' },
  content: { padding: 14, paddingBottom: 28 },
  questionImage: { width: '100%', height: 190, borderRadius: 12, marginBottom: 12, backgroundColor: colors.surfaceAlt },
  questionImageHidden: { height: 0, marginBottom: 0 },
  questionCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  ticketLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  ticketText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  questionText: { color: colors.text, fontSize: 18, lineHeight: 25, fontWeight: '900' },
  answers: { marginTop: 16, gap: 9 },
  answerBtn: { minHeight: 58, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surfaceAlt, padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  answerSelected: { backgroundColor: colors.surfaceHi, borderColor: colors.accent, borderWidth: 1.5 },
  answerCorrect: { backgroundColor: 'rgba(61,214,140,0.16)', borderColor: 'rgba(61,214,140,0.55)' },
  answerWrong: { backgroundColor: 'rgba(255,90,95,0.14)', borderColor: colors.danger },
  answerMuted: { opacity: 0.6 },
  answerNumber: { width: 27, height: 27, borderRadius: 14, backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center' },
  answerNumberText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  answerText: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  explanationBox: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: colors.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  explanationTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginBottom: 5 },
  explanationText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 14 },
  navBtn: { flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  navBtnDisabled: { opacity: 0.45 },
  navText: { color: colors.text, fontWeight: '900' },
  finishBtn: { flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  finishText: { color: colors.onAccent, fontWeight: '900' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-start' },
  overlayBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  overlayCard: { margin: 14, marginTop: 8, backgroundColor: colors.surface, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 14 },
  overlayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  overlayTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  overlayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dot: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  dotActive: { borderColor: colors.accent, borderWidth: 1.5 },
  dotAnswered: { backgroundColor: colors.surfaceHi },
  dotText: { color: colors.textMuted, fontSize: 13, fontWeight: '900' },
  dotTextActive: { color: colors.text },
  errorTitle: { marginTop: 10, color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  retryBtn: { marginTop: 14, paddingHorizontal: 18, height: 44, borderRadius: 12, backgroundColor: colors.accent, justifyContent: 'center' },
  retryText: { color: colors.onAccent, fontWeight: '900' },
  resultContent: { alignItems: 'center', padding: 22 },
  resultTitle: { marginTop: 18, color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  resultPercent: { marginTop: 8, color: colors.text, fontSize: 54, fontWeight: '900' },
  resultMeta: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },
  resultTiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 24 },
  resultTile: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  tileCorrect: { backgroundColor: colors.success, borderColor: colors.success },
  tileWrong: { backgroundColor: colors.danger, borderColor: colors.danger },
  resultTileText: { color: colors.textMuted, fontSize: 13, fontWeight: '900' },
  resultTileTextOn: { color: '#0B0B0E' },
  saveErrorBox: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(246,178,61,0.14)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  saveErrorText: { flex: 1, color: colors.warning, fontSize: 12, fontWeight: '800' },
  primaryBtn: { marginTop: 24, width: '100%', height: 52, borderRadius: 14, backgroundColor: colors.accent, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  primaryText: { color: colors.onAccent, fontSize: 16, fontWeight: '900' },
  confirmRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  confirmCard: { width: '100%', maxWidth: 380, backgroundColor: colors.surface, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 20, alignItems: 'center' },
  confirmIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  confirmTitle: { marginTop: 14, color: colors.text, fontSize: 19, fontWeight: '900', textAlign: 'center' },
  confirmText: { marginTop: 8, color: colors.textMuted, fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
  confirmPrimary: { marginTop: 18, width: '100%', height: 50, borderRadius: 14, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  confirmPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  confirmSecondary: { marginTop: 10, width: '100%', height: 48, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  confirmSecondaryText: { color: colors.text, fontSize: 15, fontWeight: '900' },
});
