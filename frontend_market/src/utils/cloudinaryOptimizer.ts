/**
 * Оптимизирует URL изображения из Cloudinary для быстрой загрузки
 * Добавляет параметры сжатия и автоматического формата
 */
export const optimizeCloudinaryUrl = (imageUrl?: string): string => {
  if (!imageUrl) return '';
  
  // Если это не Cloudinary URL, возвращаем как есть
  if (!imageUrl.includes('res.cloudinary.com')) {
    return imageUrl;
  }

  // Проверяем, содержит ли URL уже параметры трансформации
  if (imageUrl.includes('/image/upload/')) {
    // Вставляем параметры оптимизации после /image/upload/
    const optimizedUrl = imageUrl.replace(
      '/image/upload/',
      '/image/upload/w_800,q_75,f_auto/'
    );
    return optimizedUrl;
  }

  return imageUrl;
};

/**
 * Версия для миниатюр (меньше размер)
 */
export const optimizeCloudinaryUrlThumbnail = (imageUrl?: string): string => {
  if (!imageUrl) return '';
  
  if (!imageUrl.includes('res.cloudinary.com')) {
    return imageUrl;
  }

  if (imageUrl.includes('/image/upload/')) {
    const optimizedUrl = imageUrl.replace(
      '/image/upload/',
      '/image/upload/w_400,q_70,f_auto/'
    );
    return optimizedUrl;
  }

  return imageUrl;
};
