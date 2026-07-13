import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  autoColorTemplate,
  ColoringCollection,
  ColoringDrawing,
  ColoringTemplate,
  getColoringDrawings,
  getColoringTemplates,
  saveColoringDrawing,
} from '../api/kidsGames';
import { AppStackParamList } from '../navigation/AppNavigator';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'Coloring'> };
type SectionId = 'templates' | 'drawings';

const SECTIONS: Array<{ id: SectionId; label: string; icon: string }> = [
  { id: 'templates', label: 'Шаблоны', icon: 'color-palette-outline' },
  { id: 'drawings', label: 'Мои рисунки', icon: 'albums-outline' },
];

const COLLECTIONS: Array<{ id: ColoringCollection; label: string; icon: string }> = [
  { id: 'coloring', label: 'Авто', icon: 'car-sport-outline' },
  { id: 'coloring_mult', label: 'Мультфильмы', icon: 'film-outline' },
];

const COLOR_SET = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9D4EDD', '#FF922B'];

const formatDate = (value?: string) => {
  if (!value) return 'Недавно';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Недавно';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getDrawingKey = (item: ColoringDrawing, index: number) => item._id || item.id || `${item.templateId}-${index}`;

export default function ColoringScreen({ navigation }: Props) {
  const [activeSection, setActiveSection] = useState<SectionId>('templates');
  const [collection, setCollection] = useState<ColoringCollection>('coloring');
  const [templates, setTemplates] = useState<ColoringTemplate[]>([]);
  const [drawings, setDrawings] = useState<ColoringDrawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingTemplateId, setSavingTemplateId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [templateData, drawingData] = await Promise.all([
        getColoringTemplates(collection),
        getColoringDrawings(1, 30).catch(() => []),
      ]);
      setTemplates(templateData);
      setDrawings(drawingData);
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Не удалось загрузить раскраски');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [collection]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const groupedTemplates = useMemo(() => {
    const groups = new Map<string, ColoringTemplate[]>();
    templates.forEach((template) => {
      const key = template.category || 'Раскраски';
      groups.set(key, [...(groups.get(key) || []), template]);
    });
    return Array.from(groups.entries());
  }, [templates]);

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  const autoColorAndSave = async (template: ColoringTemplate) => {
    if (savingTemplateId) return;
    setSavingTemplateId(template.id);
    try {
      const imageData = await autoColorTemplate(template);
      const saved = await saveColoringDrawing({
        templateId: template.id,
        title: template.title,
        imageData,
        progress: 100,
        colorsUsed: COLOR_SET,
      });
      setDrawings((prev) => [saved, ...prev.filter((item) => item.templateId !== template.id)]);
      setActiveSection('drawings');
      Alert.alert('Готово', 'Раскраска сохранена в ваши рисунки.');
    } catch (e: any) {
      Alert.alert('Раскраски', e.response?.data?.message || e.message || 'Не удалось сохранить раскраску');
    } finally {
      setSavingTemplateId('');
    }
  };

  const renderHeader = () => (
    <View style={styles.top}>
      <View style={styles.titleRow}>
        <View style={styles.titleIcon}>
          <Ionicons name="color-palette-outline" size={28} color="#111" />
        </View>
        <View style={styles.titleText}>
          <Text style={styles.title}>Раскраски</Text>
          <Text style={styles.subtitle}>Шаблоны, автораскраска и сохраненные рисунки</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {SECTIONS.map((section) => {
          const active = activeSection === section.id;
          return (
            <TouchableOpacity
              key={section.id}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              onPress={() => setActiveSection(section.id)}
              activeOpacity={0.86}
            >
              <Ionicons name={section.icon as any} size={17} color={active ? '#fff' : '#777'} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{section.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderTemplate = (template: ColoringTemplate) => {
    const saving = savingTemplateId === template.id;
    return (
      <View key={`${template.collection}-${template.id}-${template.filename}`} style={styles.templateCard}>
        <View style={styles.templatePreview}>
          <Text style={styles.templateEmoji}>{template.emoji || '🎨'}</Text>
          <View style={styles.swatches}>
            {COLOR_SET.map((color) => <View key={color} style={[styles.swatch, { backgroundColor: color }]} />)}
          </View>
        </View>
        <View style={styles.templateBody}>
          <View style={styles.cardMetaRow}>
            <Text style={styles.typePill}>{template.category || 'Раскраска'}</Text>
            <Text style={styles.fileText} numberOfLines={1}>{template.filename}</Text>
          </View>
          <Text style={styles.cardTitle}>{template.title}</Text>
          {template.subtitle ? <Text style={styles.cardText}>{template.subtitle}</Text> : null}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={() => autoColorAndSave(template)}
            disabled={!!savingTemplateId}
            activeOpacity={0.86}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles-outline" size={18} color="#fff" />
                <Text style={styles.saveText}>Автораскрасить</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderTemplates = () => (
    <View style={styles.section}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionList}>
        {COLLECTIONS.map((item) => {
          const active = collection === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.collectionBtn, active && styles.collectionBtnActive]}
              onPress={() => setCollection(item.id)}
              activeOpacity={0.86}
            >
              <Ionicons name={item.icon as any} size={17} color={active ? '#fff' : '#555'} />
              <Text style={[styles.collectionText, active && styles.collectionTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{templates.length}</Text>
          <Text style={styles.statLabel}>шаблонов</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{drawings.length}</Text>
          <Text style={styles.statLabel}>сохранено</Text>
        </View>
      </View>

      {groupedTemplates.length ? groupedTemplates.map(([group, items]) => (
        <View key={group} style={styles.groupBlock}>
          <Text style={styles.groupTitle}>{group}</Text>
          <View style={styles.templateList}>{items.map(renderTemplate)}</View>
        </View>
      )) : (
        <View style={styles.emptyBox}>
          <Ionicons name="images-outline" size={38} color="#bbb" />
          <Text style={styles.emptyTitle}>Шаблоны не найдены</Text>
          <Text style={styles.emptyText}>Backend не вернул SVG-файлы для выбранной коллекции.</Text>
        </View>
      )}
    </View>
  );

  const renderDrawings = () => (
    <View style={styles.section}>
      {drawings.length ? drawings.map((drawing, index) => {
        const progress = Math.max(0, Math.min(100, drawing.progress ?? 0));
        return (
          <View key={getDrawingKey(drawing, index)} style={styles.drawingCard}>
            <View style={styles.drawingIcon}>
              <Ionicons name={progress >= 100 ? 'checkmark-circle-outline' : 'brush-outline'} size={28} color={progress >= 100 ? '#15803d' : '#d92323'} />
            </View>
            <View style={styles.drawingInfo}>
              <Text style={styles.cardTitle}>{drawing.title}</Text>
              <Text style={styles.cardText}>Шаблон: {drawing.templateId}</Text>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Прогресс</Text>
                <Text style={styles.progressValue}>{progress}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.savedDate}>{formatDate(drawing.updatedAt || drawing.savedAt || drawing.createdAt)}</Text>
            </View>
          </View>
        );
      }) : (
        <View style={styles.emptyBox}>
          <Ionicons name="albums-outline" size={38} color="#bbb" />
          <Text style={styles.emptyTitle}>Пока нет рисунков</Text>
          <Text style={styles.emptyText}>Выберите шаблон и сохраните автораскрашенную версию.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setActiveSection('templates')}>
            <Text style={styles.emptyBtnText}>К шаблонам</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#111" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        >
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={22} color="#b91c1c" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {activeSection === 'templates' ? renderTemplates() : renderDrawings()}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  top: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#fff0f0', alignItems: 'center', justifyContent: 'center' },
  titleText: { flex: 1 },
  title: { color: '#111', fontSize: 28, fontWeight: '900' },
  subtitle: { marginTop: 3, color: '#666', fontSize: 13, lineHeight: 18 },
  tabs: { flexDirection: 'row', backgroundColor: '#f3f3f3', borderRadius: 12, padding: 3, marginTop: 14 },
  tabBtn: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  tabBtnActive: { backgroundColor: '#111' },
  tabText: { color: '#777', fontSize: 12, fontWeight: '900' },
  tabTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 12, paddingBottom: 28 },
  section: { gap: 12 },
  collectionList: { gap: 8, paddingBottom: 2 },
  collectionBtn: { height: 38, borderRadius: 10, paddingHorizontal: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e5e5', flexDirection: 'row', alignItems: 'center', gap: 6 },
  collectionBtnActive: { backgroundColor: '#111', borderColor: '#111' },
  collectionText: { color: '#555', fontSize: 13, fontWeight: '900' },
  collectionTextActive: { color: '#fff' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, borderRadius: 8, backgroundColor: '#fff', padding: 14, borderWidth: 1, borderColor: '#ececec' },
  statValue: { color: '#111', fontSize: 24, fontWeight: '900' },
  statLabel: { marginTop: 3, color: '#666', fontSize: 12, fontWeight: '800' },
  groupBlock: { gap: 9 },
  groupTitle: { color: '#111', fontSize: 17, fontWeight: '900' },
  templateList: { gap: 10 },
  templateCard: { borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec', overflow: 'hidden' },
  templatePreview: { minHeight: 132, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center', gap: 12 },
  templateEmoji: { fontSize: 46 },
  swatches: { flexDirection: 'row', gap: 6 },
  swatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#fff' },
  templateBody: { padding: 13 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typePill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: '#fff0f0', color: '#d92323', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  fileText: { flex: 1, color: '#999', fontSize: 11, fontWeight: '700', textAlign: 'right' },
  cardTitle: { marginTop: 10, color: '#111', fontSize: 18, lineHeight: 23, fontWeight: '900' },
  cardText: { marginTop: 5, color: '#555', fontSize: 13, lineHeight: 19 },
  saveBtn: { marginTop: 13, height: 44, borderRadius: 10, backgroundColor: '#111', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  saveBtnDisabled: { opacity: 0.7 },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  drawingCard: { flexDirection: 'row', gap: 12, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec', padding: 13 },
  drawingIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#fff0f0', alignItems: 'center', justifyContent: 'center' },
  drawingInfo: { flex: 1 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 6 },
  progressLabel: { color: '#666', fontSize: 12, fontWeight: '800' },
  progressValue: { color: '#111', fontSize: 12, fontWeight: '900' },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: '#ededed', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#d92323' },
  savedDate: { marginTop: 8, color: '#999', fontSize: 12, fontWeight: '800' },
  errorBox: { borderRadius: 8, backgroundColor: '#fff0f0', borderWidth: 1, borderColor: '#ffd3d3', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, color: '#a51010', fontSize: 13, fontWeight: '800' },
  emptyBox: { borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec', padding: 24, alignItems: 'center' },
  emptyTitle: { marginTop: 9, color: '#111', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 5, color: '#777', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyBtn: { marginTop: 15, height: 42, borderRadius: 10, paddingHorizontal: 18, backgroundColor: '#111', justifyContent: 'center' },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
