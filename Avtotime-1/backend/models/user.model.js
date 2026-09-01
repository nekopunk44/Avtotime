import mongoose from "mongoose";
import bcrypt from 'bcryptjs'

const usersSchema = new mongoose.Schema({
    name:{
        type: String,
        required:true,
    },
    userName: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    // Secrets and internal fields below are `select: false`: they are stripped
    // from every query unless a caller asks for them explicitly
    // (`.select('+password')` or an inclusive projection naming the path).
    // This is what keeps them out of populate() results and of any handler
    // that returns a user document as-is.
    password:{
        type: String,
        required: false,
        default: null,
        select: false,
    },
    googleId: {
        type: String,
        default: null,
        sparse: true,
        index: true,
    },
    profileImage: {
        type: String,
    },
    bio: {
        type: String,
    },
    profession: {
        type: String,
    },
    gender: {
        type: String,
        enum:['male', 'female']
    },
    location: {
        type: String,
        trim: true,
        maxlength: 60,
    },
    website: {
        type: String,
        trim: true,
        maxlength: 120,
    },
    instagram: {
        type: String,
        trim: true,
        maxlength: 40,
    },
    telegram: {
        type: String,
        trim: true,
        maxlength: 40,
    },
    followers: [
        {type:mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }
    ],
    following: [
        {type:mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }
    ],
    posts:[
        {type:mongoose.Schema.Types.ObjectId,
            ref: 'Post',
        }
    ],
    saved: [
        {type:mongoose.Schema.Types.ObjectId,
            ref: 'Post',
        }
    ],
    loops: [
        {type:mongoose.Schema.Types.ObjectId,
            ref: 'Loop',
        }
    ],
    story: {
        type:mongoose.Schema.Types.ObjectId,
            ref: 'Story',
    },
    resetOtp: {
        type: String,
        select: false,
    },
    otpExpires:{
        type: Date,
        select: false,
    },
    isOtpVerified: {
        type: Boolean,
        default: false,
    },
    notificationPreferences: {
        like: { type: Boolean, default: true },
        comment: { type: Boolean, default: true },
        follow: { type: Boolean, default: true },
        message: { type: Boolean, default: true },
        mention: { type: Boolean, default: true },
        listing_comment: { type: Boolean, default: true },
        system: { type: Boolean, default: true },
        emailNotifications: { type: Boolean, default: false },
        digestFrequency: { type: String, enum: ['instant', 'daily', 'weekly', 'never'], default: 'instant' }
    },
    lastNotificationCheckAt: {
        type: Date,
        default: () => new Date()
    },
    expoPushTokens: {
        type: [String],
        default: [],
        select: false,
    },
    lastSeenAt: {
        type: Date,
        default: null,
    },
    phone: {
        type: String,
        trim: true,
        maxlength: 30,
    },
    address: {
        type: String,
        trim: true,
        maxlength: 120,
    },
    region: {
        type: String,
        trim: true,
        maxlength: 60,
    },
    preferredContact: {
        type: String,
        enum: ['phone_and_messages', 'messages_only', 'email'],
        default: 'phone_and_messages',
    },
    plan: {
        type: String,
        enum: ['free', 'pro', 'business'],
        default: 'free',
    },
    planActivatedAt: { type: Date, default: null },
    planExpiresAt:   { type: Date, default: null },
    planExpiryWarnedThreshold: { type: Number, default: null }, // 7 | 3 | 1, последний отправленный порог
    stripeCustomerId: { type: String, default: null, select: false },
    isEmailVerified: {
        type: Boolean,
        default: false,
        index: true,
    },
    emailVerifyToken: {
        type: String,
        default: null,
        select: false,
    },
    emailVerifyExpires: {
        type: Date,
        default: null,
        select: false,
    },
    isAdmin: {
        type: Boolean,
        default: false,
        index: true,
    },
    isBanned: {
        type: Boolean,
        default: false,
        index: true,
    },
    banReason: {
        type: String,
        default: null,
    },
    bannedAt: {
        type: Date,
        default: null,
    },
    tokenVersion: {
        type: Number,
        default: 0,
        select: false,
    },
    blockedUsers: [
        { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    ],
},{timestamps:true})

usersSchema.methods.matchPassword = async function matchPassword(plainPassword) {
    // `password` is select:false — a caller that forgot `.select('+password')`
    // would otherwise blow up inside bcrypt with a confusing error.
    if (typeof this.password !== 'string' || !this.password) return false
    return bcrypt.compare(plainPassword, this.password)
}

const User=mongoose.model('User', usersSchema)
export default User
