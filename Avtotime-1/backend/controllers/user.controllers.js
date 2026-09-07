import uploadOnCloudinary from '../config/cloudinary.js'
import User from '../models/user.model.js'
import Post from '../models/post.model.js'
import Loop from '../models/loop.model.js'
import Story from '../models/story.model.js'
import Conversation from '../models/conversation.model.js'
import Message from '../models/messages.model.js'
import Notification from '../models/notification.model.js'
import { createNotification } from './notification.controllers.js'
import Favorite from '../models/favorite.model.js'
import DrivingTestResult from '../models/drivingTestResult.model.js'
import MarketCarListing from '../models/marketCarListing.model.js'
import MarketPartListing from '../models/marketPartListing.model.js'
import MarketCarServiceListing from '../models/marketCarServiceListing.model.js'
import MarketAutoTuningListing from '../models/marketAutoTuningListing.model.js'
import MarketDryCleaningListing from '../models/marketDryCleaningListing.model.js'
import MarketConsultationExpert from '../models/marketConsultationExpert.model.js'
import { getAuthCookieName } from '../config/authCookie.js'
import genToken from '../config/token.js'
import { invalidateAuthSession } from '../services/authSessionCache.js'
import { disconnectUserSockets } from '../socket.js'
import bcrypt from 'bcryptjs'
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { moderateTextAndImagesLocal } from "../services/localModeration.js";
import { getPlanLimits, serializePlanLimits, getEffectivePlan } from "../config/planLimits.js";
import { applyUserPlanToListings } from "../services/applyUserPlanToListings.js";

const truthy = (value) => ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());

const isCloudinaryConfigured = () => {
    return Boolean(
        String(process.env.CLOUDINARY_CLOUD_NAME || "").trim() &&
        String(process.env.CLOUDINARY_API_KEY || "").trim() &&
        String(process.env.CLOUDINARY_API_SECRET || "").trim()
    );
};

const getBaseUrl = (req) => {
    const configured = String(process.env.BASE_URL || "").trim();
    if (configured) return configured.replace(/\/+$/, "");

    const proto = req?.protocol || "http";
    const host = req?.get?.("host") || "";
    if (!host) return "";
    return `${proto}://${host}`;
};

const getLocalModelDirUrl = () => {
    const configured = String(process.env.AI_MODERATION_NSFWJS_MODEL_DIR || "").trim();
    if (configured) return pathToFileURL(path.resolve(configured) + path.sep).toString();

    const here = path.dirname(fileURLToPath(import.meta.url));
    return pathToFileURL(path.resolve(here, "..", "moderation", "models", "nsfwjs") + path.sep).toString();
};

const unlinkIfExists = (filePath) => {
    if (!filePath) return;
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
        // ignore
    }
};

const normalizeGender = (raw) => {
    const value = String(raw ?? '').trim().toLowerCase();
    if (!value) return null;
    if (value === 'male' || value === 'm' || value === 'мужской' || value === 'мужчина') return 'male';
    if (value === 'female' || value === 'f' || value === 'женский' || value === 'женщина') return 'female';
    return null;
};

// Public-safe projection for other people's accounts: never expose email,
// phone, push tokens, OTP/verification secrets or block lists to third parties.
const PUBLIC_USER_FIELDS = 'name userName profileImage bio profession location followers following posts'
// Contact/social details that are meant to be visible on a public profile page.
const PUBLIC_PROFILE_EXTRA_FIELDS = 'website instagram telegram preferredContact createdAt'
// Everything the owner is allowed to see about their own account. Secrets
// (password, OTP hashes, verification tokens, push tokens, Stripe id,
// tokenVersion) are `select: false` in the schema and stay out on purpose.
const OWNER_PROFILE_FIELDS = `${PUBLIC_USER_FIELDS} ${PUBLIC_PROFILE_EXTRA_FIELDS} email phone address region gender saved loops story plan planActivatedAt planExpiresAt isEmailVerified isAdmin isBanned banReason notificationPreferences lastSeenAt blockedUsers updatedAt`
const AUTHOR_FIELDS = 'name userName profileImage'

export const getCurrentUser = async (req, res) => {
    try {
        const userId = req.userId
        // tokenVersion is select:false but is needed to mint the sliding-session
        // token below, so it has to be requested explicitly.
        const user = await User.findById(userId)
            .select(`${OWNER_PROFILE_FIELDS} +tokenVersion`)
            // posts и loops сознательно НЕ популятся: их не читает ни один
            // клиент (профили грузят посты отдельным запросом), а тянулись они
            // целиком, с авторами всех комментариев, при каждом старте
            // приложения. saved остаётся — его показывает экран сохранённого
            // в мобилке.
            .populate([
                { path: 'saved', populate: { path: 'author', select: AUTHOR_FIELDS } },
                { path: 'story' },
            ])
        if (!user) {
            return res.status(400).json({ message: 'Пользователь не найден' })
        }

        const effectivePlan = getEffectivePlan(user.plan, user.planExpiresAt)
        const planLimits = serializePlanLimits(getPlanLimits(effectivePlan))

        const userObj = user.toObject()
        userObj.effectivePlan = effectivePlan
        userObj.planLimits = planLimits
        // Sliding session: hand back a fresh token so active clients keep a
        // valid one and don't get bounced to the login screen.
        userObj.token = genToken(user._id, user.tokenVersion ?? 0)
        delete userObj.tokenVersion

        return res.status(200).json(userObj)
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

export const suggestedUsers = async (req, res) => {
    try {
        const users = await User.find({
            _id: { $ne: req.userId }
        }).select(PUBLIC_USER_FIELDS).limit(20).lean()
        return res.status(200).json(users)
    } catch (error) {
        return res.status(500).json({ message: `Получить предлагаемую ошибку пользователя ${error}` })
    }
}

export const editProfile = async (req, res) => {
    try {

        const { name, userName, bio, profession, gender, location, website, instagram, telegram, phone, address, region, preferredContact } = req.body
        const genderProvided = gender != null && String(gender).trim() !== '';
        const normalizedGender = genderProvided ? normalizeGender(gender) : null;
        if (genderProvided && !normalizedGender) {
            return res.status(400).json({ message: "Неверное значение поля 'Пол'" });
        }
        
        const user = await User.findById(req.userId).select('-password')
        if (!user) {
            return res.status(400).json({ message: 'Пользователь не найден' })
        }

        if (userName !== undefined) {
            const sameUserWithUserName = await User.findOne({ userName }).select('_id')
            if (sameUserWithUserName && sameUserWithUserName._id.toString() !== req.userId.toString()) {
                return res.status(400).json({ message: 'Пользователь уже существует' })
            }
        }

        let profileImage;
        if (req.file) {
            const filePath = req.file.path;
            const mime = String(req.file.mimetype || "image/jpeg") || "image/jpeg";

            // Off unless explicitly enabled: the moderation stack
            // (@tensorflow/tfjs, nsfwjs, sharp) lives in optionalDependencies and
            // the production image is built with `npm ci --omit=optional`, so
            // defaulting to "on" turned every avatar upload into a 500.
            const enableImageModeration = truthy(process.env.AI_PROFILE_IMAGE_MODERATION_ENABLED ?? "false");
            if (enableImageModeration) {
                try {
                    const buf = fs.readFileSync(filePath);
                    const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;

                    const moderation = await moderateTextAndImagesLocal({
                        text: "",
                        imageUrls: [dataUrl],
                        nsfwjsModelDirUrl: getLocalModelDirUrl(),
                    });

                    if (moderation?.flagged) {
                        unlinkIfExists(filePath);
                        return res.status(400).json({
                            message: "Фотография отклонена: обнаружен 18+ контент",
                            reasons: Array.isArray(moderation?.reasons) ? moderation.reasons : [],
                        });
                    }
                } catch (error) {
                    unlinkIfExists(filePath);
                    const message = error instanceof Error ? error.message : String(error || "Unknown moderation error");
                    return res.status(500).json({ message: `Ошибка проверки фотографии: ${message}` });
                }
            }

            if (isCloudinaryConfigured()) {
                profileImage = await uploadOnCloudinary(filePath)
                if (!profileImage) {
                    return res.status(500).json({ message: "Не удалось загрузить фотографию профиля (Cloudinary)" });
                }
            } else {
                const baseUrl = getBaseUrl(req);
                const filename = path.basename(filePath);
                // File is already stored under backend/public and served as /api/public/*
                profileImage = baseUrl ? `${baseUrl}/api/public/${encodeURIComponent(filename)}` : `/api/public/${encodeURIComponent(filename)}`;
            }
        }

        // Partial updates must not wipe fields that were simply omitted.
        if (name !== undefined) user.name = name
        if (userName !== undefined) user.userName = userName
        if(profileImage) {
            user.profileImage = profileImage
        }
        if (bio !== undefined) user.bio = bio
        if (profession !== undefined) user.profession = profession
        if (genderProvided) user.gender = normalizedGender
        if (location !== undefined) user.location = location
        if (website !== undefined) user.website = website
        if (instagram !== undefined) user.instagram = instagram
        if (telegram !== undefined) user.telegram = telegram
        if (phone !== undefined) user.phone = phone?.trim() || ''
        if (address !== undefined) user.address = address?.trim() || ''
        if (region !== undefined) user.region = region?.trim() || ''
        if (preferredContact !== undefined) user.preferredContact = preferredContact

        await user.save()

        return res.status(200).json(user)

    } catch (error) {
        return res.status(500).json({ message: `Ошибка редактирования профиля ${error}` })
    }
}

export const getProfile = async (req, res) => {
    try {
        const userName = req.params.userName;

        // Resolve the id first so the projection can depend on who is asking:
        // the owner gets contact details and saved posts, everybody else gets
        // the public profile only.
        const target = await User.findOne({ userName }).select('_id').lean();
        if (!target) return res.status(400).json({ message: 'Пользователь не найден' });

        const isOwner = String(target._id) === String(req.userId || '');

        const populatePaths = [
            { path: 'posts', populate: { path: 'author', select: AUTHOR_FIELDS } },
            { path: 'followers', select: AUTHOR_FIELDS },
            { path: 'following', select: AUTHOR_FIELDS },
        ];
        if (isOwner) {
            populatePaths.push({ path: 'saved', populate: { path: 'author', select: AUTHOR_FIELDS } });
        }

        const user = await User.findById(target._id)
            .select(isOwner ? OWNER_PROFILE_FIELDS : `${PUBLIC_USER_FIELDS} ${PUBLIC_PROFILE_EXTRA_FIELDS}`)
            .populate(populatePaths);

        if (!user) return res.status(400).json({ message: 'Пользователь не найден' });
        return res.status(200).json(user);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}


export const follow=async (req, res)=>{
    try{
        const currentUserId = req.userId
        const targetUserId = req.params.targetUserId

        if(!targetUserId){
            return res.status(400).json({message: 'Целевой пользователь не найден'})
        }

        if(currentUserId==targetUserId){
        return res.status(400).json({message: 'Ты не можешь подписаться сам на себя '})
        }

        const targetUser = await User.findById(targetUserId).select('_id name userName')
        if (!targetUser) {
            return res.status(404).json({ message: 'Пользователь не найден' })
        }

        const currentUser = await User.findById(currentUserId).select('following name userName')
        const isFollowing = currentUser.following.some(id => id.toString() === targetUserId.toString())

        // Atomic $addToSet/$pull — concurrent taps can no longer duplicate or
        // lose entries in the two arrays.
        if (isFollowing) {
            await Promise.all([
                User.updateOne({ _id: currentUserId }, { $pull: { following: targetUserId } }),
                User.updateOne({ _id: targetUserId }, { $pull: { followers: currentUserId } }),
            ])
            return res.status(200).json({
                following: false,
                message: 'Вы отписались'
            })
        } else {
            await Promise.all([
                User.updateOne({ _id: currentUserId }, { $addToSet: { following: targetUserId } }),
                User.updateOne({ _id: targetUserId }, { $addToSet: { followers: currentUserId } }),
            ])
            createNotification({
                recipient: targetUserId,
                actor: currentUserId,
                type: 'follow',
                title: 'Новый подписчик',
                description: `${currentUser.userName || currentUser.name || 'Пользователь'} подписался(ась) на вас`,
                link: `/profile-id/${currentUserId}`,
            }).catch(() => {})
            return res.status(200).json({
                following: true,
                message: 'Вы подписались'
            })
        }

    } catch (error) {
         return res.status(500).json({ message: `Ошибка подписки${error}` })
    }
}

export const getFollowers = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).populate('followers', 'name userName profileImage bio');
        
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        return res.status(200).json(user.followers);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const getFollowing = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).populate('following', 'name userName profileImage bio');
        
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        return res.status(200).json(user.following);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const getUserById = async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({ message: 'User ID required' });
        }

        const user = await User.findById(userId)
            .select(`${PUBLIC_USER_FIELDS} ${PUBLIC_PROFILE_EXTRA_FIELDS}`)
            .populate([
                { path: 'posts', limit: 10 },
                { path: 'followers', select: AUTHOR_FIELDS },
                { path: 'following', select: AUTHOR_FIELDS },
            ]);

        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Add follower count
        return res.status(200).json({
            ...user.toObject(),
            followersCount: user.followers.length,
            followingCount: user.following.length,
            postsCount: user.posts.length,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const deleteProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const { password } = req.body;
        const isProd = process.env.NODE_ENV === 'production'
        const sameSite = process.env.COOKIE_SAMESITE || (isProd ? 'None' : 'Lax')
        const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd

        if (!password) {
            return res.status(400).json({ message: 'Пароль требуется' });
        }

        // password is select:false — matchPassword below needs it loaded.
        const user = await User.findById(userId).select('+password');
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Verify password. Google-auth accounts have no local password —
        // bcrypt.compare(pw, null) would throw, and they are already
        // authenticated by JWT, so the extra password gate is skipped.
        const isPasswordCorrect = user.password ? await user.matchPassword(password) : true;
        if (!isPasswordCorrect) {
            return res.status(401).json({ message: 'Неверный пароль' });
        }

        // Cascade delete: remove all content owned by the user
        await Promise.all([
            Post.deleteMany({ author: userId }),
            Loop.deleteMany({ author: userId }),
            Story.deleteMany({ author: userId }),
            Message.deleteMany({ sender: userId }),
            Conversation.deleteMany({ participants: userId }),
            Notification.deleteMany({ $or: [{ recipient: userId }, { actor: userId }] }),
            Favorite.deleteMany({ user: userId }),
            DrivingTestResult.deleteMany({ user: userId }),
            MarketCarListing.deleteMany({ author: userId }),
            MarketPartListing.deleteMany({ author: userId }),
            MarketCarServiceListing.deleteMany({ author: userId }),
            MarketAutoTuningListing.deleteMany({ author: userId }),
            MarketDryCleaningListing.deleteMany({ author: userId }),
            MarketConsultationExpert.deleteMany({ author: userId }),
            User.updateMany(
                { $or: [{ followers: userId }, { following: userId }] },
                { $pull: { followers: userId, following: userId } }
            ),
        ]);
        await User.findByIdAndDelete(userId);
        
        return res
            .clearCookie(getAuthCookieName(), {
                httpOnly: true,
                secure,
                sameSite,
            })
            .clearCookie('token', {
                httpOnly: true,
                secure,
                sameSite,
            })
            .status(200)
            .json({ ok: true, message: 'Профиль удален' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const searchUsers = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({ message: 'Поисковый запрос должен быть не менее 2 символов' });
        }

        const searchQuery = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const users = await User.find({
            $or: [
                { name: new RegExp(searchQuery, 'i') },
                { userName: new RegExp(searchQuery, 'i') },
            ],
        })
            .select('name userName profileImage bio profession')
            .limit(20)
            .lean();

        return res.status(200).json(users);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Укажите текущий и новый пароль' })
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'Новый пароль должен быть не короче 8 символов' })
        }

        // password/tokenVersion are select:false in the schema.
        const user = await User.findById(req.userId).select('+password +tokenVersion')
        if (!user) return res.status(404).json({ message: 'Пользователь не найден' })

        if (typeof user.password !== 'string' || !user.password) {
            return res.status(400).json({ message: 'Для этого аккаунта пароль не задан. Восстановите пароль по email.' })
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password)
        if (!isMatch) {
            return res.status(400).json({ message: 'Текущий пароль неверен' })
        }

        const isProd = process.env.NODE_ENV === 'production'
        const sameSite = process.env.COOKIE_SAMESITE || (isProd ? 'None' : 'Lax')
        const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd

        user.password = await bcrypt.hash(newPassword, 10)
        user.tokenVersion = (user.tokenVersion || 0) + 1
        await user.save()
        await invalidateAuthSession(String(user._id)).catch(() => {})
        // Old sockets keep working after the version bump unless kicked: the
        // handshake only guards NEW connections. The client reconnects with
        // the fresh cookie issued below.
        disconnectUserSockets(String(user._id))

        const nextToken = genToken(user._id, user.tokenVersion)
        res.cookie(getAuthCookieName(), nextToken, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            secure,
            sameSite,
        })

        return res.status(200).json({ message: 'Пароль успешно изменён' })
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

export const logoutAll = async (req, res) => {
    try {
        const isProd = process.env.NODE_ENV === 'production'
        const sameSite = process.env.COOKIE_SAMESITE || (isProd ? 'None' : 'Lax')
        const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd

        const user = await User.findById(req.userId).select('+tokenVersion')
        if (!user) return res.status(404).json({ message: 'Пользователь не найден' })

        user.tokenVersion = (user.tokenVersion || 0) + 1
        await user.save()
        await invalidateAuthSession(String(user._id)).catch(() => {})
        disconnectUserSockets(String(user._id))

        // Issue a fresh token for the current session so the user stays logged in
        const newToken = genToken(user._id, user.tokenVersion)
        res.cookie(getAuthCookieName(), newToken, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            secure,
            sameSite,
        })

        return res.status(200).json({ message: 'Все остальные сессии завершены' })
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

export const setPlan = async (req, res) => {
    try {
        const { plan } = req.body
        // Self-service only allows downgrading to free. Paid plans are granted
        // exclusively by the Stripe webhook (payment.controllers.js) — otherwise
        // this endpoint would be a free bypass of the whole billing system.
        if (plan !== 'free') {
            return res.status(403).json({ message: 'Платные тарифы активируются только через оплату' })
        }

        const update = {
            plan: 'free',
            planExpiryWarnedThreshold: null,
            planActivatedAt: null,
            planExpiresAt: null,
        }

        const user = await User.findByIdAndUpdate(
            req.userId,
            update,
            { new: true, select: '-password' }
        )
        if (!user) return res.status(404).json({ message: 'Пользователь не найден' })

        const effectivePlan = getEffectivePlan(user.plan, user.planExpiresAt)
        const planLimits = serializePlanLimits(getPlanLimits(effectivePlan))

        applyUserPlanToListings(user._id, effectivePlan).catch((err) =>
            console.error('Failed to apply plan to listings:', err)
        )

        return res.status(200).json({
            plan: user.plan,
            effectivePlan,
            planActivatedAt: user.planActivatedAt,
            planExpiresAt: user.planExpiresAt,
            planLimits,
        })
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

export const getFollowStatus = async (req, res) => {
    try {
        const { targetUserId } = req.params;
        const currentUserId = req.userId;

        if (currentUserId === targetUserId) {
            return res.status(200).json({ isFollowing: false, isSelf: true });
        }

        const currentUser = await User.findById(currentUserId).select('following');
        if (!currentUser) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        const isFollowing = currentUser.following.some(id => id.toString() === targetUserId.toString());

        return res.status(200).json({ isFollowing });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
