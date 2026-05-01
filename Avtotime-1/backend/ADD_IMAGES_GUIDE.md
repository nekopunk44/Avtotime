# 📸 Как добавить фотографии к вопросам

## Процесс добавления фото

### 1. Подготовка фотографий

Для каждого вопроса нужна одна фотография:
- Размер: **400x300px** или **1200x900px** (любое соотношение 4:3)
- Формат: **JPG, PNG, WebP**
- Назвать как: `ticket_1_question_1.jpg` (например)

### 2. Загрузить фото на Cloudinary

Используется тот же Cloudinary, что и в проекте:

```bash
CLOUDINARY_CLOUD_NAME="dfl7bwy9s"
CLOUDINARY_API_KEY="211218788759378"
```

Интеграция через веб-интерфейс:
1. Перейти на [Cloudinary Dashboard](https://cloudinary.com/console)
2. Загрузить папку `driving-courses-images`
3. Загрузить все 100 фото

Или через API (если нужна автоматизация):

```javascript
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
  cloud_name: "dfl7bwy9s",
  api_key: "211218788759378",
  api_secret: "YOUR_API_SECRET"
});

async function uploadImages() {
  const imageDir = './driving-course-images';
  const files = fs.readdirSync(imageDir);
  
  for (const file of files) {
    try {
      const result = await cloudinary.uploader.upload(`${imageDir}/${file}`, {
        folder: 'driving-courses',
        public_id: file.replace('.jpg', '').replace('.png', '')
      });
      console.log(`✓ Загружено: ${file}`);
      console.log(`URL: ${result.secure_url}`);
    } catch (error) {
      console.error(`✗ Ошибка загрузки ${file}:`, error);
    }
  }
}

uploadImages();
```

### 3. Обновить вопросы в БД с imageUrl

После загрузки фото на Cloudinary, обновить каждый вопрос:

**Вариант 1: Через API**

```bash
PATCH /api/driving-courses/questions/:id
{
  "imageUrl": "https://res.cloudinary.com/dfl7bwy9s/image/upload/v1686238844/driving-courses/ticket_1_question_1.jpg"
}
```

**Вариант 2: Через скрипт**

```javascript
import mongoose from "mongoose";
import DrivingQuestion from "../models/drivingQuestion.model.js";
import dotenv from "dotenv";

dotenv.config();

const imageUrls = {
  "1_1": "https://res.cloudinary.com/dfl7bwy9s/image/upload/v.../ticket_1_question_1.jpg",
  "1_2": "https://res.cloudinary.com/dfl7bwy9s/image/upload/v.../ticket_1_question_2.jpg",
  // ... все 100 вопросов
};

async function updateImages() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    
    for (const [key, url] of Object.entries(imageUrls)) {
      const [ticket, question] = key.split('_').map(Number);
      await DrivingQuestion.updateOne(
        { ticketNumber: ticket, questionNumber: question },
        { imageUrl: url }
      );
      console.log(`✓ Добавлено фото для вопроса ${ticket}_${question}`);
    }
    
    console.log("✓ Все фотографии добавлены!");
    process.exit(0);
  } catch (error) {
    console.error("✗ Ошибка:", error);
    process.exit(1);
  }
}

updateImages();
```

### 4. Проверка

После добавления фото, проверить:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/driving-courses/question/:id
```

В ответе должен быть `imageUrl`:
```json
{
  "...": "...",
  "imageUrl": "https://res.cloudinary.com/dfl7bwy9s/image/upload/..."
}
```

---

## Пример структуры папки с фото

```
driving-course-images/
├── ticket_1_question_1.jpg
├── ticket_1_question_2.jpg
├── ticket_1_question_3.jpg
├── ...
├── ticket_5_question_18.jpg
├── ticket_5_question_19.jpg
└── ticket_5_question_20.jpg
```

**Итого: 100 фотографий** (5 билетов × 20 вопросов)

---

## На фронтенде

Когда фото загружены, они автоматически отображаются:

```jsx
<img 
  src={question.imageUrl} 
  alt={`Question ${question.questionNumber}`}
  style={{ maxWidth: '100%', height: 'auto' }}
/>
```

---

## Дополнение к вопросам

На каждом вопросе показывается:

1. **Фотография дорожной ситуации**
2. **Текст вопроса**
3. **4 варианта ответов**
4. (После ответа) **Объяснение правильного ответа**

Пример макета:

```
┌─────────────────────────────────┐
│    [ФОТОГРАФИЯ 400x300px]       │
├─────────────────────────────────┤
│ Вопрос 1/20                     │
│ "В каком случае водитель..."    │
│                                 │
│ ◯ Вариант 1                     │
│ ◯ Вариант 2                     │
│ ◯ Вариант 3                     │
│ ◯ Вариант 4                     │
│                                 │
│ [← Назад] [Далее →]             │
└─────────────────────────────────┘
```

---

## Примечания

- Все фото должны быть **лицензионными** или **собственными**
- Рекомендуется использовать фото реальных дорожных ситуаций
- Размер базы по фотографиям: **~50-100 MB** в Cloudinary
- Cloudinary автоматически оптимизирует изображения для веба

---

## Когда всё готово

Пользователи смогут:
1. ✅ Проходить экзамены с фотографиями
2. ✅ Видеть дорожные ситуации
3. ✅ Лучше запоминать правила ПДД
4. ✅ Подготовиться к реальному экзамену
