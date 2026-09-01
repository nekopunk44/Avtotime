import mongoose from "mongoose";
import { decryptString, encryptString } from "../services/crypto/fieldEncryption.js";

const messageSchema = new mongoose.Schema({

    sender: {
        type:mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    receiver:{
        type:mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    message:{
        type:String,
        set: encryptString,
        get: decryptString,
    },
    image:{
        type:String
    },
    file: {
        type: String
    },
    fileName: {
        type: String
    },
    fileType: {
        type: String
    },
    fileSize: {
        type: Number
    },
    audioUrl: {
        type: String,
        default: null,
    },
    read: {
        type: Boolean,
        default: false,
    },

    }, {
        timestamps:true,
        toJSON: { getters: true },
        toObject: { getters: true },
    })

    // Hot paths on this collection, none of which had index support before:
    // the unread aggregation on the chat list ({receiver, read} + $group by
    // sender), the read-marking updateMany on every chat open, and the
    // per-conversation history fetch.
    messageSchema.index({ receiver: 1, read: 1 })
    messageSchema.index({ sender: 1, receiver: 1, read: 1 })
    messageSchema.index({ receiver: 1, sender: 1, createdAt: -1 })

    const Message = mongoose.model("Message", messageSchema)

    export default Message
