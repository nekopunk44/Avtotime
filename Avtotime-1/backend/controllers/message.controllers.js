import uploadOnCloudinary from '../config/cloudinary.js';
import { buildPublicFileUrl } from '../config/publicFiles.js';
import Conversation from '../models/conversation.model.js'; 
import Message from '../models/messages.model.js';

const DEFAULT_MESSAGES_PAGE_SIZE = 50;
const MAX_MESSAGES_PAGE_SIZE = 100;

export const sendMessage = async (req, res) => {
    try {
        const senderId = req.userId;
        const receiverId = req.params.receiverId; 
        const { message } = req.body;

        let imageUrl = null;
        let fileUrl = null;
        let fileName = null;
        let fileType = null;
        let fileSize = null;

        const imageFile = req.files?.image?.[0] || null;
        const anyFile = req.files?.file?.[0] || null;
        const picked = imageFile || anyFile;

        if (picked) {
            console.log("Путь к файлу для загрузки:", picked.path); 
            const uploadedUrl = await uploadOnCloudinary(picked.path); 
            const finalUrl = uploadedUrl || buildPublicFileUrl(req, picked) || null;
            console.log("Результат загрузки в Cloudinary:", uploadedUrl);

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
    image: imageUrl, //  будет либо ссылка, либо null
    file: fileUrl,
    fileName,
    fileType,
    fileSize,
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
