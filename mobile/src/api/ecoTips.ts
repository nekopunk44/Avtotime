import client from './client';

export interface EcoTip {
  _id?: string;
  id?: number;
  title: string;
  description: string;
  category?: string;
  date?: string;
  image?: string;
  createdAt?: string;
}

export interface CreateEcoTipPayload {
  title: string;
  description: string;
  category: string;
  imageUri?: string;
}

const getImageFile = (uri: string) => {
  const filename = uri.split('/').pop() || 'eco-tip.jpg';
  const ext = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : 'jpg';
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return { uri, name: filename, type } as any;
};

export async function getEcoTips(mine = false): Promise<EcoTip[]> {
  const { data } = await client.get('/market/eco-tips', {
    params: mine ? { mine: 1 } : undefined,
  });
  return Array.isArray(data) ? data : [];
}

export async function createEcoTip(payload: CreateEcoTipPayload): Promise<EcoTip> {
  const formData = new FormData();
  formData.append('title', payload.title.trim());
  formData.append('description', payload.description.trim());
  formData.append('category', payload.category.trim() || 'Вождение');
  formData.append('date', new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }));

  if (payload.imageUri) {
    formData.append('image', getImageFile(payload.imageUri));
  }

  const { data } = await client.post('/market/eco-tips', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });

  return data;
}
