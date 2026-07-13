import express from 'express'
import isAuth from '../middlewars/isAuth.js'
import isEmailVerified from '../middlewars/isEmailVerified.js'
import { upload } from '../middlewars/multer.js'
import { gettAllPost, getPostById, getPostsByUser, like, uploadPost, saved, comment, searchPosts, deletePost, editPost } from '../controllers/post.controllers.js'

const postRouter = express.Router()

postRouter.post('/upload', isAuth, isEmailVerified, upload.array('media', 8), uploadPost)
postRouter.get('/getAll', isAuth, gettAllPost)
postRouter.get('/user/:userId', isAuth, getPostsByUser)
postRouter.get('/get/:postId', isAuth, getPostById)
postRouter.get('/search', isAuth, searchPosts)
postRouter.get('/like/:postId', isAuth, like)
postRouter.get('/saved/:postId', isAuth, saved)
postRouter.post('/comment/:postId', isAuth, comment)
postRouter.delete('/delete/:postId', isAuth, deletePost)
postRouter.patch('/edit/:postId', isAuth, upload.array('media', 8), editPost)

export default postRouter
