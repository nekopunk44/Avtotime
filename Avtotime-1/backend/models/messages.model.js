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

    }, {
        timestamps:true,
        toJSON: { getters: true },
        toObject: { getters: true },
    })


    const Message = mongoose.model("Message", messageSchema)

    export default Message
