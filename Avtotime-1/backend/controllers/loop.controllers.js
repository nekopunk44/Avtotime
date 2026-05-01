import uploadOnCloudinary, { deleteFromCloudinary } from '../config/cloudinary.js';
import Loop from '../models/loop.model.js'
import User from '../models/user.model.js';
import { createNotification } from './notification.controllers.js';
import { moderateTextAndImages } from '../services/aiModeration.js';

const SOCIAL_COMMENTS_PREVIEW_LIMIT = 3;

const trimLoopCommentsForFeed = (loop) => {
    const comments = Array.isArray(loop?.comments) ? loop.comments : [];
    const preview = comments.slice(-SOCIAL_COMMENTS_PREVIEW_LIMIT);

    return {
        ...loop,
        commentsCount: comments.length,
        commentsPreview: preview,
        comments: preview,
    };
};

export const uploadLoop = async(req, res) => {
    try {
        const {caption} = req.body
        let media;
        if(req.file){
            media = await uploadOnCloudinary(req.file.path)
        } else {
            return res.status(400).json({message: 'Необходимы медиа'})
        }

        const modResult = await moderateTextAndImages({
            text: caption || "",
            imageUrls: [],
        })
        if (!modResult.skipped && modResult.flagged) {
            await deleteFromCloudinary(media).catch(() => {})
            return res.status(422).json({ message: "Публикация отклонена: контент не прошёл проверку." })
        }

        const loop = await Loop.create({
            caption, media, author: req.userId
        })

        const user = await User.findById(req.userId)
        user.loops.push(loop._id)
        await user.save()
        
        const populatedLoop = await Loop.findById(loop._id).populate('author', 'name userName profileImage')

        return res.status(201).json(populatedLoop)
    } catch (error) {
        return res.status(500).json({message: `Ошибка цикла загрузки ${error}`})
    }
}



export const like = async (req, res) => {
    try {
        const loopId = req.params.loopId
        const loop = await Loop.findById(loopId)
        if(!loop) {
            return res.status(400).json({message: 'Loop не найден'})
        }

        const alreadyLiked = loop.likes.some(id => id.toString() == req.userId.toString())

        if(alreadyLiked){
            loop.likes = loop.likes.filter(id => id.toString() != req.userId.toString())
        } else {
            loop.likes.push(req.userId)

            // Notify loop author
            if (loop.author.toString() !== req.userId.toString()) {
                const currentUser = await User.findById(req.userId).select('name userName profileImage')
                await createNotification({
                    recipient: loop.author,
                    actor: req.userId,
                    type: 'like',
                    title: 'Новый лайк',
                    description: `${currentUser.userName} лайкнул(а) ваш loop`,
                    relatedId: loop._id,
                    relatedType: 'loop',
                    image: currentUser.profileImage,
                    link: `/loop/${loop._id}`
                })
            }
        }

        await loop.save()
        await loop.populate('author', 'name userName profileImage')
        return res.status(200).json(loop)
    } catch (error) {
        return res.status(500).json({message: `like loop error ${error}`})
    }
}

export const comment = async (req, res) => {
    try {
        const {message} = req.body
        const loopId=req.params.loopId
        const loop = await Loop.findById(loopId)
        if(!loop) {
            return res.status(400).json({message: 'Цикл не найден'})
        }
        loop.comments.push({
            author: req.userId,
            message
        })
        await loop.save()
        await loop.populate('author', 'name userName profileImage')
        await loop.populate('comments.author')

        // Notify loop author
        if (loop.author.toString() !== req.userId.toString()) {
            const currentUser = await User.findById(req.userId).select('name userName profileImage')
            await createNotification({
                recipient: loop.author,
                actor: req.userId,
                type: 'comment',
                title: 'Новый комментарий',
                description: `${currentUser.userName} прокомментировал(а) ваш loop`,
                relatedId: loop._id,
                relatedType: 'loop',
                image: currentUser.profileImage,
                link: `/loop/${loop._id}`
            })
        }

        return res.status(200).json(loop)
    } catch (error) {
        return res.status(500).json({message: `Comment loop error ${error}`})
    }
}


export const gettAllLoops = async(req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1)
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20))
        const skip = (page - 1) * limit

        const loops = await Loop.find({})
        .populate('author', 'name userName profileImage')
        .populate("comments.author", 'name userName profileImage')
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit)
        .lean()
        return res.status(200).json(loops.map(trimLoopCommentsForFeed))
    } catch (error) {
        return res.status(500).json({message: `get all loop error ${error}`})
    }
}
