import express from 'express'
import isAuth from '../middlewars/isAuth.js'
import { upload } from '../middlewars/multer.js'
import {
    getAllMessages,
    getPrevUserChats,
    sendMessage,
    blockUser,
    unblockUser,
    getBlockedStatus,
    deleteConversation,
} from '../controllers/message.controllers.js'

const messageRouter = express.Router()

messageRouter.post(
    '/send/:receiverId',
    isAuth,
    upload.fields([
        { name: 'image', maxCount: 1 },
        { name: 'file', maxCount: 1 },
        { name: 'audio', maxCount: 1 },
    ]),
    sendMessage
)
messageRouter.get('/getAll/:receiverId', isAuth, getAllMessages)
messageRouter.get('/prevChats/', isAuth, getPrevUserChats)

messageRouter.post('/block/:targetId', isAuth, blockUser)
messageRouter.delete('/block/:targetId', isAuth, unblockUser)
messageRouter.get('/block/:targetId', isAuth, getBlockedStatus)
messageRouter.delete('/conversation/:targetId', isAuth, deleteConversation)

export default messageRouter
