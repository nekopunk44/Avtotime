# 🎨 Раскраски: Руководство по добавлению PNG изображений

## Структура

Сейчас структура раскрасок переделана для поддержки PNG изображений. Изображения берутся из свободных источников по URL.

## Категории раскрасок

1. **Машинки** - автомобили
2. **Спецтехника** - пожарные машины, полиция, скорая помощь
3. **Животные** - кошки, собаки, дикие животные
4. **Герои мультиков** - мультипликационные персонажи (ОБЪЕДИНЕНО)
5. **Fairy Tales** - принцессы
6. **Adventure** - пираты
7. **Space Adventure** - космос, астронавты

## Бесплатные источники PNG изображений

### Сайты с раскрасками (outline/coloring book images):

1. **Pixabay** (https://pixabay.com)
   - Поиск: "coloring book", "outline drawing"
   - Формат: PNG с прозрачным фоном
   - Пример: https://pixabay.com/illustrations/drawing-car-coloring-book

2. **Unsplash** (https://unsplash.com)
   - Поиск: "coloring page", "drawing outline"
   - Высокое качество
   - Пример: https://images.unsplash.com/photo-...

3. **Pexels** (https://pexels.com)
   - Поиск: "line art", "sketch"
   - Простые и чистые изображения

4. **Freepik** (https://www.freepik.com)
   - Раскраски для детей (даже бесплатные)
   - Много готовых рисунков машин, животных, героев

5. **OpenClipart** (https://openclipart.org)
   - Публичная библиотека чертежей
   - Часто есть контурные рисунки

6. **Flickr Creative Commons** (https://www.flickr.com)
   - Поиск с лицензией CC0
   - "children coloring"

## Как добавить новое изображение

### Вариант 1: Использовать URL из интернета (рекомендуется)

Отредактируйте файл `src/components/games/ColoringGame.tsx`:

```typescript
const COLORING_CATEGORIES = [
  { 
    id: 'cars' as const, 
    title: 'Машинки', 
    emoji: '🚗', 
    color: 'from-blue-50 to-blue-100',
    images: [
      { name: 'Машинка 1', url: 'https://ваш-url-картинки-1.png' },
      { name: 'Машинка 2', url: 'https://ваш-url-картинки-2.png' },
    ]
  },
  // ... остальные категории
];
```

### Вариант 2: Сохраните локально

1. Загрузите PNG в папку `public/coloring/`
2. Используйте локальный путь:

```typescript
{ 
  name: 'Машинка', 
  url: '/coloring/car-1.png' 
}
```

## Рекомендуемые параметры изображений

- **Размер**: 400x300px минимум (для лучшего отображения)
- **Формат**: PNG с прозрачным фоном или белым фоном
- **Качество**: 72 DPI достаточно для веб
- **Черный линии**: Четкие, толщина 2-3px для хорошей видимости

## Популярные поисковые запросы

### На английском:
- "coloring page outline" 
- "children drawing book"
- "sketch cats dogs"
- "cartoon character outline"
- "ambulance fire truck police car line art"

### На русском:
- "раскраска контур"
- "рисунок для раскрашивания"
- "черно-белый рисунок"

## Примеры хороших источников с конкретными ссылками

### Машины:
- https://unsplash.com/s/photos/car-drawing
- https://pixabay.com/illustrations/car-cartoon

### Животные:
- https://unsplash.com/s/photos/cat-drawing
- https://pixabay.com/illustrations/dog-outline

### Герои мультиков:
- https://pixabay.com/illustrations/cartoon-robot
- https://unsplash.com/s/photos/character-illustration

## Как проверить качество изображения

1. Откройте ссылку в браузере
2. Убедитесь, что:
   - Изображение четко видно
   - Нет водяных знаков (кроме "free for use")
   - Разрешение хотя бы 400x300px
   - Поддерживается использование в проектах (check license)

## Когда использовать локальные файлы vs URL

### Используйте URL когда:
✅ Много изображений
✅ Часто обновляются картинки
✅ Хотите сэкономить место в репозитории
✅ Источник надежный и стабильный

### Используйте локальные файлы когда:
✅ Стабильное хранилище важно
✅ Проект офлайн должен работать
✅ Нет интернета у пользователей
✅ Все файлы под вашим контролем

## Хотите добавить кастомные рисунки?

Если вам нужны оригинальные рисунки:

1. **AI Image Generators** (бесплатны):
   - Stable Diffusion (https://huggingface.co/spaces/stabilityai/stable-diffusion)
   - Midjourney (платно, но очень хорошо)
   - DALL-E (платно)

2. **Requests у художников**:
   - Fiverr
   - Upwork
   - Freelance.com
