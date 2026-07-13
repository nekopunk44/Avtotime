import client from './client';
import { getUploadFile } from '../utils/upload';

export interface Message {
  _id: string;
  sender: string | { _id: string };
  receiver: string | { _id: string };
  message?: string;
  image?: string;
  file?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  audioUrl?: string;
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

export interface SendMessagePayload {
  text?: string;
  imageUri?: string;
  fileUri?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  audioUri?: string;
  audioName?: string;
  audioType?: string;
}

export function getMessageUserId(value: Message['sender'] | Message['receiver']) {
  return typeof value === 'string' ? value : value?._id;
}

export async function getConversations(limit = 50): Promise<Conversation[]> {
  const { data } = await client.get('/message/prevChats', { params: { limit } });
  return Array.isArray(data) ? data : data.chats ?? [];
}

export async function getMessages(
  receiverId: string,
  options: { page?: number; limit?: number } = {},
): Promise<Message[]> {
  const { data } = await client.get(`/message/getAll/${receiverId}`, {
    params: {
      page: options.page ?? 1,
      limit: options.limit ?? 50,
    },
  });
  return Array.isArray(data) ? data : data.messages ?? [];
}

export async function sendMessage(receiverId: string, payload: SendMessagePayload): Promise<Message> {
  const formData = new FormData();
  if (payload.text?.trim()) formData.append('message', payload.text.trim());
  if (payload.imageUri) {
    formData.append('image', getUploadFile(payload.imageUri, 'chat-photo.jpg'));
  }
  if (payload.fileUri) {
    formData.append('file', getUploadFile(payload.fileUri, payload.fileName || 'attachment.bin', payload.fileType));
  }
  if (payload.audioUri) {
    formData.append('audio', getUploadFile(payload.audioUri, payload.audioName || 'voice-message.m4a', payload.audioType || 'audio/mp4'));
  }
  const { data } = await client.post(`/message/send/${receiverId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  return data;
}

export async function blockUser(targetId: string): Promise<void> {
  await client.post(`/message/block/${targetId}`);
}

export async function unblockUser(targetId: string): Promise<void> {
  await client.delete(`/message/block/${targetId}`);
}

export async function getBlockedStatus(targetId: string): Promise<{ isBlocked: boolean }> {
  const { data } = await client.get(`/message/block/${targetId}`);
  return { isBlocked: !!data?.isBlocked };
}

export async function deleteConversation(targetId: string): Promise<void> {
  await client.delete(`/message/conversation/${targetId}`);
}
