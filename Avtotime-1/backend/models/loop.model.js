import mongoose from "mongoose";

const loopSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    media: {
        type: String,
        required: true,
    },
    // Кадр-заставка: сетки и списки показывают картинку, а не чёрную плитку.
    poster: {
        type: String,
        default: '',
    },
    caption: {
        type: String,
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],
    comments: [{
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        message: {
            type: String
        }
    }]
}, { timestamps: true }); 

loopSchema.index({ createdAt: -1 });
loopSchema.index({ author: 1, createdAt: -1 });

const Loop = mongoose.model('Loop', loopSchema); 

export default Loop;
