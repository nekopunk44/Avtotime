import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
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
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { createEcoTip, EcoTip, getEcoTips } from '../api/ecoTips';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'EcoTips'> };

const CATEGORIES = ['Все', 'Вождение', 'Обслуживание', 'Электромобили', 'Образ жизни', 'Другое'];

const formatDate = (tip: EcoTip) => {
  if (tip.date) return tip.date;
  if (!tip.createdAt) return '';
  const date = new Date(tip.createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export default function EcoTipsScreen({ navigation }: Props) {
  const [tips, setTips] = useState<EcoTip[]>([]);
  const [category, setCategory] = useState('Все');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [draftCategory, setDraftCategory] = useState('Вождение');
  const [imageUri, setImageUri] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredTips = useMemo(() => {
    if (category === 'Все') return tips;
    return tips.filter((tip) => (tip.category || '').toLowerCase() === category.toLowerCase());
  }, [category, tips]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await getEcoTips(false);
      setTips(data);
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

  const resetDraft = () => {
    setTitle('');
    setDescription('');
    setDraftCategory('Вождение');
    setImageUri('');
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    resetDraft();
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Доступ к галерее', 'Разрешите доступ к фото, чтобы добавить изображение.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });

    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const saveTip = async () => {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (!cleanTitle || !cleanDescription) {
      Alert.alert('Совет', 'Заполните заголовок и текст совета.');
      return;
    }

    setSaving(true);
    try {
      const created = await createEcoTip({
        title: cleanTitle,
        description: cleanDescription,
        category: draftCategory,
        imageUri,
      });
      setTips((prev) => [created, ...prev.filter((tip) => (tip._id || tip.id) !== (created._id || created.id))]);
      closeModal();
      Alert.alert('Готово', 'Совет опубликован.');
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось опубликовать совет');
    } finally {
      setSaving(false);
    }
  };

  const renderCategory = ({ item }: { item: string }) => {
    const active = item === category;
    return (
      <TouchableOpacity
        style={[styles.categoryBtn, active && styles.categoryBtnActive]}
        onPress={() => setCategory(item)}
        activeOpacity={0.85}
      >
        <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item}</Text>
      </TouchableOpacity>
    );
  };

  const renderTip = ({ item }: { item: EcoTip }) => (
    <View style={styles.card}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imageFallback]}>
          <Ionicons name="leaf-outline" size={32} color="#14843b" />
        </View>
      )}

      <View style={styles.cardBody}>
        <View style={styles.cardMeta}>
          <Text style={styles.pill}>{item.category || 'Вождение'}</Text>
          <Text style={styles.date}>{formatDate(item)}</Text>
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.description} numberOfLines={5}>{item.description}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Эко советы</Text>
            <Text style={styles.subtitle}>Практичные идеи для экологичного вождения и ухода за авто</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalOpen(true)}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={CATEGORIES}
          horizontal
          keyExtractor={(item) => item}
          renderItem={renderCategory}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      ) : (
        <FlatList
          data={filteredTips}
          keyExtractor={(item, index) => String(item._id || item.id || index)}
          renderItem={renderTip}
          contentContainerStyle={filteredTips.length ? styles.list : styles.emptyList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name={error ? 'alert-circle-outline' : 'leaf-outline'} size={38} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>{error || 'Советов пока нет'}</Text>
              <Text style={styles.emptyText}>
                {error ? 'Потяните экран вниз, чтобы повторить загрузку.' : 'Поделитесь первым советом для сообщества.'}
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
            <Text style={styles.sheetTitle}>Новый эко совет</Text>

            <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.85}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.pickedImage} />
              ) : (
                <>
                  <Ionicons name="image-outline" size={24} color="#14843b" />
                  <Text style={styles.imagePickerText}>Добавить фото</Text>
                </>
              )}
            </TouchableOpacity>

            {imageUri ? (
              <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri('')}>
                <Text style={styles.removeImageText}>Убрать фото</Text>
              </TouchableOpacity>
            ) : null}

            <Text style={styles.inputLabel}>Заголовок</Text>
            <TextInput
              style={styles.input}
              placeholder="Например: Проверяйте давление в шинах"
              placeholderTextColor={colors.textFaint}
              value={title}
              onChangeText={(value) => setTitle(value.slice(0, 80))}
            />

            <Text style={styles.inputLabel}>Категория</Text>
            <View style={styles.draftCategories}>
              {CATEGORIES.filter((item) => item !== 'Все').map((item) => {
                const active = item === draftCategory;
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.draftCategoryBtn, active && styles.draftCategoryActive]}
                    onPress={() => setDraftCategory(item)}
                  >
                    <Text style={[styles.draftCategoryText, active && styles.draftCategoryTextActive]}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Текст совета</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Опишите совет подробнее"
              placeholderTextColor={colors.textFaint}
              value={description}
              onChangeText={(value) => setDescription(value.slice(0, 600))}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.counter}>{description.length}/600</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal} disabled={saving}>
                <Text style={styles.cancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveTip} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Опубликовать</Text>}
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
  top: { backgroundColor: colors.surface, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleBlock: { flex: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  subtitle: { marginTop: 4, color: colors.textMuted, fontSize: 13 },
  addBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#14843b', alignItems: 'center', justifyContent: 'center' },
  categoryList: { gap: 8, paddingTop: 14, paddingBottom: 2 },
  categoryBtn: { height: 36, borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  categoryBtnActive: { backgroundColor: '#14843b', borderColor: '#14843b' },
  categoryText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  categoryTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, gap: 10 },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  emptyState: { alignItems: 'center' },
  emptyTitle: { marginTop: 10, color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 6, color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  image: { width: '100%', height: 178, backgroundColor: '#eaf8ef' },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 14 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: '#eaf8ef', color: '#14843b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  date: { color: colors.textFaint, fontSize: 12, fontWeight: '800' },
  cardTitle: { marginTop: 12, color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: '900' },
  description: { marginTop: 8, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#ddd', marginBottom: 12 },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginBottom: 14 },
  imagePicker: { height: 116, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#a8d8b9', backgroundColor: '#f2fbf5', alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden' },
  imagePickerText: { color: '#14843b', fontSize: 14, fontWeight: '900' },
  pickedImage: { width: '100%', height: '100%' },
  removeImageBtn: { alignSelf: 'flex-end', paddingVertical: 8 },
  removeImageText: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  inputLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '800', marginTop: 12, marginBottom: 7 },
  input: { minHeight: 46, borderRadius: 8, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, color: colors.text, fontSize: 15 },
  draftCategories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  draftCategoryBtn: { height: 34, borderRadius: 9, paddingHorizontal: 10, backgroundColor: colors.surfaceAlt, justifyContent: 'center' },
  draftCategoryActive: { backgroundColor: '#14843b' },
  draftCategoryText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  draftCategoryTextActive: { color: '#fff' },
  textArea: { minHeight: 112, paddingTop: 12, lineHeight: 21 },
  counter: { marginTop: 5, color: colors.textFaint, fontSize: 12, textAlign: 'right', fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, height: 46, borderRadius: 8, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  saveBtn: { flex: 1, height: 46, borderRadius: 8, backgroundColor: '#14843b', alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});
