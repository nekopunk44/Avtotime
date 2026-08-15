import uploadOnCloudinary, { deleteFromCloudinary } from "../config/cloudinary.js";
import Post from '../models/post.model.js'
import User from '../models/user.model.js'
import { createNotification } from './notification.controllers.js'
import { moderateTextAndImages } from '../services/aiModeration.js'

const SOCIAL_COMMENTS_PREVIEW_LIMIT = 3

const normalizeMediaList = (postLike) => {
    const mediaList = Array.isArray(postLike?.mediaList) && postLike.mediaList.length
        ? postLike.mediaList
        : postLike?.media
            ? [postLike.media]
            : []

    return {
        ...postLike,
        media: postLike?.media || mediaList[0] || '',
        mediaList,
    }
}

const trimPostCommentsForFeed = (post) => {
    const comments = Array.isArray(post?.comments) ? post.comments : []
    const preview = comments.slice(-SOCIAL_COMMENTS_PREVIEW_LIMIT)

    return normalizeMediaList({
        ...post,
        commentsCount: comments.length,
        commentsPreview: preview,
        comments: preview,
    })
}

const deletePostMedia = async (post) => {
    const mediaList = Array.isArray(post?.mediaList) && post.mediaList.length
        ? post.mediaList
        : post?.media
            ? [post.media]
            : []

    await Promise.allSettled(mediaList.map(item => deleteFromCloudinary(item)))
}

export const uploadPost = async(req, res) => {
    try {
        const { caption, mediaType } = req.body
        const pickedFiles = Array.isArray(req.files) ? req.files : (req.file ? [req.file] : [])

        if (!pickedFiles.length) {
            return res.status(400).json({ message: 'Необходимы медиа' })
        }

        if (mediaType === 'video' && pickedFiles.length > 1) {
            return res.status(400).json({ message: 'Можно загрузить только одно видео' })
        }

        const mediaList = (
            await Promise.all(pickedFiles.map(file => uploadOnCloudinary(file.path)))
        ).filter(Boolean)

        if (!mediaList.length) {
            return res.status(400).json({ message: 'Не удалось загрузить медиа' })
        }

        const modResult = await moderateTextAndImages({
            text: caption || "",
            imageUrls: mediaType === 'image' ? mediaList : [],
        })

        if (!modResult.skipped && modResult.flagged) {
            await Promise.allSettled(mediaList.map(item => deleteFromCloudinary(item)))
            return res.status(422).json({ message: "Публикация отклонена: контент не прошёл проверку." })
        }

        const post = await Post.create({
            caption,
            media: mediaList[0],
            mediaList,
            mediaType,
            author: req.userId,
        })

        const user = await User.findById(req.userId)
        user.posts.push(post._id)
        await user.save()

        const populatedPost = await Post.findById(post._id).populate('author', 'name userName profileImage').lean()

        return res.status(201).json(normalizeMediaList(populatedPost))
    } catch (error) {
        return res.status(500).json({ message: `Ошибка загрузки поста ${error}` })
    }
}

export const gettAllPost = async(req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1)
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20))
        const skip = (page - 1) * limit

        const posts = await Post.find({})
            .populate('author', 'name userName profileImage')
            .populate('comments.author', 'name userName profileImage')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean()
        return res.status(200).json(posts.map(trimPostCommentsForFeed))
    } catch (error) {
        return res.status(500).json({ message: `getallpost error ${error}` })
    }
}

export const getPostsByUser = async(req, res) => {
    try {
        const { userId } = req.params
        if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
            return res.status(400).json({ message: 'Некорректный пользователь' })
        }

        const page = Math.max(1, parseInt(req.query.page) || 1)
        const limit = Math.min(90, Math.max(1, parseInt(req.query.limit) || 30))
        const skip = (page - 1) * limit

        const [posts, total] = await Promise.all([
            Post.find({ author: userId })
                .populate('author', 'name userName profileImage')
                .populate('comments.author', 'name userName profileImage')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Post.countDocuments({ author: userId }),
        ])

        return res.status(200).json({
            posts: posts.map(trimPostCommentsForFeed),
            total,
            page,
            limit,
        })
    } catch (error) {
        return res.status(500).json({ message: `Ошибка получения постов пользователя ${error}` })
    }
}

export const getPostById = async(req, res) => {
    try {
        const post = await Post.findById(req.params.postId)
            .populate('author', 'name userName profileImage')
            .populate('comments.author', 'name userName profileImage')
            .lean()

        if (!post) {
            return res.status(404).json({ message: 'Пост не найден' })
        }

        return res.status(200).json(normalizeMediaList({
            ...post,
            commentsCount: Array.isArray(post.comments) ? post.comments.length : 0,
        }))
    } catch (error) {
        return res.status(500).json({ message: `Ошибка получения поста ${error}` })
    }
}

export const searchPosts = async (req, res) => {
    try {
        const q = String(req.query.q || '').trim()
        if (!q || q.length < 2) {
            return res.status(400).json({ message: 'Поисковый запрос должен быть не менее 2 символов' })
        }

        // Escape regex metacharacters: raw user input like "(((" would throw
        // (500) and long patterns invite ReDoS.
        const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const posts = await Post.find({
            caption: new RegExp(safe, 'i'),
        })
            .populate('author', 'name userName profileImage')
            .populate('comments.author', 'name userName profileImage')
            .sort({ createdAt: -1 })
            .limit(30)
            .lean()

        return res.status(200).json(posts.map(trimPostCommentsForFeed))
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

export const like = async (req, res) => {
    try {
        const postId = req.params.postId
        const post = await Post.findById(postId)
        if (!post) {
            return res.status(400).json({ message: 'Пост не найден' })
        }

        const alreadyLiked = post.likes.some(id => id.toString() === req.userId.toString())

        if (alreadyLiked) {
            post.likes = post.likes.filter(id => id.toString() !== req.userId.toString())
        } else {
            post.likes.push(req.userId)

            if (post.author.toString() !== req.userId.toString()) {
                const currentUser = await User.findById(req.userId).select('name userName profileImage')
                await createNotification({
                    recipient: post.author,
                    actor: req.userId,
                    type: 'like',
                    title: 'Новый лайк',
                    description: `${currentUser.userName} лайкнул(а) ваш пост`,
                    relatedId: post._id,
                    relatedType: 'post',
                    image: currentUser.profileImage,
                    link: `/post/${post._id}`,
                })
            }
        }

        await post.save()
        await post.populate('author', 'name userName profileImage')
        return res.status(200).json(normalizeMediaList(post.toObject()))
    } catch (error) {
        return res.status(500).json({ message: `Ошибка лайка поста ${error}` })
    }
}

export const comment = async (req, res) => {
    try {
        const { message } = req.body
        const postId = req.params.postId
        const post = await Post.findById(postId)
        if (!post) {
            return res.status(400).json({ message: 'Пост не найден' })
        }
        post.comments.push({
            author: req.userId,
            message,
        })
        await post.save()
        await post.populate('author', 'name userName profileImage')
        await post.populate('comments.author')

        if (post.author._id.toString() !== req.userId.toString()) {
            const currentUser = await User.findById(req.userId).select('name userName profileImage')
            await createNotification({
                recipient: post.author._id,
                actor: req.userId,
                type: 'comment',
                title: 'Новый комментарий',
                description: `${currentUser.userName} прокомментировал(а) ваш пост`,
                relatedId: post._id,
                relatedType: 'post',
                image: currentUser.profileImage,
                link: `/post/${post._id}`,
            })
        }

        return res.status(200).json(normalizeMediaList(post.toObject()))
    } catch (error) {
        return res.status(500).json({ message: `Ошибка цикла комментария ${error}` })
    }
}

export const deletePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId)
        if (!post) return res.status(404).json({ message: 'Пост не найден' })
        if (post.author.toString() !== req.userId.toString()) {
            return res.status(403).json({ message: 'Нет доступа' })
        }

        await deletePostMedia(post)
        await Post.findByIdAndDelete(post._id)
        await User.findByIdAndUpdate(req.userId, { $pull: { posts: post._id } })

        return res.status(200).json({ message: 'Пост удалён', postId: post._id })
    } catch (error) {
        return res.status(500).json({ message: `Ошибка удаления поста: ${error}` })
    }
}

export const editPost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId)
        if (!post) return res.status(404).json({ message: 'Пост не найден' })
        if (post.author.toString() !== req.userId.toString()) {
            return res.status(403).json({ message: 'Нет доступа' })
        }

        const pickedFiles = Array.isArray(req.files) ? req.files : (req.file ? [req.file] : [])
        const caption = typeof req.body.caption === 'string' ? req.body.caption.trim() : post.caption
        const requestedMediaType = req.body.mediaType === 'video' ? 'video' : req.body.mediaType === 'image' ? 'image' : null
        const detectedMediaType = pickedFiles[0]?.mimetype?.startsWith('video/') ? 'video' : 'image'
        const mediaType = requestedMediaType || (pickedFiles.length ? detectedMediaType : post.mediaType || detectedMediaType)

        if (mediaType === 'video' && pickedFiles.length > 1) {
            return res.status(400).json({ message: 'Можно загрузить только одно видео' })
        }

        let nextMediaList = null
        if (pickedFiles.length) {
            nextMediaList = (
                await Promise.all(pickedFiles.map(file => uploadOnCloudinary(file.path)))
            ).filter(Boolean)

            if (!nextMediaList.length) {
                return res.status(400).json({ message: 'Не удалось загрузить медиа' })
            }
        }

        const imageUrlsForModeration = mediaType === 'image'
            ? nextMediaList || (Array.isArray(post.mediaList) && post.mediaList.length ? post.mediaList : post.media ? [post.media] : [])
            : []
        const modResult = await moderateTextAndImages({
            text: caption || "",
            imageUrls: imageUrlsForModeration,
        })

        if (!modResult.skipped && modResult.flagged) {
            if (nextMediaList) {
                await Promise.allSettled(nextMediaList.map(item => deleteFromCloudinary(item)))
            }
            return res.status(422).json({ message: "Публикация отклонена: контент не прошёл проверку." })
        }

        if (nextMediaList) {
            await deletePostMedia(post)
            post.media = nextMediaList[0]
            post.mediaList = nextMediaList
            post.mediaType = mediaType
        }

        post.caption = caption
        await post.save()
        await post.populate('author', 'name userName profileImage')

        return res.status(200).json(trimPostCommentsForFeed(post.toObject()))
    } catch (error) {
        return res.status(500).json({ message: `Ошибка редактирования поста: ${error}` })
    }
}

export const saved = async(req, res) => {
    try {
        const postId = req.params.postId
        const user = await User.findById(req.userId).select('-password')

        const alreadySaved = user.saved.some(id => id.toString() === postId.toString())

        if (alreadySaved) {
            user.saved = user.saved.filter(id => id.toString() !== postId.toString())
        } else {
            user.saved.push(postId)
        }

        await user.save()

        return res.status(200).json(user)
    } catch (error) {
        return res.status(500).json({ message: `Ошибка сохранения ${error}` })
    }
}
