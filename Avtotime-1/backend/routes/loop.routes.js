import express from 'express'
import isAuth from '../middlewars/isAuth.js'
import isEmailVerified from '../middlewars/isEmailVerified.js'
import {upload} from '../middlewars/multer.js'
import { comment, getLikedLoops, getLoopById, gettAllLoops, like, saveLoop, uploadLoop } from '../controllers/loop.controllers.js'


const loopRouter=express.Router()

loopRouter.post('/upload', isAuth, isEmailVerified, upload.single('media'),uploadLoop)
loopRouter.get('/getAll', isAuth, gettAllLoops)
loopRouter.get('/byId/:loopId', isAuth, getLoopById)
loopRouter.get('/like/:loopId', isAuth, like)
loopRouter.get('/save/:loopId', isAuth, saveLoop)
loopRouter.get('/liked', isAuth, getLikedLoops)

loopRouter.post('/comment/:loopId', isAuth, comment)

export default loopRouter