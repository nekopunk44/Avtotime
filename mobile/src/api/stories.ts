import client from './client';

export interface StoryUser {
  _id: string;
  name?: string;
  userName: string;
  profileImage?: string;
}

export interface Story {
  _id: string;
  author: StoryUser;
  mediaType: 'image' | 'video';
  media: string;
  viewers: StoryUser[];
  createdAt: string;
}

export async function getStories(): Promise<Story[]> {
  const { data } = await client.get('/story/getAll');
  return Array.isArray(data) ? data : [];
}

export async function getStoryByUserName(userName: string): Promise<Story | null> {
  const { data } = await client.get(`/story/getByUserName/${encodeURIComponent(userName)}`);
  const stories = Array.isArray(data) ? data : [];
  return stories[0] ?? null;
}

export async function viewStory(storyId: string): Promise<Story> {
  const { data } = await client.get(`/story/view/${storyId}`);
  return data;
}

const getImageFile = (uri: string) => {
  const filename = uri.split('/').pop() ?? 'story.jpg';
  const ext = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : 'jpg';
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return { uri, name: filename, type } as any;
};

const getVideoFile = (uri: string) => {
  const filename = uri.split('/').pop() ?? 'story.mp4';
  const ext = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : 'mp4';
  const type = ext === 'mov' || ext === 'qt' ? 'video/quicktime' : ext === 'm4v' ? 'video/x-m4v' : 'video/mp4';
  return { uri, name: filename, type } as any;
};

export async function uploadStory(uri: string, mediaType: 'image' | 'video'): Promise<Story> {
  const formData = new FormData();
  formData.append('mediaType', mediaType);
  formData.append('media', mediaType === 'video' ? getVideoFile(uri) : getImageFile(uri));

  const { data } = await client.post('/story/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: mediaType === 'video' ? 45000 : 30000,
  });
  return data;
}

export async function uploadImageStory(imageUri: string): Promise<Story> {
  return uploadStory(imageUri, 'image');
}
