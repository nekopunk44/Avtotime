import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
  const [questions, setQuestions] = useState<DrivingQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startedAt] = useState(Date.now());
  const [timeLeft, setTimeLeft] = useState(mode === 'exam' ? 20 * 60 : 0);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getDrivingQuestions(mode, ticketNumber);
      setQuestions(data);
      setCurrentIndex(0);
      setAnswers({});
      setFinished(false);
      setTimeLeft(mode === 'exam' ? 20 * 60 : 0);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить вопросы');
    } finally {
      setLoading(false);
    }
  }, [mode, ticketNumber]);

  useEffect(() => {
    navigation.setOptions({ title: modeTitle[mode] });
    loadQuestions();
  }, [loadQuestions, mode, navigation]);

  const answeredCount = Object.keys(answers).length;
  const correctCount = useMemo(() => (
    questions.reduce((sum, question, index) => {
      return sum + (answers[index] === question.correctAnswerNumber ? 1 : 0);
    }, 0)
  ), [answers, questions]);
  const percentage = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
  const passed = mode !== 'exam' || percentage >= 70;
  const currentQuestion = questions[currentIndex];
  const selectedAnswer = answers[currentIndex];
  const isAnswered = selectedAnswer != null;

  const finishQuiz = useCallback(async () => {
    if (!questions.length || finished) return;

    setFinished(true);
    setSaving(true);
    const timeSpentSeconds = mode === 'exam'
      ? 20 * 60 - timeLeft
      : Math.floor((Date.now() - startedAt) / 1000);

    try {
      await saveDrivingResult({
        mode,
        ticketNumbers: ticketNumber ? [ticketNumber] : [],
        timeSpentSeconds,
        questions: questions.map((question, index) => ({
          questionId: question._id,
          ticketNumber: question.ticketNumber,
          questionNumber: question.questionNumber,
          selectedAnswer: answers[index],
          correctAnswer: question.correctAnswerNumber,
          isCorrect: answers[index] === question.correctAnswerNumber,
        })),
      });
    } catch {
      // Result screen is still useful offline/when saving fails.
    } finally {
      setSaving(false);
    }
  }, [answers, finished, mode, questions, startedAt, ticketNumber, timeLeft]);

  useEffect(() => {
    if (mode !== 'exam' || loading || finished) return undefined;
    if (timeLeft <= 0) {
      finishQuiz();
      return undefined;
    }

    const id = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(id);
  }, [finishQuiz, finished, loading, mode, timeLeft]);

  const selectAnswer = (answerNumber: number) => {
    if (finished || isAnswered) return;
    setAnswers((prev) => ({ ...prev, [currentIndex]: answerNumber }));
  };

  const confirmFinish = () => {
    if (answeredCount < questions.length && mode === 'exam') {
      Alert.alert(
        'Завершить экзамен?',
        `Отвечено ${answeredCount} из ${questions.length}. Неотвеченные вопросы будут засчитаны как ошибки.`,
        [
          { text: 'Продолжить', style: 'cancel' },
          { text: 'Завершить', style: 'destructive', onPress: finishQuiz },
        ],
      );
      return;
    }
    finishQuiz();
  };

  const answerStyle = (answerNumber: number) => {
    if (!isAnswered) return styles.answerBtn;
    if (answerNumber === currentQuestion?.correctAnswerNumber) return [styles.answerBtn, styles.answerCorrect];
    if (answerNumber === selectedAnswer) return [styles.answerBtn, styles.answerWrong];
    return [styles.answerBtn, styles.answerMuted];
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#111" /></View>;
  }

  if (error || !currentQuestion) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={36} color="#bbb" />
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
        <View style={[styles.resultIcon, { backgroundColor: passed ? '#dcfce7' : '#fee2e2' }]}>
          <Ionicons name={passed ? 'checkmark-circle' : 'close-circle'} size={42} color={passed ? '#15803d' : '#b91c1c'} />
        </View>
        <Text style={styles.resultTitle}>{passed ? 'Хороший результат' : 'Нужно повторить'}</Text>
        <Text style={styles.resultPercent}>{percentage}%</Text>
        <Text style={styles.resultMeta}>
          Правильно {correctCount} из {questions.length}
        </Text>
        {saving ? <ActivityIndicator color="#111" style={{ marginTop: 12 }} /> : null}

        <View style={styles.resultStats}>
          <View style={styles.resultStat}>
            <Text style={styles.resultStatValue}>{answeredCount}</Text>
            <Text style={styles.resultStatLabel}>отвечено</Text>
          </View>
          <View style={styles.resultStat}>
            <Text style={styles.resultStatValue}>{questions.length - correctCount}</Text>
            <Text style={styles.resultStatLabel}>ошибок</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={loadQuestions}>
          <Ionicons name="refresh-outline" size={19} color="#fff" />
          <Text style={styles.primaryText}>Пройти ещё раз</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('DrivingResults', { mode })}>
          <Ionicons name="stats-chart-outline" size={18} color="#111" />
          <Text style={styles.secondaryText}>История результатов</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryText}>К билетам</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.modeText}>{modeTitle[mode]}</Text>
          <Text style={styles.progressText}>
            Вопрос {currentIndex + 1} из {questions.length}
          </Text>
        </View>
        <View style={[styles.timerBox, mode === 'exam' && timeLeft < 60 && styles.timerWarning]}>
          <Ionicons name={mode === 'exam' ? 'timer-outline' : 'checkmark-done-outline'} size={18} color={mode === 'exam' && timeLeft < 60 ? '#b91c1c' : '#111'} />
          <Text style={[styles.timerText, mode === 'exam' && timeLeft < 60 && styles.timerTextWarning]}>
            {mode === 'exam' ? formatTime(timeLeft) : `${correctCount}/${answeredCount || 0}`}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((currentIndex + 1) / questions.length) * 100}%` }]} />
        </View>

        {currentQuestion.imageUrl ? (
          <Image source={{ uri: currentQuestion.imageUrl }} style={styles.questionImage} resizeMode="cover" />
        ) : null}

        <View style={styles.questionCard}>
          <View style={styles.ticketLine}>
            <Text style={styles.ticketText}>Билет {currentQuestion.ticketNumber}</Text>
            <Text style={styles.ticketText}>#{currentQuestion.questionNumber}</Text>
          </View>
          <Text style={styles.questionText}>{currentQuestion.questionText}</Text>

          <View style={styles.answers}>
            {currentQuestion.answers.map((answer) => (
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

          {isAnswered ? (
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

        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
            disabled={currentIndex === 0}
            onPress={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          >
            <Ionicons name="chevron-back" size={18} color="#111" />
            <Text style={styles.navText}>Назад</Text>
          </TouchableOpacity>
          {currentIndex === questions.length - 1 ? (
            <TouchableOpacity style={styles.finishBtn} onPress={confirmFinish}>
              <Text style={styles.finishText}>Завершить</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
            >
              <Text style={styles.navText}>Далее</Text>
              <Ionicons name="chevron-forward" size={18} color="#111" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.dots}>
          {questions.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.dotActive,
                answers[index] != null && styles.dotAnswered,
              ]}
              onPress={() => setCurrentIndex(index)}
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' },
  topBar: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modeText: { color: '#111', fontSize: 19, fontWeight: '900' },
  progressText: { color: '#777', fontSize: 12, fontWeight: '700', marginTop: 2 },
  timerBox: { height: 38, borderRadius: 10, backgroundColor: '#f3f3f3', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  timerWarning: { backgroundColor: '#fee2e2' },
  timerText: { color: '#111', fontSize: 15, fontWeight: '900' },
  timerTextWarning: { color: '#b91c1c' },
  content: { padding: 14, paddingBottom: 28 },
  progressBar: { height: 7, borderRadius: 4, backgroundColor: '#e5e5e5', overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', backgroundColor: '#111' },
  questionImage: { width: '100%', height: 190, borderRadius: 8, marginBottom: 12, backgroundColor: '#eee' },
  questionCard: { backgroundColor: '#fff', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#ececec' },
  ticketLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  ticketText: { color: '#777', fontSize: 12, fontWeight: '800' },
  questionText: { color: '#111', fontSize: 18, lineHeight: 25, fontWeight: '900' },
  answers: { marginTop: 16, gap: 9 },
  answerBtn: { minHeight: 58, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  answerCorrect: { backgroundColor: '#dcfce7', borderColor: '#22c55e' },
  answerWrong: { backgroundColor: '#fee2e2', borderColor: '#ef4444' },
  answerMuted: { backgroundColor: '#f5f5f5', opacity: 0.78 },
  answerNumber: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  answerNumberText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  answerText: { flex: 1, color: '#222', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  explanationBox: { marginTop: 14, padding: 12, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  explanationTitle: { color: '#111', fontSize: 14, fontWeight: '900', marginBottom: 5 },
  explanationText: { color: '#334155', fontSize: 13, lineHeight: 19 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 14 },
  navBtn: { flex: 1, height: 45, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  navBtnDisabled: { opacity: 0.45 },
  navText: { color: '#111', fontWeight: '900' },
  finishBtn: { flex: 1, height: 45, borderRadius: 10, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  finishText: { color: '#fff', fontWeight: '900' },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14, justifyContent: 'center' },
  dot: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center' },
  dotActive: { backgroundColor: '#111', borderColor: '#111' },
  dotAnswered: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  dotText: { color: '#777', fontSize: 12, fontWeight: '900' },
  dotTextActive: { color: '#fff' },
  errorTitle: { marginTop: 10, color: '#111', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  retryBtn: { marginTop: 14, paddingHorizontal: 18, height: 42, borderRadius: 10, backgroundColor: '#111', justifyContent: 'center' },
  retryText: { color: '#fff', fontWeight: '900' },
  resultContent: { alignItems: 'center', padding: 22 },
  resultIcon: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  resultTitle: { marginTop: 18, color: '#111', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  resultPercent: { marginTop: 8, color: '#111', fontSize: 54, fontWeight: '900' },
  resultMeta: { color: '#666', fontSize: 15, fontWeight: '700' },
  resultStats: { flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' },
  resultStat: { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  resultStatValue: { color: '#111', fontSize: 22, fontWeight: '900' },
  resultStatLabel: { color: '#777', fontSize: 12, fontWeight: '700', marginTop: 3 },
  primaryBtn: { marginTop: 22, width: '100%', height: 50, borderRadius: 12, backgroundColor: '#111', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  secondaryBtn: { marginTop: 10, width: '100%', height: 48, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', flexDirection: 'row', gap: 7, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { color: '#111', fontSize: 15, fontWeight: '900' },
});
