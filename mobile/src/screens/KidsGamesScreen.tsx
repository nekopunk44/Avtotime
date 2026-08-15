import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  createMarketGame,
  GameProgress,
  GameStats,
  getGameAchievements,
  getGameLeaderboard,
  getGameStats,
  getKidsActivities,
  getKidsLeaderboard,
  getMarketGames,
  KidsActivity,
  KidsLeaderboardItem,
  MarketGame,
} from '../api/kidsGames';
import { AppStackParamList } from '../navigation/AppNavigator';
import GamePreview from '../components/GamePreview';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'KidsGames'> };

type TabId = 'activities' | 'games' | 'progress';

type BuiltInGame = {
  gameId: string;
  title: string;
  description: string;
  category: string;
  icon: string;
};

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'activities', label: 'Детям', icon: 'sparkles-outline' },
  { id: 'games', label: 'Игры', icon: 'game-controller-outline' },
  { id: 'progress', label: 'Прогресс', icon: 'trophy-outline' },
];

const BUILT_IN_GAMES: BuiltInGame[] = [
  {
    gameId: 'coloring-cars',
    title: 'Раскраски авто',
    description: 'Галерея машин и авто-тем для раскрашивания.',
    category: 'Раскраски',
    icon: 'color-palette-outline',
  },
  {
    gameId: 'svg-puzzle-gallery',
    title: 'Пазлы',
    description: 'Пазлы из автомобильных картинок.',
    category: 'Головоломки',
    icon: 'extension-puzzle-outline',
  },
  {
    gameId: 'car-jump',
    title: 'Car Jump',
    description: 'Прыжки на платформы и набор очков.',
    category: 'Игры',
    icon: 'rocket-outline',
  },
  {
    gameId: 'road-fighter',
    title: 'Road Fighter',
    description: 'Аркадная дорога с препятствиями.',
    category: 'Игры',
    icon: 'car-sport-outline',
  },
  {
    gameId: 'tetris',
    title: 'Тетрис',
    description: 'Классическая игра на линии и очки.',
    category: 'Классика',
    icon: 'grid-outline',
  },
  {
    gameId: 'game-2048',
    title: '2048',
    description: 'Объединение плиток до максимального результата.',
    category: 'Классика',
    icon: 'apps-outline',
  },
  {
    gameId: 'snake',
    title: 'Змейка',
    description: 'Собирайте очки и не врезайтесь в себя.',
    category: 'Классика',
    icon: 'trail-sign-outline',
  },
  {
    gameId: 'sudoku',
    title: 'Судоку',
    description: 'Логическая сетка с цифрами.',
    category: 'Классика',
    icon: 'keypad-outline',
  },
];

const getActivityIcon = (type?: string) => {
  if (type === 'Coloring') return 'color-palette-outline';
  if (type === 'Cartoon') return 'film-outline';
  return 'game-controller-outline';
};

const getActivityLabel = (type?: string) => {
  if (type === 'Coloring') return 'Раскраска';
  if (type === 'Cartoon') return 'Мультфильм';
  return 'Игра';
};

const getGameKey = (game: MarketGame) => String(game._id || game.id || game.title);

const getBuiltInGame = (gameId?: string) => BUILT_IN_GAMES.find((game) => game.gameId === gameId);

const getProgressKey = (item: GameProgress, index: number) => item._id || item.gameId || `progress-${index}`;

const getPlayerName = (item: GameProgress) => {
  if (!item.userId || typeof item.userId === 'string') return 'Игрок';
  return item.userId.name || item.userId.userName || 'Игрок';
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export default function KidsGamesScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('activities');
  const [games, setGames] = useState<MarketGame[]>([]);
  const [activities, setActivities] = useState<KidsActivity[]>([]);
  const [kidsLeaderboard, setKidsLeaderboard] = useState<KidsLeaderboardItem[]>([]);
  const [stats, setStats] = useState<GameStats>({ games: [], totalScore: 0, totalGames: 0, totalPlayTime: 0 });
  const [achievements, setAchievements] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Все');
  const [leaderboardTitle, setLeaderboardTitle] = useState('');
  const [gameLeaderboard, setGameLeaderboard] = useState<GameProgress[]>([]);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    title: '',
    description: '',
    category: 'Игры',
    image: '',
    url: '',
  });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [marketGames, kidsActivities, leaderboard, gameStats, gameAchievements] = await Promise.all([
        getMarketGames(),
        getKidsActivities(),
        getKidsLeaderboard(),
        getGameStats(),
        getGameAchievements(),
      ]);
      setGames(marketGames.filter((game) => game.isActive !== false));
      setActivities(kidsActivities);
      setKidsLeaderboard(leaderboard);
      setStats(gameStats);
      setAchievements(gameAchievements);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось загрузить раздел игр');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const user = useAuthStore((s) => s.user);
  const isAdmin = !!user?.isAdmin;

  // Only admins can create games — hide the "+" header button for everyone else.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: isAdmin
        ? () => (
          <TouchableOpacity style={styles.headerAdd} onPress={() => setCreateOpen(true)} activeOpacity={0.85} hitSlop={8}>
            <Ionicons name="add" size={22} color={colors.onAccent} />
          </TouchableOpacity>
        )
        : undefined,
    });
  }, [isAdmin, navigation]);

  const categories = useMemo(() => {
    const values = new Set<string>();
    games.forEach((game) => {
      if (game.category) values.add(game.category);
    });
    BUILT_IN_GAMES.forEach((game) => values.add(game.category));
    return ['Все', ...Array.from(values)];
  }, [games]);

  const filteredGames = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const apiGames = games.map((game) => ({
      kind: 'external' as const,
      key: getGameKey(game),
      title: game.title,
      description: game.description || '',
      category: game.category || 'Игры',
      image: game.image || '',
      url: game.url || '',
      gameId: game._id ? `external-${game._id}` : `external-${game.id || game.title}`,
      icon: 'link-outline',
    }));
    const builtIn = BUILT_IN_GAMES.map((game) => ({ kind: 'built-in' as const, key: game.gameId, image: '', url: '', ...game }));
    return [...builtIn, ...apiGames].filter((game) => {
      const matchesCategory = category === 'Все' || game.category === category;
      const haystack = `${game.title} ${game.description} ${game.category}`.toLowerCase();
      return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [category, games, query]);

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const openExternalGame = async (url?: string) => {
    if (!url) {
      Alert.alert('Игра', 'Ссылка на игру не указана.');
      return;
    }

    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Игра', 'Не удалось открыть ссылку на этом устройстве.');
      return;
    }
    await Linking.openURL(url);
  };

  const showPortNotice = () => {
    Alert.alert(
      'Мобильная версия игры',
      'Карточка и прогресс уже подключены. Саму встроенную web-игру нужно портировать отдельным экраном под React Native.',
    );
  };

  const openBuiltInGame = (gameId: string) => {
    if (gameId === 'coloring-cars') {
      navigation.navigate('Coloring');
      return;
    }
    if (gameId === 'car-jump') {
      navigation.navigate('CarJumpGame');
      return;
    }
    if (gameId === 'road-fighter') {
      navigation.navigate('RoadFighterGame');
      return;
    }
    if (gameId === 'svg-puzzle-gallery') {
      navigation.navigate('PuzzleGame');
      return;
    }
    if (gameId === 'game-2048') {
      navigation.navigate('Game2048');
      return;
    }
    if (gameId === 'snake') {
      navigation.navigate('SnakeGame');
      return;
    }
    if (gameId === 'tetris') {
      navigation.navigate('TetrisGame');
      return;
    }
    if (gameId === 'sudoku') {
      navigation.navigate('SudokuGame');
      return;
    }

    showPortNotice();
  };

  const openProgressGame = (gameId?: string) => {
    if (!gameId) return;
    if (!getBuiltInGame(gameId)) {
      Alert.alert('Игра', 'Эта игра добавлена как внешняя ссылка. Откройте ее во вкладке игр.');
      return;
    }
    openBuiltInGame(gameId);
  };

  const showLeaderboard = async (gameId: string, title: string) => {
    setLeaderboardTitle(title);
    setLeaderboardOpen(true);
    setLeaderboardLoading(true);
    try {
      setGameLeaderboard(await getGameLeaderboard(gameId, 10));
    } catch (e: any) {
      Alert.alert('Рейтинг', e.response?.data?.message || 'Не удалось загрузить рейтинг');
      setGameLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const closeCreate = () => {
    if (saving) return;
    setCreateOpen(false);
    setDraft({ title: '', description: '', category: 'Игры', image: '', url: '' });
  };

  const saveGame = async () => {
    const title = draft.title.trim();
    if (!title) {
      Alert.alert('Игра', 'Введите название игры.');
      return;
    }

    setSaving(true);
    try {
      const created = await createMarketGame({
        title,
        description: draft.description,
        category: draft.category,
        image: draft.image,
        url: draft.url,
        isActive: true,
      });
      setGames((prev) => [created, ...prev.filter((game) => getGameKey(game) !== getGameKey(created))]);
      closeCreate();
      setActiveTab('games');
      Alert.alert('Готово', 'Игра добавлена.');
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось добавить игру');
    } finally {
      setSaving(false);
    }
  };

  const renderTabs = () => (
    <View style={styles.tabs}>
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabBtn, active && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.85}
          >
            <Ionicons name={tab.icon as any} size={17} color={active ? colors.onAccent : colors.textMuted} />
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderActivity = (activity: KidsActivity, index: number) => {
    const progress = typeof activity.progress === 'number' ? Math.max(0, Math.min(100, activity.progress)) : null;
    return (
      <View key={String(activity._id || activity.id || index)} style={styles.activityCard}>
        {activity.image ? (
          <Image source={{ uri: activity.image }} style={styles.activityImage} />
        ) : (
          <View style={[styles.activityImage, styles.activityImageFallback]}>
            <Ionicons name={getActivityIcon(activity.type) as any} size={30} color={colors.text} />
          </View>
        )}
        <View style={styles.activityBody}>
          <View style={styles.cardMetaRow}>
            <Text style={styles.typePill}>{getActivityLabel(activity.type)}</Text>
            {activity.createdAt ? <Text style={styles.dateText}>{formatDate(activity.createdAt)}</Text> : null}
          </View>
          <Text style={styles.cardTitle}>{activity.title}</Text>
          {activity.description ? <Text style={styles.cardText} numberOfLines={3}>{activity.description}</Text> : null}
          {progress !== null ? (
            <View style={styles.progressBlock}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Прогресс</Text>
                <Text style={styles.progressValue}>{progress}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const renderActivities = () => (
    <View style={styles.section}>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{activities.length}</Text>
          <Text style={styles.statLabel}>Активности</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{games.length}</Text>
          <Text style={styles.statLabel}>API игры</Text>
        </View>
      </View>

      <View style={styles.leaderboardBox}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="trophy-outline" size={20} color={colors.text} />
          <Text style={styles.sectionTitle}>Детский топ</Text>
        </View>
        {kidsLeaderboard.length ? (
          kidsLeaderboard.map((item, index) => (
            <View key={`${item.rank || index}-${item.name || 'player'}`} style={styles.rankRow}>
              <Text style={styles.rankNumber}>{item.rank || index + 1}</Text>
              <View style={styles.rankAvatar}>
                <Text style={styles.rankInitial}>{item.initial || item.name?.slice(0, 1) || '?'}</Text>
              </View>
              <Text style={styles.rankName}>{item.name || 'Игрок'}</Text>
              <Text style={styles.rankScore}>{item.score || 0}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.mutedText}>Рейтинг пока пуст.</Text>
        )}
      </View>

      <View style={styles.sectionTitleRow}>
        <Ionicons name="sparkles-outline" size={20} color={colors.text} />
        <Text style={styles.sectionTitle}>Активности</Text>
      </View>
      {activities.length ? activities.map(renderActivity) : (
        <View style={styles.emptyInline}>
          <Ionicons name="game-controller-outline" size={30} color={colors.textFaint} />
          <Text style={styles.emptyInlineTitle}>Активностей пока нет</Text>
          <Text style={styles.emptyInlineText}>Когда они появятся на backend, экран подтянет их автоматически.</Text>
        </View>
      )}
    </View>
  );

  const renderGames = () => (
    <View style={styles.section}>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск игр"
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
        {categories.map((item) => {
          const active = item === category;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.categoryBtn, active && styles.categoryBtnActive]}
              onPress={() => setCategory(item)}
              activeOpacity={0.85}
            >
              <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.gameGrid}>
        {filteredGames.map((game) => (
          <TouchableOpacity
            key={game.key}
            style={styles.gameTile}
            onPress={() => game.kind === 'external' ? openExternalGame(game.url) : openBuiltInGame(game.gameId)}
            activeOpacity={0.88}
          >
            {game.image ? (
              <Image source={{ uri: game.image }} style={styles.tilePreview} />
            ) : game.kind === 'built-in' ? (
              <GamePreview gameId={game.gameId} style={styles.tilePreview} />
            ) : (
              <View style={[styles.tilePreview, styles.tileFallback]}>
                <Ionicons name={game.icon as any} size={30} color={colors.textMuted} />
              </View>
            )}
            <TouchableOpacity
              style={styles.tileTrophy}
              onPress={() => showLeaderboard(game.gameId, game.title)}
              hitSlop={6}
              activeOpacity={0.85}
            >
              <Ionicons name="trophy-outline" size={14} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.tileBody}>
              <Text style={styles.tileTitle} numberOfLines={1}>{game.title}</Text>
              <Text style={styles.tileMeta} numberOfLines={1}>{game.category}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {!filteredGames.length ? (
        <View style={styles.emptyInline}>
          <Ionicons name="search-outline" size={30} color={colors.textFaint} />
          <Text style={styles.emptyInlineTitle}>Игры не найдены</Text>
          <Text style={styles.emptyInlineText}>Измените поиск или категорию.</Text>
        </View>
      ) : null}
    </View>
  );

  const renderProgress = () => (
    <View style={styles.section}>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.totalScore}</Text>
          <Text style={styles.statLabel}>Очки</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.totalGames}</Text>
          <Text style={styles.statLabel}>Игр</Text>
        </View>
      </View>

      {achievements.length ? (
        <View style={styles.achievementsBox}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="ribbon-outline" size={20} color={colors.text} />
            <Text style={styles.sectionTitle}>Достижения</Text>
          </View>
          <View style={styles.achievementList}>
            {achievements.map((item) => (
              <Text key={item} style={styles.achievementPill}>{item}</Text>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.sectionTitleRow}>
        <Ionicons name="stats-chart-outline" size={20} color={colors.text} />
        <Text style={styles.sectionTitle}>Мой прогресс</Text>
      </View>
      {stats.games.length ? (
        stats.games.map((item, index) => (
          <TouchableOpacity
            key={getProgressKey(item, index)}
            style={styles.progressCard}
            onPress={() => openProgressGame(item.gameId)}
            activeOpacity={0.85}
          >
            <View style={styles.progressIcon}>
              <Ionicons name={(getBuiltInGame(item.gameId)?.icon || 'game-controller-outline') as any} size={22} color={colors.text} />
            </View>
            <View style={styles.progressInfo}>
              <Text style={styles.progressTitle}>{item.gameName || getBuiltInGame(item.gameId)?.title || item.gameId}</Text>
              <Text style={styles.progressSub}>
                Лучший: {item.bestScore || 0} · Уровень {item.level || 1} · Запусков {item.timesPlayed || 0}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, item.progress || 0))}%` }]} />
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyInline}>
          <Ionicons name="stats-chart-outline" size={30} color={colors.textFaint} />
          <Text style={styles.emptyInlineTitle}>Прогресса пока нет</Text>
          <Text style={styles.emptyInlineText}>Он появится после игр, которые сохраняют результат через backend.</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        {renderTabs()}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        >
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={24} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {activeTab === 'activities' ? renderActivities() : null}
          {activeTab === 'games' ? renderGames() : null}
          {activeTab === 'progress' ? renderProgress() : null}
        </ScrollView>
      )}

      <Modal visible={leaderboardOpen} transparent animationType="fade" onRequestClose={() => setLeaderboardOpen(false)}>
        <View style={styles.modalRoot}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setLeaderboardOpen(false)} />
          <View style={styles.dialog}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>{leaderboardTitle}</Text>
              <TouchableOpacity onPress={() => setLeaderboardOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            {leaderboardLoading ? (
              <View style={styles.dialogCenter}>
                <ActivityIndicator color={colors.text} />
              </View>
            ) : gameLeaderboard.length ? (
              gameLeaderboard.map((item, index) => (
                <View key={getProgressKey(item, index)} style={styles.rankRow}>
                  <Text style={styles.rankNumber}>{index + 1}</Text>
                  <View style={styles.rankAvatar}>
                    <Text style={styles.rankInitial}>{getPlayerName(item).slice(0, 1)}</Text>
                  </View>
                  <Text style={styles.rankName}>{getPlayerName(item)}</Text>
                  <Text style={styles.rankScore}>{item.bestScore || item.score || 0}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.mutedText}>Рейтинг пока пуст.</Text>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={closeCreate}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetRoot}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeCreate} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Новая игра</Text>

            <Text style={styles.inputLabel}>Название</Text>
            <TextInput
              style={styles.input}
              placeholder="Например: Авто-квиз"
              placeholderTextColor={colors.textFaint}
              value={draft.title}
              onChangeText={(title) => setDraft((prev) => ({ ...prev, title: title.slice(0, 80) }))}
            />

            <Text style={styles.inputLabel}>Категория</Text>
            <TextInput
              style={styles.input}
              placeholder="Игры"
              placeholderTextColor={colors.textFaint}
              value={draft.category}
              onChangeText={(value) => setDraft((prev) => ({ ...prev, category: value.slice(0, 40) }))}
            />

            <Text style={styles.inputLabel}>Ссылка</Text>
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor={colors.textFaint}
              value={draft.url}
              onChangeText={(url) => setDraft((prev) => ({ ...prev, url }))}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={styles.inputLabel}>Картинка</Text>
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor={colors.textFaint}
              value={draft.image}
              onChangeText={(image) => setDraft((prev) => ({ ...prev, image }))}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={styles.inputLabel}>Описание</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Коротко опишите игру"
              placeholderTextColor={colors.textFaint}
              value={draft.description}
              onChangeText={(description) => setDraft((prev) => ({ ...prev, description: description.slice(0, 400) }))}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeCreate} disabled={saving}>
                <Text style={styles.cancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveGame} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.saveText}>Добавить</Text>}
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
  top: { backgroundColor: colors.surface, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerAdd: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  tabs: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 3 },
  tabBtn: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  tabBtnActive: { backgroundColor: colors.accent },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: '900' },
  tabTextActive: { color: colors.onAccent },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 12, paddingBottom: 28 },
  section: { gap: 10 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, borderRadius: 8, backgroundColor: colors.surface, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  statValue: { color: colors.text, fontSize: 24, fontWeight: '900' },
  statLabel: { marginTop: 3, color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  leaderboardBox: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 14, gap: 9 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  rankRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 8, backgroundColor: colors.bg, paddingHorizontal: 10, paddingVertical: 7 },
  rankNumber: { width: 22, color: colors.text, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  rankAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center' },
  rankInitial: { color: '#fff', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  rankName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  rankScore: { color: colors.text, fontSize: 14, fontWeight: '900' },
  activityCard: { backgroundColor: colors.surface, borderRadius: 8, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  activityImage: { width: '100%', height: 154, backgroundColor: colors.surfaceAlt },
  activityImageFallback: { alignItems: 'center', justifyContent: 'center' },
  activityBody: { padding: 14 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  typePill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: colors.accentSoft, color: colors.textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  dateText: { color: colors.textFaint, fontSize: 12, fontWeight: '800' },
  cardTitle: { marginTop: 11, color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: '900' },
  cardText: { marginTop: 7, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  progressBlock: { marginTop: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  progressValue: { color: colors.text, fontSize: 12, fontWeight: '900' },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: colors.surfaceHi, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.accent },
  searchBox: { height: 44, borderRadius: 12, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  categoryList: { gap: 8, paddingTop: 4, paddingBottom: 2 },
  categoryBtn: { height: 36, borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  categoryBtnActive: { backgroundColor: colors.surfaceHi, borderColor: colors.border },
  categoryText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  categoryTextActive: { color: '#fff' },
  gameGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gameTile: { width: '48.6%', marginBottom: 10, borderRadius: 14, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  tilePreview: { width: '100%', aspectRatio: 1.5, backgroundColor: colors.surfaceAlt },
  tileFallback: { alignItems: 'center', justifyContent: 'center' },
  tileTrophy: { position: 'absolute', top: 7, right: 7, width: 28, height: 28, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  tileBody: { paddingHorizontal: 11, paddingVertical: 9 },
  tileTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  tileMeta: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  achievementsBox: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 14 },
  achievementList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  achievementPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surfaceAlt, color: colors.text, fontSize: 12, fontWeight: '900' },
  progressCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 8, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 12 },
  progressIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  progressInfo: { flex: 1 },
  progressTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  progressSub: { marginTop: 3, marginBottom: 8, color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  errorBox: { marginBottom: 10, borderRadius: 8, backgroundColor: 'rgba(255,90,95,0.12)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,90,95,0.25)', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '800' },
  emptyInline: { borderRadius: 8, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 24, alignItems: 'center' },
  emptyInlineTitle: { marginTop: 9, color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyInlineText: { marginTop: 5, color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  mutedText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  modalRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  dialog: { width: '100%', maxHeight: '76%', borderRadius: 14, backgroundColor: colors.surface, padding: 14, gap: 8 },
  dialogHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  dialogTitle: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '900' },
  closeBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  dialogCenter: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: colors.surfaceHi, marginBottom: 12 },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginBottom: 14 },
  inputLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '800', marginBottom: 7 },
  input: { minHeight: 46, borderRadius: 8, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, color: colors.text, fontSize: 15, marginBottom: 12 },
  textArea: { minHeight: 104, paddingTop: 12, lineHeight: 21 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, height: 46, borderRadius: 8, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  saveBtn: { flex: 1, height: 46, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: colors.onAccent, fontSize: 15, fontWeight: '900' },
});
