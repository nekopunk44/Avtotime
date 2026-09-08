import mongoose from 'mongoose';
import uploadOnCloudinary from '../config/cloudinary.js';
import { buildPublicFileUrl } from '../config/publicFiles.js';
import Conversation from '../models/conversation.model.js';
import Message from '../models/messages.model.js';
import User from '../models/user.model.js';
import { io } from '../socket.js';
import { sendExpoPushToUser } from '../services/expoPush.js';
import { decryptString, encryptString } from '../services/crypto/fieldEncryption.js';

const DEFAULT_MESSAGES_PAGE_SIZE = 50;
const MAX_MESSAGES_PAGE_SIZE = 100;

const buildMessagePreview = (msg) =>
    msg?.message
    || (msg?.image ? 'Фото' : '')
    || (msg?.file ? 'Файл' : '')
    || (msg?.audioUrl ? 'Голосовое сообщение' : '');

export const sendMessage = async (req, res) => {
    try {
        const senderId = req.userId;
        const receiverId = req.params.receiverId;
        const { message } = req.body;

        if (!mongoose.isValidObjectId(receiverId)) {
            return res.status(400).json({ message: 'Некорректный получатель' });
        }
        const hasAttachment = Boolean(req.files?.image?.[0] || req.files?.file?.[0] || req.files?.audio?.[0]);
        if (!String(message || '').trim() && !hasAttachment) {
            return res.status(400).json({ message: 'Сообщение не может быть пустым' });
        }

        // Check if receiver has blocked the sender
        const receiver = await User.findById(receiverId).select('blockedUsers notificationPreferences').lean();
        if (!receiver) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
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

        // Atomic upsert: two concurrent first messages would otherwise both
        // pass the findOne-null check and create duplicate conversations.
        // The last-message fields are denormalized here so the chat list needs
        // no per-conversation message lookup. encryptString is applied
        // explicitly (and is idempotent) so the preview is encrypted at rest
        // even if schema setters are skipped on update queries.
        // Массива messages здесь больше нет: он рос на каждой отправке и вёл
        // диалог к жёсткому лимиту документа Mongo в 16 МБ, после которого
        // запись сообщений просто перестаёт работать. Сообщения адресуются
        // парой (sender, receiver) — под неё есть составной индекс.
        // Фильтр через $elemMatch, а не $all:[a,b]: при upsert-вставке Mongo
        // пытается вывести поля нового документа из равенств запроса, и
        // «participants matched twice» валил САМОЕ ПЕРВОЕ сообщение пары
        // ошибкой 500. $elemMatch в выводе не участвует — участники берутся
        // из $setOnInsert.
        await Conversation.findOneAndUpdate(
            {
                $and: [
                    { participants: { $elemMatch: { $eq: senderId } } },
                    { participants: { $elemMatch: { $eq: receiverId } } },
                ],
            },
            {
                $set: {
                    lastMessagePreview: encryptString(
                        buildMessagePreview({ message, image: imageUrl, file: fileUrl, audioUrl })
                    ),
                    lastMessageAt: newMessage.createdAt || new Date(),
                    lastMessageSender: senderId,
                },
                $setOnInsert: { participants: [senderId, receiverId] },
            },
            { upsert: true, new: true }
        );
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

        // Прямой запрос по паре, а не populate массива из Conversation: тот
        // на каждой странице отправлял в $in ВЕСЬ список id диалога — запрос
        // рос вместе с историей. Составной индекс (receiver, sender,
        // createdAt) закрывает обе стороны пары.
        const pageDesc = await Message.find({
            $or: [
                { sender: senderId, receiver: receiverId },
                { sender: receiverId, receiver: senderId },
            ],
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const messages = pageDesc.map((m) => m.toObject({ getters: true })).reverse();

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

export const markConversationRead = async (req, res) => {
    try {
        const currentUserId = req.userId;
        const otherId = req.params.targetId;

        const { modifiedCount } = await Message.updateMany(
            { sender: otherId, receiver: currentUserId, read: false },
            { $set: { read: true } }
        );
        if (modifiedCount > 0) {
            io.to(String(otherId)).emit('messagesRead', { by: String(currentUserId) });
        }

        return res.status(200).json({ modifiedCount });
    } catch (error) {
        return res.status(500).json({ message: `Ошибка отметки прочтения: ${error.message}` });
    }
};

export const getPrevUserChats = async (req, res) => {
    try {
        const currentUserId = req.userId;
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));

        // No message populate here: with perDocumentLimit mongoose issues one
        // extra query per conversation (N+1). The preview comes from the
        // denormalized fields, and `$slice: -1` keeps only the id of the last
        // message for the legacy fallback below.
        const conversations = await Conversation.find({
            participants: currentUserId
        })
        .select('participants updatedAt lastMessagePreview lastMessageAt lastMessageSender')
        .slice('messages', -1)
        .populate('participants', 'name userName profileImage')
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean({ getters: true });

        // Conversations created before the denormalized fields existed: fetch
        // their last message in ONE batched query instead of one per chat.
        const legacyIds = conversations
            .filter(conv => !conv.lastMessageAt)
            .map(conv => (Array.isArray(conv.messages) ? conv.messages[conv.messages.length - 1] : null))
            .filter(Boolean);

        const legacyById = new Map();
        if (legacyIds.length > 0) {
            const legacyMessages = await Message.find({ _id: { $in: legacyIds } })
                .select('message image file audioUrl createdAt')
                .lean({ getters: true });
            legacyMessages.forEach(msg => { legacyById.set(String(msg._id), msg); });
        }

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

                let lastMessage = '';
                let lastMessageAt = conv.updatedAt;

                if (conv.lastMessageAt) {
                    lastMessage = conv.lastMessagePreview || '';
                    lastMessageAt = conv.lastMessageAt;
                } else {
                    const lastId = Array.isArray(conv.messages) ? conv.messages[conv.messages.length - 1] : null;
                    const last = lastId ? legacyById.get(String(lastId)) : null;
                    lastMessage = buildMessagePreview(last);
                    lastMessageAt = last?.createdAt || conv.updatedAt;
                }

                return {
                    ...user,
                    // Decrypt defensively: lean getters already handle it, but a
                    // raw `enc:v1:` string would leak straight into the chat list.
                    lastMessage: decryptString(lastMessage),
                    lastMessageAt,
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

        // По паре, а не по массиву id из Conversation: массив больше не
        // ведётся, а у старых диалогов он мог быть и неполным.
        await Message.deleteMany({
            $or: [
                { sender: userId, receiver: targetId },
                { sender: targetId, receiver: userId },
            ],
        });
        await conversation.deleteOne();

        return res.status(200).json({ message: 'Переписка удалена' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
