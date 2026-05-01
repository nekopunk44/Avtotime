import express from 'express'
import isAuth from '../middlewars/isAuth.js'
import isEmailVerified from '../middlewars/isEmailVerified.js'
import {upload} from '../middlewars/multer.js'
import { comment, gettAllLoops, like, uploadLoop } from '../controllers/loop.controllers.js'


const loopRouter=express.Router()

loopRouter.post('/upload', isAuth, isEmailVerified, upload.single('media'),uploadLoop)
loopRouter.get('/getAll', isAuth, gettAllLoops)
loopRouter.get('/like/:loopId', isAuth, like)

loopRouter.post('/comment/:loopId', isAuth, comment)

export default loopRouter