import mongoose from "mongoose";
import { decryptString, encryptString } from "../services/crypto/fieldEncryption.js";


const conversationSchema = new mongoose.Schema({
    participants: [
        {type:mongoose.Schema.Types.ObjectId,
        ref: "User"
        }
    ],
    messages: [
        {
        type:mongoose.Schema.Types.ObjectId,
        ref: "Message"
        }
    ],

    // Denormalized copy of the last message so the chat list is one query.
    // Populating messages with perDocumentLimit made mongoose issue a separate
    // query per conversation (N+1). Conversations created before these fields
    // existed keep them empty — readers must fall back to the messages array.
    // The preview mirrors Message.message encryption at rest.
    lastMessagePreview: {
        type: String,
        default: "",
        set: encryptString,
        get: decryptString,
    },
    lastMessageAt: {
        type: Date,
        default: null,
    },
    lastMessageSender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },

},{
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
})

conversationSchema.index({ participants: 1, updatedAt: -1 })


const Conversation = mongoose.model("Conversation",
    conversationSchema
)

export default Conversation
