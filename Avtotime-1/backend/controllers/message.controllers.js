import mongoose from 'mongoose';
import uploadOnCloudinary from '../config/cloudinary.js';
import { buildPublicFileUrl } from '../config/publicFiles.js';
import Conversation from '../models/conversation.model.js';
import Message from '../models/messages.model.js';
import User from '../models/user.model.js';
import { io } from '../socket.js';
import { sendExpoPushToUser } from '../services/expoPush.js';

const DEFAULT_MESSAGES_PAGE_SIZE = 50;
const MAX_MESSAGES_PAGE_SIZE = 100;

export const sendMessage = async (req, res) => {
    try {
        const senderId = req.userId;
        const receiverId = req.params.receiverId;
        const { message } = req.body;

        // Check if receiver has blocked the sender
        const receiver = await User.findById(receiverId).select('blockedUsers notificationPreferences').lean();
        if (receiver?.blockedUsers?.some(id => id.toString() === senderId)) {
            return res.status(403).json({ message: 'Вы не можете отправить сообщение этому пользователю' });
        }

        let imageUrl = null;
        let fileUrl = null;
        let fileName = null;
        let fileType = null;
        let fileSize = null;
        let audioUrl = null;

        const imageFile = req.files?.image?.[0] || null;
        const anyFile = req.files?.file?.[0] || null;
        const audioFile = req.files?.audio?.[0] || null;

        if (audioFile) {
            const uploadedUrl = await uploadOnCloudinary(audioFile.path);
            audioUrl = uploadedUrl || buildPublicFileUrl(req, audioFile) || null;
        } else if (imageFile || anyFile) {
            const picked = imageFile || anyFile;
            const uploadedUrl = await uploadOnCloudinary(picked.path);
            const finalUrl = uploadedUrl || buildPublicFileUrl(req, picked) || null;

            const isImage = Boolean(imageFile) || (typeof picked.mimetype === 'string' && picked.mimetype.startsWith('image/'));
            if (isImage) {
                imageUrl = finalUrl;
            } else {
                fileUrl = finalUrl;
                fileName = picked.originalname || null;
                fileType = picked.mimetype || null;
                fileSize = typeof picked.size === 'number' ? picked.size : null;
            }
        }

        const newMessage = await Message.create({
            sender: senderId,
            receiver: receiverId,
            message,
            image: imageUrl,
            file: fileUrl,
            fileName,
            fileType,
            fileSize,
            audioUrl,
        });

        let conversation = await Conversation.findOne({
            participants: { $all: [senderId, receiverId] }
        });

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [senderId, receiverId],
                messages: [newMessage._id]
            });
        } else {
            conversation.messages.push(newMessage._id);
            await conversation.save();
        }
        const payload = newMessage.toObject({ getters: true });
        io.to(String(senderId)).emit('newMessage', payload);
        io.to(String(receiverId)).emit('newMessage', payload);

        if (receiver?.notificationPreferences?.message !== false) {
            const sender = await User.findById(senderId).select('name userName').lean();
            const pushBody = message
                || (imageUrl ? 'Фото' : '')
                || (fileUrl ? 'Файл' : '')
                || (audioUrl ? 'Голосовое сообщение' : 'Новое сообщение');
            sendExpoPushToUser(receiverId, {
                title: sender?.name || sender?.userName || 'Новое сообщение',
                body: pushBody,
                data: {
                    relatedType: 'message',
                    actorId: String(senderId),
                    actorName: sender?.name || '',
                    actorUserName: sender?.userName || '',
                },
            });
        }

        return res.status(200).json(payload);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: `Ошибка отправки: ${error.message}` });
    }
};

export const getAllMessages = async (req, res) => {
    try {
        const senderId = req.userId;
        const receiverId = req.params.receiverId;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(MAX_MESSAGES_PAGE_SIZE, Math.max(1, parseInt(req.query.limit) || DEFAULT_MESSAGES_PAGE_SIZE));
        const skip = (page - 1) * limit;

        const conversation = await Conversation.findOne({
            participants: { $all: [senderId, receiverId] }
        }).populate({
            path: 'messages',
            options: {
                sort: { createdAt: -1 },
                skip,
                limit,
            },
        });

        const messages = conversation ? [...conversation.messages].reverse() : [];

        // Mark the other user's messages to us as read now that we've opened the chat
        const { modifiedCount } = await Message.updateMany(
            { sender: receiverId, receiver: senderId, read: false },
            { $set: { read: true } }
        );
        if (modifiedCount > 0) {
            io.to(String(receiverId)).emit('messagesRead', { by: String(senderId) });
        }

        return res.status(200).json(messages);
    } catch (error) {
        return res.status(500).json({ message: `Ошибка получения: ${error.message}` });
    }
};

export const getPrevUserChats = async (req, res) => {
    try {
        const currentUserId = req.userId;
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));

        const conversations = await Conversation.find({
            participants: currentUserId
        })
        .select('participants messages updatedAt')
        .populate('participants', 'name userName profileImage')
        .populate({
            path: 'messages',
            options: { sort: { createdAt: -1 } },
            perDocumentLimit: 1,
        })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean({ getters: true });

        // Count unread messages sent to the current user, grouped by sender
        const unreadAgg = await Message.aggregate([
            { $match: { receiver: new mongoose.Types.ObjectId(currentUserId), read: false } },
            { $group: { _id: '$sender', count: { $sum: 1 } } },
        ]);
        const unreadBySender = {};
        unreadAgg.forEach(entry => { unreadBySender[String(entry._id)] = entry.count; });

        const previousUsers = conversations
            .map(conv => {
                const user = conv.participants.find(user => user._id.toString() !== currentUserId.toString());
                if (!user) return null;

                const last = Array.isArray(conv.messages) ? conv.messages[0] : null;
                const lastMessage = last?.message
                    || (last?.image ? 'Фото' : '')
                    || (last?.file ? 'Файл' : '')
                    || (last?.audioUrl ? 'Голосовое сообщение' : '');

                return {
                    ...user,
                    lastMessage,
                    lastMessageAt: last?.createdAt || conv.updatedAt,
                    unreadCount: unreadBySender[String(user._id)] || 0,
                };
            })
            .filter(Boolean);

        return res.status(200).json(previousUsers);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: `Ошибка превью: ${error.message}` });
    }
};

export const blockUser = async (req, res) => {
    try {
        const userId = req.userId;
        const targetId = req.params.targetId;

        if (userId === targetId) {
            return res.status(400).json({ message: 'Нельзя заблокировать себя' });
        }

        await User.findByIdAndUpdate(userId, {
            $addToSet: { blockedUsers: targetId }
        });

        return res.status(200).json({ message: 'Пользователь заблокирован' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const unblockUser = async (req, res) => {
    try {
        const userId = req.userId;
        const targetId = req.params.targetId;

        await User.findByIdAndUpdate(userId, {
            $pull: { blockedUsers: targetId }
        });

        return res.status(200).json({ message: 'Пользователь разблокирован' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const getBlockedStatus = async (req, res) => {
    try {
        const userId = req.userId;
        const targetId = req.params.targetId;

        const me = await User.findById(userId).select('blockedUsers').lean();
        const isBlocked = me?.blockedUsers?.some(id => id.toString() === targetId) ?? false;

        return res.status(200).json({ isBlocked });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const deleteConversation = async (req, res) => {
    try {
        const userId = req.userId;
        const targetId = req.params.targetId;

        const conversation = await Conversation.findOne({
            participants: { $all: [userId, targetId] }
        });

        if (!conversation) {
            return res.status(200).json({ message: 'Переписка не найдена' });
        }

        await Message.deleteMany({ _id: { $in: conversation.messages } });
        await conversation.deleteOne();

        return res.status(200).json({ message: 'Переписка удалена' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
