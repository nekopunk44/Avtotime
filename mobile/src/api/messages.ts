import client from './client';

export interface Message {
  _id: string;
  senderId: string;
  receiverId: string;
  text?: string;
  image?: string;
  createdAt: string;
}

export interface Conversation {
  _id: string;
  userName: string;
  name: string;
  profileImage: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
}

export async function getConversations(): Promise<Conversation[]> {
  const { data } = await client.get('/messages/prevChats');
  return Array.isArray(data) ? data : data.chats ?? [];
}

export async function getMessages(receiverId: string): Promise<Message[]> {
  const { data } = await client.get(`/messages/getAll/${receiverId}`);
  return Array.isArray(data) ? data : data.messages ?? [];
}

export async function sendMessage(receiverId: string, text: string, imageUri?: string): Promise<Message> {
  const formData = new FormData();
  if (text) formData.append('text', text);
  if (imageUri) {
    const filename = imageUri.split('/').pop() ?? 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    formData.append('image', { uri: imageUri, name: filename, type: match ? `image/${match[1]}` : 'image/jpeg' } as any);
  }
  const { data } = await client.post(`/messages/send/${receiverId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
