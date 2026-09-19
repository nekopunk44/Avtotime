import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { showToast } from '../store/toastStore';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Keyboard,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { createEcoTip, EcoTip, getEcoTips } from '../api/ecoTips';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors, font, radius, shadow, space } from '../theme';
import { EmptyState, PressableScale, Skeleton } from '../components/ui';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'EcoTips'> };

const CATEGORIES = ['Вождение', 'Обслуживание', 'Электромобили', 'Образ жизни', 'Другое'];
const ALL = 'Все';

// Ход выезда больше любой панели: старт всегда за краем экрана.
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_TRAVEL = SCREEN_HEIGHT;

// Плавное разворачивание карточки: высота меняется анимацией раскладки, а не
// скачком. На старой архитектуре Android это нужно включить явно.
const enableLayoutAnimation = () => {
  const manager = UIManager as unknown as {
    setLayoutAnimationEnabledExperimental?: (enabled: boolean) => void;
  };
  manager.setLayoutAnimationEnabledExperimental?.(true);
};

const TITLE_LIMIT = 80;
const TEXT_LIMIT = 600;

/**
 * Карточка совета: появляется со сдвигом по своему номеру, поэтому при смене
 * категории список набегает волной, а не подменяется целиком.
 */
function TipCard({ index, children }: { index: number; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Задержка ограничена: у двадцатой карточки ждать полсекунды незачем, да
    // и увидеть её всё равно нельзя.
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      delay: Math.min(index, 6) * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

const formatDate = (tip: EcoTip) => {
  if (tip.date) return tip.date;
  if (!tip.createdAt) return '';
  const date = new Date(tip.createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export default function EcoTipsScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  useEffect(enableLayoutAnimation, []);
  const [tips, setTips] = useState<EcoTip[]>([]);
  const [category, setCategory] = useState(ALL);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [draftCategory, setDraftCategory] = useState(CATEGORIES[0]);
  const [imageUri, setImageUri] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredTips = useMemo(() => {
    if (category === ALL) return tips;
    return tips.filter((tip) => (tip.category || '').toLowerCase() === category.toLowerCase());
  }, [category, tips]);

  // Сколько советов в каждой категории — цифра рядом с названием избавляет от
  // проверки вкладок наугад.
  const counts = useMemo(() => {
    const map: Record<string, number> = { [ALL]: tips.length };
    CATEGORIES.forEach((name) => {
      map[name] = tips.filter((tip) => (tip.category || '').toLowerCase() === name.toLowerCase()).length;
    });
    return map;
  }, [tips]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      setTips(await getEcoTips(false));
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить советы');
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

  // ── Шторка публикации ────────────────────────────────────────────────────
  const [sheetMounted, setSheetMounted] = useState(false);
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
    setTitle('');
    setDescription('');
    setDraftCategory(CATEGORIES[0]);
    setImageUri('');
  }, [saving]);

  const closeRef = useRef(closeModal);
  closeRef.current = closeModal;

  const pan = useRef(
    PanResponder.create({
      // Захват с первого касания: жест живёт на шапке, где нет кнопок.
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
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

  /**
   * Клавиатура: на Android с edge-to-edge окно под неё не ужимается, поэтому
   * высоту берём из события и поднимаем на неё саму шторку.
   *
   * Значение анимированное, а не состояние: подстановка числа переставляла
   * панель мгновенно, и на уходе клавиатуры она сначала висела, а потом
   * прыгала вниз. Слушаем и will-, и did-события: на разных платформах раньше
   * приходит своё, а повторный запуск к той же цели ничего не портит.
   */
  const keyboardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const glide = (toValue: number, duration?: number) => {
      Animated.timing(keyboardAnim, {
        toValue,
        duration: duration && duration > 0 ? duration : 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    };

    const subs = [
      Keyboard.addListener('keyboardWillShow', (e) => glide(e.endCoordinates.height, e.duration)),
      Keyboard.addListener('keyboardDidShow', (e) => glide(e.endCoordinates.height, e.duration)),
      Keyboard.addListener('keyboardWillHide', (e) => glide(0, e.duration)),
      Keyboard.addListener('keyboardDidHide', (e) => glide(0, e?.duration)),
    ];
    return () => subs.forEach((sub) => sub.remove());
  }, [keyboardAnim]);

  // Появление и уход превью: блок перетекает между строкой «добавить фото» и
  // самой картинкой, а не подменяется рывком.
  const photoAnim = useRef(new Animated.Value(0)).current;
  const [shownUri, setShownUri] = useState('');

  useEffect(() => {
    if (imageUri) setShownUri(imageUri);
    Animated.timing(photoAnim, {
      toValue: imageUri ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      // Картинку убираем только после ухода, иначе она мигнёт пустотой.
      if (finished && !imageUri) setShownUri('');
    });
  }, [imageUri, photoAnim]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Разрешите доступ к фото, чтобы добавить изображение.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });

    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const canPublish = Boolean(title.trim() && description.trim()) && !saving;

  const saveTip = async () => {
    if (!canPublish) return;

    setSaving(true);
    try {
      const created = await createEcoTip({
        title: title.trim(),
        description: description.trim(),
        category: draftCategory,
        imageUri,
      });
      setTips((prev) => [created, ...prev.filter((tip) => (tip._id || tip.id) !== (created._id || created.id))]);
      setModalOpen(false);
      setTitle('');
      setDescription('');
      setDraftCategory(CATEGORIES[0]);
      setImageUri('');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось опубликовать совет', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderTip = ({ item, index }: { item: EcoTip; index: number }) => {
    const key = String(item._id || item.id || item.title);
    const open = Boolean(expanded[key]);
    return (
      <TipCard index={index}>
      <PressableScale
        style={styles.card}
        scaleTo={0.99}
        // Совет раскрывается на месте: отдельный экран ради трёх абзацев —
        // лишний переход.
        onPress={() => {
          LayoutAnimation.configureNext({
            duration: 240,
            update: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.scaleXY },
            create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
            delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
          });
          setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
        }}
      >
        {item.image ? (
          <View>
            <Image source={{ uri: item.image }} style={styles.image} />
            <View style={styles.imageScrim} />
            <Text style={styles.imagePill}>{item.category || CATEGORIES[0]}</Text>
          </View>
        ) : null}

        <View style={styles.cardBody}>
          {!item.image ? (
            <View style={styles.metaRow}>
              <Text style={styles.pill}>{item.category || CATEGORIES[0]}</Text>
              <Text style={styles.date}>{formatDate(item)}</Text>
            </View>
          ) : null}

          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.description} numberOfLines={open ? undefined : 4}>{item.description}</Text>

          <View style={styles.cardFooter}>
            {item.image ? <Text style={styles.date}>{formatDate(item)}</Text> : <View />}
            <Text style={styles.more}>{open ? 'Свернуть' : 'Читать полностью'}</Text>
          </View>
        </View>
      </PressableScale>
      </TipCard>
    );
  };

  const renderChip = (name: string) => {
    const active = name === category;
    const count = counts[name] ?? 0;
    return (
      <PressableScale
        key={name}
        scaleTo={0.95}
        style={[styles.chip, active && styles.chipActive]}
        onPress={() => setCategory(name)}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{name}</Text>
        {count > 0 ? (
          <Text style={[styles.chipCount, active && styles.chipCountActive]}>{count}</Text>
        ) : null}
      </PressableScale>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroller}
        contentContainerStyle={styles.chipRow}
      >
        {[ALL, ...CATEGORIES].map(renderChip)}
      </ScrollView>

      {loading ? (
        <View style={styles.list}>
          {[0, 1].map((i) => <Skeleton key={i} style={styles.skeletonCard} />)}
        </View>
      ) : (
        <FlatList
          // Ключ по категории: список пересоздаётся, и карточки набегают
          // заново, а не остаются от прошлого фильтра.
          key={category}
          data={filteredTips}
          keyExtractor={(item, index) => String(item._id || item.id || index)}
          renderItem={renderTip}
          contentContainerStyle={filteredTips.length ? styles.list : styles.emptyList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <EmptyState
              icon={error ? 'alert-circle-outline' : 'leaf-outline'}
              title={error || (category === ALL ? 'Советов пока нет' : `В разделе «${category}» пусто`)}
              subtitle={
                error
                  ? 'Потяните экран вниз, чтобы повторить загрузку.'
                  : 'Поделитесь тем, что экономит топливо и бережёт машину.'
              }
            />
          }
        />
      )}

      <PressableScale
        style={[styles.fab, { bottom: insets.bottom + space.xl }]}
        scaleTo={0.94}
        onPress={() => setModalOpen(true)}
      >
        <Ionicons name="add" size={26} color={colors.onAccent} />
      </PressableScale>

      <Modal visible={sheetMounted} transparent animationType="none" onRequestClose={closeModal} statusBarTranslucent>
        <Animated.View style={[styles.backdrop, { opacity: sheetAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          <View style={styles.sheetWrap} pointerEvents="box-none">
            <Animated.View
              style={[
                styles.sheet,
                {
                  // Панель встаёт над клавиатурой, а её высота ужимается на ту
                  // же величину — верх не уезжает за экран. Отступ снизу
                  // экрана вычитается: он уже перекрыт клавиатурой.
                  marginBottom: keyboardAnim.interpolate({
                    inputRange: [0, Math.max(insets.bottom, 1), SCREEN_HEIGHT],
                    outputRange: [0, 0, SCREEN_HEIGHT - Math.max(insets.bottom, 1)],
                    extrapolate: 'clamp',
                  }),
                  maxHeight: keyboardAnim.interpolate({
                    inputRange: [0, SCREEN_HEIGHT],
                    outputRange: [SCREEN_HEIGHT - 60, -60],
                    extrapolate: 'clamp',
                  }),
                  paddingBottom: insets.bottom + space.lg,
                  transform: [{
                    translateY: Animated.add(
                      sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [SHEET_TRAVEL, 0] }),
                      sheetDrag,
                    ),
                  }],
                },
              ]}
            >
              <View {...pan.panHandlers} style={styles.handleZone}>
                <View style={styles.grabber} />
                <Text style={styles.sheetTitle}>Новый совет</Text>
              </View>

              <ScrollView
                style={styles.sheetBody}
                contentContainerStyle={styles.sheetContent}
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={false}
              >
                {/* Строка «добавить фото» и превью — один блок: высота и
                    прозрачность перетекают, поэтому подмены рывком нет. */}
                <Animated.View
                  style={[
                    styles.photoBox,
                    { height: photoAnim.interpolate({ inputRange: [0, 1], outputRange: [56, 170] }) },
                  ]}
                >
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFill,
                      { opacity: photoAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0, 0] }) },
                    ]}
                    pointerEvents={imageUri ? 'none' : 'auto'}
                  >
                    <PressableScale style={styles.photoRow} scaleTo={0.98} onPress={pickImage}>
                      <View style={styles.photoIcon}>
                        <Ionicons name="image-outline" size={18} color={colors.textMuted} />
                      </View>
                      <Text style={styles.photoRowText}>Добавить фото</Text>
                      <Text style={styles.photoRowHint}>необязательно</Text>
                    </PressableScale>
                  </Animated.View>

                  {shownUri ? (
                    <Animated.View
                      style={[StyleSheet.absoluteFill, { opacity: photoAnim }]}
                      pointerEvents={imageUri ? 'auto' : 'none'}
                    >
                      <Image source={{ uri: shownUri }} style={styles.previewImage} />
                      <Pressable style={styles.previewRemove} onPress={() => setImageUri('')} hitSlop={8}>
                        <Ionicons name="close" size={16} color={colors.white} />
                      </Pressable>
                      <PressableScale style={styles.previewReplace} scaleTo={0.95} onPress={pickImage}>
                        <Ionicons name="image-outline" size={15} color={colors.text} />
                        <Text style={styles.previewReplaceText}>Заменить</Text>
                      </PressableScale>
                    </Animated.View>
                  ) : null}
                </Animated.View>

                <View style={styles.field}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Заголовок</Text>
                    <Text style={styles.counter}>{title.length}/{TITLE_LIMIT}</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Например: Проверяйте давление в шинах"
                    placeholderTextColor={colors.textFaint}
                    value={title}
                    onChangeText={(value) => setTitle(value.slice(0, TITLE_LIMIT))}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Категория</Text>
                  {/* Сетка в две колонки: пилюли разной длины выстраивались
                      рваной лесенкой. */}
                  <View style={styles.draftGrid}>
                    {CATEGORIES.map((name) => {
                      const active = name === draftCategory;
                      return (
                        <PressableScale
                          key={name}
                          scaleTo={0.96}
                          style={[styles.draftCell, active && styles.draftCellActive]}
                          onPress={() => setDraftCategory(name)}
                        >
                          <Text
                            style={[styles.draftCellText, active && styles.draftCellTextActive]}
                            numberOfLines={1}
                          >
                            {name}
                          </Text>
                        </PressableScale>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.field}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Текст совета</Text>
                    <Text style={styles.counter}>{description.length}/{TEXT_LIMIT}</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Опишите совет подробнее"
                    placeholderTextColor={colors.textFaint}
                    value={description}
                    onChangeText={(value) => setDescription(value.slice(0, TEXT_LIMIT))}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              </ScrollView>

              <PressableScale
                style={[styles.publishBtn, !canPublish && styles.publishBtnDisabled]}
                scaleTo={0.98}
                onPress={saveTip}
              >
                {saving
                  ? <ActivityIndicator color={colors.onAccent} />
                  : <Text style={styles.publishText}>Опубликовать</Text>}
              </PressableScale>
            </Animated.View>
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  chipScroller: { flexGrow: 0, paddingTop: space.sm },
  chipRow: { gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 36, borderRadius: radius.pill, paddingHorizontal: space.md,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: font.small, fontWeight: '800' },
  chipTextActive: { color: colors.onAccent, fontWeight: '900' },
  chipCount: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '900' },
  chipCountActive: { color: 'rgba(11,11,14,0.55)' },

  list: { paddingHorizontal: space.md, paddingTop: space.xs, paddingBottom: space.xxxl, gap: space.md },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: space.lg },
  skeletonCard: { height: 240, borderRadius: radius.lg, marginBottom: space.md },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...shadow.card },
  image: { width: '100%', height: 180, backgroundColor: colors.surfaceAlt },
  // Затемнение снизу картинки: белая плашка категории читается на любом фото.
  imageScrim: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 64,
    backgroundColor: 'rgba(8,8,10,0.45)',
  },
  imagePill: {
    position: 'absolute', left: space.md, bottom: space.md, overflow: 'hidden',
    borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: 'rgba(61,214,140,0.9)', color: colors.ink,
    fontSize: font.tiny, fontWeight: '900',
  },
  cardBody: { padding: space.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  pill: {
    overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: 'rgba(61,214,140,0.14)', color: colors.success,
    fontSize: font.tiny, fontWeight: '900',
  },
  date: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '800' },
  cardTitle: { marginTop: space.sm, color: colors.text, fontSize: font.h3, lineHeight: 23, fontWeight: '900' },
  description: { marginTop: 6, color: colors.textMuted, fontSize: font.small, lineHeight: 20, fontWeight: '600' },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: space.md,
  },
  more: { color: colors.success, fontSize: font.tiny, fontWeight: '900' },

  fab: {
    position: 'absolute', right: space.lg, width: 58, height: 58, borderRadius: radius.pill,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...shadow.float,
  },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl, paddingTop: space.sm,
  },
  handleZone: { paddingTop: space.xs, paddingBottom: space.xs, alignItems: 'center' },
  grabber: {
    width: 44, height: 5, borderRadius: radius.pill,
    backgroundColor: colors.surfaceHi, marginBottom: space.md,
  },
  sheetTitle: { color: colors.text, fontSize: font.h2, fontWeight: '900', textAlign: 'center' },

  sheetBody: { marginTop: space.md },
  sheetContent: { gap: space.lg, paddingBottom: space.md },
  photoBox: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  photoRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    height: '100%', borderRadius: radius.md, paddingHorizontal: space.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  photoIcon: {
    width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  photoRowText: { flex: 1, color: colors.text, fontSize: font.small, fontWeight: '800' },
  photoRowHint: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '700' },

  previewImage: { width: '100%', height: '100%' },
  previewRemove: {
    position: 'absolute', top: space.sm, right: space.sm,
    width: 30, height: 30, borderRadius: radius.pill,
    backgroundColor: 'rgba(8,8,10,0.65)', alignItems: 'center', justifyContent: 'center',
  },
  previewReplace: {
    position: 'absolute', left: space.sm, bottom: space.sm,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 32, paddingHorizontal: space.md, borderRadius: radius.pill,
    backgroundColor: 'rgba(8,8,10,0.65)',
  },
  previewReplaceText: { color: colors.text, fontSize: font.tiny, fontWeight: '900' },

  field: { gap: space.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    color: colors.textMuted, fontSize: font.tiny, fontWeight: '900',
    marginLeft: 2, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  counter: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '800' },
  input: {
    minHeight: 48, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    paddingHorizontal: space.md, color: colors.text, fontSize: font.body,
  },
  textArea: { minHeight: 120, paddingTop: space.md, lineHeight: 21 },
  draftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  draftCell: {
    // Половина ширины за вычетом половины зазора — колонки сходятся по краям.
    width: '48.5%', height: 44, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  draftCellActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  draftCellText: { color: colors.textMuted, fontSize: font.small, fontWeight: '800' },
  draftCellTextActive: { color: colors.onAccent, fontWeight: '900' },

  publishBtn: {
    marginTop: space.md, height: 52, borderRadius: radius.pill, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  publishBtnDisabled: { opacity: 0.45 },
  publishText: { color: colors.onAccent, fontSize: font.body, fontWeight: '900' },
});
