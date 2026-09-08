import { getPostThumb, getVideoPoster, isPostSaved } from '../api/posts';

describe('getVideoPoster', () => {
  it('строит кадр-превью только для видео с Cloudinary', () => {
    expect(getVideoPoster('https://res.cloudinary.com/x/video/upload/v1/clip.mp4'))
      .toBe('https://res.cloudinary.com/x/video/upload/v1/clip.jpg');
    // Чужой хост трансформаций Cloudinary не умеет — постера нет.
    expect(getVideoPoster('https://example.com/clip.mp4')).toBeNull();
    expect(getVideoPoster('https://res.cloudinary.com/x/image/upload/pic.jpg')).toBeNull();
    expect(getVideoPoster(undefined)).toBeNull();
  });
});

describe('getPostThumb', () => {
  it('для видео отдаёт кадр, для фото — первый файл', () => {
    expect(getPostThumb({
      mediaType: 'video',
      media: 'https://res.cloudinary.com/x/video/upload/clip.mp4',
      mediaList: [],
    })).toBe('https://res.cloudinary.com/x/video/upload/clip.jpg');

    expect(getPostThumb({
      mediaType: 'image',
      media: 'a.jpg',
      mediaList: ['first.jpg', 'second.jpg'],
    })).toBe('first.jpg');

    expect(getPostThumb({ mediaType: 'image', media: '', mediaList: [] })).toBeUndefined();
  });
});

describe('isPostSaved', () => {
  // saved с бэкенда приходит в ДВУХ формах: массив id (после облегчения
  // getCurrentUser) и массив populated-объектов (экран сохранённого).
  it('понимает и id, и populated-объекты', () => {
    expect(isPostSaved({ saved: ['p1', 'p2'] } as never, 'p2')).toBe(true);
    expect(isPostSaved({ saved: [{ _id: 'p3' }] } as never, 'p3')).toBe(true);
    expect(isPostSaved({ saved: ['p1'] } as never, 'nope')).toBe(false);
    expect(isPostSaved(null, 'p1')).toBe(false);
  });
});
