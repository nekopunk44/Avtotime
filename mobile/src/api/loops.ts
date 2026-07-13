import client from './client';

export interface LoopAuthor {
  _id: string;
  name?: string;
  userName?: string;
  profileImage?: string;
}

export interface LoopComment {
  _id?: string;
  author?: LoopAuthor;
  message: string;
}

export interface Loop {
  _id: string;
  author?: LoopAuthor;
  media: string;
  caption?: string;
  likes: string[];
  comments?: LoopComment[];
  commentsPreview?: LoopComment[];
  commentsCount?: number;
  createdAt?: string;
}

const getVideoFile = (uri: string, mimeType?: string) => {
  const filename = uri.split('/').pop() || 'loop-video.mp4';
  const ext = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : 'mp4';
  const type =
    mimeType ||
    (ext === 'mov' || ext === 'qt' ? 'video/quicktime' :
      ext === 'm4v' ? 'video/x-m4v' :
        'video/mp4');

  return { uri, name: filename, type } as any;
};

export async function getLoops(page = 1, limit = 20): Promise<Loop[]> {
  const { data } = await client.get('/loop/getAll', { params: { page, limit } });
  return Array.isArray(data) ? data : [];
}

export async function likeLoop(loopId: string): Promise<Loop> {
  const { data } = await client.get(`/loop/like/${loopId}`);
  return data;
}

export async function commentLoop(loopId: string, message: string): Promise<Loop> {
  const { data } = await client.post(`/loop/comment/${loopId}`, { message });
  return data;
}

export async function uploadLoop(uri: string, caption: string, mimeType?: string): Promise<Loop> {
  const formData = new FormData();
  formData.append('caption', caption);
  formData.append('mediaType', 'video');
  formData.append('media', getVideoFile(uri, mimeType));

  const { data } = await client.post('/loop/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 45000,
  });

  return data;
}
