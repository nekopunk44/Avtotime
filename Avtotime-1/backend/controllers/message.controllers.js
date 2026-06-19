import uploadOnCloudinary from '../config/cloudinary.js';
import { buildPublicFileUrl } from '../config/publicFiles.js';
import Conversation from '../models/conversation.model.js';
import Message from '../models/messages.model.js';
import User from '../models/user.model.js';

const DEFAULT_MESSAGES_PAGE_SIZE = 50;
const MAX_MESSAGES_PAGE_SIZE = 100;

export const sendMessage = async (req, res) => {
    try {
        const senderId = req.userId;
        const receiverId = req.params.receiverId;
        const { message } = req.body;

        // Check if receiver has blocked the sender
        const receiver = await User.findById(receiverId).select('blockedUsers').lean();
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
        return res.status(200).json(newMessage);
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
        .select('participants updatedAt')
        .populate('participants', 'name userName profileImage')
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();

        const userMap = {};

        conversations.forEach(conv => {
            conv.participants.forEach(user => {
                if (user._id.toString() !== currentUserId.toString()) {
                    userMap[user._id] = user;
                }
            });
        });

        const previousUsers = Object.values(userMap);
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
